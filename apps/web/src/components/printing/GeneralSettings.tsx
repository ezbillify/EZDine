"use client";

import { useEffect, useState } from "react";
import { Settings, Save, AlertCircle, CreditCard, Percent } from "lucide-react";
import { toast } from "sonner";

import { getPrintingSettings, savePrintingSettings } from "../../lib/printing";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";

export function GeneralSettings() {
  const [gst, setGst] = useState("5,12,18");
  const [paymentModes, setPaymentModes] = useState("cash,upi,card");
  const [status, setStatus] = useState<"idle" | "saving">("idle");

  useEffect(() => {
    const load = async () => {
      const settings = await getPrintingSettings();
      if (settings?.gst) setGst(settings.gst.join(", "));
      if (settings?.paymentModes) setPaymentModes(settings.paymentModes.join(", "));
    };
    load();
  }, []);

  const handleSave = async () => {
    setStatus("saving");
    try {
      const payload = {
        gst: gst.split(",").map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n)),
        paymentModes: paymentModes.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
      };
      const current = (await getPrintingSettings()) ?? {};
      await savePrintingSettings({ ...current, ...payload });
      toast.success("System configurations updated");
    } catch (err) {
      toast.error("Failed to save settings");
    } finally {
      setStatus("idle");
    }
  };

  return (
    <Card className="border-slate-100 shadow-xl shadow-slate-200/40 p-0 overflow-hidden">
      <div className="bg-slate-50 p-6 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-500/20">
            <Settings size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">General Controls</h3>
            <p className="text-[10px] font-medium text-slate-400">Configure core operational parameters</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Percent size={14} className="text-brand-500" />
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">GST Slabs (%)</label>
            </div>
            <Input
              value={gst}
              onChange={(e) => setGst(e.target.value)}
              placeholder="e.g. 5, 12, 18"
              className="h-12 border-slate-100 focus:border-brand-500 font-bold"
            />
            <p className="text-[10px] text-slate-400 pl-1 italic">Comma separated percentages for menu items</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard size={14} className="text-brand-500" />
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Payment Modes</label>
            </div>
            <Input
              value={paymentModes}
              onChange={(e) => setPaymentModes(e.target.value)}
              placeholder="e.g. cash, upi, card"
              className="h-12 border-slate-100 focus:border-brand-500 font-bold"
            />
            <p className="text-[10px] text-slate-400 pl-1 italic">Order of appearance in checkout screens</p>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full">
            <AlertCircle size={14} />
            Requires POS Refresh to Sync
          </div>
          <Button
            className="h-12 px-8 gap-2 text-xs font-black uppercase tracking-widest shadow-lg shadow-brand-500/20 transition-all hover:scale-[1.02]"
            onClick={handleSave}
            disabled={status === "saving"}
          >
            {status === "saving" ? "Updating..." : <><Save size={18} /> Apply Changes</>}
          </Button>
        </div>
      </div>
    </Card>
  );
}
