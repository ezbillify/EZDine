import { supabase } from "./supabaseClient";
import { getCurrentUserProfile } from "./tenant";

export type PrintLine = {
  text: string;
  align?: "left" | "center" | "right";
  bold?: boolean;
  height?: number;
  width?: number;
};

export type PrintJob = {
  printerId: string;
  width: 58 | 80;
  type: "kot" | "invoice" | "token";
  lines: PrintLine[];
  font?: "font-a" | "font-b";
};

const PRINTING_KEY = "printing";
const DOC_NUMBERING_KEY = "doc_numbering";

export async function getPrintingSettings() {
  const DEFAULT_SETTINGS = {
    bridgeUrl: 'http://localhost:4000',
    printerIdInvoice: '127.0.0.1',
    printerIdKot: '127.0.0.1',
    widthInvoice: 80,
    widthKot: 80,
    connectionType: 'network', // Use Print Bridge automatically for silent printing
    printFont: 'font-a',     // Add print font to settings
  };

  try {
    const saved = localStorage.getItem('ezdine_printer_settings');
    if (saved) return JSON.parse(saved);

    // Fallback to Supabase
    const profile = await getCurrentUserProfile();
    if (profile?.active_restaurant_id && profile.active_branch_id) {
      const { data, error } = await supabase
        .from("settings")
        .select("*")
        .eq("restaurant_id", profile.active_restaurant_id)
        .eq("branch_id", profile.active_branch_id)
        .eq("key", PRINTING_KEY)
        .maybeSingle();

      if (!error && data?.value) return data.value;
    }

    return DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function savePrintingSettings(value: Record<string, unknown>) {
  // TEMPORARY: Save to localStorage for immediate testing
  try {
    localStorage.setItem('ezdine_printer_settings', JSON.stringify(value));
    console.log('Settings saved to localStorage successfully');

    // Also try to save to Supabase in background (don't fail if it doesn't work)
    try {
      const profile = await getCurrentUserProfile();
      if (profile?.active_restaurant_id && profile.active_branch_id) {
        const { error } = await supabase.from("settings").upsert({
          restaurant_id: profile.active_restaurant_id,
          branch_id: profile.active_branch_id,
          key: PRINTING_KEY,
          value
        });

        if (!error) {
          console.log('Settings also saved to Supabase');
        }
      }
    } catch (supabaseErr) {
      console.warn('Supabase save failed, but localStorage worked:', supabaseErr);
    }

    return true;
  } catch (err) {
    console.error('Failed to save to localStorage:', err);
    throw new Error('Failed to save printer settings');
  }
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
  value: Record<string, unknown>
) {
  const { error } = await supabase.from("settings").upsert({
    restaurant_id: restaurantId,
    branch_id: branchId,
    key: DOC_NUMBERING_KEY,
    value
  });
  if (error) throw error;
}

interface EZDineBridgeAPI {
  getBridgeInfo: () => Promise<{ url: string; appUrl: string; ip: string; port: number; preloadPath?: string; appVersion?: string }>;
  printJob: (job: PrintJob) => Promise<boolean>;
}

declare global {
  interface Window {
    bridgeAPI?: EZDineBridgeAPI;
  }
}

export async function sendPrintJob(job: PrintJob) {
  // DESKTOP IPC SUPPORT: Use native Electron bridge if available to bypass Mixed Content restrictions
  if (typeof window !== 'undefined' && window.bridgeAPI?.printJob) {
    try {
      console.log('Desktop Environment Detected: Using native print IPC channel');
      const success = await window.bridgeAPI.printJob(job);
      return success;
    } catch (err) {
      console.error('Desktop IPC print failed:', err);
      // Fallback to fetch if IPC fails for any reason
    }
  }

  let baseUrl = 'http://localhost:4000';
  try {
    const settings = await getPrintingSettings();

    // Direct Browser HTML Thermal Printing
    if (settings?.connectionType === 'browser') {
      console.log('Using direct browser HTML thermal printing', job);
      const html = generateThermalHtml(job.lines, job.width, job.font);

      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);

      iframe.contentWindow?.document.open();
      iframe.contentWindow?.document.write(html);
      iframe.contentWindow?.document.close();

      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 5000);

      return true;
    }

    baseUrl = settings?.bridgeUrl || process.env.NEXT_PUBLIC_PRINT_SERVER_URL || 'http://localhost:4000';

    if (!baseUrl) {
      throw new Error("No print server URL configured. Please set up printer settings first.");
    }

    console.log(`Attempting to print to: ${baseUrl}/print`);
    console.log('Print job:', job);

    // Add timeout and better error handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(`${baseUrl}/print`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(job),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Print server error (${response.status}): ${errorText}`);
    }

    const result = await response.text();
    console.log('Print server response:', result);
    return true;
  } catch (err: unknown) {
    const error = err as Error;
    if (error.name === 'AbortError') {
      throw new Error("Print server timeout - check if server is running on the configured URL");
    } else if (error.message?.includes('fetch')) {
      throw new Error(`Cannot connect to print server at ${baseUrl}. Make sure the print server is running.`);
    } else {
      throw new Error(`Print failed: ${error.message}`);
    }
  }
}

