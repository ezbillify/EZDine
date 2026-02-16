import 'package:flutter/material.dart';
import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:ezdine_pro/widgets/payment_modal.dart';
import '../services/auth_service.dart';
import '../services/audio_service.dart';
import '../services/pos_service.dart';
import '../core/theme.dart';
import '../core/responsive.dart';

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
  String? _activeOrderId;
  String? _activeOrderNumber;
  double _existingOrderTotal = 0;
  bool _isSaving = false;
  bool _isQuickBill = true;

  double get _total => _cart.fold(0, (sum, item) => sum + (item['base_price'] * item['qty']));

  void _addToCart(Map<String, dynamic> item) {
    AudioService.instance.playClick();
    setState(() {
      final existingIndex = _cart.indexWhere((i) => i['id'] == item['id']);
      if (existingIndex >= 0) {
        _cart[existingIndex]['qty']++;
      } else {
        _cart.add({...item, 'qty': 1});
      }
    });
  }

  void _updateQty(String id, int delta) {
    AudioService.instance.playClick();
    setState(() {
      final index = _cart.indexWhere((i) => i['id'] == id);
      if (index >= 0) {
        _cart[index]['qty'] += delta;
        if (_cart[index]['qty'] <= 0) {
          _cart.removeAt(index);
        }
      }
    });
  }

  void _resetPos() {
    setState(() {
      _cart.clear();
      _selectedTable = null;
      _selectedCustomer = null;
      _activeOrderId = null;
      _activeOrderNumber = null;
      _existingOrderTotal = 0;
      _isQuickBill = true;
    });
  }

  Future<void> _handleSaveAndSend() async {
    if (_cart.isEmpty && _activeOrderId == null) return;
    
    setState(() => _isSaving = true);
    final ctx = ref.read(contextProvider);
    final posService = ref.read(posServiceProvider);

    try {
      final res = await posService.saveAndSendToKitchen(
        cart: _cart,
        tableId: _selectedTable?['id'],
        customerId: _selectedCustomer?['id'],
        orderId: _activeOrderId,
        restaurantId: ctx.restaurantId!,
        branchId: ctx.branchId!,
      );

      // KOT Simulation
      debugPrint('--- SIMULATING KOT PRINT ---');
      debugPrint('Order: #${res['order_number']} | Token: ${res['token_number']}');
      debugPrint('Items: ${_cart.map((e) => "${e['qty']}x ${e['name']}").join(", ")}');

      AudioService.instance.playSuccess();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_activeOrderId == null ? 'Order Created!' : 'Order Updated!'))
        );
        _resetPos();
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      setState(() => _isSaving = false);
    }
  }

  Future<void> _handlePayment({bool printReceipt = false}) async {
    final totalPayable = _total + _existingOrderTotal;
    if (totalPayable <= 0) return;

    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (context) => PaymentModal(
        totalAmount: totalPayable,
        onConfirm: (payments) => _processSettlement(payments, printReceipt),
      ),
    );
  }

  Future<void> _processSettlement(List<Map<String, dynamic>> payments, bool printReceipt) async {
    setState(() => _isSaving = true);
    final ctx = ref.read(contextProvider);
    final posService = ref.read(posServiceProvider);

    try {
      final hasNewItems = _cart.isNotEmpty;
      final res = await posService.settleOrder(
        cart: _cart,
        orderId: _activeOrderId,
        tableId: _selectedTable?['id'],
        customerId: _selectedCustomer?['id'],
        restaurantId: ctx.restaurantId!,
        branchId: ctx.branchId!,
        payments: payments,
      );

      // Logic Parity: KOT Print if new items were added
      if (hasNewItems) {
        debugPrint('--- SIMULATING KOT PRINT ---');
        debugPrint('Order: #${res['order']['order_number']} | Token: ${res['order']['token_number']}');
        debugPrint('Items: ${_cart.map((e) => "${e['qty']}x ${e['name']}").join(", ")}');
      }

      if (printReceipt) {
        debugPrint('--- SIMULATING BILL PRINT ---');
        debugPrint('Bill: #${res['bill']['bill_number']} | Total: ₹${res['total']}');
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Bill #${res['bill']['bill_number']} Printed (₹${res['total']})'),
              backgroundColor: Colors.orange.shade800,
            )
          );
        }
      }

      AudioService.instance.playSuccess();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Payment Completed & Order Settled!')));
        _resetPos();
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ctx = ref.watch(contextProvider);
    if (ctx.branchId == null) return const Scaffold(body: Center(child: Text('Select Branch')));

    final isTablet = Responsive.isTablet(context) || Responsive.isDesktop(context);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('POS TERMINAL'),
        leading: IconButton(icon: const Icon(LucideIcons.chevronLeft), onPressed: () {
           AudioService.instance.playClick();
           Navigator.pop(context);
        }),
        actions: [
          IconButton(icon: const Icon(LucideIcons.receipt), onPressed: () {
            AudioService.instance.playClick();
            _showActiveOrders(context);
          }),
          const SizedBox(width: 8),
        ],
      ),
      body: Row(
        children: [
          Expanded(
            flex: isTablet ? 7 : 1,
            child: _buildMainArea(),
          ),
          if (isTablet)
            Container(
              width: 380,
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border.all(color: Colors.grey.shade100),
                boxShadow: AppTheme.premiumShadow,
              ),
              child: _buildCartArea(),
            ),
        ],
      ),
      floatingActionButton: !isTablet && _cart.isNotEmpty 
          ? FloatingActionButton.extended(
              onPressed: () {
                AudioService.instance.playClick();
                _showMobileCart(context);
              },
              backgroundColor: AppTheme.secondary,
              extendedPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
              icon: const Icon(LucideIcons.shoppingBag, color: Colors.white, size: 22),
              label: Text(
                'VIEW CART (₹${_total.toStringAsFixed(0)})', 
                style: const TextStyle(fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: 1, fontSize: 13)
              ),
            ).animate().scale()
          : null,
    );
  }

  Widget _buildMainArea() {
    final ctx = ref.watch(contextProvider);
    final categoriesAsync = ref.watch(menuCategoriesProvider(ctx.branchId!));
    final itemsAsync = ref.watch(menuItemsProvider(ctx.branchId!));

    return Column(
      children: [
        // Context Header
        Padding(
          padding: const EdgeInsets.all(24),
          child: Row(
            children: [
              Expanded(
                flex: 3,
                child: _SelectorButton(
                  label: 'QUICK BILL',
                  icon: LucideIcons.zap,
                  isSelected: _isQuickBill,
                  onTap: () {
                    AudioService.instance.playClick();
                    setState(() {
                      _isQuickBill = true;
                      _selectedTable = null;
                      _activeOrderId = null;
                    });
                  },
                  color: Colors.orange,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 4,
                child: _SelectorButton(
                  label: _selectedTable?['name'] ?? 'TABLE',
                  icon: LucideIcons.armchair,
                  isSelected: !_isQuickBill && _selectedTable != null,
                  onTap: () => _showTableSheet(context),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 4,
                child: _SelectorButton(
                  label: _selectedCustomer?['name'] ?? 'GUEST',
                  icon: LucideIcons.user,
                  isSelected: _selectedCustomer != null,
                  onTap: () => _showCustomerSheet(context),
                  color: Colors.green,
                ),
              ),
            ],
          ),
        ),

        // Categories
        categoriesAsync.when(
          data: (cats) => Container(
            height: 48,
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                _CategoryChip(
                  label: 'All Items',
                  isSelected: _selectedCategoryId == null,
                  onTap: () {
                    AudioService.instance.playClick();
                    setState(() => _selectedCategoryId = null);
                  },
                ),
                ...cats.map((c) => _CategoryChip(
                  label: c['name'],
                  isSelected: _selectedCategoryId == c['id'],
                  onTap: () {
                    AudioService.instance.playClick();
                    setState(() => _selectedCategoryId = c['id']);
                  },
                )),
              ],
            ),
          ),
          loading: () => const SizedBox(height: 48),
          error: (e, s) => const SizedBox(height: 48),
        ),

        // Items
        Expanded(
          child: itemsAsync.when(
            data: (items) {
              final filtered = _selectedCategoryId == null 
                ? items 
                : items.where((i) => i['category_id'] == _selectedCategoryId).toList();

              return GridView.builder(
                padding: const EdgeInsets.all(24),
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: Responsive.isMobile(context) ? 2 : 3,
                  mainAxisSpacing: 20,
                  crossAxisSpacing: 20,
                  childAspectRatio: 0.85,
                ),
                itemCount: filtered.length,
                itemBuilder: (context, index) => _ProductCard(
                  item: filtered[index],
                  onAdd: () => _addToCart(filtered[index]),
                ),
              );
            },
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, s) => Center(child: Text('POS Error: $e')),
          ),
        ),
      ],
    );
  }

  Widget _buildCartArea() {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(32),
          child: Row(
            children: [
              const Icon(LucideIcons.shoppingBag, color: AppTheme.secondary),
              const SizedBox(width: 12),
              const Text('YOUR CART', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
              const Spacer(),
              _cart.isNotEmpty 
                ? IconButton(icon: const Icon(LucideIcons.trash2, size: 18, color: Colors.grey), onPressed: () => setState(() => _cart.clear()))
                : const SizedBox.shrink(),
            ],
          ),
        ),
        Expanded(
          child: _cart.isEmpty 
              ? Center(child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(LucideIcons.shoppingCart, size: 48, color: Colors.grey.shade200),
                    const SizedBox(height: 16),
                    Text('CART IS EMPTY', style: TextStyle(fontWeight: FontWeight.w900, color: Colors.grey.shade300, fontSize: 12, letterSpacing: 2)),
                  ],
                ))
              : ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  itemCount: _cart.length,
                  separatorBuilder: (c, i) => const SizedBox(height: 12),
                  itemBuilder: (c, i) => _CartItemTile(item: _cart[i], onUpdate: _updateQty),
                ),
        ),
        Container(
          padding: const EdgeInsets.all(32),
          decoration: BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: Colors.grey.shade100))),
          child: Column(
            children: [
              if (_activeOrderId != null) ...[
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Active Order ($_activeOrderNumber)', style: const TextStyle(color: Colors.grey)),
                    const Text('DUE', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 10, color: Colors.grey)),
                  ],
                ),
                const SizedBox(height: 4),
              ],
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Total Amount', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey)),
                  Text('₹${(_total + _existingOrderTotal).toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 24)),
                ],
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: SizedBox(
                      height: 54,
                      child: OutlinedButton(
                        onPressed: _isSaving || (_cart.isEmpty && _activeOrderId == null) ? null : _handleSaveAndSend,
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: Colors.indigo),
                          foregroundColor: Colors.indigo,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        ),
                        child: Text(_activeOrderId == null ? 'PLACE ORDER' : 'UPDATE ORDER', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13, letterSpacing: 1)),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: SizedBox(
                      height: 60,
                      child: ElevatedButton(
                        onPressed: _isSaving || (_cart.isEmpty && _activeOrderId == null) ? null : () => _handlePayment(printReceipt: false),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF10B981),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          elevation: 0,
                        ),
                        child: const Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text('TAKE PAYMENT', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
                            Text('& SEND', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 1)),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: SizedBox(
                      height: 60,
                      child: ElevatedButton(
                        onPressed: _isSaving || (_cart.isEmpty && _activeOrderId == null) ? null : () => _handlePayment(printReceipt: true),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFF59E0B),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          elevation: 0,
                        ),
                        child: const Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text('TAKE PAYMENT', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
                            Text('& PRINT', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 1)),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  void _showMobileCart(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(32))),
      builder: (c) => Container(
        height: MediaQuery.of(context).size.height * 0.8,
        child: _buildCartArea(),
      ),
    );
  }

  // Sheets & Active Orders logic remains same as original but polished in implementation below
  void _showTableSheet(BuildContext context) {
     showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(32))),
      builder: (c) => Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('SELECT TABLE', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: Colors.grey, letterSpacing: 2)),
            const SizedBox(height: 24),
            Expanded(
              child: ref.watch(tablesProvider(ref.read(contextProvider).branchId!)).when(
                data: (tables) => GridView.builder(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 3, crossAxisSpacing: 16, mainAxisSpacing: 16),
                  itemCount: tables.length,
                  itemBuilder: (context, index) {
                    final table = tables[index];
                    final isSelected = _selectedTable?['id'] == table['id'];
                    return GestureDetector(
                      onTap: () {
                        AudioService.instance.playClick();
                        setState(() {
                          _selectedTable = table;
                          _isQuickBill = false;
                          _activeOrderId = null;
                        });
                        Navigator.pop(context);
                      },
                      child: Container(
                        decoration: BoxDecoration(
                          color: isSelected ? AppTheme.primary : Colors.white,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: Colors.grey.shade100),
                        ),
                        child: Center(child: Text(table['name'], style: TextStyle(fontWeight: FontWeight.w900, color: isSelected ? Colors.white : AppTheme.secondary))),
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
      ),
    );
  }

  void _showCustomerSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(32))),
      builder: (c) => _CustomerSearchSheet(
        onSelect: (customer) {
          AudioService.instance.playClick();
          setState(() => _selectedCustomer = customer);
          Navigator.pop(context);
        },
      ),
    );
  }

  void _showActiveOrders(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ActiveOrdersSheet(
        onSelect: (order) {
          setState(() {
            _activeOrderId = order['id'];
            _activeOrderNumber = order['order_number'];
            _existingOrderTotal = (order['total_amount'] as num).toDouble();
            _selectedTable = order['tables'];
            _selectedCustomer = order['customers'];
            _isQuickBill = false;
          });
          Navigator.pop(context);
        },
      ),
    );
  }
}

