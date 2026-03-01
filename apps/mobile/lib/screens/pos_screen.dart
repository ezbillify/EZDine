import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:ezdine_pro/widgets/payment_modal.dart';
import '../services/auth_service.dart';
import '../services/audio_service.dart';
import 'package:permission_handler/permission_handler.dart';
import '../services/pos_service.dart';
import '../services/print_service.dart';
import '../services/pos_cache_service.dart';
import '../core/theme.dart';
import '../core/responsive.dart';
import '../widgets/numeric_keypad.dart';
import '../widgets/lazy_tab_view.dart';
import '../widgets/optimized_menu_grid.dart';

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
      .eq('is_active', true)
      .order('name');
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
  String? _activeTokenNumber;

  // Search State with debouncing
  final _searchController = TextEditingController();
  final _searchFocusNode = FocusNode();
  bool _isSearchActive = false;
  String _searchQuery = "";
  String _sortBy = "name";
  late final Debouncer _searchDebouncer;

  // Business Logic State
  String? _activeBillNumber;
  double _existingOrderTotal = 0;
  bool _isSaving = false;
  bool _isLoadingItems = false;
  bool _isQuickBill = true;
  String _orderType = 'dine_in';
  String? _activeOrderPaymentStatus;
  List<Map<String, dynamic>> _existingOrderItems = [];
  StreamSubscription? _ordersSubscription;
  RealtimeChannel? _menuChannel;
  final Set<String> _notifiedOrderIds = {};
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  bool _showSuccessOverlay = false;
  String _successMessage = "";
  bool get isMobile => Responsive.isMobile(context);
  
  // Performance optimizations
  final _cacheService = PosCacheService();
  final _addToCartThrottler = Throttler(); // Uses adaptive duration

  @override
  void initState() {
    super.initState();
    _searchDebouncer = Debouncer(); // Uses adaptive delay
    _searchFocusNode.addListener(() {
      setState(() => _isSearchActive = _searchFocusNode.hasFocus);
    });
    _setupOrderSubscription();
    _setupMenuRealtime();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _searchFocusNode.dispose();
    _searchDebouncer.dispose();
    _ordersSubscription?.cancel();
    _menuChannel?.unsubscribe();
    super.dispose();
  }

  void _setupMenuRealtime() {
    final ctx = ref.read(contextProvider);
    if (ctx.branchId == null) return;

    _menuChannel = Supabase.instance.client
        .channel('menu_updates')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'menu_items',
          callback: (payload) {
            if (mounted) {
              ref.invalidate(menuItemsProvider(ctx.branchId!));
            }
          },
        )
        .subscribe();
  }

  void _setupOrderSubscription() {
    final ctx = ref.read(contextProvider);
    if (ctx.branchId == null) return;

    _ordersSubscription = Supabase.instance.client
        .from('orders')
        .stream(primaryKey: ['id'])
        .eq('branch_id', ctx.branchId!)
        .listen((orders) {
          bool hasNew = false;
          for (var o in orders) {
            // Filter is_open on client side since stream only supports one eq filter in this version
            if (o['is_open'] != true) continue;
            
            if (!_notifiedOrderIds.contains(o['id'])) {
              _notifiedOrderIds.add(o['id']);
              hasNew = true;
            }
          }
          if (hasNew) {
            AudioService.instance.playOrderAlert();
            if (mounted && Responsive.isMobile(context)) {
               _scaffoldKey.currentState?.openDrawer();
            }
          }
        });
  }

  Future<void> _loadOrderItems(String orderId) async {
    // 1. Check Cache for "Instant" feel
    final cachedItems = _cacheService.getOrderItems(orderId);
    if (cachedItems != null) {
      setState(() {
        _existingOrderItems = cachedItems;
        _existingOrderTotal = _existingOrderItems.fold(0.0, (sum, i) => sum + ((i['price'] ?? 0.0) * (i['quantity'] ?? 0)));
        _isLoadingItems = false;
      });
      return;
    }

    setState(() => _isLoadingItems = true);

    try {
      final results = await Future.wait<dynamic>([
        Supabase.instance.client
            .from('order_items')
            .select('*, menu_items(name)')
            .eq('order_id', orderId),
        Supabase.instance.client
            .from('orders')
            .select('*, bills(*), tables(*), customers(*)')
            .eq('id', orderId)
            .single()
      ]);

      final List<Map<String, dynamic>> res = List<Map<String, dynamic>>.from(results[0] as List);
      final Map<String, dynamic> orderRes = results[1] as Map<String, dynamic>;

      if (mounted) {
        // Cache the results
        _cacheService.cacheOrderItems(orderId, res);
        _cacheService.cacheOrderDetails(orderId, orderRes);
        
        setState(() {
          _existingOrderItems = res;
          _existingOrderTotal = _existingOrderItems.fold(0.0, (sum, i) => sum + ((i['price'] ?? 0.0) * (i['quantity'] ?? 0)));
          _activeTokenNumber = orderRes['token_number']?.toString();
          _activeOrderNumber = orderRes['order_number']?.toString();
          _activeOrderPaymentStatus = orderRes['payment_status'];
          _selectedTable = orderRes['tables'];
          _selectedCustomer = orderRes['customers'];
          _orderType = orderRes['order_type'] ?? 'dine_in';
          
          final bills = orderRes['bills'] as List?;
          if (bills != null && bills.isNotEmpty) {
            _activeBillNumber = bills.first['bill_number'];
          } else {
            _activeBillNumber = null;
          }
          _isLoadingItems = false;
        });
      }
    } catch (e) {
      debugPrint('Load Order Items Error: $e');
      if (mounted) setState(() => _isLoadingItems = false);
    }
  }

  Future<void> _prefetchOrderItems(String orderId) async {
    // Check if already cached
    if (_cacheService.getOrderItems(orderId) != null) {
      return;
    }
    
    try {
      final res = await Supabase.instance.client
          .from('order_items')
          .select('*, menu_items(name)')
          .eq('order_id', orderId);
      
      final items = List<Map<String, dynamic>>.from(res);
      _cacheService.cacheOrderItems(orderId, items);
    } catch (_) {
      // Silent fail for background prefetch
    }
  }

  double get _total => _cart.fold(0, (sum, item) => sum + (item['base_price'] * item['qty']));

  void _addToCart(Map<String, dynamic> item) {
    if (!_addToCartThrottler.shouldExecute()) {
      return; // Prevent rapid taps
    }
    
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

  Future<void> _toggleStock(Map<String, dynamic> item) async {
    final ctx = ref.read(contextProvider);
    final nextStatus = !(item['is_available'] ?? true);
    
    try {
      await Supabase.instance.client
          .from('menu_items')
          .update({'is_available': nextStatus})
          .eq('id', item['id']);
      
      ref.invalidate(menuItemsProvider(ctx.branchId!));
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${item['name']} marked ${nextStatus ? 'Available' : 'Out of Stock'}'),
          backgroundColor: nextStatus ? Colors.green : Colors.red,
          duration: const Duration(seconds: 1),
        )
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  void _resetPos() {
    setState(() {
      _cart.clear();
      _existingOrderItems = [];
      _selectedTable = null;
      _selectedCustomer = null;
      _activeOrderId = null;
      _activeOrderNumber = null;
      _activeTokenNumber = null;
      _activeBillNumber = null;
      _existingOrderTotal = 0;
      _isQuickBill = true;
      _orderType = 'dine_in';
      _activeOrderPaymentStatus = null;
      _searchQuery = "";
      _searchController.clear();
    });
  }

  void _triggerSuccess(String message) {
    setState(() {
      _successMessage = message;
      _showSuccessOverlay = true;
    });
    
    // Auto-reset and hide after 1.5 seconds
    Future.delayed(const Duration(milliseconds: 1500), () {
      if (mounted) {
        setState(() => _showSuccessOverlay = false);
        _resetPos();
      }
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
        orderType: _orderType,
      );

      final printService = ref.read(printServiceProvider);
      final settings = await printService.getPrintingSettings(ctx.branchId!);

      // KOT Print
      if (settings != null) {
        await printService.printPremiumKot(
          restaurantName: ctx.restaurantName ?? "EZDine",
          branchName: ctx.branchName ?? "Branch",
          orderId: res['order_number'].toString(),
          items: _cart.map((i) => {
            'name': i['name'] ?? 'Item',
            'qty': i['qty'] ?? 1,
            'notes': i['notes'] ?? '',
          }).toList(),
          tableName: _selectedTable?['name'] ?? (_isQuickBill ? "QUICK BILL" : "--"),
          tokenNumber: res['token_number'].toString(),
          orderType: _orderType == 'dine_in' ? "DINE IN" : "TAKEAWAY",
          printerId: settings['printerIdKot'],
          paperWidth: settings['paperWidthKot'] ?? 58,
        );
      } else {
        debugPrint('No print settings found or network error');
      }

      AudioService.instance.playSuccess();

      if (mounted) {
        if (Responsive.isMobile(context)) {
          Navigator.of(context).popUntil((route) => route.isFirst);
        }
        _triggerSuccess(_activeOrderId == null ? 'ORDER CREATED!' : 'ORDER UPDATED!');
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  Future<void> _handlePayment({bool printReceipt = false}) async {
    final totalPayable = _total + _existingOrderTotal;
    if (totalPayable <= 0) return;

    if (isMobile) {
      showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        barrierColor: Colors.black.withValues(alpha: 0.5),
        elevation: 0,
        builder: (context) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom,
          ),
          child: PaymentModal(
            totalAmount: totalPayable,
            isLoading: _isSaving,
            isSheet: true,
            onConfirm: (payments) async {
              await _processSettlement(payments, printReceipt);
              if (mounted) Navigator.pop(context);
            },
          ),
        ),
      );
    } else {
      showDialog(
        context: context,
        barrierDismissible: !_isSaving,
        barrierColor: Colors.black.withValues(alpha: 0.5),
        builder: (context) => Dialog(
          backgroundColor: Colors.transparent,
          insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
          child: PaymentModal(
            totalAmount: totalPayable,
            isLoading: _isSaving,
            onConfirm: (payments) async {
              await _processSettlement(payments, printReceipt);
              if (mounted) Navigator.pop(context);
            },
          ),
        ),
      );
    }
  }

  Future<void> _processSettlement(List<Map<String, dynamic>> payments, bool printReceipt) async {
    if (!mounted) return;
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
        orderType: _orderType,
      );

      final printService = ref.read(printServiceProvider);
      final settings = await printService.getPrintingSettings(ctx.branchId!);

      if (settings != null && printReceipt) {
        final bool isConsolidated = settings['consolidatedPrinting'] ?? false;
        final int paperWidth = settings['paperWidthInvoice'] ?? 58; // Use configured paper width

        final items = [..._existingOrderItems, ..._cart].map((i) => {
          'name': i['name'] ?? i['menu_items']?['name'] ?? 'Item',
          'qty': i['qty'] ?? i['quantity'] ?? 1,
          'price': (i['price'] as num?)?.toDouble() ?? (i['base_price'] as num?)?.toDouble() ?? 0.0,
          'tax_rate': i['tax_rate'] ?? i['menu_items']?['gst_rate'] ?? i['gst_rate'] ?? 0.0,
          'hsn_code': i['hsn_code'] ?? i['menu_items']?['hsn_code'] ?? i['hsn'] ?? '',
        }).toList();

        if (isConsolidated) {
          // CONSOLIDATED MODE: Print Invoice → Cut → KOT sequence
          await printService.printConsolidatedSequence(
            restaurantName: ctx.restaurantName ?? "EZDine",
            branchName: ctx.branchName ?? "Branch",
            branchAddress: ctx.branchAddress,
            gstin: ctx.gstin,
            fssai: ctx.fssai,
            phone: ctx.branchPhone,
            tableName: _selectedTable?['name'] ?? (_isQuickBill ? "QUICK BILL" : "--"),
            orderId: res['order']['order_number']?.toString() ?? "0000",
            tokenNumber: res['order']['token_number']?.toString() ?? "00",
            customerName: _selectedCustomer?['name'] ?? 'Guest',
            orderType: _isQuickBill ? "Takeaway" : (_orderType == 'dine_in' ? "Dine In" : "Takeaway"),
            items: items,
            subtotal: (res['bill']?['subtotal'] as num?)?.toDouble() ?? (res['total'] as num?)?.toDouble() ?? 0.0,
            tax: (res['bill']?['tax'] as num?)?.toDouble() ?? 0.0,
            total: (res['total'] as num?)?.toDouble() ?? 0.0,
            paperWidth: paperWidth,
            printerId: settings['printerIdInvoice'] ?? settings['printerIdKot'],
          );
        } else {
          // SEPARATE MODE: Only print Invoice (no KOT)
          await printService.printPremiumInvoice(
            restaurantName: ctx.restaurantName ?? "EZDine",
            branchName: ctx.branchName ?? "Branch",
            branchAddress: ctx.branchAddress,
            phone: ctx.branchPhone,
            gstin: ctx.gstin,
            fssai: ctx.fssai,
            orderId: res['order']['order_number']?.toString() ?? "0000",
            date: DateTime.now().toString().split(' ')[0],
            time: TimeOfDay.now().format(context),
            items: items,
            subtotal: (res['bill']?['subtotal'] as num?)?.toDouble() ?? (res['total'] as num?)?.toDouble() ?? 0.0,
            tax: (res['bill']?['tax'] as num?)?.toDouble() ?? 0.0,
            total: (res['total'] as num?)?.toDouble() ?? 0.0,
            tableName: _selectedTable?['name'] ?? (_isQuickBill ? "QUICK BILL" : "--"),
            tokenNumber: res['order']['token_number']?.toString() ?? "00",
            customerName: _selectedCustomer?['name'] ?? 'Guest',
            orderType: _isQuickBill ? "Takeaway" : (_orderType == 'dine_in' ? "Dine In" : "Takeaway"),
            printerId: settings['printerIdInvoice'],
            paperWidth: paperWidth,
          );
        }
      }

      AudioService.instance.playSuccess();

      if (mounted) {
        // Show success message
        _triggerSuccess('PAYMENT COMPLETED!');
      }
    } catch (e) {
      debugPrint("Settle Error: $e");
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: Colors.red,
            content: Text('Payment Failed: $e'),
            action: SnackBarAction(
              label: 'RETRY',
              textColor: Colors.white,
              onPressed: () => _handlePayment(printReceipt: printReceipt),
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ctx = ref.watch(contextProvider);
    if (ctx.branchId == null) return const Scaffold(body: Center(child: Text('Select Branch')));

    final isMobile = Responsive.isMobile(context);
    final isTablet = Responsive.isTablet(context) || Responsive.isDesktop(context);

    return Stack(
      children: [
        Scaffold(
          key: _scaffoldKey,
          backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text('POS TERMINAL', style: TextStyle(fontSize: isMobile ? 16 : 20, fontWeight: FontWeight.w900)),
        leading: IconButton(icon: const Icon(LucideIcons.chevronLeft), onPressed: () {
           AudioService.instance.playClick();
           Navigator.pop(context);
        }),
        actions: [
          if (isMobile)
            Builder(
              builder: (context) => IconButton(
                icon: const Icon(LucideIcons.activity, color: Colors.blue),
                onPressed: () {
                  AudioService.instance.playClick();
                  Scaffold.of(context).openDrawer();
                },
              ),
            ),
          IconButton(
            icon: const Icon(LucideIcons.history, color: Colors.indigo),
            onPressed: () {
              AudioService.instance.playClick();
              _showOrderHistory(context);
            },
          ),
        ],
      ),
      drawer: isMobile ? Drawer(
        width: 280,
        child: SafeArea(child: _buildLiveOrdersSidebar(isDrawer: true)),
      ) : null,
      body: Row(
        children: [
          // Hide sidebar on mobile, used in drawer instead
          if (!isMobile) _buildLiveOrdersSidebar(),
          
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
      floatingActionButton: !isTablet && (_cart.isNotEmpty || _activeOrderId != null) 
          ? Container(
              height: 64,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: FloatingActionButton.extended(
                onPressed: () {
                  AudioService.instance.playClick();
                  _showMobileCart(context);
                },
                backgroundColor: Colors.black,
                foregroundColor: Colors.white,
                elevation: 8,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                icon: const Icon(LucideIcons.shoppingBag, size: 20),
                label: Text(
                  'VIEW CART • ₹${_total.toStringAsFixed(0)}', 
                  style: GoogleFonts.outfit(fontWeight: FontWeight.w900, letterSpacing: 1, fontSize: 13)
                ),
              ),
            )
          : null,
    ),
        if (_showSuccessOverlay)
          Positioned.fill(
            child: Container(
              color: Colors.black.withOpacity(0.85),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: const BoxDecoration(
                        color: Colors.green,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(LucideIcons.check, color: Colors.white, size: 54),
                    ),
                    const SizedBox(height: 24),
                    Text(
                      _successMessage,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 24,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1.5,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildMainArea() {
    final ctx = ref.watch(contextProvider);
    final categoriesAsync = ref.watch(menuCategoriesProvider(ctx.branchId!));
    final itemsAsync = ref.watch(menuItemsProvider(ctx.branchId!));
    final isMobile = Responsive.isMobile(context);

    return Column(
      children: [
        // Compact Context Header
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: EdgeInsets.fromLTRB(isMobile ? 12 : 24, 16, isMobile ? 12 : 24, 8),
          child: Row(
            children: [
              _SelectorButton(
                label: 'QUICK BILL',
                icon: LucideIcons.zap,
                isSelected: _isQuickBill,
                onTap: () {
                  AudioService.instance.playClick();
                  setState(() {
                    _isQuickBill = true;
                    _selectedTable = null;
                    _activeOrderId = null;
                    _orderType = 'dine_in';
                  });
                },
                color: Colors.orange,
              ),
              const SizedBox(width: 12),
              _SelectorButton(
                label: _selectedTable?['name'] ?? 'TABLE',
                icon: LucideIcons.armchair,
                isSelected: !_isQuickBill && _selectedTable != null,
                onTap: () => _showTableSheet(context),
              ),
              const SizedBox(width: 12),
              _SelectorButton(
                label: _selectedCustomer?['name'] ?? 'GUEST',
                icon: LucideIcons.user,
                isSelected: _selectedCustomer != null,
                onTap: () => _showCustomerSheet(context),
                color: Colors.green,
              ),
            ],
          ),
        ),

        // Dine-in / Takeaway Toggle (Compact)
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
          child: Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.grey.shade100),
            ),
            child: Row(
              children: [
                Expanded(
                  child: _OrderTypeToggle(
                    label: 'DINE IN',
                    icon: LucideIcons.armchair,
                    isActive: _orderType == 'dine_in',
                    onTap: () => setState(() => _orderType = 'dine_in'),
                    activeColor: Colors.blue.shade600,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _OrderTypeToggle(
                    label: 'TAKEAWAY',
                    icon: LucideIcons.shoppingBag,
                    isActive: _orderType == 'takeaway',
                    onTap: () => setState(() => _orderType = 'takeaway'),
                    activeColor: Colors.orange.shade600,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),

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
        const SizedBox(height: 16),

        // Search and Sort
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Row(
            children: [
              Expanded(
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  decoration: BoxDecoration(
                    color: _isSearchActive ? Colors.white : Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: _isSearchActive ? AppTheme.primary : Colors.grey.shade100,
                      width: _isSearchActive ? 2.5 : 1,
                    ),
                    boxShadow: _isSearchActive 
                      ? [BoxShadow(color: AppTheme.primary.withValues(alpha: 0.15), blurRadius: 15, offset: const Offset(0, 8), spreadRadius: 2)]
                      : [],
                  ),
                  child: TextField(
                    controller: _searchController,
                    focusNode: _searchFocusNode,
                    onChanged: (val) {
                      _searchDebouncer(() {
                        if (mounted) {
                          setState(() => _searchQuery = val.toLowerCase());
                        }
                      });
                    },
                    textInputAction: TextInputAction.search,
                    decoration: InputDecoration(
                      hintText: 'Search items...',
                      hintStyle: TextStyle(fontSize: 15, color: Colors.grey.shade400, fontWeight: FontWeight.w600),
                      border: InputBorder.none,
                      focusedBorder: InputBorder.none,
                      enabledBorder: InputBorder.none,
                      errorBorder: InputBorder.none,
                      disabledBorder: InputBorder.none,
                      prefixIcon: Icon(
                        LucideIcons.search, 
                        size: 20, 
                        color: _isSearchActive ? AppTheme.primary : Colors.grey
                      ),
                      suffixIcon: _searchQuery.isNotEmpty 
                        ? IconButton(
                            icon: const Icon(LucideIcons.xCircle, size: 18, color: Colors.grey),
                            onPressed: () {
                              _searchController.clear();
                              setState(() => _searchQuery = "");
                            },
                          )
                        : null,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              GestureDetector(
                onTap: _showSortModal,
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: Colors.grey.shade100),
                    boxShadow: AppTheme.premiumShadow,
                  ),
                  child: const Icon(LucideIcons.listFilter, size: 24, color: AppTheme.secondary),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Items
        Expanded(
          child: itemsAsync.when(
            data: (items) {
              final filtered = items.where((i) {
                final matchesCategory = _selectedCategoryId == null || i['category_id'] == _selectedCategoryId;
                final matchesSearch = i['name'].toString().toLowerCase().contains(_searchQuery);
                return matchesCategory && matchesSearch;
              }).toList();

              // Apply Sorting
              if (_sortBy == 'name') {
                filtered.sort((a, b) => a['name'].toString().compareTo(b['name'].toString()));
              } else if (_sortBy == 'price_asc') {
                filtered.sort((a, b) => (a['base_price'] as num).compareTo(b['base_price'] as num));
              } else if (_sortBy == 'price_desc') {
                filtered.sort((a, b) => (b['base_price'] as num).compareTo(a['base_price'] as num));
              }

              if (filtered.isEmpty) {
                return Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(LucideIcons.searchX, size: 64, color: Colors.grey.shade200),
                      const SizedBox(height: 16),
                      Text('NO ITEMS FOUND', style: TextStyle(fontWeight: FontWeight.w900, color: Colors.grey.shade300, fontSize: 14, letterSpacing: 2)),
                    ],
                  ),
                );
              }

              return OptimizedMenuGrid(
                items: filtered,
                crossAxisCount: Responsive.isMobile(context) ? 2 : (Responsive.isTablet(context) ? 3 : 4),
                childAspectRatio: 0.8,
                itemBuilder: (item) => _ProductCard(
                  item: item,
                  onAdd: () => _addToCart(item),
                  onToggle: () => _toggleStock(item),
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
           child: _isLoadingItems 
             ? const Center(child: CircularProgressIndicator()) 
             : _cart.isEmpty && _existingOrderItems.isEmpty
               ? Center(child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(LucideIcons.shoppingCart, size: 48, color: Colors.grey.shade200),
                    const SizedBox(height: 16),
                    Text('CART IS EMPTY', style: TextStyle(fontWeight: FontWeight.w900, color: Colors.grey.shade300, fontSize: 12, letterSpacing: 2)),
                  ],
                ))
              : ListView(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  children: [
                    if (_existingOrderItems.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          const Text('ALREADY ORDERED', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 10, color: Colors.grey, letterSpacing: 1.5)),
                          const SizedBox(width: 8),
                          Expanded(child: Divider(color: Colors.grey.shade100)),
                        ],
                      ),
                      const SizedBox(height: 16),
                      ..._existingOrderItems.map((item) => _ExistingItemTile(item: item)),
                      const SizedBox(height: 24),
                    ],
                    if (_cart.isNotEmpty) ...[
                      Row(
                        children: [
                          const Text('NEW ITEMS', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 10, color: AppTheme.primary, letterSpacing: 1.5)),
                          const SizedBox(width: 8),
                          Expanded(child: Divider(color: AppTheme.primary.withValues(alpha: 0.1))),
                        ],
                      ),
                      const SizedBox(height: 16),
                      ..._cart.asMap().entries.map((entry) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _CartItemTile(item: entry.value, onUpdate: _updateQty),
                      )),
                    ],
                  ],
                ),
        ),
        Container(
          padding: const EdgeInsets.all(32),
          decoration: BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: Colors.grey.shade100))),
          child: Column(
            children: [
              if (_activeOrderId != null) ...[
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('ORDER #$_activeOrderNumber', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: _activeOrderPaymentStatus == 'paid' ? Colors.green.withValues(alpha: 0.1) : Colors.orange.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            _activeOrderPaymentStatus?.toUpperCase() ?? 'PENDING',
                            style: TextStyle(
                              color: _activeOrderPaymentStatus == 'paid' ? Colors.green : Colors.orange,
                              fontWeight: FontWeight.w900,
                              fontSize: 10
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 16,
                      children: [
                        if (_activeTokenNumber != null) 
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade300), borderRadius: BorderRadius.circular(6)),
                            child: Text('TOKEN: $_activeTokenNumber', style: TextStyle(color: Colors.grey.shade600, fontSize: 11, fontWeight: FontWeight.w800)),
                          ),
                        if (_activeBillNumber != null) 
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade300), borderRadius: BorderRadius.circular(6)),
                            child: Text('BILL: $_activeBillNumber', style: TextStyle(color: Colors.grey.shade600, fontSize: 11, fontWeight: FontWeight.w800)),
                          ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 16),
              ],
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Total Amount', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey)),
                  Text('₹${(_total + _existingOrderTotal).toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 24)),
                ],
              ),
              const SizedBox(height: 24),
              if (_activeOrderPaymentStatus == 'paid') ...[
                Row(
                  children: [
                    Expanded(
                      child: SizedBox(
                        height: 54,
                        child: OutlinedButton(
                          onPressed: _resetPos,
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: Colors.green),
                            foregroundColor: Colors.green,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          ),
                          child: const Text('START NEW ORDER', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13, letterSpacing: 1)),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                const Center(child: Text("Order is settled. Create a new order to proceed.", style: TextStyle(color: Colors.grey, fontSize: 12))),
              ] else ...[
                Row(
                  children: [
                    Expanded(
                      child: SizedBox(
                        height: 60,
                        child: ElevatedButton(
                          onPressed: _isSaving || (_cart.isEmpty && _activeOrderId == null) ? null : _handleSaveAndSend,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: _activeOrderId == null ? Colors.indigo : Colors.orange.shade800,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                            elevation: 0,
                          ),
                          child: _isSaving 
                            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                            : Text(
                                _activeOrderId == null ? 'PLACE ORDER' : 'UPDATE ORDER', 
                                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14, letterSpacing: 1)
                              ),
                          ),
                        ),
                      ),
                    ],
                  ),
                const SizedBox(height: 12),
                if (isMobile) ...[ 
                  SizedBox(
                    height: 54,
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _isSaving || (_cart.isEmpty && _activeOrderId == null) ? null : () => _handlePayment(printReceipt: false),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF10B981),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        elevation: 0,
                      ),
                      child: const Text('TAKE PAYMENT & SEND', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13)),
                    ),
                  ),
                  const SizedBox(height: 8),
                  SizedBox(
                    height: 54,
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _isSaving || (_cart.isEmpty && _activeOrderId == null) ? null : () => _handlePayment(printReceipt: true),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFF59E0B),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        elevation: 0,
                      ),
                      child: const Text('TAKE PAYMENT & PRINT', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13)),
                    ),
                  ),
                ] else ...[
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
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildLiveOrdersSidebar({bool isDrawer = false}) {
    final ctx = ref.watch(contextProvider);
    if (ctx.branchId == null) return const SizedBox.shrink();

    // Combined stream for both Dine-In and QR orders
    return StreamBuilder(
      stream: Supabase.instance.client
          .from('orders')
          .stream(primaryKey: ['id'])
          .eq('branch_id', ctx.branchId!)
          .order('created_at', ascending: false),
      builder: (context, snapshot) {
        if (!snapshot.hasData) return const SizedBox.shrink();
        
        final allOrders = snapshot.data as List;
        
        // Background Pre-fetch items for orders not in cache
        for (var o in allOrders) {
          final id = o['id'];
          if (_cacheService.getOrderItems(id) == null && !_isLoadingItems) {
             // Fetch in background, don't await
             _prefetchOrderItems(id);
          }
        }

        final now = DateTime.now();
        final liveOrders = allOrders.where((o) {
          final isOpen = o['is_open'] == true;
          final isPaid = o['payment_status'] == 'paid';
          
          if (!isOpen) return false;
          
          // If paid, show for 30 seconds
          if (isPaid) {
            try {
              final updatedAt = DateTime.parse(o['updated_at']);
              return now.difference(updatedAt).inSeconds < 120;
            } catch (e) {
              return true; // Fallback
            }
          }
          
          // Always show unpaid/open orders
          return true;
        }).toList();

        return Container(
          width: isDrawer ? double.infinity : 84,
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: Colors.grey.shade100),
          ),
          child: Column(
            children: [
              const SizedBox(height: 16),
              const Icon(LucideIcons.activity, size: 20, color: Colors.blue),
              const SizedBox(height: 6),
              const Text('LIVE ORDERS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1.5, color: Colors.blue)),
              const SizedBox(height: 16),
              Expanded(
                child: ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  itemCount: liveOrders.length,
                  separatorBuilder: (c, i) => const SizedBox(height: 12),
                  itemBuilder: (c, i) {
                    final o = liveOrders[i];
                    final isPaid = o['payment_status'] == 'paid';
                    final isQr = o['source'] == 'qr' || o['source'] == 'online';
                    final isActive = _activeOrderId == o['id'];


                    final statusColor = isPaid ? Colors.green : (isQr ? Colors.orange : Colors.blue);
                    
                    Widget tokenTile = Container(
                      height: 72,
                      decoration: BoxDecoration(
                        color: isActive ? statusColor : (isPaid ? Colors.green.withValues(alpha: 0.1) : Colors.white),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: isActive ? statusColor : (isPaid ? Colors.green.withValues(alpha: 0.3) : Colors.grey.shade100),
                          width: isActive ? 2 : 1,
                        ),
                        boxShadow: isActive 
                          ? [BoxShadow(color: statusColor.withValues(alpha: 0.1), blurRadius: 12, offset: const Offset(0, 4))] 
                          : AppTheme.premiumShadow,
                      ),
                      child: Stack(
                        children: [
                          // Status Badge (Breathing Animation)
                          Positioned(
                            top: 8,
                            right: 8,
                            child: Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                color: statusColor,
                                shape: BoxShape.circle,
                              ),
                            )
                            .animate(onPlay: (controller) => controller.repeat(reverse: true))
                            .fade(duration: const Duration(milliseconds: 1000), begin: 0.3, end: 1.0)
                            .scale(duration: const Duration(milliseconds: 1000), begin: const Offset(0.8, 0.8), end: const Offset(1.2, 1.2)),
                          ),
                          Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      o['token_number']?.toString() ?? '??',
                                      style: TextStyle(
                                        fontWeight: FontWeight.w900,
                                        fontSize: 20,
                                        color: isActive ? Colors.white : (isPaid ? Colors.green.shade700 : Colors.grey.shade800),
                                        height: 1,
                                      ),
                                    ),
                                    if (isPaid)
                                      Padding(
                                        padding: const EdgeInsets.only(left: 2),
                                        child: Icon(LucideIcons.checkCircle2, size: 10, color: statusColor),
                                      ),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: statusColor.withValues(alpha: 0.08),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    isPaid ? 'PAID' : (isQr ? 'QR' : (o['order_type'] == 'takeaway' ? 'TK' : 'DN')),
                                    style: TextStyle(
                                      fontWeight: FontWeight.w900,
                                      fontSize: 8,
                                      color: statusColor,
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    );

                    // Subtle entry animation
                    tokenTile = tokenTile.animate().fadeIn(duration: const Duration(milliseconds: 300)).slideX(begin: -0.1, end: 0);

                    return GestureDetector(
                      onTap: () async {
                        AudioService.instance.playClick();
                        setState(() {
                          _activeOrderId = o['id'];
                          _activeOrderNumber = o['order_number'];
                          _selectedTable = null;
                          _isQuickBill = false;
                          _orderType = o['order_type'] ?? 'dine_in';
                          _activeOrderPaymentStatus = o['payment_status'];
                          _existingOrderTotal = 0;
                          _existingOrderItems = [];
                          _cart.clear();
                        });

                        if (isDrawer) {
                          Navigator.pop(context);
                          _showMobileCart(context);
                        }
                        await _loadOrderItems(o['id']);
                      },
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: tokenTile,
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 12),
              Padding(
                padding: const EdgeInsets.only(bottom: 20),
                child: isDrawer 
                ? Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('POWERED BY EZBILLIFY', 
                        style: GoogleFonts.outfit(fontSize: 8, fontWeight: FontWeight.w900, color: Colors.blueGrey.shade200, letterSpacing: 2)),
                      const SizedBox(height: 8),
                    ],
                  )
                : RotatedBox(
                    quarterTurns: 3,
                    child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'PRO-BILLING BY ',
                        style: GoogleFonts.outfit(
                          fontSize: 6,
                          fontWeight: FontWeight.w900,
                          color: Colors.blueGrey.shade200,
                          letterSpacing: 1,
                        ),
                      ),
                      Text(
                        'EZBILLIFY',
                        style: GoogleFonts.outfit(
                          fontSize: 8,
                          fontWeight: FontWeight.w900,
                          color: Colors.blueGrey.shade300,
                          letterSpacing: 1,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _showOrderHistory(BuildContext context) {
    final branchId = ref.read(contextProvider).branchId;
    if (branchId == null) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Error: No Branch ID found')));
      return;
    }

    showDialog(
      context: context,
      barrierDismissible: false,
      barrierColor: Colors.black.withValues(alpha: 0.5),
      builder: (dialogContext) => OrderHistoryDialog(
        branchId: branchId,
        onSelect: (o) {
          if (dialogContext.mounted) {
             Navigator.pop(dialogContext);
          }
          if (mounted) {
             _loadOrderFromHistory(o);
             if (Responsive.isMobile(context)) _showMobileCart(context);
          }
        },
      ),
    );
  }

  void _loadOrderFromHistory(Map<String, dynamic> o) {
      if (!mounted) return;
      setState(() {
        _activeOrderId = o['id'];
        _activeOrderNumber = o['order_number']?.toString();
        _activeTokenNumber = o['token_number']?.toString();
        _activeBillNumber = (o['bills'] is List && (o['bills'] as List).isNotEmpty)
            ? (o['bills'] as List)[0]['bill_number']?.toString()
            : null;
        _selectedTable = o['tables'];
        _selectedCustomer = o['customers'];
        _isQuickBill = o['tables'] == null;
        _orderType = o['order_type'] ?? 'dine_in';
        _activeOrderPaymentStatus = o['payment_status'];
        _existingOrderTotal = 0;
        _cart.clear();
      });
      _loadOrderItems(o['id']);
  }
  void _showMobileCart(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withValues(alpha: 0.5),
      elevation: 0,
      builder: (c) => _MobileCartSheet(
        cart: _cart,
        existingOrderItems: _existingOrderItems,
        isLoadingItems: _isLoadingItems,
        total: _total,
        existingOrderTotal: _existingOrderTotal,
        activeOrderId: _activeOrderId,
        activeOrderNumber: _activeOrderNumber,
        activeOrderPaymentStatus: _activeOrderPaymentStatus,
        activeTokenNumber: _activeTokenNumber,
        activeBillNumber: _activeBillNumber,
        isSaving: _isSaving,
        onUpdateQty: _updateQty,
        onClearCart: () => setState(() => _cart.clear()),
        onSaveAndSend: _handleSaveAndSend,
        onPayment: () => _handlePayment(printReceipt: false),
        onReset: _resetPos,
        isMobile: Responsive.isMobile(context),
      ),
    );
  }

  // Sheets & Active Orders logic remains same as original but polished in implementation below
  void _showTableSheet(BuildContext context) {
     showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withValues(alpha: 0.5),
      elevation: 0,
      builder: (c) => Material(
        color: Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
        clipBehavior: Clip.antiAlias,
        child: Container(
          padding: const EdgeInsets.all(32),
          decoration: const BoxDecoration(color: Colors.white),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('SELECT TABLE', style: GoogleFonts.outfit(fontWeight: FontWeight.w900, fontSize: 13, color: Colors.blueGrey.shade400, letterSpacing: 2)),
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
                          _orderType = 'dine_in';
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
      ),
    );
  }

  void _showCustomerSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withValues(alpha: 0.5),
      elevation: 0,
      builder: (c) => Material(
        color: Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
        clipBehavior: Clip.antiAlias,
        child: Container(
          decoration: const BoxDecoration(color: Colors.white),
          child: _CustomerSearchSheet(
            onSelect: (customer) {
              AudioService.instance.playClick();
              setState(() => _selectedCustomer = customer);
              Navigator.pop(context);
            },
          ),
        ),
      ),
    );
  }

  void _showSortModal() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withValues(alpha: 0.5),
      elevation: 0,
      builder: (context) => Material(
        color: Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
        clipBehavior: Clip.antiAlias,
        child: Container(
          padding: const EdgeInsets.all(32),
          decoration: const BoxDecoration(color: Colors.white),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('SORT BY', style: GoogleFonts.outfit(fontWeight: FontWeight.w900, fontSize: 12, letterSpacing: 2, color: Colors.grey)),
            const SizedBox(height: 24),
            _buildSortOption('name', 'Alphabetical (A-Z)', LucideIcons.filter),
            _buildSortOption('price_asc', 'Price: Low to High', LucideIcons.arrowUp),
            _buildSortOption('price_desc', 'Price: High to Low', LucideIcons.arrowDown),
          ],
        ),
      ),
      ),
    );
  }

  Widget _buildSortOption(String value, String label, IconData icon) {
    final isSelected = _sortBy == value;
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(icon, size: 20, color: isSelected ? AppTheme.primary : Colors.grey),
      title: Text(label, style: GoogleFonts.outfit(fontWeight: isSelected ? FontWeight.w900 : FontWeight.w600, color: isSelected ? AppTheme.primary : Colors.black)),
      trailing: isSelected ? const Icon(LucideIcons.checkCircle2, color: AppTheme.primary) : null,
      onTap: () {
        setState(() => _sortBy = value);
        Navigator.pop(context);
      },
    );
  }
}

