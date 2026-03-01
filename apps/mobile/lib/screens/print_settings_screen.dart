import 'dart:io';
import 'dart:async';
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
  final PrintConnectionType connectionType;
  final String bridgeUrl;
  final String? printerIpKot;
  final String? printerIpInvoice;
  final int paperWidthKot;
  final int paperWidthInvoice;

  PrintSettings({
    this.consolidated = false,
    this.printerIdKot,
    this.printerIdInvoice,
    this.connectionType = PrintConnectionType.networkBridge,
    this.bridgeUrl = 'http://192.168.1.100:4000',
    this.printerIpKot,
    this.printerIpInvoice,
    this.paperWidthKot = 58,
    this.paperWidthInvoice = 58,
  });

  PrintSettings copyWith({
    bool? consolidated,
    String? printerIdKot,
    String? printerIdInvoice,
    PrintConnectionType? connectionType,
    String? bridgeUrl,
    String? printerIpKot,
    String? printerIpInvoice,
    int? paperWidthKot,
    int? paperWidthInvoice,
  }) {
    return PrintSettings(
      consolidated: consolidated ?? this.consolidated,
      printerIdKot: printerIdKot ?? this.printerIdKot,
      printerIdInvoice: printerIdInvoice ?? this.printerIdInvoice,
      connectionType: connectionType ?? this.connectionType,
      bridgeUrl: bridgeUrl ?? this.bridgeUrl,
      printerIpKot: printerIpKot ?? this.printerIpKot,
      printerIpInvoice: printerIpInvoice ?? this.printerIpInvoice,
      paperWidthKot: paperWidthKot ?? this.paperWidthKot,
      paperWidthInvoice: paperWidthInvoice ?? this.paperWidthInvoice,
    );
  }

  // Legacy compatibility
  bool get isBluetooth => connectionType == PrintConnectionType.bluetooth;
}

enum PrintConnectionType {
  networkBridge,
  bluetooth,
  ipAddress,
}

enum PaperWidth {
  mm56(56, "56mm"),
  mm58(58, "58mm"), 
  mm80(80, "80mm");

  const PaperWidth(this.width, this.label);
  final int width;
  final String label;
}

class PrintSettingsNotifier extends StateNotifier<PrintSettings> {
  PrintSettingsNotifier() : super(PrintSettings()) {
    _loadSettings();
  }

  // Add debounce timer to prevent rapid updates
  Timer? _debounceTimer;

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    
    // Handle legacy boolean setting
    final legacyIsBluetooth = prefs.getBool('print_is_bluetooth') ?? false;
    final connectionTypeIndex = prefs.getInt('print_connection_type') ?? 
        (legacyIsBluetooth ? 1 : 0); // 0=bridge, 1=bluetooth, 2=ip
    
