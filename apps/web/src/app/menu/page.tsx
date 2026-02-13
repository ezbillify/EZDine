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
      const { error } = await supabase.from("menu_categories").insert({
        restaurant_id: profile.active_restaurant_id,
        branch_id: branchId,
        name: categoryName
      });
      if (error) throw error;

      toast.success(`Category "${categoryName}" added`);
      setCategoryName("");
      load();
    } catch (error) {
      toast.error("Failed to create category");
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
      const { error } = await supabase.from("menu_items").insert({
        restaurant_id: profile.active_restaurant_id,
        branch_id: branchId,
        category_id: categoryId || null,
        name: itemName,
        base_price: Number(itemPrice)
      });
      if (error) throw error;

      toast.success(`Item "${itemName}" added`);
      setItemName("");
      setItemPrice("0");
      load();
    } catch (error) {
      toast.error("Failed to create item");
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
          <Card title="Add Category">
            <div className="flex gap-2">
              <Input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="Category name" />
              <Button onClick={createCategory} disabled={!categoryName || !branchId}>Add</Button>
            </div>
          </Card>
          <Card title="Add Item">
            <div className="grid gap-2">
              <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Item name" />
              <Input value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} placeholder="Price" />
              <Dropdown
                value={categoryId}
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="Select category"
                onChange={(value) => setCategoryId(value)}
              />
              <Button onClick={createItem} disabled={!itemName || !branchId}>Add Item</Button>
            </div>
          </Card>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card title="Categories">
            <ul className="space-y-2 text-sm">
              {categories.map((c) => (
                <li key={c.id} className="flex items-center justify-between">
                  <span>{c.name}</span>
                  <Button variant="ghost" onClick={() => supabase.from("menu_categories").delete().eq("id", c.id).then(load)}>
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Items">
            <ul className="space-y-4 text-sm">
              {items.map((i) => (
                <li key={i.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div>
                    <p className="font-bold">{i.name}</p>
                    <p className="text-xs text-slate-500 uppercase">
                      {i.menu_categories?.name || "Uncategorized"} · ₹{i.base_price}
                    </p>
                  </div>
                  <Button variant="ghost" className="text-red-500" onClick={() => supabase.from("menu_items").delete().eq("id", i.id).then(load)}>
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </AppShell>
    </AuthGate>
  );
}
