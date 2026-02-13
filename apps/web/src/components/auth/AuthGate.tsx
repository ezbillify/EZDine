"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { supabase } from "../../lib/supabaseClient";
import {
  getAccessibleBranches,
  getAccessibleRestaurants,
  getActiveBranchRole,
  getActiveRestaurantRole,
  getCurrentUserProfile,
  setActiveBranch,
  setActiveRestaurant
} from "../../lib/tenant";

type AuthGateProps = {
  children: React.ReactNode;
  enforceContext?: boolean;
};

export function AuthGate({ children, enforceContext = true }: AuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const cacheKey = "ezdine_ctx";
    const cacheTtlMs = 2 * 60 * 1000;

    const init = async () => {
      try {
        if (enforceContext && typeof window !== "undefined") {
          const cached = window.sessionStorage.getItem(cacheKey);
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              if (Date.now() - parsed.ts < cacheTtlMs) {
                setReady(true);
                // Validate in background without blocking navigation
                setTimeout(() => {
                  initFullCheck().catch(() => { });
                }, 0);
                return;
              }
            } catch {
              // ignore cache errors
            }
          }
        }

        await initFullCheck();
      } catch (err) {
        if (!mounted) return;
        const message =
          err instanceof Error
            ? err.message
            : typeof err === "string"
              ? err
              : "Failed to initialize session";
        console.error("AuthGate init failed:", err);
        setError(message);
      }
    };

    const initFullCheck = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (!data.session) {
        router.replace("/login");
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      // Relaxed check: trust the session for now. 
      // OTP login verifies email implicitly.

      if (!enforceContext) {
        setReady(true);
        return;
      }

      const [profileData, restaurants] = await Promise.all([
        getCurrentUserProfile(),
        getAccessibleRestaurants()
      ]);
      let profile = profileData;

      if (restaurants.length === 0) {
        router.replace("/onboarding");
        return;
      }

      if (!profile?.active_restaurant_id) {
        if (restaurants.length === 1 && restaurants[0]) {
          await setActiveRestaurant(restaurants[0].id);
          profile = { ...profile as any, active_restaurant_id: restaurants[0].id, active_branch_id: null };
        } else {
          router.replace("/select-restaurant");
          return;
        }
      } else if (!restaurants.find((r) => r.id === profile?.active_restaurant_id)) {
        router.replace("/select-restaurant");
        return;
      }

      const branches = await getAccessibleBranches(profile?.active_restaurant_id ?? undefined);

      if (!profile?.active_branch_id) {
        if (branches.length === 0) {
          const restaurantRole = await getActiveRestaurantRole();
          if (restaurantRole === "owner") {
            router.replace("/owner");
            return;
          }
          router.replace("/select-branch");
          return;
        }
        if (branches.length === 1 && branches[0]) {
          await setActiveBranch(branches[0].id);
          profile = { ...profile as any, active_branch_id: branches[0].id };
        } else {
          router.replace("/select-branch");
          return;
        }
      } else if (!branches.find((b) => b.id === profile?.active_branch_id)) {
        router.replace("/select-branch");
        return;
      }

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          cacheKey,
          JSON.stringify({
            ts: Date.now(),
            restaurantId: profile?.active_restaurant_id ?? null,
            branchId: profile?.active_branch_id ?? null
          })
        );
      }

      // Role-based landing logic (only trigger once per session or on root)
      const landed = typeof window !== 'undefined' && window.sessionStorage.getItem('ez_landed') === 'true';
      if (!landed && (pathname === "/dashboard" || pathname === "/")) {
        const branchRole = await getActiveBranchRole();
        if (typeof window !== 'undefined') window.sessionStorage.setItem('ez_landed', 'true');

        if (branchRole === "kitchen") {
          router.replace("/kds");
          return;
        }
        // Redirect to POS by default as requested
        router.replace("/pos");
        return;
      }

      setReady(true);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/login");
      }
    });

    init();

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  // Handle Idle Timeout to POS (10 mins)
  useEffect(() => {
    if (!ready || pathname === "/pos" || pathname === "/kds" || pathname === "/login") return;

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        router.replace("/pos");
      }, 10 * 60 * 1000); // 10 minutes
    };

    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];
    events.forEach((name) => document.addEventListener(name, resetTimer));

    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach((name) => document.removeEventListener(name, resetTimer));
    };
  }, [ready, pathname, router]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 text-sm text-rose-600">
        <div className="rounded-xl border border-rose-100 bg-white p-6 shadow-sm">
          <p className="mb-4 text-center font-medium">Session error: {error}</p>
          <button
            className="w-full rounded-lg bg-rose-600 px-4 py-2 text-white hover:bg-rose-700"
            onClick={() => window.location.reload()}
          >
            Reload Application
          </button>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Initializing...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
