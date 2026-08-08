import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { images } = await req.json();
    const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

    if (!images || !Array.isArray(images)) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 });
    }

    if (!API_KEY) {
      return NextResponse.json({ error: "API key missing" }, { status: 500 });
    }

    // 1. Build the PARTS array (Text + all Images)
    const parts: any[] = [
      { text: "Cluster these images into distinct items. Return a JSON object with key 'clusters' containing an array of objects: { \"clusters\": [{ \"id\": \"1\", \"title\": \"Item Name\", \"photo_indices\": [0, 1] }] }" }
    ];

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
        mimeType = imgStr.includes("image/png") ? "image/png" : "image/jpeg";
      }

      parts.push({
        inline_data: {
          mime_type: mimeType,
          data: b64Data
        }
      });
    }

    // 2. The Payload: ONE content object, ONE role, MANY parts.
    const payload = {
      contents: [
        {
          role: "user",
          parts: parts
        }
      ],
      generationConfig: {
        responseMimeType: "application/json"
      }
    };

    // 3. Use Gemini 2.0 Flash (with fallback to 1.5-flash)
    let endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${API_KEY}`;
    
    let response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    let result = await response.json();

    if (result.error && (result.error.code === 404 || result.error.status === "NOT_FOUND")) {
      console.warn("gemini-2.0-flash-exp endpoint not found, falling back to gemini-1.5-flash");
      endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      result = await response.json();
    }

    if (result.error) {
      console.error("Gemini API Error:", result.error);
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    if (!result.candidates?.[0]?.content?.parts?.[0]?.text) {
      return NextResponse.json({ error: "Empty response from AI" }, { status: 500 });
    }

    const textResponse = result.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(textResponse);

    if (Array.isArray(parsed)) {
      return NextResponse.json({ clusters: parsed });
    }

    return NextResponse.json(parsed);

  } catch (error: any) {
    console.error("Cluster Route Crash:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
