import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuidv4 } from "uuid";

const genAI = new GoogleGenerativeAI(
  process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || ""
);

export const maxDuration = 300;

const SYSTEM_INSTRUCTION = `You are a master eBay listing architect. 
Analyze the images and generate a high-converting listing JSON.
STRICT RULES:
1. TITLE: Max 80 characters. Put the most important keywords first (Brand, Model, Size, Material). No fluff like "L@@K" or "RARE".
2. CATEGORY: Provide a specific numeric eBay Leaf Category ID.
3. ITEM SPECIFICS: Provide at least 8-10 specific 'aspects' relevant to the item.
4. CONDITION: Use eBay standard IDs (1000: New, 3000: Used, 4000: Very Good, 5000: Good).

JSON Format:
{
  "title": "string",
  "description": "string (HTML formatted for eBay)",
  "price": "string",
  "categoryId": "string",
  "condition": "string",
  "item_specifics": [{"name": "string", "value": "string"}],
  "brand": "string",
  "size": "string",
  "color": "string"
}`.trim();

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

    // Generate a valid UUID so PostgreSQL (22P02) doesn't crash
    const validId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : uuidv4();

    const coverIdx = listing.cover_photo_index ?? 0;
    const orderedPhotos = [
      photos[coverIdx] || photos[0],
      ...photos.filter((_: any, i: number) => i !== coverIdx)
    ];

    return NextResponse.json({
      ...listing,
      id: validId,
      photos: orderedPhotos,
      model_debug: modelUsed,
      v: 16
    });

  } catch (error: any) {
    console.error("Listing Gen Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
