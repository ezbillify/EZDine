import { HTMLAttributes, ReactNode } from "react";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
    gradient?: boolean;
}

export function GlassCard({ children, className = "", gradient = false, ...props }: GlassCardProps) {
    return (
        <div
            className={`
        relative overflow-hidden rounded-2xl border border-white/50 bg-white/60 p-6 shadow-sm backdrop-blur-xl transition-all hover:shadow-md
        ${gradient ? "bg-gradient-to-br from-white/80 to-white/40" : ""}
        ${className}
      `}
            {...props}
        >
            {gradient && (
                <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand-500/10 blur-3xl" />
            )}
            {children}
        </div>
    );
}
