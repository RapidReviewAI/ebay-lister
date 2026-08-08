import { MasterItem, Profile } from "../../types/inventory";
import { sanitizeEbayText } from "../sanitize";

export function generateEbayCSV(items: MasterItem[], userProfile: Profile): string {
  const headers = [
    "Action(SiteID=US|Country=US|Currency=USD|Version=1193|CC=UTF-8)",
    "Category",
    "Title",
    "Description",
    "ConditionID",
    "PicURL",
    "Quantity",
    "Format",
    "StartPrice",
    "BuyItNowPrice",
    "Duration",
    "Location",
    "PostalCode",
    "ShippingProfileID",
    "ReturnProfileID",
    "PaymentProfileID",
    "WeightMajor",
    "WeightMinor",
    "WeightUnit",
    "C:Brand",
    "C:Department",
    "C:Size",
    "C:Color",
    "C:Size Type"
  ];

  const formatPrice = (val: any): string => {
    const cleaned = String(val ?? '').replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) || num <= 0 ? "19.99" : num.toFixed(2);
  };

  const getNumericProfileID = (val: string | undefined | null, fallback: string): string => {
    if (!val) return fallback;
    const clean = val.trim();
    if (/^\d+$/.test(clean)) return clean;
    const digits = clean.replace(/\D/g, '');
    if (digits.length > 0) return digits;
    return fallback;
  };

  const cleanCell = (val: any) => `"${String(val ?? '').replace(/[\r\n]+/g, ' ').replace(/"/g, '""')}"`;

  const rows = items.map((item) => {
    const validImages = (item.photos || []).filter((img) => typeof img === 'string' && img.trim().length > 0);
    const validPublicUrls = validImages
      .filter(url => url.startsWith("http://") || url.startsWith("https://"))
      .map(url => url.replace(/[,;]/g, '|'));

    const categoryId = String(item.categoryId || '260010').replace(/[^0-9]/g, '');

    return [
      "Add",
      categoryId,
      sanitizeEbayText(item.title || "", true),
      sanitizeEbayText(item.description || ""),
      item.condition || "3000", // ConditionID
      validPublicUrls.join("|"),
      "1", // Quantity
      "FixedPrice", // Format
      formatPrice(item.price), // StartPrice
      "", // BuyItNowPrice
      "GTC", // Duration
      "United States", // Location
      userProfile.default_postal_code || "49286", // PostalCode
      getNumericProfileID(userProfile.default_shipping_profile, "158932641011"), // ShippingProfileID
      getNumericProfileID(userProfile.default_return_policy, "158932641012"), // ReturnProfileID
      getNumericProfileID(userProfile.default_payment_policy, "158932641013"), // PaymentProfileID
      "0", // WeightMajor
      String(item.weightOz || "8"), // WeightMinor
      "oz", // WeightUnit
      item.brand || "Unbranded", // C:Brand
      item.department || "Men", // C:Department
      item.size || "L", // C:Size
      item.color || "Black", // C:Color
      item.sizeType || "Regular" // C:Size Type
    ].map(cleanCell).join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}