class _SearchKeyboard extends StatelessWidget {
  final Function(String) onKeyPress;
  final VoidCallback onDelete;
  final VoidCallback onClose;

  const _SearchKeyboard({required this.onKeyPress, required this.onDelete, required this.onClose});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Colors.grey.shade200)),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, -4))],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('QUICK SEARCH KEYBOARD', style: TextStyle(fontWeight: FontWeight.w900, color: Colors.grey.shade400, fontSize: 10, letterSpacing: 1.5)),
              IconButton(onPressed: onClose, icon: const Icon(LucideIcons.chevronDown, size: 20)),
            ],
          ),
          const SizedBox(height: 8),
          _buildKeyRow(['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P']),
          _buildKeyRow(['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';']),
          _buildKeyRow(['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', 'DEL']),
          _buildKeyRow([' ']),
        ],
      ),
    ).animate().slideY(begin: 1.0, end: 0.0, duration: 300.ms, curve: Curves.easeOut);
  }

  Widget _buildKeyRow(List<String> keys) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: keys.map((k) => _buildKey(k)).toList(),
      ),
    );
  }

  Widget _buildKey(String key) {
    final bool isDel = key == 'DEL';
    final bool isSpace = key == ' ';

    return Expanded(
      flex: isSpace ? 5 : 1,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 3),
        child: InkWell(
          onTap: () {
            if (isDel) {
              onDelete();
            } else {
              onKeyPress(key);
            }
          },
          borderRadius: BorderRadius.circular(10),
          child: Container(
            height: 58,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: isDel ? Colors.red.shade50 : (isSpace ? Colors.grey.shade100 : Colors.white),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.grey.shade300, width: 1),
              boxShadow: [
                BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 2, offset: const Offset(0, 1))
              ],
            ),
            child: isDel 
              ? Icon(LucideIcons.delete, size: 20, color: Colors.red.shade400)
              : (isSpace ? const Icon(LucideIcons.space, size: 22, color: Colors.grey) : Text(key, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Color(0xFF1E293B)))),
          ),
        ),
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
    final isTablet = Responsive.isTablet(context);
    final isMobile = Responsive.isMobile(context);
    
    return GestureDetector(
      onTapDown: (_) => AudioService.instance.playClick(),
      onTap: onTap,
      child: Container(
        height: isTablet ? 54 : 58,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        decoration: BoxDecoration(
          color: isSelected ? color.withValues(alpha: 0.1) : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? color.withValues(alpha: 0.5) : Colors.grey.shade200,
            width: isSelected ? 2 : 1,
          ),
          boxShadow: isSelected ? [BoxShadow(color: color.withValues(alpha: 0.1), blurRadius: 10, offset: const Offset(0, 4))] : [],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 18, color: isSelected ? color : Colors.grey.shade600),
            const SizedBox(width: 10),
            Flexible(
              child: Text(
                label.toUpperCase(), 
                style: GoogleFonts.outfit(
                  fontWeight: FontWeight.w900, 
                  fontSize: 11, 
                  color: isSelected ? color : Colors.blueGrey.shade700, 
                  letterSpacing: 0.5
                ), 
                overflow: TextOverflow.ellipsis
              ),
            ),
            const SizedBox(width: 6),
            Icon(LucideIcons.chevronDown, size: 14, color: isSelected ? color : Colors.grey.shade400),
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
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        margin: const EdgeInsets.only(right: 10),
        padding: const EdgeInsets.symmetric(horizontal: 18),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.primary : Colors.white,
          borderRadius: BorderRadius.circular(100),
          border: Border.all(
            color: isSelected ? AppTheme.primary : Colors.grey.shade200,
            width: 1.5,
          ),
          boxShadow: isSelected 
            ? [BoxShadow(color: AppTheme.primary.withValues(alpha: 0.2), blurRadius: 12, offset: const Offset(0, 4))] 
            : [],
        ),
        child: Center(
          child: Text(
            label.toUpperCase(), 
            style: GoogleFonts.outfit(
              color: isSelected ? Colors.white : Colors.blueGrey.shade600, 
              fontWeight: FontWeight.w900, 
              fontSize: 10,
              letterSpacing: 1,
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
  final VoidCallback onToggle;

  const _ProductCard({required this.item, required this.onAdd, required this.onToggle});

  @override
  Widget build(BuildContext context) {
    final bool isAvailable = item['is_available'] ?? true;
    final isVeg = (item['is_veg'] == true);
    final isEgg = (item['is_egg'] == true);
    final dietaryColor = isVeg ? Colors.green : (isEgg ? Colors.orange : Colors.red);
    final dietaryIcon = isVeg ? LucideIcons.leaf : (isEgg ? LucideIcons.egg : LucideIcons.flame);
    final dietaryLabel = isVeg ? "VEG" : (isEgg ? "EGG" : "NON-VEG");

    return GestureDetector(
      onTap: isAvailable ? onAdd : null,
      child: AnimatedScale(
        duration: const Duration(milliseconds: 100),
        scale: isAvailable ? 1.0 : 0.98,
        child: Opacity(
          opacity: isAvailable ? 1.0 : 0.6,
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: Colors.grey.shade100, width: 1.5),
              boxShadow: isAvailable ? [
                BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 20, offset: const Offset(0, 10)),
              ] : [],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                      decoration: BoxDecoration(
                        color: dietaryColor.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Icon(dietaryIcon, size: 12, color: dietaryColor),
                    ),
                    GestureDetector(
                      onTap: onToggle,
                      child: Icon(
                        isAvailable ? LucideIcons.toggleRight : LucideIcons.toggleLeft,
                        size: 24,
                        color: isAvailable ? Colors.green : Colors.grey.shade300,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  (item['name'] ?? 'Item').toString().toUpperCase(),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.outfit(
                    fontWeight: FontWeight.w900,
                    fontSize: 13,
                    color: Colors.blueGrey.shade900,
                    height: 1.2,
                  ),
                ),
                const Spacer(),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '₹${(item['base_price'] as num).toStringAsFixed(0)}',
                      style: GoogleFonts.outfit(
                        fontWeight: FontWeight.w900,
                        fontSize: 18,
                        color: AppTheme.primary,
                        letterSpacing: -0.5,
                      ),
                    ),
                    if (isAvailable)
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: AppTheme.secondary,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(LucideIcons.plus, size: 14, color: Colors.white),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
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

class _ExistingItemTile extends StatelessWidget {
  final Map<String, dynamic> item;
  const _ExistingItemTile({required this.item});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade100),
      ),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: Colors.grey.shade50, borderRadius: BorderRadius.circular(10)),
            child: Text('${item['quantity']}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: Colors.grey)),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Text(item['menu_items']?['name'] ?? 'Item', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
          ),
          Text(
            '₹${(item['price'] * item['quantity']).toStringAsFixed(0)}', 
            style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: Colors.grey.shade400)
          ),
        ],
      ),
    );
  }
}

