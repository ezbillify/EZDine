"use client";

import { useEffect, useState } from "react";
import {
  Package,
  Plus,
  Trash2,
  AlertTriangle,
  History,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Search,
  CheckCircle2
} from "lucide-react";
import { toast, Toaster } from "sonner";

import { AuthGate } from "../../components/auth/AuthGate";
import { AppShell } from "../../components/layout/AppShell";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { supabase } from "../../lib/supabaseClient";
import { getCurrentUserProfile } from "../../lib/tenant";

export default function InventoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [search, setSearch] = useState("");

  // Form states
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [stock, setStock] = useState("");
  const [reorderLevel, setReorderLevel] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const profile = await getCurrentUserProfile();
      if (!profile?.active_restaurant_id || !profile.active_branch_id) return;

      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("branch_id", profile.active_branch_id)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setItems(data ?? []);
    } catch (err) {
      console.error("Inventory error:", err);
      toast.error("Failed to load inventory items");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !unit) return;

    try {
      const profile = await getCurrentUserProfile();
      if (!profile?.active_restaurant_id || !profile.active_branch_id) return;

      const { error } = await supabase.from("inventory_items").insert({
        restaurant_id: profile.active_restaurant_id,
        branch_id: profile.active_branch_id,
        name,
        unit,
        current_stock: Number(stock) || 0,
        reorder_level: Number(reorderLevel) || 0
      });

      if (error) throw error;

      toast.success("Inventory item added");
      setName("");
      setUnit("");
      setStock("");
      setReorderLevel("");
      setShowAddForm(false);
      load();
    } catch (err) {
      toast.error("Failed to add item");
    }
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase
      .from("inventory_items")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      toast.error("Failed to delete item");
    } else {
      toast.success("Item removed");
      load();
    }
  };

  const filteredItems = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  const lowStockItems = items.filter(i => i.current_stock <= i.reorder_level);

  return (
    <AuthGate>
      <AppShell title="Inventory" subtitle="Raw materials and stock control">
        <Toaster richColors />

        <div className="space-y-6">
          {/* Header Actions */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search inventory items..."
                className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm ring-brand-500/20 transition-all focus:border-brand-500 focus:outline-none focus:ring-4"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2">
                <History size={16} /> Movement Logs
              </Button>
              <Button className="gap-2" onClick={() => setShowAddForm(!showAddForm)}>
                {showAddForm ? <Trash2 size={16} /> : <Plus size={16} />}
                {showAddForm ? "Cancel" : "Add New Item"}
              </Button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
            <div className="space-y-6">
              {/* Add Form */}
              {showAddForm && (
                <Card title="Register New Raw Material" className="animate-slide-up border-brand-200 bg-brand-50/10">
                  <form onSubmit={createItem} className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Item Name</label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tomato, Milk, Chicken" required />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Unit of Measure</label>
                        <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg, ltr, pcs, pack" required />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Opening Stock</label>
                        <Input type="number" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="0.00" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Reorder Level</label>
                        <Input type="number" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} placeholder="Warn at..." />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="submit" className="px-8 shadow-lg shadow-brand-500/20">Create Item</Button>
                    </div>
                  </form>
                </Card>
              )}

              {/* Items List */}
              <Card className="overflow-hidden p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50">
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Item</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-center">Unit</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Current Stock</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-center">Status</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {loading ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-slate-400">Loading inventory items...</td>
                        </tr>
                      ) : items.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-slate-400">No inventory items found. Add some to get started!</td>
                        </tr>
                      ) : filteredItems.map((item) => {
                        const isLow = item.current_stock <= item.reorder_level;
                        return (
                          <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isLow ? 'bg-amber-100 text-amber-600' : 'bg-brand-50 text-brand-600'}`}>
                                  <Package size={16} />
                                </div>
                                <span className="font-bold text-slate-900">{item.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                                {item.unit}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className={`text-sm font-black ${isLow ? 'text-amber-600' : 'text-slate-900'}`}>
                                {item.current_stock}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex justify-center">
                                {isLow ? (
                                  <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase text-amber-600 ring-1 ring-inset ring-amber-200">
                                    <AlertTriangle size={12} /> Low Stock
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-600 ring-1 ring-inset ring-emerald-200">
                                    <CheckCircle2 size={12} /> Healthy
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-red-600" onClick={() => deleteItem(item.id)}>
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* Widgets Table Area */}
            <div className="space-y-6">
              <Card title="Quick Stats">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500 font-medium">Total Items</span>
                    <span className="text-sm font-bold text-slate-900">{items.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500 font-medium">Low Stock Alerts</span>
                    <span className={`text-sm font-bold ${lowStockItems.length > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{lowStockItems.length}</span>
                  </div>
                  <div className="pt-2">
                    <Button variant="outline" className="w-full text-xs font-bold uppercase tracking-wider py-1.5">Download Report</Button>
                  </div>
                </div>
              </Card>

              {lowStockItems.length > 0 && (
                <Card title="Restock Required" className="bg-amber-50/50 border-amber-100">
                  <div className="space-y-3">
                    {lowStockItems.slice(0, 5).map(item => (
                      <div key={item.id} className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{item.name}</p>
                          <p className="text-[10px] text-slate-500">{item.current_stock} remaining</p>
                        </div>
                        <Button variant="ghost" className="h-7 w-7 p-0 text-amber-600 hover:bg-amber-100">
                          <Plus size={14} />
                        </Button>
                      </div>
                    ))}
                    {lowStockItems.length > 5 && (
                      <p className="text-center text-[10px] font-medium text-slate-400">+{lowStockItems.length - 5} more items</p>
                    )}
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      </AppShell>
    </AuthGate>
  );
}
