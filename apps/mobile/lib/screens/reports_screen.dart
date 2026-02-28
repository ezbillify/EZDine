import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import '../core/theme.dart';
import '../services/auth_service.dart';
import '../services/reporting_service.dart';
import '../services/audio_service.dart';
import '../core/responsive.dart';
import '../widgets/lazy_tab_view.dart';

class ReportsScreen extends ConsumerStatefulWidget {
  const ReportsScreen({super.key});

  @override
  ConsumerState<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends ConsumerState<ReportsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  DateTimeRange? _customRange;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _selectCustomRange() async {
    final range = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
      currentDate: DateTime.now(),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: ColorScheme.light(
              primary: AppTheme.primary,
              onPrimary: Colors.white,
              onSurface: AppTheme.secondary,
            ),
          ),
          child: child!,
        );
      },
    );

    if (range != null) {
      setState(() => _customRange = range);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ctx = ref.watch(contextProvider);
    if (ctx.branchId == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('REPORTS')),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(LucideIcons.store, size: 64, color: Colors.grey.shade200),
              const SizedBox(height: 24),
              Text(
                'NO BRANCH SELECTED',
                style: GoogleFonts.outfit(fontWeight: FontWeight.w900, fontSize: 14, color: Colors.grey.shade400, letterSpacing: 1),
              ),
              const SizedBox(height: 8),
              Text(
                'Please select a branch from the dashboard to view analytics.',
                style: TextStyle(color: Colors.grey.shade400, fontSize: 12),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text(
          'ANALYTICS & REPORTS',
          style: GoogleFonts.outfit(fontWeight: FontWeight.w900, fontSize: 14, letterSpacing: 2),
        ),
        leading: IconButton(
          icon: const Icon(LucideIcons.chevronLeft),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          IconButton(
            icon: const Icon(LucideIcons.refreshCw, size: 20),
            onPressed: () {
              AudioService.instance.playClick();
              ref.invalidate(dailyReportProvider(ctx.branchId!));
              ref.invalidate(monthlyReportProvider(ctx.branchId!));
              ref.invalidate(yearlyReportProvider(ctx.branchId!));
              if (_customRange != null) {
                ref.invalidate(customReportProvider((
                  branchId: ctx.branchId!,
                  start: _customRange!.start,
                  end: _customRange!.end.add(const Duration(hours: 23, minutes: 59, seconds: 59)),
                )));
              }
            },
          ),
          const SizedBox(width: 8),
        ],
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppTheme.primary,
          unselectedLabelColor: Colors.grey,
          indicatorColor: AppTheme.primary,
          indicatorWeight: 4,
          indicatorPadding: const EdgeInsets.symmetric(horizontal: 16),
          isScrollable: Responsive.isMobile(context),
          labelStyle: GoogleFonts.outfit(fontWeight: FontWeight.w900, fontSize: 12, letterSpacing: 1),
          tabs: const [
            Tab(text: 'TODAY'),
            Tab(text: 'MONTH'),
            Tab(text: 'YEAR'),
            Tab(text: 'CUSTOM'),
          ],
        ),
      ),
      body: LazyTabView(
        controller: _tabController,
        tabBuilders: [
          () => _ReportView(provider: dailyReportProvider(ctx.branchId!), title: "Daily Report"),
          () => _ReportView(provider: monthlyReportProvider(ctx.branchId!), title: "Monthly Report"),
          () => _ReportView(provider: yearlyReportProvider(ctx.branchId!), title: "Yearly Report"),
          () => Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(24),
                child: GestureDetector(
                  onTap: _selectCustomRange,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: AppTheme.primary.withOpacity(0.1)),
                      boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10)],
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            const Icon(LucideIcons.calendar, size: 20, color: AppTheme.primary),
                            const SizedBox(width: 12),
                            Text(
                              _customRange == null
                                  ? "SELECT DATE RANGE"
                                  : "${DateFormat('MMM dd').format(_customRange!.start)} - ${DateFormat('MMM dd').format(_customRange!.end)}",
                              style: GoogleFonts.outfit(fontWeight: FontWeight.w900, fontSize: 13),
                            ),
                          ],
                        ),
                        const Icon(LucideIcons.chevronDown, size: 16, color: Colors.grey),
                      ],
                    ),
                  ),
                ),
              ),
              if (_customRange != null)
                Expanded(
                  child: _ReportView(
                    title: "Custom Range Report",
                    provider: customReportProvider((
                      branchId: ctx.branchId!,
                      start: _customRange!.start,
                      end: _customRange!.end.add(const Duration(hours: 23, minutes: 59, seconds: 59)),
                    )),
                  ),
                )
              else
                Expanded(
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(LucideIcons.calendar, size: 48, color: Colors.grey.shade200),
                        const SizedBox(height: 16),
                        Text(
                          'PICK A DATE RANGE TO BEGIN',
                          style: TextStyle(fontWeight: FontWeight.w900, color: Colors.grey.shade300, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ReportView extends ConsumerWidget {
  final AlwaysAliveRefreshable<AsyncValue<SalesReport>> provider;
  final String title;

  const _ReportView({required this.provider, required this.title});

  Future<void> _exportExcel(SalesReport report) async {
    final csv = StringBuffer();
    csv.writeln("Bill ID,Date,Total,Tax,Payment Mode");
    
    for (var bill in report.rawBills) {
      final payments = (bill['payments'] as List?)?.map((p) => p['mode']).join("|") ?? "";
      csv.writeln("${bill['id']},${bill['created_at']},${bill['total']},${bill['tax']},$payments");
    }

    final directory = await getTemporaryDirectory();
    final file = File('${directory.path}/Report_${DateTime.now().millisecondsSinceEpoch}.csv');
    await file.writeAsString(csv.toString());
    await Share.shareXFiles([XFile(file.path)], text: 'Exported Sales Report');
  }

  Future<void> _exportPDF(SalesReport report) async {
    final pdf = pw.Document();

    pdf.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        build: (pw.Context context) {
          return pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Text(title, style: pw.TextStyle(fontSize: 24, fontWeight: pw.FontWeight.bold)),
              pw.SizedBox(height: 20),
              pw.Text("Generated on: ${DateTime.now().toString()}"),
              pw.Divider(),
              pw.SizedBox(height: 20),
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Text("Total Revenue: INR ${report.totalSales.toStringAsFixed(2)}"),
                  pw.Text("Total Tax: INR ${report.totalTax.toStringAsFixed(2)}"),
                ],
              ),
              pw.SizedBox(height: 10),
              pw.Text("Total Orders: ${report.orderCount}"),
              pw.SizedBox(height: 40),
              pw.Text("Summary by Payment Mode", style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
              pw.SizedBox(height: 10),
              ...report.salesByPaymentMode.entries.map(
                (e) => pw.Padding(
                  padding: const pw.EdgeInsets.symmetric(vertical: 4),
                  child: pw.Row(
                    mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                    children: [
                      pw.Text(e.key),
                      pw.Text("INR ${e.value.toStringAsFixed(2)}"),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );

    await Printing.sharePdf(bytes: await pdf.save(), filename: 'Report_${DateTime.now().millisecondsSinceEpoch}.pdf');
  }

  Widget _buildBreakdownHeader() {
    return Text(
      'REVENUE BY CHANNEL',
      style: GoogleFonts.outfit(
        fontSize: 10,
        fontWeight: FontWeight.w900,
        color: Colors.grey.shade400,
        letterSpacing: 2,
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reportAsync = ref.watch(provider);
    final isMobile = Responsive.isMobile(context);

    return reportAsync.when(
      data: (report) {
        final excelBtn = ElevatedButton.icon(
          onPressed: () => _exportExcel(report),
          icon: const Icon(LucideIcons.download, size: 16),
          label: const Text("EXCEL"),
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.white,
            foregroundColor: AppTheme.primary,
            elevation: 0,
            padding: const EdgeInsets.symmetric(vertical: 16),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: AppTheme.primary.withOpacity(0.1))),
          ),
        );

        final pdfBtn = ElevatedButton.icon(
          onPressed: () => _exportPDF(report),
          icon: const Icon(LucideIcons.fileText, size: 16),
          label: const Text("PDF"),
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.white,
            foregroundColor: Colors.indigo,
            elevation: 0,
            padding: const EdgeInsets.symmetric(vertical: 16),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.indigo.withOpacity(0.1))),
          ),
        );

        return SingleChildScrollView(
          padding: EdgeInsets.all(isMobile ? 24 : 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  if (isMobile) Expanded(child: excelBtn) else SizedBox(width: 160, child: excelBtn),
                  const SizedBox(width: 12),
                  if (isMobile) Expanded(child: pdfBtn) else SizedBox(width: 160, child: pdfBtn),
                ],
              ),
              const SizedBox(height: 32),
              if (isMobile) ...[
                _buildSummaryGrid(report, context),
                const SizedBox(height: 32),
                _buildBreakdownHeader(),
                const SizedBox(height: 16),
                _buildPaymentBreakdown(report),
                _buildRecentBills(report),
              ] else
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      flex: 3,
                      child: Column(
                        children: [
                          _buildSummaryGrid(report, context),
                          _buildRecentBills(report),
                        ],
                      ),
                    ),
                    const SizedBox(width: 40),
                    Expanded(
                      flex: 2,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _buildBreakdownHeader(),
                          const SizedBox(height: 16),
                          _buildPaymentBreakdown(report),
                        ],
                      ),
                    ),
                  ],
                ),
            ],
          ),
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, s) => Center(child: Text('Error: $e')),
    );
  }

  Widget _buildSummaryGrid(SalesReport report, BuildContext context) {
    final isMobile = Responsive.isMobile(context);
    return GridView.count(
      shrinkWrap: true,
      padding: EdgeInsets.zero,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: isMobile ? 2 : 3,
      mainAxisSpacing: 16,
      crossAxisSpacing: 16,
      childAspectRatio: isMobile ? 1.25 : 1.5,
      children: [
        _StatCard(
          label: 'REVENUE',
          value: '₹${report.totalSales.toStringAsFixed(0)}',
          icon: LucideIcons.indianRupee,
          color: AppTheme.primary,
          subtitle: 'Inc. taxes',
        ).animate().fadeIn().slideY(begin: 0.1, end: 0),
        _StatCard(
          label: 'TAX',
          value: '₹${report.totalTax.toStringAsFixed(0)}',
          icon: LucideIcons.receipt,
          color: Colors.orange,
          subtitle: 'Liability',
        ).animate().fadeIn(delay: 100.ms).slideY(begin: 0.1, end: 0),
        _StatCard(
          label: 'ORDERS',
          value: report.orderCount.toString(),
          icon: LucideIcons.shoppingBag,
          color: Colors.indigo,
          subtitle: 'Completed',
        ).animate().fadeIn(delay: 200.ms).slideY(begin: 0.1, end: 0),
      ],
    );
  }

  Widget _buildRecentBills(SalesReport report) {
    if (report.rawBills.isEmpty) return const SizedBox();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 32),
        Text(
          'RECENT TRANSACTIONS',
          style: GoogleFonts.outfit(
            fontSize: 10,
            fontWeight: FontWeight.w900,
            color: Colors.grey.shade400,
            letterSpacing: 2,
          ),
        ),
        const SizedBox(height: 16),
        ListView.builder(
          shrinkWrap: true,
          padding: EdgeInsets.zero,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: report.rawBills.length > 20 ? 20 : report.rawBills.length,
          itemBuilder: (context, index) {
            final bill = report.rawBills[index];
            final date = DateTime.tryParse(bill['created_at'] ?? "") ?? DateTime.now();
            final billNum = bill['bill_number']?.toString().toUpperCase() ?? bill['id'].toString().substring(0, 6).toUpperCase();

            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.grey.shade50),
                boxShadow: [
                  BoxShadow(color: Colors.black.withOpacity(0.01), blurRadius: 10, offset: const Offset(0, 4)),
                ],
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(color: AppTheme.primary.withOpacity(0.05), borderRadius: BorderRadius.circular(12)),
                    child: const Icon(LucideIcons.receipt, size: 16, color: AppTheme.primary),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "BILL #$billNum",
                          style: GoogleFonts.outfit(fontWeight: FontWeight.w900, fontSize: 13, color: AppTheme.secondary),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          DateFormat('MMM dd, hh:mm a').format(date),
                          style: TextStyle(color: Colors.grey.shade400, fontSize: 10, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade50,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      "₹${(bill['total'] as num).toStringAsFixed(0)}",
                      style: GoogleFonts.outfit(fontWeight: FontWeight.w900, fontSize: 14, color: AppTheme.secondary),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ],
    );
  }

  Widget _buildPaymentBreakdown(SalesReport report) {
    if (report.salesByPaymentMode.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(40),
        width: double.infinity,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
        ),
        child: Column(
          children: [
            Icon(LucideIcons.barChart3, size: 48, color: Colors.grey.shade200),
            const SizedBox(height: 16),
            Text(
              'NO REVENUE DATA',
              style: TextStyle(fontWeight: FontWeight.w900, color: Colors.grey.shade300, fontSize: 12),
            ),
          ],
        ),
      );
    }

    final modes = report.salesByPaymentMode.entries.toList();
    modes.sort((a, b) => b.value.compareTo(a.value));

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 20, offset: const Offset(0, 10)),
        ],
      ),
      child: Column(
        children: modes.map((e) {
          final percentage = report.totalSales > 0 ? e.value / report.totalSales : 0.0;
          return Padding(
            padding: const EdgeInsets.only(bottom: 20),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        _getIconForMode(e.key),
                        const SizedBox(width: 12),
                        Text(
                          e.key.toUpperCase(),
                          style: GoogleFonts.outfit(fontWeight: FontWeight.w900, fontSize: 13),
                        ),
                      ],
                    ),
                    Text(
                      '₹${e.value.toStringAsFixed(0)}',
                      style: GoogleFonts.outfit(fontWeight: FontWeight.w900, fontSize: 15, color: AppTheme.secondary),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Stack(
                  children: [
                    Container(
                      height: 8,
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: Colors.grey.shade100,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                    FractionallySizedBox(
                      widthFactor: percentage,
                      child: Container(
                        height: 8,
                        decoration: BoxDecoration(
                          color: _getColorForMode(e.key),
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                    ).animate(),
                  ],
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _getIconForMode(String mode) {
    IconData icon;
    Color color;
    switch (mode.toLowerCase()) {
      case 'cash':
        icon = LucideIcons.banknote;
        color = Colors.green;
        break;
      case 'upi':
        icon = LucideIcons.smartphone;
        color = AppTheme.primary;
        break;
      case 'card':
        icon = LucideIcons.creditCard;
        color = Colors.indigo;
        break;
      default:
        icon = LucideIcons.coins;
        color = Colors.grey;
    }
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(color: color.withOpacity(0.1), shape: BoxShape.circle),
      child: Icon(icon, size: 16, color: color),
    );
  }

  Color _getColorForMode(String mode) {
    switch (mode.toLowerCase()) {
      case 'cash': return Colors.green;
      case 'upi': return AppTheme.primary;
      case 'card': return Colors.indigo;
      default: return Colors.grey;
    }
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final String subtitle;

  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 15, offset: const Offset(0, 5)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
                child: Icon(icon, color: color, size: 16),
              ),
            ],
          ),
          const Spacer(),
          Text(
            label.toUpperCase(),
            style: GoogleFonts.outfit(fontSize: 8, fontWeight: FontWeight.w900, color: Colors.grey.shade400, letterSpacing: 1),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w900, color: const Color(0xFF0F172A), letterSpacing: -0.5),
          ),
          const SizedBox(height: 2),
          Text(
            subtitle,
            style: TextStyle(fontSize: 8, color: Colors.grey.shade400, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }
}
