import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    const isMockMode = !process.env.EBAY_CLIENT_ID || process.env.EBAY_CLIENT_ID.trim() === "";

    if (isMockMode) {
      console.log("=== MOCK EBAY PUBLISH ===");
      console.log("Payload:", JSON.stringify(payload, null, 2));
      console.log("=========================");

      // Simulate network latency
      await new Promise(resolve => setTimeout(resolve, 1500));

      return NextResponse.json({
        success: true,
        listingId: "MOCK-EBAY-123456",
        itemUrl: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(payload.title || "")}`,
        message: "Mock listing created successfully!"
      });
    }

    // TODO: Implement actual eBay API logic here when keys arrive
    return NextResponse.json({ error: "Real eBay API integration not yet implemented." }, { status: 501 });

  } catch (error: any) {
    console.error("Error in /api/ebay/publish:", error);
    return NextResponse.json({ error: "Failed to publish listing" }, { status: 500 });
  }
}
