import 'package:flutter/material.dart';
import 'dart:async';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../services/auth_service.dart';
import '../core/theme.dart';

// Providers
final menuCategoriesProvider = FutureProvider.family<List<Map<String, dynamic>>, String>((ref, branchId) async {
  final res = await Supabase.instance.client
      .from('menu_categories')
      .select()
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('sort_order', ascending: true);
  return List<Map<String, dynamic>>.from(res);
});

final menuItemsProvider = FutureProvider.family<List<Map<String, dynamic>>, String>((ref, branchId) async {
  final res = await Supabase.instance.client
      .from('menu_items')
      .select('*, menu_categories(name)')
      .eq('branch_id', branchId)
      .eq('is_active', true);
  return List<Map<String, dynamic>>.from(res);
});

final tablesProvider = FutureProvider.family<List<Map<String, dynamic>>, String>((ref, branchId) async {
  final res = await Supabase.instance.client
      .from('tables')
      .select()
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('name');
  return List<Map<String, dynamic>>.from(res);
});

// State
class PosScreen extends ConsumerStatefulWidget {
  const PosScreen({super.key});

  @override
  ConsumerState<PosScreen> createState() => _PosScreenState();
}

class _PosScreenState extends ConsumerState<PosScreen> {
  String? _selectedCategoryId;
  Map<String, dynamic>? _selectedTable;
  Map<String, dynamic>? _selectedCustomer;
  final List<Map<String, dynamic>> _cart = [];
  bool _isSaving = false;

  void _addToCart(Map<String, dynamic> item) {
    if (_selectedCustomer == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please select a customer first')));
      _showCustomerSheet();
      return;
    }
    if (_selectedTable == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please select a table')));
      _showTableSheet();
      return;
    }

    setState(() {
      final existingIndex = _cart.indexWhere((i) => i['id'] == item['id']);
      if (existingIndex >= 0) {
        _cart[existingIndex]['qty']++;
      } else {
        _cart.add({...item, 'qty': 1});
      }
    });
    HapticFeedback.lightImpact();
  }

