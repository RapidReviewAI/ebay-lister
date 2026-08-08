import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import * as cheerio from "cheerio";

export const maxDuration = 60; 

export async function POST(req: NextRequest) {
  try {
    const { key_search_keywords, condition } = await req.json();
    if (!key_search_keywords || !Array.isArray(key_search_keywords) || key_search_keywords.length === 0) {
      return NextResponse.json({ error: "Keywords required" }, { status: 400 });
    }

    const query = encodeURIComponent(`${key_search_keywords.join(" ")} ${condition || ""}`);
    const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;

    let parsedItems: number[] = [];

    if (SCRAPER_API_KEY) {
      try {
        // Direct eBay search targeting fixed-price Buy It Now listings
        const targetUrl = `https://www.ebay.com/sch/i.html?_nkw=${query}&_ipg=25&rt=nc&LH_BIN=1`;
        const proxyUrl = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(targetUrl)}&render=false`;

        const res = await axios.get(proxyUrl, { timeout: 30000 });
        const $ = cheerio.load(res.data);

        $('.s-item__price').each((_, el) => {
          const priceText = $(el).text().replace(/[^\d.]/g, '');
          const price = parseFloat(priceText);
          if (!isNaN(price) && price > 0) {
            parsedItems.push(price);
          }
        });
      } catch (err: any) {
        console.error("ScraperAPI Error:", err.message);
      }
    }

    if (parsedItems.length === 0) {
      return NextResponse.json({
        suggestedPrice: condition?.toLowerCase().includes('new') ? "29.99" : "19.99",
        lowPrice: "9.99",
        highPrice: "29.99",
        compCount: 0,
        rationale: "No direct matches found. Using default estimate."
      });
    }

    const prices = parsedItems.sort((a, b) => a - b);
    const median = prices[Math.floor(prices.length / 2)];

    return NextResponse.json({
      suggestedPrice: median.toFixed(2),
      lowPrice: prices[0].toFixed(2),
      highPrice: prices[prices.length - 1].toFixed(2),
      compCount: prices.length,
      estimatedDaysToSell: Math.max(5, 45 - prices.length)
    });

  } catch (error: any) {
    console.error("Scraper Error:", error.message);
    return NextResponse.json({ error: "Failed to fetch market data" }, { status: 500 });
  }
}
