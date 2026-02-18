import { supabase } from "./supabaseClient";
import { getCurrentUserProfile } from "./tenant";

export type PrintLine = {
  text: string;
  align?: "left" | "center" | "right";
  bold?: boolean;
};

export type PrintJob = {
  printerId: string;
  width: 58 | 80;
  type: "kot" | "invoice" | "token";
  lines: PrintLine[];
};

const PRINTING_KEY = "printing";
const DOC_NUMBERING_KEY = "doc_numbering";

export async function getPrintingSettings() {
  const profile = await getCurrentUserProfile();
  if (!profile?.active_restaurant_id || !profile.active_branch_id) {
    throw new Error("Select restaurant and branch first.");
  }

  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("restaurant_id", profile.active_restaurant_id)
    .eq("branch_id", profile.active_branch_id)
    .eq("key", PRINTING_KEY)
    .maybeSingle();

  if (error) throw error;
  return data?.value ?? null;
}

export async function savePrintingSettings(value: any) {
  const profile = await getCurrentUserProfile();
  if (!profile?.active_restaurant_id || !profile.active_branch_id) {
    throw new Error("Select restaurant and branch first.");
  }

  const { error } = await supabase.from("settings").upsert({
    restaurant_id: profile.active_restaurant_id,
    branch_id: profile.active_branch_id,
    key: PRINTING_KEY,
    value
  });

  if (error) throw error;
}

export async function getDocNumberingSettings(restaurantId: string, branchId: string | null) {
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("branch_id", branchId)
    .eq("key", DOC_NUMBERING_KEY)
    .maybeSingle();

  if (error) throw error;
  return data?.value ?? null;
}

export async function saveDocNumberingSettings(
  restaurantId: string,
  branchId: string | null,
  value: any
) {
  const { error } = await supabase.from("settings").upsert({
    restaurant_id: restaurantId,
    branch_id: branchId,
    key: DOC_NUMBERING_KEY,
    value
  });
  if (error) throw error;
}

export async function sendPrintJob(job: PrintJob) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_PRINT_SERVER_URL;
    if (!baseUrl) {
      console.warn("Printing skipped: NEXT_PUBLIC_PRINT_SERVER_URL not configured");
      return false;
    }

    const response = await fetch(`${baseUrl}/print`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(job)
    });

    if (!response.ok) {
      console.warn("Print server responded with error", await response.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("Critical print job failure:", err);
    return false;
  }
}

export function buildKotLines(input: {
  restaurantName: string;
  branchName: string;
  tableName?: string | null;
  orderId: string;
  tokenNumber?: string | null;
  items: { name: string; qty: number; notes?: string | null }[];
}) {
  // Determine separator length based on generic width assumption (will be refined by printer driver usually, but good for preview)
  const separator = "--------------------------------"; // 32 chars for 58mm usually, 48 for 80mm

  const lines: PrintLine[] = [
    { text: input.restaurantName, align: "center", bold: true },
    { text: `Branch: ${input.branchName}`, align: "center" },
    { text: separator, align: "center" as const },
  ];

  if (input.tokenNumber) {
    lines.push({ text: `TOKEN: ${input.tokenNumber}`, align: "center" as const, bold: true });
    lines.push({ text: separator, align: "center" as const });
  }

  lines.push({ text: "KITCHEN ORDER TICKET", align: "center" as const, bold: true });
  lines.push({ text: `Order: ${input.orderId.slice(0, 8)}...`, align: "left" as const });
  lines.push({ text: `Date: ${new Date().toLocaleString()}`, align: "left" as const });
  if (input.tableName) lines.push({ text: `Table: ${input.tableName}`, align: "left" as const, bold: true });
  lines.push({ text: separator, align: "center" as const });

  input.items.forEach((item) => {
    lines.push({ text: `${item.name}`, align: "left", bold: true });
    lines.push({ text: `Qty: ${item.qty}`, align: "left" });
    if (item.notes) {
      lines.push({ text: `Note: ${item.notes}`, align: "left" });
    }
    lines.push({ text: " ", align: "left" });
  });

  lines.push({ text: separator, align: "center" });
  return lines;
}

export function buildTokenSlipLines(input: {
  restaurantName: string;
  tokenNumber: string | number;
  orderType: string;
  itemsCount: number;
}) {
  const separator = "--------------------------------";

  const lines: PrintLine[] = [
    { text: input.restaurantName, align: "center", bold: true },
    { text: separator, align: "center" },
    { text: "TOKEN NUMBER", align: "center" },
    { text: `${input.tokenNumber}`, align: "center", bold: true }, // Printer driver often scales this up if configured
    { text: separator, align: "center" },
    { text: `Type: ${input.orderType}`, align: "center" },
    { text: `Items: ${input.itemsCount}`, align: "center" },
    { text: new Date().toLocaleTimeString(), align: "center" },
    { text: separator, align: "center" },
  ];

  return lines;
}

