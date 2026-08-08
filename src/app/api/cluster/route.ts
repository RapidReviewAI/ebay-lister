import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { images } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });
    }

    // Direct REST API call strictly targeting active gemini-2.0-flash
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    // Convert Cloudinary image URLs to raw Base64 buffers on the server
    const formattedImages = await Promise.all(
      images.map(async (img: string) => {
        let base64Data = img;

        if (img.startsWith("http://") || img.startsWith("https://")) {
          const res = await fetch(img);
          const arrayBuffer = await res.arrayBuffer();
          base64Data = Buffer.from(arrayBuffer).toString("base64");
        } else {
          base64Data = base64Data.replace(/^data:image\/\w+;base64,/, "");
        }

        return {
          inline_data: {
            mime_type: "image/jpeg",
            data: base64Data,
          },
        };
      })
    );

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: "Cluster these photos into distinct individual items for eBay listings. Return JSON." },
              ...formattedImages,
            ],
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[cluster REST error]:", data);
      return NextResponse.json({ error: data.error?.message || "Gemini REST API Error" }, { status: response.status });
    }

    const responseText = data.candidates?.[0]?.content?.[0]?.text || data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return NextResponse.json({ success: true, data: responseText });

  } catch (error: any) {
    console.error("[cluster error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
