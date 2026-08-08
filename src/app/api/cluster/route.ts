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

/** Convert any supported image string to a Gemini inlineData part.
 *  Strips data-URI prefixes before passing raw base64 to the API. */
function imageToInlinePart(imgStr: string): object {
  if (imgStr.startsWith("http://") || imgStr.startsWith("https://")) {
    throw new Error("URL images must be handled via imageUrlToInlinePart");
  }

  let mimeType = "image/jpeg";
  if (imgStr.startsWith("data:")) {
    const commaIdx = imgStr.indexOf(",");
    if (commaIdx !== -1) {
      const header = imgStr.slice(0, commaIdx);
      mimeType = header.split(":")[1]?.split(";")[0] ?? "image/jpeg";
    }
  }

  const cleanBase64 = imgStr.replace(/^data:image\/\w+;base64,/, "");
  return { inlineData: { data: cleanBase64, mimeType } };
}

async function imageUrlToInlinePart(imgStr: string): Promise<object> {
  if (imgStr.startsWith("http://") || imgStr.startsWith("https://")) {
    const res  = await fetch(imgStr);
    const buf  = await res.arrayBuffer();
    return {
      inlineData: {
        data: Buffer.from(buf).toString("base64"),
        mimeType: res.headers.get("content-type") ?? "image/jpeg",
      },
    };
  }
  return imageToInlinePart(imgStr);
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

    // Build inline-data parts — strip any data-URI prefix before sending
    const imageParts = await Promise.all(images.map(imageUrlToInlinePart));

    const parts: any[] = [
      {
        text:
          `There are ${images.length} photos below, indexed 0 to ${images.length - 1}. ` +
          "Cluster them into distinct items.",
      },
      ...imageParts,
    ];

    // Single model — strictly use gemini-1.5-flash with no retry/fallback chain
    const res = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: parts,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: clusterSchema,
      },
    });

    if (!res.text) {
      return NextResponse.json(
        { error: "Model returned an empty response." },
        { status: 502 }
      );
    }

    const { clusters } = JSON.parse(res.text);

    // Process clusters to guarantee internal sorting (preserving natural upload sequence/front cover)
    // and sort the clusters list chronologically based on their first appearance.
    const processedClusters = clusters
      .map((c: any) => ({
        ...c,
        photo_indices: Array.isArray(c.photo_indices)
          ? [...c.photo_indices].sort((a: number, b: number) => a - b)
          : [],
      }))
      .sort((a: any, b: any) => {
        const aMin = a.photo_indices[0] ?? 0;
        const bMin = b.photo_indices[0] ?? 0;
        return aMin - bMin;
      });

    return NextResponse.json({ clusters: processedClusters });

  } catch (error) {
    // Output directly to console.error so Vercel captures raw exception logs
    console.error("[cluster error]:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
