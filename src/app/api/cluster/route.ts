import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, Part } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(
  process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || ""
);

export async function POST(req: NextRequest) {
  try {
    const { images } = await req.json();

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: "No images? No cluster. Try again." }, { status: 400 });
    }

    // Explicitly use 1.5-flash for speed/reliability
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // 1. Convert URLs to strict InlineData Parts
    const imageParts: Part[] = await Promise.all(
      images.map(async (url: string) => {
        try {
          let base64Data = url;
          let mimeType = "image/jpeg";

          if (url.startsWith("http://") || url.startsWith("https://")) {
            const response = await fetch(url);
            if (!response.ok) return null;
            const arrayBuffer = await response.arrayBuffer();
            base64Data = Buffer.from(arrayBuffer).toString('base64');
            const contentType = response.headers.get("content-type");
            if (contentType) mimeType = contentType;
          } else if (url.startsWith("data:")) {
            const matches = url.match(/^data:(image\/\w+);base64,(.+)$/);
            if (matches) {
              mimeType = matches[1];
              base64Data = matches[2];
            }
          }

          // STRICT PART STRUCTURE: No extra keys, no 'source', just inlineData.
          return {
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          } satisfies Part;
        } catch (e) {
          console.error(`Fetch failed for ${url}`, e);
          return null;
        }
      })
    ).then(res => res.filter((p): p is Part => p !== null));

    if (imageParts.length === 0) {
      return NextResponse.json({ error: "Could not process images." }, { status: 422 });
    }

    // 2. Define the Text Prompt Part
    const promptPart: Part = {
      text: "Group these images by unique product. Return ONLY a JSON array. Each object: {\"itemTitle\": \"brand model color\", \"imageUrls\": [\"url1\", \"url2\"]}"
    };

    // 3. Use the formal 'generateContent' structure to avoid SDK serialization bugs
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [promptPart, ...imageParts] }],
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const response = await result.response;
    const text = response.text();
    
    // Safety check: LLMs sometimes wrap JSON in markdown blocks
    const cleanJson = JSON.parse(text.replace(/```json|```/g, ""));

    return NextResponse.json(cleanJson);

  } catch (error: any) {
    console.error("🚨 FATAL CLUSTER ERROR:", error);
    return NextResponse.json({ 
      error: "Gemini SDK Refusal", 
      details: error.message 
    }, { status: 500 });
  }
}
