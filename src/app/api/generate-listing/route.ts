import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuidv4 } from "uuid";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { photos } = await req.json();
    const API_KEY = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "").trim();
    
    if (!API_KEY) return NextResponse.json({ error: "Missing API Key" }, { status: 500 });
    if (!photos?.length) return NextResponse.json({ error: "No photos" }, { status: 400 });

    const genAI = new GoogleGenerativeAI(API_KEY);

    // FRANK'S MODEL FALLBACK LIST: 
    // Google changes these aliases frequently. We try the most likely winners.
    const MODELS_TO_TRY = ["gemini-1.5-flash-latest", "gemini-1.5-flash", "gemini-1.5-flash-001"];
    let lastError = "";

    // Optimized images for platform limits
    const optimizedPhotos = photos.slice(0, 2).map((url: string) => {
      if (url.includes("cloudinary.com")) {
        if (url.includes("/upload/a_auto/")) {
          return url.replace("/upload/a_auto/", "/upload/c_limit,w_800,q_auto:low,a_auto/");
        }
        return url.replace("/upload/", "/upload/c_limit,w_800,q_auto:low/");
      }
      return url;
    });

    const imageParts = await Promise.all(
      optimizedPhotos.map(async (url: string) => {
        try {
          const res = await fetch(url);
          if (!res.ok) return null;
          const buffer = await res.arrayBuffer();
          return { inlineData: { data: Buffer.from(buffer).toString("base64"), mimeType: res.headers.get("content-type") || "image/jpeg" } };
        } catch {
          return null;
        }
      })
    );

    const validParts = imageParts.filter(Boolean);
    if (!validParts.length) throw new Error("Failed to process any images.");

    const prompt = "Return eBay JSON: title, price, category, categoryId, item_specifics. Category for cards is 261328.";

    // ATTEMPT GENERATION WITH FALLBACKS
    let result;
    let successfulModel = "";
    for (const modelName of MODELS_TO_TRY) {
      try {
        const currentModel = genAI.getGenerativeModel({ model: modelName });
        result = await currentModel.generateContent([prompt, ...validParts as any]);
        if (result) {
          successfulModel = modelName;
          break; // We found a working model!
        }
      } catch (e: any) {
        lastError = e.message;
        continue; // Try the next model in the list
      }
    }

    if (!result) throw new Error(`All models failed. Last error: ${lastError}`);

    const response = await result.response;
    const text = response.text().replace(/```json|```/g, "").trim();
    
    let listing: any;
    try {
      listing = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      listing = match ? JSON.parse(match[0]) : {};
    }

    const titleLower = (listing.title || "").toLowerCase();
    const catId = String(listing.categoryId || listing.category_id || "1");
    const finalCatId = (titleLower.includes("card") || titleLower.includes("topps") || titleLower.includes("panini")) ? "261328" : catId;

    const validId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : uuidv4();

    return NextResponse.json({
      ...listing,
      id: validId,
      title: listing.title || "Untitled Listing",
      categoryId: finalCatId,
      item_specifics: listing.item_specifics || {},
      photos: photos,
      model_used: successfulModel,
      v: 35
    });

  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message, 
      frank_hint: "Check model availability in your region" 
    }, { status: 500 });
  }
}
