"use client";

import React, { useState, useEffect } from "react";
import { Save, Check, Loader2, HelpCircle } from "lucide-react";
import { Card } from "../ui/Card";
import { getPrintingSettings, savePrintingSettings, sendPrintJob } from "../../lib/printing";
import { toast } from "sonner";

const PrintingSettings: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [settings, setSettings] = useState({
    bridgeUrl: 'http://localhost:4000',
    printerIdInvoice: '127.0.0.1',
    printerIdKot: '127.0.0.1',
    widthInvoice: 80,
    widthKot: 80,
    connectionType: 'network',
    printerName: '',
    ipAddress: '',
    bluetoothAddress: '',
    consolidatedPrinting: true,
    printFont: 'font-a'
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      if (typeof window !== 'undefined' && window.console) {
        window.console.log('Attempting to load settings...');
      }

      const saved = await getPrintingSettings();
      if (typeof window !== 'undefined' && window.console) {
        window.console.log('Loaded settings:', saved);
      }

      if (saved) {
        setSettings({
          bridgeUrl: saved.bridgeUrl || 'http://localhost:4000',
          printerIdInvoice: saved.printerIdInvoice || '127.0.0.1',
          printerIdKot: saved.printerIdKot || '127.0.0.1',
          widthInvoice: saved.widthInvoice || 80,
          widthKot: saved.widthKot || 80,
          connectionType: saved.connectionType || 'network',
          printerName: saved.printerName || '',
          ipAddress: saved.ipAddress || '',
          bluetoothAddress: saved.bluetoothAddress || '',
          consolidatedPrinting: saved.consolidatedPrinting !== false,
          printFont: saved.printFont || 'font-a'
        });
      }
    } catch (err) {
      if (typeof window !== 'undefined' && window.console) {
        window.console.error('Failed to load settings:', err);
      }
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      toast.error('Failed to load settings: ' + errorMessage);
    }
  };

  const saveSettings = async () => {
    setIsLoading(true);
    try {
      if (typeof window !== 'undefined' && window.console) {
        window.console.log('Attempting to save settings:', settings);
      }

      await savePrintingSettings(settings);
      if (typeof window !== 'undefined' && window.console) {
        window.console.log('Settings saved successfully');
      }

      setSaveSuccess(true);
      toast.success('Printer settings saved successfully!');
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      if (typeof window !== 'undefined' && window.console) {
        window.console.error('Failed to save settings:', err);
      }
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      toast.error('Failed to save settings: ' + errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const testPrintServer = async () => {
    try {
      const currentSettings = await getPrintingSettings();
      const serverUrl = currentSettings?.bridgeUrl || 'http://localhost:4000';

      if (typeof window !== 'undefined' && window.console) {
        window.console.log('Testing print server at:', serverUrl);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${serverUrl}/health`, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        toast.success(`Print server is reachable at ${serverUrl}!`);
      } else {
        toast.error(`Print server responded with error: ${response.status}`);
      }
    } catch (err) {
      const error = err as Error;
      if (error.name === 'AbortError') {
        toast.error('Print server timeout - server may not be running');
      } else {
        toast.error(`Print server test failed: ${error.message}`);
      }
    }
  };

  const testPrint = async () => {
    try {
      const currentSettings = await getPrintingSettings();
      if (!currentSettings) {
        toast.error('No printer settings configured');
        return;
      }

      const testLines = [
        { text: "=== TEST PRINT ===", align: "center" as const, bold: true },
        { text: "EZDine POS System", align: "center" as const },
        { text: "Print Test Successful", align: "center" as const },
        { text: new Date().toLocaleString(), align: "center" as const },
        { text: "==================", align: "center" as const }
      ];

      const success = await sendPrintJob({
        printerId: currentSettings.printerIdInvoice || '127.0.0.1',
        width: currentSettings.widthInvoice || 80,
        type: 'invoice',
        lines: testLines,
        font: settings.printFont as "font-a" | "font-b" | undefined
      });

      if (success) {
        toast.success('Test print sent successfully!');
      } else {
        toast.error('Test print failed - check printer connection');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast.error('Test print failed: ' + errorMessage);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-black mb-2">Printer Setup</h2>
            <p className="text-slate-300 text-sm">Configure your thermal printers for POS system</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Billing Printer (IP or Name)</label>
            <input
              type="text"
              value={settings.printerIdInvoice}
              onChange={(e) => setSettings(prev => ({ ...prev, printerIdInvoice: e.target.value }))}
              placeholder="127.0.0.1 or 'billing'"
              className="w-full p-3 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Kitchen Printer (IP or Name)</label>
            <input
              type="text"
              value={settings.printerIdKot}
              onChange={(e) => setSettings(prev => ({ ...prev, printerIdKot: e.target.value }))}
              placeholder="127.0.0.1 or 'kitchen'"
              className="w-full p-3 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Print Server (Bridge) URL</label>
          <input
            type="text"
            value={settings.bridgeUrl}
            onChange={(e) => setSettings(prev => ({ ...prev, bridgeUrl: e.target.value }))}
            placeholder="http://localhost:4000"
            className="w-full p-3 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-3">Connection Method</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {['browser', 'network', 'bluetooth', 'ip'].map((type) => (
              <button
                key={type}
                onClick={() => setSettings(prev => ({ ...prev, connectionType: type }))}
                className={`p-4 rounded-xl border-2 text-center capitalize transition-all ${settings.connectionType === type
                  ? 'border-brand-300 bg-brand-50 font-bold'
                  : 'border-slate-200 hover:border-slate-300 font-medium'
                  }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Paper Width</label>
            <select
              value={settings.widthInvoice}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                widthInvoice: parseInt(e.target.value),
                widthKot: parseInt(e.target.value)
              }))}
              className="w-full p-3 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            >
              <option value={58}>58mm</option>
              <option value={80}>80mm</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Print Font</label>
            <select
              value={settings.printFont}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                printFont: e.target.value
              }))}
              className="w-full p-3 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            >
              <option value="font-a">Font A (Standard - Default)</option>
              <option value="font-b">Font B (Condensed - Smaller)</option>
            </select>
          </div>
        </div>

        <div className="pt-2">
          <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
            <input
              type="checkbox"
              checked={settings.consolidatedPrinting}
              onChange={(e) => setSettings(prev => ({ ...prev, consolidatedPrinting: e.target.checked }))}
              className="w-5 h-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <div>
              <div className="font-bold text-slate-900">Consolidated Printing (Recommended)</div>
              <div className="text-sm text-slate-500">Combines KOT, Invoice, and Token into a single continuous receipt. Uncheck to print separate tickets (May cause multiple browser popups if using Browser connection).</div>
            </div>
          </label>
        </div>
      </div>

      <div className="p-6 bg-slate-50 border-t flex justify-between items-center">
        <div className="flex gap-2">
          {settings.connectionType !== 'browser' && (
            <button
              onClick={testPrintServer}
              className="px-3 py-1 bg-purple-600 text-white rounded text-xs font-bold hover:bg-purple-700"
            >
              Test Server
            </button>
          )}
          <button
            onClick={testPrint}
            className="px-3 py-1 bg-orange-600 text-white rounded text-xs font-bold hover:bg-orange-700"
          >
            Test Print
          </button>
        </div>

        <button
          onClick={saveSettings}
          disabled={isLoading}
          className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 flex items-center gap-2"
        >
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : saveSuccess ? <Check size={16} /> : <Save size={16} />}
          {isLoading ? "Saving..." : saveSuccess ? "Saved!" : "Save Settings"}
        </button>
      </div>

      <div className="p-6 bg-blue-50 border-t">
        <div className="flex items-start gap-3">
          <HelpCircle size={20} className="text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-bold text-blue-900 text-sm">How to use</h4>
            <ul className="text-blue-700 text-sm mt-1 list-disc ml-4 space-y-1">
              <li>Use &quot;browser&quot; mode for simple direct printing from Chrome.</li>
              <li>Use &quot;network/ip&quot; for direct communication with thermal printers via a print bridge.</li>
              <li>Check browser console if the print dialog doesn&apos;t appear.</li>
            </ul>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default PrintingSettings;