export function buildKotLines(input: {
  restaurantName: string;
  branchName: string;
  tableName?: string | null;
  orderId: string;
  tokenNumber?: string | number | null;
  orderType?: string;
  items: { name: string; qty: number; notes?: string | null }[];
  paperWidth?: 58 | 80;
}) {
  const paperWidth = input.paperWidth || 58;
  const charCount = paperWidth === 80 ? 48 : 32;
  const singleDivider = "-".repeat(charCount);
  const lines: PrintLine[] = [];

  // Ultra-compact header for ALL paper sizes - no company names to save space
  lines.push({ text: "KITCHEN ORDER", align: 'center', bold: true });
  if (input.tokenNumber) {
    lines.push({ text: `TOKEN: ${input.tokenNumber}`, align: 'center', bold: true, height: 2, width: 2 });
  }

  // Combine table and time in one line for all paper sizes
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  if (input.tableName) {
    const tableTimeLine = `TBL:${input.tableName.toUpperCase()} | ${timeStr}`;
    // For smaller papers, split if too long
    if (paperWidth < 80 && tableTimeLine.length > charCount) {
      lines.push({ text: `TBL: ${input.tableName.toUpperCase()}`, align: 'center', bold: true });
      lines.push({ text: `TIME: ${timeStr}`, align: 'center', bold: true });
    } else {
      lines.push({ text: tableTimeLine, align: 'center', bold: true });
    }
  } else {
    lines.push({ text: timeStr, align: 'center', bold: true });
  }
  lines.push({ text: singleDivider, align: 'center' });

  // Ultra-compact items list for ALL paper sizes
  input.items.forEach((item) => {
    const name = (item.name || "Item").toUpperCase();
    const qty = item.qty || 1;

    // Compact format for all paper sizes
    const shortName = name.length > (paperWidth === 80 ? 25 : 20) ?
      name.substring(0, paperWidth === 80 ? 23 : 18) + ".." : name;
    lines.push({ text: `${qty}x ${shortName}`, align: 'left', bold: true });

    // Only add notes if they exist and are short
    const notes = item.notes || "";
    if (notes.trim().length > 0 && notes.trim().length <= 20) {
      lines.push({ text: `  ${notes.trim().toUpperCase()}`, align: 'left' });
    }
  });

  // Minimal footer - no extra spacing
  lines.push({ text: singleDivider, align: 'center' });

  return lines;
}

