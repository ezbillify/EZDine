"use client";

import { Delete } from "lucide-react";

type NumericKeypadProps = {
    onKeyPress: (key: string) => void;
    onDelete: () => void;
    onClear: () => void;
};

export function NumericKeypad({ onKeyPress, onDelete, onClear }: NumericKeypadProps) {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '00'];

    return (
        <div className="grid grid-cols-3 gap-2">
            {keys.map((key) => (
                <button
                    key={key}
                    onClick={() => onKeyPress(key)}
                    className="h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 font-black text-xl text-slate-900 transition-all active:scale-95 border border-slate-100"
                >
                    {key}
                </button>
            ))}
            <button
                onClick={onClear}
                className="h-14 rounded-2xl bg-rose-50 hover:bg-rose-100 active:bg-rose-200 font-black text-sm uppercase tracking-widest text-rose-600 transition-all active:scale-95 border border-rose-100"
            >
                Clear
            </button>
            <button
                onClick={onDelete}
                className="col-span-2 h-14 rounded-2xl bg-slate-900 hover:bg-black text-white transition-all active:scale-95 flex items-center justify-center gap-2 font-black text-sm uppercase tracking-widest"
            >
                <Delete size={18} /> Delete
            </button>
        </div>
    );
}