  Future<void> _createOrder() async {
    if (_cart.isEmpty || _selectedTable == null || _selectedCustomer == null) return;
    
    setState(() => _isSaving = true);
    final ctx = ref.read(contextProvider);

    try {
      // 1. Get next order number
      final nextNum = await Supabase.instance.client.rpc('next_doc_number', params: {
        'p_branch_id': ctx.branchId!,
        'p_doc_type': 'order'
      });

      // 2. Create Order
      final orderRes = await Supabase.instance.client
          .from('orders')
          .insert({
            'restaurant_id': ctx.restaurantId!,
            'branch_id': ctx.branchId!,
            'table_id': _selectedTable!['id'],
            'customer_id': _selectedCustomer!['id'],
            'status': 'pending',
            'order_number': nextNum,
            'total_amount': _total,
          })
          .select()
          .single();

      // 3. Add Items
      final items = _cart.map((i) => {
        'order_id': orderRes['id'],
        'item_id': i['id'],
        'quantity': i['qty'],
        'price': i['base_price'],
        'status': 'pending'
      }).toList();

      await Supabase.instance.client.from('order_items').insert(items);

      if (mounted) {
        Navigator.pop(context); // Close cart sheet
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Order #${orderRes['order_number']} Created!')));
        setState(() {
          _cart.clear();
          _selectedTable = null;
          _selectedCustomer = null;
        });
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      setState(() => _isSaving = false);
    }
  }

  void _showActiveOrders() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _ActiveOrdersSheet(),
    );
  }

  void _showTableSheet() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (c) => Consumer(
        builder: (context, ref, _) {
          final ctx = ref.watch(contextProvider);
          final tablesAsync = ref.watch(tablesProvider(ctx.branchId!));
          
          return Container(
            padding: const EdgeInsets.all(24),
            height: 400,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('SELECT TABLE', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: Colors.grey)),
                const SizedBox(height: 16),
                Expanded(
                  child: tablesAsync.when(
                    data: (tables) => GridView.builder(
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 3, crossAxisSpacing: 10, mainAxisSpacing: 10),
                      itemCount: tables.length,
                      itemBuilder: (context, index) {
                        final table = tables[index];
                        final isSelected = _selectedTable?['id'] == table['id'];
                        return GestureDetector(
                          onTap: () {
                            setState(() => _selectedTable = table);
                            Navigator.pop(context);
                          },
                          child: Container(
                            decoration: BoxDecoration(
                              color: isSelected ? AppTheme.primary : Colors.white,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: Colors.grey.shade200),
                            ),
                            child: Center(
                              child: Text(
                                table['name'],
                                style: TextStyle(fontWeight: FontWeight.bold, color: isSelected ? Colors.white : Colors.black),
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                    loading: () => const Center(child: CircularProgressIndicator()),
                    error: (e, s) => Text('Error: $e'),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  void _showCustomerSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (c) => _CustomerSearchSheet(
        onSelect: (customer) {
          setState(() => _selectedCustomer = customer);
          Navigator.pop(context);
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Selected: ${customer['name']}')));
        },
      ),
    );
  }

  double get _total => _cart.fold(0, (sum, item) => sum + (item['base_price'] * item['qty']));

  @override
  Widget build(BuildContext context) {
    final ctx = ref.watch(contextProvider);
    if (ctx.branchId == null) return Scaffold(body: Center(child: Text('Please select branch')));

    final categoriesAsync = ref.watch(menuCategoriesProvider(ctx.branchId!));
    final itemsAsync = ref.watch(menuItemsProvider(ctx.branchId!));

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('POS TERMINAL', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
        leading: IconButton(
          icon: const Icon(LucideIcons.chevronLeft),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          IconButton(
            icon: const Icon(LucideIcons.receipt),
            onPressed: _showActiveOrders,
            tooltip: 'Active Orders',
          ),
        ],
      ),
      body: Column(
        children: [
          // Context Bar (Table + Customer)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            color: Colors.white,
            child: Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: _showTableSheet,
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: _selectedTable != null ? AppTheme.primary.withOpacity(0.1) : Colors.grey.shade50,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: _selectedTable != null ? AppTheme.primary : Colors.grey.shade200),
                      ),
                      child: Row(
                        children: [
                          Icon(LucideIcons.armchair, size: 16, color: _selectedTable != null ? AppTheme.primary : Colors.grey),
                          const SizedBox(width: 8),
                          Text(_selectedTable?['name'] ?? 'Select Table', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: GestureDetector(
                    onTap: _showCustomerSheet,
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: _selectedCustomer != null ? Colors.green.withOpacity(0.1) : Colors.grey.shade50,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: _selectedCustomer != null ? Colors.green : Colors.grey.shade200),
                      ),
                      child: Row(
                        children: [
                          Icon(LucideIcons.user, size: 16, color: _selectedCustomer != null ? Colors.green : Colors.grey),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _selectedCustomer?['name'] ?? 'Select Customer', 
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Categories Scroll
          categoriesAsync.when(
            data: (cats) => Container(
              height: 60,
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: [
                  _CategoryChip(
                    label: 'All Items',
                    isSelected: _selectedCategoryId == null,
                    onTap: () => setState(() => _selectedCategoryId = null),
                  ),
                  ...cats.map((c) => _CategoryChip(
                    label: c['name'],
                    isSelected: _selectedCategoryId == c['id'],
                    onTap: () => setState(() => _selectedCategoryId = c['id']),
                  )),
                ],
              ),
            ),
            loading: () => const SizedBox(height: 60),
            error: (e, s) => const SizedBox(height: 60),
          ),

          // Items Grid
          Expanded(
            child: itemsAsync.when(
              data: (items) {
                final filtered = _selectedCategoryId == null 
                  ? items 
                  : items.where((i) => i['category_id'] == _selectedCategoryId).toList();

                return GridView.builder(
                  padding: const EdgeInsets.all(16),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: 16,
                    crossAxisSpacing: 16,
                    childAspectRatio: 0.85,
                  ),
                  itemCount: filtered.length,
                  itemBuilder: (context, index) {
                    final item = filtered[index];
                    return _ProductCard(
                      item: item,
                      onAdd: () => _addToCart(item),
                    );
                  },
                );
              },
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, s) => Center(child: Text('POS Error: $e')),
            ),
          ),

          // Bottom Cart Summary
          if (_cart.isNotEmpty)
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.white,
                boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 20, offset: const Offset(0, -5))],
                borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
              ),
              child: SafeArea(
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('${_cart.length} ITEMS SELECTED', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.grey, letterSpacing: 1)),
                          Text('₹${_total.toStringAsFixed(2)}', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900)),
                        ],
                      ),
                    ),
                    ElevatedButton(
                      onPressed: _isSaving ? null : _createOrder,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.secondary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      ),
                      child: _isSaving 
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : const Text('CREATE ORDER', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              ),
            ).animate().slideY(begin: 1, end: 0, duration: 400.ms, curve: Curves.easeOutBack),
        ],
      ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _CategoryChip({required this.label, required this.isSelected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 20),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.secondary : Colors.white,
          borderRadius: BorderRadius.circular(100),
          border: Border.all(color: isSelected ? Colors.transparent : Colors.grey.shade200),
        ),
        child: Center(
          child: Text(
            label.toUpperCase(),
            style: TextStyle(
              color: isSelected ? Colors.white : AppTheme.secondary,
              fontWeight: FontWeight.w900,
              fontSize: 10,
              letterSpacing: 1,
            ),
          ),
        ),
      ),
    );
  }
}

