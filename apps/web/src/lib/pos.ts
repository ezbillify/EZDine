import { supabase } from "./supabaseClient";
import { getCurrentUserProfile } from "./tenant";

export type CartItem = {
  item_id: string;
  name: string;
  qty: number;
  price: number;
  notes?: string;
};

export async function getContext() {
  const profile = await getCurrentUserProfile();
  if (!profile?.active_restaurant_id || !profile.active_branch_id) {
    throw new Error("Select restaurant and branch first.");
  }
  return {
    restaurantId: profile.active_restaurant_id,
    branchId: profile.active_branch_id
  };
}

export async function getMenuItems() {
  const { branchId } = await getContext();
  return getPublicBranchMenu(branchId);
}

export async function getPublicBranchMenu(branchId: string) {
  const { data, error } = await supabase
    .from("menu_items")
    .select("id,name,description,base_price,gst_rate,is_veg,category_id,is_available, menu_categories(name)")
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return data ?? [];
}

export async function getPublicBranchDetails(branchId: string) {
  const { data, error } = await supabase
    .from("branches")
    .select("id, name, restaurant_id, razorpay_key, razorpay_enabled, restaurant:restaurants(name, logo, razorpay_key, razorpay_enabled)")
    .eq("id", branchId)
    .single();

  if (error) throw error;

  // Merge logic: Branch overrides Restaurant
  const restaurant = Array.isArray(data.restaurant) ? data.restaurant[0] : data.restaurant;
  const effectiveKey = data.razorpay_key || restaurant?.razorpay_key;
  const effectiveEnabled = data.razorpay_enabled || restaurant?.razorpay_enabled;

  return {
    ...data,
    razorpay_key: effectiveKey,
    razorpay_enabled: effectiveEnabled
  };
}

export async function getMenuCategories(branchId?: string) {
  // If branchId is provided, we might want to filter categories that have items in this branch.
  // For now, let's just fetch all categories as they are restaurant-level usually, 
  // but we filter by the restaurant of the branch.

  // First get restaurant_id for this branch
  const { data: branch } = await supabase.from("branches").select("restaurant_id").eq("id", branchId).single();
  if (!branch) return [];

  const { data, error } = await supabase
    .from("menu_categories")
    .select("id, name")
    .eq("restaurant_id", branch.restaurant_id)
    .order("name");

  if (error) throw error;
  return data ?? [];
}

export async function getTables(pBranchId?: string) {
  let finalBranchId = pBranchId;
  if (!finalBranchId) {
    const context = await getContext();
    finalBranchId = context.branchId;
  }

  const { data, error } = await supabase
    .from("tables")
    .select("id,name,capacity")
    .eq("branch_id", finalBranchId)
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function getOpenOrderForTable(tableId: string) {
  const { branchId } = await getContext();
  const { data, error } = await supabase
    .from("orders")
    .select("id,order_number,token_number,status,customer_id, customer:customers(name)")
    .eq("branch_id", branchId)
    .eq("table_id", tableId)
    .eq("is_open", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error) throw error;
  return data ?? null;
}

export async function getOrderItems(orderId: string) {
  const { data, error } = await supabase
    .from("order_items")
    .select("id,item_id,quantity,price,notes,status")
    .eq("order_id", orderId);
  if (error) throw error;
  return data ?? [];
}

export async function createOrder(
  tableId: string | null,
  items: CartItem[],
  notes?: string,
  customerId?: string | null,
  source: 'pos' | 'table' | 'qr' = 'pos',
  paymentStatus: 'pending' | 'paid' | 'counter_pending' = 'pending',
  explicitBranchId?: string,
  explicitRestaurantId?: string,
  paymentMethod: string = 'cash',
  orderType: 'dine_in' | 'takeaway' = 'dine_in'
) {
  let restaurantId = explicitRestaurantId;
  let branchId = explicitBranchId;

  if (!restaurantId || !branchId) {
    const context = await getContext();
    restaurantId = context.restaurantId;
    branchId = context.branchId;
  }

  // 1. Generate Order Number
  const { data: orderNumberData, error: orderNumberError } = await supabase.rpc(
    "next_doc_number",
    { p_branch_id: branchId, p_doc_type: "order" }
  );
  if (orderNumberError) throw orderNumberError;

  // 2. Generate Token Number (New logic)
  const { data: tokenData, error: tokenError } = await supabase.rpc(
    "next_token_number",
    { p_branch_id: branchId }
  );
  if (tokenError) {
    console.error("Token generation failed", tokenError);
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      restaurant_id: restaurantId,
      branch_id: branchId,
      table_id: tableId,
      customer_id: customerId ?? null,
      status: "pending",
      notes: notes ?? null,
      order_number: orderNumberData,
      token_number: tokenData,
      source: source,
      payment_status: paymentStatus,
      payment_method: paymentMethod,
      order_type: orderType,
      is_open: true
    })
    .select("id, order_number, token_number")
    .single();

  if (orderError) throw orderError;
  if (!order) throw new Error("Order create failed");

  if (items.length > 0) {
    const orderItems = items.map((item) => ({
      order_id: order.id,
      item_id: item.item_id,
      quantity: item.qty,
      price: item.price,
      notes: item.notes ?? null,
      status: "pending"
    }));

    const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
    if (itemsError) throw itemsError;
  }

  return {
    id: order.id as string,
    order_number: order.order_number as string,
    token_number: order.token_number as number
  };
}

