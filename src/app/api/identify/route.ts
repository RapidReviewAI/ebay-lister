import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(
  process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || ""
);

export async function POST(req: NextRequest) {
  try {
    const { images } = await req.json();

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // 1. Properly format the image parts
    const imageParts = await Promise.all(
      images.map(async (imgStr: string) => {
        let b64Data = imgStr;
        let mimeType = "image/jpeg";

        if (imgStr.startsWith("http")) {
          const response = await fetch(imgStr);
          const buffer = await response.arrayBuffer();
          b64Data = Buffer.from(buffer).toString("base64");
          mimeType = response.headers.get("content-type") || "image/jpeg";
        } else if (imgStr.includes(";base64,")) {
          b64Data = imgStr.split(";base64,")[1];
          mimeType = imgStr.split(";base64,")[0].split(":")[1];
        }

        return {
          inlineData: {
            data: b64Data,
            mimeType
          }
        };
      })
    );

    // 2. Define the Prompt based on the route
    const prompt = "Identify this item for an eBay listing. Return JSON with title (max 80 chars), brand, categoryId, condition, description, and item_specifics array.";

    // 3. The CORRECT SDK Call Structure
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            ...imageParts
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const responseText = result.response.text();
    return NextResponse.json(JSON.parse(responseText));

  } catch (error: any) {
    console.error("Gemini Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
