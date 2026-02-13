export type Role = "owner" | "manager" | "cashier" | "waiter" | "kitchen";

export type OrderStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "served"
  | "cancelled";

export type GstRate = 5 | 12 | 18;

export type PaymentMode =
  | "cash"
  | "card"
  | "upi"
  | "wallet"
  | "split";

export interface TenantRef {
  restaurantId: string;
  branchId: string;
}