class _ProductCard extends StatelessWidget {
  final Map<String, dynamic> item;
  final VoidCallback onAdd;

  const _ProductCard({required this.item, required this.onAdd});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onAdd,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: Colors.grey.shade100),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              height: 40,
              width: 40,
              decoration: BoxDecoration(
                color: (item['is_veg'] ?? true ? Colors.green : Colors.red).withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: Icon(
                  item['is_veg'] ?? true ? LucideIcons.leaf : LucideIcons.flame,
                  size: 18,
                  color: item['is_veg'] ?? true ? Colors.green : Colors.red,
                ),
              ),
            ),
            const Spacer(),
            Text(item['name'], style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, height: 1.2)),
            const SizedBox(height: 4),
            Text(item['menu_categories']?['name'] ?? 'General', style: TextStyle(color: Colors.grey.shade500, fontSize: 10)),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('₹${item['base_price']}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                Container(
                  padding: const EdgeInsets.all(4),
                  decoration: const BoxDecoration(color: AppTheme.primary, shape: BoxShape.circle),
                  child: const Icon(LucideIcons.plus, color: Colors.white, size: 16),
                ),
              ],
            ),
          ],
        ),
      ).animate().fadeIn().scale(begin: const Offset(0.9, 0.9)),
    );
  }
}

class _CustomerSearchSheet extends ConsumerStatefulWidget {
  final Function(Map<String, dynamic>) onSelect;
  const _CustomerSearchSheet({required this.onSelect});

  @override
  ConsumerState<_CustomerSearchSheet> createState() => _CustomerSearchSheetState();
}

class _CustomerSearchSheetState extends ConsumerState<_CustomerSearchSheet> {
  final _controller = TextEditingController();
  List<Map<String, dynamic>> _results = [];
  bool _isLoading = false;
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onSearchChanged(String query) {
    if (_debounce?.isActive ?? false) _debounce!.cancel();
    if (query.trim().length < 3) {
      if (mounted) setState(() => _results = []);
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 500), () => _search(query));
  }

  Future<void> _search(String query) async {
    setState(() => _isLoading = true);
    final ctx = ref.read(contextProvider);
    try {
      final res = await Supabase.instance.client
        .from('customers')
        .select()
        .ilike('phone', '%$query%')
        .limit(5);
      
      if (mounted) setState(() => _results = List<Map<String, dynamic>>.from(res));
    } catch(e) {
      print('Search error: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _createAndSelect() async {
    if (_controller.text.trim().length < 3) return;
    
    setState(() => _isLoading = true);
    final ctx = ref.read(contextProvider);
    try {
      final newCust = await Supabase.instance.client
        .from('customers')
        .insert({
          'restaurant_id': ctx.restaurantId!,
          'phone': _controller.text.trim(),
          'name': 'Guest ${_controller.text.trim()}'
        })
        .select()
        .single();
        
      widget.onSelect(newCust);
    } catch(e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error creating guest: $e')));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        padding: const EdgeInsets.all(24),
        height: 500,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('CUSTOMER IDENTITY', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: Colors.grey)),
            const SizedBox(height: 16),
            TextField(
              controller: _controller,
              keyboardType: TextInputType.phone,
              textInputAction: TextInputAction.search,
              onChanged: _onSearchChanged,
              onSubmitted: (val) {
                if (_results.isNotEmpty) {
                  widget.onSelect(_results.first);
                } else {
                  _createAndSelect();
                }
              },
              decoration: InputDecoration(
                labelText: 'Search by Phone',
                hintText: 'Start typing...',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                prefixIcon: const Icon(LucideIcons.search, size: 20),
                suffixIcon: _isLoading 
                  ? const Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator(strokeWidth: 2))
                  : null,
              ),
            ),
            const SizedBox(height: 16),
            Expanded(
              child: _results.isEmpty 
                ? (_controller.text.length > 3 && !_isLoading
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Text('No guest found', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey)),
                            const SizedBox(height: 12),
                            ElevatedButton.icon(
                              onPressed: _createAndSelect,
                              icon: const Icon(LucideIcons.userPlus, size: 16),
                              label: const Text('Create New Guest'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppTheme.secondary,
                                foregroundColor: Colors.white,
                              ),
                            )
                          ],
                        ),
                      )
                    : const Center(child: Text('Type phone number to search', style: TextStyle(color: Colors.grey))))
                : ListView.builder(
                    itemCount: _results.length,
                    itemBuilder: (context, index) {
                      final cust = _results[index];
                      return ListTile(
                        onTap: () => widget.onSelect(cust),
                        leading: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(color: Colors.green.withOpacity(0.1), shape: BoxShape.circle),
                          child: const Icon(LucideIcons.user, color: Colors.green, size: 20),
                        ),
                        title: Text(cust['name'], style: const TextStyle(fontWeight: FontWeight.bold)),
                        subtitle: Text(cust['phone']),
                        trailing: const Icon(LucideIcons.chevronRight, size: 16, color: Colors.grey),
                      );
                    },
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActiveOrdersSheet extends ConsumerStatefulWidget {
  const _ActiveOrdersSheet();

  @override
  ConsumerState<_ActiveOrdersSheet> createState() => _ActiveOrdersSheetState();
}

