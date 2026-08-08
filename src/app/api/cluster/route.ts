import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { images } = await req.json();
    const API_KEY = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "").trim();

    if (!API_KEY) return NextResponse.json({ error: "API Key missing." }, { status: 500 });
    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 });
    }

    // DIAGNOSTIC: Let's see what models this key can actually see
    // This will show up in your Vercel Logs
    try {
      const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
      const listRes = await fetch(listUrl);
      const listData = await listRes.json();
      console.log("AVAILABLE MODELS:", JSON.stringify(listData));
    } catch (e) {
      console.error("Failed to list models:", e);
    }

    const parts: any[] = [];
    parts.push({ text: "Cluster these images into items. Return JSON: [{id, title, photo_indices}]" });

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

    // TRYING GEMINI 2.0 FLASH EXPERIMENTAL ON V1BETA
    const modelName = "gemini-2.0-flash-exp";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`;
    
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
      return NextResponse.json({ 
        error: result.error.message, 
        suggestion: "Check Vercel logs for 'AVAILABLE MODELS' list.",
        v: 8 
      }, { status: 400 });
    }

    if (!result.candidates?.[0]?.content?.parts?.[0]?.text) {
      return NextResponse.json({ error: "Empty AI response", v: 8 }, { status: 500 });
    }

    const text = result.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(text);
    return NextResponse.json(parsed);

  } catch (error: any) {
    return NextResponse.json({ error: error.message, v: 8 }, { status: 500 });
  }
}
