import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type, Schema } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const maxDuration = 300;

const schema: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      title: { type: Type.STRING },
      description: { type: Type.STRING },
      price: { type: Type.STRING },
      category: { type: Type.STRING },
      categoryId: { type: Type.STRING },
      condition: { type: Type.STRING },
      brand: { type: Type.STRING },
      size: { type: Type.STRING },
      color: { type: Type.STRING },
      department: { type: Type.STRING },
      photo_indices: { 
        type: Type.ARRAY,
        items: { type: Type.NUMBER }
      },
      item_specifics: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            value: { type: Type.STRING }
          }
        }
      }
    },
    required: ["id", "title", "description", "price", "category", "categoryId", "condition", "photo_indices"]
  }
};

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.trim() === "") {
      return NextResponse.json({ error: "GEMINI_API_KEY is missing in .env.local" }, { status: 401 });
    }

    const body = await req.json();
    const { images } = body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 });
    }

    if (images.length > 30) {
      return NextResponse.json({ error: "Batch size limit is 30 images per request." }, { status: 400 });
    }

    const systemInstruction = `
You are an expert reseller operations AI. You will receive an array of uploaded photos representing a batch folder dump of items.
Your job is to visually cluster these photos into distinct individual listings based on continuity (e.g., front, back, tag of Item A, then front, back of Item B).
For each distinct item you identify, output a structured listing object.

CRITICAL GUIDELINES:
1. photo_indices: Provide an array of the exact index numbers (0-indexed) of the uploaded images that belong to this specific item. EVERY provided photo MUST be assigned to exactly one item.
2. Title (Max 80 chars): Use exact keyword order: [Brand] + [Gender/Age Group] + [Product/Model Name] + [Style/Type] + [Size] + [Color] + [Key Material/Feature] + [Condition]. Do NOT use filler words.
3. Category Enforcement: Always output the exact numeric eBay Leaf Category ID in 'categoryId' (e.g., 260010 for Trading Cards, 15687 for Men's T-Shirts).
4. Prohibited Keywords: NEVER generate text containing: 'cbd', 'hemp', 'replica', 'fake', 'weapon', 'ammo', etc.
5. Provide a unique string 'id' for each item.
6. Provide an estimated 'price' in USD (e.g., "19.99").
7. Extract and provide 'brand', 'size', 'color', and 'department' for each item. If unknown, use "Unbranded" or "N/A".
`;

    const parts = await Promise.all(images.map(async (imgStr: string, idx: number) => {
      let data = imgStr;
      let mimeType = 'image/jpeg';
      
      if (imgStr.startsWith("http://") || imgStr.startsWith("https://")) {
        const response = await fetch(imgStr);
        const arrayBuffer = await response.arrayBuffer();
        data = Buffer.from(arrayBuffer).toString('base64');
        mimeType = response.headers.get("content-type") || "image/jpeg";
      } else if (imgStr.includes(',')) {
        const splitStr = imgStr.split(',');
        data = splitStr[1];
        mimeType = splitStr[0].split(':')[1].split(';')[0];
      }
      
      return {
        inlineData: {
          data,
          mimeType
        }
      };
    }));

    parts.unshift({
      text: "Below are the images in order from index 0 to " + (images.length - 1) + ". Please cluster them into distinct items."
    } as any);

    let responseText = null;
    const MODELS = ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-3.1-pro"];
    
    for (const model of MODELS) {
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        try {
          const response = await ai.models.generateContent({
            model: model,
            contents: parts as any,
            config: {
              systemInstruction,
              responseMimeType: "application/json",
              responseSchema: schema,
            }
          });
          
          if (response.text) {
            responseText = response.text;
            break;
          }
        } catch (err: any) {
          attempts++;
          console.error(`Error with ${model} on attempt ${attempts}:`, err.message);
          if (attempts >= maxAttempts) break;
          
          const waitMs = Math.pow(2, attempts - 1) * 1000;
          await new Promise(r => setTimeout(r, waitMs));
        }
      }
      
      if (responseText) break;
    }

    if (!responseText) {
      return NextResponse.json({ error: "The vision service is currently experiencing high demand. Please wait a few seconds and try again." }, { status: 503 });
    }

    try {
      const data = JSON.parse(responseText);
      
      const enrichedData = data.map((item: any) => ({
        ...item,
        photos: item.photo_indices.map((idx: number) => images[idx]).filter(Boolean)
      }));

      return NextResponse.json(enrichedData);
    } catch (parseError) {
      console.error("JSON parse error:", parseError, responseText);
      return NextResponse.json({ error: "Failed to parse response" }, { status: 500 });
    }
  } catch (error: any) {
    console.error("Error in /api/generate-batch:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