class _ActiveOrdersSheetState extends ConsumerState<_ActiveOrdersSheet> {
  
  Future<List<Map<String, dynamic>>> _fetchActiveOrders() async {
    final ctx = ref.read(contextProvider);
    final res = await Supabase.instance.client
        .from('orders')
        .select('*, tables(name), order_items(quantity, price, menu_items(name))')
        .eq('branch_id', ctx.branchId!)
        .neq('status', 'completed')
        .neq('status', 'cancelled')
        .order('created_at', ascending: false);
    return List<Map<String, dynamic>>.from(res);
  }

  Future<void> _generateBill(Map<String, dynamic> order) async {
    // 1. Mark as completed/billed
    try {
      await Supabase.instance.client
          .from('orders')
          .update({'status': 'completed', 'payment_status': 'paid'}) // Simplified billing
          .eq('id', order['id']);

      if (mounted) {
        setState(() {}); // Refresh list
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Bill Generated for Order #${order['order_number']}')));
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Billing Failed: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      decoration: const BoxDecoration(
        color: Color(0xFFF8FAFC),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(24),
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: Row(
              children: [
                const Icon(LucideIcons.receipt, color: AppTheme.secondary),
                const SizedBox(width: 12),
                const Text('ACTIVE ORDERS', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                const Spacer(),
                IconButton(icon: const Icon(LucideIcons.x), onPressed: () => Navigator.pop(context)),
              ],
            ),
          ),
          
          Expanded(
            child: FutureBuilder<List<Map<String, dynamic>>>(
              future: _fetchActiveOrders(),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (snapshot.hasError) {
                  return Center(child: Text('Error: ${snapshot.error}'));
                }
                final orders = snapshot.data ?? [];
                if (orders.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(LucideIcons.listX, size: 64, color: Colors.grey.shade300),
                        const SizedBox(height: 16),
                        const Text('No Active Orders', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey)),
                      ],
                    ),
                  );
                }

                return ListView.separated(
                  padding: const EdgeInsets.all(24),
                  itemCount: orders.length,
                  separatorBuilder: (c, i) => const SizedBox(height: 16),
                  itemBuilder: (context, index) {
                    final order = orders[index];
                    final items = order['order_items'] as List;
                    final total = order['total_amount'] ?? items.fold(0.0, (sum, i) => sum + (i['price'] * i['quantity']));
                    final status = order['status'].toString().toUpperCase();

                    return Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 4))],
                      ),
                      child: Column(
                        children: [
                          // Card Header
                          Padding(
                            padding: const EdgeInsets.all(16),
                            child: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(color: AppTheme.secondary.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
                                  child: const Icon(LucideIcons.armchair, color: AppTheme.secondary, size: 20),
                                ),
                                const SizedBox(width: 16),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(order['tables']?['name'] ?? 'Table ?', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                                    Text('Order #${order['order_number']}', style: TextStyle(color: Colors.grey.shade500, fontSize: 12)),
                                  ],
                                ),
                                const Spacer(),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(color: Colors.orange.withOpacity(0.1), borderRadius: BorderRadius.circular(6)),
                                  child: Text(status, style: const TextStyle(color: Colors.orange, fontWeight: FontWeight.bold, fontSize: 10)),
                                ),
                              ],
                            ),
                          ),
                          const Divider(height: 1),
                          // Items Summary
                          Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              children: [
                                Row(
                                  children: [
                                    Text('${items.length} Items', style: const TextStyle(color: Colors.grey, fontSize: 12)),
                                    const Spacer(),
                                    Text('₹$total', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
                                  ],
                                ),
                                const SizedBox(height: 16),
                                SizedBox(
                                  width: double.infinity,
                                  child: ElevatedButton(
                                    onPressed: () => _generateBill(order),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: AppTheme.primary,
                                      foregroundColor: Colors.white,
                                      padding: const EdgeInsets.symmetric(vertical: 12),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                    ),
                                    child: const Text('GENERATE BILL & CLOSE', style: TextStyle(fontWeight: FontWeight.bold)),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
