export interface MasterItem {
  id: string;
  title: string;
  description: string;
  price: string;
  category: string;
  categoryId: string;
  condition: string;
  photos: string[];
  brand?: string;
  size?: string;
  color?: string;
  department?: string;
  weightOz?: string;
  sizeType?: string;
}

export interface Profile {
  id: string;
  user_id: string;
  default_postal_code?: string;
  default_shipping_profile?: string;
  default_return_policy?: string;
  default_handling_time?: string;
  default_payment_policy?: string;
  ai_credits_used: number;
  updated_at: string;
}