class OrderHistoryDialog extends StatefulWidget {
  final String branchId;
  final Function(Map<String, dynamic>) onSelect;

  const OrderHistoryDialog({super.key, required this.branchId, required this.onSelect});

  @override
  State<OrderHistoryDialog> createState() => _OrderHistoryDialogState();
}

class _OrderHistoryDialogState extends State<OrderHistoryDialog> {
  late Future<List<dynamic>> _ordersFuture;

  @override
  void initState() {
    super.initState();
    _ordersFuture = Supabase.instance.client
        .from('orders')
        .select('*, tables(*), customers(*), bills(*)')
        .eq('branch_id', widget.branchId)
        .order('created_at', ascending: false)
        .limit(50);
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Container(
        width: MediaQuery.of(context).size.width > 600 ? 500 : double.maxFinite,
        height: MediaQuery.of(context).size.height * 0.8,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
        ),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(24),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('ORDER HISTORY', style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1.2, fontSize: 16)),
                  IconButton(icon: const Icon(LucideIcons.x), onPressed: () => Navigator.pop(context)),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: FutureBuilder<List<dynamic>>(
                future: _ordersFuture,
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) return const Center(child: CircularProgressIndicator());
                  if (snapshot.hasError) return Center(child: Text("Error: ${snapshot.error}"));
                  
