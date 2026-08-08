import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(
  process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || ""
);

const schema = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      itemTitle: {
        type: SchemaType.STRING,
        description: "A descriptive 5-8 word title for the item cluster",
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
    const body = await req.json();
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "API Key missing." }, { status: 500 });
    }

    let { images } = body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: "No images provided." }, { status: 400 });
    }

    const cleanUrls = images.map((img: any) => {
      if (typeof img === 'string') return img;
      if (typeof img === 'object' && img && img.url) return img.url;
      return null;
    }).filter((u: any) => u !== null) as string[];

    const imageParts = await Promise.all(
      cleanUrls.map(async (url: string) => {
        try {
          let base64Data = url;
          let mimeType = "image/jpeg";

          if (url.startsWith("http://") || url.startsWith("https://")) {
            const res = await fetch(url);
            if (!res.ok) return null;
            const buffer = await res.arrayBuffer();
            base64Data = Buffer.from(buffer).toString('base64');
            const contentType = res.headers.get("content-type");
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
              mimeType: mimeType
            }
          };
        } catch (e) {
          return null;
        }
      })
    ).then(res => res.filter(p => p !== null));

    const promptPart = {
      text: "Task: Group these images by unique product. Return a JSON array of objects with keys itemTitle and imageUrls."
    };

    const parts = [...imageParts, promptPart];

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: parts as any }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema as any,
      },
    });

    const responseText = result.response.text();
    const cleanJson = JSON.parse(responseText.replace(/```json|```/g, ""));

    return NextResponse.json(cleanJson);

  } catch (error: any) {
    console.error("🚨 CLUSTER ROUTE FAILURE:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
