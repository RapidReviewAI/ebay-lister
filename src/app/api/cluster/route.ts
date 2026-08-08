import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { images } = await req.json();
    const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 });
    }

    if (!API_KEY) {
      return NextResponse.json({ error: "API Key missing." }, { status: 500 });
    }

    const parts: any[] = [];
    parts.push({ text: "Cluster these images into distinct items. Return JSON: [{id, title, photo_indices}]" });

    for (const img of images) {
      let b64 = img;
      let mime = "image/jpeg";

      if (img.startsWith("http://") || img.startsWith("https://")) {
        const res = await fetch(img);
        if (!res.ok) continue;
        const buffer = await res.arrayBuffer();
        b64 = Buffer.from(buffer).toString("base64");
        mime = res.headers.get("content-type") || "image/jpeg";
      } else if (img.includes(";base64,")) {
        const split = img.split(";base64,");
        b64 = split[1] || img;
        mime = split[0].split(":")[1] || "image/jpeg";
      }

      parts.push({
        inline_data: {
          mime_type: mime,
          data: b64
        }
      });
    }

    // SWITCHING TO V1 (STABLE) ENDPOINT
    const modelName = "gemini-1.5-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${API_KEY}`;
    
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { 
          responseMimeType: "application/json"
        }
      })
    });

    const result = await response.json();

    if (result.error) {
      console.error("STABLE API ERROR:", result.error);
      // If V1 fails, we return the full error so we can see exactly what Google is complaining about
      return NextResponse.json({ 
        error: result.error.message, 
        status: result.error.status,
        frank_v: 7 
      }, { status: 400 });
    }

    if (!result.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error("AI returned an empty response.");
    }

    const text = result.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(text);

    return NextResponse.json(parsed);

  } catch (error: any) {
    return NextResponse.json({ error: error.message, frank_v: 7 }, { status: 500 });
  }
}
