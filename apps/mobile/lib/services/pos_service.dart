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
    String? notes,
  }) async {
    if (orderId == null) {
      // 1. Generate Order Number
      final nextNum = await _client.rpc('next_doc_number', params: {
        'p_branch_id': branchId,
        'p_doc_type': 'order'
      });

      // 2. Generate Token Number
      final nextToken = await _client.rpc('next_token_number', params: {
        'p_branch_id': branchId,
      });

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
            'order_type': tableId == null ? 'takeaway' : 'dine_in',
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
      
      // Fetch updated order
      final order = await _client.from('orders').select().eq('id', orderId).single();
      return order;
    }
  }

  Future<Map<String, dynamic>> settleOrder({
    required List<Map<String, dynamic>> cart,
    required String? orderId,
    required String? tableId,
    required String? customerId,
    required String restaurantId,
    required String branchId,
    required List<Map<String, dynamic>> payments,
    double? totalAmount,
  }) async {
    // 1. Ensure order is saved/updated first
    final order = await saveAndSendToKitchen(
      cart: cart,
      tableId: tableId,
      customerId: customerId,
      orderId: orderId,
      restaurantId: restaurantId,
      branchId: branchId,
    );

    // 2. Create Bill
    final billNumber = await _client.rpc('next_doc_number', params: {
      'p_branch_id': branchId,
      'p_doc_type': 'bill'
    });

    // Calculate subtotal from all items in this order
    final orderItemsRes = await _client.from('order_items').select('price, quantity').eq('order_id', order['id']);
    final orderItems = List<Map<String, dynamic>>.from(orderItemsRes);
    final total = orderItems.fold(0.0, (sum, i) => sum + (i['price'] * i['quantity']));

    final billRes = await _client.from('bills').insert({
      'restaurant_id': restaurantId,
      'branch_id': branchId,
      'order_id': order['id'],
      'bill_number': billNumber,
      'subtotal': total,
      'discount': 0,
      'tax': 0,
      'total': total,
      'status': 'paid',
    }).select().single();

    // 3. Add Payments
    final primaryMethod = payments.isNotEmpty ? payments.first['mode'] : 'cash';
    for (var p in payments) {
      await _client.from('payments').insert({
        'bill_id': billRes['id'],
        'mode': p['mode'],
        'amount': p['amount'],
      });
    }

    // 4. Update Order (Settle payment only, leave status/is_open for KDS to handle)
    await _client.from('orders').update({
      'payment_status': 'paid',
      'payment_method': primaryMethod,
    }).eq('id', order['id']);

    return {
      'order': order,
      'bill': billRes,
      'total': total,
    };
  }
}
