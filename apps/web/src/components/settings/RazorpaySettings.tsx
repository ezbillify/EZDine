"use client";

import { useEffect, useState } from "react";
import { CreditCard, Save, Shield, ExternalLink, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { saveRazorpaySettings } from "../../lib/pos";
import { getAccessibleBranches } from "../../lib/tenant";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";

export function RazorpaySettings() {
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Settings State
    const [key, setKey] = useState("");
    const [secret, setSecret] = useState("");
    const [enabled, setEnabled] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const branchesData = await getAccessibleBranches();
                setBranches(branchesData);
                if (branchesData[0]) {
                    setSelectedBranchId(branchesData[0].id);
                    setKey(branchesData[0].razorpay_key || "");
                    setSecret(branchesData[0].razorpay_secret || "");
                    setEnabled(branchesData[0].razorpay_enabled || false);
                }
            } catch (err) {
                toast.error("Failed to load branches");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    useEffect(() => {
        const branch = branches.find(b => b.id === selectedBranchId);
        if (branch) {
            setKey(branch.razorpay_key || "");
            setSecret(branch.razorpay_secret || "");
            setEnabled(branch.razorpay_enabled || false);
        }
    }, [selectedBranchId, branches]);

    const handleSave = async () => {
        if (!selectedBranchId) return;
        setSaving(true);
        try {
            await saveRazorpaySettings(selectedBranchId, { key, secret, enabled });
            toast.success("Razorpay settings saved successfully");

            // Update local state
            setBranches(prev => prev.map(b =>
                b.id === selectedBranchId
                    ? { ...b, razorpay_key: key, razorpay_secret: secret, razorpay_enabled: enabled }
                    : b
            ));
        } catch (err) {
            toast.error("Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
    );

    return (
        <div className="space-y-6">
            <Card className="p-6 border-slate-100 bg-white">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#3395FF] text-white shadow-lg shadow-blue-500/20">
                            <CreditCard size={24} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Razorpay Integration</h3>
                            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Configure online payments for your customers</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                        {branches.map((b) => (
                            <button
                                key={b.id}
                                onClick={() => setSelectedBranchId(b.id)}
                                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${selectedBranchId === b.id
                                        ? "bg-white text-brand-600 shadow-sm ring-1 ring-slate-100"
                                        : "text-slate-400 hover:text-slate-600"
                                    }`}
                            >
                                {b.name}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid gap-8 lg:grid-cols-2">
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Razorpay Key ID</label>
                            <div className="relative">
                                <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                <Input
                                    value={key}
                                    onChange={e => setKey(e.target.value)}
                                    placeholder="rzp_test_..."
                                    className="h-14 pl-12 rounded-2xl bg-slate-50 border-transparent focus:bg-white focus:ring-brand-500/20"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Razorpay Key Secret</label>
                            <div className="relative">
                                <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                <Input
                                    type="password"
                                    value={secret}
                                    onChange={e => setSecret(e.target.value)}
                                    placeholder="••••••••••••••••"
                                    className="h-14 pl-12 rounded-2xl bg-slate-50 border-transparent focus:bg-white focus:ring-brand-500/20"
                                />
                            </div>
                            <p className="text-[10px] text-slate-400 flex items-center gap-1.5 ml-1">
                                <AlertTriangle size={12} className="text-amber-500" />
                                Your secret is encrypted and never shared.
                            </p>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div>
                                <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Enable Online Payments</h4>
                                <p className="text-[10px] text-slate-400 font-medium">Allow customers to pay via Razorpay at checkout</p>
                            </div>
                            <button
                                onClick={() => setEnabled(!enabled)}
                                className={`w-12 h-6 rounded-full transition-all relative ${enabled ? 'bg-brand-600' : 'bg-slate-200'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${enabled ? 'left-7' : 'left-1'}`} />
                            </button>
                        </div>

                        <Button
                            className="w-full h-14 rounded-2xl bg-brand-600 font-black uppercase tracking-widest text-[11px] shadow-xl shadow-brand-500/20 gap-2"
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving ? "Saving Changes..." : <><Save size={18} /> Save Credentials</>}
                        </Button>
                    </div>

                    <div className="bg-slate-50 rounded-[2rem] p-8 border border-slate-100 h-full flex flex-col justify-center">
                        <div className="space-y-6">
                            <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-brand-600 mb-2">Setup Guide</h4>
                                <ul className="space-y-3">
                                    <li className="flex items-start gap-3">
                                        <div className="h-5 w-5 rounded-full bg-brand-50 flex items-center justify-center text-[10px] font-bold text-brand-600 shrink-0">1</div>
                                        <p className="text-[11px] font-bold text-slate-600 leading-normal">Login to your <a href="https://dashboard.razorpay.com" target="_blank" className="text-brand-600 underline inline-flex items-center gap-1">Razorpay Dashboard <ExternalLink size={10} /></a></p>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <div className="h-5 w-5 rounded-full bg-brand-50 flex items-center justify-center text-[10px] font-bold text-brand-600 shrink-0">2</div>
                                        <p className="text-[11px] font-bold text-slate-600 leading-normal">Go to Settings &gt; API Keys and generate your Test/Live keys.</p>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <div className="h-5 w-5 rounded-full bg-brand-50 flex items-center justify-center text-[10px] font-bold text-brand-600 shrink-0">3</div>
                                        <p className="text-[11px] font-bold text-slate-600 leading-normal">Copy the Key ID and Secret into the fields on the left.</p>
                                    </li>
                                </ul>
                            </div>

                            <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-2">Test Mode</h4>
                                <p className="text-[11px] font-bold text-amber-600 leading-relaxed italic">
                                    "For testing, use Razorpay Test Keys. You can use any test amount and standard test cards to verify the full flow safely."
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
}
