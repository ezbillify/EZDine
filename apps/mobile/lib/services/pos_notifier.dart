import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'pos_service.dart';
import 'pos_cache_service.dart';
import 'audio_service.dart';

class PosState {
  final List<Map<String, dynamic>> cart;
  final List<Map<String, dynamic>> existingOrderItems;
  final String? activeOrderId;
  final String? activeOrderNumber;
  final String? activeTokenNumber;
  final String? activeBillNumber;
  final String? activeOrderPaymentStatus;
  final Map<String, dynamic>? selectedTable;
  final Map<String, dynamic>? selectedCustomer;
  final String orderType;
  final bool isQuickBill;
  final bool isLoadingItems;
  final bool isSaving;
  final String? lastError;

  PosState({
    this.cart = const [],
    this.existingOrderItems = const [],
    this.activeOrderId,
    this.activeOrderNumber,
    this.activeTokenNumber,
    this.activeBillNumber,
    this.activeOrderPaymentStatus,
    this.selectedTable,
    this.selectedCustomer,
    this.orderType = 'dine_in',
    this.isQuickBill = true,
    this.isLoadingItems = false,
    this.isSaving = false,
    this.lastError,
  });

  double get cartTotal => cart.fold(0.0, (sum, i) => sum + ((i['base_price'] as num).toDouble() * (i['qty'] as num).toDouble()));
  double get existingTotal => existingOrderItems.fold(0.0, (sum, i) => sum + ((i['price'] as num).toDouble() * (i['quantity'] as num).toDouble()));
  double get totalPayable => cartTotal + existingTotal;

  PosState copyWith({
    List<Map<String, dynamic>>? cart,
    List<Map<String, dynamic>>? existingOrderItems,
    String? activeOrderId,
    String? activeOrderNumber,
    String? activeTokenNumber,
    String? activeBillNumber,
    String? activeOrderPaymentStatus,
    Map<String, dynamic>? selectedTable,
    Map<String, dynamic>? selectedCustomer,
    String? orderType,
    bool? isQuickBill,
    bool? isLoadingItems,
    bool? isSaving,
    String? lastError,
    bool clearActiveOrder = false,
    bool clearSelectedTable = false,
    bool clearSelectedCustomer = false,
  }) {
    return PosState(
      cart: cart ?? this.cart,
      existingOrderItems: existingOrderItems ?? this.existingOrderItems,
      activeOrderId: clearActiveOrder ? null : (activeOrderId ?? this.activeOrderId),
      activeOrderNumber: clearActiveOrder ? null : (activeOrderNumber ?? this.activeOrderNumber),
      activeTokenNumber: clearActiveOrder ? null : (activeTokenNumber ?? this.activeTokenNumber),
      activeBillNumber: clearActiveOrder ? null : (activeBillNumber ?? this.activeBillNumber),
      activeOrderPaymentStatus: clearActiveOrder ? null : (activeOrderPaymentStatus ?? this.activeOrderPaymentStatus),
      selectedTable: clearSelectedTable ? null : (selectedTable ?? this.selectedTable),
      selectedCustomer: clearSelectedCustomer ? null : (selectedCustomer ?? this.selectedCustomer),
      orderType: orderType ?? this.orderType,
      isQuickBill: isQuickBill ?? this.isQuickBill,
      isLoadingItems: isLoadingItems ?? this.isLoadingItems,
      isSaving: isSaving ?? this.isSaving,
      lastError: lastError,
    );
  }
}

class PosNotifier extends StateNotifier<PosState> {
  final PosService _service;
  final PosCacheService _cache = PosCacheService();

  PosNotifier(this._service) : super(PosState());

  void addToCart(Map<String, dynamic> item) {
    AudioService.instance.playClick();
    final index = state.cart.indexWhere((i) => i['id'] == item['id']);
    List<Map<String, dynamic>> newCart = List.from(state.cart);
    if (index >= 0) {
      newCart[index] = {...newCart[index], 'qty': newCart[index]['qty'] + 1};
    } else {
      newCart.add({...item, 'qty': 1});
    }
    state = state.copyWith(cart: newCart);
  }

