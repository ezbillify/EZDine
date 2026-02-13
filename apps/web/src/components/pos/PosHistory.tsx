"use client";

import { useEffect, useState } from "react";
import { Search, Printer, Eye, Calendar, Receipt, ChevronRight, FileText } from "lucide-react";
import { toast } from "sonner";

import { buildInvoiceLines, getPrintingSettings, sendPrintJob, PrintLine } from "../../lib/printing";
import { getCurrentUserProfile } from "../../lib/tenant";
import { supabase } from "../../lib/supabaseClient";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { PrintPreviewModal } from "../printing/PrintPreviewModal";

export function PosHistory() {
  const [bills, setBills] = useState<any[]>([]);
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

  const load = async () => {
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

    setBills(data ?? []);
    setIsLoading(false);
  };

  useEffect(() => {
    load();
  }, [from, to]);

  const fetchBillData = async (billId: string) => {
    const { data: bill } = await supabase
      .from("bills")
      .select("bill_number,subtotal,tax,total,order_id")
      .eq("id", billId)
      .single();
    if (!bill) return null;

    const { data: items } = await supabase
      .from("order_items")
      .select("item_id,quantity,price")
      .eq("order_id", bill.order_id);

    const { data: menu } = await supabase.from("menu_items").select("id,name");

    const lines = buildInvoiceLines({
      restaurantName: "EZDine",
      branchName: "Branch History",
      billId: bill.bill_number ?? "B-OLD",
      items:
        (items ?? []).map((i: any) => ({
          name: menu?.find((m: any) => m.id === i.item_id)?.name ?? "Item",
          qty: i.quantity,
          price: i.price
        })) ?? [],
      subtotal: Number(bill.subtotal ?? 0),
      tax: Number(bill.tax ?? 0),
      total: Number(bill.total ?? 0)
    });

    return { bill, lines };
  };

  const handlePreview = async (billId: string) => {
    const data = await fetchBillData(billId);
    if (!data) return;

    setPreviewData({
      isOpen: true,
      title: `Bill ${data.bill.bill_number}`,
      lines: data.lines,
      width: 80,
      billId
    });
  };

  const handlePrint = async (billId: string) => {
    try {
      const settings = await getPrintingSettings();
      if (!settings) throw new Error("Configure printers first");

      const data = await fetchBillData(billId);
      if (!data) return;

      await sendPrintJob({
        printerId: settings.printerIdInvoice ?? "billing-1",
        width: settings.widthInvoice ?? 80,
        type: "invoice",
        lines: data.lines
      });
      toast.success("Reprinting request sent");
    } catch (err: any) {
      toast.error(err.message || "Print failed");
    }
  };

  return (
    <>
      <Card className="border-slate-100 shadow-xl shadow-slate-200/40 p-0 overflow-hidden">
        <div className="bg-slate-50 p-6 border-b border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">
                <Receipt size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Settled Bills</h3>
                <p className="text-[10px] font-medium text-slate-400">View and reprint historical transactions</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 pl-9 bg-white border-slate-200 rounded-xl text-xs font-bold" />
            </div>
            <div className="text-slate-300">to</div>
            <div className="relative flex-1">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 pl-9 bg-white border-slate-200 rounded-xl text-xs font-bold" />
            </div>
          </div>
        </div>

        <div className="p-4">
          {isLoading ? (
            <div className="py-20 text-center animate-pulse">
              <p className="text-xs font-black uppercase tracking-widest text-slate-300">Scanning Database...</p>
            </div>
          ) : bills.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-300">
              <Search size={40} className="mb-2 opacity-10" />
              <p className="text-xs font-black uppercase tracking-widest">No matching bills</p>
            </div>
          ) : (
            <div className="space-y-1">
              {bills.map((bill) => (
                <div key={bill.id} className="group flex items-center justify-between p-4 rounded-2xl border border-transparent hover:border-slate-100 hover:bg-slate-50 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center shadow-sm text-slate-400 group-hover:text-brand-600 transition-colors">
                      <FileText size={18} />
                    </div>
                    <div>
                      <p className="font-black text-slate-900 leading-none mb-1 text-sm">{bill.bill_number ?? "Legacy Bill"}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter uppercase tracking-widest">
                        {new Date(bill.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ₹{Number(bill.total ?? 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" className="h-9 px-3 gap-2 bg-white border border-slate-200 shadow-sm text-slate-600 hover:text-brand-600 rounded-xl text-[10px] font-black uppercase" onClick={() => handlePreview(bill.id)}>
                      <Eye size={14} /> Preview
                    </Button>
                    <Button variant="ghost" className="h-9 w-9 p-0 bg-white border border-slate-200 shadow-sm text-slate-600 hover:text-indigo-600 rounded-xl" onClick={() => handlePrint(bill.id)}>
                      <Printer size={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <PrintPreviewModal
        isOpen={previewData.isOpen}
        onClose={() => setPreviewData(prev => ({ ...prev, isOpen: false }))}
        title={previewData.title}
        lines={previewData.lines}
        width={previewData.width}
        onPrint={() => previewData.billId && handlePrint(previewData.billId)}
      />
    </>
  );
}

