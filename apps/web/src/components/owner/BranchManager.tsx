"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, MapPin, Trash2, Edit3, Building, Phone, Home, Search, Globe } from "lucide-react";
import { toast } from "sonner";

import { createBranch, deleteBranch, updateBranch } from "../../lib/owner";
import { getPrintingSettings } from "../../lib/printing";
import { getAccessibleBranches, getAccessibleRestaurants } from "../../lib/tenant";
import type { Branch, Restaurant } from "../../lib/supabaseTypes";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Dropdown } from "../ui/Dropdown";

export function BranchManager() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [restaurantId, setRestaurantId] = useState<string>("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [gstin, setGstin] = useState("");
  const [fssai, setFssai] = useState("");
  const [status, setStatus] = useState<"idle" | "saving">("idle");

  const resetForm = () => {
    setName("");
    setCode("");
    setAddress("");
    setPhone("");
    setGstin("");
    setFssai("");
    setEditingBranch(null);
  };

  const load = async () => {
    const [restaurantsData, branchesData] = await Promise.all([
      getAccessibleRestaurants(),
      getAccessibleBranches()
    ]);
    setRestaurants(restaurantsData);
    setBranches(branchesData);
    if (!restaurantId && restaurantsData[0]) {
      setRestaurantId(restaurantsData[0].id);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredBranches = useMemo(() => {
    if (!restaurantId) return branches;
    return branches.filter((branch) => branch.restaurant_id === restaurantId);
  }, [branches, restaurantId]);

  const restaurantMap = useMemo(() => {
    const map = new Map<string, string>();
    restaurants.forEach((restaurant) => map.set(restaurant.id, restaurant.name));
    return map;
  }, [restaurants]);

  const handleCreate = async () => {
    if (!restaurantId || !name) return;
    setStatus("saving");
    try {
      if (editingBranch) {
        await updateBranch(editingBranch.id, {
          name,
          address,
          phone,
          gstin,
          fssai_no: fssai
        });
        toast.success("Branch details modified");
      } else {
        await createBranch({ restaurant_id: restaurantId, name, address, phone, gstin, fssai_no: fssai, code: code || null });
        toast.success(`Unit ${name} is now operational`);
      }
      resetForm();
      await load();
    } catch (err: any) {
      toast.error(err.message || "Operation failed");
    } finally {
      setStatus("idle");
    }
  };

  const handleEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setRestaurantId(branch.restaurant_id);
    setName(branch.name);
    setCode(branch.code || "");
    setAddress(branch.address || "");
    setPhone(branch.phone || "");
    setGstin(branch.gstin || "");
    setFssai(branch.fssai_no || "");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (branch: Branch) => {
    if (!confirm(`Shut down ${branch.name}? This will archive all local data.`)) return;
    try {
      await deleteBranch(branch.id);
      toast.success("Branch archived");
      await load();
    } catch (err) {
      toast.error("Access denied");
    }
  };

  return (
    <div className="grid gap-6">
      <Card className="border-slate-100 shadow-xl shadow-slate-200/40 p-0 overflow-hidden">
        <div className="bg-slate-50 p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${editingBranch ? 'bg-amber-500' : 'bg-brand-600'} text-white shadow-lg`}>
              {editingBranch ? <Edit3 size={20} /> : <Plus size={20} />}
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">
                {editingBranch ? `Edit ${editingBranch.name}` : 'Add New Unit'}
              </h3>
              <p className="text-[10px] font-medium text-slate-400">
                {editingBranch ? 'Modify location and compliance details' : 'Launch a new branch location'}
              </p>
            </div>
          </div>
          {editingBranch && (
            <Button variant="ghost" onClick={resetForm} className="text-xs font-bold text-slate-400 hover:text-slate-900">
              CANCEL EDIT
            </Button>
          )}
        </div>

        <div className="p-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Parent Entity</label>
              <Dropdown
                value={restaurantId}
                options={restaurants.map((restaurant) => ({
                  value: restaurant.id,
                  label: restaurant.name
                }))}
                placeholder="Select restaurant"
                onChange={(value) => setRestaurantId(value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Branch Name</label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Indiranagar Square"
                className="h-12 border-slate-100 focus:border-brand-500 font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Internal Reference Code</label>
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="e.g. BLR01"
                className="h-12 border-slate-100 focus:border-brand-500 font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Contact Number</label>
              <div className="relative">
                <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                <Input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+91..."
                  className="h-12 border-slate-100 focus:border-brand-500 font-bold pl-10"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">GSTIN</label>
              <Input
                value={gstin}
                onChange={(event) => setGstin(event.target.value)}
                placeholder="e.g. 29AAAAA0000A1Z5"
                className="h-12 border-slate-100 focus:border-brand-500 font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">FSSAI License</label>
              <Input
                value={fssai}
                onChange={(event) => setFssai(event.target.value)}
                placeholder="e.g. 12345678901234"
                className="h-12 border-slate-100 focus:border-brand-500 font-bold"
              />
            </div>
            <div className="md:col-span-2 space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Physical Address</label>
              <div className="relative">
                <Home size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                <Input
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="Street, Area, City..."
                  className="h-12 border-slate-100 focus:border-brand-500 font-bold pl-10"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              className={`h-12 px-10 gap-2 text-xs font-black uppercase tracking-widest shadow-lg transition-all hover:scale-[1.02] ${editingBranch ? 'bg-amber-500 hover:bg-amber-600' : ''}`}
              onClick={handleCreate}
              disabled={!restaurantId || !name || status === 'saving'}
            >
              {status === 'saving' ? 'Processing...' : (editingBranch ? 'Save Modifications' : 'Provision Branch')}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="border-slate-100 shadow-xl shadow-slate-200/40 p-0 overflow-hidden">
        <div className="bg-slate-50 p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20">
              <Globe size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Branch Network</h3>
              <p className="text-[10px] font-medium text-slate-400">Total {filteredBranches.length} locations under {restaurantMap.get(restaurantId)}</p>
            </div>
          </div>
        </div>

        <div className="p-4">
          <div className="space-y-4">
            {filteredBranches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Search size={32} className="opacity-10 mb-2" />
                <p className="text-xs font-bold uppercase tracking-widest opacity-50">No Locations Found</p>
              </div>
            ) : (
              filteredBranches.map((branch) => (
                <div key={branch.id} className="group flex items-center justify-between p-4 rounded-3xl border border-slate-100 bg-white hover:bg-slate-50 transition-all">
                  <div className="flex items-center gap-5">
                    <div className="h-14 w-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 group-hover:bg-brand-50 group-hover:text-brand-600 group-hover:border-brand-100 transition-all">
                      <Building size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-black text-slate-900">{branch.name}</p>
                        <span className="px-2 py-0.5 rounded-lg bg-slate-900 text-[9px] font-black text-white uppercase tracking-tighter">{branch.code ?? "UNIT"}</span>
                      </div>
                      <p className="text-[10px] font-medium text-slate-500 max-w-[300px] truncate leading-normal flex items-center gap-1">
                        <MapPin size={10} /> {branch.address || "Address not set"}
                      </p>
                      <div className="flex gap-3 mt-1">
                        {branch.gstin && <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">GST: {branch.gstin}</span>}
                        {branch.fssai_no && <span className="text-[8px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">FSSAI: {branch.fssai_no}</span>}
                      </div>
                      <p className="text-[9px] font-bold text-brand-600 uppercase tracking-widest mt-1">
                        {restaurantMap.get(branch.restaurant_id)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" className="h-10 w-10 p-0 bg-white border border-slate-200 shadow-sm text-slate-600 hover:text-brand-600 hover:border-brand-200 rounded-xl transition-all" onClick={() => handleEdit(branch)}>
                      <Edit3 size={16} />
                    </Button>
                    <Button variant="ghost" className="h-10 w-10 p-0 bg-white border border-slate-200 shadow-sm text-slate-600 hover:text-rose-600 hover:border-rose-200 rounded-xl transition-all" onClick={() => handleDelete(branch)}>
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