export function buildTokenSlipLines(input: {
  restaurantName: string;
  tokenNumber: string | number;
  orderType: string;
  itemsCount: number;
  paperWidth?: 58 | 80;
}) {
  const charCount = input.paperWidth === 80 ? 48 : 32;
  const separator = "-".repeat(charCount);

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
  branchAddress?: string;
  gstin?: string;
  fssai?: string;
  phone?: string;
  billId: string;
  tokenNumber?: string | number | null;
  customerName?: string | null;
  tableName?: string | null;
  orderType?: string;
  items: { name: string; qty: number; price: number; hsn_code?: string }[];
  subtotal: number;
  tax: number;
  total: number;
  paperWidth?: 58 | 80;
}) {
  const paperWidth = input.paperWidth || 58;
  const charCount = paperWidth === 80 ? 46 : 31;
  const singleDivider = "-".repeat(charCount);
  const lines: PrintLine[] = [];

  // 1. Header Section
  lines.push({ text: input.restaurantName.toUpperCase(), align: 'center', bold: true });

  if (input.branchName) {
    lines.push({ text: input.branchName, align: 'center' });
  }

  if (input.branchAddress) {
    lines.push({ text: input.branchAddress, align: 'center' });
  }

  if (input.phone) {
    lines.push({ text: `PH: ${input.phone}`, align: 'center' });
  }

  if (input.gstin) {
    lines.push({ text: `GSTIN: ${input.gstin}`, align: 'center' });
  }

  if (input.fssai) {
    lines.push({ text: `FSSAI: ${input.fssai}`, align: 'center' });
  }

  lines.push({ text: singleDivider, align: 'center' });

  // 2. Order Info Section
  const now = new Date();
  const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  lines.push({ text: `INV NO: ${input.billId.toUpperCase()}`, align: 'left' });
  lines.push({ text: `DATE: ${dateStr} ${timeStr}`, align: 'left' });

  // Line 2: Token and Order Type
  const tokenPart = input.tokenNumber ? `TOKEN: ${input.tokenNumber}` : "";
  const typePart = input.orderType ? input.orderType.toUpperCase() : "DINE-IN";

  if (tokenPart || typePart) {
    const spaceCount = charCount - tokenPart.length - typePart.length;
    const infoLine = `${tokenPart}${" ".repeat(Math.max(1, spaceCount))}${typePart}`;
    lines.push({ text: infoLine, align: 'left', bold: true });
  }

  if (input.tableName && input.tableName !== "--") {
    lines.push({ text: `TABLE: ${input.tableName.toUpperCase()}`, align: 'left', bold: true });
  }

  lines.push({ text: singleDivider, align: 'center' });

  // 3. Items Table Header
  const headerItem = "ITEM".padEnd(paperWidth === 80 ? 22 : 13);
  const headerQty = "QTY".padStart(paperWidth === 80 ? 3 : 3);
  const headerPrice = "PRICE".padStart(paperWidth === 80 ? 8 : 6);
  const headerTotal = "TOTAL".padStart(paperWidth === 80 ? 9 : 6);
  const headerStr = `${headerItem} ${headerQty} ${headerPrice} ${headerTotal}`;
  lines.push({ text: headerStr, align: 'left', bold: true });
  lines.push({ text: singleDivider, align: 'center' });

  // 4. Items List
  input.items.forEach((item) => {
    const name = (item.name || "Item").toUpperCase();
    const qty = item.qty || 1;
    const price = item.price || 0.0;
    const amt = price * qty;

    if (paperWidth === 80) {
      const shortName = name.length > 22 ? name.substring(0, 20) + ".." : name.padEnd(22);
      const qtyStr = qty.toString().padStart(3);
      const priceStr = price.toFixed(2).padStart(8);
      const totalStr = amt.toFixed(2).padStart(9);
      lines.push({ text: `${shortName} ${qtyStr} ${priceStr} ${totalStr}`, align: 'left' });
    } else {
      const shortName = name.length > 13 ? name.substring(0, 11) + ".." : name.padEnd(13);
      const qtyStr = qty.toString().padStart(3);
      const priceStr = price.toFixed(2).padStart(6);
      const totalStr = amt.toFixed(2).padStart(6);
      lines.push({ text: `${shortName} ${qtyStr} ${priceStr} ${totalStr}`, align: 'left' });
    }
  });

  lines.push({ text: singleDivider, align: 'center' });

  // 5. Totals
  const totalVal = `Rs. ${input.total.toFixed(2)}`;
  const totalLabel = "GRAND TOTAL";
  const totalPad = Math.max(1, charCount - totalLabel.length - totalVal.length);
  lines.push({ text: `${totalLabel}${" ".repeat(totalPad)}${totalVal}`, align: 'left', bold: true });

  lines.push({ text: singleDivider, align: 'center' });

  // 6. Footer
  lines.push({ text: "THANK YOU", align: 'center', bold: true });
  lines.push({ text: "POWERED BY EZBILLIFY", align: 'center' });
  lines.push({ text: " ", align: 'center' }); // Extra space for cut
  lines.push({ text: " ", align: 'center' });

  return lines;
}

