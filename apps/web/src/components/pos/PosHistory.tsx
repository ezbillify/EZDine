"use client";

import { useEffect, useState, useCallback } from "react";
import { Printer, Eye, Receipt, FileText } from "lucide-react";
import { toast } from "sonner";

import { buildInvoiceLines, getPrintingSettings, sendPrintJob, PrintLine } from "../../lib/printing";
import { getCurrentUserProfile } from "../../lib/tenant";
import { supabase } from "../../lib/supabaseClient";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { PrintPreviewModal } from "../printing/PrintPreviewModal";

type Bill = {
  id: string;
  bill_number: string | null;
  total: number;
  subtotal?: number;
  tax?: number;
  created_at: string;
  status: string;
  order_id?: string;
};

interface OrderItem {
  item_id: string;
  quantity: number;
  price: number;
}

interface MenuItem {
  id: string;
  name: string;
}

export function PosHistory() {
  const [bills, setBills] = useState<Bill[]>([]);
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState<string>(today);
  const [to, setTo] = useState<string>(today);
  const [isLoading, setIsLoading] = useState(false);

  // Preview State
  const [previewData, setPreviewData] = useState<{
    isOpen: boolean;
    title: string;
    lines: PrintLine[];
    width: 58 | 80;
    billId: string | null;
  }>({
    isOpen: false,
    title: "",
    lines: [],
    width: 80,
    billId: null
  });

  const load = useCallback(async () => {
    const profile = await getCurrentUserProfile();
    if (!profile?.active_restaurant_id || !profile.active_branch_id) return;
    setIsLoading(true);

    const { data } = await supabase
      .from("bills")
      .select("id,bill_number,total,status,created_at,order_id")
      .eq("branch_id", profile.active_branch_id)
      .gte("created_at", `${from}T00:00:00`)
      .lte("created_at", `${to}T23:59:59`)
      .order("created_at", { ascending: false })
      .limit(50);

    setBills((data as unknown as Bill[]) || []);
    setIsLoading(false);
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const fetchBillData = async (billId: string) => {
    const { data: bill } = await supabase
      .from("bills")
      .select("bill_number,subtotal,tax,total,order_id")
      .eq("id", billId)
      .single();
    if (!bill) return null;

    const { data: itemsData } = await supabase
      .from("order_items")
      .select("item_id,quantity,price")
      .eq("order_id", bill.order_id);

    const items = (itemsData as unknown as OrderItem[]) || [];

    const { data: menuData } = await supabase.from("menu_items").select("id,name");
    const menu = (menuData as unknown as MenuItem[]) || [];

    const lines = buildInvoiceLines({
      restaurantName: "EZDine",
      branchName: "Branch History",
      billId: (bill.bill_number as string) ?? "B-OLD",
      items: items.map(i => ({
        name: menu.find(m => m.id === i.item_id)?.name ?? "Item",
        qty: i.quantity,
        price: i.price
      })) || [],
      subtotal: Number(bill.subtotal ?? 0),
      tax: Number(bill.tax ?? 0),
      total: Number(bill.total ?? 0)
    });

    return lines;
  };

  const handlePreview = async (billId: string) => {
    const lines = await fetchBillData(billId);
    if (!lines) return;

    setPreviewData({
      isOpen: true,
      title: "Bill View",
      lines,
      width: 80,
      billId
    });
  };

  const handlePrint = async (billId?: string) => {
    const id = billId || previewData.billId;
    if (!id) return;

    const lines = await fetchBillData(id);
    if (!lines) {
      toast.error("Failed to load bill data");
      return;
    }

    try {
      const settings = await getPrintingSettings();
      await sendPrintJob({
        printerId: settings?.printerIdInvoice || "default-printer",
        width: settings?.widthInvoice || 80,
        type: "invoice",
        lines
      });
      toast.success("Print job sent");
    } catch (err: unknown) {
      toast.error("Printing failed: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const statusMap: Record<string, string> = {
    "paid": "text-emerald-500 bg-emerald-50 border-emerald-100",
    "unpaid": "text-amber-500 bg-amber-50 border-amber-100",
    "cancelled": "text-rose-500 bg-rose-50 border-rose-100"
  };

  return (
    <div className="flex h-full flex-col bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-100 bg-white px-6 py-4 flex-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600">
              <HistoryIcon size={20} />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-900">Settled Bills</h2>
              <p className="text-[10px] font-bold text-slate-400">View and reprint past invoices</p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-2 pl-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">From</span>
              <input
                type="date"
                value={from}
                onChange={e => setFrom(e.target.value)}
                className="bg-transparent text-xs font-bold outline-none border-none focus:ring-0"
              />
            </div>
            <div className="h-4 w-px bg-slate-200" />
            <div className="flex items-center gap-2 pr-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">To</span>
              <input
                type="date"
                value={to}
                onChange={e => setTo(e.target.value)}
                className="bg-transparent text-xs font-bold outline-none border-none focus:ring-0"
              />
            </div>
          </div>
        </div>
      </div>

      {/* List Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          </div>
        ) : bills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-[2rem] border border-dashed border-slate-200">
            <Receipt size={48} className="opacity-10 mb-4" />
            <p className="text-sm font-bold">No bills found for these dates</p>
          </div>
        ) : (
          <div className="space-y-2">
            {bills.map((bill) => (
              <Card key={bill.id} className="group flex items-center justify-between p-4 rounded-2xl border border-transparent hover:border-slate-100 hover:bg-slate-50 transition-all">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center shadow-sm text-slate-400 group-hover:text-brand-600 transition-colors">
                    <FileText size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">#{bill.bill_number}</h4>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">₹{bill.total.toFixed(2)} • {new Date(bill.created_at).toLocaleString()}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded-lg border text-[9px] font-black uppercase tracking-widest ${statusMap[bill.status] || "text-slate-500 bg-slate-50 border-slate-100"}`}>
                    {bill.status}
                  </span>

                  <div className="h-6 w-px bg-slate-200 mx-1" />

                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePreview(bill.id)}
                      className="h-8 w-8 p-0 rounded-lg hover:bg-white hover:shadow-sm"
                    >
                      <Eye size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePrint(bill.id)}
                      className="h-8 w-8 p-0 rounded-lg hover:bg-white hover:shadow-sm"
                    >
                      <Printer size={14} />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <PrintPreviewModal
        isOpen={previewData.isOpen}
        onClose={() => setPreviewData(prev => ({ ...prev, isOpen: false }))}
        title={previewData.title}
        lines={previewData.lines}
        width={previewData.width}
        onPrint={() => handlePrint()}
      />
    </div>
  );
}

function HistoryIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}
