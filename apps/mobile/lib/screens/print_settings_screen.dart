import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/print_service.dart';
import '../services/audio_service.dart';

import 'package:print_bluetooth_thermal/print_bluetooth_thermal.dart';

final printSettingsProvider = StateNotifierProvider<PrintSettingsNotifier, PrintSettings>((ref) {
  return PrintSettingsNotifier();
});

class PrintSettings {
  final bool consolidated;
  final String? printerIdKot;
  final String? printerIdInvoice;
  final bool isBluetooth;

  PrintSettings({
    this.consolidated = false,
    this.printerIdKot,
    this.printerIdInvoice,
    this.isBluetooth = false,
  });

  PrintSettings copyWith({
    bool? consolidated,
    String? printerIdKot,
    String? printerIdInvoice,
    bool? isBluetooth,
  }) {
    return PrintSettings(
      consolidated: consolidated ?? this.consolidated,
      printerIdKot: printerIdKot ?? this.printerIdKot,
      printerIdInvoice: printerIdInvoice ?? this.printerIdInvoice,
      isBluetooth: isBluetooth ?? this.isBluetooth,
    );
  }
}

class PrintSettingsNotifier extends StateNotifier<PrintSettings> {
  PrintSettingsNotifier() : super(PrintSettings()) {
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    state = PrintSettings(
      consolidated: prefs.getBool('print_consolidated') ?? false,
      printerIdKot: prefs.getString('printer_id_kot'),
      printerIdInvoice: prefs.getString('printer_id_invoice'),
      isBluetooth: prefs.getBool('print_is_bluetooth') ?? false,
    );
  }

  Future<void> updateSettings({
    bool? consolidated,
    String? printerIdKot,
    String? printerIdInvoice,
    bool? isBluetooth,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    if (consolidated != null) await prefs.setBool('print_consolidated', consolidated);
    if (printerIdKot != null) await prefs.setString('printer_id_kot', printerIdKot);
    if (printerIdInvoice != null) await prefs.setString('printer_id_invoice', printerIdInvoice);
    if (isBluetooth != null) await prefs.setBool('print_is_bluetooth', isBluetooth);

    state = state.copyWith(
      consolidated: consolidated,
      printerIdKot: printerIdKot,
      printerIdInvoice: printerIdInvoice,
      isBluetooth: isBluetooth,
    );
  }
}

class PrintSettingsScreen extends ConsumerStatefulWidget {
  const PrintSettingsScreen({super.key});

  @override
  ConsumerState<PrintSettingsScreen> createState() => _PrintSettingsScreenState();
}

class _PrintSettingsScreenState extends ConsumerState<PrintSettingsScreen> {
  bool _scanning = false;
  List<BluetoothInfo> _devices = [];

  @override
  void initState() {
    super.initState();
  }