export function buildConsolidatedReceiptLines(input: {
  restaurantName: string;
  branchName: string;
  branchAddress?: string;
  gstin?: string;
  fssai?: string;
  phone?: string;
  tableName?: string | null;
  orderId: string;
  tokenNumber?: string | number | null;
  customerName?: string | null;
  orderType: string;
  items: { name: string; qty: number; price: number; hsn_code?: string; notes?: string | null }[];
  subtotal: number;
  tax: number;
  total: number;
  paperWidth?: 58 | 80;
}) {
  const invoiceLines = buildInvoiceLines({
    restaurantName: input.restaurantName,
    branchName: input.branchName,
    branchAddress: input.branchAddress,
    gstin: input.gstin,
    fssai: input.fssai,
    phone: input.phone,
    billId: input.orderId,
    tokenNumber: input.tokenNumber,
    customerName: input.customerName,
    tableName: input.tableName,
    orderType: input.orderType,
    items: input.items,
    subtotal: input.subtotal,
    tax: input.tax,
    total: input.total,
    paperWidth: input.paperWidth,
  });

  const kotLines = buildKotLines({
    restaurantName: input.restaurantName,
    branchName: input.branchName,
    orderId: input.orderId,
    tableName: input.tableName,
    tokenNumber: input.tokenNumber,
    items: input.items,
    orderType: input.orderType,
    paperWidth: input.paperWidth,
  });

  const lines: PrintLine[] = [];
  lines.push(...invoiceLines);

  const charCount = input.paperWidth === 80 ? 48 : 32;
  lines.push({ text: "-".repeat(charCount), align: "center" });

  lines.push(...kotLines);

  return lines;
}

export function generateThermalHtml(lines: PrintLine[], width: 58 | 80 = 80, font?: "font-a" | "font-b") {
  const isFontB = font === 'font-b';

  const content = lines.map(line => {
    // Detect if line is a divider
    const isDivider = line.text && /^[-=]{3,}$/.test(line.text.trim());

    if (isDivider) {
      return `<div style="border-top: 1px dashed #000; margin: 4px 0; width: 100%;"></div>`;
    }

    const alignClass = line.align === 'center' ? 'text-center' : line.align === 'right' ? 'text-right' : 'text-left';
    const weightClass = line.bold ? 'font-bold' : 'font-normal';

    // Scale font based on bold/width and font preference
    const baseSize = isFontB ? 9 : 11;
    const boldSize = isFontB ? 11 : 13;
    const fontSize = line.bold ? `${boldSize}px` : `${baseSize}px`;
    const lineHeight = line.bold ? '1.4' : '1.2';
    const letterSpacing = isFontB ? '-0.5px' : 'normal';

    return `<div class="${alignClass} ${weightClass}" style="font-size: ${fontSize}; line-height: ${lineHeight}; letter-spacing: ${letterSpacing}; white-space: pre-wrap; word-break: break-word;">${line.text || '&nbsp;'}</div>`;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @page { 
            margin: 0; 
            size: ${width}mm auto;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: 'Courier New', Courier, monospace;
            margin: 0;
            padding: 4mm;
            width: ${width}mm;
            background: white;
            color: black;
            -webkit-print-color-adjust: exact;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .font-bold { font-weight: bold; }
          .font-normal { font-weight: normal; }
          
          @media print {
            body { 
              padding: 0;
              width: ${width}mm;
            }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div style="width: 100%;">
          ${content}
        </div>
        <script>
          window.onload = () => {
            setTimeout(() => {
              window.print();
            }, 500);
          };
        </script>
      </body>
    </html>
  `;
}
