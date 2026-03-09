"use client";

import { Delete } from "lucide-react";

export type NumericKeypadProps = {
    onPress: (key: string) => void;
    onDelete: () => void;
    onClear: () => void;
    onEnter?: () => void;
    disabled?: boolean;
};

export function NumericKeypad({ onPress, onDelete, onClear, onEnter, disabled }: NumericKeypadProps) {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '00'];

    return (
        <div className={`grid grid-cols-3 gap-2 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
            {keys.map((key) => (
                <button
                    key={key}
                    type="button"
                    onClick={() => onPress(key)}
                    className="h-14 rounded-2xl bg-white hover:bg-slate-100 active:bg-slate-200 font-black text-xl text-slate-900 transition-all active:scale-95 border border-slate-100"
                >
                    {key}
                </button>
            ))}
            <button
                type="button"
                onClick={onClear}
                className="h-14 rounded-2xl bg-rose-50 hover:bg-rose-100 active:bg-rose-200 font-black text-sm uppercase tracking-widest text-rose-600 transition-all active:scale-95 border border-rose-100"
            >
                Clear
            </button>
            <button
                type="button"
                onClick={onDelete}
                className="h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all active:scale-95 flex items-center justify-center gap-2 font-black text-sm uppercase tracking-widest"
            >
                <Delete size={18} />
            </button>
            {onEnter && (
                <button
                    type="button"
                    onClick={onEnter}
                    className="h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all active:scale-95 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-200"
                >
                    ENTER
                </button>
            )}
        </div>
    );
}
