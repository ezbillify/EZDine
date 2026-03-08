import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:intl/intl.dart';
import '../core/theme.dart';
import '../services/auth_service.dart';
import '../services/audio_service.dart';
import '../services/print_service.dart';

final orderHistoryProvider = FutureProvider.family<List<Map<String, dynamic>>, OrderHistoryParams>((ref, params) async {
  final res = await Supabase.instance.client
      .from('orders')
      .select('*, tables(name), customers(name, phone), bills(bill_number, total)')
      .eq('branch_id', params.branchId)
      .gte('created_at', params.startDate.toIso8601String())
      .lte('created_at', params.endDate.toIso8601String())
      .order('created_at', ascending: false)
      .limit(100);
  
  return List<Map<String, dynamic>>.from(res);
});

class OrderHistoryParams {
  final String branchId;
  final DateTime startDate;
  final DateTime endDate;

  OrderHistoryParams({
    required this.branchId,
    required this.startDate,
    required this.endDate,
  });
}

class OrderHistoryScreen extends ConsumerStatefulWidget {
  const OrderHistoryScreen({super.key});

  @override
  ConsumerState<OrderHistoryScreen> createState() => _OrderHistoryScreenState();
}

class _OrderHistoryScreenState extends ConsumerState<OrderHistoryScreen> {
  DateTime _startDate = DateTime.now().subtract(const Duration(days: 7));
  DateTime _endDate = DateTime.now();
  String _searchQuery = '';
  String _filterStatus = 'all'; // all, completed, cancelled

