"use client";

import { useState, useEffect, useRef } from "react";
import { X, CreditCard, Banknote, Smartphone, QrCode } from "lucide-react";
import { Button } from "../ui/Button";
import { NumericKeypad } from "./NumericKeypad";

type PaymentModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (payments: any[]) => void;
    totalAmount: number;
};

export function PaymentModal({
    isOpen,
    onClose,
    onConfirm,
    totalAmount
}: PaymentModalProps) {
    const [amounts, setAmounts] = useState<Record<string, string>>({
        cash: "",
        card: "",
        upi: ""
    });
    
    const [activeField, setActiveField] = useState<string>("cash");
    const [useKeyboard, setUseKeyboard] = useState(true); // Toggle between keyboard and keypad
    const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    // Reset & Auto-fill Logic
    useEffect(() => {
        if (isOpen) {
            // Default to Full Cash for speed
            setAmounts({
                cash: totalAmount > 0 ? formatAmount(totalAmount) : "",
                card: "",
                upi: ""
            });
            setActiveField("cash");
            // Focus cash input after a brief delay
            setTimeout(() => {
                inputRefs.current['cash']?.focus();
                inputRefs.current['cash']?.select();
            }, 100);
        }
    }, [isOpen, totalAmount]);

    const formatAmount = (amount: number): string => {
        if (amount === Math.floor(amount)) {
            return amount.toString();
        }
        return amount.toFixed(2);
    };

    const methods = [
        { id: 'cash', label: 'CASH', icon: Banknote, color: 'bg-emerald-500', shortcut: 'Ctrl+1' },
        { id: 'upi', label: 'UPI/SCAN', icon: QrCode, color: 'bg-brand-500', shortcut: 'Ctrl+2' },
        { id: 'card', label: 'CARD', icon: CreditCard, color: 'bg-indigo-500', shortcut: 'Ctrl+3' },
    ] as const;

    const currentTotal = Object.values(amounts).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    const remaining = Math.max(0, totalAmount - currentTotal);
    const isPaid = currentTotal >= totalAmount - 0.01; // Tolerance

    // Keyboard shortcuts
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Enter to confirm
            if (e.key === 'Enter' && isPaid) {
                e.preventDefault();
                handleConfirm();
            }
            // Escape to close
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
            // Tab to switch between fields
            if (e.key === 'Tab') {
                e.preventDefault();
                const methodIds: ('cash' | 'upi' | 'card')[] = ['cash', 'upi', 'card'];
                const currentIndex = methodIds.indexOf(activeField as any);
                const nextIndex = e.shiftKey 
                    ? (currentIndex - 1 + methodIds.length) % methodIds.length
                    : (currentIndex + 1) % methodIds.length;
                const nextMethod = methodIds[nextIndex] || 'cash';
                setActiveField(nextMethod);
                setTimeout(() => {
                    inputRefs.current[nextMethod]?.focus();
                    inputRefs.current[nextMethod]?.select();
                }, 0);
            }
            // Number keys 1-3 to quick switch payment methods
            if (e.key === '1' && e.ctrlKey) {
                e.preventDefault();
                handleQuickFill('cash');
            }
            if (e.key === '2' && e.ctrlKey) {
                e.preventDefault();
                handleQuickFill('upi');
            }
            if (e.key === '3' && e.ctrlKey) {
                e.preventDefault();
                handleQuickFill('card');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, activeField, isPaid, amounts, totalAmount]);

    const handleConfirm = () => {
        const payments = Object.entries(amounts)
            .map(([method, amount]) => ({ method, amount: parseFloat(amount) || 0 }))
            .filter(p => p.amount > 0);

        if (payments.length === 0 && totalAmount > 0) return;

        onConfirm(payments as any);
    };

    const handleQuickFill = (methodId: string) => {
        const otherTotal = Object.entries(amounts)
            .filter(([key]) => key !== methodId)
            .reduce((sum, [_, val]) => sum + (parseFloat(val) || 0), 0);

        const toFill = Math.max(0, totalAmount - otherTotal);
        setAmounts(prev => ({ ...prev, [methodId]: formatAmount(toFill) }));
        setActiveField(methodId);
        setTimeout(() => {
            inputRefs.current[methodId]?.focus();
            inputRefs.current[methodId]?.select();
        }, 0);
    };

    const handleInputChange = (methodId: string, value: string) => {
        // Allow only numbers and one decimal point
        if (value && !/^\d*\.?\d*$/.test(value)) return;

        const newAmount = parseFloat(value) || 0;
        const otherTotal = Object.entries(amounts)
            .filter(([k]) => k !== methodId)
            .reduce((sum, [_, val]) => sum + (parseFloat(val) || 0), 0);

        if (otherTotal + newAmount > totalAmount + 0.01) {
            const maxAllowed = totalAmount - otherTotal;
            setAmounts(prev => ({ ...prev, [methodId]: formatAmount(maxAllowed < 0 ? 0 : maxAllowed) }));
        } else {
            setAmounts(prev => ({ ...prev, [methodId]: value }));
        }
    };

    const handleKeyPress = (key: string) => {
        const currentValue = amounts[activeField] || "";
        let newValue = currentValue;

        if (key === '.') {
            if (!currentValue.includes('.')) {
                newValue = currentValue + key;
            }
        } else {
            newValue = currentValue + key;
        }

        handleInputChange(activeField, newValue);
    };

    const handleDelete = () => {
        const currentValue = amounts[activeField] || "";
        if (currentValue.length > 0) {
            setAmounts(prev => ({ ...prev, [activeField]: currentValue.slice(0, -1) }));
        }
    };

    const handleClear = () => {
        setAmounts(prev => ({ ...prev, [activeField]: "" }));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] bg-white shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex-none">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Settle Bill</h3>
                        <p className="text-[10px] font-bold text-slate-400 mt-1">
                            Press <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-slate-600">Enter</kbd> to confirm • <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-slate-600">Esc</kbd> to cancel
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-100 hover:bg-rose-50 transition-all"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body - Scrollable */}
                <div className="p-6 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-6">
                        {/* Left: Payment Methods */}
                        <div className="space-y-4">
                            {/* Total Amount Display */}
                            <div className="bg-slate-50 rounded-3xl p-6 text-center">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Total Payable</p>
                                <div className="text-5xl font-black text-slate-900 tracking-tighter mb-4">
                                    ₹{formatAmount(totalAmount)}
                                </div>
                                <div className="flex items-center justify-center gap-3">
                                    <div className="h-px w-10 bg-slate-200" />
                                    <p className={`text-sm font-black uppercase tracking-tight ${remaining <= 0.01 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {remaining <= 0.01 ? 'PAID IN FULL' : `DUE: ₹${formatAmount(remaining)}`}
                                    </p>
                                    <div className="h-px w-10 bg-slate-200" />
                                </div>
                            </div>

                            {/* Payment Method Inputs */}
                            <div className="space-y-3">
                                {methods.map((method) => {
                                    const isActive = activeField === method.id;
                                    const hasValue = (parseFloat(amounts[method.id] || "") || 0) > 0;
                                    
                                    return (
                                        <div key={method.id} className="relative">
                                            <div className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                                                isActive 
                                                    ? 'border-slate-900 bg-slate-50' 
                                                    : 'border-slate-100 bg-white hover:border-slate-200'
                                            }`}>
                                                <button
                                                    onClick={() => handleQuickFill(method.id)}
                                                    className={`flex h-12 w-12 flex-none items-center justify-center rounded-xl text-white shadow-md transition-all hover:scale-105 active:scale-95 ${method.color}`}
                                                    title={`Quick fill (${method.shortcut})`}
                                                >
                                                    <method.icon size={20} />
                                                </button>
                                                <div className="flex-1">
                                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                                                        {method.label}
                                                    </label>
                                                    <input
                                                        ref={el => { inputRefs.current[method.id] = el; }}
                                                        type="text"
                                                        inputMode="decimal"
                                                        placeholder="0.00"
                                                        value={amounts[method.id]}
                                                        onChange={e => handleInputChange(method.id, e.target.value)}
                                                        onFocus={() => setActiveField(method.id)}
                                                        className="w-full h-10 px-3 rounded-xl border-none bg-transparent font-mono font-bold text-2xl text-slate-900 placeholder:text-slate-300 focus:outline-none"
                                                    />
                                                </div>
                                                {hasValue && (
                                                    <div className={`px-3 py-1 rounded-lg text-xs font-black ${method.color.replace('bg-', 'text-')} bg-opacity-10`}>
                                                        ₹{amounts[method.id]}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Right: Numeric Keypad (Optional) */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Quick Entry</p>
                                <button
                                    onClick={() => setUseKeyboard(!useKeyboard)}
                                    className="text-[10px] font-bold text-brand-600 hover:text-brand-700"
                                >
                                    {useKeyboard ? 'Show Keypad' : 'Use Keyboard'}
                                </button>
                            </div>
                            
                            {!useKeyboard && (
                                <NumericKeypad
                                    onKeyPress={handleKeyPress}
                                    onDelete={handleDelete}
                                    onClear={handleClear}
                                />
                            )}

                            {useKeyboard && (
                                <div className="bg-slate-50 rounded-2xl p-6 h-full flex items-center justify-center">
                                    <div className="text-center space-y-4">
                                        <div className="text-6xl">⌨️</div>
                                        <p className="text-sm font-bold text-slate-600">Use your keyboard</p>
                                        <div className="space-y-2 text-xs text-slate-500">
                                            <p><kbd className="px-2 py-1 bg-white rounded border border-slate-200">Tab</kbd> Switch fields</p>
                                            <p><kbd className="px-2 py-1 bg-white rounded border border-slate-200">Ctrl+1/2/3</kbd> Quick fill</p>
                                            <p><kbd className="px-2 py-1 bg-white rounded border border-slate-200">Enter</kbd> Confirm</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-slate-100 bg-slate-50 p-6 space-y-3 flex-none">
                    <Button
                        id="btn-confirm-payment"
                        onClick={handleConfirm}
                        disabled={!isPaid && totalAmount > 0}
                        className={`w-full h-16 text-sm rounded-2xl shadow-xl transition-all font-black uppercase tracking-[0.2em] ${isPaid
                            ? "bg-slate-900 hover:bg-black text-white shadow-slate-900/10 hover:shadow-slate-900/20"
                            : "bg-slate-100 text-slate-300 cursor-not-allowed"
                            }`}
                    >
                        {isPaid ? '✓ Confirm & Settle' : `Remaining: ₹${formatAmount(remaining)}`}
                    </Button>
                </div>
            </div>
        </div>
    );
}
