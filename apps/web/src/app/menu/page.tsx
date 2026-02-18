"use client";

import { useEffect, useState } from "react";

import { AuthGate } from "../../components/auth/AuthGate";
import { AppShell } from "../../components/layout/AppShell";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Dropdown } from "../../components/ui/Dropdown";
import { toast, Toaster } from "sonner";
import { supabase } from "../../lib/supabaseClient";
import { getAccessibleBranches, getActiveRestaurantRole, getCurrentUserProfile } from "../../lib/tenant";
import { Leaf, Flame, Egg } from "lucide-react";

export default function MenuPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("0");
  const [categoryId, setCategoryId] = useState<string>("");
  const [gstRate, setGstRate] = useState("5");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [dietary, setDietary] = useState<"veg" | "non-veg" | "egg">("veg");

  const load = async () => {
    try {
      const profile = await getCurrentUserProfile();
      if (!profile?.active_restaurant_id) return;

      const branchesData = await getAccessibleBranches(profile.active_restaurant_id);
      setBranches(branchesData ?? []);

      const active = branchId ?? profile.active_branch_id ?? branchesData?.[0]?.id ?? null;
      if (active !== branchId) setBranchId(active);

      const roleData = await getActiveRestaurantRole();
      setRole(roleData);

      if (!active) return;

      const { data: cat, error: catError } = await supabase
        .from("menu_categories")
        .select("*")
        .eq("branch_id", active)
        .order("name");

      if (catError) throw catError;

      const { data: it, error: itError } = await supabase
        .from("menu_items")
        .select("*, menu_categories(name)")
        .eq("branch_id", active)
        .order("name");

      if (itError) throw itError;

      setCategories(cat ?? []);
      setItems(it ?? []);
      if (!categoryId && cat && cat[0]) setCategoryId(cat[0].id);
    } catch (error) {
      console.error("Menu load error:", error);
      toast.error("Failed to load menu data. Ensure database schema is updated.");
    }
  };

  useEffect(() => {
    load();
  }, [branchId]);

  const createCategory = async () => {
    try {
      const profile = await getCurrentUserProfile();
      if (!profile?.active_restaurant_id || !branchId) {
        toast.error("Select a branch first");
        return;
      }
      if (editingCategoryId) {
        const { error } = await supabase
          .from("menu_categories")
          .update({ name: categoryName })
          .eq("id", editingCategoryId);
        if (error) throw error;
        toast.success("Category updated");
        setEditingCategoryId(null);
      } else {
        const { error } = await supabase.from("menu_categories").insert({
          restaurant_id: profile.active_restaurant_id,
          branch_id: branchId,
          name: categoryName
        });
        if (error) throw error;
        toast.success(`Category "${categoryName}" added`);
      }
      setCategoryName("");
      load();
    } catch (error) {
      toast.error(editingCategoryId ? "Failed to update category" : "Failed to create category");
      console.error(error);
    }
  };

  const createItem = async () => {
    try {
      const profile = await getCurrentUserProfile();
      if (!profile?.active_restaurant_id || !branchId) {
        toast.error("Select a branch first");
        return;
      }
      if (editingItemId) {
        const { error } = await supabase
          .from("menu_items")
          .update({
            category_id: categoryId || null,
            name: itemName,
            base_price: Number(itemPrice),
            gst_rate: Number(gstRate),
            is_veg: dietary === "veg",
            is_egg: dietary === "egg"
          })
          .eq("id", editingItemId);
        if (error) throw error;
        toast.success("Item updated");
        setEditingItemId(null);
      } else {
        const { error } = await supabase.from("menu_items").insert({
          restaurant_id: profile.active_restaurant_id,
          branch_id: branchId,
          category_id: categoryId || null,
          name: itemName,
          base_price: Number(itemPrice),
          gst_rate: Number(gstRate),
          is_veg: dietary === "veg",
          is_egg: dietary === "egg"
        });
        if (error) throw error;
        toast.success(`Item "${itemName}" added`);
      }
      setItemName("");
      setItemPrice("0");
      setDietary("veg");
      load();
    } catch (error) {
      toast.error(editingItemId ? "Failed to update item" : "Failed to create item");
      console.error(error);
    }
  };

  return (
    <AuthGate>
      <AppShell title="Menu" subtitle="Manage categories, items, and addons">
        <Toaster richColors position="top-right" />
        <div className="mb-6">
          <Card>
            <div className="flex items-center gap-4">
              <span className="text-sm font-bold text-slate-500 uppercase">Manage Branch:</span>
              <div className="w-64">
                <Dropdown
                  value={branchId}
                  options={branches.map((b) => ({ value: b.id, label: b.name }))}
                  placeholder="Select branch"
                  onChange={(value) => setBranchId(value)}
                />
              </div>
            </div>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title={editingCategoryId ? "Edit Category" : "Add Category"}>
            <div className="flex gap-2">
              <Input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="Category name" />
              <Button onClick={createCategory} disabled={!categoryName || !branchId}>
                {editingCategoryId ? "Update" : "Add"}
              </Button>
              {editingCategoryId && (
                <Button variant="ghost" onClick={() => {
                  setEditingCategoryId(null);
                  setCategoryName("");
                }}>Cancel</Button>
              )}
            </div>
          </Card>
          <Card title={editingItemId ? "Edit Item" : "Add Item"}>
            <div className="grid gap-2">
              <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Item name" />
              <Input value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} placeholder="Price" />
              <Dropdown
                value={categoryId}
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="Select category"
                onChange={(value) => setCategoryId(value)}
              />
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-slate-400">GST %</span>
                <Dropdown
                  value={gstRate || "0"}
                  options={[
                    { value: "0", label: "0% (Exempt)" },
                    { value: "5", label: "5% (Standard)" },
                    { value: "12", label: "12%" },
                    { value: "18", label: "18%" },
                    { value: "28", label: "28%" }
                  ]}
                  onChange={(val) => setGstRate(val)}
                />
              </div>
              <div className="flex gap-2">
                {[
                  { id: "veg", label: "Veg", icon: Leaf, color: "text-green-600", bg: "bg-green-50", border: "border-green-200" },
                  { id: "egg", label: "Egg", icon: Egg, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
                  { id: "non-veg", label: "Non-Veg", icon: Flame, color: "text-red-600", bg: "bg-red-50", border: "border-red-200" }
                ].map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setDietary(type.id as any)}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-lg border p-2 text-[10px] font-bold uppercase transition-all ${dietary === type.id ? `${type.bg} ${type.border} ${type.color}` : "bg-white text-slate-400 border-slate-100 hover:border-slate-300"
                      }`}
                  >
                    <type.icon size={12} />
                    {type.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={createItem} disabled={!itemName || !branchId}>
                  {editingItemId ? "Update Item" : "Add Item (Inclusive)"}
                </Button>
                {editingItemId && (
                  <Button variant="ghost" onClick={() => {
                    setEditingItemId(null);
                    setItemName("");
                    setItemPrice("0");
                    setDietary("veg");
                  }}>Cancel</Button>
                )}
              </div>
            </div>
          </Card>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card title="Categories">
            <ul className="space-y-2 text-sm">
              {categories.map((c) => (
                <li key={c.id} className="flex items-center justify-between">
                  <span className="font-bold">{c.name}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" className="text-blue-500" onClick={() => {
                      setEditingCategoryId(c.id);
                      setCategoryName(c.name);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}>
                      Edit
                    </Button>
                    <Button variant="ghost" className="text-red-400" onClick={() => supabase.from("menu_categories").delete().eq("id", c.id).then(load)}>
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Items">
            <ul className="space-y-4 text-sm">
              {items.map((i) => (
                <li key={i.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${i.is_veg ? "bg-green-50 text-green-600" : i.is_egg ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"}`}>
                      {i.is_veg ? <Leaf size={18} /> : i.is_egg ? <Egg size={18} /> : <Flame size={18} />}
                    </div>
                    <div>
                      <p className="font-bold">{i.name}</p>
                      <p className="text-xs text-slate-500 uppercase">
                        {i.menu_categories?.name || "Uncategorized"} · ₹{i.base_price} (Inc. {i.gst_rate ?? 0}% Tax)
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" className="text-blue-500" onClick={() => {
                      setEditingItemId(i.id);
                      setItemName(i.name);
                      setItemPrice(i.base_price.toString());
                      setCategoryId(i.category_id || "");
                      setGstRate(i.gst_rate?.toString() || "0");
                      setDietary(i.is_egg ? "egg" : (i.is_veg ? "veg" : "non-veg") as any);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}>
                      Edit
                    </Button>
                    <Button variant="ghost" className="text-red-500" onClick={() => supabase.from("menu_items").delete().eq("id", i.id).then(load)}>
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </AppShell>
    </AuthGate>
  );
}
