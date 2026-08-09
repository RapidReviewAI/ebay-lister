import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuidv4 } from "uuid";

const genAI = new GoogleGenerativeAI(
  process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || ""
);

export const maxDuration = 300;

const SYSTEM_INSTRUCTION = `Analyze the provided product image for an e-commerce listing. 
1. TEXT DETECTION: Identify any text, logos, or brand markings. 
2. LOGIC: Determine necessary clockwise rotation (0, 90, 180, 270) to make it upright.
3. DESCRIPTION: Write a concise, professional plain-text description (no HTML). Focus on condition, key features, and what is included.
4. OUTPUT: Return the following JSON:
{
  "rotation_logic": "string",
  "rotation": 0,
  "title": "Optimized eBay Title (80 chars)",
  "brand": "string",
  "description": "Plain text product description",
  "suggested_price": 0.00,
  "item_specifics": {
    "Brand": "string",
    "Model": "string",
    "Color": "string",
    "Condition": "string"
  }
}
STRICT RULE: The 'rotation' must be 0, 90, 180, or 270. All fields are required.`.trim();

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
      category: listing.category || "Collectibles > Non-Sport Trading Cards",
      categoryId: listing.categoryId || "183050",
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
      v: 23
    });

  } catch (error: any) {
    console.error("Listing Gen Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
