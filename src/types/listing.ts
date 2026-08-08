export type PhotoRole = "hero" | "tag_label" | "angle_detail" | "flaw" | "";

export type PricingStrategy = "MAX_PROFIT" | "MARKET" | "QUICK_SALE";

export interface ItemSpecific {
  name: string;
  value: string;
}

export interface Identification {
  title?: string;
  price?: string;
  condition?: string;
  brand?: string;
  department?: string;
  size?: string;
  color?: string;
  sizeType?: string;
  weightOz?: number | string;
  category?: string;
  categoryId?: string;
  description?: string;
  identified?: boolean;
  unidentifiable_reason?: string;
  conditionNeedsAttention?: boolean;
  condition_confidence?: string;
  item_specifics?: ItemSpecific[];
  photo_roles?: PhotoRole[];
  suggested_shipping_type?: string;
  suggested_paid_by?: string;
  estimated_weight_lbs?: number;
  key_search_keywords?: string[];
  confidence_score?: number;
}

export interface CompsData {
  suggestedPrice: string;
  lowPrice: string;
  highPrice: string;
  estimatedDaysToSell: number;
  rationale: string;
  platformBreakdown?: {
    platform: string;
    averagePrice: string;
    sampleCount: number;
  }[];
  vendorLink?: {
    title: string;
    url: string;
  };
  sources?: {
    title: string;
    url: string;
    platform: string;
    price: string;
  }[];
}
