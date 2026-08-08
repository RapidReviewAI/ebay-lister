import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const API_KEY = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

    // CEO DEBUG LOG: This will show up in your terminal/Vercel logs.
    console.log("🚨 RAW INPUT KEYS:", Object.keys(body));

    let { images } = body;

    if (!images || !Array.isArray(images)) {
      return NextResponse.json({ error: "No images provided." }, { status: 400 });
    }

    if (!API_KEY) {
      return NextResponse.json({ error: "API Key missing." }, { status: 500 });
    }

    // SANITIZATION STEP: 
    // We ensure 'urls' is ONLY an array of strings. 
    // If the frontend sent [{url: '...', source: '...'}], this extracts just the string.
    const cleanUrls = images.map(img => {
      if (typeof img === 'string') return img;
      if (typeof img === 'object' && img && img.url) return img.url;
      return null;
    }).filter(u => u !== null) as string[];

    console.log(`🚨 PROCESSING ${cleanUrls.length} CLEANED URLS`);

    // 1. Fetch images and convert to Base64
    const base64Images = await Promise.all(
      cleanUrls.map(async (url) => {
        try {
          let base64Data = url;
          let mimeType = "image/jpeg";

          if (url.startsWith("http://") || url.startsWith("https://")) {
            const res = await fetch(url);
            if (!res.ok) return null;
            const buffer = await res.arrayBuffer();
            base64Data = Buffer.from(buffer).toString('base64');
            const contentType = res.headers.get("content-type");
            if (contentType) mimeType = contentType;
          } else if (url.startsWith("data:")) {
            const matches = url.match(/^data:(image\/\w+);base64,(.+)$/);
            if (matches) {
              mimeType = matches[1];
              base64Data = matches[2];
            }
          }

          return { data: base64Data, mimeType };
        } catch (e) {
          return null;
        }
      })
    ).then(res => res.filter(b => b !== null));

    // 2. Build the payload manually (Sterile Template)
    const payload = {
      contents: [{
        parts: [
          ...base64Images.map(img => ({
            inline_data: { mime_type: img!.mimeType, data: img!.data }
          })),
          { text: "Group these eBay images by unique product. Return a JSON array of objects: {itemTitle: string, imageUrls: string[]}" }
        ]
      }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    };

    // 3. The REST Call
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
    
    const geminiResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await geminiResponse.json();

    if (!geminiResponse.ok) {
      // BOSS: If it fails, this is the error you need to copy/paste for me.
      console.error("🚨 GOOGLE REJECTION:", JSON.stringify(result));
      return NextResponse.json({ error: "Google API Refusal", details: result }, { status: 500 });
    }

    const textResponse = result.candidates[0].content.parts[0].text;
    return NextResponse.json(JSON.parse(textResponse.replace(/```json|```/g, "")));

  } catch (error: any) {
    console.error("🚨 CRITICAL ROUTE FAILURE:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
