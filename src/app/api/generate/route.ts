import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 60; // Extend Vercel timeout to 60s

export async function POST(req: NextRequest) {
  try {
    // 1. ENV CHECK
    const API_KEY = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "").trim();
    if (!API_KEY) throw new Error("GEMINI_API_KEY is missing in environment variables.");

    const { photos } = await req.json();
    if (!photos || !photos.length) return NextResponse.json({ error: "No photos provided" }, { status: 400 });

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    // 2. RESILIENT IMAGE FETCHING
    const imageParts = await Promise.all(
      photos.slice(0, 3).map(async (url: string) => {
        try {
          let finalUrl = url;
          if (url.includes("cloudinary.com") && !url.includes("a_auto")) {
            finalUrl = url.replace("/upload/", "/upload/a_auto/");
          }
          if (finalUrl.startsWith("http://") || finalUrl.startsWith("https://")) {
            const res = await fetch(finalUrl);
            if (!res.ok) return null;
            const buffer = await res.arrayBuffer();
            return {
              inlineData: {
                data: Buffer.from(buffer).toString("base64"),
                mimeType: res.headers.get("content-type") || "image/jpeg",
              },
            };
          } else if (finalUrl.includes(";base64,")) {
            const split = finalUrl.split(";base64,");
            return {
              inlineData: {
                data: split[1] || finalUrl,
                mimeType: split[0].split(":")[1] || "image/jpeg",
              },
            };
          }
          return null;
        } catch (e) { return null; }
      })
    );

    const validImageParts = imageParts.filter(Boolean);
    if (validImageParts.length === 0) throw new Error("Failed to process any images.");

    const prompt = `Return eBay listing JSON. 
    Required Keys: "title", "price" (number), "category", "categoryId", "item_specifics" (flat object), "description". 
    Context: Sports cards category is 261328.`;

    const result = await model.generateContent([prompt, ...validImageParts as any]);
    const text = result.response.text();
    
    // 3. SAFE PARSING
    let listing: any;
    try {
      listing = JSON.parse(text);
    } catch (e) {
      const match = text.match(/\{[\s\S]*\}/);
      listing = match ? JSON.parse(match[0]) : {};
    }

    // 4. STABLE UUID & RESPONSE
    const fallbackId = Date.now().toString(36) + Math.random().toString(36).substring(2);

    return NextResponse.json({
      ...listing,
      id: fallbackId,
      title: listing.title || "Untitled Listing",
      categoryId: String(listing.categoryId || "1"),
      item_specifics: listing.item_specifics || {},
      photos: photos,
      v: 33
    });

  } catch (error: any) {
    console.error("FRANK API ERROR:", error.message);
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}
