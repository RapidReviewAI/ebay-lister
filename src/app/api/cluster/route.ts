import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type, Schema } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 5-minute window — clustering many images can still take time.
export const maxDuration = 300;

/** Shape returned to the client: an ordered list of clusters, each holding
 *  the 0-based indices of photos that belong to that item. */
const clusterSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    clusters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          photo_indices: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
          },
        },
        required: ["photo_indices"],
      },
    },
  },
  required: ["clusters"],
};

const SYSTEM_INSTRUCTION = `
You are a visual clustering AI for a resale listing tool.
You will receive a numbered sequence of product photos.
Your ONLY job is to group the photo index numbers into clusters, where each
cluster represents ONE distinct physical item (e.g. front/back/tag of the
same shirt form one cluster; a different shirt's photos form another cluster).

Rules:
- EVERY photo index must appear in exactly ONE cluster.
- Preserve the natural order: consecutive photos of the same item belong together.
- Do NOT generate titles, prices, or descriptions — only cluster the indices.
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
      inlineData: {
        data,
        mimeType: header.split(":")[1].split(";")[0],
      },
    };
  }
  // Plain base64 fallback
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

    const { images } = await req.json();

    if (!Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: "No images provided." }, { status: 400 });
    }
    if (images.length > 30) {
      return NextResponse.json(
        { error: "Batch size limit is 30 images per request." },
        { status: 400 }
      );
    }

    // Build inline-data parts for every image
    const imageParts = await Promise.all(images.map(imageUrlToInlineData));

    const parts: any[] = [
      {
        text:
          `There are ${images.length} photos below, indexed 0 to ${images.length - 1}. ` +
          "Cluster them into distinct items.",
      },
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
              responseSchema: clusterSchema,
            },
          });
          if (res.text) {
            responseText = res.text;
            break;
          }
        } catch (err: any) {
          console.error(`[cluster] ${model} attempt ${attempt + 1}:`, err.message);
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

    const { clusters } = JSON.parse(responseText);
    return NextResponse.json({ clusters });
  } catch (err: any) {
    console.error("[cluster] Unhandled error:", err.message);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
