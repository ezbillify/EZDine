import { supabase } from "./supabaseClient";

type BootstrapPayload = {
  restaurant_name: string;
  branch_name: string;
  city?: string | null;
  state?: string | null;
};

export async function bootstrapRestaurant(payload: BootstrapPayload) {
  const { data, error } = await supabase.rpc("bootstrap_restaurant", payload);
  if (error) {
    throw error;
  }
  return data as { restaurant_id: string; branch_id: string }[];
}
