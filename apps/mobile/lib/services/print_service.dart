import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:print_bluetooth_thermal/print_bluetooth_thermal.dart';
import 'package:esc_pos_utils_plus/esc_pos_utils_plus.dart';
import 'package:image/image.dart' as img;
import 'package:shared_preferences/shared_preferences.dart';

final printServiceProvider = Provider((ref) => PrintService(Supabase.instance.client));

class PrintLine {
  final String text;
  final String align; // left, center, right
  final bool bold;

  PrintLine({required this.text, this.align = 'left', this.bold = false});

  Map<String, dynamic> toJson() => {
    'text': text,
    'align': align,
    'bold': bold,
  };
}

class PrintJob {
  final String printerId;
  final int width;
  final String type; // kot, invoice, token
  final List<PrintLine> lines;

  PrintJob({
    required this.printerId,
    required this.width,
    required this.type,
    required this.lines,
  });

  Map<String, dynamic> toJson() => {
    'printerId': printerId,
    'width': width,
    'type': type,
    'lines': lines.map((l) => l.toJson()).toList(),
  };
}

class PrintService {
  final SupabaseClient _supabase;
  // TODO: Make this configurable via Settings UI
  static const String _printServerUrl = "http://192.168.1.100:4000"; 
  
  // Cache the generator profile
  CapabilityProfile? _profile;

  PrintService(this._supabase);

  Future<Map<String, dynamic>?> getPrintingSettings(String branchId) async {
    try {
      // 1. Check Local Settings (Bluetooth Override)
      final prefs = await SharedPreferences.getInstance();
      bool isBluetooth = prefs.getBool('print_is_bluetooth') ?? false;

      if (isBluetooth) {
        return {
          'printerIdKot': prefs.getString('printer_id_kot'),
          'printerIdInvoice': prefs.getString('printer_id_invoice'),
          'consolidatedPrinting': prefs.getBool('print_consolidated') ?? false,
          'widthKot': 58, // Default for thermal
          'widthInvoice': 58, // Default for thermal
        };
      }

      // 2. Fallback to Server Settings (Network Bridge)
       final res = await _supabase
          .from('settings')
          .select('value')
          .eq('branch_id', branchId)
          .eq('key', 'printing')
          .maybeSingle();
      
      return res?['value'] as Map<String, dynamic>?;
    } catch (e) {
      print('Error fetching print settings: $e');
      return null;
    }
  }

