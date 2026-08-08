import { NextRequest, NextResponse } from 'next/server';
import { fetch as undiciFetch } from 'undici'; // This is a "clean" fetch that hijackers usually miss.

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const API_KEY = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

    let { images } = body;

    if (!images || !Array.isArray(images) || !API_KEY) {
      return NextResponse.json({ error: "Configuration Error" }, { status: 400 });
    }

    const cleanUrls = images.map(img => {
      if (typeof img === 'string') return img;
      if (typeof img === 'object' && img && img.url) return img.url;
      return null;
    }).filter(u => u !== null) as string[];

    // 1. Process images to Base64
    const parts = await Promise.all(
      cleanUrls.map(async (url: string) => {
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

          return {
            inline_data: {
              mime_type: mimeType,
              data: base64Data
            }
          };
        } catch (e) {
          return null;
        }
      })
    ).then(res => res.filter(p => p !== null));

    // 2. Add the Text Part
    parts.push({
      text: "Group these images by product. Return a JSON array: [{itemTitle: string, imageUrls: string[]}]"
    } as any);

    // 3. Assemble the payload as a STIFF object
    const payload = {
      contents: [{ parts }],
      generationConfig: { responseMimeType: "application/json" }
    };

    // 4. THE CLEAN FETCH (undici)
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
    
    // We use undiciFetch here because it doesn't use the global.fetch that might be hijacked
    const geminiResponse = await undiciFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result: any = await geminiResponse.json();

    if (!geminiResponse.ok) {
      // 🚨 CEO: IF THIS FAILS, THE SOURCE IS IN THE PAYLOAD. 🚨
      console.error("🚨 V9 PAYLOAD SENT:", JSON.stringify(payload).substring(0, 500)); // Log the first 500 chars
      console.error("🚨 GOOGLE REJECTION V9:", JSON.stringify(result));
      return NextResponse.json(result, { status: 500 });
    }

    const textResponse = result.candidates[0].content.parts[0].text;
    return NextResponse.json(JSON.parse(textResponse.replace(/```json|```/g, "")));

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
