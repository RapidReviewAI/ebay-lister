import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type, Schema } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const maxDuration = 60;

const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    description: { type: Type.STRING }
  },
  required: ["description"]
};

export async function POST(req: NextRequest) {
  try {
    const { title, condition, item_specifics } = await req.json();

    const systemInstruction = "You are an expert reseller item descriptor. Write a highly engaging, professional, and accurate eBay description for the item. Be concise but highlight the item's appeal. Generate clean, structured HTML output suitable for dangerouslySetInnerHTML. Use semantic tags like <p>, <strong>, <ul>, and <li>. Do not use markdown wrappers.";
    
    const prompt = `Write a description for this item:
Title: ${title}
Condition: ${condition}
Item Specifics: ${JSON.stringify(item_specifics)}`;

    let responseText = null;
    const MODELS = ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-3.1-pro"];
    
    for (const model of MODELS) {
      try {
        const response = await ai.models.generateContent({
          model: model,
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: schema,
          }
        });
        
        if (response.text) {
          responseText = response.text;
          break;
        }
      } catch (err: any) {
        console.error(`Error with ${model}:`, err.message);
      }
    }

    if (!responseText) {
      throw new Error("All models failed to generate a response");
    }

    try {
      const data = JSON.parse(responseText);
      return NextResponse.json(data);
    } catch (parseError) {
      console.error("JSON parse error:", parseError, responseText);
      return NextResponse.json({ error: "Failed to parse description response" }, { status: 500 });
    }
  } catch (error: any) {
    console.error("Error in /api/description:", error);
    return NextResponse.json({ error: error.message || "Failed to generate description" }, { status: 500 });
  }
}
