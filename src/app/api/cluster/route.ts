import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(
  process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || ""
);

export async function POST(req: NextRequest) {
  try {
    const { images } = await req.json();
    if (!images || !Array.isArray(images)) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // 1. Convert images to the correct Part format
    const imageParts = await Promise.all(images.map(async (imgStr: string) => {
      let b64Data = "";
      let mimeType = "image/jpeg";

      if (imgStr.startsWith("http")) {
        const response = await fetch(imgStr);
        const buffer = await response.arrayBuffer();
        b64Data = Buffer.from(buffer).toString("base64");
        mimeType = response.headers.get("content-type") || "image/jpeg";
      } else {
        b64Data = imgStr.split(",")[1] || imgStr;
      }

      return {
        inlineData: {
          data: b64Data,
          mimeType
        }
      };
    }));

    // 2. The Prompt
    const promptPart = { 
      text: "Cluster these images into distinct items. Return a JSON object with key 'clusters' containing an array of objects, each with 'id', 'title', and 'photo_indices' (the 0-based indexes of the images belonging to that item)." 
    };

    // 3. THE FIX: Wrap everything in the correct 'contents' structure
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [promptPart, ...imageParts]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const responseText = result.response.text();
    const parsed = JSON.parse(responseText);

    if (Array.isArray(parsed)) {
      return NextResponse.json({ clusters: parsed });
    }

    return NextResponse.json(parsed);

  } catch (error: any) {
    console.error("Cluster Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
