import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { photos } = await req.json();
    const API_KEY = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "").trim();
    if (!API_KEY) return NextResponse.json({ error: "API_KEY_MISSING" }, { status: 500 });
    if (!photos || !photos.length) return NextResponse.json({ error: "No photos provided." }, { status: 400 });

    // 1. DISCOVERY PHASE: Ask Google what models THIS KEY can actually use
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
    const listRes = await fetch(listUrl);
    const listData = await listRes.json();

    // Log the available models to your Vercel logs so you can see them!
    console.log("FRANK SYSTEM LOG - AVAILABLE MODELS:", JSON.stringify(listData.models?.map((m: any) => m.name)));

    // 2. SELECTION PHASE: Find the first 1.5-flash model in the list
    // This bypasses the naming drama. If Google renamed it 'gemini-1.5-flash-v2-beta-whatever', we will find it.
    const workingModel = listData.models?.find((m: any) => 
      (m.name.includes("gemini-1.5-flash") || m.name.includes("flash")) &&
      m.supportedGenerationMethods?.includes("generateContent")
    );

    const modelName = workingModel ? workingModel.name : "models/gemini-1.5-flash"; // Fallback to standard
    console.log(`FRANK SYSTEM LOG - PICKED MODEL: ${modelName}`);

    // 3. GENERATION PHASE
    const firstUrl = photos[0].includes("cloudinary.com")
      ? photos[0].replace("/upload/", "/upload/c_limit,w_600,q_auto:low/")
      : photos[0];

    const res = await fetch(firstUrl);
    if (!res.ok) throw new Error(`Failed to fetch photo from URL: ${res.statusText}`);
    const buffer = await res.arrayBuffer();
    const base64Image = Buffer.from(buffer).toString("base64");

    const endpointPath = modelName.startsWith("models/") ? modelName : `models/${modelName}`;
    const genUrl = `https://generativelanguage.googleapis.com/v1beta/${endpointPath}:generateContent?key=${API_KEY}`;

    const googleRes = await fetch(genUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: "Return eBay listing JSON: { 'title': 'string', 'price': number, 'category': 'string', 'categoryId': 'string', 'item_specifics': {}, 'description': 'string' }" },
            { inline_data: { mime_type: res.headers.get("content-type") || "image/jpeg", data: base64Image } }
          ]
        }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const result = await googleRes.json();

    if (!googleRes.ok) {
      return NextResponse.json({ 
        error: "Google API Rejected", 
        detail: result.error?.message || "Check Logs",
        available_models: listData.models?.map((m: any) => m.name) || "None"
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
      model_used: modelName,
      v: 43
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
