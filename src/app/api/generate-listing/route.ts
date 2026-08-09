import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuidv4 } from "uuid";

const genAI = new GoogleGenerativeAI(
  process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || ""
);

export const maxDuration = 300;

const SYSTEM_INSTRUCTION = `Return ONLY a flat JSON object.
Required Keys:
"title": 80 chars max.
"price": number.
"category": "Sports Mem, Cards & Fan Shop > Sports Trading Cards > Trading Card Singles"
"categoryId": "261328"
"item_specifics": {"Graded":"No","Sport":"Baseball","Set":"Topps Stars of MLB","Player/Athlete":"Name","Team":"Team Name","Year Manufactured":"2024","Features":"Rookie"}
"description": "Plain text description."`.trim();

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
        category: "Sports Mem, Cards & Fan Shop > Sports Trading Cards > Trading Card Singles",
        categoryId: "261328",
        item_specifics: { Graded: "No", Sport: "Baseball", Set: "Topps", "Player/Athlete": "Unknown" }
      };
    }

    // Absolute Category Mapping for Sports Cards
    let finalCatId = listing.categoryId || listing.category_id || "261328";
    const titleLower = (listing.title || "").toLowerCase();
    const rawCategory = listing.category || listing.category_suggestion || "Sports Mem, Cards & Fan Shop > Sports Trading Cards > Trading Card Singles";
    const catLower = (typeof rawCategory === 'object' ? (rawCategory.breadcrumb || rawCategory.name || "") : String(rawCategory)).toLowerCase();

    if (titleLower.includes("card") || titleLower.includes("topps") || titleLower.includes("panini") || titleLower.includes("bowman") || catLower.includes("card")) {
      finalCatId = "261328"; // Correct ID for Sports Trading Card Singles
    } else if (titleLower.includes("shirt") || titleLower.includes("polo") || catLower.includes("toddler")) {
      finalCatId = "51959"; // Baby & Toddler Tops
    }

    const finalCategory = typeof rawCategory === 'object' ? (rawCategory.breadcrumb || rawCategory.name || "Sports Mem, Cards & Fan Shop > Sports Trading Cards > Trading Card Singles") : String(rawCategory);

    // Force item_specifics to be a flat object
    const rawSpecs = listing.item_specifics || listing.specifics || {};
    const finalSpecs = Array.isArray(rawSpecs)
      ? rawSpecs.reduce((acc: any, spec: any) => {
          if (Array.isArray(spec)) {
            acc[spec[0]] = String(spec[1] ?? "");
          } else if (spec?.name) {
            acc[spec.name] = String(spec.value ?? "");
          }
          return acc;
        }, {})
      : Object.entries(rawSpecs).reduce((acc: any, [k, v]) => {
          acc[k] = String(v ?? "");
          return acc;
        }, {});

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
    const finalTitle = listing.title || "Trading Card Listing";

    const refinedListing = {
      ...listing,
      price: String(priceVal),
      brand: finalSpecs.Brand || listing.brand || "Unbranded",
      size: finalSpecs.Size || listing.size || "N/A",
      color: finalSpecs.Color || listing.color || "Multi-Color",
      category: finalCategory,
      categoryId: finalCatId,
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
      categoryId: finalCatId,
      item_specifics: finalSpecs,
      photos: orderedPhotos,
      model_debug: modelUsed + " | " + rawText.substring(0, 100),
      v: 31
    });

  } catch (error: any) {
    console.error("Listing Gen Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
