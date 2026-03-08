import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import 'auth_service.dart';

final posServiceProvider = Provider((ref) => PosService(Supabase.instance.client, ref));

class PosService {
  final SupabaseClient _client;
  final Ref _ref;
  final _uuid = const Uuid();

  PosService(this._client, this._ref);

  Future<Map<String, dynamic>> saveAndSendToKitchen({
    required List<Map<String, dynamic>> cart,
    required String? tableId,
    required String? customerId,
    required String? orderId,
    required String restaurantId,
    required String branchId,
    required String? orderType,
    String? notes,
  }) async {
    if (orderId == null) {
      // 1. Generate Order Number & Token Number in parallel
      final futures = await Future.wait([
        _client.rpc('next_doc_number', params: {
          'p_branch_id': branchId,
          'p_doc_type': 'order'
        }),
        _client.rpc('next_token_number', params: {
          'p_branch_id': branchId,
        }),
      ]);
      
      final nextNum = futures[0];
      final nextToken = futures[1];

      // 3. Create Order
      final orderRes = await _client
          .from('orders')
          .insert({
            'restaurant_id': restaurantId,
            'branch_id': branchId,
            'table_id': tableId,
            'customer_id': customerId,
            'status': 'pending',
            'order_number': nextNum,
            'token_number': nextToken,
            'source': 'pos',
            'is_open': true,
            'notes': notes,
            'payment_status': 'pending',
            'payment_method': 'cash',
            'order_type': orderType ?? (tableId == null ? 'takeaway' : 'dine_in'),
          })
          .select()
          .single();

      final batchId = _uuid.v4();
      final items = cart.map((i) => {
        'order_id': orderRes['id'],
        'item_id': i['id'],
        'quantity': i['qty'],
        'price': i['base_price'],
        'status': 'pending',
        'batch_id': batchId,
      }).toList();

      await _client.from('order_items').insert(items);
      return orderRes;
    } else {
      // Append to existing order
      if (cart.isNotEmpty) {
        final batchId = _uuid.v4();
        final items = cart.map((i) => {
          'order_id': orderId,
          'item_id': i['id'],
          'quantity': i['qty'],
          'price': i['base_price'],
          'status': 'pending',
          'batch_id': batchId,
        }).toList();

        await _client.from('order_items').insert(items);
      }

      // Update order type if changed
      if (orderType != null) {
        await _client.from('orders').update({'order_type': orderType}).eq('id', orderId);
      }
      
      // Fetch updated order
      final order = await _client.from('orders').select().eq('id', orderId).single();
      return order;
    }
  }

  Future<Map<String, dynamic>> settleOrder({
    required List<Map<String, dynamic>> cart,
    required List<Map<String, dynamic>> allItems,
    required String? orderId,
    required String? tableId,
    required String? customerId,
    required String restaurantId,
    required String branchId,
    required String? orderType,
    required List<Map<String, dynamic>> payments,
    double? totalAmount,
  }) async {
    // 1. Ensure order is saved/updated AND fetch bill number in parallel
    final futures = await Future.wait<dynamic>([
      saveAndSendToKitchen(
        cart: cart,
        tableId: tableId,
        customerId: customerId,
        orderId: orderId,
        restaurantId: restaurantId,
        branchId: branchId,
        orderType: orderType,
      ),
      _client.rpc('next_doc_number', params: {
        'p_branch_id': branchId,
        'p_doc_type': 'bill'
      }),
    ]);

    final order = futures[0] as Map<String, dynamic>;
    final billNumber = futures[1];

    // Calculate accurate tax breakdown directly from passed cache
    double total = 0;
    double tax = 0;
    for (var i in allItems) {
      double actPrice = (i['price'] as num?)?.toDouble() ?? (i['base_price'] as num?)?.toDouble() ?? 0.0;
      double actQty = (i['quantity'] as num?)?.toDouble() ?? (i['qty'] as num?)?.toDouble() ?? 1.0;
      double rate = (i['menu_items']?['gst_rate'] as num?)?.toDouble() ?? (i['gst_rate'] as num?)?.toDouble() ?? (i['tax_rate'] as num?)?.toDouble() ?? 0.0;
      
      double lineTotal = actPrice * actQty;
      total += lineTotal;
      tax += lineTotal - (lineTotal / (1 + (rate / 100)));
    }
    double subtotal = total - tax;

    final billRes = await _client.from('bills').insert({
      'restaurant_id': restaurantId,
      'branch_id': branchId,
      'order_id': order['id'],
      'bill_number': billNumber,
      'subtotal': subtotal,
      'discount': 0,
      'tax': tax,
      'total': total,
      'status': 'paid',
    }).select().single();

    // 3. Batch insert Payments & Update Order concurrently
    final primaryMethod = payments.isNotEmpty ? payments.first['mode'] : 'cash';
    final paymentsData = payments.map((p) => {
      'bill_id': billRes['id'],
      'mode': p['mode'],
      'amount': p['amount'],
    }).toList();

    await Future.wait([
      if (paymentsData.isNotEmpty) _client.from('payments').insert(paymentsData),
      _client.from('orders').update({
        'payment_status': 'paid',
        'payment_method': primaryMethod,
        'status': (order['status'] == 'pending') ? 'pending' : order['status'], 
      }).eq('id', order['id']),
    ]);

    return {
      'order': order,
      'bill': billRes,
      'total': total,
    };
  }
}
