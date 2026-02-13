import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../services/auth_service.dart';
import '../core/theme.dart';

final kdsOrdersProvider = StreamProvider.family<List<Map<String, dynamic>>, String>((ref, branchId) {
  return Supabase.instance.client
      .from('orders')
      .stream(primaryKey: ['id'])
      .eq('branch_id', branchId)
      .order('created_at', ascending: true)
      .asyncMap((orders) async {
        // Filter status in Dart since .filter isn't on stream builder
        final activeOrders = orders.where((o) => 
          ['pending', 'preparing', 'ready'].contains(o['status'].toString())
        ).toList();

        final List<Map<String, dynamic>> ordersWithItems = [];
        for (var order in activeOrders) {
          final items = await Supabase.instance.client
              .from('order_items')
              .select('*, menu_items(name)')
              .eq('order_id', order['id']);
          
          final Map<String, dynamic> o = Map.from(order);
          o['items'] = items;
          ordersWithItems.add(o);
        }
        return ordersWithItems;
      });
});

class KdsScreen extends ConsumerWidget {
  const KdsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ctx = ref.watch(contextProvider);
    
    if (ctx.branchId == null) {
      return Scaffold(body: Center(child: Text('Please select a branch first')));
    }

    final ordersAsync = ref.watch(kdsOrdersProvider(ctx.branchId!));

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text('KITCHEN KDS', style: AppTheme.lightTheme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900, fontSize: 16)),
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(LucideIcons.chevronLeft, color: AppTheme.secondary),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 16, top: 12, bottom: 12),
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: const Color(0xFF10B981).withOpacity(0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                const Icon(LucideIcons.radio, size: 14, color: Color(0xFF10B981)),
                const SizedBox(width: 6),
                Text('LIVE', style: TextStyle(color: Color(0xFF10B981), fontWeight: FontWeight.bold, fontSize: 10)),
              ],
            ),
          ),
        ],
      ),
      body: ordersAsync.when(
        data: (orders) {
          if (orders.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(LucideIcons.chefHat, size: 64, color: Colors.grey.shade300),
                  const SizedBox(height: 16),
                  Text('Kitchen is Clear', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.grey.shade400)),
                  Text('Waiting for new orders...', style: TextStyle(color: Colors.grey.shade400)),
                ],
              ),
            );
          }

          return GridView.builder(
            padding: const EdgeInsets.all(16),
            gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
              maxCrossAxisExtent: 400,
              mainAxisExtent: 350,
              crossAxisSpacing: 16,
              mainAxisSpacing: 16,
            ),
            itemCount: orders.length,
            itemBuilder: (context, index) {
              final order = orders[index];
              return _OrderCard(order: order);
            },
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, s) => Center(child: Text('KDS Error: $e')),
      ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  final Map<String, dynamic> order;

  const _OrderCard({required this.order});

  Color _getStatusColor(String status) {
    switch (status) {
      case 'pending': return Colors.amber;
      case 'preparing': return Colors.blue;
      case 'ready': return const Color(0xFF10B981);
      default: return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final items = order['items'] as List;
    final createdAt = DateTime.parse(order['created_at']);
    final minutesAgo = DateTime.now().difference(createdAt).inMinutes;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 4)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: _getStatusColor(order['status']).withOpacity(0.1),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('ORDER #${order['id'].toString().substring(0, 4)}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 12)),
                    Text('${minutesAgo}m ago', style: TextStyle(fontSize: 10, color: Colors.black.withOpacity(0.5))),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: _getStatusColor(order['status']),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    order['status'].toString().toUpperCase(),
                    style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
          ),
          
          // Items List
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: items.length,
              separatorBuilder: (c, i) => Divider(color: Colors.grey.shade100),
              itemBuilder: (context, index) {
                final item = items[index];
                return Row(
                  children: [
                    Text('${item['quantity']}x', style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primary)),
                    const SizedBox(width: 12),
                    Expanded(child: Text(item['menu_items']['name'] ?? 'Unknown Item', style: const TextStyle(fontWeight: FontWeight.w600))),
                  ],
                );
              },
            ),
          ),

          // Actions
          Padding(
            padding: const EdgeInsets.all(16),
            child: SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: () async {
                  String nextStatus = 'preparing';
                  if (order['status'] == 'preparing') nextStatus = 'ready';
                  if (order['status'] == 'ready') nextStatus = 'served';

                  await Supabase.instance.client
                      .from('orders')
                      .update({'status': nextStatus})
                      .eq('id', order['id']);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.secondary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: Text(
                  order['status'] == 'pending' ? 'START PREPARING' : 
                  order['status'] == 'preparing' ? 'MARK AS READY' : 'MARK AS SERVED',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                ),
              ),
            ),
          ),
        ],
      ),
    ).animate().fadeIn().scale(begin: const Offset(0.95, 0.95));
  }
}
