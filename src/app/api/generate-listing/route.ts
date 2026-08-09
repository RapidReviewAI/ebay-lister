import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { photos } = await req.json();
    const API_KEY = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "").trim();
    
    if (!API_KEY) return NextResponse.json({ error: "Missing API Key" }, { status: 500 });
    if (!photos?.length) return NextResponse.json({ error: "No photos" }, { status: 400 });

    // FRANK'S PERFORMANCE HACK: Downscale for Vercel limits
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
          return {
            inline_data: {
              mime_type: res.headers.get("content-type") || "image/jpeg",
              data: Buffer.from(buffer).toString("base64")
            }
          };
        } catch {
          return null;
        }
      })
    );

    const validParts = imageParts.filter(Boolean);
    if (!validParts.length) throw new Error("Failed to process any images.");

    // FRANK'S SHOTGUN LIST: Try the most stable beta strings
    const MODELS_TO_TRY = [
      "gemini-1.5-flash",
      "gemini-1.5-flash-latest",
      "gemini-1.5-flash-8b", // Ultra-light version, usually always available
      "gemini-pro-vision"    // Legacy fallback
    ];

    let lastError = "";
    let finalResult: any = null;
    let successfulModel = "";

    const payload = {
      contents: [{
        parts: [
          { text: "Return eBay listing JSON. Keys: title, price (number), category, categoryId, item_specifics (flat object), description. Category for cards is 261328." },
          ...validParts
        ]
      }],
      generationConfig: { responseMimeType: "application/json" }
    };

    for (const modelName of MODELS_TO_TRY) {
      try {
        console.log(`Frank Status - Attempting REST call for: ${modelName}`);
        const genAIUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`;
        const googleRes = await fetch(genAIUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (googleRes.ok) {
          finalResult = await googleRes.json();
          successfulModel = modelName;
          break;
        } else {
          const errData = await googleRes.json();
          lastError = errData.error?.message || googleRes.statusText;
        }
      } catch (e: any) {
        lastError = e.message;
        continue;
      }
    }

    if (!finalResult) throw new Error(`All models in fallback list failed. Last error: ${lastError}`);

    const text = finalResult.candidates[0].content.parts[0].text;
    const cleanText = text.replace(/```json|```/g, "").trim();

    let listing: any;
    try {
      listing = JSON.parse(cleanText);
    } catch {
      const match = cleanText.match(/\{[\s\S]*\}/);
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
      v: 37
    });

  } catch (error: any) {
    console.error("FRANK REST CRASH:", error.message);
    return NextResponse.json({ 
      error: error.message, 
      frank_hint: "Check model availability in your region" 
    }, { status: 500 });
  }
}
