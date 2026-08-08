import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(
  process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || ""
);

export async function POST(req: NextRequest) {
  try {
    const { images } = await req.json();

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: "No images provided." }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // 1. Process images and FORCE CLEAN the objects
    const imageParts = await Promise.all(
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

          // We create a clean, literal object and stringify/parse it 
          // to ensure NO hidden properties like 'source' exist.
          const part = {
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          };
          
          return JSON.parse(JSON.stringify(part));
        } catch (e) {
          return null;
        }
      })
    ).then(res => res.filter(p => p !== null));

    if (imageParts.length === 0) {
      return NextResponse.json({ error: "Image processing failed." }, { status: 422 });
    }

    // 2. Clean the Prompt Part
    const promptPart = JSON.parse(JSON.stringify({
      text: `Task: Group these images by unique product.
             Output: A JSON array of objects.
             Schema: {"itemTitle": string, "imageUrls": string[]}
             Context: Resell Radar eBay listing logic.`
    }));

    // 3. Execute with forced POJO array
    const result = await model.generateContent({
      contents: [{ 
        role: 'user', 
        parts: [...imageParts, promptPart] 
      }],
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const response = await result.response;
    const text = response.text();
    
    // Final check for Markdown JSON blocks
    const cleanJson = JSON.parse(text.replace(/```json|```/g, ""));

    return NextResponse.json(cleanJson);

  } catch (error: any) {
    console.error("🚨 GEMINI CRITICAL FAILURE:", error);
    return NextResponse.json({ 
      error: "SDK Serialization Error", 
      details: error.message 
    }, { status: 500 });
  }
}