class _SelectorButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool isSelected;
  final VoidCallback onTap;
  final Color color;

  const _SelectorButton({required this.label, required this.icon, required this.isSelected, required this.onTap, this.color = AppTheme.primary});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => AudioService.instance.playClick(),
      onTap: onTap,
      child: Container(
        height: 64,
        padding: const EdgeInsets.symmetric(horizontal: 24),
        decoration: BoxDecoration(
          color: isSelected ? color.withOpacity(0.08) : Colors.white,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: isSelected ? color : Colors.grey.shade50),
          boxShadow: isSelected ? null : AppTheme.premiumShadow,
        ),
        child: Row(
          children: [
            Icon(icon, size: 20, color: isSelected ? color : Colors.grey),
            const SizedBox(width: 12),
            Expanded(child: Text(label.toUpperCase(), style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: isSelected ? color : AppTheme.secondary, letterSpacing: 1), overflow: TextOverflow.ellipsis)),
            Icon(LucideIcons.chevronDown, size: 16, color: isSelected ? color : Colors.grey.shade300),
          ],
        ),
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
          color: isSelected ? AppTheme.primary : const Color(0xFFE3E3E8),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Center(
          child: Text(
            label.toUpperCase(), 
            style: TextStyle(
              color: isSelected ? Colors.white : Colors.black.withOpacity(0.6), 
              fontWeight: FontWeight.w700, 
              fontSize: 11,
              letterSpacing: 0.5
            )
          )
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
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: Colors.black.withOpacity(0.04)),
          boxShadow: AppTheme.premiumShadow,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: (item['is_veg'] ?? true ? Colors.green : Colors.red).withOpacity(0.08), borderRadius: BorderRadius.circular(14)),
              child: Icon(item['is_veg'] ?? true ? LucideIcons.leaf : LucideIcons.flame, size: 16, color: item['is_veg'] ?? true ? Colors.green : Colors.red),
            ),
            const Spacer(),
            Text(item['name'], style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14, height: 1.1), maxLines: 2),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('₹${item['base_price']}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: const BoxDecoration(color: AppTheme.secondary, shape: BoxShape.circle),
                  child: const Icon(LucideIcons.plus, color: Colors.white, size: 16),
                ),
              ],
            ),
          ],
        ),
      ).animate().fadeIn().scale(begin: const Offset(0.95, 0.95)),
    );
  }
}

