import { supabase } from "./supabaseClient";
import type { Branch, Restaurant, UserProfile } from "./supabaseTypes";

let cachedProfile: UserProfile | null = null;
let profileCacheTime = 0;
const CACHE_DURATION = 30000; // 30 seconds

const PROFILE_DISK_CACHE_KEY = 'ezdine_user_profile';

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const now = Date.now();

  // 1. Memory Cache
  if (cachedProfile && (now - profileCacheTime < CACHE_DURATION)) {
    return cachedProfile;
  }

  // 2. Disk Cache (LocalStorage)
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(PROFILE_DISK_CACHE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Only use disk cache if memory cache is empty
        if (!cachedProfile) {
          cachedProfile = parsed;
          profileCacheTime = now - (CACHE_DURATION / 2); // Set it half-expired to trigger background refresh
        }
      }
    } catch (e) {
      console.warn('Failed to read profile from disk cache:', e);
    }
  }

  // 3. Network Fetch
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return cachedProfile; // Return cached even if fetch fails to keep app usable
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userData.user.id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    return cachedProfile; // Return cached if network fails
  }

  cachedProfile = data as UserProfile;
  profileCacheTime = now;

  // Update Disk Cache
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(PROFILE_DISK_CACHE_KEY, JSON.stringify(cachedProfile));
    } catch (e) {
      console.warn('Failed to save profile to disk cache:', e);
    }
  }

  return cachedProfile;
}

export async function setActiveBranch(branchId: string): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error("Not authenticated");
  }

  // Use upsert to ensure profile exists
  const { error } = await supabase
    .from("user_profiles")
    .upsert({
      id: userData.user.id,
      active_branch_id: branchId,
      full_name: userData.user.user_metadata?.full_name,
      phone: userData.user.user_metadata?.phone,
    }, { onConflict: "id" });

  if (error) {
    throw error;
  }
}

export async function setActiveRestaurant(restaurantId: string): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error("Not authenticated");
  }

  // Use upsert to ensure profile exists
  const { error } = await supabase
    .from("user_profiles")
    .upsert({
      id: userData.user.id,
      active_restaurant_id: restaurantId,
      active_branch_id: null,
      full_name: userData.user.user_metadata?.full_name,
      phone: userData.user.user_metadata?.phone,
    }, { onConflict: "id" });

  if (error) {
    throw error;
  }
}

export async function getAccessibleRestaurants(): Promise<Restaurant[]> {
  const { data, error } = await supabase
    .from("restaurants")
    .select("id,name,logo,owner_user_id,legal_name,gst_number,phone,email,created_at,updated_at")
    .order("name");

  if (error) {
    throw error;
  }

  return (data ?? []) as Restaurant[];
}

export async function getActiveRestaurantRole() {
  const profile = await getCurrentUserProfile();
  if (!profile?.active_restaurant_id) return null;

  // Owner if restaurant.owner_user_id == current user
  const { data: ownerRow } = await supabase
    .from("restaurants")
    .select("owner_user_id")
    .eq("id", profile.active_restaurant_id)
    .maybeSingle();
  if (ownerRow?.owner_user_id === profile.id) {
    return "owner";
  }

  const { data, error } = await supabase
    .from("user_restaurant_roles")
    .select("role")
    .eq("restaurant_id", profile.active_restaurant_id)
    .single();

  if (error) {
    // fallback to legacy table
    const { data: legacy } = await supabase
      .from("user_restaurants")
      .select("role")
      .eq("restaurant_id", profile.active_restaurant_id)
      .single();
    return legacy?.role ?? null;
  }

  return data?.role ?? null;
}

export async function getActiveBranchRole() {
  const profile = await getCurrentUserProfile();
  if (!profile?.active_branch_id) return null;

  const { data, error } = await supabase
    .from("user_branch_roles")
    .select("role")
    .eq("branch_id", profile.active_branch_id)
    .single();

  if (error) {
    const { data: legacy } = await supabase
      .from("user_branches")
      .select("role")
      .eq("branch_id", profile.active_branch_id)
      .single();
    return legacy?.role ?? null;
  }

  return data?.role ?? null;
}

export async function getAccessibleBranches(restaurantId?: string): Promise<Branch[]> {
  let query = supabase.from("branches").select("*").eq("is_active", true);
  if (restaurantId) {
    query = query.eq("restaurant_id", restaurantId);
  }

  const { data, error } = await query.order("name");

  if (error) {
    throw error;
  }

  return (data ?? []) as Branch[];
}
