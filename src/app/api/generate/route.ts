import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuidv4 } from "uuid";

export const maxDuration = 60; // Attempt to tell Vercel to wait (only works on Pro, but good practice)

export async function POST(req: NextRequest) {
  try {
    const { photos } = await req.json();
    const API_KEY = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "").trim();
    
    if (!API_KEY) return NextResponse.json({ error: "Missing API Key" }, { status: 500 });
    if (!photos?.length) return NextResponse.json({ error: "No photos" }, { status: 400 });

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // FRANK'S PERFORMANCE HACK: Downscale images via Cloudinary URLs to ~200kb each
    // This bypasses the 4.5MB limit and speeds up the Gemini upload.
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
            inlineData: {
              data: Buffer.from(buffer).toString("base64"),
              mimeType: res.headers.get("content-type") || "image/jpeg",
            },
          };
        } catch {
          return null;
        }
      })
    );

    const validParts = imageParts.filter(Boolean);
    if (!validParts.length) throw new Error("Failed to process any images.");

    const prompt = "Return eBay JSON: title, price, category, categoryId, item_specifics, description. Category for sports cards is 261328.";
    
    // We don't use 'generationConfig' here to keep the request as light as possible
    const result = await model.generateContent([prompt, ...validParts as any]);
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
      v: 34
    });

  } catch (error: any) {
    console.error("API CRASH:", error.message);
    return NextResponse.json({ error: error.message, frank_hint: "Check Vercel Timeout" }, { status: 500 });
  }
}
