import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { photos } = await req.json();
    const API_KEY = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "").trim();
    
    if (!API_KEY) return NextResponse.json({ error: "Missing API Key" }, { status: 500 });
    if (!photos?.length) return NextResponse.json({ error: "No photos" }, { status: 400 });

    // IMAGE PROCESSING (Keep it light)
    const optimizedPhotos = photos.slice(0, 2).map((url: string) => {
      if (url.includes("cloudinary.com")) {
        if (url.includes("/upload/a_auto/")) {
          return url.replace("/upload/a_auto/", "/upload/c_limit,w_600,q_auto:low,a_auto/");
        }
        return url.replace("/upload/", "/upload/c_limit,w_600,q_auto:low/");
      }
      return url;
    });

    const imageParts = await Promise.all(
      optimizedPhotos.map(async (url: string) => {
        try {
          const res = await fetch(url);
          if (!res.ok) return null;
          const buffer = await res.arrayBuffer();
          return { inline_data: { mime_type: res.headers.get("content-type") || "image/jpeg", data: Buffer.from(buffer).toString("base64") } };
        } catch {
          return null;
        }
      })
    );

    const validParts = imageParts.filter(Boolean);
    if (!validParts.length) throw new Error("Failed to process any images.");

    // THE 'V1' HAIL MARY
    // Note: No 'v1beta', no fallback loop, just the absolute base model.
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

    const googleRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Return eBay listing JSON: title, price, category, categoryId, item_specifics, description. Category for cards is 261328." }, ...validParts] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const result = await googleRes.json();
    
    if (!googleRes.ok) {
      return NextResponse.json({ 
        error: result.error?.message || "Google Rejected Request",
        code: result.error?.code,
        status: googleRes.status
      }, { status: googleRes.status });
    }

    const text = result.candidates[0].content.parts[0].text;
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
      v: 38
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
