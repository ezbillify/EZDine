"use client";

import { X, Printer, Download } from "lucide-react";
import { Button } from "../ui/Button";
import { PrintLine } from "../../lib/printing";

type PrintPreviewModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onPrint?: () => void;
    title: string;
    lines: PrintLine[];
    width?: 58 | 80;
};

export function PrintPreviewModal({
    isOpen,
    onClose,
    onPrint,
    title,
    lines,
    width = 80
}: PrintPreviewModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="relative w-full max-w-md overflow-hidden rounded-[2.5rem] bg-white shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-500/20">
                            <Printer size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">{title}</h3>
                            <p className="text-[10px] font-medium text-slate-400">Thermal Receipt Preview ({width}mm)</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-100 hover:bg-rose-50 transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Receipt Body */}
                <div className="flex justify-center bg-slate-100 p-8 min-h-[400px] max-h-[60vh] overflow-y-auto custom-scrollbar">
                    <div
                        className="bg-white p-6 shadow-xl relative transition-all duration-300 receipt-html-content"
                        style={{
                            width: width === 58 ? "240px" : "320px",
                            minHeight: "400px",
                            fontFamily: "'Courier New', Courier, monospace",
                            backgroundColor: "white",
                            color: "black"
                        }}
                    >
                        {/* Scalloped edge effect top */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-white flex overflow-hidden">
                            {Array.from({ length: 20 }).map((_, i) => (
                                <div key={i} className="flex-none w-4 h-4 bg-slate-100 rounded-full -mt-2" />
                            ))}
                        </div>

                        <div className="py-2 space-y-0 text-black">
                            {lines.map((line, idx) => (
                                <div
                                    key={idx}
                                    className={`leading-none break-words ${line.align === "center"
                                        ? "text-center"
                                        : line.align === "right"
                                            ? "text-right"
                                            : "text-left"
                                        } ${line.bold ? "font-bold" : "font-normal"}`}
                                    style={{
                                        fontSize: line.bold ? "12px" : "11px",
                                        letterSpacing: "-0.5px"
                                    }}
                                >
                                    {line.text || "\u00A0"}
                                </div>
                            ))}
                        </div>

                        {/* Scalloped edge effect bottom */}
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white flex overflow-hidden">
                            {Array.from({ length: 20 }).map((_, i) => (
                                <div key={i} className="flex-none w-4 h-4 bg-slate-100 rounded-full -mb-2" />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="border-t border-slate-100 bg-white p-6">
                    <div className="flex gap-3">
                        <Button
                            variant="secondary"
                            className="flex-1 h-12 rounded-2xl bg-slate-100 border-none text-slate-600 hover:bg-slate-200"
                            onClick={onClose}
                        >
                            Close
                        </Button>
                        {onPrint && (
                            <Button
                                className="flex-[2] h-12 rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-500/20 gap-2"
                                onClick={() => {
                                    onPrint();
                                    onClose();
                                }}
                            >
                                <Printer size={18} /> Send to Printer
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}</style>
        </div>
    );
}
