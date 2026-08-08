import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(
  process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || ""
);

export const maxDuration = 60;

const schema = {
  type: SchemaType.OBJECT,
  properties: {
    identified: { type: SchemaType.BOOLEAN },
    confidence_score: { type: SchemaType.NUMBER },
    title: { type: SchemaType.STRING },
    brand: { type: SchemaType.STRING },
    model_or_sku: { type: SchemaType.STRING },
    department: { type: SchemaType.STRING },
    size: { type: SchemaType.STRING },
    color: { type: SchemaType.STRING },
    sizeType: { type: SchemaType.STRING },
    weightOz: { type: SchemaType.STRING },
    condition: { type: SchemaType.STRING },
    condition_confidence: { type: SchemaType.STRING },
    category: { type: SchemaType.STRING },
    categoryId: { type: SchemaType.STRING },
    description: { type: SchemaType.STRING },
    key_search_keywords: { 
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING }
    },
    item_specifics: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          value: { type: SchemaType.STRING }
        }
      }
    },
    photo_roles: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING }
    },
    suggested_shipping_type: { type: SchemaType.STRING },
    estimated_weight_lbs: { type: SchemaType.NUMBER },
    estimated_package_type: { type: SchemaType.STRING },
    suggested_paid_by: { type: SchemaType.STRING },
    unidentifiable_reason: { type: SchemaType.STRING }
  },
  required: ["identified", "confidence_score", "title", "brand", "department", "size", "color", "sizeType", "weightOz", "model_or_sku", "condition", "condition_confidence", "categoryId", "description", "key_search_keywords", "item_specifics", "photo_roles", "suggested_shipping_type", "estimated_weight_lbs", "estimated_package_type", "suggested_paid_by", "unidentifiable_reason"]
};

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
      return NextResponse.json({ error: "GEMINI_API_KEY is missing in .env.local" }, { status: 401 });
    }

    const body = await req.json();
    const { images, deepInspection } = body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 });
    }

    const seoGuidelines = `
CRITICAL SEO & OUTPUT GUIDELINES:
1. Title (Max 80 chars): Use exact keyword order: [Brand] + [Gender/Age Group] + [Product/Model Name] + [Style/Type] + [Size] + [Color] + [Key Material/Feature] + [Condition]. Do NOT use filler words (L@@K, WOW, Nice, Cheap) or punctuation waste (dashes, commas). Use exact spellings for brands/models.
2. Item Specifics: Extensively populate mandatory/high-traffic specifics (Brand, Style, Size, Color, Department, Material, Pattern, Theme, Country). You MUST also output explicit top-level fields for apparel: 'department', 'size', 'color', 'sizeType', and 'weightOz' (default to "8" for t-shirts/small items).
3. Description: Generate structured, mobile-friendly HTML. Use clean sections: "Item Highlights & Specifications", "Exact Condition & Flaws", and "Measurements". Naturally incorporate secondary keywords into the first 200 words. Avoid heavy inline CSS.
4. Prohibited Keywords (CRITICAL): NEVER generate text containing: 'cbd', 'hemp', 'cannabis', 'vape', 'tobacco', 'replica', 'knockoff', 'counterfeit', 'fake', 'weapon', 'knife', 'blade', 'firearm', or 'ammo'. This triggers eBay Managed Payments restrictions (ErrorCode 240).
5. Photo Roles: You MUST provide an array called 'photo_roles' that corresponds exactly to the array of uploaded images, in the same order. For each image, assign one of these roles based on its visual content: 'hero' (full item, best lighting, main thumbnail), 'tag_label' (brand tag, size label, serial number), 'angle_detail' (alternate angles, inside, bottom), or 'flaw' (wear, damage, stains).
6. Strict Condition Rules: Return a standard eBay condition ID: '1000' (New), '1500' (New without tags), '3000' (Used-Excellent), '4000' (Used-Good), '5000' (Used-Acceptable), '7000' (For parts), or 'NEEDS_REVIEW'. NEVER default to '1000' or '1500' unless you clearly see retail tags or sealed original packaging. If there are any signs of wear, washing, open packaging, or ambiguity, default to '4000' (or 'NEEDS_REVIEW'). Also provide a 'condition_confidence' field of either 'high' or 'low'.
6. Shipping Estimates: Estimate item shipping characteristics based on the photos. Return 'suggested_shipping_type' (calculated, flat, free), 'estimated_weight_lbs' (number, e.g. 1.2), 'estimated_package_type' (e.g. USPS Ground Advantage, Priority Mail Box), and 'suggested_paid_by' (buyer, seller).
7. Category Enforcement: Always output the exact numeric eBay Leaf Category ID for the item in the 'categoryId' field (e.g., 260010 for Trading Cards, 183498 for Modern Comic Books, 139973 for Video Games, 246 for Action Figures, 15687 for Men's T-Shirts).`;

    const systemInstruction = deepInspection
      ? "You are an expert reseller item identifier. Examine up to 8 provided photos VERY CAREFULLY. Aggressively scan for fine print, hallmarks, serial numbers, coin mint marks, tag text, or subtle physical details across all uploaded photos. Extract item specifics into a structured array. If it is a generic or unbranded item, THAT IS FINE, still set 'identified' to true and list the brand as 'Unbranded'. Only set 'identified' to false if the image is completely obscured." + seoGuidelines
      : "You are an expert reseller item identifier. Examine up to 8 provided photos. Extract item specifics into a structured array. If it is a generic or unbranded item, THAT IS FINE, still set 'identified' to true and list the brand as 'Unbranded'. Only set 'identified' to false if the image is completely obscured or it's impossible to tell what the physical object is." + seoGuidelines;

    const parts = await Promise.all(images.map(async (imgStr: string) => {
      let data = imgStr;
      let mimeType = 'image/jpeg';
      
      if (imgStr.startsWith("http://") || imgStr.startsWith("https://")) {
        const response = await fetch(imgStr);
        const arrayBuffer = await response.arrayBuffer();
        data = Buffer.from(arrayBuffer).toString('base64');
        mimeType = response.headers.get("content-type") || "image/jpeg";
      } else if (imgStr.includes(',')) {
        const splitStr = imgStr.split(',');
        data = splitStr[1];
        mimeType = splitStr[0].split(':')[1].split(';')[0];
      }
      
      return {
        inlineData: {
          data,
          mimeType
        }
      };
    }));

    parts.push({
      text: systemInstruction + "\n\nPlease identify the item in the images."
    } as any);

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema as any,
      },
    });

    const responseText = result.response.text();
    const data = JSON.parse(responseText);
    return NextResponse.json(data);

  } catch (error: any) {
    console.error("Error in /api/identify:", error.message);
    return NextResponse.json({ error: error.message || "Failed to identify item" }, { status: 500 });
  }
}
