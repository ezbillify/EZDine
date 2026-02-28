import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/print_service.dart';
import '../services/audio_service.dart';
import '../services/bluetooth_manager.dart';
import 'package:permission_handler/permission_handler.dart';

import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:google_fonts/google_fonts.dart';
import '../core/theme.dart';

final printSettingsProvider = StateNotifierProvider<PrintSettingsNotifier, PrintSettings>((ref) {
  return PrintSettingsNotifier();
});

class PrintSettings {
  final bool consolidated;
  final String? printerIdKot;
  final String? printerIdInvoice;
  final bool isBluetooth;
  final String bridgeUrl;

  PrintSettings({
    this.consolidated = false,
    this.printerIdKot,
    this.printerIdInvoice,
    this.isBluetooth = false,
    this.bridgeUrl = 'http://192.168.1.100:4000',
  });

  PrintSettings copyWith({
    bool? consolidated,
    String? printerIdKot,
    String? printerIdInvoice,
    bool? isBluetooth,
    String? bridgeUrl,
  }) {
    return PrintSettings(
      consolidated: consolidated ?? this.consolidated,
      printerIdKot: printerIdKot ?? this.printerIdKot,
      printerIdInvoice: printerIdInvoice ?? this.printerIdInvoice,
      isBluetooth: isBluetooth ?? this.isBluetooth,
      bridgeUrl: bridgeUrl ?? this.bridgeUrl,
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
      bridgeUrl: prefs.getString('print_bridge_url') ?? 'http://192.168.1.100:4000',
    );
  }

  Future<void> updateSettings({
    bool? consolidated,
    String? printerIdKot,
    String? printerIdInvoice,
    bool? isBluetooth,
    String? bridgeUrl,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    if (consolidated != null) await prefs.setBool('print_consolidated', consolidated);
    if (printerIdKot != null) await prefs.setString('printer_id_kot', printerIdKot);
    if (printerIdInvoice != null) await prefs.setString('printer_id_invoice', printerIdInvoice);
    if (isBluetooth != null) await prefs.setBool('print_is_bluetooth', isBluetooth);
    if (bridgeUrl != null) await prefs.setString('print_bridge_url', bridgeUrl);

    state = state.copyWith(
      consolidated: consolidated,
      printerIdKot: printerIdKot,
      printerIdInvoice: printerIdInvoice,
      isBluetooth: isBluetooth,
      bridgeUrl: bridgeUrl,
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
  List<ScanResult> _devices = [];
  final Map<String, bool> _connectionStatus = {};

  @override
  void initState() {
    super.initState();
    _checkConnectedDevices();
  }

  Future<void> _checkConnectedDevices() async {
    final settings = ref.read(printSettingsProvider);
    if (settings.isBluetooth && settings.printerIdInvoice != null) {
      final deviceId = settings.printerIdInvoice!.replaceFirst("bt::", "");
      final isConnected = await BluetoothManager().isConnected(deviceId);
      if (mounted) {
        setState(() {
          _connectionStatus[deviceId] = isConnected;
        });
      }
    }
  }

  Future<void> _scanBluetooth() async {
    if (_scanning) return;

    try {
      // 1. Check if Bluetooth is supported
      if (await FlutterBluePlus.isSupported == false) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Bluetooth not supported")));
        return;
      }

      // 2. Request Permissions
      final List<Permission> permissions = [];
      if (Platform.isAndroid) {
        permissions.addAll([
          Permission.bluetoothScan,
          Permission.bluetoothConnect,
          Permission.location,
        ]);
      } else if (Platform.isIOS) {
        // On iOS, this triggers the "Bluetooth" permission alert
        permissions.add(Permission.bluetooth);
      }
      
      if (permissions.isNotEmpty) {
        await permissions.request();
      }

      // 3. Check and Turn On Bluetooth
      BluetoothAdapterState state = await FlutterBluePlus.adapterState.first;
      
      if (state != BluetoothAdapterState.on) {
        if (Platform.isAndroid) {
          try {
            await FlutterBluePlus.turnOn();
            // Wait for it to settle to "on"
            await FlutterBluePlus.adapterState.where((s) => s == BluetoothAdapterState.on).first.timeout(const Duration(seconds: 3));
          } catch (e) {
            if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Please enable Bluetooth in settings.")));
            return;
          }
        } else {
          // iOS cannot turn on BT programmatically
          if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Bluetooth is OFF. Please enable it in system settings.")));
          return;
        }
      }

      // 4. Double check adapter state
      if (await FlutterBluePlus.adapterState.first != BluetoothAdapterState.on) {
        return;
      }

      setState(() {
        _scanning = true;
        _devices = [];
      });

      // 5. Listen to results
      var subscription = FlutterBluePlus.onScanResults.listen((results) {
        if (mounted) {
          setState(() {
            // Filter out devices without names and sort by signal strength
            _devices = results.where((r) => r.device.name.isNotEmpty).toList();
            _devices.sort((a, b) => b.rssi.compareTo(a.rssi));
          });
        }
      });

      // 6. Start Scan
      await FlutterBluePlus.startScan(timeout: const Duration(seconds: 4));

      // 7. Wait for scan to finish
      await FlutterBluePlus.isScanning.where((val) => val == false).first;
      subscription.cancel();

    } catch (e) {
      debugPrint("Scan Error: $e");
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Scan Error: $e")));
      }
    } finally {
      if (mounted) setState(() => _scanning = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final settings = ref.watch(printSettingsProvider);
    final notifier = ref.read(printSettingsProvider.notifier);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text('PRINTER HUB', 
          style: GoogleFonts.outfit(fontWeight: FontWeight.w900, fontSize: 16, letterSpacing: 1)),
        leading: IconButton(
          icon: const Icon(LucideIcons.chevronLeft),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
             _buildSectionHeader("Print Operations"),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 20, offset: const Offset(0, 8)),
                ],
              ),
              child: SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: Text("Consolidated Receipt", style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
                subtitle: Text("All copies on one slip", style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey)),
                value: settings.consolidated,
                activeColor: AppTheme.primary,
                onChanged: (val) => notifier.updateSettings(consolidated: val),
              ),
            ),
            const SizedBox(height: 32),