  Future<void> _scanBluetooth() async {
    setState(() => _scanning = true);
    try {
      final bool result = await PrintBluetoothThermal.isPermissionBluetoothGranted;
      if (!result) {
         ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Bluetooth Permission Denied")));
         return;
      }

      final List<BluetoothInfo> list = await PrintBluetoothThermal.pairedBluetooths;
      setState(() => _devices = list);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Scan Error: $e")));
    } finally {
      setState(() => _scanning = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final settings = ref.watch(printSettingsProvider);
    final notifier = ref.read(printSettingsProvider.notifier);

    return Scaffold(
      appBar: AppBar(
        title: const Text("Printer Setup", style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(LucideIcons.arrowLeft, color: Colors.black),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      backgroundColor: const Color(0xFFF8FAFC),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildSectionHeader("Print Mode"),
            Card(
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.grey.shade200)),
              child: SwitchListTile(
                title: const Text("Consolidated Receipt", style: TextStyle(fontWeight: FontWeight.w600)),
                subtitle: const Text("Print Bill, Token & KOT on one long slip"),
                value: settings.consolidated,
                activeColor: const Color(0xFF0F172A),
                onChanged: (val) => notifier.updateSettings(consolidated: val),
              ),
            ),
            const SizedBox(height: 24),

            _buildSectionHeader("Connection Type"),
            Row(
              children: [
                Expanded(
                  child: _buildTypeCard(
                    icon: LucideIcons.wifi,
                    title: "Network Bridge",
                    selected: !settings.isBluetooth,
                    onTap: () => notifier.updateSettings(isBluetooth: false),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildTypeCard(
                    icon: LucideIcons.bluetooth,
                    title: "Bluetooth Direct",
                    selected: settings.isBluetooth,
                    onTap: () => notifier.updateSettings(isBluetooth: true),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            if (settings.isBluetooth) ...[
              _buildSectionHeader("Bluetooth Devices"),
               Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: Column(
                  children: [
                    ListTile(
                      title: const Text("Scan for Printers"),
                      trailing: _scanning ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(LucideIcons.refreshCw, size: 20),
                      onTap: _scanBluetooth,
                    ),
                    const Divider(height: 1),
                    if (_devices.isEmpty)
                      const Padding(
                        padding: EdgeInsets.all(20.0),
                        child: Text("No devices found. Ensure printer is paired in System Settings.", style: TextStyle(color: Colors.grey, fontSize: 13), textAlign: TextAlign.center),
                      ),
                    ..._devices.map((d) => ListTile(
                      leading: const Icon(LucideIcons.printer),
                      title: Text(d.name),
                      subtitle: Text(d.macAdress),
                      trailing: (settings.printerIdInvoice == "bt::${d.macAdress}") 
                          ? const Icon(LucideIcons.checkCircle, color: Colors.green) 
                          : null,
                      onTap: () {
                         // Set both KOT and Invoice to this BT printer for simplicity in direct mode
                         final id = "bt::${d.macAdress}";
                         notifier.updateSettings(printerIdKot: id, printerIdInvoice: id);
                         ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Selected ${d.name}")));
                      },
                    )).toList(),
                  ],
                ),
              ),
            ] else ...[
              _buildSectionHeader("Network IDs (PC Bridge)"),
              _buildNetworkInput(
                label: "Kitchen Printer ID", 
                value: settings.printerIdKot ?? "",
                onChanged: (val) => notifier.updateSettings(printerIdKot: val),
              ),
              const SizedBox(height: 12),
              _buildNetworkInput(
                label: "Bill/Token Printer ID", 
                value: settings.printerIdInvoice ?? "",
                onChanged: (val) => notifier.updateSettings(printerIdInvoice: val),
              ),
            ],

            const SizedBox(height: 40),
            const SizedBox(height: 32),
            _buildSectionHeader("Diagnostics"),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      const Icon(LucideIcons.info, size: 16, color: Colors.blue),
                      const SizedBox(width: 12),
                      Expanded(child: Text("Use Preview to check layout alignment before printing.", style: TextStyle(color: Colors.blue.shade900, fontSize: 12, height: 1.4))),
                    ],
                  ),
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      Expanded(child: _buildDiagnosticCard("Kitchen KOT", "58mm", LucideIcons.terminal, () => _handleKot(true), () => _handleKot(false))),
                      const SizedBox(width: 12),
                      if (settings.consolidated)
                        Expanded(child: _buildDiagnosticCard("Consolidated", "58mm", LucideIcons.layers, () => _handleConsolidated(true), () => _handleConsolidated(false)))
                      else
                        Expanded(child: _buildDiagnosticCard("Tax Invoice", "80mm", LucideIcons.fileText, () => _handleInvoice(true), () => _handleInvoice(false))),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12.0, left: 4),
      child: Text(title.toUpperCase(), style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey.shade500, letterSpacing: 1.2)),
    );
  }

  Widget _buildTypeCard({required IconData icon, required String title, required bool selected, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFF0F172A) : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: selected ? const Color(0xFF0F172A) : Colors.grey.shade200),
          boxShadow: selected ? [BoxShadow(color: const Color(0xFF0F172A).withOpacity(0.2), blurRadius: 8, offset: const Offset(0, 4))] : [],
        ),
        child: Column(
          children: [
            Icon(icon, color: selected ? Colors.white : Colors.black87, size: 28),
            const SizedBox(height: 8),
            Text(title, style: TextStyle(color: selected ? Colors.white : Colors.black87, fontWeight: FontWeight.bold, fontSize: 13)),
          ],
        ),
      ),
    );
  }

  Widget _buildNetworkInput({required String label, required String value, required Function(String) onChanged}) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: TextFormField(
        initialValue: value,
        onChanged: onChanged,
        decoration: InputDecoration(
          border: InputBorder.none,
          labelText: label,
          labelStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13),
        ),
      ),
    );
  }

  Widget _buildDiagnosticCard(String title, String subtitle, IconData icon, VoidCallback onPreview, VoidCallback onPrint) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.grey.shade100)),
                child: Icon(icon, size: 16, color: Colors.grey.shade700),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                  Text(subtitle, style: TextStyle(color: Colors.grey.shade500, fontSize: 10)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: onPreview,
                  style: OutlinedButton.styleFrom(
                    padding: EdgeInsets.zero,
                    minimumSize: const Size(0, 32),
                    side: BorderSide(color: Colors.grey.shade300),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  child: const Text("Preview", style: TextStyle(fontSize: 11, color: Colors.black87)),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ElevatedButton(
                  onPressed: onPrint,
                  style: ElevatedButton.styleFrom(
                    padding: EdgeInsets.zero,
                    minimumSize: const Size(0, 32),
                    backgroundColor: Colors.black,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  child: const Text("Print", style: TextStyle(fontSize: 11)),
                ),
              ),
            ],
          )
        ],
      ),
    );
  }

  void _handleKot(bool preview) {
    final lines = [
      PrintLine(text: "EZDine Demo", align: "center", bold: true),
      PrintLine(text: "KOT #1001", align: "left", bold: true),
      PrintLine(text: "Table: T3", align: "left"),
      PrintLine(text: "--------------------------------", align: "center"),
      PrintLine(text: "1 x Paneer Butter Masala", align: "left"),
      PrintLine(text: "2 x Butter Naan", align: "left"),
      PrintLine(text: "    (Less oil)", align: "left"),
      PrintLine(text: "--------------------------------", align: "center"),
      PrintLine(text: DateTime.now().toString().substring(0, 16), align: "right"),
    ];

    if (preview) {
      _showPreview("KOT Preview", lines, 58);
    } else {
      _sendTestPrint(_getSelectedPrinter("kot") ?? "kitchen-1", "kot", 58, lines);
    }
  }

  void _handleInvoice(bool preview) {
    final lines = [
      PrintLine(text: "EZDine Demo", align: "center", bold: true),
      PrintLine(text: "Branch: Main", align: "center"),
      PrintLine(text: "Bill: B-1021", align: "left", bold: true),
      PrintLine(text: "Date: ${DateTime.now().toString().substring(0, 10)}", align: "left"),
      PrintLine(text: "--------------------------------", align: "center"),
      PrintLine(text: "Item              Qty    Price", align: "left", bold: true),
      PrintLine(text: "--------------------------------", align: "center"),
      PrintLine(text: "Veg Biryani        1     220.0", align: "left"),
      PrintLine(text: "Raita              1      40.0", align: "left"),
      PrintLine(text: "--------------------------------", align: "center"),
      PrintLine(text: "Subtotal:                260.0", align: "right"),
      PrintLine(text: "Tax (5%):                 13.0", align: "right"),
      PrintLine(text: "Total:                   273.0", align: "right", bold: true),
      PrintLine(text: "--------------------------------", align: "center"),
      PrintLine(text: "Thank you for dining with us!", align: "center"),
    ];

    if (preview) {
      _showPreview("Invoice Preview", lines, 80);
    } else {
      _sendTestPrint(_getSelectedPrinter("invoice") ?? "billing-1", "invoice", 80, lines);
    }
  }

  void _handleConsolidated(bool preview) {
    final lines = [
      // KOT Copy
      PrintLine(text: "KITCHEN ORDER (COPY)", align: "center", bold: true),
      PrintLine(text: "Order: #1001", align: "left"),
      PrintLine(text: "Table: T3", align: "left", bold: true),
      PrintLine(text: "TOKEN: 42", align: "center", bold: true),
      PrintLine(text: "--------------------------------", align: "center"),
      PrintLine(text: "1 x Paneer Butter Masala", align: "left", bold: true),
      PrintLine(text: "2 x Butter Naan (Less oil)", align: "left", bold: true),
      PrintLine(text: "================================", align: "center"),
      PrintLine(text: " ", align: "center"),

      // Customer Invoice
      PrintLine(text: "EZDine Demo", align: "center", bold: true),
      PrintLine(text: "CUSTOMER INVOICE", align: "center", bold: true),
      PrintLine(text: "Date: ${DateTime.now().toString().substring(0, 16)}", align: "left"),
      PrintLine(text: "--------------------------------", align: "center"),
      PrintLine(text: "Veg Biryani        1     220.0", align: "left"),
      PrintLine(text: "Raita              1      40.0", align: "left"),
      PrintLine(text: "--------------------------------", align: "center"),
      PrintLine(text: "Total:                   273.0", align: "right", bold: true),
      PrintLine(text: "================================", align: "center"),
      PrintLine(text: " ", align: "center"),

      // Token Slip
      PrintLine(text: "TOKEN SLIP", align: "center", bold: true),
      PrintLine(text: "42", align: "center", bold: true),
      PrintLine(text: "Type: Dine In", align: "center"),
      PrintLine(text: "Thank you!", align: "center"),
    ];

    if (preview) {
      _showPreview("Consolidated Preview (58mm)", lines, 58);
    } else {
      _sendTestPrint(_getSelectedPrinter("invoice") ?? "billing-1", "invoice", 58, lines);
    }
  }

  String? _getSelectedPrinter(String type) {
    final settings = ref.read(printSettingsProvider);
    return type == 'kot' ? settings.printerIdKot : settings.printerIdInvoice;
  }

  Future<void> _sendTestPrint(String printerId, String type, int width, List<PrintLine> lines) async {
    final printService = ref.read(printServiceProvider);
    
    final job = PrintJob(
      printerId: printerId,
      width: width,
      type: type,
      lines: lines,
    );

    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Sending print job...")));
    bool success = await printService.sendPrintJob(job);
    
    if (mounted) {
      if (success) {
        AudioService.instance.playSuccess();
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(backgroundColor: Colors.green, content: Text("Print Success!")));
      } else {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(backgroundColor: Colors.red, content: Text("Print Failed. Check connection.")));
      }
    }
  }

  void _showPreview(String title, List<PrintLine> lines, int width) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        height: MediaQuery.of(context).size.height * 0.85,
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(16.0),
              decoration: BoxDecoration(border: Border(bottom: BorderSide(color: Colors.grey.shade200))),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  IconButton(icon: const Icon(LucideIcons.x), onPressed: () => Navigator.pop(context)),
                ],
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
                child: Center(
                  child: Container(
                    width: width == 58 ? 250 : 350, // Approx widths
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 20, offset: const Offset(0, 4))],
                      border: Border.all(color: Colors.grey.shade200),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: lines.map((l) {
                        TextAlign align;
                        switch(l.align) {
                          case 'center': align = TextAlign.center; break;
                          case 'right': align = TextAlign.right; break;
                          default: align = TextAlign.left;
                        }
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 4.0),
                          child: Text(
                            l.text, 
                            textAlign: align,
                            style: TextStyle(
                              fontFamily: 'Courier', // Monospace for receipt look
                              fontWeight: l.bold ? FontWeight.w900 : FontWeight.normal,
                              fontSize: 13,
                              color: Colors.black87,
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () {
                    Navigator.pop(context);
                    if (title.contains("KOT")) _handleKot(false);
                    else _handleInvoice(false);
                  },
                  icon: const Icon(LucideIcons.printer),
                  label: const Text("PRINT NOW"),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.black,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            )
          ],
        ),
      ),
    );
  }
}