export async function appendOrderItems(orderId: string, items: CartItem[]) {
  if (items.length === 0) return;
  const orderItems = items.map((item) => ({
    order_id: orderId,
    item_id: item.item_id,
    quantity: item.qty,
    price: item.price,
    notes: item.notes ?? null,
    status: "pending"
  }));

  const { error } = await supabase.from("order_items").insert(orderItems);
  if (error) throw error;
}

export async function createBill(orderId: string, items: CartItem[]) {
  const { restaurantId, branchId } = await getContext();
  const { data: billNumberData, error: billNumberError } = await supabase.rpc(
    "next_doc_number",
    { p_branch_id: branchId, p_doc_type: "bill" }
  );
  if (billNumberError) throw billNumberError;
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const tax = 0;
  const total = subtotal + tax;

  const { data: bill, error } = await supabase
    .from("bills")
    .insert({
      restaurant_id: restaurantId,
      branch_id: branchId,
      order_id: orderId,
      subtotal,
      discount: 0,
      tax,
      total,
      status: "open",
      bill_number: billNumberData
    })
    .select("id, bill_number")
    .single();

  if (error) throw error;
  return { id: bill?.id as string, bill_number: bill?.bill_number as string };
}

export async function addPayment(billId: string, mode: string, amount: number) {
  const { error } = await supabase
    .from("payments")
    .insert({ bill_id: billId, mode, amount });
  if (error) throw error;

  await supabase.from("bills").update({ status: "paid" }).eq("id", billId);
}

export async function closeOrder(orderId: string) {
  await supabase.from("orders").update({ is_open: false, status: "served" }).eq("id", orderId);
}

export async function getOrders() {
  const { branchId } = await getContext();
  const { data, error } = await supabase
    .from("orders")
    .select("id,order_number,status,table_id,created_at")
    .eq("branch_id", branchId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getPendingQrOrders() {
  const { branchId } = await getContext();
  const { data, error } = await supabase
    .from("orders")
    .select("*, customer:customers(name)")
    .eq("branch_id", branchId)
    .eq("is_open", true)
    .in("source", ["qr", "table"])
    .in("payment_status", ["counter_pending", "paid"])
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function updateOrderItemsStatus(orderId: string, status: string) {
  const { error } = await supabase
    .from("order_items")
    .update({ status })
    .eq("order_id", orderId);
  if (error) throw error;
}

export async function toggleItemAvailability(itemId: string, isAvailable: boolean) {
  const { error } = await supabase
    .from("menu_items")
    .update({ is_available: isAvailable })
    .eq("id", itemId);
  if (error) throw error;
}

export async function checkCustomerExist(restaurantId: string, phone: string) {
  const { data, error } = await supabase
    .from("customers")
    .select("id, name")
    .eq("restaurant_id", restaurantId)
    .eq("phone", phone)
    .single();

  if (error && error.code !== "PGRST116") throw error; // PGRST116 is "no rows found"
  return data;
}

export async function createPublicCustomer(restaurantId: string, name: string, phone: string) {
  const { data, error } = await supabase
    .from("customers")
    .insert({
      restaurant_id: restaurantId,
      name: name,
      phone: phone
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
export async function getSettledBills() {
  const { branchId } = await getContext();
  const { data, error } = await supabase
    .from("bills")
    .select("*, order:orders(order_number, token_number, customer:customers(name))")
    .eq("branch_id", branchId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data;
}

export async function saveRazorpaySettings(branchId: string, settings: { key: string; secret: string; enabled: boolean }) {
  const { error } = await supabase
    .from("branches")
    .update({
      razorpay_key: settings.key,
      razorpay_secret: settings.secret,
      razorpay_enabled: settings.enabled
    })
    .eq("id", branchId);

  if (error) throw error;
  return true;
}

export async function verifyPayment(orderId: string, paymentId: string, signature: string) {
  // Use Edge Function
  const { data, error } = await supabase.functions.invoke('payment-verification', {
    body: { orderId, paymentId, signature }
  });

  if (error) throw error;
  return data;
}