  @override
  Widget build(BuildContext context) {
    final ctx = ref.watch(contextProvider);
    
    if (ctx.branchId == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('ORDER HISTORY')),
        body: const Center(child: Text('No branch selected')),
      );
    }

    final params = OrderHistoryParams(
      branchId: ctx.branchId!,
      startDate: _startDate,
      endDate: _endDate,
    );

    final ordersAsync = ref.watch(orderHistoryProvider(params));

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text(
          'ORDER HISTORY',
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
              ref.invalidate(orderHistoryProvider(params));
            },
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Column(
        children: [
          // Filters
          Container(
            padding: const EdgeInsets.all(16),
            color: Colors.white,
            child: Column(
              children: [
                // Date Range
                Row(
                  children: [
                    Expanded(
                      child: _buildDateButton(
                        label: DateFormat('MMM dd').format(_startDate),
                        onTap: () => _selectDate(true),
                      ),
                    ),
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 8),
                      child: Icon(LucideIcons.arrowRight, size: 16, color: Colors.grey),
                    ),
                    Expanded(
                      child: _buildDateButton(
                        label: DateFormat('MMM dd').format(_endDate),
                        onTap: () => _selectDate(false),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                
                // Search
                TextField(
                  onChanged: (val) => setState(() => _searchQuery = val.toLowerCase()),
                  decoration: InputDecoration(
                    hintText: 'Search by order number, table, customer...',
                    hintStyle: TextStyle(fontSize: 13, color: Colors.grey.shade400),
                    prefixIcon: const Icon(LucideIcons.search, size: 18),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: Colors.grey.shade200),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: Colors.grey.shade200),
                    ),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  ),
                ),
                const SizedBox(height: 12),
                
                // Status Filter
                Row(
                  children: [
                    _buildFilterChip('All', 'all'),
                    const SizedBox(width: 8),
                    _buildFilterChip('Completed', 'completed'),
                    const SizedBox(width: 8),
                    _buildFilterChip('Cancelled', 'cancelled'),
                  ],
                ),
              ],
            ),
          ),
          
          // Orders List
          Expanded(
            child: ordersAsync.when(
              data: (orders) {
                final filtered = orders.where((o) {
                  final matchesSearch = _searchQuery.isEmpty ||
                      o['order_number'].toString().toLowerCase().contains(_searchQuery) ||
                      (o['tables']?['name'] ?? '').toString().toLowerCase().contains(_searchQuery) ||
                      (o['customers']?['name'] ?? '').toString().toLowerCase().contains(_searchQuery);
                  
                  final matchesStatus = _filterStatus == 'all' ||
                      (_filterStatus == 'completed' && o['payment_status'] == 'paid') ||
                      (_filterStatus == 'cancelled' && o['status'] == 'cancelled');
                  
                  return matchesSearch && matchesStatus;
                }).toList();

                if (filtered.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(LucideIcons.inbox, size: 64, color: Colors.grey.shade200),
                        const SizedBox(height: 16),
                        Text(
                          'NO ORDERS FOUND',
                          style: TextStyle(
                            fontWeight: FontWeight.w900,
                            color: Colors.grey.shade300,
                            fontSize: 14,
                            letterSpacing: 2,
                          ),
                        ),
                      ],
                    ),
                  );
                }

                return ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: filtered.length,
                  separatorBuilder: (c, i) => const SizedBox(height: 12),
                  itemBuilder: (c, i) => _buildOrderCard(context, filtered[i], ctx),
                );
              },
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, s) => Center(child: Text('Error: $e')),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDateButton({required String label, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppTheme.primary.withOpacity(0.2)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(LucideIcons.calendar, size: 16, color: AppTheme.primary),
            const SizedBox(width: 8),
            Text(
              label,
              style: GoogleFonts.outfit(
                fontWeight: FontWeight.bold,
                fontSize: 13,
                color: AppTheme.secondary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChip(String label, String value) {
    final isSelected = _filterStatus == value;
    return GestureDetector(
      onTap: () {
        AudioService.instance.playClick();
        setState(() => _filterStatus = value);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.primary : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? AppTheme.primary : Colors.grey.shade300,
          ),
        ),
        child: Text(
          label,
          style: GoogleFonts.outfit(
            fontWeight: FontWeight.bold,
            fontSize: 12,
            color: isSelected ? Colors.white : Colors.grey.shade600,
          ),
        ),
      ),
    );
  }

  Widget _buildOrderCard(BuildContext context, Map<String, dynamic> order, ContextState ctx) {
    final orderNumber = order['order_number']?.toString() ?? 'N/A';
    final tableName = order['tables']?['name'] ?? 'Quick Bill';
    final customerName = order['customers']?['name'] ?? 'Guest';
    final total = (order['bills'] as List?)?.isNotEmpty == true
        ? (order['bills'][0]['total'] as num?)?.toDouble() ?? 0.0
        : 0.0;
    final status = order['payment_status'] ?? 'pending';
    final createdAt = DateTime.parse(order['created_at']);
    final orderType = order['order_type'] ?? 'dine_in';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppTheme.primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  orderType == 'dine_in' ? LucideIcons.armchair : LucideIcons.shoppingBag,
                  size: 16,
                  color: AppTheme.primary,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Order #$orderNumber',
                      style: GoogleFonts.outfit(
                        fontWeight: FontWeight.w900,
                        fontSize: 14,
                      ),
                    ),
                    Text(
                      '$tableName • $customerName',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.grey.shade600,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: status == 'paid' ? Colors.green.withOpacity(0.1) : Colors.orange.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  status.toUpperCase(),
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    color: status == 'paid' ? Colors.green : Colors.orange,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Divider(height: 1),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Total Amount',
                    style: TextStyle(
                      fontSize: 11,
                      color: Colors.grey.shade600,
                    ),
                  ),
                  Text(
                    '₹${total.toStringAsFixed(2)}',
                    style: GoogleFonts.outfit(
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                      color: AppTheme.secondary,
                    ),
                  ),
                ],
              ),
              Row(
                children: [
                  if (status == 'paid')
                    IconButton(
                      icon: const Icon(LucideIcons.printer, size: 20, color: AppTheme.primary),
                      onPressed: () {
                        AudioService.instance.playClick();
                        _reprintOrder(order, ctx);
                      },
                      tooltip: 'Reprint Invoice',
                    ),
                  const SizedBox(width: 8),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        DateFormat('MMM dd, yyyy').format(createdAt),
                        style: TextStyle(
                          fontSize: 11,
                          color: Colors.grey.shade600,
                        ),
                      ),
                      Text(
                        DateFormat('hh:mm a').format(createdAt),
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: Colors.grey.shade600,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _reprintOrder(Map<String, dynamic> order, ContextState ctx) async {
    try {
      final printService = ref.read(printServiceProvider);
      
      // Show loading
      showDialog(
        context: context, 
        barrierDismissible: false,
        builder: (c) => const Center(child: CircularProgressIndicator()),
      );
      
      // Fetch full order items
      final itemsRes = await Supabase.instance.client
          .from('order_items')
          .select('*, menu_items(name, price, tax_rate)')
          .eq('order_id', order['id']);
      
      List<Map<String, dynamic>> items = (itemsRes as List).map((i) => {
        'name': i['menu_items']?['name'] ?? 'Item',
        'qty': i['quantity'] ?? 1,
        'price': i['menu_items']?['price'] ?? 0.0,
        'tax_rate': i['menu_items']?['tax_rate'] ?? 0.0,
      }).toList();

      final total = (order['bills'] as List?)?.isNotEmpty == true
        ? (order['bills'][0]['total'] as num?)?.toDouble() ?? 0.0
        : 0.0;
      final subtotal = (order['bills'] as List?)?.isNotEmpty == true
        ? (order['bills'][0]['subtotal'] as num?)?.toDouble() ?? 0.0
        : 0.0;
      final tax = (order['bills'] as List?)?.isNotEmpty == true
        ? (order['bills'][0]['tax'] as num?)?.toDouble() ?? 0.0
        : 0.0;
        
      final createdAt = DateTime.parse(order['created_at']);
      
      // Fetch print settings
      final settings = await printService.getPrintingSettings(ctx.branchId!);
      final printerId = settings?['printerIdInvoice'];
      final paperWidth = settings?['paperWidthInvoice'] ?? 58;

      await printService.printPremiumInvoice(
        restaurantName: ctx.restaurantName ?? 'EZDine',
        branchName: ctx.branchName ?? 'Branch',
        branchAddress: ctx.branchAddress,
        phone: ctx.branchPhone,
        gstin: ctx.gstin,
        fssai: ctx.fssai,
        orderId: order['order_number'].toString(),
        date: DateFormat('dd-MM-yyyy').format(createdAt),
        time: DateFormat('HH:mm').format(createdAt),
        items: items,
        subtotal: subtotal,
        tax: tax,
        total: total,
        tableName: order['tables']?['name'],
        tokenNumber: order['token_number']?.toString(),
        customerName: order['customers']?['name'],
        orderType: order['order_type'] ?? 'dine_in',
        printerId: printerId,
        paperWidth: paperWidth,
      );

      // Hide loading
      if (mounted) Navigator.pop(context);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Reprint request sent successfully.', style: TextStyle(color: Colors.white)), backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      if (mounted) Navigator.pop(context); // pop loading
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Reprint failed: $e', style: const TextStyle(color: Colors.white)), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _selectDate(bool isStart) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: isStart ? _startDate : _endDate,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
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

    if (picked != null) {
      setState(() {
        if (isStart) {
          _startDate = picked;
        } else {
          _endDate = picked;
        }
      });
    }
  }
}
