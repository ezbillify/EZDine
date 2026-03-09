"use client";

import { useEffect, useState, useCallback } from "react";

import { AuthGate } from "../../components/auth/AuthGate";
import { AppShell } from "../../components/layout/AppShell";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Dropdown } from "../../components/ui/Dropdown";
import { Input } from "../../components/ui/Input";
import { toast, Toaster } from "sonner";
import { supabase } from "../../lib/supabaseClient";
import { getAccessibleBranches, getCurrentUserProfile } from "../../lib/tenant";

type Table = {
  id: string;
  name: string;
  capacity: number;
};

type Branch = {
  id: string;
  name: string;
};

export default function TablesPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("4");

  const load = useCallback(async () => {
    try {
      const profile = await getCurrentUserProfile();
      if (!profile?.active_restaurant_id) return;
      const branchesData = await getAccessibleBranches(profile.active_restaurant_id);
      setBranches((branchesData as Branch[]) ?? []);

      const active = branchId ?? profile.active_branch_id ?? branchesData?.[0]?.id ?? null;
      if (active !== branchId) setBranchId(active);

      if (!active) return;

      const { data, error } = await supabase
        .from("tables")
        .select("*")
        .eq("restaurant_id", profile.active_restaurant_id)
        .eq("branch_id", active)
        .order("name");

      if (error) throw error;
      setTables((data as Table[]) ?? []);
    } catch (error: unknown) {
      console.error("Tables load error:", error);
      toast.error("Failed to load tables");
    }
  }, [branchId]);

  useEffect(() => {
    load();
  }, [load]);

  const createTable = async () => {
    try {
      const profile = await getCurrentUserProfile();
      if (!profile?.active_restaurant_id || !branchId) {
        toast.error("Select a branch first");
        return;
      }
      const { error } = await supabase.from("tables").insert({
        restaurant_id: profile.active_restaurant_id,
        branch_id: branchId,
        name,
        capacity: Number(capacity)
      });
      if (error) throw error;

      toast.success(`Table "${name}" created`);
      setName("");
      setCapacity("4");
      load();
    } catch (error: unknown) {
      toast.error("Failed to create table");
      console.error(error);
    }
  };

  const deleteTable = async (id: string, tableName: string) => {
    try {
      const { error } = await supabase.from("tables").delete().eq("id", id);
      if (error) throw error;
      toast.success(`Table "${tableName}" deleted`);
      load();
    } catch (error: unknown) {
      toast.error("Failed to delete table");
      console.error(error);
    }
  };

  return (
    <AuthGate>
      <AppShell title="Tables" subtitle="Visual table layout and queue">
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

        <Card title="Add Table">
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Table name (e.g. T1)" />
            <Input value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="Capacity" />
            <Button onClick={createTable} disabled={!name || !branchId}>Add Table</Button>
          </div>
        </Card>
        <Card title="Tables" className="mt-6">
          <ul className="space-y-2 text-sm">
            {tables.map((t) => (
              <li key={t.id} className="flex items-center justify-between">
                <span>{t.name} · {t.capacity} seats</span>
                <Button variant="ghost" className="text-red-500" onClick={() => deleteTable(t.id, t.name)}>
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      </AppShell>
    </AuthGate>
  );
}