                  final orders = snapshot.data ?? [];
                  if (orders.isEmpty) return const Center(child: Text("No history found"));

                  return ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: orders.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final o = orders[index];
                      final isPaid = o['payment_status'] == 'paid';
                      final tokenNum = o['token_number']?.toString() ?? '?';
                      final orderNum = o['order_number']?.toString() ?? 'Unknown';
                      
                      return InkWell(
                        onTap: () => widget.onSelect(o),
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            border: Border.all(color: Colors.grey.shade200),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 50,
                                height: 50,
                                margin: const EdgeInsets.only(right: 16),
                                decoration: BoxDecoration(
                                  color: isPaid ? Colors.green.withOpacity(0.1) : Colors.orange.withOpacity(0.1),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: isPaid ? Colors.green.withOpacity(0.3) : Colors.orange.withOpacity(0.3)),
                                ),
                                child: Center(
                                  child: Text(
                                    tokenNum,
                                    style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: isPaid ? Colors.green : Colors.orange),
                                  ),
                                ),
                              ),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('Order #$orderNum', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                                    const SizedBox(height: 4),
                                    Text(
                                      (o['created_at'] as String).split('T')[0] + '  ' + (o['created_at'] as String).split('T')[1].substring(0, 5),
                                      style: TextStyle(color: Colors.grey.shade500, fontSize: 12, fontWeight: FontWeight.w500),
                                    ),
                                  ],
                                ),
                              ),
                              if (isPaid) 
                                const Icon(LucideIcons.checkCircle2, color: Colors.green)
                              else 
                                const Icon(LucideIcons.clock, color: Colors.orange),
                            ],
                          ),
                        ),
                      );
                    },
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
  bool _activePhoneField = true;
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
            GestureDetector(
              onTap: () => setState(() => _activePhoneField = true),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: _activePhoneField ? AppTheme.primary : Colors.grey.shade300, width: _activePhoneField ? 2 : 1),
                ),
                child: Row(
                  children: [
                    Icon(LucideIcons.phone, size: 20, color: _activePhoneField ? AppTheme.primary : Colors.grey),
                    const SizedBox(width: 12),
                    Text(
                      _controller.text.isEmpty ? 'Enter Phone Number' : _controller.text,
                      style: TextStyle(
                        color: _controller.text.isEmpty ? Colors.grey.shade400 : Colors.black,
                        fontSize: 16,
                        fontWeight: _controller.text.isEmpty ? FontWeight.normal : FontWeight.bold,
                      ),
                    ),
                    const Spacer(),
                    if (_isLoading) const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
                    if (!_isLoading && _activePhoneField) const Icon(LucideIcons.edit3, size: 16, color: AppTheme.primary),
                  ],
                ),
              ),
            ),
            if (_activePhoneField) ...[
              const SizedBox(height: 16),
              NumericKeypad(
                onKeyPress: (key) {
                  setState(() {
                    if (key != '.') { // Phone numbers don't have dots
                      _controller.text += key;
                      _onSearchChanged(_controller.text);
                    }
                  });
                },
                onDelete: () {
                  if (_controller.text.isNotEmpty) {
                    setState(() {
                      _controller.text = _controller.text.substring(0, _controller.text.length - 1);
                      _onSearchChanged(_controller.text);
                    });
                  }
                },
                onClear: () {
                  setState(() {
                    _controller.clear();
                    _onSearchChanged('');
                  });
                },
              ),
            ],
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

