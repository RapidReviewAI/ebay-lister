import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { photos } = await req.json();
    const API_KEY = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "").trim();
    
    if (!API_KEY) return NextResponse.json({ error: "API_KEY is missing in Vercel environment." }, { status: 500 });
    if (!photos || !photos.length) return NextResponse.json({ error: "No photos provided." }, { status: 400 });

    // Optimize first photo for speed and payload limits
    const firstUrl = photos[0].includes("cloudinary.com")
      ? photos[0].replace("/upload/", "/upload/c_limit,w_600,q_auto:low/")
      : photos[0];

    const res = await fetch(firstUrl);
    if (!res.ok) throw new Error(`Failed to fetch photo from URL: ${res.statusText}`);
    const buffer = await res.arrayBuffer();
    const base64Image = Buffer.from(buffer).toString("base64");

    // THE ABSOLUTE URL FOR US PROJECTS (STABLE V1)
    // We use the full 'models/gemini-1.5-flash' path as required by the REST spec
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

    const payload = {
      contents: [{
        parts: [
          { text: "Return eBay listing JSON: { 'title': 'string', 'price': number, 'category': 'string', 'categoryId': 'string', 'item_specifics': {}, 'description': 'string' }" },
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
      console.error("GOOGLE REJECTION:", result);
      return NextResponse.json({ 
        error: result.error?.message || "Google API Error",
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
      v: 41
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
