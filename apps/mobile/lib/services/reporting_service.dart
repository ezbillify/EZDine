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
    // 1. Fetch accurate summary from RPC
    final summaryResponse = await _client.rpc('get_sales_report', params: {
      'p_branch_id': branchId,
      'p_start_date': start.toIso8601String(),
      'p_end_date': end.toIso8601String(),
    });

    final summary = summaryResponse as Map<String, dynamic>;
    
    // 2. Fetch raw bills for export/list view (if needed)
    final billsResponse = await _client
        .from('bills')
        .select('*, payments(mode, amount)')
        .eq('branch_id', branchId)
        .gte('created_at', start.toIso8601String())
        .lte('created_at', end.toIso8601String())
        .order('created_at', ascending: false);
    
    final List rawBills = billsResponse as List;

    // Parse payment modes from RPC result
    Map<String, double> paymentModes = {};
    if (summary['payment_modes'] != null) {
        (summary['payment_modes'] as Map).forEach((key, value) {
            paymentModes[key] = (value as num).toDouble();
        });
    }

    return SalesReport(
      totalSales: (summary['gross_sales'] as num).toDouble(),
      totalTax: (summary['total_tax'] as num).toDouble(),
      orderCount: (summary['order_count'] as num).toInt(),
      salesByPaymentMode: paymentModes,
      rawBills: rawBills,
    );
  }
}

final reportingServiceProvider = Provider((ref) => ReportingService());

final dailyReportProvider = FutureProvider.family<SalesReport, String>((ref, branchId) async {
  final service = ref.watch(reportingServiceProvider);
  final now = DateTime.now();
  final start = DateTime(now.year, now.month, now.day);
  final end = DateTime(now.year, now.month, now.day, 23, 59, 59);
  
  return service.getSalesReport(branchId: branchId, start: start, end: end);
});

final monthlyReportProvider = FutureProvider.family<SalesReport, String>((ref, branchId) async {
  final service = ref.watch(reportingServiceProvider);
  final now = DateTime.now();
  final start = DateTime(now.year, now.month, 1);
  final end = DateTime(now.year, now.month + 1, 0, 23, 59, 59);
  
  return service.getSalesReport(branchId: branchId, start: start, end: end);
});

final yearlyReportProvider = FutureProvider.family<SalesReport, String>((ref, branchId) async {
  final service = ref.watch(reportingServiceProvider);
  final now = DateTime.now();
  final start = DateTime(now.year, 1, 1);
  final end = DateTime(now.year, 12, 31, 23, 59, 59);
  
  return service.getSalesReport(branchId: branchId, start: start, end: end);
});

final customReportProvider = FutureProvider.family<SalesReport, ({String branchId, DateTime start, DateTime end})>((ref, arg) async {
  final service = ref.watch(reportingServiceProvider);
  return service.getSalesReport(branchId: arg.branchId, start: arg.start, end: arg.end);
});
