"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { OtpLoginForm } from "../../components/auth/OtpLoginForm";
import { AppShell } from "../../components/layout/AppShell";
import { supabase } from "../../lib/supabaseClient";
import { Card } from "../../components/ui/Card";

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
      subtitle="Sign in securely with your email OTP"
      showNav={false}
      showUserMenu={false}
    >
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl bg-white p-10 shadow-sm">
          <div className="max-w-md space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-600">
              EZDine Staff Access
            </p>
            <h2 className="text-2xl font-semibold text-slate-900">Login to start service</h2>
            <p className="text-sm text-slate-600">
              Use your work email to receive a one-time OTP code. This keeps accounts
              secure and verified.
            </p>
            <OtpLoginForm />
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