    state = PrintSettings(
      consolidated: prefs.getBool('print_consolidated') ?? false,
      printerIdKot: prefs.getString('printer_id_kot'),
      printerIdInvoice: prefs.getString('printer_id_invoice'),
      connectionType: PrintConnectionType.values[connectionTypeIndex],
      bridgeUrl: prefs.getString('print_bridge_url') ?? 'http://192.168.1.100:4000',
      printerIpKot: prefs.getString('printer_ip_kot'),
      printerIpInvoice: prefs.getString('printer_ip_invoice'),
      paperWidthKot: prefs.getInt('paper_width_kot') ?? 58,
      paperWidthInvoice: prefs.getInt('paper_width_invoice') ?? 58,
    );
  }

  Future<void> updateSettings({
    bool? consolidated,
    String? printerIdKot,
    String? printerIdInvoice,
    PrintConnectionType? connectionType,
    String? bridgeUrl,
    String? printerIpKot,
    String? printerIpInvoice,
    int? paperWidthKot,
    int? paperWidthInvoice,
  }) async {
    // Cancel previous debounce timer
    _debounceTimer?.cancel();
    
    // Update state immediately for UI responsiveness
    state = state.copyWith(
      consolidated: consolidated,
      printerIdKot: printerIdKot,
      printerIdInvoice: printerIdInvoice,
      connectionType: connectionType,
      bridgeUrl: bridgeUrl,
      printerIpKot: printerIpKot,
      printerIpInvoice: printerIpInvoice,
      paperWidthKot: paperWidthKot,
      paperWidthInvoice: paperWidthInvoice,
    );
    
    // Debounce the SharedPreferences writes to prevent rapid I/O
    _debounceTimer = Timer(const Duration(milliseconds: 300), () async {
      final prefs = await SharedPreferences.getInstance();
      if (consolidated != null) await prefs.setBool('print_consolidated', consolidated);
      if (printerIdKot != null) await prefs.setString('printer_id_kot', printerIdKot);
      if (printerIdInvoice != null) await prefs.setString('printer_id_invoice', printerIdInvoice);
      if (connectionType != null) {
        await prefs.setInt('print_connection_type', connectionType.index);
        // Keep legacy setting for backward compatibility
        await prefs.setBool('print_is_bluetooth', connectionType == PrintConnectionType.bluetooth);
      }
      if (bridgeUrl != null) await prefs.setString('print_bridge_url', bridgeUrl);
      if (printerIpKot != null) await prefs.setString('printer_ip_kot', printerIpKot);
      if (printerIpInvoice != null) await prefs.setString('printer_ip_invoice', printerIpInvoice);
      if (paperWidthKot != null) await prefs.setInt('paper_width_kot', paperWidthKot);
      if (paperWidthInvoice != null) await prefs.setInt('paper_width_invoice', paperWidthInvoice);
    });
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    super.dispose();
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
    if (settings.connectionType == PrintConnectionType.bluetooth && settings.printerIdInvoice != null) {
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
      key: const ValueKey('print_settings_scaffold'), // Add stable key
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
            // Welcome Header
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [AppTheme.primary.withOpacity(0.1), Colors.white],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppTheme.primary.withOpacity(0.2)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppTheme.primary,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(LucideIcons.printer, color: Colors.white, size: 24),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Printer Setup Made Easy',
                              style: GoogleFonts.outfit(
                                fontSize: 20,
                                fontWeight: FontWeight.w900,
                                color: AppTheme.secondary,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Connect your kitchen and billing printers in 3 simple steps',
                              style: GoogleFonts.outfit(
                                fontSize: 14,
                                color: Colors.grey.shade600,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 32),

            // Step 1: Print Mode
            _buildStepCard(
              stepNumber: 1,
              title: 'Choose Your Print Style',
              description: 'How do you want your receipts printed?',
              child: Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: Colors.grey.shade50,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: _buildPrintModeCard(
                        icon: LucideIcons.layers,
                        title: 'All-in-One Receipt',
                        subtitle: 'Kitchen + Bill together',
                        isSelected: settings.consolidated,
                        onTap: () => notifier.updateSettings(consolidated: true),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _buildPrintModeCard(
                        icon: LucideIcons.splitSquareHorizontal,
                        title: 'Separate Receipts',
                        subtitle: 'Kitchen & Bill separate',
                        isSelected: !settings.consolidated,
                        onTap: () => notifier.updateSettings(consolidated: false),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Step 2: Connection Method
            _buildStepCard(
              stepNumber: 2,
              title: 'How Are Your Printers Connected?',
              description: 'Choose based on how your printers connect to this device',
              child: Column(
                children: [
                  _buildConnectionCard(
                    icon: LucideIcons.wifi,
                    title: 'WiFi/Ethernet Printers',
                    subtitle: 'Printers connected to your network with IP addresses',
                    example: 'Example: 192.168.1.100',
                    isSelected: settings.connectionType == PrintConnectionType.ipAddress,
                    onTap: () => notifier.updateSettings(connectionType: PrintConnectionType.ipAddress),
                    color: Colors.blue,
                  ),
                  const SizedBox(width: 12),
                  _buildConnectionCard(
                    icon: LucideIcons.bluetooth,
                    title: 'Bluetooth Printers',
                    subtitle: 'Printers that pair directly with this tablet',
                    example: 'We\'ll scan and show available printers',
                    isSelected: settings.connectionType == PrintConnectionType.bluetooth,
                    onTap: () {
                      notifier.updateSettings(connectionType: PrintConnectionType.bluetooth);
                      _scanBluetooth();
                    },
                    color: Colors.indigo,
                  ),
                  const SizedBox(width: 12),
                  _buildConnectionCard(
                    icon: LucideIcons.monitor,
                    title: 'PC Print Server',
                    subtitle: 'Printers connected through a computer/server',
                    example: 'Your IT person will provide the server URL',
                    isSelected: settings.connectionType == PrintConnectionType.networkBridge,
                    onTap: () => notifier.updateSettings(connectionType: PrintConnectionType.networkBridge),
                    color: Colors.green,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Step 3: Printer Configuration
            _buildStepCard(
              stepNumber: 3,
              title: 'Configure Your Printers',
              description: _getConfigurationDescription(settings.connectionType),
              child: _buildPrinterConfiguration(settings, notifier),
            ),
            const SizedBox(height: 32),

            // Test Section
            if (_hasValidPrinterConfig(settings)) ...[
              _buildTestSection(settings),
              const SizedBox(height: 32),
            ],

            // Help Section
            _buildHelpSection(),
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
        key: ValueKey('type_card_${title}_$selected'), // Add unique key
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

  Widget _buildNetworkInput({
    required IconData icon, 
    required String label, 
    required String value, 
    String? placeholder,
    required Function(String) onChanged
  }) {
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
          hintText: placeholder,
          labelStyle: GoogleFonts.outfit(color: Colors.grey.shade400, fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1),
          hintStyle: GoogleFonts.outfit(color: Colors.grey.shade300, fontSize: 12),
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
    final settings = ref.read(printSettingsProvider);
    final width = settings.paperWidthKot;
    
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
      _showPreview("KOT Preview (${width}mm)", lines, width);
    } else {
      _sendTestPrint(_getSelectedPrinter("kot") ?? "kitchen-1", "kot", width, lines);
    }
  }

  void _handleInvoice(bool preview) {
    final settings = ref.read(printSettingsProvider);
    final width = settings.paperWidthInvoice;
    
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
      _showPreview("Invoice Preview (${width}mm)", lines, width);
    } else {
      _sendTestPrint(_getSelectedPrinter("invoice") ?? "billing-1", "invoice", width, lines);
    }
  }

  void _handleConsolidated(bool preview) {
    final settings = ref.read(printSettingsProvider);
    final width = settings.paperWidthInvoice; // Use invoice printer for consolidated
    
    if (width == 80) {
      // 80mm: Print Invoice first, then cut, then KOT
      _handleConsolidated80mm(preview);
    } else {
      // 56mm/58mm: Single consolidated receipt
      _handleConsolidatedSmall(preview, width);
    }
  }

  void _handleConsolidated80mm(bool preview) {
    if (preview) {
      // Show preview of both parts
      _showConsolidated80mmPreview();
    } else {
      // Print Invoice → Cut → KOT sequence
      _printConsolidated80mm();
    }
  }

  void _handleConsolidatedSmall(bool preview, int width) {
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
      _showPreview("Consolidated Preview (${width}mm)", lines, width);
    } else {
      _sendTestPrint(_getSelectedPrinter("invoice") ?? "billing-1", "consolidated", width, lines);
    }
  }

  String? _getSelectedPrinter(String type) {
    final settings = ref.read(printSettingsProvider);
    
    switch (settings.connectionType) {
      case PrintConnectionType.bluetooth:
      case PrintConnectionType.networkBridge:
        return type == 'kot' ? settings.printerIdKot : settings.printerIdInvoice;
      case PrintConnectionType.ipAddress:
        return type == 'kot' ? settings.printerIpKot : settings.printerIpInvoice;
    }
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
    
    debugPrint("🖨️ Test Print - Printer ID: $printerId, Width: ${width}mm, Type: $type");
    debugPrint("📄 Print Lines: ${lines.length} lines");
    
    bool success = await printService.sendPrintJob(job);
    
    if (mounted) {
      if (success) {
        AudioService.instance.playSuccess();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: Colors.green,
            content: Text("✅ Print Success! Sent to $printerId"),
            duration: const Duration(seconds: 3),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: Colors.red,
            content: Text("❌ Print Failed. Check printer connection at $printerId"),
            duration: const Duration(seconds: 5),
            action: SnackBarAction(
              label: 'RETRY',
              textColor: Colors.white,
              onPressed: () => _sendTestPrint(printerId, type, width, lines),
            ),
          ),
        );
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

  void _showConsolidated80mmPreview() {
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
                  const Text("80mm Consolidated Preview", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  IconButton(icon: const Icon(LucideIcons.x), onPressed: () => Navigator.pop(context)),
                ],
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(
                  children: [
                    // Invoice Part
                    Container(
                      width: 350,
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 20, offset: const Offset(0, 4))],
                        border: Border.all(color: Colors.grey.shade200),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Text("INVOICE PART", style: TextStyle(fontWeight: FontWeight.bold, color: Colors.blue)),
                          const SizedBox(height: 8),
                          ..._getInvoiceLines().map((l) => _buildPreviewLine(l)),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    // Cut indicator
                    Row(
                      children: [
                        Expanded(child: Divider(color: Colors.red.shade300)),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: Text("✂️ CUT HERE", style: TextStyle(color: Colors.red.shade600, fontWeight: FontWeight.bold)),
                        ),
                        Expanded(child: Divider(color: Colors.red.shade300)),
                      ],
                    ),
                    const SizedBox(height: 20),
                    // KOT Part
                    Container(
                      width: 350,
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 20, offset: const Offset(0, 4))],
                        border: Border.all(color: Colors.grey.shade200),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Text("KOT PART", style: TextStyle(fontWeight: FontWeight.bold, color: Colors.green)),
                          const SizedBox(height: 8),
                          ..._getKotLines().map((l) => _buildPreviewLine(l)),
                        ],
                      ),
                    ),
                  ],
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
                    _printConsolidated80mm();
                  },
                  icon: const Icon(LucideIcons.printer),
                  label: const Text("PRINT 80MM CONSOLIDATED"),
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

  Future<void> _printConsolidated80mm() async {
    final printService = ref.read(printServiceProvider);
    final printerId = _getSelectedPrinter("invoice") ?? "billing-1";
    
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Printing 80mm consolidated...")));
    
    try {
      // Use the new consolidated approach - single print job
      final invoiceLines = _getInvoiceLines();
      final kotLines = _getKotLines();
      
      // Add separator and cut command between invoice and KOT
      invoiceLines.add(PrintLine(text: "", align: 'left'));
      invoiceLines.add(PrintLine(text: "=" * 48, align: 'center')); // 80mm separator
      invoiceLines.add(PrintLine(text: "", align: 'left'));
      
      // Add cut command to separate invoice from KOT
      invoiceLines.add(PrintLine(text: "\x1D\x56\x00", align: 'left')); // Cut command
      invoiceLines.add(PrintLine(text: "", align: 'left')); // Small spacing after cut
      
      // Combine both into single job
      final combinedLines = [...invoiceLines, ...kotLines];
      
      final combinedJob = PrintJob(
        printerId: printerId,
        width: 80,
        type: "consolidated",
        lines: combinedLines,
      );
      
      bool success = await printService.sendPrintJob(combinedJob);
      
      if (mounted) {
        if (success) {
          AudioService.instance.playSuccess();
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(backgroundColor: Colors.green, content: Text("80mm Consolidated Print Success!")),
          );
        } else {
          throw Exception("Print failed");
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(backgroundColor: Colors.red, content: Text("Print Failed: $e")),
        );
      }
    }
  }

  List<PrintLine> _getInvoiceLines() {
    return [
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
  }

  List<PrintLine> _getKotLines() {
    return [
      PrintLine(text: "KITCHEN ORDER", align: "center", bold: true),
      PrintLine(text: "TOKEN: 42", align: "center", bold: true, height: 2, width: 2),
      PrintLine(text: "TBL:T3 | 22:45", align: "center", bold: true),
      PrintLine(text: "--------------------------------", align: "center"),
      PrintLine(text: "2x PANEER BUTTER MASALA", align: "left", bold: true),
      PrintLine(text: "1x BUTTER NAAN", align: "left", bold: true),
      PrintLine(text: "  LESS OIL", align: "left"),
      PrintLine(text: "--------------------------------", align: "center"),
    ];
  }

  Widget _buildPreviewLine(PrintLine line) {
    TextAlign align;
    switch(line.align) {
      case 'center': align = TextAlign.center; break;
      case 'right': align = TextAlign.right; break;
      default: align = TextAlign.left;
    }
    return Padding(
      padding: const EdgeInsets.only(bottom: 4.0),
      child: Text(
        line.text, 
        textAlign: align,
        style: TextStyle(
          fontFamily: 'Courier',
          fontWeight: line.bold ? FontWeight.w900 : FontWeight.normal,
          fontSize: 13.0 * (line.height > 1 ? 1.5 : 1.0),
          color: Colors.black87,
        ),
      ),
    );
  }

  // Helper method to build step cards with consistent styling
  Widget _buildStepCard({
    required int stepNumber,
    required String title,
    required String description,
    required Widget child,
  }) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 15,
            offset: const Offset(0, 5),
          ),
        ],
        border: Border.all(color: Colors.grey.shade100),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: AppTheme.primary,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Center(
                  child: Text(
                    stepNumber.toString(),
                    style: GoogleFonts.outfit(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      fontSize: 16,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: GoogleFonts.outfit(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        color: AppTheme.secondary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      description,
                      style: GoogleFonts.outfit(
                        fontSize: 14,
                        color: Colors.grey.shade600,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          child,
        ],
      ),
    );
  }

  // Helper method to build print mode selection cards
  Widget _buildPrintModeCard({
    required IconData icon,
    required String title,
    required String subtitle,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        key: ValueKey('print_mode_${title}_$isSelected'), // Add unique key
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.primary : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? AppTheme.primary : Colors.grey.shade200,
            width: 2,
          ),
          boxShadow: isSelected ? [
            BoxShadow(
              color: AppTheme.primary.withOpacity(0.2),
              blurRadius: 8,
              offset: const Offset(0, 4),
            ),
          ] : [],
        ),
        child: Column(
          children: [
            Icon(
              icon,
              color: isSelected ? Colors.white : Colors.grey.shade600,
              size: 24,
            ),
            const SizedBox(height: 8),
            Text(
              title,
              style: GoogleFonts.outfit(
                fontSize: 12,
                fontWeight: FontWeight.w900,
                color: isSelected ? Colors.white : Colors.grey.shade800,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: GoogleFonts.outfit(
                fontSize: 10,
                color: isSelected ? Colors.white.withOpacity(0.8) : Colors.grey.shade500,
                fontWeight: FontWeight.w500,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  // Helper method to build connection type cards
  Widget _buildConnectionCard({
    required IconData icon,
    required String title,
    required String subtitle,
    required String example,
    required bool isSelected,
    required VoidCallback onTap,
    required Color color,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        key: ValueKey('connection_${title}_$isSelected'), // Add unique key
        duration: const Duration(milliseconds: 200),
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: isSelected ? color.withOpacity(0.1) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? color : Colors.grey.shade200,
            width: 2,
          ),
          boxShadow: isSelected ? [
            BoxShadow(
              color: color.withOpacity(0.1),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ] : [],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isSelected ? color : Colors.grey.shade100,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                icon,
                color: isSelected ? Colors.white : Colors.grey.shade600,
                size: 24,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: GoogleFonts.outfit(
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                      color: isSelected ? color : AppTheme.secondary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: GoogleFonts.outfit(
                      fontSize: 13,
                      color: Colors.grey.shade600,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    example,
                    style: GoogleFonts.outfit(
                      fontSize: 11,
                      color: isSelected ? color.withOpacity(0.8) : Colors.grey.shade500,
                      fontWeight: FontWeight.w500,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                ],
              ),
            ),
            if (isSelected)
              Icon(
                LucideIcons.checkCircle,
                color: color,
                size: 20,
              ),
          ],
        ),
      ),
    );
  }

  // Helper method to build printer configuration section
  Widget _buildPrinterConfiguration(PrintSettings settings, PrintSettingsNotifier notifier) {
    switch (settings.connectionType) {
      case PrintConnectionType.ipAddress:
        return _buildIpAddressConfiguration(settings, notifier);
      case PrintConnectionType.bluetooth:
        return _buildBluetoothConfiguration(settings, notifier);
      case PrintConnectionType.networkBridge:
        return _buildNetworkBridgeConfiguration(settings, notifier);
    }
  }

  // IP Address configuration
  Widget _buildIpAddressConfiguration(PrintSettings settings, PrintSettingsNotifier notifier) {
    return Column(
      children: [
        if (settings.consolidated) ...[
          // Single printer for consolidated mode
          _buildIpPrinterCard(
            title: 'Main Printer',
            subtitle: 'Handles both kitchen orders and bills',
            icon: LucideIcons.printer,
            ipAddress: settings.printerIpInvoice ?? '',
            paperWidth: settings.paperWidthInvoice,
            onIpChanged: (ip) => notifier.updateSettings(printerIpInvoice: ip),
            onPaperWidthChanged: (width) => notifier.updateSettings(paperWidthInvoice: width),
          ),
        ] else ...[
          // Separate printers
          _buildIpPrinterCard(
            title: 'Kitchen Printer',
            subtitle: 'For kitchen orders (KOT)',
            icon: LucideIcons.chefHat,
            ipAddress: settings.printerIpKot ?? '',
            paperWidth: settings.paperWidthKot,
            onIpChanged: (ip) => notifier.updateSettings(printerIpKot: ip),
            onPaperWidthChanged: (width) => notifier.updateSettings(paperWidthKot: width),
          ),
          const SizedBox(height: 16),
          _buildIpPrinterCard(
            title: 'Billing Printer',
            subtitle: 'For customer invoices',
            icon: LucideIcons.receipt,
            ipAddress: settings.printerIpInvoice ?? '',
            paperWidth: settings.paperWidthInvoice,
            onIpChanged: (ip) => notifier.updateSettings(printerIpInvoice: ip),
            onPaperWidthChanged: (width) => notifier.updateSettings(paperWidthInvoice: width),
          ),
        ],
      ],
    );
  }

  // Bluetooth configuration
  Widget _buildBluetoothConfiguration(PrintSettings settings, PrintSettingsNotifier notifier) {
    return Column(
      children: [
        // Scan button
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.blue.shade50,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.blue.shade200),
          ),
          child: Column(
            children: [
              Icon(LucideIcons.bluetooth, color: Colors.blue.shade600, size: 32),
              const SizedBox(height: 8),
              Text(
                'Scan for Bluetooth Printers',
                style: GoogleFonts.outfit(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  color: Colors.blue.shade800,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Make sure your printers are in pairing mode',
                style: GoogleFonts.outfit(
                  fontSize: 12,
                  color: Colors.blue.shade600,
                ),
              ),
              const SizedBox(height: 12),
              ElevatedButton.icon(
                onPressed: _scanning ? null : _scanBluetooth,
                icon: _scanning 
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(LucideIcons.search),
                label: Text(_scanning ? 'Scanning...' : 'Start Scan'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.blue.shade600,
                  foregroundColor: Colors.white,
                ),
              ),
            ],
          ),
        ),
        
        if (_devices.isNotEmpty) ...[
          const SizedBox(height: 16),
          ...settings.consolidated 
            ? [_buildBluetoothPrinterList('Main Printer', settings.printerIdInvoice, (id) => notifier.updateSettings(printerIdInvoice: id))]
            : [
                _buildBluetoothPrinterList('Kitchen Printer', settings.printerIdKot, (id) => notifier.updateSettings(printerIdKot: id)),
                const SizedBox(height: 12),
                _buildBluetoothPrinterList('Billing Printer', settings.printerIdInvoice, (id) => notifier.updateSettings(printerIdInvoice: id)),
              ],
        ],
        
        // Paper width selection
        const SizedBox(height: 16),
        if (settings.consolidated) 
          _buildPaperWidthCard('Main Printer Paper Size', settings.paperWidthInvoice, (width) => notifier.updateSettings(paperWidthInvoice: width))
        else ...[
          _buildPaperWidthCard('Kitchen Printer Paper Size', settings.paperWidthKot, (width) => notifier.updateSettings(paperWidthKot: width)),
          const SizedBox(height: 12),
          _buildPaperWidthCard('Billing Printer Paper Size', settings.paperWidthInvoice, (width) => notifier.updateSettings(paperWidthInvoice: width)),
        ],
      ],
    );
  }

  // Network Bridge configuration
  Widget _buildNetworkBridgeConfiguration(PrintSettings settings, PrintSettingsNotifier notifier) {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.green.shade50,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.green.shade200),
          ),
          child: Column(
            children: [
              Icon(LucideIcons.monitor, color: Colors.green.shade600, size: 32),
              const SizedBox(height: 8),
              Text(
                'Print Server Connection',
                style: GoogleFonts.outfit(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  color: Colors.green.shade800,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Ask your IT person for the server URL',
                style: GoogleFonts.outfit(
                  fontSize: 12,
                  color: Colors.green.shade600,
                ),
              ),
              const SizedBox(height: 16),
              _buildNetworkInput(
                icon: LucideIcons.server,
                label: 'Server URL',
                value: settings.bridgeUrl,
                placeholder: 'http://192.168.1.100:4000',
                onChanged: (url) => notifier.updateSettings(bridgeUrl: url),
              ),
            ],
          ),
        ),
        
        const SizedBox(height: 16),
        
        // Printer ID configuration
        if (settings.consolidated) 
          _buildPrinterIdCard('Main Printer ID', settings.printerIdInvoice ?? '', (id) => notifier.updateSettings(printerIdInvoice: id))
        else ...[
          _buildPrinterIdCard('Kitchen Printer ID', settings.printerIdKot ?? '', (id) => notifier.updateSettings(printerIdKot: id)),
          const SizedBox(height: 12),
          _buildPrinterIdCard('Billing Printer ID', settings.printerIdInvoice ?? '', (id) => notifier.updateSettings(printerIdInvoice: id)),
        ],
        
        // Paper width selection
        const SizedBox(height: 16),
        if (settings.consolidated) 
          _buildPaperWidthCard('Main Printer Paper Size', settings.paperWidthInvoice, (width) => notifier.updateSettings(paperWidthInvoice: width))
        else ...[
          _buildPaperWidthCard('Kitchen Printer Paper Size', settings.paperWidthKot, (width) => notifier.updateSettings(paperWidthKot: width)),
          const SizedBox(height: 12),
          _buildPaperWidthCard('Billing Printer Paper Size', settings.paperWidthInvoice, (width) => notifier.updateSettings(paperWidthInvoice: width)),
        ],
      ],
    );
  }

  // Helper method to build IP printer configuration cards
  Widget _buildIpPrinterCard({
    required String title,
    required String subtitle,
    required IconData icon,
    required String ipAddress,
    required int paperWidth,
    required Function(String) onIpChanged,
    required Function(int) onPaperWidthChanged,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
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
                decoration: BoxDecoration(
                  color: Colors.blue.shade100,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: Colors.blue.shade600, size: 20),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: GoogleFonts.outfit(
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                      color: AppTheme.secondary,
                    ),
                  ),
                  Text(
                    subtitle,
                    style: GoogleFonts.outfit(
                      fontSize: 12,
                      color: Colors.grey.shade600,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 16),
          _buildNetworkInput(
            icon: LucideIcons.wifi,
            label: 'Printer IP Address',
            value: ipAddress,
            placeholder: '192.168.1.100',
            onChanged: onIpChanged,
          ),
          const SizedBox(height: 12),
          _buildPaperWidthCard('Paper Size', paperWidth, onPaperWidthChanged),
        ],
      ),
    );
  }

  // Helper method to build printer ID cards for network bridge
  Widget _buildPrinterIdCard(String title, String value, Function(String) onChanged) {
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
        style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 14),
        decoration: InputDecoration(
          icon: Icon(LucideIcons.printer, size: 16, color: Colors.grey.shade400),
          border: InputBorder.none,
          labelText: title.toUpperCase(),
          hintText: 'kitchen-1 or billing-1',
          labelStyle: GoogleFonts.outfit(
            color: Colors.grey.shade400,
            fontSize: 10,
            fontWeight: FontWeight.w900,
            letterSpacing: 1,
          ),
          hintStyle: GoogleFonts.outfit(
            color: Colors.grey.shade300,
            fontSize: 12,
          ),
        ),
      ),
    );
  }

  // Helper method to build Bluetooth printer selection lists
  Widget _buildBluetoothPrinterList(String title, String? selectedId, Function(String) onSelect) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: GoogleFonts.outfit(
              fontSize: 14,
              fontWeight: FontWeight.w900,
              color: AppTheme.secondary,
            ),
          ),
          const SizedBox(height: 12),
          ..._devices.map((device) {
            final deviceId = "bt::${device.device.id.id}";
            final isSelected = selectedId == deviceId;
            final isConnected = _connectionStatus[device.device.id.id] ?? false;
            
            return GestureDetector(
              onTap: () => onSelect(deviceId),
              child: Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: isSelected ? Colors.blue.shade50 : Colors.grey.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: isSelected ? Colors.blue.shade200 : Colors.grey.shade200,
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      LucideIcons.bluetooth,
                      color: isSelected ? Colors.blue.shade600 : Colors.grey.shade500,
                      size: 16,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            device.device.name.isNotEmpty ? device.device.name : 'Unknown Device',
                            style: GoogleFonts.outfit(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: isSelected ? Colors.blue.shade800 : Colors.grey.shade800,
                            ),
                          ),
                          Text(
                            device.device.id.id,
                            style: GoogleFonts.outfit(
                              fontSize: 11,
                              color: Colors.grey.shade500,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (isConnected)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.green.shade100,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          'Connected',
                          style: GoogleFonts.outfit(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: Colors.green.shade700,
                          ),
                        ),
                      ),
                    if (isSelected)
                      Icon(
                        LucideIcons.checkCircle,
                        color: Colors.blue.shade600,
                        size: 16,
                      ),
                  ],
                ),
              ),
            );
          }).toList(),
        ],
      ),
    );
  }

  // Helper method to build test section
  Widget _buildTestSection(PrintSettings settings) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 15,
            offset: const Offset(0, 5),
          ),
        ],
        border: Border.all(color: Colors.grey.shade100),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.green.shade100,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(LucideIcons.testTube, color: Colors.green.shade600, size: 24),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Test Your Setup',
                      style: GoogleFonts.outfit(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        color: AppTheme.secondary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Print sample receipts to make sure everything works',
                      style: GoogleFonts.outfit(
                        fontSize: 14,
                        color: Colors.grey.shade600,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          
          if (settings.consolidated) ...[
            _buildDiagnosticCard(
              "All-in-One Receipt",
              "Test your consolidated printing",
              LucideIcons.layers,
              () => _handleConsolidated(true),
              () => _handleConsolidated(false),
            ),
          ] else ...[
            _buildDiagnosticCard(
              "Kitchen Order (KOT)",
              "Test kitchen printer",
              LucideIcons.chefHat,
              () => _handleKot(true),
              () => _handleKot(false),
            ),
            const SizedBox(height: 12),
            _buildDiagnosticCard(
              "Customer Invoice",
              "Test billing printer",
              LucideIcons.receipt,
              () => _handleInvoice(true),
              () => _handleInvoice(false),
            ),
          ],
        ],
      ),
    );
  }

  // Helper method to build help section
  Widget _buildHelpSection() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [Colors.orange.shade50, Colors.white],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.orange.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.orange.shade100,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(LucideIcons.helpCircle, color: Colors.orange.shade600, size: 24),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Text(
                  'Need Help?',
                  style: GoogleFonts.outfit(
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                    color: AppTheme.secondary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _buildHelpItem(
            'WiFi/Ethernet Printers',
            'Find the IP address on your printer\'s display or settings menu. Usually looks like 192.168.1.100',
          ),
          _buildHelpItem(
            'Bluetooth Printers',
            'Turn on your printer and make it discoverable. Look for "Pairing Mode" in printer settings.',
          ),
          _buildHelpItem(
            'PC Print Server',
            'Ask your IT person for the server URL. It usually starts with http:// and includes a port number.',
          ),
          _buildHelpItem(
            'Paper Sizes',
            '56mm/58mm are for small receipts. 80mm is for wider receipts with more details.',
          ),
        ],
      ),
    );
  }

  // Helper method to build individual help items
  Widget _buildHelpItem(String title, String description) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 6,
            height: 6,
            margin: const EdgeInsets.only(top: 6),
            decoration: BoxDecoration(
              color: Colors.orange.shade400,
              borderRadius: BorderRadius.circular(3),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: GoogleFonts.outfit(
                    fontSize: 13,
                    fontWeight: FontWeight.w900,
                    color: Colors.orange.shade800,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  description,
                  style: GoogleFonts.outfit(
                    fontSize: 12,
                    color: Colors.orange.shade700,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // Helper method to get configuration description based on connection type
  String _getConfigurationDescription(PrintConnectionType connectionType) {
    switch (connectionType) {
      case PrintConnectionType.ipAddress:
        return 'Enter the IP addresses of your printers and select paper sizes';
      case PrintConnectionType.bluetooth:
        return 'Scan for and select your Bluetooth printers, then choose paper sizes';
      case PrintConnectionType.networkBridge:
        return 'Enter your print server details and printer IDs';
    }
  }

  // Helper method to check if printer configuration is valid
  bool _hasValidPrinterConfig(PrintSettings settings) {
    switch (settings.connectionType) {
      case PrintConnectionType.ipAddress:
        if (settings.consolidated) {
          return settings.printerIpInvoice?.isNotEmpty == true;
        } else {
          return settings.printerIpKot?.isNotEmpty == true && 
                 settings.printerIpInvoice?.isNotEmpty == true;
        }
      case PrintConnectionType.bluetooth:
        if (settings.consolidated) {
          return settings.printerIdInvoice?.isNotEmpty == true;
        } else {
          return settings.printerIdKot?.isNotEmpty == true && 
                 settings.printerIdInvoice?.isNotEmpty == true;
        }
      case PrintConnectionType.networkBridge:
        if (settings.consolidated) {
          return settings.bridgeUrl.isNotEmpty && 
                 settings.printerIdInvoice?.isNotEmpty == true;
        } else {
          return settings.bridgeUrl.isNotEmpty && 
                 settings.printerIdKot?.isNotEmpty == true && 
                 settings.printerIdInvoice?.isNotEmpty == true;
        }
    }
  }

  Widget _buildPaperWidthCard(String title, int currentWidth, Function(int) onChanged) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10, offset: const Offset(0, 4)),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title.toUpperCase(),
            style: GoogleFonts.outfit(
              fontSize: 10,
              fontWeight: FontWeight.w900,
              color: Colors.grey.shade400,
              letterSpacing: 1,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: PaperWidth.values.map((width) {
              final isSelected = currentWidth == width.width;
              return Expanded(
                child: GestureDetector(
                  key: ValueKey('paper_width_${width.width}_$isSelected'), // Add unique key
                  onTap: () => onChanged(width.width),
                  child: Container(
                    margin: const EdgeInsets.only(right: 8),
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(
                      color: isSelected ? AppTheme.primary : Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: isSelected ? AppTheme.primary : Colors.grey.shade200,
                      ),
                    ),
                    child: Text(
                      width.label,
                      textAlign: TextAlign.center,
                      style: GoogleFonts.outfit(
                        fontSize: 11,
                        fontWeight: FontWeight.w900,
                        color: isSelected ? Colors.white : Colors.grey.shade600,
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}
