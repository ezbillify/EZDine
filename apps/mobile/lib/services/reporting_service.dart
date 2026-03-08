import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class SalesReport {
  final double totalSales;
  final double totalTax;
  final int orderCount;
  final Map<String, double> salesByPaymentMode;
  final List<dynamic> rawBills;

  SalesReport({
    required this.totalSales,
    required this.totalTax,
    required this.orderCount,
    required this.salesByPaymentMode,
    required this.rawBills,
  });

  factory SalesReport.empty() => SalesReport(
    totalSales: 0,
    totalTax: 0,
    orderCount: 0,
    salesByPaymentMode: {},
    rawBills: [],
  );
}

class ReportingService {
  final SupabaseClient _client = Supabase.instance.client;

  Future<SalesReport> getSalesReport({
    required String branchId,
    required DateTime start,
    required DateTime end,
  }) async {
    // Fetch raw bills and related payments
    final billsResponse = await _client
        .from('bills')
        .select('*, payments(mode, amount)')
        .eq('branch_id', branchId)
        .gte('created_at', start.toIso8601String())
        .lte('created_at', end.toIso8601String())
        .order('created_at', ascending: false);
    
    final List rawBills = billsResponse as List;

    double grossSales = 0;
    double totalTax = 0;
    int orderCount = rawBills.length;
    Map<String, double> paymentModes = {};

    for (var bill in rawBills) {
      grossSales += (bill['total'] as num?)?.toDouble() ?? 0.0;
      totalTax += (bill['tax'] as num?)?.toDouble() ?? 0.0;

      final payments = bill['payments'] as List?;
      if (payments != null) {
        for (var payment in payments) {
          final mode = payment['mode'] as String?;
          final amount = (payment['amount'] as num?)?.toDouble() ?? 0.0;
          if (mode != null) {
            paymentModes[mode] = (paymentModes[mode] ?? 0) + amount;
          }
        }
      }
    }

    return SalesReport(
      totalSales: grossSales,
      totalTax: totalTax,
      orderCount: orderCount,
      salesByPaymentMode: paymentModes,
      rawBills: rawBills,
    );
  }
}

final reportingServiceProvider = Provider((ref) => ReportingService());

final dailyReportProvider = FutureProvider.family<SalesReport, String>((ref, branchId) async {
  final service = ref.watch(reportingServiceProvider);
  final currentUtc = DateTime.now().toUtc();
  final currentIst = currentUtc.add(const Duration(hours: 5, minutes: 30));
  
  final start = DateTime.utc(currentIst.year, currentIst.month, currentIst.day).subtract(const Duration(hours: 5, minutes: 30));
  final end = DateTime.utc(currentIst.year, currentIst.month, currentIst.day, 23, 59, 59, 999).subtract(const Duration(hours: 5, minutes: 30));
  
  return service.getSalesReport(branchId: branchId, start: start, end: end);
});

final monthlyReportProvider = FutureProvider.family<SalesReport, String>((ref, branchId) async {
  final service = ref.watch(reportingServiceProvider);
  final currentUtc = DateTime.now().toUtc();
  final currentIst = currentUtc.add(const Duration(hours: 5, minutes: 30));

  final start = DateTime.utc(currentIst.year, currentIst.month, 1).subtract(const Duration(hours: 5, minutes: 30));
  final end = DateTime.utc(currentIst.year, currentIst.month + 1, 0, 23, 59, 59, 999).subtract(const Duration(hours: 5, minutes: 30));
  
  return service.getSalesReport(branchId: branchId, start: start, end: end);
});

final yearlyReportProvider = FutureProvider.family<SalesReport, String>((ref, branchId) async {
  final service = ref.watch(reportingServiceProvider);
  final currentUtc = DateTime.now().toUtc();
  final currentIst = currentUtc.add(const Duration(hours: 5, minutes: 30));

  final start = DateTime.utc(currentIst.year, 1, 1).subtract(const Duration(hours: 5, minutes: 30));
  final end = DateTime.utc(currentIst.year, 12, 31, 23, 59, 59, 999).subtract(const Duration(hours: 5, minutes: 30));
  
  return service.getSalesReport(branchId: branchId, start: start, end: end);
});

final customReportProvider = FutureProvider.family<SalesReport, ({String branchId, DateTime start, DateTime end})>((ref, arg) async {
  final service = ref.watch(reportingServiceProvider);

  // Treat the selected logical year/month/day as IST bounds
  final start = DateTime.utc(arg.start.year, arg.start.month, arg.start.day).subtract(const Duration(hours: 5, minutes: 30));
  final end = DateTime.utc(arg.end.year, arg.end.month, arg.end.day, 23, 59, 59, 999).subtract(const Duration(hours: 5, minutes: 30));

  return service.getSalesReport(branchId: arg.branchId, start: start, end: end);
});
