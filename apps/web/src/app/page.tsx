"use client";

import Link from "next/link";
import {
  ArrowRight,
  ChevronRight,
  Layers,
  Zap,
  Shield,
  Activity,
  Globe,
  PieChart,
  Target,
  Sparkles,
  Play
} from "lucide-react";
import { Button } from "../components/ui/Button";

export default function Home() {
  return (
    <main className="relative min-h-screen bg-white selection:bg-brand-100 selection:text-brand-900">
      {/* Dynamic Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-200/20 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-200/20 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Navigation */}
        <nav className="flex items-center justify-between py-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-xl shadow-brand-500/20 transform hover:rotate-6 transition-transform">
              <Sparkles size={20} fill="currentColor" />
            </div>
            <span className="text-xl font-black tracking-tight text-slate-900">EZDine <span className="text-brand-600">Pro</span></span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {['Features', 'Integrations', 'Pricing', 'Docs'].map(item => (
              <a key={item} href={`#${item.toLowerCase()}`} className="text-sm font-bold text-slate-500 hover:text-brand-600 transition-colors uppercase tracking-widest">{item}</a>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" className="text-sm font-black uppercase tracking-widest text-slate-500 hover:text-brand-600">Log In</Button>
            </Link>
            <Link href="/dashboard">
              <Button className="h-11 px-6 rounded-2xl bg-slate-900 text-white shadow-2xl hover:bg-black transition-all hover:scale-105 uppercase tracking-widest font-black text-[10px]">
                Open Dashboard
              </Button>
            </Link>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="pt-20 pb-32 text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-50 border border-slate-100 mb-8 animate-in fade-in slide-in-from-top-4 duration-1000">
            <span className="flex h-2 w-2 rounded-full bg-brand-600 animate-ping" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Industry First: AI-First Hospitality OS</span>
          </div>

          <h1 className="max-w-4xl mx-auto text-6xl md:text-8xl font-black tracking-tighter text-slate-900 leading-[0.9] mb-8">
            Dine Fast. <br />
            Process <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-indigo-600">Faster.</span>
          </h1>

          <p className="max-w-xl mx-auto text-lg md:text-xl text-slate-500 font-medium leading-relaxed mb-12">
            The only restaurant operating system designed with zero-latency POS, real-time KDS routing, and predictive inventory intelligence.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link href="/dashboard">
              <Button size="lg" className="h-16 px-10 rounded-[2rem] bg-brand-600 text-white shadow-2xl shadow-brand-500/20 text-lg font-black uppercase tracking-widest group">
                Scale Your Business <ArrowRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Button variant="outline" size="lg" className="h-16 px-10 rounded-[2rem] border-slate-200 text-slate-600 font-bold hover:bg-slate-50 group">
              Watch the Demo <Play size={16} fill="currentColor" className="ml-2 text-brand-600" />
            </Button>
          </div>
        </section>

        {/* Feature Grid - The "Proper App" Showcase */}
        <section className="pb-32 grid gap-8 md:grid-cols-3">
          <div className="group relative overflow-hidden rounded-[3rem] bg-slate-50 border border-slate-100 p-8 hover:bg-white hover:shadow-2xl hover:shadow-brand-500/10 transition-all">
            <div className="h-14 w-14 rounded-2xl bg-brand-600/10 text-brand-600 flex items-center justify-center mb-6 shadow-inner">
              <Layers size={24} />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">Full-Stack POS</h3>
            <p className="text-slate-500 font-medium leading-relaxed">
              A gorgeous, touch-first interface that processes complex modifications and split-payments in under 200ms.
            </p>
            <div className="mt-8 flex items-center gap-2 text-brand-600 font-black uppercase text-[10px] tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
              Explore Module <ChevronRight size={14} />
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-[3rem] bg-slate-50 border border-slate-100 p-8 hover:bg-white hover:shadow-2xl hover:shadow-indigo-500/10 transition-all">
            <div className="h-14 w-14 rounded-2xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center mb-6 shadow-inner">
              <Activity size={24} />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">Real-time KDS</h3>
            <p className="text-slate-500 font-medium leading-relaxed">
              Ditch the thermal printers. Get instant visual routing, station alerts, and average prep time analytics.
            </p>
            <div className="mt-8 flex items-center gap-2 text-indigo-600 font-black uppercase text-[10px] tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
              Explore Module <ChevronRight size={14} />
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-[3rem] bg-slate-50 border border-slate-100 p-8 hover:bg-white hover:shadow-2xl hover:shadow-emerald-500/10 transition-all">
            <div className="h-14 w-14 rounded-2xl bg-emerald-600/10 text-emerald-600 flex items-center justify-center mb-6 shadow-inner">
              <Target size={24} />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">Smart Inventory</h3>
            <p className="text-slate-500 font-medium leading-relaxed">
              Automatic ingredient deduction with recipe-level tracking. Predict stock-outs before they happen.
            </p>
            <div className="mt-8 flex items-center gap-2 text-emerald-600 font-black uppercase text-[10px] tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
              Explore Module <ChevronRight size={14} />
            </div>
          </div>
        </section>

        {/* Metrics Section */}
        <section className="pb-40">
          <div className="rounded-[4rem] bg-slate-900 overflow-hidden relative p-12 md:p-24 text-center">
            <div className="absolute top-0 right-0 w-[60%] h-full bg-gradient-to-l from-brand-600/20 to-transparent pointer-none" />
            <div className="relative z-10 grid gap-12 md:grid-cols-3">
              <div>
                <p className="text-brand-500 font-black uppercase tracking-widest text-xs mb-4">Operations</p>
                <h4 className="text-6xl font-black text-white tracking-tighter mb-2">99.9%</h4>
                <p className="text-slate-400 font-medium">Uptime Guarantee</p>
              </div>
              <div>
                <p className="text-indigo-500 font-black uppercase tracking-widest text-xs mb-4">Performance</p>
                <h4 className="text-6xl font-black text-white tracking-tighter mb-2">2x</h4>
                <p className="text-slate-400 font-medium">Faster Bill Turnaround</p>
              </div>
              <div>
                <p className="text-emerald-500 font-black uppercase tracking-widest text-xs mb-4">Savings</p>
                <h4 className="text-6xl font-black text-white tracking-tighter mb-2">30%</h4>
                <p className="text-slate-400 font-medium">Reduced Food Waste</p>
              </div>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="pb-32 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-8">Ready to evolve your kitchen?</h2>
            <p className="text-slate-500 font-medium mb-12">Join 500+ restaurants scaling their operations with EZDine Pro.</p>
            <Link href="/dashboard">
              <Button className="h-16 px-12 rounded-full bg-slate-900 text-white font-black uppercase tracking-widest transition-transform hover:scale-105 active:scale-95">
                Sign Up For Free
              </Button>
            </Link>
          </div>
        </section>

        <footer className="py-12 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 grayscale hover:grayscale-0 transition-all cursor-pointer">
            <div className="h-6 w-6 rounded bg-brand-600" />
            <span className="text-sm font-black tracking-tight text-slate-900">EZDine Pro</span>
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">© 2026 EZConnect Systems. All Rights Reserved.</p>
          <div className="flex gap-8">
            {['Terms', 'Privacy', 'Security'].map(item => (
              <a key={item} href="#" className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors">{item}</a>
            ))}
          </div>
        </footer>
      </div>
    </main>
  );
}
