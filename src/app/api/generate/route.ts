import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuidv4 } from "uuid";

const genAI = new GoogleGenerativeAI(
  process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || ""
);

export const maxDuration = 300;

const SYSTEM_INSTRUCTION = `
You are a master eBay listing architect.
TASK: Generate a high-converting listing for the item in the photos.

TITLING RULES:
- Max 80 characters. Keywords first.

JSON SCHEMA:
Return ONLY:
{
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
    const model = genAI.getGenerativeModel({ 
      model: "gemini-flash-latest",
      generationConfig: { responseMimeType: "application/json" }
    });

    const result = await model.generateContent([
      SYSTEM_INSTRUCTION,
      ...imageParts,
      "Generate the eBay listing JSON now."
    ]);

    const responseText = result.response.text();
    const listing = JSON.parse(responseText.replace(/```json|```/g, "").trim());

    // FIX: Generate a valid UUID so PostgreSQL (22P02) doesn't crash
    const validId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : uuidv4();

    const coverIdx = listing.cover_photo_index ?? 0;
    const orderedPhotos = [
      photos[coverIdx] || photos[0],
      ...photos.filter((_: any, i: number) => i !== coverIdx)
    ];

    return NextResponse.json({
      ...listing,
      id: validId, // Override AI's garbage ID with a real UUID
      photos: orderedPhotos,
      v: 15
    });

  } catch (error: any) {
    console.error("Listing Gen Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