  Future<bool> sendPrintJob(PrintJob job) async {
    // HYBRID LOGIC: Check if printerId looks like a Bluetooth MAC address (e.g., AA:BB:CC:DD:EE:FF)
    // Simple heuristic: if it contains colons and is long, treat as Bluetooth.
    // Or check user preference flag. For now, we assume if ID starts with "bt::", it's bluetooth.
    
    if (job.printerId.startsWith("bt::")) {
      return await _printBluetooth(job);
    }

    // Default: Network Print
    try {
      final url = Uri.parse('$_printServerUrl/print');
      final response = await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(job.toJson()),
      );

      if (response.statusCode != 200) {
        print('Print server error: ${response.body}');
        return false;
      }
      return true;
    } catch (e) {
      print('Print job failed: $e');
      return false;
    }
  }

  Future<bool> _printBluetooth(PrintJob job) async {
    try {
      // 1. Check Permissions & Enable Bluetooth
      bool isEnabled = await PrintBluetoothThermal.bluetoothEnabled;
      if (!isEnabled) return false;

      // 2. Connect (MAC address is stripped from "bt::MAC_ADDRESS")
      final macAddress = job.printerId.replaceFirst("bt::", "");
      final connected = await PrintBluetoothThermal.connect(macPrinterAddress: macAddress);
      if (!connected) return false;

      // 3. Generate ESC/POS Bytes
      if (_profile == null) {
        _profile = await CapabilityProfile.load();
      }
      
      // Paper Size: 58mm -> 32 chars usually, 80mm -> 48 chars. 
      // Library uses paper size enum
      final generator = Generator(job.width == 58 ? PaperSize.mm58 : PaperSize.mm80, _profile!);
      List<int> bytes = [];

      // Reset
      bytes += generator.reset();

      // Convert Abstract Lines to ESC/POS
      for (var line in job.lines) {
        PosStyles styles = PosStyles(bold: line.bold);
        if (line.bold) {
          // Double height/width for bold headers often looks better on thermal
           styles = const PosStyles(bold: true, height: PosTextSize.size2, width: PosTextSize.size2);
        } else {
           styles = const PosStyles(bold: false);
        }

        // Handle Alignment
        PosAlign align = PosAlign.left;
        if (line.align == 'center') align = PosAlign.center;
        if (line.align == 'right') align = PosAlign.right;

        bytes += generator.text(line.text, styles: styles, linesAfter: 1);
        
        // Handle Alignment manually if needed (library handles it well usually)
      }

      // Cut
      bytes += generator.feed(2);
      bytes += generator.cut();

      // 4. Send Bytes
      final result = await PrintBluetoothThermal.writeBytes(bytes);
      
      // 5. Disconnect (Optional, or keep open)
      // await PrintBluetoothThermal.disconnect; 

      return result;
    } catch (e) {
      print("Bluetooth Print Error: $e");
      return false;
    }
  }

  List<PrintLine> buildKotLines({
    required String restaurantName,
    required String branchName,
    required String tableName,
    required String orderId,
    String? tokenNumber,
    required List<Map<String, dynamic>> items, // {name, qty, notes}
  }) {
    const separator = "--------------------------------";
    List<PrintLine> lines = [
      PrintLine(text: restaurantName, align: 'center', bold: true),
      PrintLine(text: 'Branch: $branchName', align: 'center'),
      PrintLine(text: separator, align: 'center'),
    ];

    if (tokenNumber != null) {
      lines.add(PrintLine(text: 'TOKEN: $tokenNumber', align: 'center', bold: true));
      lines.add(PrintLine(text: separator, align: 'center'));
    }

    lines.addAll([
      PrintLine(text: 'KITCHEN ORDER TICKET', align: 'center', bold: true),
      PrintLine(text: 'Order: ${orderId.substring(0, 8)}...', align: 'left'),
      PrintLine(text: 'Date: ${DateTime.now().toLocal().toString().split('.')[0]}', align: 'left'),
      PrintLine(text: 'Table: $tableName', align: 'left', bold: true),
      PrintLine(text: separator, align: 'center'),
    ]);

    for (var item in items) {
      final name = item['name']?.toString() ?? "Item";
      lines.add(PrintLine(text: name, align: 'left', bold: true));
      String qtyText = 'Qty: ${item['qty'] ?? 1}';
      if (item['notes'] != null && item['notes'].toString().isNotEmpty) {
         lines.add(PrintLine(text: 'Note: ${item['notes']}', align: 'left'));
      }
      lines.add(PrintLine(text: " ", align: "left"));
    }

    lines.add(PrintLine(text: separator, align: 'center'));
    return lines;
  }

  List<PrintLine> buildTokenSlipLines({
    required String restaurantName,
    required String tokenNumber,
    required String orderType,
    required int itemsCount,
  }) {
    const separator = "--------------------------------";
    return [
      PrintLine(text: restaurantName, align: 'center', bold: true),
      PrintLine(text: separator, align: 'center'),
      PrintLine(text: 'TOKEN NUMBER', align: 'center'),
      PrintLine(text: tokenNumber, align: 'center', bold: true),
      PrintLine(text: separator, align: 'center'),
      PrintLine(text: 'Type: $orderType', align: 'center'),
      PrintLine(text: 'Items: $itemsCount', align: 'center'),
      PrintLine(text: DateTime.now().toLocal().toString().split('.')[0], align: 'center'),
      PrintLine(text: separator, align: 'center'),
    ];
  }

  List<PrintLine> buildInvoiceLines({
    required String restaurantName,
    required String branchName,
    required String billId,
    String? tokenNumber,
    required List<Map<String, dynamic>> items, // {name, qty, price}
    required double subtotal,
    required double tax,
    required double total,
  }) {
    const separator = "--------------------------------";
    List<PrintLine> lines = [
      PrintLine(text: restaurantName, align: 'center', bold: true),
      PrintLine(text: branchName, align: 'center'),
      PrintLine(text: separator, align: 'center'),
    ];

    if (tokenNumber != null) {
      lines.add(PrintLine(text: 'TOKEN: $tokenNumber', align: 'center', bold: true));
      lines.add(PrintLine(text: separator, align: 'center'));
    }

    lines.addAll([
      PrintLine(text: 'Bill No: $billId', align: 'left'),
      PrintLine(text: 'Date: ${DateTime.now().toLocal().toString().split('.')[0]}', align: 'left'),
      PrintLine(text: separator, align: 'center'),
    ]);

    for (var item in items) {
       final name = item['name']?.toString() ?? "Item";
       lines.add(PrintLine(text: name, align: 'left'));
       
       final qty = item['qty'] as num? ?? 1;
       final price = item['price'] as num? ?? 0.0;
       double lineTotal = (qty * price).toDouble();
       
       lines.add(PrintLine(text: '$qty x $price = ${lineTotal.toStringAsFixed(2)}', align: 'right'));
    }

    lines.add(PrintLine(text: separator, align: 'center'));
    lines.add(PrintLine(text: 'Subtotal: ${subtotal.toStringAsFixed(2)}', align: 'right'));
    if (tax > 0) lines.add(PrintLine(text: 'Tax: ${tax.toStringAsFixed(2)}', align: 'right'));
    lines.add(PrintLine(text: separator, align: 'center'));
    lines.add(PrintLine(text: 'TOTAL: ${total.toStringAsFixed(2)}', align: 'center', bold: true));
    lines.add(PrintLine(text: separator, align: 'center'));
    lines.add(PrintLine(text: 'Thank you for dining with us!', align: 'center'));

    return lines;
  }

  List<PrintLine> buildConsolidatedReceiptLines({
    required String restaurantName,
    required String branchName,
    required String? tableName,
    required String orderId,
    String? tokenNumber,
    required String orderType,
    required List<Map<String, dynamic>> items, // {name, qty, price, notes}
    required double subtotal,
    required double tax,
    required double total,
  }) {
    const separator = "--------------------------------";
    const sectionBreak = "================================";

    List<PrintLine> lines = [];

    // 1. KOT Section
    lines.add(PrintLine(text: "KITCHEN ORDER (COPY)", align: "center", bold: true));
    lines.add(PrintLine(text: 'Order: ${orderId.substring(0, orderId.length > 8 ? 8 : orderId.length)}', align: 'left'));
    if (tableName != null) lines.add(PrintLine(text: 'Table: $tableName', align: 'left', bold: true));
    if (tokenNumber != null) lines.add(PrintLine(text: 'TOKEN: $tokenNumber', align: 'center', bold: true));
    lines.add(PrintLine(text: separator, align: 'center'));

    for (var item in items) {
      final name = item['name']?.toString() ?? "Item";
      lines.add(PrintLine(text: name, align: 'left', bold: true));
      
      final qty = item['qty'] ?? 1;
      String qtyText = 'Qty: $qty';
      if (item['notes'] != null && item['notes'].toString().isNotEmpty) {
        qtyText += ' (${item['notes']})';
      }
      lines.add(PrintLine(text: qtyText, align: 'left'));
    }
    
    lines.add(PrintLine(text: sectionBreak, align: 'center'));
    lines.add(PrintLine(text: " ", align: "center"));

    // 2. Bill Section
    lines.add(PrintLine(text: restaurantName, align: 'center', bold: true));
    lines.add(PrintLine(text: "CUSTOMER INVOICE", align: 'center', bold: true));
    lines.add(PrintLine(text: 'Date: ${DateTime.now().toLocal().toString().split('.')[0]}', align: 'left'));
    lines.add(PrintLine(text: separator, align: 'center'));

    for (var item in items) {
      final name = item['name']?.toString() ?? "Item";
      lines.add(PrintLine(text: name, align: 'left'));
      
      final qty = item['qty'] as num? ?? 1;
      final price = item['price'] as num? ?? 0.0;
      double lineTotal = (qty * price).toDouble();
      
      lines.add(PrintLine(text: '$qty x $price = ${lineTotal.toStringAsFixed(2)}', align: 'right'));
    }

    lines.add(PrintLine(text: separator, align: 'center'));
    lines.add(PrintLine(text: 'Total: ${total.toStringAsFixed(2)}', align: 'right', bold: true));
    
    lines.add(PrintLine(text: sectionBreak, align: 'center'));
    lines.add(PrintLine(text: " ", align: 'center'));

    // 3. Token Slip Section
    if (tokenNumber != null) {
      lines.add(PrintLine(text: "TOKEN SLIP", align: 'center', bold: true));
      lines.add(PrintLine(text: tokenNumber, align: 'center', bold: true));
      lines.add(PrintLine(text: 'Type: $orderType', align: 'center'));
      lines.add(PrintLine(text: separator, align: 'center'));
    }

    lines.add(PrintLine(text: "Thank you!", align: 'center'));

    return lines;
  }
}
