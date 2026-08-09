import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { images } = await req.json();
    const API_KEY = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "").trim();

    if (!API_KEY) return NextResponse.json({ error: "API Key missing." }, { status: 500 });
    if (!images || !Array.isArray(images) || images.length === 0) return NextResponse.json({ error: "No images." }, { status: 400 });

    const MODEL_ALIAS = "gemini-flash-latest";

    const parts: any[] = [
      { text: `Analyze this collection of images for an eBay seller. 
Your goal is to group images that belong to the same listing.
1. STRENGTH OF ASSOCIATION: If multiple images show the same items, or if one image is a close-up of a tag/detail of an item shown in another image, they MUST be in the same group.
2. LOT DETECTION: If an image shows multiple items together (e.g., two shirts), and other images show those same items individually, group them ALL together as one 'Lot' listing.
3. OUTPUT: Return a JSON array of groups, where each group is an array of image IDs or indices.

Example:
[
  { "group_id": 1, "photo_indices": [0, 1, 2, 3, 4], "reason": "Lot of 2 shirts with associated tags and individual shots" }
]
DO NOT create separate listings for individual items if they appear together in a 'hero' shot.` }
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
        details: result.error.message
      }, { status: 400 });
    }

    if (!result.candidates?.[0]?.content?.parts?.[0]?.text) {
      return NextResponse.json({ error: "Empty response from AI", full_res: result, v: 25 }, { status: 500 });
    }

    const text = result.candidates[0].content.parts[0].text;
    const cleanJson = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleanJson);
    
    // Support both photo_indices and indices in output items
    const rawClusters = Array.isArray(parsed) ? parsed : (parsed.clusters || parsed.groups || parsed.data || []);
    const clusters = rawClusters.map((c: any) => ({
      photo_indices: c.photo_indices || c.indices || [],
      reason: c.reason || ""
    }));

    return NextResponse.json({
      data: clusters,
      clusters: clusters,
      model_used: MODEL_ALIAS,
      v: 25
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message, v: 25 }, { status: 500 });
  }
}
