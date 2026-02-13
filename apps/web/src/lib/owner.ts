import { supabase } from "./supabaseClient";

export async function createRestaurant(input: {
  name: string;
  logo?: string | null;
}) {
  const { data, error } = await supabase.rpc("create_restaurant_with_owner", {
    restaurant_name: input.name,
    logo_url: input.logo ?? null
  });

  if (error) throw error;
  return data;
}

export async function updateRestaurant(id: string, input: { name: string; logo?: string | null }) {
  const { data, error } = await supabase
    .from("restaurants")
    .update({ name: input.name, logo: input.logo ?? null })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteRestaurant(id: string) {
  const { error } = await supabase.from("restaurants").delete().eq("id", id);
  if (error) throw error;
}

export async function createBranch(input: {
  restaurant_id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  code?: string | null;
}) {
  const { data, error } = await supabase
    .from("branches")
    .insert({
      restaurant_id: input.restaurant_id,
      name: input.name,
      address: input.address ?? null,
      phone: input.phone ?? null,
      code: input.code ?? null
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function updateBranch(
  id: string,
  input: { name: string; address?: string | null; phone?: string | null }
) {
  const { data, error } = await supabase
    .from("branches")
    .update({ name: input.name, address: input.address ?? null, phone: input.phone ?? null })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteBranch(id: string) {
  const { error } = await supabase.from("branches").delete().eq("id", id);
  if (error) throw error;
}

export async function findUserByEmail(email: string) {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, email, full_name")
    .eq("email", email)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function sendOtpInvite(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true }
  });
  if (error) throw error;
}

export async function assignRestaurantRole(input: {
  user_id: string;
  restaurant_id: string;
  role: "owner" | "manager" | "viewer";
}) {
  const { error } = await supabase
    .from("user_restaurant_roles")
    .upsert({
      user_id: input.user_id,
      restaurant_id: input.restaurant_id,
      role: input.role
    });

  if (error) throw error;
}

export async function assignBranchRole(input: {
  user_id: string;
  branch_id: string;
  role: "cashier" | "waiter" | "kitchen" | "manager";
}) {
  const { error } = await supabase
    .from("user_branch_roles")
    .upsert({
      user_id: input.user_id,
      branch_id: input.branch_id,
      role: input.role
    });

  if (error) throw error;
}

export async function transferRestaurantOwnership(input: {
  restaurant_id: string;
  new_owner_user_id: string;
}) {
  const { error } = await supabase.rpc("transfer_restaurant_owner", {
    restaurant_id: input.restaurant_id,
    new_owner_user_id: input.new_owner_user_id
  });

  if (error) throw error;
}
