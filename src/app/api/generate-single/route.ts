import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type, Schema } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Each single-item call should complete well within 5 min, but give headroom.
export const maxDuration = 300;

const listingSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    price: { type: Type.STRING },
    category: { type: Type.STRING },
    categoryId: { type: Type.STRING },
    condition: { type: Type.STRING },
    brand: { type: Type.STRING },
    size: { type: Type.STRING },
    color: { type: Type.STRING },
    department: { type: Type.STRING },
    weightOz: { type: Type.STRING },
    sizeType: { type: Type.STRING },
    item_specifics: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          value: { type: Type.STRING },
        },
        required: ["name", "value"],
      },
    },
    cover_photo_index: { type: Type.NUMBER },
  },
  required: [
    "id",
    "title",
    "description",
    "price",
    "category",
    "categoryId",
    "condition",
    "cover_photo_index",
  ],
};

const SYSTEM_INSTRUCTION = `
You are an expert eBay listing AI. You will receive one or more photos of a
SINGLE item. Generate a complete, accurate eBay listing for it.

RULES:
1. Title (max 80 chars): [Brand] [Gender/Age] [Product/Model] [Style] [Size] [Color] [Material/Feature]. No filler words.
2. categoryId: Always the exact numeric eBay Leaf Category ID (e.g., 15687 for Men's T-Shirts).
3. condition: Use eBay condition codes — "1000" (New), "3000" (Very Good), "4000" (Good), "5000" (Acceptable).
4. price: USD string, e.g. "19.99".
5. description: 2–4 short sentences — item type, key features, condition notes, measurements if visible.
6. Prohibited: Never output 'cbd', 'hemp', 'replica', 'fake', 'weapon', 'ammo'.
7. If a field is unknown use "Unbranded", "N/A", or "" as appropriate.
8. Generate a short unique 'id' (e.g. "item_abc123").
9. cover_photo_index: Set this to the 0-based index of the single best hero photo
   (clearest full-item shot, good lighting, plain or neutral background). This
   photo will be placed first in the eBay listing as the main thumbnail.
`.trim();

async function imageUrlToInlineData(imgStr: string) {
  if (imgStr.startsWith("http://") || imgStr.startsWith("https://")) {
    const res = await fetch(imgStr);
    const buf = await res.arrayBuffer();
    return {
      inlineData: {
        data: Buffer.from(buf).toString("base64"),
        mimeType: res.headers.get("content-type") ?? "image/jpeg",
      },
    };
  }
  if (imgStr.includes(",")) {
    const [header, data] = imgStr.split(",");
    return {
      inlineData: { data, mimeType: header.split(":")[1].split(";")[0] },
    };
  }
  return { inlineData: { data: imgStr, mimeType: "image/jpeg" } };
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY?.trim()) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured." },
        { status: 401 }
      );
    }

    const { photos } = await req.json();

    if (!Array.isArray(photos) || photos.length === 0) {
      return NextResponse.json({ error: "No photos provided." }, { status: 400 });
    }

    const imageParts = await Promise.all(photos.map(imageUrlToInlineData));
    const parts: any[] = [
      { text: "Generate a complete eBay listing for the item shown in these photos." },
      ...imageParts,
    ];

    const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];
    let responseText: string | null = null;

    for (const model of MODELS) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await ai.models.generateContent({
            model,
            contents: parts,
            config: {
              systemInstruction: SYSTEM_INSTRUCTION,
              responseMimeType: "application/json",
              responseSchema: listingSchema,
            },
          });
          if (res.text) {
            responseText = res.text;
            break;
          }
        } catch (err: any) {
          console.error(`[generate-single] ${model} attempt ${attempt + 1}:`, err.message);
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
          }
        }
      }
      if (responseText) break;
    }

    if (!responseText) {
      return NextResponse.json(
        { error: "Vision service unavailable. Please retry in a moment." },
        { status: 503 }
      );
    }

    const listing = JSON.parse(responseText);

    // ── Cover photo promotion ─────────────────────────────────────────────
    // Mirror Single Mode's hero-first sort: move the AI-chosen cover photo
    // to photos[0] so eBay always uses it as the main listing thumbnail.
    const coverIdx: number =
      typeof listing.cover_photo_index === "number" &&
      listing.cover_photo_index >= 0 &&
      listing.cover_photo_index < photos.length
        ? listing.cover_photo_index
        : 0;

    const orderedPhotos = [
      photos[coverIdx],
      ...photos.filter((_: string, i: number) => i !== coverIdx),
    ];

    listing.photos = orderedPhotos;
    // Strip internal field — client doesn't need it
    delete listing.cover_photo_index;

    return NextResponse.json(listing);
  } catch (err: any) {
    console.error("[generate-single] Unhandled error:", err.message);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
