import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuidv4 } from "uuid";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const { photos } = await req.json();
    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      return NextResponse.json({ error: "No photos." }, { status: 400 });
    }

    const API_KEY = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "").trim();
    if (!API_KEY) {
      return NextResponse.json({ error: "API Key missing." }, { status: 401 });
    }

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const imageParts = await Promise.all(
      photos.slice(0, 3).map(async (imgStr: string) => {
        let finalUrl = imgStr;
        if (imgStr.includes("cloudinary.com") && !imgStr.includes("a_auto")) {
          finalUrl = imgStr.replace("/upload/", "/upload/a_auto/");
        }
        let b64 = finalUrl;
        let mime = "image/jpeg";

        if (finalUrl.startsWith("http://") || finalUrl.startsWith("https://")) {
          const res = await fetch(finalUrl);
          const buf = await res.arrayBuffer();
          b64 = Buffer.from(buf).toString("base64");
          mime = res.headers.get("content-type") ?? "image/jpeg";
        } else if (finalUrl.includes(";base64,")) {
          const split = finalUrl.split(";base64,");
          b64 = split[1] || finalUrl;
          mime = split[0].split(":")[1] || "image/jpeg";
        }
        return { inlineData: { data: b64, mimeType: mime } };
      })
    );

    const prompt = `Return eBay listing JSON. 
    Keys: "title" (80 chars), "price" (number), "category" (breadcrumb), "categoryId" (string), "item_specifics" (flat object), "description" (string). 
    If this is a sports card, use CategoryId 261328.`;

    const result = await model.generateContent([prompt, ...imageParts]);
    const responseText = result.response.text();
    
    // FRANK'S FAIL-SAFE PARSER
    let listing: any;
    try {
      listing = JSON.parse(responseText);
    } catch (e) {
      const match = responseText.match(/\{[\s\S]*\}/);
      listing = match ? JSON.parse(match[0]) : {};
    }

    const catId = String(listing.categoryId || listing.category_id || "1");
    const titleLower = (listing.title || "").toLowerCase();
    const finalCatId = (titleLower.includes("card") || titleLower.includes("topps") || titleLower.includes("panini") || titleLower.includes("bowman")) ? "261328" : catId;

    const validId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : uuidv4();

    // ENSURE FLATNESS - No more 'specifics' nesting
    return NextResponse.json({
      id: validId,
      title: listing.title || "Untitled Listing",
      price: listing.price || 0.99,
      category: listing.category || listing.category_suggestion || "Uncategorized",
      categoryId: finalCatId,
      item_specifics: listing.item_specifics || {},
      description: listing.description || "",
      photos: photos,
      v: 32
    });

  } catch (error: any) {
    console.error("API CRASH:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
