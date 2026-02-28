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
    const settings = await getPrintingSettings();
    const baseUrl = settings?.bridgeUrl || process.env.NEXT_PUBLIC_PRINT_SERVER_URL;

    if (!baseUrl) {
      console.warn("Printing skipped: No print server URL (Bridge URL or Env) configured");
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
  paperWidth?: 58 | 80;
}) {
  const charCount = input.paperWidth === 80 ? 48 : 32;
  const separator = "-".repeat(charCount);

  const lines: PrintLine[] = [
    { text: input.restaurantName, align: "center", bold: true },
    { text: `Branch: ${input.branchName}`, align: "center" },
    { text: separator, align: "center" as const },
  ];

  if (input.tokenNumber) {
    lines.push({ text: `TOKEN: ${input.tokenNumber}`, align: "center" as const, bold: true });
    lines.push({ text: separator, align: "center" as const });
  }

  lines.push({ text: "KITCHEN ORDER TICKET", align: "center", bold: true });
  lines.push({ text: separator, align: "center" });
  lines.push({ text: `Order: ${input.orderId.slice(0, 8).toUpperCase()}`, align: "center" });
  lines.push({ text: `Table: ${input.tableName || "N/A"}`, align: "center", bold: true });
  lines.push({ text: `Date: ${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`, align: "center" });
  lines.push({ text: separator, align: "center" });

  input.items.forEach((item) => {
    lines.push({ text: `${item.qty} x ${item.name}`, align: "left", bold: true });
    if (item.notes) {
      lines.push({ text: `  * ${item.notes}`, align: "left" });
    }
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
  paperWidth?: 58 | 80;
}) {
  const charCount = input.paperWidth === 80 ? 48 : 32;
  const separator = "-".repeat(charCount);

  const lines: PrintLine[] = [
    { text: input.restaurantName, align: "center", bold: true },
    { text: input.branchName, align: "center" },
    { text: separator, align: "center" },
  ];

  if (input.tokenNumber) {
    lines.push({ text: `TOKEN: ${input.tokenNumber}`, align: "center" as const, bold: true });
    lines.push({ text: separator, align: "center" as const });
  }

  lines.push({ text: `INVOICE: ${input.billId.toUpperCase()}`, align: "center", bold: true });
  lines.push({ text: `Date: ${new Date().toLocaleDateString()} ${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`, align: "center" });
  lines.push({ text: separator, align: "center" });

  input.items.forEach((item) => {
    const qtyTotal = (item.qty * item.price).toFixed(2);
    let row = `${item.qty} x ${item.name}`;
    const maxRowLen = charCount - qtyTotal.length - 1;
    if (row.length > maxRowLen) row = row.slice(0, maxRowLen - 3) + "...";
    const padding = " ".repeat(Math.max(1, charCount - row.length - qtyTotal.length));
    lines.push({ text: `${row}${padding}${qtyTotal}`, align: "left" });
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
  const lines: PrintLine[] = [];

  // --- SECTION 1: KOT ---
  lines.push({ text: "KITCHEN ORDER (COPY)", align: "center", bold: true });
  if (input.tokenNumber) lines.push({ text: `TOKEN: ${input.tokenNumber}`, align: "center", bold: true });
  if (input.tableName) lines.push({ text: `TABLE: ${input.tableName}`, align: "center", bold: true });
  lines.push({ text: `Order: ${input.orderId.slice(0, 8).toUpperCase()} | ${new Date().getHours()}:${new Date().getMinutes()}`, align: "center" });

  input.items.forEach((item) => {
    lines.push({ text: `${item.qty} x ${item.name}`, align: "left", bold: true });
  });

  // --- DIVIDER LINE ---
  lines.push({ text: separator, align: "center" });

  // --- SECTION 2: BILL ---
  lines.push({ text: input.restaurantName, align: "center", bold: true });
  lines.push({ text: "CUSTOMER INVOICE", align: "center" });

  input.items.forEach((item) => {
    const qtyTotal = (item.qty * item.price).toFixed(2);
    let row = `${item.qty} x ${item.name}`;
    if (row.length > 22) row = row.slice(0, 19) + "...";
    const padding = " ".repeat(Math.max(1, 32 - row.length - qtyTotal.length));
    lines.push({ text: `${row}${padding}${qtyTotal}`, align: "left" });
  });

  lines.push({ text: separator, align: "center" });
  lines.push({ text: `TOTAL: ${input.total.toFixed(2)}`, align: "center", bold: true });
  lines.push({ text: "Thank you!", align: "center" });

  return lines;
}

export function generateThermalHtml(lines: PrintLine[], width: 58 | 80 = 80) {
  const pixelWidth = width === 58 ? 240 : 320;

  const content = lines.map(line => {
    const alignClass = line.align === 'center' ? 'text-center' : line.align === 'right' ? 'text-right' : 'text-left';
    const weightClass = line.bold ? 'font-bold' : 'font-normal';
    const fontSize = line.bold ? '12px' : '11px';

    return `<div class="${alignClass} ${weightClass}" style="font-size: ${fontSize}; line-height: 1.2; letter-spacing: -0.5px;">${line.text || '&nbsp;'}</div>`;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @page { margin: 0; }
          body {
            font-family: 'Courier New', Courier, monospace;
            margin: 0;
            padding: 20px;
            width: ${pixelWidth}px;
            background: white;
            color: black;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .font-bold { font-weight: bold; }
          .font-normal { font-weight: normal; }
          
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        ${content}
        <script>
          window.onload = () => {
            window.print();
          };
        </script>
      </body>
    </html>
  `;
}
