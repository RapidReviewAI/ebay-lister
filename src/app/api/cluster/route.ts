import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  console.log("--- FRANK DEBUG: CLUSTER ROUTE START (V5) ---");
  try {
    const { images } = await req.json();
    const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: "No images" }, { status: 400 });
    }

    if (!API_KEY) {
      return NextResponse.json({ error: "API Key missing." }, { status: 500 });
    }

    // 1. Build parts array with absolute REST syntax (snake_case)
    const parts: any[] = [];
    
    // Text prompt MUST be an object with a 'text' key
    parts.push({ text: "Cluster these images into items. Return JSON: [{id, title, photo_indices}]" });

    for (const img of images) {
      let b64 = img;
      let mime = "image/jpeg";

      if (img.startsWith("http://") || img.startsWith("https://")) {
        const res = await fetch(img);
        const buffer = await res.arrayBuffer();
        b64 = Buffer.from(buffer).toString("base64");
        mime = res.headers.get("content-type") || "image/jpeg";
      } else if (img.includes(";base64,")) {
        const split = img.split(";base64,");
        b64 = split[1] || img;
        mime = split[0].split(":")[1] || "image/jpeg";
      }

      // REST API uses 'inline_data' (snake_case)
      parts.push({
        inline_data: {
          mime_type: mime,
          data: b64
        }
      });
    }

    console.log(`--- FRANK DEBUG: Sending ${parts.length} parts to Gemini ---`);

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
    
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const result = await response.json();

    if (result.error) {
      console.error("GEMINI API REJECTED PAYLOAD:", result.error);
      return NextResponse.json({ error: result.error.message, frank_v: 5 }, { status: 400 });
    }

    const text = result.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(text);
    return NextResponse.json(parsed);

  } catch (error: any) {
    console.error("FRANK V5 CRASH:", error.message);
    return NextResponse.json({ error: error.message, frank_v: 5 }, { status: 500 });
  }
}
