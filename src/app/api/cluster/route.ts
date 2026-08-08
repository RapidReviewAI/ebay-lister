import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { images } = await req.json();
    const API_KEY = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "").trim();

    if (!API_KEY) return NextResponse.json({ error: "API Key missing." }, { status: 500 });
    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: "No images provided." }, { status: 400 });
    }

    const parts: any[] = [
      { text: "Cluster these images into distinct items for eBay. Group photos of the same item. Return JSON: [{'id': number, 'title': 'string', 'photo_indices': [numbers]}]" }
    ];

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

    // Configuration for different attempts
    const attempts = [
      { model: "gemini-2.0-flash-exp", version: "v1beta" },
      { model: "gemini-1.5-flash", version: "v1" },
      { model: "gemini-1.5-flash-latest", version: "v1beta" }
    ];

    let lastError = "";

    for (const attempt of attempts) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/${attempt.version}/models/${attempt.model}:generateContent?key=${API_KEY}`;
        
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
          lastError = `[${attempt.model}]: ${result.error.message}`;
          continue;
        }

        if (result.candidates && result.candidates[0]?.content?.parts[0]?.text) {
          const text = result.candidates[0].content.parts[0].text;
          const cleanJson = text.replace(/```json|```/g, "").trim();
          const parsed = JSON.parse(cleanJson);
          const clusters = Array.isArray(parsed) ? parsed : (parsed.clusters || parsed);

          return NextResponse.json({
            data: clusters,
            clusters: clusters,
            model_used: attempt.model,
            v: 10
          });
        }
      } catch (err: any) {
        lastError = err.message;
        continue;
      }
    }

    return NextResponse.json({ 
      error: "All models failed.", 
      last_error_details: lastError,
      suggestion: "Check if your API Key has 'Generative Language API' enabled in Google Cloud Console." 
    }, { status: 500 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message, v: 10 }, { status: 500 });
  }
}
