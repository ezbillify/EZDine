"use client";

import { useEffect, useMemo, useState } from "react";
import { Hash, Save, Info, Building, MapPin, Braces } from "lucide-react";
import { toast } from "sonner";

import { getDocNumberingSettings, saveDocNumberingSettings } from "../../lib/printing";
import { getAccessibleBranches, getAccessibleRestaurants } from "../../lib/tenant";
import type { Branch, Restaurant } from "../../lib/supabaseTypes";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Dropdown } from "../ui/Dropdown";
import { Input } from "../ui/Input";

export function NumberingSettings() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [format, setFormat] = useState("{BRANCH}-{FY}-{SEQ}");
  const [status, setStatus] = useState<"idle" | "saving">("idle");

  useEffect(() => {
    const load = async () => {
      const [restaurantsData, branchesData] = await Promise.all([
        getAccessibleRestaurants(),
        getAccessibleBranches()
      ]);
      setRestaurants(restaurantsData);
      setBranches(branchesData);
      if (!restaurantId && restaurantsData[0]) setRestaurantId(restaurantsData[0].id);
      if (!branchId && branchesData[0]) setBranchId(branchesData[0].id);

      if (restaurantsData[0]) {
        const branchForLoad = branchesData[0] ?? null;
        const settings = await getDocNumberingSettings(
          restaurantsData[0].id,
          branchForLoad ? branchForLoad.id : null
        );
        if (settings?.format) setFormat(settings.format);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setStatus("saving");
    try {
      if (!restaurantId) return;
      await saveDocNumberingSettings(restaurantId, branchId ?? null, { format });
      toast.success("Document numbering logic updated");
    } catch (err) {
      toast.error("Failed to update numbering");
    } finally {
      setStatus("idle");
    }
  };

  const filteredBranches = useMemo(() => {
    if (!restaurantId) return branches;
    return branches.filter((b) => b.restaurant_id === restaurantId);
  }, [branches, restaurantId]);

  useEffect(() => {
    const loadSettings = async () => {
      if (!restaurantId) return;
      const settings = await getDocNumberingSettings(restaurantId, branchId ?? null);
      if (settings?.format) setFormat(settings.format);
    };
    loadSettings();
  }, [restaurantId, branchId]);

  return (
    <Card className="border-slate-100 shadow-xl shadow-slate-200/40 p-0 overflow-hidden">
      <div className="bg-slate-50 p-6 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20">
            <Hash size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Document Logic</h3>
            <p className="text-[10px] font-medium text-slate-400">Sequential numbering for tax compliance</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-8">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 mb-1">
              <Building size={14} className="text-slate-400" />
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Context</label>
            </div>
            <Dropdown
              value={restaurantId}
              options={restaurants.map((r) => ({ value: r.id, label: r.name }))}
              placeholder="Select restaurant"
              onChange={(value) => {
                setRestaurantId(value);
                const branch = branches.find((b) => b.restaurant_id === value);
                setBranchId(branch?.id ?? null);
              }}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 mb-1">
              <MapPin size={14} className="text-slate-400" />
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Branch Scope</label>
            </div>
            <Dropdown
              value={branchId ?? "ALL"}
              options={[
                { value: "ALL", label: "Global (Default)" },
                ...filteredBranches.map((b) => ({ value: b.id, label: b.name }))
              ]}
              placeholder="Select branch"
              onChange={(value) => setBranchId(value === "ALL" ? null : value)}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Braces size={14} className="text-indigo-500" />
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">String Format</label>
          </div>
          <Input
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            placeholder="{BRANCH}-{FY}-{SEQ}"
            className="h-12 border-slate-100 focus:border-indigo-500 font-mono font-bold text-lg"
          />

          <div className="grid grid-cols-3 gap-3">
            {[
              { token: "{BRANCH}", desc: "Branch Code" },
              { token: "{FY}", desc: "Financial Year" },
              { token: "{SEQ}", desc: "Sequential #" }
            ].map(t => (
              <div key={t.token} className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <p className="text-[10px] font-black text-indigo-600 font-mono mb-1">{t.token}</p>
                <p className="text-[10px] font-medium text-slate-400">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
          <div className="flex flex-col">
            <p className="text-[10px] font-black uppercase text-slate-400">Preview Pattern</p>
            <p className="text-sm font-bold text-indigo-700 font-mono">{format.replace('{BRANCH}', 'MUM').replace('{FY}', '2425').replace('{SEQ}', '001')}</p>
          </div>
          <Button
            className="h-12 px-10 gap-2 text-xs font-black uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.02]"
            onClick={handleSave}
            disabled={status === "saving"}
          >
            {status === "saving" ? "Saving..." : <><Save size={18} /> Update Logic</>}
          </Button>
        </div>
      </div>
    </Card>
  );
}
