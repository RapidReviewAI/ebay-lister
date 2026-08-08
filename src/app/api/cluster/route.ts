import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { images } = await req.json();
    const API_KEY = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: "No images provided." }, { status: 400 });
    }

    if (!API_KEY) {
      return NextResponse.json({ error: "API Key missing." }, { status: 500 });
    }

    // 1. Prepare the raw parts for the REST API
    const parts = await Promise.all(
      images.map(async (url: string) => {
        try {
          let base64Data = url;
          let mimeType = "image/jpeg";

          if (url.startsWith("http://") || url.startsWith("https://")) {
            const response = await fetch(url);
            if (!response.ok) return null;
            const buffer = await response.arrayBuffer();
            base64Data = Buffer.from(buffer).toString('base64');
            const contentType = response.headers.get("content-type");
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

    // 2. Add the instruction text part
    parts.push({
      text: "Task: Group these images by unique product. Output ONLY a valid JSON array of objects. Schema: [{\"itemTitle\": \"string\", \"imageUrls\": [\"string\"]}]"
    } as any);

    // 3. Hit the REST endpoint directly
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
    
    const geminiResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: "application/json",
        }
      })
    });

    const result = await geminiResponse.json();

    if (!geminiResponse.ok) {
      console.error("🚨 GOOGLE REST ERROR:", JSON.stringify(result, null, 2));
      throw new Error(result.error?.message || "Google API Refusal");
    }

    // 4. Extract and parse the text from the REST response structure
    const textResponse = result.candidates[0].content.parts[0].text;
    const cleanJson = JSON.parse(textResponse.replace(/```json|```/g, ""));

    return NextResponse.json(cleanJson);

  } catch (error: any) {
    console.error("🚨 CLUSTER SYSTEM FAILURE:", error);
    return NextResponse.json({ 
      error: "Bypass Route Failed", 
      details: error.message 
    }, { status: 500 });
  }
}
