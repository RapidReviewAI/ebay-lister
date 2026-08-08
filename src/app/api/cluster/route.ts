import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { images } = await req.json();
    const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

    if (!images || !Array.isArray(images)) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 });
    }

    // 1. Prepare the parts array for the REST API
    const parts: any[] = [];

    // Add the text prompt first
    parts.push({
      text: "Cluster these images into distinct items. Return a JSON object with a key 'clusters' containing an array of objects, each with 'id', 'title', and 'photo_indices' (the 0-based indexes of the images belonging to that item)."
    });

    // Add the images
    for (const imgStr of images) {
      let b64Data = "";
      let mimeType = "image/jpeg";

      if (imgStr.startsWith("http")) {
        const res = await fetch(imgStr);
        const buffer = await res.arrayBuffer();
        b64Data = Buffer.from(buffer).toString("base64");
        mimeType = res.headers.get("content-type") || "image/jpeg";
      } else {
        b64Data = imgStr.split(",")[1] || imgStr;
        if (imgStr.includes(";base64,")) {
          const header = imgStr.split(";base64,")[0];
          if (header.includes(":")) {
            mimeType = header.split(":")[1] || "image/jpeg";
          }
        }
      }

      parts.push({
        inline_data: {
          mime_type: mimeType,
          data: b64Data
        }
      });
    }

    // 2. Call the Gemini REST API directly (Bypassing SDK weirdness)
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
    
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
      throw new Error(result.error.message);
    }

    const textResponse = result.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(textResponse);

    if (Array.isArray(parsed)) {
      return NextResponse.json({ clusters: parsed });
    }

    return NextResponse.json(parsed);

  } catch (error: any) {
    console.error("Cluster Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
