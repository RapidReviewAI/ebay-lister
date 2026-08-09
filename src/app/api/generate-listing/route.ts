import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuidv4 } from "uuid";

const genAI = new GoogleGenerativeAI(
  process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || ""
);

export const maxDuration = 300;

const SYSTEM_INSTRUCTION = `You are an eBay Listing Specialist. 
Analyze the images and provide a high-accuracy listing.
- TITLE: 80 chars, keyword-dense.
- CATEGORY: Exact eBay breadcrumb (e.g., Clothing, Shoes & Accessories > Baby > Toddler Clothing > Tops).
- CATEGORY_ID: The specific eBay Numeric ID for this category.
- ITEM_SPECIFICS: Brand, Size, Color, Material, etc.
- IS_LOT: Boolean, true if multiple items.
OUTPUT ONLY VALID JSON.`.trim();

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
      return NextResponse.json({ error: "No photos provided." }, { status: 400 });
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

    // Determine the best category name and ID from the model response
    let catName = "Uncategorized > Please Edit";
    if (typeof listing.category_suggestion === 'string') {
      catName = listing.category_suggestion;
    } else if (typeof listing.category_suggestion === 'object' && listing.category_suggestion !== null) {
      catName = listing.category_suggestion.breadcrumb || listing.category_suggestion.name || catName;
    } else if (typeof listing.category === 'string') {
      catName = listing.category;
    } else if (typeof listing.category === 'object' && listing.category !== null) {
      catName = listing.category.breadcrumb || listing.category.name || catName;
    }

    let catId = listing.categoryId || listing.category_id || (typeof listing.category_suggestion === 'object' ? listing.category_suggestion?.id : "") || "";

    // Frank's "No Hallucination" logic: 
    // If the category contains "Trading Card" but the title contains "Shirt" or "Clothes" or "Polo", 
    // we flag it for manual review / correct clothing category instead of defaulting to junk.
    const titleLower = (listing.title || "").toLowerCase();
    const finalCategory = (catName.includes("Trading Card") && (titleLower.includes("shirt") || titleLower.includes("polo") || titleLower.includes("top"))) 
      ? "Clothing, Shoes & Accessories > Baby > Toddler Clothing > Tops" 
      : catName;

    const finalCategoryId = (finalCategory.includes("Toddler Clothing")) ? "51959" : String(catId);

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
      category: finalCategory,
      categoryId: finalCategoryId,
      condition: listing.condition || "3000",
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
      title: listing.title || "Untitled Listing",
      category: finalCategory,
      categoryId: finalCategoryId,
      is_lot: listing.is_lot ?? false,
      rotation: rot,
      model_debug: modelUsed,
      v: 28
    });

  } catch (error: any) {
    console.error("Listing Gen Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
