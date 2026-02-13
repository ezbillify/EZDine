"use client";

import { useState } from "react";
import { Terminal, FileText, Send, Zap, Info, Eye, Printer } from "lucide-react";
import { toast } from "sonner";

import { buildInvoiceLines, buildKotLines, sendPrintJob, PrintLine } from "../../lib/printing";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { PrintPreviewModal } from "./PrintPreviewModal";

export function PrintTestCard() {
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [previewData, setPreviewData] = useState<{
    isOpen: boolean;
    title: string;
    lines: PrintLine[];
    width: 58 | 80;
    type: "kot" | "invoice";
  }>({
    isOpen: false,
    title: "",
    lines: [],
    width: 80,
    type: "invoice"
  });

  const handleKot = async (previewOnly = false) => {
    const lines = buildKotLines({
      restaurantName: "EZDine Demo",
      branchName: "Main",
      tableName: "T3",
      orderId: "#1001",
      items: [
        { name: "Paneer Butter Masala", qty: 1 },
        { name: "Butter Naan", qty: 2, note: "Less oil" }
      ]
    });

    if (previewOnly) {
      setPreviewData({
        isOpen: true,
        title: "KOT Preview",
        lines,
        width: 58,
        type: "kot"
      });
      return;
    }

    setStatus("sending");
    try {
      await sendPrintJob({ printerId: "kitchen-1", width: 58, type: "kot", lines });
      toast.success("Test KOT dispatched to network");
    } catch (err) {
      toast.error("Network printer unreachable");
    } finally {
      setStatus("idle");
    }
  };

  const handleInvoice = async (previewOnly = false) => {
    const lines = buildInvoiceLines({
      restaurantName: "EZDine Demo",
      branchName: "Main",
      billId: "B-1021",
      items: [
        { name: "Veg Biryani", qty: 1, price: 220 },
        { name: "Raita", qty: 1, price: 40 }
      ],
      subtotal: 260,
      tax: 13,
      total: 273
    });

    if (previewOnly) {
      setPreviewData({
        isOpen: true,
        title: "Invoice Preview",
        lines,
        width: 80,
        type: "invoice"
      });
      return;
    }

    setStatus("sending");
    try {
      await sendPrintJob({ printerId: "billing-1", width: 80, type: "invoice", lines });
      toast.success("Test Invoice dispatched to network");
    } catch (err) {
      toast.error("Network printer unreachable");
    } finally {
      setStatus("idle");
    }
  };

  return (
    <>
      <Card className="border-slate-100 shadow-xl shadow-slate-200/40 p-0 overflow-hidden">
        <div className="bg-slate-50 p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-500/20">
              <Zap size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Diagnostics</h3>
              <p className="text-[10px] font-medium text-slate-400">Trigger test pulses or verify layout</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="bg-brand-50 rounded-2xl p-4 flex gap-4 items-start mb-6">
            <Info size={18} className="text-brand-600 mt-1 flex-none" />
            <p className="text-xs text-brand-700 leading-relaxed font-medium">
              Diagnostic prints help verify if your thermal printers are correctly mapped. Use <b>Preview</b> to check visual alignment.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* KOT Diagnostic Card */}
            <div className="rounded-[2rem] border-2 border-slate-100 p-5 space-y-4 hover:border-brand-500/20 hover:bg-brand-50/10 transition-all group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-brand-600 group-hover:bg-brand-50 transition-all">
                    <Terminal size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase text-slate-900 leading-none">Kitchen KOT</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-tighter">Small (58mm)</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  className="flex-1 h-10 bg-white border border-slate-200 text-slate-600 hover:text-brand-600 rounded-xl text-[10px] font-black uppercase gap-2"
                  onClick={() => handleKot(true)}
                >
                  <Eye size={14} /> Preview
                </Button>
                <Button
                  className="flex-1 h-10 bg-brand-600 text-white rounded-xl text-[10px] font-black uppercase gap-2 border-none"
                  onClick={() => handleKot(false)}
                  disabled={status === "sending"}
                >
                  <Printer size={14} /> Print
                </Button>
              </div>
            </div>

            {/* Invoice Diagnostic Card */}
            <div className="rounded-[2rem] border-2 border-slate-100 p-5 space-y-4 hover:border-amber-500/20 hover:bg-amber-50/10 transition-all group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-amber-600 group-hover:bg-amber-50 transition-all">
                    <FileText size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase text-slate-900 leading-none">Tax Invoice</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-tighter">Standard (80mm)</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  className="flex-1 h-10 bg-white border border-slate-200 text-slate-600 hover:text-amber-600 rounded-xl text-[10px] font-black uppercase gap-2"
                  onClick={() => handleInvoice(true)}
                >
                  <Eye size={14} /> Preview
                </Button>
                <Button
                  className="flex-1 h-10 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase gap-2 border-none hover:bg-amber-600"
                  onClick={() => handleInvoice(false)}
                  disabled={status === "sending"}
                >
                  <Printer size={14} /> Print
                </Button>
              </div>
            </div>
          </div>

          {status === "sending" && (
            <div className="mt-6 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-brand-600 animate-pulse">
              <Send size={14} />
              Pushing data packets...
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
        onPrint={() => previewData.type === 'kot' ? handleKot(false) : handleInvoice(false)}
      />
    </>
  );
}
