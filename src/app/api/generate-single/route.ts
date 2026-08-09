import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// GET test: Visit /api/generate-single in your browser. If it says 'READY', the folder is correct.
export async function GET() {
  return NextResponse.json({ status: "READY_FOR_POST", v: 47 });
}

export async function POST(req: NextRequest) {
  try {
    const { photos } = await req.json();
    const API_KEY = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "").trim();
    
    if (!API_KEY) return NextResponse.json({ error: "KEY_MISSING" }, { status: 500 });
    if (!photos || !photos.length) return NextResponse.json({ error: "No photos provided." }, { status: 400 });

    const firstUrl = photos[0].includes("cloudinary.com")
      ? photos[0].replace("/upload/", "/upload/c_limit,w_600,q_auto:low/")
      : photos[0];

    const res = await fetch(firstUrl);
    if (!res.ok) throw new Error(`Failed to fetch photo from URL: ${res.statusText}`);
    const buffer = await res.arrayBuffer();
    const b64 = Buffer.from(buffer).toString("base64");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`;
    const gRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Return eBay JSON: { 'title': 'string', 'price': 1.99, 'category': 'string', 'categoryId': 'string', 'item_specifics': {}, 'description': 'string' }" }, { inline_data: { mime_type: res.headers.get("content-type") || "image/jpeg", data: b64 } }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const result = await gRes.json();

    if (!gRes.ok) {
      return NextResponse.json({ 
        error: "Google API Rejected v1beta", 
        detail: result.error?.message || "Unknown error",
        status: gRes.status 
      }, { status: gRes.status });
    }

    const rawText = result.candidates[0].content.parts[0].text;
    const cleanText = rawText.replace(/```json|```/g, "").trim();

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

    const validId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : (listing.id || uuidv4());

    return NextResponse.json({
      ...listing,
      id: validId,
      title: listing.title || "Untitled Listing",
      price: listing.price || 1.99,
      categoryId: finalCatId,
      item_specifics: listing.item_specifics || {},
      photos: photos,
      v: 47
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, hint: "Frank V47 Hit" }, { status: 500 });
  }
}
