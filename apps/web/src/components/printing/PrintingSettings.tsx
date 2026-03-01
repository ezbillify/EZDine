"use client";

import React, { useState, useEffect } from "react";
import { Save, Check, Loader2, HelpCircle } from "lucide-react";
import { Card } from "../ui/Card";
import { getPrintingSettings, savePrintingSettings, sendPrintJob } from "../../lib/printing";
import { toast } from "sonner";

const PrintingSettings: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [userContext, setUserContext] = useState<{
    restaurantId?: string;
    branchId?: string;
    restaurantName?: string;
    branchName?: string;
  }>({});
  const [settings, setSettings] = useState({
    bridgeUrl: 'http://localhost:8080',
    printerIdInvoice: 'default-printer',
    printerIdKot: 'default-printer',
    widthInvoice: 80,
    widthKot: 80,
    connectionType: 'network',
    printerName: '',
    ipAddress: '',
    bluetoothAddress: ''
  });

  useEffect(() => {
    loadUserContext();
    loadSettings();
  }, []);

  const loadUserContext = async () => {
    try {
      const { getCurrentUserProfile, getAccessibleRestaurants, getAccessibleBranches } = await import("../../lib/tenant");
      const profile = await getCurrentUserProfile();
      
      if (profile) {
        let restaurantName = '';
        let branchName = '';
        
        // Get restaurant name if active_restaurant_id exists
        if (profile.active_restaurant_id) {
          try {
            const restaurants = await getAccessibleRestaurants();
            const restaurant = restaurants.find(r => r.id === profile.active_restaurant_id);
            restaurantName = restaurant?.name || '';
          } catch (err) {
            if (typeof window !== 'undefined' && window.console) {
              window.console.warn('Failed to load restaurant name:', err);
            }
          }
        }
        
        // Get branch name if active_branch_id exists
        if (profile.active_branch_id) {
          try {
            const branches = await getAccessibleBranches(profile.active_restaurant_id || undefined);
            const branch = branches.find(b => b.id === profile.active_branch_id);
            branchName = branch?.name || '';
          } catch (err) {
            if (typeof window !== 'undefined' && window.console) {
              window.console.warn('Failed to load branch name:', err);
            }
          }
        }
        
        setUserContext({
          restaurantId: profile.active_restaurant_id || undefined,
          branchId: profile.active_branch_id || undefined,
          restaurantName,
          branchName
        });
      }
    } catch (err) {
      if (typeof window !== 'undefined' && window.console) {
        window.console.error('Failed to load user context:', err);
      }
    }
  };

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
          bridgeUrl: saved.bridgeUrl || 'http://localhost:8080',
          printerIdInvoice: saved.printerIdInvoice || 'default-printer',
          printerIdKot: saved.printerIdKot || 'default-printer',
          widthInvoice: saved.widthInvoice || 80,
          widthKot: saved.widthKot || 80,
          connectionType: saved.connectionType || 'network',
          printerName: saved.printerName || '',
          ipAddress: saved.ipAddress || '',
          bluetoothAddress: saved.bluetoothAddress || ''
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
      
      // Save directly - no user context required for localStorage
      const result = await savePrintingSettings(settings);
      if (typeof window !== 'undefined' && window.console) {
        window.console.log('Settings saved successfully');
      }
      
      setSaveSuccess(true);
      toast.success('Printer settings saved successfully!');
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      // Log error details for debugging
      if (typeof window !== 'undefined' && window.console) {
        window.console.error('Failed to save settings - Full error object:', err);
        window.console.error('Error name:', err?.constructor?.name);
        window.console.error('Error message:', err?.message);
        window.console.error('Error stack:', err?.stack);
      }
      
      let errorMessage = 'Unknown error occurred';
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      } else if (err && typeof err === 'object') {
        // Handle Supabase errors which might have nested error structures
        if ('message' in err) {
          errorMessage = String(err.message);
        } else if ('error' in err && typeof err.error === 'string') {
          errorMessage = err.error;
        } else if ('details' in err && typeof err.details === 'string') {
          errorMessage = err.details;
        } else {
          errorMessage = JSON.stringify(err);
        }
      }
      
      if (typeof window !== 'undefined' && window.console) {
        window.console.error('Final error message to show user:', errorMessage);
      }
      toast.error('Failed to save settings: ' + errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const testPrintServer = async () => {
    try {
      const currentSettings = await getPrintingSettings();
      const serverUrl = currentSettings?.bridgeUrl || 'http://localhost:8080';
      
      if (typeof window !== 'undefined' && window.console) {
        window.console.log('Testing print server at:', serverUrl);
      }
      
      // Test print server connectivity with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(`${serverUrl}/health`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        toast.success(`Print server is reachable at ${serverUrl}!`);
      } else {
        toast.error(`Print server responded with error: ${response.status}`);
      }
    } catch (err: any) {
      if (typeof window !== 'undefined' && window.console) {
        window.console.error('Print server test failed:', err);
      }
      
      if (err.name === 'AbortError') {
        toast.error('Print server timeout - server may not be running');
      } else if (err.message?.includes('fetch') || err.message?.includes('Failed to fetch')) {
        toast.error(`Cannot connect to print server. Make sure it's running at ${settings.bridgeUrl}`);
      } else {
        toast.error(`Print server test failed: ${err.message}`);
      }
    }
  };

  const testPrint = async () => {
    try {
      const currentSettings = await getPrintingSettings();
      console.log('Current printing settings:', currentSettings);
      
      if (!currentSettings) {
        toast.error('No printer settings configured');
        return;
      }
      
      // Test print job
      const testLines = [
        { text: "=== TEST PRINT ===", align: "center" as const, bold: true },
        { text: "EZDine POS System", align: "center" as const },
        { text: "Print Test Successful", align: "center" as const },
        { text: new Date().toLocaleString(), align: "center" as const },
        { text: "==================", align: "center" as const }
      ];
      
      const success = await sendPrintJob({
        printerId: currentSettings.printerIdInvoice || 'default-printer',
        width: currentSettings.widthInvoice || 80,
        type: 'invoice',
        lines: testLines
      });
      
      if (success) {
        toast.success('Test print sent successfully!');
      } else {
        toast.error('Test print failed - check printer connection');
      }
    } catch (err) {
      console.error('Test print failed:', err);
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
            <div className="mt-2 px-2 py-1 bg-orange-500 text-white text-xs font-bold rounded">
              TEMPORARY: Using localStorage (Supabase setup not required)
            </div>
          </div>
          <div className="text-right text-xs text-slate-400">
            <div>Mode: Local Storage</div>
            <div className="mt-1 px-2 py-1 rounded text-xs font-bold bg-green-500 text-white">
              Ready to Test
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-white text-sm font-bold">✓</span>
            </div>
            <div>
              <h4 className="font-bold text-green-900 text-sm">Ready to Test</h4>
              <p className="text-green-700 text-sm mt-1">
                Settings are now saved locally. Configure your printer and test immediately!
              </p>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Print Server URL</label>
          <input
            type="text"
            value={settings.bridgeUrl}
            onChange={(e) => setSettings(prev => ({ ...prev, bridgeUrl: e.target.value }))}
            placeholder="http://localhost:8080"
            className="w-full p-3 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
          <p className="text-xs text-slate-500 mt-1">URL of your print server or bridge application</p>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-3">Connection Method</label>
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => setSettings(prev => ({ ...prev, connectionType: 'network' }))}
              className={`p-4 rounded-xl border-2 text-center transition-all ${
                settings.connectionType === 'network'
                  ? 'border-brand-300 bg-brand-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="font-bold">Network</div>
            </button>
            <button
              onClick={() => setSettings(prev => ({ ...prev, connectionType: 'bluetooth' }))}
              className={`p-4 rounded-xl border-2 text-center transition-all ${
                settings.connectionType === 'bluetooth'
                  ? 'border-brand-300 bg-brand-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="font-bold">Bluetooth</div>
            </button>
            <button
              onClick={() => setSettings(prev => ({ ...prev, connectionType: 'ip' }))}
              className={`p-4 rounded-xl border-2 text-center transition-all ${
                settings.connectionType === 'ip'
                  ? 'border-brand-300 bg-brand-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="font-bold">IP Address</div>
            </button>
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
              <option value={56}>56mm (Small)</option>
              <option value={58}>58mm (Standard)</option>
              <option value={80}>80mm (Wide)</option>
            </select>
          </div>

          {settings.connectionType === 'network' && (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Printer Name</label>
              <input
                type="text"
                value={settings.printerName}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  printerName: e.target.value,
                  printerIdInvoice: e.target.value,
                  printerIdKot: e.target.value
                }))}
                placeholder="e.g., Kitchen_Printer_1"
                className="w-full p-3 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
          )}

          {settings.connectionType === 'ip' && (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">IP Address</label>
              <input
                type="text"
                value={settings.ipAddress}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  ipAddress: e.target.value,
                  printerIdInvoice: e.target.value,
                  printerIdKot: e.target.value
                }))}
                placeholder="192.168.1.100"
                className="w-full p-3 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
          )}

          {settings.connectionType === 'bluetooth' && (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Bluetooth Address</label>
              <input
                type="text"
                value={settings.bluetoothAddress}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  bluetoothAddress: e.target.value,
                  printerIdInvoice: e.target.value,
                  printerIdKot: e.target.value
                }))}
                placeholder="00:11:22:33:44:55"
                className="w-full p-3 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
          )}
        </div>
      </div>

      <div className="p-6 bg-slate-50 border-t flex justify-between items-center">
        <div className="flex gap-2">
          <button
            onClick={testPrintServer}
            className="px-3 py-1 bg-purple-600 text-white rounded text-xs font-bold hover:bg-purple-700"
          >
            Test Server
          </button>
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
          className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Saving...
            </>
          ) : saveSuccess ? (
            <>
              <Check size={16} />
              Saved!
            </>
          ) : (
            <>
              <Save size={16} />
              Save Settings
            </>
          )}
        </button>
      </div>

      <div className="p-6 bg-blue-50 border-t">
        <div className="flex items-start gap-3">
          <HelpCircle size={20} className="text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-bold text-blue-900 text-sm">Troubleshooting</h4>
            <p className="text-blue-700 text-sm mt-1">
              1. Make sure your print server is running on the specified URL<br/>
              2. Use "Test Server" to check connectivity<br/>
              3. Use "Test Print" to verify printer setup<br/>
              4. Check browser console for detailed error messages<br/>
              5. Ensure you have selected a restaurant and branch
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default PrintingSettings;