export function buildInvoiceLines(input: {
  restaurantName: string;
  branchName: string;
  billId: string;
  tokenNumber?: string | number | null;
  items: { name: string; qty: number; price: number }[];
  subtotal: number;
  tax: number;
  total: number;
}) {
  const separator = "--------------------------------";

  const lines: PrintLine[] = [
    { text: input.restaurantName, align: "center", bold: true },
    { text: input.branchName, align: "center" },
    { text: separator, align: "center" },
  ];

  if (input.tokenNumber) {
    lines.push({ text: `TOKEN: ${input.tokenNumber}`, align: "center" as const, bold: true });
    lines.push({ text: separator, align: "center" as const });
  }

  lines.push({ text: `Bill No: ${input.billId}`, align: "left" });
  lines.push({ text: `Date: ${new Date().toLocaleString()}`, align: "left" });
  lines.push({ text: separator, align: "center" });

  input.items.forEach((item) => {
    // 2-line layout for better cleaner look on small paper
    lines.push({ text: `${item.name}`, align: "left" });
    lines.push({ text: `${item.qty} x ${item.price.toFixed(2)} = ${(item.qty * item.price).toFixed(2)}`, align: "right" });
  });

  lines.push({ text: separator, align: "center" });
  lines.push({ text: `Subtotal: ${input.subtotal.toFixed(2)}`, align: "right" });
  if (input.tax > 0) lines.push({ text: `Tax: ${input.tax.toFixed(2)}`, align: "right" });
  lines.push({ text: separator, align: "center" });
  lines.push({ text: `TOTAL: ${input.total.toFixed(2)}`, align: "center", bold: true });
  lines.push({ text: separator, align: "center" });
  lines.push({ text: "Thank you for dining with us!", align: "center" });

  return lines;
}

export function buildConsolidatedReceiptLines(input: {
  restaurantName: string;
  branchName: string;
  tableName?: string | null;
  orderId: string;
  tokenNumber?: string | null;
  orderType: string;
  items: { name: string; qty: number; price: number; notes?: string | null }[];
  subtotal: number;
  tax: number;
  total: number;
}) {
  const separator = "--------------------------------";
  const sectionBreak = "================================";

  const lines: PrintLine[] = [];

  // 1. KOT Section
  lines.push({ text: "KITCHEN ORDER (COPY)", align: "center", bold: true });
  lines.push({ text: `Order: ${input.orderId.substring(0, 8)}`, align: "left" });
  if (input.tableName) lines.push({ text: `Table: ${input.tableName}`, align: "left", bold: true });
  if (input.tokenNumber) lines.push({ text: `TOKEN: ${input.tokenNumber}`, align: "center", bold: true });
  lines.push({ text: separator, align: "center" });

  input.items.forEach((item) => {
    lines.push({ text: `${item.name}`, align: "left", bold: true });
    lines.push({ text: `Qty: ${item.qty} ${item.notes ? '(' + item.notes + ')' : ''}`, align: "left" });
  });

  lines.push({ text: sectionBreak, align: "center" });
  lines.push({ text: " ", align: "center" }); // Space between sections

  // 2. Bill Section
  lines.push({ text: input.restaurantName, align: "center", bold: true });
  lines.push({ text: "CUSTOMER INVOICE", align: "center", bold: true });
  lines.push({ text: `Date: ${new Date().toLocaleString()}`, align: "left" });
  lines.push({ text: separator, align: "center" });

  input.items.forEach((item) => {
    lines.push({ text: `${item.name}`, align: "left" });
    lines.push({ text: `${item.qty} x ${item.price.toFixed(2)} = ${(item.qty * item.price).toFixed(2)}`, align: "right" });
  });

  lines.push({ text: separator, align: "center" });
  lines.push({ text: `Total: ${input.total.toFixed(2)}`, align: "right", bold: true });

  lines.push({ text: sectionBreak, align: "center" });
  lines.push({ text: " ", align: "center" });

  // 3. Token Slip Section
  if (input.tokenNumber) {
    lines.push({ text: "TOKEN SLIP", align: "center", bold: true });
    lines.push({ text: `${input.tokenNumber}`, align: "center", bold: true }); // Large font implied by driver if configured
    lines.push({ text: `Type: ${input.orderType}`, align: "center" });
    lines.push({ text: separator, align: "center" });
  }

  lines.push({ text: "Thank you!", align: "center" });

  return lines;
}
