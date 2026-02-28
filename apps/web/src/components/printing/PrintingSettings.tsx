"use client";

import { useEffect, useState } from "react";
import { Printer, Save, Monitor, Share2, Ruler, Terminal } from "lucide-react";
import { toast } from "sonner";

import { getPrintingSettings, savePrintingSettings } from "../../lib/printing";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Dropdown } from "../ui/Dropdown";

const DEFAULT_SETTINGS = {
  printerIdKot: "kitchen-1",
  printerIdInvoice: "billing-1",
  widthKot: 58,
  widthInvoice: 80
};

export function PrintingSettings() {
  const [printerIdKot, setPrinterIdKot] = useState(DEFAULT_SETTINGS.printerIdKot);
  const [printerIdInvoice, setPrinterIdInvoice] = useState(DEFAULT_SETTINGS.printerIdInvoice);
  const [widthKot, setWidthKot] = useState<number>(DEFAULT_SETTINGS.widthKot);
  const [widthInvoice, setWidthInvoice] = useState<number>(DEFAULT_SETTINGS.widthInvoice);
  const [bridgeUrl, setBridgeUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "error">("idle");
  const [consolidatePrinting, setConsolidatePrinting] = useState(false);

  useEffect(() => {
    const load = async () => {
      setStatus("loading");
      try {
        const settings = await getPrintingSettings();
        if (settings) {
          setPrinterIdKot(settings.printerIdKot ?? DEFAULT_SETTINGS.printerIdKot);
          setPrinterIdInvoice(settings.printerIdInvoice ?? DEFAULT_SETTINGS.printerIdInvoice);
          setWidthKot(settings.widthKot ?? DEFAULT_SETTINGS.widthKot);
          setWidthInvoice(settings.widthInvoice ?? DEFAULT_SETTINGS.widthInvoice);
          setConsolidatePrinting(settings.consolidatePrinting ?? false);
          setBridgeUrl(settings.bridgeUrl ?? "");
        }
        setStatus("idle");
      } catch (err) {
        setStatus("error");
        toast.error("Failed to load printer configurations");
      }
    };

    load();
  }, []);

  const handleSave = async () => {
    setStatus("saving");
    try {
      await savePrintingSettings({
        printerIdKot,
        printerIdInvoice,
        widthKot,
        widthInvoice,
        consolidatePrinting,
        bridgeUrl
      });
      toast.success("Printing preferences saved");
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      toast.error("Process failed");
    }
  };


  return (
    <Card className="border-slate-100 shadow-xl shadow-slate-200/40 p-0 overflow-hidden">
      <div className="bg-slate-50 p-6 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-500/20">
            <Printer size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Printer Hub</h3>
            <p className="text-[10px] font-medium text-slate-400">Manage network IDs and paper widths</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-8">
        <div className="grid gap-8 md:grid-cols-2">
          {/* KOT Printer Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-brand-50 rounded-lg w-fit">
              <Terminal size={12} className="text-brand-600" />
              <span className="text-[10px] font-black uppercase tracking-widest text-brand-600">KOT (Kitchen)</span>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Network Printer ID</label>
                <Input
                  value={printerIdKot}
                  onChange={(event) => setPrinterIdKot(event.target.value)}
                  placeholder="kitchen-1"
                  className="h-11 border-slate-100 focus:border-brand-500 font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Roll Width</label>
                <Dropdown
                  value={String(widthKot)}
                  options={[
                    { value: "58", label: "58mm (Small)" },
                    { value: "80", label: "80mm (Standard)" }
                  ]}
                  onChange={(value) => setWidthKot(Number(value))}
                />
              </div>
            </div>
          </div>

          {/* Invoice Printer Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 rounded-lg w-fit">
              <Share2 size={12} className="text-amber-600" />
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">Invoice & Tokens (Counter)</span>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Network Printer ID</label>
                <Input
                  value={printerIdInvoice}
                  onChange={(event) => setPrinterIdInvoice(event.target.value)}
                  placeholder="billing-pr-1"
                  className="h-11 border-slate-100 focus:border-brand-500 font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Roll Width</label>
                <Dropdown
                  value={String(widthInvoice)}
                  options={[
                    { value: "58", label: "58mm (Small)" },
                    { value: "80", label: "80mm (Standard)" }
                  ]}
                  onChange={(value) => setWidthInvoice(Number(value))}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bridge Configuration */}
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
          <div className="flex items-center gap-2">
            <Monitor size={16} className="text-slate-600" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Hardware Bridge</span>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">PC Bridge URL (Local IP)</label>
            <Input
              value={bridgeUrl}
              onChange={(e) => setBridgeUrl(e.target.value)}
              placeholder="http://192.168.1.100:4000"
              className="h-11 border-slate-100 focus:border-brand-500 font-bold"
            />
            <p className="text-[9px] text-slate-400 ml-1 mt-1 italic">Enter the local address of the computer running the print server.</p>
          </div>
        </div>

        {/* Consolidated Toggle */}
        <div className="md:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Monitor size={16} className="text-purple-600" />
              Consolidated 58mm Mode
            </h4>
            <p className="text-[10px] text-slate-500 mt-1 max-w-md">
              Combines KOT, Invoice, and Token into a single long slip. Ideal for food trucks and small counters using a single 58mm printer.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-black uppercase tracking-widest ${consolidatePrinting ? 'text-purple-600' : 'text-slate-400'}`}>{consolidatePrinting ? "Enabled" : "Disabled"}</span>
            <button
              onClick={() => setConsolidatePrinting(!consolidatePrinting)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${consolidatePrinting ? 'bg-purple-600' : 'bg-slate-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${consolidatePrinting ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>
        <div className="pt-6 border-t border-slate-50 flex justify-end">
          <Button
            className="h-12 px-10 gap-2 text-xs font-black uppercase tracking-widest shadow-lg shadow-brand-500/20 transition-all hover:scale-[1.02]"
            onClick={handleSave}
            disabled={status === "saving"}
          >
            {status === "saving" ? "Saving..." : <><Save size={18} /> Sync Network Printers</>}
          </Button>
        </div>
      </div>
    </Card >
  );
}