  void updateQty(String id, int delta) {
    AudioService.instance.playClick();
    List<Map<String, dynamic>> newCart = List.from(state.cart);
    final index = newCart.indexWhere((i) => i['id'] == id);
    if (index >= 0) {
      newCart[index] = {...newCart[index], 'qty': newCart[index]['qty'] + delta};
      if (newCart[index]['qty'] <= 0) {
        newCart.removeAt(index);
      }
      state = state.copyWith(cart: newCart);
    }
  }

  void clearCart() {
    state = state.copyWith(cart: []);
  }

  void setSelectedTable(Map<String, dynamic>? table) {
    state = state.copyWith(
      selectedTable: table,
      isQuickBill: table == null,
      activeOrderId: table == null ? null : state.activeOrderId,
      clearActiveOrder: table == null,
    );
  }

  void setSelectedCustomer(Map<String, dynamic>? customer) {
    state = state.copyWith(selectedCustomer: customer);
  }

  void setOrderType(String type) {
    state = state.copyWith(orderType: type);
  }

  void setQuickBill() {
    state = state.copyWith(
      isQuickBill: true,
      selectedTable: null,
      activeOrderId: null,
      orderType: 'dine_in',
      clearActiveOrder: true,
      clearSelectedTable: true,
    );
  }

  void setSaving(bool saving) {
    state = state.copyWith(isSaving: saving);
  }

  void setLoading(bool loading) {
    state = state.copyWith(isLoadingItems: loading);
  }

  Future<void> loadOrder(String orderId) async {
    final cachedItems = _cache.getOrderItems(orderId);
    final cachedDetails = _cache.getOrderDetails(orderId);

    if (cachedItems != null && cachedDetails != null) {
      state = state.copyWith(
        activeOrderId: orderId,
        existingOrderItems: cachedItems,
        activeTokenNumber: cachedDetails['token_number']?.toString(),
        activeOrderNumber: cachedDetails['order_number']?.toString(),
        activeOrderPaymentStatus: cachedDetails['payment_status'],
        selectedTable: cachedDetails['tables'],
        selectedCustomer: cachedDetails['customers'],
        orderType: cachedDetails['order_type'] ?? 'dine_in',
        isQuickBill: cachedDetails['tables'] == null,
        activeBillNumber: (cachedDetails['bills'] is List && (cachedDetails['bills'] as List).isNotEmpty)
            ? cachedDetails['bills'][0]['bill_number']?.toString()
            : null,
        cart: [],
        isLoadingItems: false,
      );
      return;
    }

    state = state.copyWith(
      activeOrderId: orderId,
      isLoadingItems: true,
      existingOrderItems: cachedItems ?? [],
      cart: [],
    );

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

      final items = List<Map<String, dynamic>>.from(results[0] as List);
      final details = results[1] as Map<String, dynamic>;

      _cache.cacheOrderItems(orderId, items);
      _cache.cacheOrderDetails(orderId, details);

      state = state.copyWith(
        existingOrderItems: items,
        activeTokenNumber: details['token_number']?.toString(),
        activeOrderNumber: details['order_number']?.toString(),
        activeOrderPaymentStatus: details['payment_status'],
        selectedTable: details['tables'],
        selectedCustomer: details['customers'],
        orderType: details['order_type'] ?? 'dine_in',
        isQuickBill: details['tables'] == null,
        activeBillNumber: (details['bills'] is List && (details['bills'] as List).isNotEmpty)
            ? details['bills'][0]['bill_number']?.toString()
            : null,
        isLoadingItems: false,
      );
    } catch (e) {
      state = state.copyWith(isLoadingItems: false, lastError: e.toString());
    }
  }

  void reset() {
    state = PosState();
  }
}

final posStateProvider = StateNotifierProvider<PosNotifier, PosState>((ref) {
  return PosNotifier(ref.watch(posServiceProvider));
});
