import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { images } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });
    }

    // Direct REST API Call using active gemini-1.5-flash
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const formattedImages = await Promise.all(
      images.map(async (imgStr: string) => {
        let data = imgStr;
        let mimeType = "image/jpeg";

        if (imgStr.startsWith("http://") || imgStr.startsWith("https://")) {
          const res = await fetch(imgStr);
          const buf = await res.arrayBuffer();
          data = Buffer.from(buf).toString("base64");
          mimeType = res.headers.get("content-type") || "image/jpeg";
        } else {
          data = imgStr.replace(/^data:image\/\w+;base64,/, "");
          if (imgStr.startsWith("data:")) {
            const commaIdx = imgStr.indexOf(",");
            if (commaIdx !== -1) {
              const header = imgStr.slice(0, commaIdx);
              mimeType = header.split(":")[1]?.split(";")[0] ?? "image/jpeg";
            }
          }
        }

        return {
          inline_data: {
            mime_type: mimeType,
            data,
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
