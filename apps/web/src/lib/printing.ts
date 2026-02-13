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
  type: "kot" | "invoice";
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
  const baseUrl = process.env.NEXT_PUBLIC_PRINT_SERVER_URL;
  if (!baseUrl) {
    throw new Error("Missing NEXT_PUBLIC_PRINT_SERVER_URL");
  }

  const response = await fetch(`${baseUrl}/print`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(job)
  });

  if (!response.ok) {
    throw new Error("Print server error");
  }
}

export function buildKotLines(input: {
  restaurantName: string;
  branchName: string;
  tableName?: string | null;
  orderId: string;
  tokenNumber?: string | null;
  items: { name: string; qty: number; note?: string | null }[];
}) {
  const lines: PrintLine[] = [
    { text: input.restaurantName, align: "center", bold: true },
    { text: `Branch: ${input.branchName}`, align: "center" },
    ...(input.tokenNumber ? [
      { text: "----------------------------", align: "center" as const },
      { text: `TOKEN: ${input.tokenNumber}`, align: "center" as const, bold: true },
      { text: "----------------------------", align: "center" as const },
    ] : []),
    { text: `Order: ${input.orderId}`, align: "left" as const, bold: true },
    { text: `Table: ${input.tableName ?? "--"}`, align: "left" as const },
    { text: "----------------------------", align: "center" as const }
  ];

  input.items.forEach((item) => {
    lines.push({ text: `${item.name} x${item.qty}`, align: "left" });
    if (item.note) {
      lines.push({ text: `  Note: ${item.note}`, align: "left" });
    }
  });

  lines.push({ text: "----------------------------", align: "center" });
  lines.push({ text: "KOT", align: "center", bold: true });
  return lines;
}

export function buildInvoiceLines(input: {
  restaurantName: string;
  branchName: string;
  billId: string;
  items: { name: string; qty: number; price: number }[];
  subtotal: number;
  tax: number;
  total: number;
}) {
  const lines: PrintLine[] = [
    { text: input.restaurantName, align: "center", bold: true },
    { text: input.branchName, align: "center" },
    { text: `Bill: ${input.billId}`, align: "left" },
    { text: "----------------------------", align: "center" }
  ];

  input.items.forEach((item) => {
    lines.push({ text: `${item.name} x${item.qty}  ${item.price.toFixed(2)}`, align: "left" });
  });

  lines.push({ text: "----------------------------", align: "center" });
  lines.push({ text: `Subtotal: ${input.subtotal.toFixed(2)}`, align: "right" });
  lines.push({ text: `Tax: ${input.tax.toFixed(2)}`, align: "right" });
  lines.push({ text: `Total: ${input.total.toFixed(2)}`, align: "right", bold: true });
  lines.push({ text: "Thank you!", align: "center" });

  return lines;
}
