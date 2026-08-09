import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import * as cheerio from "cheerio";

export const maxDuration = 60; 

export async function POST(req: NextRequest) {
  try {
    const { key_search_keywords, condition, isSportsCard } = await req.json();
    if (!key_search_keywords || !Array.isArray(key_search_keywords) || key_search_keywords.length === 0) {
      return NextResponse.json({ error: "Keywords required" }, { status: 400 });
    }

    let queryStr = key_search_keywords.join(" ");
    if (isSportsCard) {
      queryStr += " -reprint -rp -copy -digital -facsimile -proxy";
    }

    const query = encodeURIComponent(queryStr);
    const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;

    let prices: number[] = [];

    if (SCRAPER_API_KEY) {
      try {
        const targetUrl = `https://www.ebay.com/sch/i.html?_nkw=${query}&LH_Sold=1&LH_Complete=1&LH_BIN=1&_ipg=50`;
        const proxyUrl = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(targetUrl)}&render=false`;

        const res = await axios.get(proxyUrl, { timeout: 30000 });
        const $ = cheerio.load(res.data);

        $('.s-item__wrapper').each((_, el) => {
          const priceText = $(el).find('.s-item__price').text().replace(/[^\d.]/g, '');
          const shippingText = $(el).find('.s-item__shipping').text().replace(/[^\d.]/g, '');
          
          const price = parseFloat(priceText);
          const shipping = parseFloat(shippingText) || 0;

          if (!isNaN(price) && price > 0) {
            prices.push(price + shipping);
          }
        });
      } catch (err: any) {
        console.error("ScraperAPI Error:", err.message);
      }
    }

    if (prices.length === 0) {
      return NextResponse.json({
        suggestedPrice: condition?.toLowerCase().includes('new') ? "29.99" : "19.99",
        lowPrice: "9.99",
        highPrice: "29.99",
        compCount: 0,
        warning: isSportsCard ? "Filtered out reprints/copies" : null,
        rationale: "No direct sold matches found. Using default estimate."
      });
    }

    const sorted = prices.sort((a, b) => a - b);
    const trimStart = Math.ceil(sorted.length * 0.1);
    const trimEnd = Math.floor(sorted.length * 0.9);
    const trimmed = sorted.length >= 5 ? sorted.slice(trimStart, trimEnd) : sorted;
    
    const average = trimmed.reduce((a, b) => a + b, 0) / (trimmed.length || 1);

    return NextResponse.json({
      suggestedPrice: average.toFixed(2),
      lowPrice: sorted[0].toFixed(2),
      highPrice: sorted[sorted.length - 1].toFixed(2),
      compCount: prices.length,
      warning: isSportsCard ? "Filtered out reprints/copies" : null,
      rationale: `Calculated 'All-In' price (Price + Shipping) from ${prices.length} solds.`
    });

  } catch (error: any) {
    console.error("Comps Error:", error.message);
    return NextResponse.json({ error: "Comps failed" }, { status: 500 });
  }
}
