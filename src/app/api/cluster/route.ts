import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(
  process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || ""
);

export async function POST(req: NextRequest) {
  try {
    const { images } = await req.json();

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: "No images" }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const imageParts = await Promise.all(images.map(async (img: string) => {
      let base64Data = img;
      let mimeType = "image/jpeg";

      if (img.startsWith("http://") || img.startsWith("https://")) {
        const res = await fetch(img);
        const buffer = await res.arrayBuffer();
        base64Data = Buffer.from(buffer).toString("base64");
        mimeType = res.headers.get("content-type") || "image/jpeg";
      } else if (img.includes(";base64,")) {
        const split = img.split(";base64,");
        base64Data = split[1] || img;
        mimeType = split[0].split(":")[1] || "image/jpeg";
      }

      return {
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      };
    }));

    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [
          { text: "Cluster these images into items. Return JSON array: [{id, title, photo_indices}]" },
          ...imageParts
        ]
      }],
      generationConfig: { responseMimeType: "application/json" }
    });

    const text = result.response.text();
    return NextResponse.json(JSON.parse(text));

  } catch (e: any) {
    console.error("V3 CLUSTER ERROR:", e);
    return NextResponse.json({ error: e.message, version: "V3" }, { status: 500 });
  }
}
