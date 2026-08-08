import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { images } = await req.json();
    const API_KEY = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "").trim();

    if (!API_KEY) return NextResponse.json({ error: "API Key missing." }, { status: 500 });
    if (!images || !Array.isArray(images) || images.length === 0) return NextResponse.json({ error: "No images provided." }, { status: 400 });

    // Based on your specific model list, 
    // 'gemini-flash-latest' is the safest bet that won't be 'deprecated'.
    const MODEL_ALIAS = "gemini-flash-latest"; 
    
    const parts: any[] = [
      { text: "Cluster these images into distinct items for eBay. Return JSON: [{'id': number, 'title': 'string', 'photo_indices': [number]}]" }
    ];

    // Image processing
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

    // Using v1beta with the generic alias
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ALIAS}:generateContent?key=${API_KEY}`;
    
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { 
          responseMimeType: "application/json",
          temperature: 0.1 
        }
      })
    });

    const result = await response.json();

    if (result.error) {
      return NextResponse.json({ 
        error: `Model ${MODEL_ALIAS} failed`, 
        details: result.error.message,
        suggestion: "If this fails, Google is forcing the Interactions API, which is a total SDK rewrite."
      }, { status: 400 });
    }

    if (!result.candidates?.[0]?.content?.parts?.[0]?.text) {
      return NextResponse.json({ error: "Empty response from AI", full_res: result, v: 13 }, { status: 500 });
    }

    const text = result.candidates[0].content.parts[0].text;
    const cleanJson = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleanJson);
    const clusters = Array.isArray(parsed) ? parsed : (parsed.clusters || parsed);

    return NextResponse.json({
      data: clusters,
      clusters: clusters,
      model_used: MODEL_ALIAS,
      v: 13
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message, v: 13 }, { status: 500 });
  }
}
