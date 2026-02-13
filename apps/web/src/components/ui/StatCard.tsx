"use client";

import type { ReactNode } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

type StatCardProps = {
  label: string;
  value: ReactNode;
  trend?: {
    value: number;
    type: "up" | "down" | "neutral";
  };
  icon?: any;
  color?: string;
  description?: string;
};

export function StatCard({ label, value, trend, icon: Icon, color = "brand", description }: StatCardProps) {
  const colorMap: Record<string, string> = {
    brand: "bg-brand-600 text-white shadow-brand-500/20",
    amber: "bg-amber-500 text-white shadow-amber-500/20",
    emerald: "bg-emerald-500 text-white shadow-emerald-500/20",
    rose: "bg-rose-500 text-white shadow-rose-500/20",
    indigo: "bg-indigo-600 text-white shadow-indigo-500/20",
  };

  return (
    <div className="group relative overflow-hidden rounded-[2.5rem] bg-white border border-slate-100 p-6 shadow-xl shadow-slate-200/40 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-300">
      <div className="flex items-start justify-between mb-4">
        {Icon && (
          <div className={`mt-1 flex h-12 w-12 items-center justify-center rounded-2xl ${colorMap[color]} shadow-lg transition-transform group-hover:scale-110 group-hover:rotate-3`}>
            <Icon size={24} />
          </div>
        )}
        {trend && (
          <div className={`flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${trend.type === 'up' ? 'bg-emerald-50 text-emerald-600' :
              trend.type === 'down' ? 'bg-rose-50 text-rose-600' :
                'bg-slate-50 text-slate-500'
            }`}>
            {trend.type === 'up' && <TrendingUp size={12} />}
            {trend.type === 'down' && <TrendingDown size={12} />}
            {trend.type === 'neutral' && <Minus size={12} />}
            {trend.value}%
          </div>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
        <div className="flex items-baseline gap-2">
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{value}</h3>
        </div>
        {description && (
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{description}</p>
        )}
      </div>

      {/* Mini abstract sparkline at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1.5 flex gap-1 px-1 py-0.5 opacity-20 transition-opacity group-hover:opacity-40">
        {[40, 60, 45, 80, 55, 90, 70, 85].map((h, i) => (
          <div key={i} className={`flex-1 rounded-t-sm ${trend?.type === 'up' ? 'bg-emerald-500' : trend?.type === 'down' ? 'bg-rose-500' : 'bg-brand-500'}`} style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}
