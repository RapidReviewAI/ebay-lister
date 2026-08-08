import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(
  process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || ""
);

export const maxDuration = 300;

const SYSTEM_INSTRUCTION = `
You are a master eBay listing architect optimized for the Cassini search algorithm.
TASK: Generate a high-converting listing for the item in the photos.

TITLING RULES (CRITICAL):
- Strictly max 80 characters.
- Format: [Brand] [Model/Name] [Gender/Category] [Size] [Color] [Condition/Key Feature].
- Primary keywords first. No fluff like "L@@K" or "Must See".

CATEGORY RULES:
- Provide the exact numeric eBay Category ID (e.g., 15687 for T-Shirts).

CONDITION CODES:
- 1000 (New), 3000 (Very Good), 4000 (Good), 5000 (Acceptable).

JSON SCHEMA REQUIREMENT:
Return ONLY a JSON object:
{
  "id": "string",
  "title": "string",
  "description": "string",
  "price": "string",
  "category": "string",
  "categoryId": "string",
  "condition": "string",
  "brand": "string",
  "size": "string",
  "color": "string",
  "item_specifics": [{"name": "string", "value": "string"}],
  "cover_photo_index": number
}
`.trim();

async function imageUrlToInlineData(imgStr: string) {
  let b64Data = imgStr;
  let mimeType = "image/jpeg";

  if (imgStr.startsWith("http://") || imgStr.startsWith("https://")) {
    const res = await fetch(imgStr);
    const buf = await res.arrayBuffer();
    b64Data = Buffer.from(buf).toString("base64");
    mimeType = res.headers.get("content-type") ?? "image/jpeg";
  } else if (imgStr.includes(";base64,")) {
    const split = imgStr.split(";base64,");
    b64Data = split[1] || imgStr;
    mimeType = split[0].split(":")[1] || "image/jpeg";
  }

  return {
    inlineData: {
      data: b64Data,
      mimeType: mimeType,
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const API_KEY = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "").trim();
    if (!API_KEY) return NextResponse.json({ error: "API Key missing." }, { status: 401 });

    const { photos } = await req.json();
    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      return NextResponse.json({ error: "No photos." }, { status: 400 });
    }

    const imageParts = await Promise.all(photos.map(imageUrlToInlineData));
    
    // Use the models we KNOW work for your key
    const MODELS_TO_TRY = ["gemini-flash-latest", "gemini-1.5-flash"];
    let responseText = "";
    let modelUsed = "";

    for (const modelName of MODELS_TO_TRY) {
      try {
        const model = genAI.getGenerativeModel({ 
          model: modelName,
          generationConfig: { responseMimeType: "application/json" }
        });

        const result = await model.generateContent([
          SYSTEM_INSTRUCTION,
          ...imageParts,
          "Generate the eBay listing JSON now."
        ]);

        responseText = result.response.text();
        if (responseText) {
          modelUsed = modelName;
          break;
        }
      } catch (err: any) {
        console.error(`Attempt with ${modelName} failed:`, err.message);
        continue;
      }
    }

    if (!responseText) throw new Error("All models failed to generate content.");

    const listing = JSON.parse(responseText.replace(/```json|```/g, "").trim());

    // Cover photo logic
    const coverIdx = listing.cover_photo_index ?? 0;
    const orderedPhotos = [
      photos[coverIdx] || photos[0],
      ...photos.filter((_: any, i: number) => i !== coverIdx)
    ];

    return NextResponse.json({
      ...listing,
      photos: orderedPhotos,
      model_debug: modelUsed,
      v: 14
    });

  } catch (error: any) {
    console.error("Listing Gen Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
