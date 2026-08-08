export function sanitizeEbayText(text: string, isTitle: boolean = false): string {
  if (!text) return "";
  
  const PROHIBITED_WORDS = [
    /free shipping/gi, /guaranteed/gi,
    /cbd/gi, /hemp/gi, /cannabis/gi, /vape/gi, /tobacco/gi,
    /replica/gi, /knockoff/gi, /counterfeit/gi, /fake/gi,
    /weapon/gi, /knife/gi, /blade/gi, /firearm/gi, /ammo/gi
  ];

  let cleaned = text;
  PROHIBITED_WORDS.forEach((pattern) => {
    cleaned = cleaned.replace(pattern, "");
  });

  cleaned = cleaned.replace(/\s+/g, " ").trim();

  if (isTitle && cleaned.length > 80) {
    cleaned = cleaned.substring(0, 80);
  }
  
  return cleaned;
}
