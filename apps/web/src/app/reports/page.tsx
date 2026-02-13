"use client";

import { useEffect, useState } from "react";

import { AuthGate } from "../../components/auth/AuthGate";
import { AppShell } from "../../components/layout/AppShell";
import { Card } from "../../components/ui/Card";
import { Section } from "../../components/ui/Section";
import { StatCard } from "../../components/ui/StatCard";
import { supabase } from "../../lib/supabaseClient";
import { getCurrentUserProfile } from "../../lib/tenant";

export default function ReportsPage() {
  const [sales, setSales] = useState(0);
  const [orders, setOrders] = useState(0);
  const [tax, setTax] = useState(0);

  useEffect(() => {
    const load = async () => {
      const profile = await getCurrentUserProfile();
      if (!profile?.active_restaurant_id || !profile.active_branch_id) return;

      const { data: bills } = await supabase
        .from("bills")
        .select("total,tax")
        .eq("restaurant_id", profile.active_restaurant_id)
        .eq("branch_id", profile.active_branch_id);

      const { data: ordersData } = await supabase
        .from("orders")
        .select("id")
        .eq("branch_id", profile.active_branch_id);

      const totalSales = (bills ?? []).reduce((sum, b: any) => sum + Number(b.total || 0), 0);
      const totalTax = (bills ?? []).reduce((sum, b: any) => sum + Number(b.tax || 0), 0);

      setSales(totalSales);
      setTax(totalTax);
      setOrders(ordersData?.length ?? 0);
    };

    load();
  }, []);

  return (
    <AuthGate>
      <AppShell title="Reports" subtitle="Sales, tax, and branch comparison">
        <Section title="Today" description="Snapshot data">
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Sales" value={`₹ ${sales.toFixed(2)}`} />
            <StatCard label="Orders" value={orders} />
            <StatCard label="Tax" value={`₹ ${tax.toFixed(2)}`} />
          </div>
        </Section>
        <Section title="Report Center" description="More reports coming soon.">
          <Card>
            <p className="text-sm text-slate-600">Export and breakdown views will appear here.</p>
          </Card>
        </Section>
      </AppShell>
    </AuthGate>
  );
}
