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
      final prefs = await SharedPreferences.getInstance();
      
      // Get connection type (0=bridge, 1=bluetooth, 2=ip)
      final connectionTypeIndex = prefs.getInt('print_connection_type') ?? 0;
      final connectionType = connectionTypeIndex < 3 ? connectionTypeIndex : 0;
      
      Map<String, dynamic> settings = {};
      
      switch (connectionType) {
        case 1: // Bluetooth
          settings = {
            'printerIdKot': prefs.getString('printer_id_kot'),
            'printerIdInvoice': prefs.getString('printer_id_invoice'),
            'consolidatedPrinting': prefs.getBool('print_consolidated') ?? false,
            'paperWidthKot': prefs.getInt('paper_width_kot') ?? 58,
            'paperWidthInvoice': prefs.getInt('paper_width_invoice') ?? 58,
            'connectionType': 'bluetooth',
          };
          break;
          
        case 2: // IP Address
          settings = {
            'printerIdKot': prefs.getString('printer_ip_kot'),
            'printerIdInvoice': prefs.getString('printer_ip_invoice'),
            'consolidatedPrinting': prefs.getBool('print_consolidated') ?? false,
            'paperWidthKot': prefs.getInt('paper_width_kot') ?? 58,
            'paperWidthInvoice': prefs.getInt('paper_width_invoice') ?? 58,
            'connectionType': 'ip_address',
          };
          break;
          
        default: // Network Bridge (0)
          // Get server settings for network bridge
          try {
            final res = await _supabase
                .from('settings')
                .select('value')
                .eq('branch_id', branchId)
                .eq('key', 'printing')
                .maybeSingle();

            settings = Map<String, dynamic>.from(res?['value'] as Map? ?? {});
            settings['connectionType'] = 'network_bridge';
            
            // Local overrides for network bridge
            if (prefs.containsKey('print_consolidated')) {
              settings['consolidatedPrinting'] = prefs.getBool('print_consolidated');
            } else {
              settings['consolidatedPrinting'] = settings['consolidatedPrinting'] ?? settings['consolidatePrinting'] ?? false;
            }
            
            if (prefs.containsKey('printer_id_kot')) settings['printerIdKot'] = prefs.getString('printer_id_kot');
            if (prefs.containsKey('printer_id_invoice')) settings['printerIdInvoice'] = prefs.getString('printer_id_invoice');
            if (prefs.containsKey('print_bridge_url')) settings['bridgeUrl'] = prefs.getString('print_bridge_url');
            
            // Add paper widths
            settings['paperWidthKot'] = prefs.getInt('paper_width_kot') ?? 58;
            settings['paperWidthInvoice'] = prefs.getInt('paper_width_invoice') ?? 58;
          } catch (e) {
            debugPrint('Error fetching server settings: $e');
            // Fallback to local settings
            settings = {
              'printerIdKot': prefs.getString('printer_id_kot'),
              'printerIdInvoice': prefs.getString('printer_id_invoice'),
              'consolidatedPrinting': prefs.getBool('print_consolidated') ?? false,
              'paperWidthKot': prefs.getInt('paper_width_kot') ?? 58,
              'paperWidthInvoice': prefs.getInt('paper_width_invoice') ?? 58,
              'connectionType': 'network_bridge',
            };
          }
          break;
      }
      
      debugPrint('Print settings loaded: ${settings['connectionType']} - KOT: ${settings['printerIdKot']}, Invoice: ${settings['printerIdInvoice']}');
      return settings;
      
    } catch (e) {
      debugPrint('Error fetching print settings: $e');
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
    int? paperWidth, // Add paper width parameter
  }) async {
    try {
      // 1. Silent Print Check (Bluetooth/IP Direct)
      if (printerId != null && (printerId.startsWith("bt::") || _isValidIpAddress(printerId))) {
        final width = paperWidth ?? 58; // Use provided width or default
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
          paperWidth: width,
        );

        return await sendPrintJob(PrintJob(
          printerId: printerId,
          width: width,
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
    required String restaurantName,
    required String branchName,
    required String orderId,
    required List<Map<String, dynamic>> items,
    String? tableName,
    String? tokenNumber,
    String orderType = "Dine In",
    String? printerId,
    int? paperWidth, // Add paper width parameter
  }) async {
    try {
      // 1. Silent Print Check (Bluetooth/IP Direct)
      if (printerId != null && (printerId.startsWith("bt::") || _isValidIpAddress(printerId))) {
        final width = paperWidth ?? 58; // Use provided width or default
        final lines = buildKotLines(
            restaurantName: restaurantName,
            branchName: branchName,
            orderId: orderId,
            items: items,
            tableName: tableName,
            tokenNumber: tokenNumber,
            orderType: orderType,
            paperWidth: width,
         );

         return await sendPrintJob(PrintJob(
           printerId: printerId,
           width: width,
           type: "kot",
           lines: lines,
         ));
      }

      final String template = await rootBundle.loadString('assets/templates/thermal_kot.html');
      
      // Generate current date and time
      final now = DateTime.now();
      final currentDate = "${now.day.toString().padLeft(2,'0')}/${now.month.toString().padLeft(2,'0')}/${now.year}";
      final currentTime = "${now.hour.toString().padLeft(2,'0')}:${now.minute.toString().padLeft(2,'0')}";
      
      final Map<String, dynamic> templateData = {
        'orderId': orderId,
        'orderIdShort': orderId.length > 8 ? orderId.substring(orderId.length - 8).toUpperCase() : orderId.toUpperCase(),
        'date': currentDate,
        'time': currentTime,
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
    
    // Check if it's an IP address (direct printer connection)
    if (_isValidIpAddress(job.printerId)) {
      return await _printDirectIp(job);
    }

    // Default: Network Bridge Print
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

  bool _isValidIpAddress(String address) {
    final ipRegex = RegExp(r'^(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?::[0-9]+)?$');
    return ipRegex.hasMatch(address);
  }

  Future<bool> _printDirectIp(PrintJob job) async {
    try {
      debugPrint("🖨️ Starting IP print to: ${job.printerId}");
      
      // Parse IP and port (default to 9100 for thermal printers)
      final parts = job.printerId.split(':');
      final String ip = parts[0];
      final int port = parts.length > 1 ? int.parse(parts[1]) : 9100;
      
      debugPrint("🔗 Connecting to $ip:$port");
      
      // Validate IP format
      if (!_isValidIpAddress(job.printerId)) {
        debugPrint("❌ Invalid IP address format: ${job.printerId}");
        return false;
      }
      
      // Generate ESC/POS bytes with enhanced quality
      if (_profile == null) {
        _profile = await CapabilityProfile.load();
      }
      
      final generator = Generator(_getPaperSize(job.width), _profile!);
      List<int> bytes = [];

      // Initialize printer with enhanced settings
      bytes += generator.reset();
      
      // Set print density to maximum for better quality
      bytes += [0x1D, 0x7C, 0x00]; // Set print density (0x00 = darkest)
      
      // Set print speed to slower for better quality
      bytes += [0x1D, 0x28, 0x4B, 0x02, 0x00, 0x32, 0x00]; // Set print speed
      
      for (var line in job.lines) {
        // Check if this line contains a cut command
        if (line.text == "\x1D\x56\x00") {
          // This is a cut command, execute it directly
          bytes += generator.cut();
          continue;
        }
        
        PosAlign align = PosAlign.left;
        if (line.align == 'center') align = PosAlign.center;
        if (line.align == 'right') align = PosAlign.right;

        final styles = PosStyles(
          bold: line.bold,
          align: align,
          height: _getTextSize(line.height),
          width: _getTextSize(line.width),
          fontType: PosFontType.fontA, // Use Font A for better quality
        );
        
        bytes += generator.text(line.text, styles: styles, linesAfter: 0);
        // Add minimal line feed only for dividers and spacing
        if (line.text.contains('-') || line.text.contains('=') || line.text.trim().isEmpty) {
          bytes += generator.feed(1);
        }
      }

      bytes += generator.feed(1); // Reduced from 2 to 1
      bytes += generator.cut();

      debugPrint("📄 Generated ${bytes.length} bytes of enhanced print data");

      // Connect to printer via TCP socket with timeout
      Socket? socket;
      try {
        socket = await Socket.connect(ip, port, timeout: const Duration(seconds: 10));
        debugPrint("✓ Connected to printer at $ip:$port");
        
        // Send print data in chunks to avoid buffer overflow
        const int chunkSize = 1024;
        for (int i = 0; i < bytes.length; i += chunkSize) {
          final end = (i + chunkSize < bytes.length) ? i + chunkSize : bytes.length;
          socket.add(bytes.sublist(i, end));
          await socket.flush();
          
          // Small delay between chunks
          if (end < bytes.length) {
            await Future.delayed(const Duration(milliseconds: 10));
          }
        }
        
        debugPrint("📤 Sent ${bytes.length} bytes to printer");
        
        // Wait a bit for printer to process
        await Future.delayed(const Duration(milliseconds: 500));
        
      } catch (socketError) {
        debugPrint("❌ Socket connection error: $socketError");
        return false;
      } finally {
        // Always close the socket
        try {
          await socket?.close();
          debugPrint("🔌 Socket closed");
        } catch (e) {
          debugPrint("⚠️ Error closing socket: $e");
        }
      }
      
      debugPrint("✅ IP print job completed successfully");
      return true;
      
    } catch (e, stackTrace) {
      debugPrint("❌ Direct IP print error: $e");
      debugPrint("Stack trace: $stackTrace");
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

      // Generate ESC/POS Bytes with enhanced quality
      if (_profile == null) {
        _profile = await CapabilityProfile.load();
      }
      
      final generator = Generator(_getPaperSize(job.width), _profile!);
      List<int> bytes = [];

      // Initialize printer with enhanced settings
      bytes += generator.reset();
      
      // Set print density to maximum for better quality
      bytes += [0x1D, 0x7C, 0x00]; // Set print density (0x00 = darkest)
      
      // Set print speed to slower for better quality
      bytes += [0x1D, 0x28, 0x4B, 0x02, 0x00, 0x32, 0x00]; // Set print speed
      
      for (var line in job.lines) {
        // Check if this line contains a cut command
        if (line.text == "\x1D\x56\x00") {
          // This is a cut command, execute it directly
          bytes += generator.cut();
          continue;
        }
        
        PosAlign align = PosAlign.left;
        if (line.align == 'center') align = PosAlign.center;
        if (line.align == 'right') align = PosAlign.right;

        final styles = PosStyles(
          bold: line.bold,
          align: align,
          height: _getTextSize(line.height),
          width: _getTextSize(line.width),
          fontType: PosFontType.fontA, // Use Font A for better quality
        );
        
        bytes += generator.text(line.text, styles: styles, linesAfter: 0);
        // Add minimal line feed only for dividers and spacing
        if (line.text.contains('-') || line.text.contains('=') || line.text.trim().isEmpty) {
          bytes += generator.feed(1);
        }
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

  PaperSize _getPaperSize(int width) {
    switch (width) {
      case 56: return PaperSize.mm58; // Use 58mm for 56mm (closest available)
      case 58: return PaperSize.mm58;
      case 80: return PaperSize.mm80;
      default: return PaperSize.mm58;
    }
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
    final singleDivider = "-" * charCount;
    List<PrintLine> lines = [];

    // Ultra-compact format for ALL paper sizes (56mm, 58mm, 80mm)
    lines.add(PrintLine(text: restaurantName.toUpperCase(), align: 'center', bold: true));
    
    // Combine everything in fewer lines
    if (branchAddress != null && branchAddress.isNotEmpty) {
      lines.add(PrintLine(text: branchAddress, align: 'center'));
    }
    
    // Super compact: GST|FSSAI|PH all in one line if possible
    List<String> compactInfo = [];
    if (gstin != null && gstin.isNotEmpty) compactInfo.add("GST:$gstin");
    if (fssai != null && fssai.isNotEmpty) compactInfo.add("FSSAI:$fssai");
    if (phone != null && phone.isNotEmpty) compactInfo.add("PH:$phone");
    
    if (compactInfo.isNotEmpty) {
      String infoLine = compactInfo.join(" | ");
      // For smaller papers, split if too long
      if (paperWidth < 80 && infoLine.length > charCount) {
        for (String info in compactInfo) {
          lines.add(PrintLine(text: info, align: 'center'));
        }
      } else {
        lines.add(PrintLine(text: infoLine, align: 'center'));
      }
    }
    
    lines.add(PrintLine(text: singleDivider, align: 'center'));

    // Ultra compact meta - combine bill, date, token, table in minimal lines
    final now = DateTime.now();
    final dateStr = "${now.day.toString().padLeft(2,'0')}/${now.month.toString().padLeft(2,'0')}";
    
    String line1 = "BILL:${billId.toUpperCase().substring(billId.length > 6 ? billId.length - 6 : 0)} DT:$dateStr";
    lines.add(PrintLine(text: line1, align: 'center', bold: true));
    
    // Combine token, table, customer in one line
    List<String> metaInfo = [];
    if (tokenNumber != null) metaInfo.add("TKN:$tokenNumber");
    if (tableName != null) metaInfo.add("TBL:${tableName.toUpperCase()}");
    if (customerName != null && customerName.isNotEmpty && customerName.toUpperCase() != 'GUEST') {
      String custName = customerName.toUpperCase();
      String shortCust = custName.length > 8 ? custName.substring(0, 8) : custName;
      metaInfo.add("CUST:$shortCust");
    }
    
    if (metaInfo.isNotEmpty) {
      String metaLine = metaInfo.join(" | ");
      // For smaller papers, split if too long
      if (paperWidth < 80 && metaLine.length > charCount) {
        for (String meta in metaInfo) {
          lines.add(PrintLine(text: meta, align: 'center', bold: true));
        }
      } else {
        lines.add(PrintLine(text: metaLine, align: 'center', bold: true));
      }
    }

    if (customerName != null && customerName.isNotEmpty && customerName.toUpperCase() != 'GUEST') {
      lines.add(PrintLine(text: "CUST: ${customerName.toUpperCase()}", align: 'center', bold: true));
    }
    lines.add(PrintLine(text: singleDivider, align: 'center'));

    // Optimized items section with proper table formatting
    if (paperWidth == 80) {
      // 80mm: Add centered table header for better formatting
      lines.add(PrintLine(text: "ITEM                 QTY   PRICE    TOTAL", align: 'center', bold: true));
      lines.add(PrintLine(text: singleDivider, align: 'center'));
      
      // 80mm: Proper table format - Item | Qty | Price | Total
      for (var item in items) {
        final name = (item['name'] ?? "Item").toString().toUpperCase();
        final qty = (item['qty'] ?? item['quantity'] ?? 1);
        final price = (item['price'] as num? ?? 0.0).toDouble();
        final amt = price * (qty as num).toDouble();
        
        // Format: NAME (20 chars) | QTY (4) | PRICE (8) | TOTAL (8)
        String shortName = name.length > 20 ? name.substring(0, 18) + ".." : name;
        String qtyStr = qty.toString().padLeft(3);
        String priceStr = price.toStringAsFixed(2).padLeft(7);
        String totalStr = amt.toStringAsFixed(2).padLeft(8);
        
        // Create properly spaced table row - centered
        String itemLine = "${shortName.padRight(20)} ${qtyStr} ${priceStr} ${totalStr}";
        lines.add(PrintLine(text: itemLine, align: 'center', bold: true));
        
        // HSN on separate line if needed - centered
        String hsn = (item['hsn_code'] ?? "").toString();
        if (hsn.isNotEmpty && hsn.length <= 8) {
          lines.add(PrintLine(text: "HSN:$hsn", align: 'center'));
        }
      }
    } else {
      // Smaller papers: Compact format
      for (var item in items) {
        final name = (item['name'] ?? "Item").toString().toUpperCase();
        final qty = (item['qty'] ?? item['quantity'] ?? 1);
        final price = (item['price'] as num? ?? 0.0).toDouble();
        final amt = price * (qty as num).toDouble();
        
        String shortName = name.length > 16 ? name.substring(0, 14) + ".." : name;
        String itemLine = "${qty}x $shortName ${amt.toStringAsFixed(2)}";
        lines.add(PrintLine(text: itemLine, align: 'left', bold: true));
        
        String hsn = (item['hsn_code'] ?? "").toString();
        if (hsn.isNotEmpty && hsn.length <= 8) {
          lines.add(PrintLine(text: "HSN:$hsn", align: 'left'));
        }
      }
    }
    
    lines.add(PrintLine(text: singleDivider, align: 'center'));

    // Optimized totals section with proper formatting - centered
    if (paperWidth == 80) {
      // 80mm: Properly formatted totals - centered
      String subLabel = "SUBTOTAL";
      String subVal = "Rs. ${subtotal.toStringAsFixed(2)}";
      int subPad = charCount - subLabel.length - subVal.length;
      lines.add(PrintLine(text: "$subLabel${" " * (subPad > 0 ? subPad : 1)}$subVal", align: 'center', bold: true));
      
      if (tax > 0) {
        String taxLabel = "TAX";
        String taxVal = "Rs. ${tax.toStringAsFixed(2)}";
        int taxPad = charCount - taxLabel.length - taxVal.length;
        lines.add(PrintLine(text: "$taxLabel${" " * (taxPad > 0 ? taxPad : 1)}$taxVal", align: 'center', bold: true));
      }
      
      lines.add(PrintLine(text: singleDivider, align: 'center'));
      
      String totalLabel = "GRAND TOTAL";
      String totalVal = "Rs. ${total.toStringAsFixed(2)}";
      int totalPad = charCount - totalLabel.length - totalVal.length;
      lines.add(PrintLine(text: "$totalLabel${" " * (totalPad > 0 ? totalPad : 1)}$totalVal", align: 'center', bold: true, height: 1, width: 2));
    } else {
      // Smaller papers: Compact totals
      if (tax > 0) {
        String totalsLine = "SUB:${subtotal.toStringAsFixed(2)} TAX:${tax.toStringAsFixed(2)}";
        if (totalsLine.length > charCount) {
          lines.add(PrintLine(text: "SUB: Rs.${subtotal.toStringAsFixed(2)}", align: 'left', bold: true));
          lines.add(PrintLine(text: "TAX: Rs.${tax.toStringAsFixed(2)}", align: 'left', bold: true));
        } else {
          lines.add(PrintLine(text: totalsLine, align: 'left', bold: true));
        }
      } else {
        lines.add(PrintLine(text: "SUBTOTAL: Rs.${subtotal.toStringAsFixed(2)}", align: 'left', bold: true));
      }
      lines.add(PrintLine(text: "TOTAL: Rs.${total.toStringAsFixed(2)}", align: 'center', bold: true));
    }
    // Minimized footer - no extra spacing, immediate cut
    lines.add(PrintLine(text: singleDivider, align: 'center'));
    lines.add(PrintLine(text: "THANK YOU!", align: 'center', bold: true));
    lines.add(PrintLine(text: "POWERED BY EZBILLIFY", align: 'center'));
    
    return lines;
  }

  List<PrintLine> buildKotLines({
    required String restaurantName,
    required String branchName,
    String? tableName,
    required String orderId,
    String? tokenNumber,
    String orderType = "Dine In",
    required List<Map<String, dynamic>> items,
    int paperWidth = 58,
  }) {
    final int charCount = paperWidth == 80 ? 48 : 32;
    final singleDivider = "-" * charCount;
    List<PrintLine> lines = [];

    // Ultra-compact header for ALL paper sizes - no company names to save space
    lines.add(PrintLine(text: "KITCHEN ORDER", align: 'center', bold: true));
    if (tokenNumber != null) {
      lines.add(PrintLine(text: "TOKEN: $tokenNumber", align: 'center', bold: true, height: 2, width: 2));
    }
    
    // Combine table and time in one line for all paper sizes
    final now = DateTime.now();
    final timeStr = "${now.hour.toString().padLeft(2,'0')}:${now.minute.toString().padLeft(2,'0')}";
    
    if (tableName != null) {
      String tableTimeLine = "TBL:${tableName.toUpperCase()} | $timeStr";
      // For smaller papers, split if too long
      if (paperWidth < 80 && tableTimeLine.length > charCount) {
        lines.add(PrintLine(text: "TBL: ${tableName.toUpperCase()}", align: 'center', bold: true));
        lines.add(PrintLine(text: "TIME: $timeStr", align: 'center', bold: true));
      } else {
        lines.add(PrintLine(text: tableTimeLine, align: 'center', bold: true));
      }
    } else {
      lines.add(PrintLine(text: timeStr, align: 'center', bold: true));
    }
    lines.add(PrintLine(text: singleDivider, align: 'center'));

    // Ultra-compact items list for ALL paper sizes
    for (var item in items) {
      final name = (item['name'] ?? "Item").toString().toUpperCase();
      final qty = (item['qty'] ?? item['quantity'] ?? 1);
      
      // Compact format for all paper sizes
      String shortName = name.length > (paperWidth == 80 ? 25 : 20) ? 
                        name.substring(0, paperWidth == 80 ? 23 : 18) + ".." : name;
      lines.add(PrintLine(text: "${qty}x $shortName", align: 'left', bold: true));
      
      // Only add notes if they exist and are short
      final notes = item['notes'] ?? item['special_instructions'] ?? "";
      if (notes.toString().isNotEmpty && notes.toString().length <= 20) {
        lines.add(PrintLine(text: "  ${notes.toString().toUpperCase()}", align: 'left'));
      }
    }
    
    // Minimal footer - no extra spacing
    lines.add(PrintLine(text: singleDivider, align: 'center'));
    
    // Remove the cut command that was causing extra paper
    // lines.add(PrintLine(text: "\x1D\x56\x00", align: 'left')); // Removed this
    
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
      restaurantName: restaurantName,
      branchName: branchName,
      orderId: orderId,
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

  Future<bool> printConsolidatedSequence({
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
    try {
      debugPrint("🖨️ Starting consolidated sequence: Invoice → Cut → KOT");
      
      // Step 1: Print Invoice (without cut for consolidated mode)
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

      // Minimal separator and cut command between invoice and KOT - no extra spacing
      invoiceLines.add(PrintLine(text: "=" * (paperWidth == 80 ? 48 : 32), align: 'center'));
      
      // Add ESC/POS cut command to separate invoice from KOT - immediate cut
      invoiceLines.add(PrintLine(text: "\x1D\x56\x00", align: 'left')); // Full cut command

      // Step 2: Add KOT lines to the same print job
      final kotLines = buildKotLines(
        restaurantName: restaurantName,
        branchName: branchName,
        tableName: tableName,
        orderId: orderId,
        tokenNumber: tokenNumber,
        orderType: orderType,
        items: items,
        paperWidth: paperWidth,
      );

      // Combine both into a single print job with cut in between
      final combinedLines = [...invoiceLines, ...kotLines];

      final combinedJob = PrintJob(
        printerId: printerId ?? "bt::default",
        width: paperWidth,
        type: "consolidated",
        lines: combinedLines,
      );

      debugPrint("📄 Printing Invoice → Cut → KOT sequence...");
      bool success = await sendPrintJob(combinedJob);
      
      if (success) {
        debugPrint("✅ Consolidated sequence completed successfully");
        return true;
      } else {
        debugPrint("❌ Consolidated print failed");
        return false;
      }
      
    } catch (e) {
      debugPrint("❌ Consolidated sequence failed: $e");
      return false;
    }
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
