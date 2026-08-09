import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { photos } = await req.json();
    const API_KEY = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "").trim();
    
    if (!API_KEY) return NextResponse.json({ error: "API_KEY_MISSING_IN_VERCEL" }, { status: 500 });
    if (!photos?.length) return NextResponse.json({ error: "No photos provided" }, { status: 400 });

    // FRANK'S LIGHTWEIGHT IMAGE PREP
    const firstUrl = photos[0].includes("cloudinary.com")
      ? photos[0].replace("/upload/", "/upload/c_limit,w_600,q_auto:low/")
      : photos[0];
    
    const res = await fetch(firstUrl);
    if (!res.ok) throw new Error(`Failed to fetch photo from URL: ${res.statusText}`);
    const buffer = await res.arrayBuffer();
    const base64Image = Buffer.from(buffer).toString("base64");

    // THE STABLE US URL (NO BETA, NO VERSIONED SUFFIX)
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`;

    const payload = {
      contents: [{
        parts: [
          { text: "Return eBay listing JSON with keys: title, price (number), category, categoryId, item_specifics (flat object), description. Category for sports cards is 261328." },
          { inline_data: { mime_type: res.headers.get("content-type") || "image/jpeg", data: base64Image } }
        ]
      }],
      generationConfig: { responseMimeType: "application/json" }
    };

    const googleRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await googleRes.json();

    if (!googleRes.ok) {
      // THIS WILL CAPTURE THE EXACT REASON (e.g., API NOT ENABLED)
      console.error("GOOGLE API REJECTION:", JSON.stringify(result));
      return NextResponse.json({ 
        error: "Google API Rejected", 
        detail: result.error?.message || "Unknown error",
        status: googleRes.status 
      }, { status: googleRes.status });
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
      categoryId: finalCatId,
      item_specifics: listing.item_specifics || {},
      photos: photos,
      v: 40
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
