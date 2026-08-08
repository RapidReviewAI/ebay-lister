import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(
  process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || ""
);

const schema = {
  description: "List of image clusters grouped by unique product",
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      itemTitle: {
        type: SchemaType.STRING,
        description: "A descriptive 5-8 word title for the item cluster",
        nullable: false,
      },
      imageUrls: {
        type: SchemaType.ARRAY,
        items: { type: SchemaType.STRING },
        description: "The URLs of the images that belong to this specific item",
      },
    },
    required: ["itemTitle", "imageUrls"],
  },
};

export async function POST(req: NextRequest) {
  try {
    const { images } = await req.json();

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: "No images provided. Try again." }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema as any,
      },
    });

    const prompt = `
      You are an expert eBay inventory manager. 
      Analyze the provided images and group them by unique product. 
      Example: If there are 3 photos of a Nike shoe and 2 photos of a Sony camera, create two clusters.
      Return the result as a JSON array.
    `;

    // Convert URLs or base64 data to Gemini 'inlineData' format
    const imageParts = await Promise.all(
      images.map(async (url: string) => {
        let base64Data = url;
        let mimeType = "image/jpeg";

        if (url.startsWith("http://") || url.startsWith("https://")) {
          const response = await fetch(url);
          const buffer = await response.arrayBuffer();
          base64Data = Buffer.from(buffer).toString("base64");
          const contentType = response.headers.get("content-type");
          if (contentType) mimeType = contentType;
        } else if (url.startsWith("data:")) {
          const matches = url.match(/^data:(image\/\w+);base64,(.+)$/);
          if (matches) {
            mimeType = matches[1];
            base64Data = matches[2];
          }
        }

        return {
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        };
      })
    );

    const result = await model.generateContent([prompt, ...imageParts]);
    const responseText = result.response.text();
    
    return NextResponse.json(JSON.parse(responseText));

  } catch (error: any) {
    console.error("🚨 CLUSTER CRASH:", error);
    return NextResponse.json({ 
      error: "Failed to cluster images", 
      details: error.message 
    }, { status: 500 });
  }
}