            _buildSectionHeader("Connection Method"),
            Row(
              children: [
                Expanded(
                  child: _buildTypeCard(
                    icon: LucideIcons.network,
                    title: "Network Bridge",
                    selected: !settings.isBluetooth,
                    onTap: () => notifier.updateSettings(isBluetooth: false),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: _buildTypeCard(
                    icon: LucideIcons.bluetooth,
                    title: "Bluetooth Direct",
                    selected: settings.isBluetooth,
                    onTap: () {
                      notifier.updateSettings(isBluetooth: true);
                      _scanBluetooth();
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 32),

            if (settings.isBluetooth) ...[
              _buildSectionHeader("Paired Bluetooth Devices"),
               Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: [
                    BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 20, offset: const Offset(0, 8)),
                  ],
                ),
                child: Column(
                  children: [
                    ListTile(
                      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
                      leading: Icon(LucideIcons.refreshCw, size: 18, color: _scanning ? AppTheme.primary : Colors.grey),
                      title: Text(_scanning ? "Scanning for printers..." : "Tap to Scan Devices", 
                        style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 13)),
                      trailing: _scanning ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : null,
                      onTap: _scanBluetooth,
                    ),
                    const Divider(height: 1),
                    if (_devices.isEmpty && !_scanning)
                      Padding(
                        padding: const EdgeInsets.all(32.0),
                        child: Column(
                          children: [
                            Icon(LucideIcons.printer, size: 40, color: Colors.grey.shade200),
                            const SizedBox(height: 16),
                            Text("No devices found", style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: Colors.grey)),
                          ],
                        ),
                      ),
                    ..._devices.map((r) {
                      final deviceId = r.device.remoteId.toString();
                      final isSelected = settings.printerIdInvoice == "bt::$deviceId";
                      final isConnected = _connectionStatus[deviceId] ?? false;
                      
                      return ListTile(
                        leading: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: isSelected 
                              ? AppTheme.primary.withOpacity(0.1) 
                              : Colors.grey.withOpacity(0.1),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(LucideIcons.printer, 
                            size: 16, 
                            color: isSelected ? AppTheme.primary : Colors.grey),
                        ),
                        title: Row(
                          children: [
                            Expanded(
                              child: Text(r.device.name, 
                                style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 14)),
                            ),
                            if (isSelected && isConnected)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: Colors.green.withOpacity(0.1),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text('CONNECTED', 
                                  style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.green.shade700)),
                              ),
                          ],
                        ),
                        subtitle: Text(deviceId, style: TextStyle(fontSize: 10, color: Colors.grey.shade400)),
                        trailing: isSelected 
                            ? const Icon(LucideIcons.checkCircle2, color: Colors.green, size: 20) 
                            : null,
                        onTap: () async {
                          final id = "bt::$deviceId";
                          notifier.updateSettings(printerIdKot: id, printerIdInvoice: id);
                          // Reset reconnection attempts for new device
                          BluetoothManager().resetReconnectAttempts(deviceId);
                          _checkConnectedDevices();
                        },
                      );
                    }).toList(),
                  ],
                ),
              ),
            ] else ...[
              _buildSectionHeader("Bridge Configuration"),
              _buildNetworkInput(
                icon: LucideIcons.link,
                label: "PC Bridge URL", 
                value: settings.bridgeUrl,
                onChanged: (val) => notifier.updateSettings(bridgeUrl: val),
              ),
              const SizedBox(height: 16),
              _buildNetworkInput(
                icon: LucideIcons.terminal,
                label: "Kitchen Station ID", 
                value: settings.printerIdKot ?? "",
                onChanged: (val) => notifier.updateSettings(printerIdKot: val),
              ),
              const SizedBox(height: 16),
              _buildNetworkInput(
                icon: LucideIcons.fileText,
                label: "Billing Station ID", 
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
        padding: const EdgeInsets.symmetric(vertical: 20),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFF0F172A) : Colors.white,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            if (selected) BoxShadow(color: const Color(0xFF0F172A).withOpacity(0.2), blurRadius: 15, offset: const Offset(0, 8)),
            if (!selected) BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10, offset: const Offset(0, 4)),
          ],
          border: Border.all(color: selected ? const Color(0xFF0F172A) : Colors.grey.shade100),
        ),
        child: Column(
          children: [
            Icon(icon, color: selected ? Colors.white : Colors.grey.shade400, size: 24),
            const SizedBox(height: 12),
            Text(title, style: GoogleFonts.outfit(
              color: selected ? Colors.white : Colors.grey.shade400, 
              fontWeight: FontWeight.w900, 
              fontSize: 10,
              letterSpacing: 0.5
            )),
          ],
        ),
      ),
    );
  }

  Widget _buildNetworkInput({required IconData icon, required String label, required String value, required Function(String) onChanged}) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10, offset: const Offset(0, 4)),
        ],
      ),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
      child: TextFormField(
        initialValue: value,
        onChanged: onChanged,
        style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 14),
        decoration: InputDecoration(
          icon: Icon(icon, size: 16, color: Colors.grey.shade300),
          border: InputBorder.none,
          labelText: label.toUpperCase(),
          labelStyle: GoogleFonts.outfit(color: Colors.grey.shade400, fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1),
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
      // Header
      PrintLine(text: "EZDine Demo", align: "center", bold: true),
      PrintLine(text: "Branch: Main", align: "center"),
      PrintLine(text: "--------------------------------", align: "center"),

      // Section 1: KOT
      PrintLine(text: "KITCHEN ORDER (COPY)", align: "center", bold: true),
      PrintLine(text: "TOKEN: 42", align: "center", bold: true),
      PrintLine(text: "TABLE: T3", align: "center", bold: true),
      PrintLine(text: "Order: #1001 | 22:45", align: "center"),
      PrintLine(text: "1 x Paneer Butter Masala", align: "left", bold: true),
      PrintLine(text: "2 x Butter Naan", align: "left", bold: true),
      
      PrintLine(text: "--------------------------------", align: "center"),

      // Section 2: Bill
      PrintLine(text: "CUSTOMER INVOICE", align: "center"),
      PrintLine(text: "1 x Paneer Tikka        220.00", align: "left"),
      PrintLine(text: "2 x Butter Naan          80.00", align: "left"),
      PrintLine(text: "--------------------------------", align: "center"),
      PrintLine(text: "TOTAL: 300.00", align: "center", bold: true),
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
                              fontSize: 13.0 * (l.height > 1 ? 1.5 : 1.0),
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
