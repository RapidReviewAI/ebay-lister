import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { images } = await req.json();
    const API_KEY = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "").trim();

    if (!API_KEY) {
      return NextResponse.json({ error: "API Key missing from environment variables." }, { status: 500 });
    }

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: "No images provided for clustering." }, { status: 400 });
    }

    const parts: any[] = [
      { text: "System: You are an eBay listing expert. Cluster these images into distinct items. If multiple photos belong to the same item, group them. Return a valid JSON array of objects: [{'id': number, 'title': 'string', 'photo_indices': [numbers]}]. Use only the provided indices." }
    ];

    for (const [index, img] of images.entries()) {
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

    // Attempting Gemini 2.0 Flash Experimental, fallback to 1.5 Flash
    const modelsToTry = ["gemini-2.0-flash-exp", "gemini-1.5-flash"];
    let lastError = "";

    for (const model of modelsToTry) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
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
          console.error(`Model ${model} failed:`, result.error.message);
          lastError = result.error.message;
          continue; 
        }

        if (!result.candidates?.[0]?.content?.parts?.[0]?.text) {
          lastError = `Model ${model} returned empty response`;
          continue;
        }

        const text = result.candidates[0].content.parts[0].text;
        // Clean potential markdown if the model ignored responseMimeType
        const cleanJson = text.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(cleanJson);
        const clusters = Array.isArray(parsed) ? parsed : (parsed.clusters || parsed);

        return NextResponse.json({ 
          clusters: clusters,
          data: clusters,
          model_used: model,
          v: 9 
        });

      } catch (err: any) {
        lastError = err.message;
        continue;
      }
    }

    return NextResponse.json({ error: "All models failed.", details: lastError }, { status: 500 });

  } catch (error: any) {
    console.error("CRITICAL ROUTE ERROR:", error.message);
    return NextResponse.json({ error: error.message, v: 9 }, { status: 500 });
  }
}
