import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuidv4 } from "uuid";

const genAI = new GoogleGenerativeAI(
  process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || ""
);

export const maxDuration = 300;

const SYSTEM_INSTRUCTION = `You are a master eBay listing architect.
Generate a high-converting listing JSON.

DESCRIPTION RULE:
- Use PLAIN TEXT with simple formatting.
- Use double line breaks for paragraphs.
- Use dashes (-) for bullet points.
- NO HTML TAGS.

JSON Format:
{
  "title": "string",
  "description": "string",
  "price": "string",
  "categoryId": "string",
  "brand": "string",
  "size": "string",
  "color": "string",
  "item_specifics": [{"name": "string", "value": "string"}]
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

    // Helper to find specific values in the array Gemini returns
    const findSpec = (name: string) => 
      listing.item_specifics?.find((s: any) => s.name.toLowerCase() === name.toLowerCase())?.value;

    // Flatten the critical fields for the UI/CSV
    const refinedListing = {
      ...listing,
      brand: listing.brand || findSpec("Brand") || "Unbranded",
      size: listing.size || findSpec("Size") || "N/A",
      color: listing.color || findSpec("Color") || "Multi-Color",
      category: listing.category || "Collectibles > Non-Sport Trading Cards",
      categoryId: listing.categoryId || "183050",
    };

    // Generate a valid UUID so PostgreSQL (22P02) doesn't crash
    const validId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : uuidv4();

    const coverIdx = listing.cover_photo_index ?? 0;
    const orderedPhotos = [
      photos[coverIdx] || photos[0],
      ...photos.filter((_: any, i: number) => i !== coverIdx)
    ];

    return NextResponse.json({
      ...refinedListing,
      id: validId,
      photos: orderedPhotos,
      model_debug: modelUsed,
      v: 19
    });

  } catch (error: any) {
    console.error("Listing Gen Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
