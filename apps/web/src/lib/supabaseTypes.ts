export type Restaurant = {
  id: string;
  name: string;
  logo: string | null;
  owner_user_id: string | null;
  legal_name: string | null;
  gst_number: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
  updated_at?: string;
};

export type Branch = {
  id: string;
  restaurant_id: string;
  name: string;
  code: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  phone: string | null;
  is_active: boolean;
  razorpay_key: string | null;
  razorpay_secret: string | null;
  razorpay_enabled: boolean;
  created_at: string;
};

export type UserProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email?: string | null;
  is_active: boolean;
  active_restaurant_id: string | null;
  active_branch_id: string | null;
  created_at: string;
};
