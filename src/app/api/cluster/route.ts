import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "");

export async function POST(req: NextRequest) {
  try {
    const { images } = await req.json();
    if (!images || !Array.isArray(images)) {
      return NextResponse.json({ error: "No images" }, { status: 400 });
    }

    // Use 1.5-flash - it is the most stable for vision clustering
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Build parts with EXTREME precision
    const imageParts = await Promise.all(images.map(async (imgStr: string) => {
      let b64Data = "";
      let mimeType = "image/jpeg";

      if (imgStr.startsWith("http")) {
        const res = await fetch(imgStr);
        const buffer = await res.arrayBuffer();
        b64Data = Buffer.from(buffer).toString("base64");
        mimeType = res.headers.get("content-type") || "image/jpeg";
      } else {
        // Handle data:image/jpeg;base64,...
        const split = imgStr.split(";base64,");
        b64Data = split[1] || imgStr;
        mimeType = split[0].split(":")[1] || "image/jpeg";
      }

      return {
        inlineData: {
          data: b64Data,
          mimeType: mimeType
        }
      };
    }));

    const promptPart = {
      text: "Cluster these images into distinct items. Return ONLY a JSON array: [{\"id\": \"1\", \"title\": \"Item Name\", \"photo_indices\": [0, 1]}]"
    };

    // THE FIX: Explicitly define the content array with a single user role
    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [promptPart, ...imageParts]
      }],
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const text = result.response.text();
    return NextResponse.json(JSON.parse(text));

  } catch (error: any) {
    console.error("CRITICAL CLUSTER ERROR:", error);
    return NextResponse.json({ 
      error: error.message,
      frank_hint: "Check if the version tag FRANK_V2 is visible on the frontend."
    }, { status: 500 });
  }
}
