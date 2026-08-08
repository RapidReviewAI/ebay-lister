import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { images } = await req.json();
    const API_KEY = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "").trim();

    if (!API_KEY) return NextResponse.json({ error: "API Key missing." }, { status: 500 });
    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: "No images provided." }, { status: 400 });
    }

    // 1. DIAGNOSTIC: Fetch what this specific key can actually see
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
    const listRes = await fetch(listUrl);
    const listData = await listRes.json();

    if (listData.error) {
      return NextResponse.json({ 
        error: "API Key Validation Failed", 
        details: listData.error.message,
        hint: "Is 'Generative Language API' enabled in Google Cloud Console?"
      }, { status: 401 });
    }

    const availableModels = listData.models?.map((m: any) => m.name.replace("models/", "")) || [];
    
    // 2. Determine the best available model from the list
    const priority = ["gemini-2.0-flash-exp", "gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-1.0-pro-vision-latest"];
    const selectedModel = priority.find(p => availableModels.includes(p)) || availableModels[0];

    if (!selectedModel) {
      return NextResponse.json({ 
        error: "No suitable models found for this API Key.", 
        available_models: availableModels 
      }, { status: 404 });
    }

    // 3. Prepare the payload
    const parts: any[] = [
      { text: "Cluster these images into distinct items for eBay. Return JSON: [{'id': number, 'title': 'string', 'photo_indices': [numbers]}]" }
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

    // 4. Execute with the discovered model
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${API_KEY}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
      })
    });

    const result = await response.json();

    if (result.error) {
      return NextResponse.json({ 
        error: `Model ${selectedModel} failed`, 
        details: result.error.message,
        available_models: availableModels 
      }, { status: 400 });
    }

    if (!result.candidates?.[0]?.content?.parts?.[0]?.text) {
      return NextResponse.json({ 
        error: `Model ${selectedModel} returned empty text`,
        available_models: availableModels
      }, { status: 500 });
    }

    const text = result.candidates[0].content.parts[0].text;
    const cleanJson = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleanJson);
    const clusters = Array.isArray(parsed) ? parsed : (parsed.clusters || parsed);
    
    return NextResponse.json({
      data: clusters,
      clusters: clusters,
      model_used: selectedModel,
      v: 11
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message, v: 11 }, { status: 500 });
  }
}
