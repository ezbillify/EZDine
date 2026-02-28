"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { NewLoginForm } from "../../components/auth/NewLoginForm";
import { AppShell } from "../../components/layout/AppShell";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace("/pos");
      }
    };
    check();
  }, [router]);

  return (
    <AppShell
      title="Welcome back"
      subtitle="Sign in to your restaurant operating system"
      showNav={false}
      showUserMenu={false}
    >
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl bg-white p-10 shadow-sm">
          <div className="max-w-md space-y-4">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-16 w-16 rounded-2xl bg-white shadow-md p-2 flex items-center justify-center">
                <img 
                  src="/images/EZDineLOGO.png" 
                  alt="EZDine Logo" 
                  className="h-full w-full object-contain"
                />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-600">
                  EZDine Staff Access
                </p>
                <h2 className="text-2xl font-semibold text-slate-900">Login to start service</h2>
              </div>
            </div>
            <p className="text-sm text-slate-600">
              Choose your preferred login method: password or one-time code via email.
            </p>
            <NewLoginForm />
            <p className="text-xs text-slate-500">
              New account? After login, complete onboarding to create your restaurant.
            </p>
          </div>
        </div>
        <div className="rounded-3xl bg-slate-900 p-10 text-white shadow-lg">
          <h3 className="text-xl font-semibold">Built for busy kitchens</h3>
          <p className="mt-3 text-sm text-white/70">
            Offline-first POS, live kitchen display, and real-time sync across
            branches. Designed to stay fast during rush hours.
          </p>
          <div className="mt-6 grid gap-4">
            {[
              "Touch-friendly billing in under 1s",
              "Live order status for KDS",
              "Branch-level access controls",
              "GST-ready billing & reports"
            ].map((feature) => (
              <div
                key={feature}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
              >
                {feature}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-12 text-center pb-8">
        <a
          href="https://ezbillify.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-300 hover:text-brand-600 transition-colors"
        >
          Powered by <span className="text-slate-400">EZBillify</span>
        </a>
      </div>
    </AppShell>
  );
}
