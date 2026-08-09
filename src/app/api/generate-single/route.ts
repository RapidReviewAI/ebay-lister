import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuidv4 } from "uuid";

const genAI = new GoogleGenerativeAI(
  process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || ""
);

export const maxDuration = 300;

const SYSTEM_INSTRUCTION = `You are an inventory clerk. Return ONLY a JSON object for an eBay listing based on these images.
REQUIRED KEYS:
"title": 80 char SEO title.
"category": Full eBay path.
"categoryId": eBay numeric ID.
"description": Plain text details.
"price": Suggested retail price.
"item_specifics": { "Brand": "...", "Size": "...", "Color": "..." }
"is_lot": true/false.

If you cannot identify the item, guess based on visual cues. NEVER return empty values.`.trim();

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

    // FRANK'S BULLETPROOF PARSER
    let listing: any;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      const cleanJson = jsonMatch ? jsonMatch[0] : rawText;
      listing = JSON.parse(cleanJson);
    } catch (e) {
      console.error("Failed to parse Gemini response:", rawText);
      listing = {
        title: "Manual Review Required: " + (rawText.substring(0, 30) || "Empty Response"),
        category: "Clothing, Shoes & Accessories > Baby > Toddler Clothing > Tops",
        categoryId: "51959",
        item_specifics: { Brand: "Unknown", Size: "3T", Color: "Multi" }
      };
    }

    // FORCE CATEGORY ID MAPPING (Common Reseller Categories)
    const categoryMap: Record<string, string> = {
      "toddler": "51959",
      "shirt": "51959",
      "trading card": "183050",
      "collectible": "1",
      "toy": "220"
    };

    const rawCategory = listing.category || listing.category_suggestion || "Clothing, Shoes & Accessories > Baby > Toddler Clothing > Tops";
    const finalCategory = typeof rawCategory === 'object' ? (rawCategory.breadcrumb || rawCategory.name || "Clothing, Shoes & Accessories > Baby > Toddler Clothing > Tops") : String(rawCategory);

    let finalCategoryId = String(listing.categoryId || listing.category_id || (typeof rawCategory === 'object' ? rawCategory.id : "") || "");
    if (!finalCategoryId || finalCategoryId === "undefined") {
      const catLower = finalCategory.toLowerCase();
      Object.keys(categoryMap).forEach(key => {
        if (catLower.includes(key)) finalCategoryId = categoryMap[key];
      });
      if (!finalCategoryId) finalCategoryId = "51959";
    }

    // ENSURE SPECIFICS ARE FLAT
    const rawSpecs = listing.item_specifics || listing.specifics || {};
    const cleanSpecs = Array.isArray(rawSpecs)
      ? rawSpecs.reduce((acc: any, spec: any) => {
          if (spec?.name) acc[spec.name] = String(spec.value ?? "");
          return acc;
        }, {})
      : Object.entries(rawSpecs).reduce((acc: any, [k, v]) => {
          acc[k] = String(v ?? "");
          return acc;
        }, {});

    // Helper to find specific values
    const findSpec = (name: string) => cleanSpecs[name] || cleanSpecs[name.toLowerCase()];

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
    const finalTitle = listing.title || "Toddler Clothing Lot";

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
      title: finalTitle,
      category: finalCategory,
      categoryId: finalCategoryId,
      item_specifics: cleanSpecs, // Explicitly pass the flattened object
      photos: orderedPhotos,
      model_debug: modelUsed + " | " + rawText.substring(0, 100),
      v: 29
    });

  } catch (error: any) {
    console.error("Listing Gen Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
