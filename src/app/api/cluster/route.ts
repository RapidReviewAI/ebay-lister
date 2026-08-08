import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { images } = await req.json();
    const API_KEY = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "").trim();

    if (!API_KEY) return NextResponse.json({ error: "API Key missing." }, { status: 500 });
    if (!images || !Array.isArray(images) || images.length === 0) return NextResponse.json({ error: "No images provided." }, { status: 400 });

    // 1. Get available models
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
    const listRes = await fetch(listUrl);
    const listData = await listRes.json();

    if (listData.error) {
      return NextResponse.json({ error: "API Validation Error", details: listData.error.message }, { status: 401 });
    }

    const availableModels = listData.models?.map((m: any) => m.name.replace("models/", "")) || [];
    
    // 2. Filter for actual stable-ish models we want
    // We want 2.0 Flash first, then 1.5 Flash.
    const priority = ["gemini-2.0-flash", "gemini-2.0-flash-001", "gemini-1.5-flash", "gemini-flash-latest"];
    const selectedModel = priority.find(p => availableModels.includes(p));

    if (!selectedModel) {
      return NextResponse.json({ 
        error: "No supported production models found in your list.", 
        found: availableModels.slice(0, 5) 
      }, { status: 404 });
    }

    // 3. Prepare Multi-modal payload
    const parts: any[] = [
      { text: "Task: Cluster these images into groups where each group is one distinct eBay item. Return JSON: [{'id': number, 'title': 'Short eBay Title', 'photo_indices': [number]}]" }
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

    // 4. Hit the endpoint
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${API_KEY}`;
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
        error: `Execution failed on ${selectedModel}`, 
        details: result.error.message 
      }, { status: 400 });
    }

    if (!result.candidates?.[0]?.content?.parts?.[0]?.text) {
      return NextResponse.json({ 
        error: `Execution failed on ${selectedModel}: empty text response`,
        v: 12
      }, { status: 500 });
    }

    const text = result.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    const clusters = Array.isArray(parsed) ? parsed : (parsed.clusters || parsed);

    return NextResponse.json({
      data: clusters,
      clusters: clusters,
      model_used: selectedModel,
      v: 12
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message, v: 12 }, { status: 500 });
  }
}
