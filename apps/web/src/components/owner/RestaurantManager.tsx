"use client";

import { useEffect, useState } from "react";
import { Plus, Store, Trash2, Edit3, Image as ImageIcon, Search } from "lucide-react";
import { toast } from "sonner";

import { createRestaurant, deleteRestaurant, updateRestaurant } from "../../lib/owner";
import { getAccessibleRestaurants } from "../../lib/tenant";
import type { Restaurant } from "../../lib/supabaseTypes";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";

export function RestaurantManager() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [name, setName] = useState("");
  const [logo, setLogo] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  const load = async () => {
    const data = await getAccessibleRestaurants();
    setRestaurants(data);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    if (!name) return;
    setStatus("saving");
    try {
      await createRestaurant({ name, logo: logo || null });
      toast.success(`${name} added to your portfolio`);
      setName("");
      setLogo("");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to create restaurant");
    } finally {
      setStatus("idle");
    }
  };

  const handleRename = async (restaurant: Restaurant) => {
    const updatedName = prompt("New restaurant name", restaurant.name);
    if (!updatedName) return;
    try {
      await updateRestaurant(restaurant.id, { name: updatedName, logo: restaurant.logo });
      toast.success("Updated successfully");
      await load();
    } catch (err) {
      toast.error("Operation failed");
    }
  };

  const handleDelete = async (restaurant: Restaurant) => {
    if (!confirm(`Permanently delete ${restaurant.name}? This action CANNOT be undone and will erase all data.`)) return;
    try {
      await deleteRestaurant(restaurant.id);
      toast.success("Restaurant removed");
      await load();
    } catch (err) {
      toast.error("Delete operation restricted");
    }
  };

  return (
    <div className="grid gap-6">
      <Card className="border-slate-100 shadow-xl shadow-slate-200/40 p-0 overflow-hidden">
        <div className="bg-slate-50 p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-500/20">
              <Plus size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">New Restaurant</h3>
              <p className="text-[10px] font-medium text-slate-400">Expand your business portfolio</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Legal Name</label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. The Grand Bistro"
                className="h-12 border-slate-100 focus:border-brand-500 font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Brand Logo URL</label>
              <div className="relative">
                <ImageIcon size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                <Input
                  value={logo}
                  onChange={(event) => setLogo(event.target.value)}
                  placeholder="https://..."
                  className="h-12 border-slate-100 focus:border-brand-500 font-bold pl-10"
                />
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button
              className="h-12 px-10 gap-2 text-xs font-black uppercase tracking-widest shadow-lg shadow-brand-500/20 transition-all hover:scale-[1.02]"
              onClick={handleCreate}
              disabled={!name || status === "saving"}
            >
              {status === "saving" ? "Provisioning..." : "Create Organization"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="border-slate-100 shadow-xl shadow-slate-200/40 p-0 overflow-hidden">
        <div className="bg-slate-50 p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20">
              <Store size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Active Portfolio</h3>
              <p className="text-[10px] font-medium text-slate-400">Total {restaurants.length} Restaurants</p>
            </div>
          </div>
        </div>

        <div className="p-4">
          <div className="space-y-2">
            {restaurants.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Search size={32} className="opacity-10 mb-2" />
                <p className="text-xs font-bold uppercase tracking-widest opacity-50">Empty Portfolio</p>
              </div>
            ) : (
              restaurants.map((restaurant) => (
                <div key={restaurant.id} className="group flex items-center justify-between p-4 rounded-2xl border border-transparent hover:border-slate-100 hover:bg-slate-50/50 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center shadow-sm overflow-hidden">
                      {restaurant.logo ? (
                        <img src={restaurant.logo} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Store size={20} className="text-slate-300" />
                      )}
                    </div>
                    <div>
                      <p className="font-black text-slate-900 leading-none mb-1">{restaurant.name}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">ID: {restaurant.id}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" className="h-9 w-9 p-0 bg-white border border-slate-200 shadow-sm text-slate-600 hover:text-brand-600 hover:border-brand-200 rounded-xl" onClick={() => handleRename(restaurant)}>
                      <Edit3 size={14} />
                    </Button>
                    <Button variant="ghost" className="h-9 w-9 p-0 bg-white border border-slate-200 shadow-sm text-slate-600 hover:text-rose-600 hover:border-rose-200 rounded-xl" onClick={() => handleDelete(restaurant)}>
                      <Trash2 size={14} />
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
