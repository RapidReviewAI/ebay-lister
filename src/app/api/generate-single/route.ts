import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuidv4 } from "uuid";

const genAI = new GoogleGenerativeAI(
  process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || ""
);

export const maxDuration = 300;

const SYSTEM_INSTRUCTION = `Analyze the provided images of an item (or group of items). 
1. IDENTIFY: Is this a single item or a lot of multiple items? 
2. TITLE: Create an 80-character eBay title. If it is a lot, include 'Lot of X' or 'Set'. 
3. CATEGORY: Suggest the most accurate eBay Category Name (e.g., 'Clothing, Shoes & Accessories > Kids > Boys > Boys' Clothing (Sizes 4 & Up) > Tops, Shirts & T-Shirts').
4. DESCRIPTION: Write a detailed plain-text description. Mention brands, sizes, colors, and condition for all items in the image.
5. SPECS: Generate a JSON object of item specifics.
6. ROTATION: Clockwise rotation (0, 90, 180, 270) to make the primary item upright.

OUTPUT ONLY VALID JSON:
{
  "title": "string",
  "category_suggestion": "string",
  "description": "string",
  "suggested_price": number,
  "rotation": number,
  "is_lot": boolean,
  "item_specifics": { "Brand": "string", "Size": "string", "Color": "string" }
}`.trim();

async function imageUrlToInlineData(imgStr: string) {
  let finalUrl = imgStr;

  if (imgStr.includes("cloudinary.com") && !imgStr.includes("a_auto")) {
    finalUrl = imgStr.replace("/upload/", "/upload/a_auto/");
  }

  let b64Data = finalUrl;
  let mimeType = "image/jpeg";

  if (finalUrl.startsWith("http://") || finalUrl.startsWith("https://")) {
    const res = await fetch(finalUrl);
    const buf = await res.arrayBuffer();
    b64Data = Buffer.from(buf).toString("base64");
    mimeType = res.headers.get("content-type") ?? "image/jpeg";
  } else if (finalUrl.includes(";base64,")) {
    const split = finalUrl.split(";base64,");
    b64Data = split[1] || finalUrl;
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
    let rawText = "";
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

        rawText = result.response.text();
        if (rawText) {
          modelUsed = modelName;
          break;
        }
      } catch (err: any) {
        console.error(`Attempt with ${modelName} failed:`, err.message);
        continue;
      }
    }

    if (!rawText) throw new Error("All models failed to generate content.");

    // Clean JSON markdown backticks before parsing
    const cleanJson = rawText.replace(/```json|```/g, "").trim();
    const listing = JSON.parse(cleanJson);

    // Helper to find specific values if item_specifics is an array or object
    const findSpec = (name: string) => {
      if (!listing.item_specifics) return undefined;
      if (Array.isArray(listing.item_specifics)) {
        return listing.item_specifics.find((s: any) => s.name.toLowerCase() === name.toLowerCase())?.value;
      }
      return listing.item_specifics[name] || listing.item_specifics[name.toLowerCase()];
    };

    // Auto-apply rotation to Cloudinary image URLs if rotation is non-zero
    let finalPhotos = [...photos];
    const rot = Number(listing.rotation) || 0;
    if (rot > 0) {
      finalPhotos = finalPhotos.map(url => {
        if (typeof url === 'string' && url.includes("cloudinary.com")) {
          return url.replace("/upload/", `/upload/a_${rot}/`);
        }
        return url;
      });
    }

    const priceVal = listing.suggested_price || listing.price || "19.99";

    // Flatten critical fields
    const refinedListing = {
      ...listing,
      price: String(priceVal),
      brand: listing.brand || findSpec("Brand") || "Unbranded",
      size: listing.size || findSpec("Size") || "N/A",
      color: listing.color || findSpec("Color") || "Multi-Color",
      category: listing.category_suggestion || listing.category || "Collectibles > Non-Sport Trading Cards",
      categoryId: listing.categoryId || "183050",
      is_lot: listing.is_lot ?? false,
      rotation: rot,
    };

    // Generate a valid UUID so PostgreSQL (22P02) doesn't crash
    const validId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : uuidv4();

    const coverIdx = listing.cover_photo_index ?? 0;
    const orderedPhotos = [
      finalPhotos[coverIdx] || finalPhotos[0],
      ...finalPhotos.filter((_: any, i: number) => i !== coverIdx)
    ];

    return NextResponse.json({
      ...refinedListing,
      id: validId,
      photos: orderedPhotos,
      model_debug: modelUsed,
      v: 24
    });

  } catch (error: any) {
    console.error("Listing Gen Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