class _ActiveOrdersSheet extends ConsumerStatefulWidget {
  final Function(Map<String, dynamic>) onSelect;
  const _ActiveOrdersSheet({required this.onSelect});

  @override
  ConsumerState<_ActiveOrdersSheet> createState() => _ActiveOrdersSheetState();
}

class _ActiveOrdersSheetState extends ConsumerState<_ActiveOrdersSheet> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<List<Map<String, dynamic>>> _fetchLiveOrders() async {
    final ctx = ref.read(contextProvider);
    final res = await Supabase.instance.client
        .from('orders')
        .select('*, tables(*), customers(*)')
        .eq('branch_id', ctx.branchId!)
        .eq('is_open', true)
        .eq('status', 'pending')
        .order('created_at', ascending: false);
    return List<Map<String, dynamic>>.from(res);
  }

  Future<List<Map<String, dynamic>>> _fetchUnpaidOrders() async {
    final ctx = ref.read(contextProvider);
    final res = await Supabase.instance.client
        .from('orders')
        .select('*, tables(*), customers(*)')
        .eq('branch_id', ctx.branchId!)
        .eq('is_open', true)
        .neq('payment_status', 'paid')
        .inFilter('source', ['qr', 'table', 'online'])
        .order('created_at', ascending: false);
    return List<Map<String, dynamic>>.from(res);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      decoration: const BoxDecoration(
        color: Color(0xFFF8FAFC),
        borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
      ),
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
          TabBar(
            controller: _tabController,
            labelColor: Colors.black,
            unselectedLabelColor: Colors.grey,
            indicatorColor: AppTheme.primary,
            indicatorPadding: const EdgeInsets.symmetric(horizontal: 32),
            tabs: const [
              Tab(child: Text('LIVE DINE-IN', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12, letterSpacing: 1))),
              Tab(child: Text('UNPAID / QR', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12, letterSpacing: 1))),
            ],
          ),
          Expanded(
            child: LazyTabView(
              controller: _tabController,
              tabBuilders: [
                () => _OrderList(fetch: _fetchLiveOrders, onSelect: widget.onSelect),
                () => _OrderList(fetch: _fetchUnpaidOrders, onSelect: widget.onSelect),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _OrderList extends StatelessWidget {
  final Future<List<Map<String, dynamic>>> Function() fetch;
  final Function(Map<String, dynamic>) onSelect;

  const _OrderList({required this.fetch, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
      future: fetch(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
        final orders = snapshot.data as List;
        if (orders.isEmpty) return const Center(child: Text('No orders found'));

        return ListView.separated(
          padding: const EdgeInsets.all(24),
          itemCount: orders.length,
          separatorBuilder: (c, i) => const SizedBox(height: 16),
          itemBuilder: (c, i) {
            final o = orders[i];
            final isQr = o['source'] == 'qr' || o['source'] == 'online';
            return GestureDetector(
              onTap: () => onSelect(o),
              child: Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: AppTheme.premiumShadow,
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: (isQr ? Colors.orange : Colors.green).withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Icon(
                        isQr ? LucideIcons.smartphone : LucideIcons.armchair,
                        color: isQr ? Colors.orange : Colors.green,
                      ),
                    ),
                    const SizedBox(width: 20),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            o['tables']?['name'] ?? o['order_type']?.toString().toUpperCase() ?? 'POS ORDER',
                            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
                          ),
                          Text(
                            'Order #${o['order_number']} • ${o['source']?.toString().toUpperCase()}',
                            style: TextStyle(color: Colors.grey.shade400, fontSize: 11, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text('₹${o['total_amount']}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
                        Text(
                          o['payment_status']?.toUpperCase() ?? 'PENDING',
                          style: TextStyle(
                            color: o['payment_status'] == 'paid' ? Colors.green : Colors.red,
                            fontSize: 9,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}

class _MobileCartSheet extends StatefulWidget {
  final List<Map<String, dynamic>> cart;
  final List<Map<String, dynamic>> existingOrderItems;
  final bool isLoadingItems;
  final double total;
  final double existingOrderTotal;
  final String? activeOrderId;
  final String? activeOrderNumber;
  final String? activeOrderPaymentStatus;
  final String? activeTokenNumber;
  final String? activeBillNumber;
  final bool isSaving;
  final Function(String, int) onUpdateQty;
  final VoidCallback onClearCart;
  final VoidCallback onSaveAndSend;
  final VoidCallback onPayment;
  final VoidCallback onReset;
  final bool isMobile;

  const _MobileCartSheet({
    required this.cart,
    required this.existingOrderItems,
    required this.isLoadingItems,
    required this.total,
    required this.existingOrderTotal,
    required this.activeOrderId,
    required this.activeOrderNumber,
    required this.activeOrderPaymentStatus,
    required this.activeTokenNumber,
    required this.activeBillNumber,
    required this.isSaving,
    required this.onUpdateQty,
    required this.onClearCart,
    required this.onSaveAndSend,
    required this.onPayment,
    required this.onReset,
    required this.isMobile,
  });

  @override
  State<_MobileCartSheet> createState() => _MobileCartSheetState();
}

class _MobileCartSheetState extends State<_MobileCartSheet> {
  late List<Map<String, dynamic>> _localCart;

  @override
  void initState() {
    super.initState();
    _localCart = List.from(widget.cart);
  }

  // Calculate total from local cart
  double get _localTotal {
    return _localCart.fold<double>(0, (sum, item) {
      final price = (item['base_price'] ?? 0).toDouble();
      final qty = (item['qty'] ?? 0).toInt();
      return sum + (price * qty);
    });
  }

  void _updateLocalQty(String id, int delta) {
    setState(() {
      final index = _localCart.indexWhere((i) => i['id'] == id);
      if (index >= 0) {
        _localCart[index]['qty'] += delta;
        if (_localCart[index]['qty'] <= 0) {
          _localCart.removeAt(index);
        }
      }
    });
    // Also update parent
    widget.onUpdateQty(id, delta);
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
      clipBehavior: Clip.antiAlias,
      child: Container(
        height: MediaQuery.of(context).size.height * 0.8,
        decoration: const BoxDecoration(color: Colors.white),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(32),
              child: Row(
                children: [
                  const Icon(LucideIcons.shoppingBag, color: AppTheme.secondary),
                  const SizedBox(width: 12),
                  const Text('YOUR CART', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                  const Spacer(),
                  _localCart.isNotEmpty 
                    ? IconButton(
                        icon: const Icon(LucideIcons.trash2, size: 18, color: Colors.grey), 
                        onPressed: () {
                          setState(() => _localCart.clear());
                          widget.onClearCart();
                        }
                      )
                    : const SizedBox.shrink(),
                ],
              ),
            ),
            Expanded(
              child: widget.isLoadingItems 
                ? const Center(child: CircularProgressIndicator()) 
                : _localCart.isEmpty && widget.existingOrderItems.isEmpty
                  ? Center(child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(LucideIcons.shoppingCart, size: 48, color: Colors.grey.shade200),
                        const SizedBox(height: 16),
                        Text('CART IS EMPTY', style: TextStyle(fontWeight: FontWeight.w900, color: Colors.grey.shade300, fontSize: 12, letterSpacing: 2)),
                      ],
                    ))
                  : ListView(
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      children: [
                        if (widget.existingOrderItems.isNotEmpty) ...[
                          const SizedBox(height: 16),
                          Row(
                            children: [
                              const Text('ALREADY ORDERED', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 10, color: Colors.grey, letterSpacing: 1.5)),
                              const SizedBox(width: 8),
                              Expanded(child: Divider(color: Colors.grey.shade100)),
                            ],
                          ),
                          const SizedBox(height: 16),
                          ...widget.existingOrderItems.map((item) => _ExistingItemTile(item: item)),
                          const SizedBox(height: 24),
                        ],
                        if (_localCart.isNotEmpty) ...[
                          Row(
                            children: [
                              const Text('NEW ITEMS', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 10, color: AppTheme.primary, letterSpacing: 1.5)),
                              const SizedBox(width: 8),
                              Expanded(child: Divider(color: AppTheme.primary.withValues(alpha: 0.1))),
                            ],
                          ),
                          const SizedBox(height: 16),
                          ..._localCart.asMap().entries.map((entry) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: _CartItemTile(item: entry.value, onUpdate: _updateLocalQty),
                          )),
                        ],
                      ],
                    ),
            ),
            Container(
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: Colors.grey.shade100))),
              child: Column(
                children: [
                  if (widget.activeOrderId != null) ...[
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('ORDER #${widget.activeOrderNumber}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: widget.activeOrderPaymentStatus == 'paid' ? Colors.green.withValues(alpha: 0.1) : Colors.orange.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                widget.activeOrderPaymentStatus?.toUpperCase() ?? 'PENDING',
                                style: TextStyle(
                                  color: widget.activeOrderPaymentStatus == 'paid' ? Colors.green : Colors.orange,
                                  fontWeight: FontWeight.w900,
                                  fontSize: 10
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 16,
                          children: [
                            if (widget.activeTokenNumber != null) 
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade300), borderRadius: BorderRadius.circular(6)),
                                child: Text('TOKEN: ${widget.activeTokenNumber}', style: TextStyle(color: Colors.grey.shade600, fontSize: 11, fontWeight: FontWeight.w800)),
                              ),
                            if (widget.activeBillNumber != null) 
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade300), borderRadius: BorderRadius.circular(6)),
                                child: Text('BILL: ${widget.activeBillNumber}', style: TextStyle(color: Colors.grey.shade600, fontSize: 11, fontWeight: FontWeight.w800)),
                              ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                  ],
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Total Amount', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey)),
                      Text('₹${(_localTotal + widget.existingOrderTotal).toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 24)),
                    ],
                  ),
                  const SizedBox(height: 24),
                  if (widget.activeOrderPaymentStatus == 'paid') ...[
                    Row(
                      children: [
                        Expanded(
                          child: SizedBox(
                            height: 54,
                            child: OutlinedButton(
                              onPressed: widget.onReset,
                              style: OutlinedButton.styleFrom(
                                side: const BorderSide(color: Colors.green),
                                foregroundColor: Colors.green,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                              ),
                              child: const Text('START NEW ORDER', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13, letterSpacing: 1)),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    const Center(child: Text("Order is settled. Create a new order to proceed.", style: TextStyle(color: Colors.grey, fontSize: 12))),
                  ] else ...[
                    Row(
                      children: [
                        Expanded(
                          child: SizedBox(
                            height: 60,
                            child: ElevatedButton(
                              onPressed: widget.isSaving || (_localCart.isEmpty && widget.activeOrderId == null) ? null : widget.onSaveAndSend,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: widget.activeOrderId == null ? Colors.indigo : Colors.orange.shade800,
                                foregroundColor: Colors.white,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                                elevation: 0,
                              ),
                              child: widget.isSaving 
                                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                                : Text(
                                    widget.activeOrderId == null ? 'PLACE ORDER' : 'UPDATE ORDER', 
                                    style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14, letterSpacing: 1)
                                  ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    if (widget.isMobile) ...[ 
                      SizedBox(
                        height: 54,
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: widget.isSaving || (_localCart.isEmpty && widget.activeOrderId == null) ? null : widget.onPayment,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF10B981),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                            elevation: 0,
                          ),
                          child: widget.isSaving 
                            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                            : const Text('SETTLE & PAY', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14, letterSpacing: 1)),
                        ),
                      ),
                    ],
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OrderTypeToggle extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool isActive;
  final VoidCallback onTap;
  final Color activeColor;

  const _OrderTypeToggle({
    required this.label,
    required this.icon,
    required this.isActive,
    required this.onTap,
    required this.activeColor,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: isActive ? activeColor.withValues(alpha: 0.1) : Colors.transparent,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 16, color: isActive ? activeColor : Colors.grey),
            const SizedBox(width: 8),
            Text(
              label,
              style: TextStyle(
                fontWeight: FontWeight.w900,
                fontSize: 11,
                color: isActive ? activeColor : Colors.grey,
                letterSpacing: 1,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
