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
        ${gradient ? "bg-white/90" : ""}
        ${className}
      `}
            {...props}
        >
            {children}
        </div>
    );
}