class _CartItemTile extends StatelessWidget {
  final Map<String, dynamic> item;
  final Function(String, int) onUpdate;

  const _CartItemTile({required this.item, required this.onUpdate});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.grey.shade100),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item['name'], style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13, height: 1)),
                const SizedBox(height: 4),
                Text('₹${item['base_price']}', style: TextStyle(color: Colors.grey.shade500, fontSize: 11, fontWeight: FontWeight.bold)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.grey.shade100)),
            child: Row(
              children: [
                _QtyBtn(icon: LucideIcons.minus, onTap: () => onUpdate(item['id'], -1)),
                Container(
                  width: 40,
                  alignment: Alignment.center,
                  child: Text('${item['qty']}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                ),
                _QtyBtn(icon: LucideIcons.plus, onTap: () => onUpdate(item['id'], 1)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _QtyBtn extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  const _QtyBtn({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 48,
        height: 48,
        decoration: BoxDecoration(
          color: Colors.grey.shade50, 
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.shade100),
        ),
        child: Icon(icon, size: 20, color: AppTheme.secondary),
      ),
    );
  }
}

// Keeping the CustomerSearch and ActiveOrders classes with minor UI polish to match theme
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
    try {
      final res = await Supabase.instance.client.from('customers').select().ilike('phone', '%$query%').limit(5);
      if (mounted) setState(() => _results = List<Map<String, dynamic>>.from(res));
    } catch(e) { print('S: $e'); } finally { if (mounted) setState(() => _isLoading = false); }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        padding: const EdgeInsets.all(32),
        height: 500,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('CUSTOMER IDENTITY', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: Colors.grey, letterSpacing: 2)),
            const SizedBox(height: 24),
            TextField(
              controller: _controller,
              keyboardType: TextInputType.phone,
              onChanged: _onSearchChanged,
              decoration: InputDecoration(
                labelText: 'Mobile Number',
                prefixIcon: const Icon(LucideIcons.phone, size: 20),
                suffixIcon: _isLoading ? const Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator(strokeWidth: 2)) : null,
              ),
            ),
            const SizedBox(height: 24),
            Expanded(
              child: _results.isEmpty 
                ? const Center(child: Text('Start typing phone number...'))
                : ListView.builder(
                    itemCount: _results.length,
                    itemBuilder: (context, index) {
                      final c = _results[index];
                      return ListTile(
                        onTap: () => widget.onSelect(c),
                        leading: const CircleAvatar(backgroundColor: Color(0xFFF1F5F9), child: Icon(LucideIcons.user, size: 18, color: AppTheme.secondary)),
                        title: Text(c['name'], style: const TextStyle(fontWeight: FontWeight.bold)),
                        subtitle: Text(c['phone']),
                        trailing: const Icon(LucideIcons.chevronRight, size: 16),
                      );
                    }
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActiveOrdersSheet extends ConsumerWidget {
  final Function(Map<String, dynamic>) onSelect;
  const _ActiveOrdersSheet({required this.onSelect});
  
  Future<List<Map<String, dynamic>>> _fetch(WidgetRef ref) async {
    final ctx = ref.read(contextProvider);
    final res = await Supabase.instance.client
      .from('orders')
      .select('*, tables(*), customers(*)')
      .eq('branch_id', ctx.branchId!)
      .neq('status', 'served')
      .order('created_at', ascending: false);
    return List<Map<String, dynamic>>.from(res);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      decoration: const BoxDecoration(color: Color(0xFFF8FAFC), borderRadius: BorderRadius.vertical(top: Radius.circular(32))),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(32),
            child: Row(
              children: [
                const Icon(LucideIcons.receipt, color: AppTheme.secondary),
                const SizedBox(width: 12),
                const Text('LIVE ORDERS', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
                const Spacer(),
                IconButton(icon: const Icon(LucideIcons.x), onPressed: () => Navigator.pop(context)),
              ],
            ),
          ),
          Expanded(
            child: FutureBuilder(
              future: _fetch(ref),
              builder: (context, snapshot) {
                if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
                final orders = snapshot.data as List;
                if (orders.isEmpty) return const Center(child: Text('No active orders'));

                return ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  itemCount: orders.length,
                  separatorBuilder: (c, i) => const SizedBox(height: 16),
                  itemBuilder: (c, i) {
                    final o = orders[i];
                    return GestureDetector(
                      onTap: () => onSelect(o),
                      child: Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), boxShadow: AppTheme.premiumShadow),
                        child: Row(
                          children: [
                            Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: const Color(0xFF10B981).withOpacity(0.08), borderRadius: BorderRadius.circular(16)), child: const Icon(LucideIcons.armchair, color: Color(0xFF10B981))),
                            const SizedBox(width: 20),
                            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(o['tables']?['name'] ?? 'QUICK BILL', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                              Text('Order #${o['order_number']}', style: TextStyle(color: Colors.grey.shade400, fontSize: 12, fontWeight: FontWeight.bold)),
                            ])),
                            Text('₹${o['total_amount']}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
                          ],
                        ),
                      ),
                    );
                  }
                );
              }
            )
          )
        ],
      ),
    );
  }
}
