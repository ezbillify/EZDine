import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:esc_pos_utils_plus/esc_pos_utils_plus.dart';
import 'package:image/image.dart' as img;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:flutter/services.dart';
import './printer_templates.dart';
import './bluetooth_manager.dart';

final printServiceProvider = Provider((ref) => PrintService(Supabase.instance.client));

class PrintLine {
  final String text;
  final String align; // left, center, right
  final bool bold;
  final int height;
  final int width;

  PrintLine({
    required this.text, 
    this.align = 'left', 
    this.bold = false,
    this.height = 1,
    this.width = 1,
  });

  Map<String, dynamic> toJson() => {
    'text': text,
    'align': align,
    'bold': bold,
    'height': height,
    'width': width,
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

      final Map<String, dynamic> settings = Map<String, dynamic>.from(res?['value'] as Map? ?? {});
      
      // Local Overrides (Priority)
      if (prefs.containsKey('print_consolidated')) {
        settings['consolidatedPrinting'] = prefs.getBool('print_consolidated');
      } else {
        // Fallback to server's new or old key
         settings['consolidatedPrinting'] = settings['consolidatedPrinting'] ?? settings['consolidatePrinting'] ?? false;
      }
      
      // Sync other local preferences if they exist
      if (prefs.containsKey('printer_id_kot')) settings['printerIdKot'] = prefs.getString('printer_id_kot');
      if (prefs.containsKey('printer_id_invoice')) settings['printerIdInvoice'] = prefs.getString('printer_id_invoice');

      return settings;
    } catch (e) {
      print('Error fetching print settings: $e');
      return null;
    }
  }

  Future<bool> printPremiumInvoice({
    required String restaurantName,
    required String branchName,
    String? branchAddress,
    String? phone,
    String? gstin,
    String? fssai,
    required String orderId,
    required String date,
    required String time,
    required List<Map<String, dynamic>> items,
    required double subtotal,
    required double tax,
    required double total,
    String? tableName,
    String? tokenNumber,
    String? customerName,
    String orderType = "Dine In",
    String? printerId,
  }) async {
    try {
      // 1. Silent Print Check (Bluetooth/Network Direct)
      if (printerId != null && printerId.startsWith("bt::")) {
        final lines = buildInvoiceLines(
          restaurantName: restaurantName,
          branchName: branchName,
          branchAddress: branchAddress,
          gstin: gstin,
          fssai: fssai,
          phone: phone,
          billId: orderId,
          tokenNumber: tokenNumber,
          customerName: customerName,
          tableName: tableName,
          orderType: orderType,
          items: items,
          subtotal: subtotal,
          tax: tax,
          total: total,
          paperWidth: 58,
        );

        return await sendPrintJob(PrintJob(
          printerId: printerId,
          width: 58,
          type: "invoice",
          lines: lines,
        ));
      }

      final String template = await rootBundle.loadString('assets/templates/thermal_invoice.html');

      // Calculate Tax Breakup
      final Map<double, Map<String, double>> taxBreakup = {};
      for (var item in items) {
        final rate = (item['tax_rate'] as num?)?.toDouble() ?? 0.0;
        final qty = (item['qty'] as num).toDouble();
        final price = (item['price'] as num).toDouble();
        final totalAmt = qty * price;
        
        final taxableValue = totalAmt / (1 + (rate / 100));
        final taxAmount = totalAmt - taxableValue;
        
        if (!taxBreakup.containsKey(rate)) {
          taxBreakup[rate] = {'taxable': 0.0, 'amount': 0.0};
        }
        taxBreakup[rate]!['taxable'] = taxBreakup[rate]!['taxable']! + taxableValue;
        taxBreakup[rate]!['amount'] = taxBreakup[rate]!['amount']! + taxAmount;
      }

      final taxBreakupList = taxBreakup.entries.where((e) => e.key > 0).map((e) => {
        'rate': e.key.toStringAsFixed(0),
        'taxable': e.value['taxable']!.toStringAsFixed(2),
        'amount': e.value['amount']!.toStringAsFixed(2),
      }).toList();

      final Map<String, dynamic> templateData = {
        'restaurantName': restaurantName,
        'branchName': branchName,
        'branchAddress': branchAddress ?? '',
        'phone': phone ?? '',
        'gstin': gstin ?? '',
        'fssai': fssai ?? '',
        'billId': orderId,
        'date': date,
        'time': time,
        'tableName': tableName ?? 'N/A',
        'tokenNumber': tokenNumber ?? '00',
        'customerName': customerName ?? 'GUEST',
        'orderType': orderType.toUpperCase(),
        'subtotal': subtotal.toStringAsFixed(2),
        'tax': tax > 0 ? tax.toStringAsFixed(2) : null,
        'total': total.toStringAsFixed(2),
        'items': items.map((i) => {
          'name': i['name'].toString().toUpperCase(),
          'hsn': i['hsn_code'] ?? '',
          'qty': i['qty'],
          'price': (i['price'] as num).toStringAsFixed(2),
          'amt': ((i['price'] as num) * (i['qty'] as num)).toStringAsFixed(2),
        }).toList(),
        'taxBreakup': taxBreakupList,
        'hasTaxBreakup': taxBreakupList.isNotEmpty,
      };

      final String finalHtml = InvoiceTemplates.generateInvoiceFromTemplate(
        template: template,
        data: templateData,
      );

      final pdfBytes = await Printing.convertHtml(
        html: finalHtml,
        format: PdfPageFormat(58 * PdfPageFormat.mm, double.infinity, marginAll: 0),
      );

      // Default fallback to Layout PDF (shows modal)
      await Printing.layoutPdf(
        onLayout: (PdfPageFormat format) async => pdfBytes,
        name: 'invoice_$orderId',
      );
      
      return true;
    } catch (e) {
      print('Premium HTML Invoice Print Error: $e');
      return false;
    }
  }

  Future<bool> printPremiumKot({
    required String orderId,
    required String date,
    required String time,
    required List<Map<String, dynamic>> items,
    String? tableName,
    String? tokenNumber,
    String orderType = "Dine In",
    String? printerId,
  }) async {
    try {
      // 1. Silent Print Check
      if (printerId != null && printerId.startsWith("bt::")) {
         final lines = buildKotLines(
            orderId: orderId,
            date: date,
            time: time,
            items: items,
            tableName: tableName,
            tokenNumber: tokenNumber,
            orderType: orderType,
            paperWidth: 58,
         );

         return await sendPrintJob(PrintJob(
           printerId: printerId,
           width: 58,
           type: "kot",
           lines: lines,
         ));
      }

      final String template = await rootBundle.loadString('assets/templates/thermal_kot.html');
      final Map<String, dynamic> templateData = {
        'orderId': orderId,
        'orderIdShort': orderId.length > 8 ? orderId.substring(orderId.length - 8).toUpperCase() : orderId.toUpperCase(),
        'date': date,
        'time': time,
        'tableName': tableName ?? 'N/A',
        'tokenNumber': tokenNumber ?? '00',
        'orderType': orderType.toUpperCase(),
        'items': items.map((i) => {
          'name': i['name'].toString().toUpperCase(),
          'qty': i['qty'],
          'notes': i['notes'] ?? '',
        }).toList(),
      };

      final String finalHtml = InvoiceTemplates.generateInvoiceFromTemplate(
        template: template,
        data: templateData,
      );

      final pdfBytes = await Printing.convertHtml(
        html: finalHtml,
        format: PdfPageFormat(58 * PdfPageFormat.mm, double.infinity, marginAll: 0),
      );

      await Printing.layoutPdf(
        onLayout: (PdfPageFormat format) async => pdfBytes,
        name: 'kot_$orderId',
      );
      
      return true;
    } catch (e) {
      print('Premium HTML KOT Print Error: $e');
      return false;
    }
  }

  Future<bool> sendPrintJob(PrintJob job) async {
    if (job.printerId.startsWith("bt::")) {
      return await _printBluetooth(job);
    }

    // Default: Network Print
    try {
      final prefs = await SharedPreferences.getInstance();
      final bridgeUrl = prefs.getString('print_bridge_url') ?? _printServerUrl;
      final url = Uri.parse('$bridgeUrl/print');
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
      // Extract Device ID (bt::MAC_ADDRESS or bt::UUID)
      final String deviceId = job.printerId.replaceFirst("bt::", "");
      
      debugPrint("📱 Initiating Bluetooth print to: $deviceId");
      
      // Get device using persistent connection manager
      final device = await BluetoothManager().getDevice(deviceId);
      if (device == null) {
        debugPrint("❌ Failed to connect to device");
        return false;
      }

      debugPrint("✓ Device connected, discovering services...");
      
      // Discover Services
      List<BluetoothService> services = await device.discoverServices();
      BluetoothCharacteristic? writeCharacteristic;

      debugPrint("Found ${services.length} services");

      // Find the first writable characteristic
      for (var service in services) {
        for (var char in service.characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            writeCharacteristic = char;
            debugPrint("✓ Using characteristic: ${char.uuid}");
            break;
          }
        }
        if (writeCharacteristic != null) break;
      }

      if (writeCharacteristic == null) {
        debugPrint("❌ No writable characteristic found");
        return false;
      }

      // Generate ESC/POS Bytes
      if (_profile == null) {
        _profile = await CapabilityProfile.load();
      }
      
      final generator = Generator(job.width == 58 ? PaperSize.mm58 : PaperSize.mm80, _profile!);
      List<int> bytes = [];

      bytes += generator.reset();
      for (var line in job.lines) {
        PosAlign align = PosAlign.left;
        if (line.align == 'center') align = PosAlign.center;
        if (line.align == 'right') align = PosAlign.right;

        final styles = PosStyles(
          bold: line.bold,
          align: align,
          height: _getTextSize(line.height),
          width: _getTextSize(line.width),
          fontType: PosFontType.fontA,
        );
        
        bytes += generator.text(line.text, styles: styles, linesAfter: 1);
      }

      bytes += generator.feed(1);
      bytes += generator.cut();

      // Write Bytes in optimized chunks
      int mtu = await device.mtu.first;
      int chunkSize = (mtu - 3).clamp(20, 500);
      
      debugPrint("📤 Sending ${bytes.length} bytes in chunks of $chunkSize...");
      
      for (int i = 0; i < bytes.length; i += chunkSize) {
        int end = (i + chunkSize < bytes.length) ? i + chunkSize : bytes.length;
        await writeCharacteristic.write(
          bytes.sublist(i, end), 
          withoutResponse: writeCharacteristic.properties.writeWithoutResponse
        );
        await Future.delayed(const Duration(milliseconds: 5));
      }

      debugPrint("✓ Print job completed successfully");
      return true;
    } catch (e) {
      debugPrint("❌ Bluetooth print error: $e");
      return false;
    }
  }

  PosTextSize _getTextSize(int size) {
    switch (size) {
      case 2: return PosTextSize.size2;
      case 3: return PosTextSize.size3;
      case 4: return PosTextSize.size4;
      case 5: return PosTextSize.size5;
      case 6: return PosTextSize.size6;
      case 7: return PosTextSize.size7;
      case 8: return PosTextSize.size8;
      default: return PosTextSize.size1;
    }
  }

  List<PrintLine> buildKotLines({
    required String orderId,
    required String date,
    required String time,
    required List<Map<String, dynamic>> items,
    String? tableName,
    String? tokenNumber,
    String orderType = "Dine In",
    int paperWidth = 58,
  }) {
    final int charCount = paperWidth == 80 ? 48 : 32;
    final doubleDivider = "=" * charCount;
    final singleDivider = "-" * charCount;
    List<PrintLine> lines = [];

    lines.add(PrintLine(text: "KITCHEN COPY", align: 'center', bold: true, height: 1, width: 2));
    lines.add(PrintLine(text: singleDivider, align: 'center'));
    
    if (tokenNumber != null) {
      lines.add(PrintLine(text: "TOKEN: $tokenNumber", align: 'center', bold: true, height: 2, width: 2));
    }
    
    lines.add(PrintLine(text: "TABLE: ${tableName?.toUpperCase() ?? 'N/A'}", align: 'center', bold: true, height: 1, width: 2));
    lines.add(PrintLine(text: "${orderType.toUpperCase()} | $time", align: 'center', bold: true));
    lines.add(PrintLine(text: singleDivider, align: 'center'));

    for (var item in items) {
      final name = (item['name'] ?? "Item").toString().toUpperCase();
      final qty = (item['qty'] ?? item['quantity'] ?? 1).toString();
      lines.add(PrintLine(text: "$qty x $name", align: 'left', bold: true, height: 1, width: 1));
      if (item['notes'] != null && item['notes'].toString().isNotEmpty) {
        lines.add(PrintLine(text: "  * NOTES: ${item['notes']}", align: 'left', bold: true));
      }
    }

    lines.add(PrintLine(text: doubleDivider, align: 'center'));
    lines.add(PrintLine(text: "ORDER ID: ${orderId.length > 8 ? orderId.substring(orderId.length - 8) : orderId}", align: 'center'));
    
    return lines;
  }

  List<PrintLine> buildInvoiceLines({
    required String restaurantName,
    required String branchName,
    String? branchAddress,
    String? gstin,
    String? fssai,
    String? phone,
    required String billId,
    String? tokenNumber,
    String? customerName,
    String? tableName,
    String orderType = "Dine In",
    required List<Map<String, dynamic>> items,
    required double subtotal,
    required double tax,
    required double total,
    int paperWidth = 58,
  }) {
    final int charCount = paperWidth == 80 ? 48 : 32;
    final doubleDivider = "=" * charCount;
    final singleDivider = "-" * charCount;
    List<PrintLine> lines = [];

    // --- SECTION 1: HEADER ---
    lines.add(PrintLine(text: restaurantName.toUpperCase(), align: 'center', bold: true, height: 1, width: 2));
    lines.add(PrintLine(text: branchName.toUpperCase(), align: 'center', bold: true));
    if (branchAddress != null && branchAddress.isNotEmpty) {
      lines.add(PrintLine(text: branchAddress, align: 'center'));
    }
    if (gstin != null && gstin.isNotEmpty) {
      lines.add(PrintLine(text: "GSTIN: $gstin", align: 'center', bold: true));
    }
    if (fssai != null && fssai.isNotEmpty) {
      lines.add(PrintLine(text: "FSSAI: $fssai", align: 'center', bold: true));
    }
    if (phone != null && phone.isNotEmpty) {
      lines.add(PrintLine(text: "PH: $phone", align: 'center', bold: true));
    }
    lines.add(PrintLine(text: singleDivider, align: 'center'));
    lines.add(PrintLine(text: "INVOICE", align: 'center', bold: true, height: 1, width: 2));
    lines.add(PrintLine(text: singleDivider, align: 'center'));

    // --- SECTION 2: META ---
    final now = DateTime.now();
    final dateStr = "${now.day.toString().padLeft(2,'0')}/${now.month.toString().padLeft(2,'0')}";
    String metaLine1 = "NO: ${billId.toUpperCase().substring(billId.length > 6 ? billId.length - 6 : 0)}   DT: $dateStr";
    lines.add(PrintLine(text: metaLine1, align: 'left', bold: true));
    
    if (tokenNumber != null) {
      lines.add(PrintLine(text: "TOKEN: $tokenNumber", align: 'center', bold: true, height: 2, width: 2));
    }

    if (tableName != null) {
      lines.add(PrintLine(text: "TABLE: ${tableName.toUpperCase()}", align: 'left', bold: true));
    }

    if (customerName != null && customerName.isNotEmpty && customerName.toUpperCase() != 'GUEST') {
      lines.add(PrintLine(text: "CUST: ${customerName.toUpperCase()}", align: 'left', bold: true));
    }
    lines.add(PrintLine(text: singleDivider, align: 'center'));

    // --- SECTION 3: ITEMS ---
    for (var item in items) {
      final name = (item['name'] ?? "Item").toString().toUpperCase();
      final qty = (item['qty'] ?? item['quantity'] ?? 1);
      final price = (item['price'] as num? ?? 0.0).toDouble();
      final amt = price * (qty as num).toDouble();
      
      // Single line: NAME (truncated) + QTY x PRICE
      // e.g., PIZZA MARGHERITA  2 x 150.00
      String namePart = name.length > 16 ? name.substring(0, 14) + ".." : name;
      String pricePart = "${qty}x${amt.toStringAsFixed(2)}";
      int pad = charCount - namePart.length - pricePart.length;
      if (pad < 1) pad = 1;
      
      lines.add(PrintLine(text: "$namePart${" " * pad}$pricePart", align: 'left', bold: true));
      
      String hsn = (item['hsn_code'] ?? "").toString();
      if (hsn.isNotEmpty) {
        lines.add(PrintLine(text: "  HSN: $hsn", align: 'left'));
      }
    }
    lines.add(PrintLine(text: singleDivider, align: 'center'));

    // --- SECTION 4: TOTALS ---
    String subLabel = "SUBTOTAL";
    String subVal = "Rs. ${subtotal.toStringAsFixed(2)}";
    int subPad = charCount - subLabel.length - subVal.length;
    lines.add(PrintLine(text: "$subLabel${" " * (subPad > 0 ? subPad : 1)}$subVal", align: 'left', bold: true));

    if (tax > 0) {
      String taxLabel = "TAX TOTAL";
      String taxVal = "Rs. ${tax.toStringAsFixed(2)}";
      int taxPad = charCount - taxLabel.length - taxVal.length;
      lines.add(PrintLine(text: "$taxLabel${" " * (taxPad > 0 ? taxPad : 1)}$taxVal", align: 'left', bold: true));
    }

    lines.add(PrintLine(text: "GRAND TOTAL", align: 'left', bold: true, height: 1, width: 1));
    lines.add(PrintLine(text: "Rs. ${total.toStringAsFixed(2)}", align: 'right', bold: true, height: 2, width: 2));
    
    // --- SECTION 6: FOOTER ---
    lines.add(PrintLine(text: singleDivider, align: 'center'));
    lines.add(PrintLine(text: "THANK YOU!", align: 'center', bold: true));
    lines.add(PrintLine(text: "POWERED BY EZBILLIFY", align: 'center'));
    return lines;
  }

  List<PrintLine> buildConsolidatedReceiptLines({
    required String restaurantName,
    required String branchName,
    String? branchAddress,
    String? gstin,
    String? fssai,
    String? phone,
    required String? tableName,
    required String orderId,
    String? tokenNumber,
    String? customerName,
    required String orderType,
    required List<Map<String, dynamic>> items,
    required double subtotal,
    required double tax,
    required double total,
    int paperWidth = 58,
  }) {
    final invoiceLines = buildInvoiceLines(
      restaurantName: restaurantName,
      branchName: branchName,
      branchAddress: branchAddress,
      gstin: gstin,
      fssai: fssai,
      phone: phone,
      billId: orderId,
      tokenNumber: tokenNumber,
      customerName: customerName,
      tableName: tableName,
      orderType: orderType,
      items: items,
      subtotal: subtotal,
      tax: tax,
      total: total,
      paperWidth: paperWidth,
    );

    final now = DateTime.now();
    final timeStr = "${now.hour.toString().padLeft(2,'0')}:${now.minute.toString().padLeft(2,'0')}";
    final dateStr = "${now.day.toString().padLeft(2,'0')}/${now.month.toString().padLeft(2,'0')}";

    final kotLines = buildKotLines(
      orderId: orderId,
      date: dateStr,
      time: timeStr,
      tableName: tableName,
      tokenNumber: tokenNumber,
      items: items,
      orderType: orderType,
      paperWidth: paperWidth,
    );

    List<PrintLine> consolidated = [];
    consolidated.addAll(invoiceLines);
    
    // Tiny gap: 0.3cm - 0.5cm is 2-3 lines of text or a simple divider.
    // We'll use a single divider and a small feed.
    final int charCount = paperWidth == 80 ? 48 : 32;
    consolidated.add(PrintLine(text: "-" * charCount, align: 'center'));
    
    consolidated.addAll(kotLines);

    return consolidated;
  }

  Future<bool> printPremiumConsolidated({
    required String restaurantName,
    required String branchName,
    String? branchAddress,
    String? gstin,
    String? fssai,
    String? phone,
    required String? tableName,
    required String orderId,
    String? tokenNumber,
    String? customerName,
    required String orderType,
    required List<Map<String, dynamic>> items,
    required double subtotal,
    required double tax,
    required double total,
    int paperWidth = 58,
    String? printerId,
  }) async {
    final lines = buildConsolidatedReceiptLines(
      restaurantName: restaurantName,
      branchName: branchName,
      branchAddress: branchAddress,
      gstin: gstin,
      fssai: fssai,
      phone: phone,
      tableName: tableName,
      orderId: orderId,
      tokenNumber: tokenNumber,
      customerName: customerName,
      orderType: orderType,
      items: items,
      subtotal: subtotal,
      tax: tax,
      total: total,
      paperWidth: paperWidth,
    );

    return await sendPrintJob(PrintJob(
      printerId: printerId ?? "bt::default",
      width: paperWidth,
      type: "consolidated",
      lines: lines,
    ));
  }
}
