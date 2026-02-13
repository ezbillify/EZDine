"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AuthGate } from "../../components/auth/AuthGate";
import { AppShell } from "../../components/layout/AppShell";
import { BranchCard } from "../../components/branch/BranchCard";
import { getAccessibleBranches, getCurrentUserProfile, setActiveBranch } from "../../lib/tenant";
import type { Branch } from "../../lib/supabaseTypes";

export default function SelectBranchPage() {
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setStatus("loading");
      setError(null);
      try {
        const profile = await getCurrentUserProfile();
        const data = await getAccessibleBranches(profile?.active_restaurant_id ?? undefined);
        if (!mounted) return;
        setBranches(data);
        setStatus("idle");

        if (data.length === 1 && data[0]) {
          await setActiveBranch(data[0].id);
          router.replace("/dashboard");
        }
      } catch (err) {
        if (!mounted) return;
        setStatus("error");
        setError(err instanceof Error ? err.message : "Failed to load branches");
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const handleSelect = async (branchId: string) => {
    await setActiveBranch(branchId);
    router.replace("/dashboard");
  };

  const content = useMemo(() => {
    if (status === "loading") {
      return <p className="text-sm text-slate-600">Loading branches...</p>;
    }
    if (status === "error") {
      return <p className="text-sm text-rose-600">{error}</p>;
    }
    if (branches.length === 0) {
      return <p className="text-sm text-slate-600">No branches assigned.</p>;
    }
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {branches.map((branch) => (
          <BranchCard key={branch.id} branch={branch} onSelect={handleSelect} />
        ))}
      </div>
    );
  }, [branches, error, status]);

  return (
    <AuthGate enforceContext={false}>
      <AppShell
        title="Select Branch"
        subtitle="Choose the branch you are working on"
        showNav={false}
        showUserMenu={false}
      >
        <div className="rounded-3xl border border-white/60 bg-white/70 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Available branches</h2>
          <p className="mt-2 text-sm text-slate-600">
            Select the branch to open orders and billing.
          </p>
        </div>
        <div className="mt-6">{content}</div>
      </AppShell>
    </AuthGate>
  );
}
