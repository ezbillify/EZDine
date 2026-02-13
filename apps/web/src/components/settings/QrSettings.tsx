"use client";

import { useEffect, useState } from "react";
import { QrCode, Download, Printer, Copy, Utensils, Zap, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { getTables } from "../../lib/pos";
import { getAccessibleBranches } from "../../lib/tenant";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";

export function QrSettings() {
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
    const [tables, setTables] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const branchesData = await getAccessibleBranches();
                setBranches(branchesData);
                if (branchesData[0]) setSelectedBranchId(branchesData[0].id);
            } catch (err) {
                toast.error("Failed to load branches");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    useEffect(() => {
        if (!selectedBranchId) return;
        const loadTables = async () => {
            try {
                const tablesData = await getTables(selectedBranchId);
                setTables(tablesData);
            } catch (err) {
                console.error("Failed to load tables", err);
            }
        };
        loadTables();
    }, [selectedBranchId]);

    const getBaseUrl = () => {
        if (process.env.NEXT_PUBLIC_APP_URL) {
            return process.env.NEXT_PUBLIC_APP_URL;
        }
        if (typeof window !== "undefined") {
            return window.location.origin;
        }
        return "";
    };

    const generateQrUrl = (branchId: string, tableId?: string) => {
        const base = getBaseUrl();
        let url = `${base}/q/${branchId}`;
        if (tableId) url += `?t=${tableId}`;
        return url;
    };

    const getQrImageUrl = (data: string) => {
        return `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(data)}`;
    };

    const handleCopy = (url: string) => {
        navigator.clipboard.writeText(url);
        toast.success("URL copied to clipboard");
    };

    const handleDownload = (url: string, filename: string) => {
        const link = document.createElement("a");
        link.href = getQrImageUrl(url);
        link.download = `${filename}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = (url: string, title: string) => {
        const win = window.open("", "_blank");
        if (!win) return;
        win.document.write(`
      <html>
        <head>
          <title>Print QR - ${title}</title>
          <style>
            body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { border: 2px solid #e2e8f0; border-radius: 20px; padding: 40px; text-align: center; width: 400px; }
            .qr { width: 300px; height: 300px; margin-bottom: 20px; }
            .title { font-size: 24px; font-weight: 900; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 2px; }
            .subtitle { font-size: 14px; color: #64748b; margin-bottom: 30px; }
            .footer { font-size: 12px; color: #94a3b8; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="title">EZDine</div>
            <div class="subtitle">Scan to order & pay</div>
            <img class="qr" src="${getQrImageUrl(url)}" />
            <div class="title">${title}</div>
            <div class="footer">www.ezdine.pro</div>
          </div>
          <script>setTimeout(() => { window.print(); window.close(); }, 500);</script>
        </body>
      </html>
    `);
        win.document.close();
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* 1. Branch Selector */}
            <Card className="p-6 border-slate-100 bg-white">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-500/20">
                            <QrCode size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">QR Generator</h3>
                            <p className="text-[10px] font-medium text-slate-400">Manage scan-to-order links</p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-4">
                    {branches.map((b) => (
                        <button
                            key={b.id}
                            onClick={() => setSelectedBranchId(b.id)}
                            className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest transition-all ${selectedBranchId === b.id
                                ? "bg-brand-600 text-white shadow-md shadow-brand-500/20"
                                : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                                }`}
                        >
                            {b.name}
                        </button>
                    ))}
                </div>
            </Card>

            {/* 2. QR Cards Grid */}
            {selectedBranchId && (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {/* General Counter QR */}
                    <QrItem
                        title="General Checkout"
                        subtitle="Place at Counter"
                        url={generateQrUrl(selectedBranchId)}
                        onCopy={() => handleCopy(generateQrUrl(selectedBranchId))}
                        onDownload={() => handleDownload(generateQrUrl(selectedBranchId), "EZDine_General")}
                        onPrint={() => handlePrint(generateQrUrl(selectedBranchId), "General Counter")}
                    />

                    {/* Table Specific QRs */}
                    {tables.map(table => (
                        <QrItem
                            key={table.id}
                            title={`Table ${table.name}`}
                            subtitle="Dine-in Order"
                            url={generateQrUrl(selectedBranchId, table.id)}
                            onCopy={() => handleCopy(generateQrUrl(selectedBranchId, table.id))}
                            onDownload={() => handleDownload(generateQrUrl(selectedBranchId, table.id), `EZDine_Table_${table.name}`)}
                            onPrint={() => handlePrint(generateQrUrl(selectedBranchId, table.id), `Table ${table.name}`)}
                            icon={<Utensils size={18} />}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function QrItem({ title, subtitle, url, onCopy, onDownload, onPrint, icon = <Zap size={18} /> }: any) {
    const qrImage = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;

    return (
        <Card className="group relative overflow-hidden p-6 border-slate-100 bg-white transition-all hover:shadow-xl hover:shadow-slate-200/50">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                        {icon}
                    </div>
                    <div>
                        <h4 className="text-sm font-black text-slate-900 leading-tight">{title}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{subtitle}</p>
                    </div>
                </div>
                <a href={url} target="_blank" className="text-slate-300 hover:text-brand-600 transition-colors">
                    <ExternalLink size={16} />
                </a>
            </div>

            <div className="flex flex-col items-center justify-center py-6 bg-slate-50/50 rounded-2xl border border-slate-50 mb-6">
                <div className="relative group/qr">
                    <img src={qrImage} alt="QR Code" className="h-40 w-40 rounded-lg shadow-sm" />
                    <div className="absolute inset-0 bg-white/0 group-hover/qr:bg-white/10 backdrop-blur-0 transition-all rounded-lg" />
                </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" className="h-10 px-0 flex flex-col gap-1 items-center justify-center rounded-xl border-slate-100 hover:bg-slate-50" onClick={onCopy}>
                    <Copy size={14} className="text-slate-400" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">URL</span>
                </Button>
                <Button variant="outline" className="h-10 px-0 flex flex-col gap-1 items-center justify-center rounded-xl border-slate-100 hover:bg-slate-50" onClick={onDownload}>
                    <Download size={14} className="text-slate-400" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Save</span>
                </Button>
                <Button variant="outline" className="h-10 px-0 flex flex-col gap-1 items-center justify-center rounded-xl border-slate-100 hover:bg-slate-50" onClick={onPrint}>
                    <Printer size={14} className="text-slate-400" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Print</span>
                </Button>
            </div>
        </Card>
    );
}
