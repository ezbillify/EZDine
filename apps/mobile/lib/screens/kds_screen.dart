import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../services/auth_service.dart';
import '../services/audio_service.dart';
import '../core/theme.dart';

class KdsScreen extends ConsumerStatefulWidget {
  const KdsScreen({super.key});

  @override
  ConsumerState<KdsScreen> createState() => _KdsScreenState();
}

class _KdsScreenState extends ConsumerState<KdsScreen> {
  List<Map<String, dynamic>> _orders = [];
  bool _loading = true;
  RealtimeChannel? _channel;

  @override
  void initState() {
    super.initState();
    Future.delayed(Duration.zero, _setupRealtime);
  }

  @override
  void dispose() {
    _channel?.unsubscribe();
    super.dispose();
  }

  Future<void> _loadOrders() async {
    final ctx = ref.read(contextProvider);
    if (ctx.branchId == null) return;

    try {
      final res = await Supabase.instance.client
          .from('orders')
          .select('*, tables(name), order_items(*, menu_items(name))')
          .eq('branch_id', ctx.branchId!)
          .inFilter('status', ['pending', 'preparing', 'ready'])
          .order('created_at', ascending: true);

      if (mounted) {
        setState(() {
          _orders = List<Map<String, dynamic>>.from(res);
          _loading = false;
        });
      }
    } catch (e) {
      print('KDS Load Error: $e');
    }
  }

  void _setupRealtime() {
    _loadOrders();
    final ctx = ref.read(contextProvider);
    if (ctx.branchId == null) return;

    _channel = Supabase.instance.client
        .channel('kds_realtime')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'orders',
          callback: (payload) {
            if (payload.eventType == PostgresChangeEvent.insert) {
              AudioService.instance.playOrderAlert();
            }
            _loadOrders();
          },
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'order_items',
          callback: (payload) => _loadOrders(),
        )
        .subscribe();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));

    // Flatten into Batch Tickets just like web
    final List<Map<String, dynamic>> batchTickets = [];
    for (var order in _orders) {
      final items = order['order_items'] as List;
      final batches = items.map((i) => i['batch_id']).toSet();
      
      if (batches.isEmpty || (batches.length == 1 && batches.first == null)) {
         batchTickets.add({...order, 'batch_id': 'legacy'});
      } else {
        for (var bid in batches) {
          if (bid == null) continue;
          final batchItems = items.where((i) => i['batch_id'] == bid).toList();
          // Only show if batch has unserved items
          if (batchItems.any((i) => i['status'] != 'served')) {
            batchTickets.add({
              ...order,
              'batch_id': bid,
              'items': batchItems,
            });
          }
        }
      }
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('KITCHEN KDS', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
        backgroundColor: Colors.white,
        leading: IconButton(
          icon: const Icon(LucideIcons.chevronLeft),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          IconButton(onPressed: _loadOrders, icon: const Icon(LucideIcons.refreshCw, size: 18)),
          const SizedBox(width: 8),
        ],
      ),
      body: batchTickets.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(LucideIcons.chefHat, size: 64, color: Colors.grey.shade200),
                  const SizedBox(height: 16),
                  const Text('KITCHEN CLEAR', style: TextStyle(fontWeight: FontWeight.w900, color: Colors.grey, letterSpacing: 2)),
                ],
              ),
            )
          : GridView.builder(
              padding: const EdgeInsets.all(24),
              gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                maxCrossAxisExtent: 400,
                mainAxisExtent: 380,
                crossAxisSpacing: 24,
                mainAxisSpacing: 24,
              ),
              itemCount: batchTickets.length,
              itemBuilder: (c, i) => _KdsBatchCard(ticket: batchTickets[i], onUpdate: _loadOrders),
            ),
    );
  }
}

class _KdsBatchCard extends StatelessWidget {
  final Map<String, dynamic> ticket;
  final VoidCallback onUpdate;

  const _KdsBatchCard({required this.ticket, required this.onUpdate});

  @override
  Widget build(BuildContext context) {
    final items = ticket['items'] ?? ticket['order_items'] as List;
    final createdAt = DateTime.parse(ticket['created_at']);
    final mins = DateTime.now().difference(createdAt).inMinutes;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: AppTheme.premiumShadow,
        border: Border.all(color: Colors.black.withOpacity(0.03)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Status Bar
          Container(
            height: 4,
            width: double.infinity,
            decoration: BoxDecoration(
              color: _getStatusColor(ticket['status']),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            ),
          ),
          
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(ticket['tables']?['name'] ?? 'QUICK BILL', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 20, letterSpacing: -0.5)),
                          Text('ROUND: ${ticket['batch_id'].toString().substring(0, 4).toUpperCase()}', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.grey.shade500, letterSpacing: 0.2)),
                        ],
                      ),
                    ),
                    _buildTimer(mins),
                  ],
                ),
                const SizedBox(height: 16),
                const Divider(height: 1, thickness: 0.5),
                const SizedBox(height: 16),
                SizedBox(
                  height: 160,
                  child: ListView.separated(
                    padding: EdgeInsets.zero,
                    itemCount: items.length,
                    separatorBuilder: (c, i) => const SizedBox(height: 8),
                    itemBuilder: (c, i) {
                      final item = items[i];
                      return Container(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(
                          children: [
                            Container(
                              width: 32,
                              height: 32,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(color: AppTheme.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
                              child: Text('${item['quantity']}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: AppTheme.primary)),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                item['menu_items']?['name'] ?? 'Item', 
                                style: TextStyle(
                                  fontWeight: FontWeight.w600, 
                                  fontSize: 16,
                                  color: item['status'] == 'served' ? Colors.grey.shade300 : AppTheme.secondary,
                                  decoration: item['status'] == 'served' ? TextDecoration.lineThrough : null,
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
          const Spacer(),
          Padding(
            padding: const EdgeInsets.all(20),
            child: SizedBox(
              width: double.infinity,
              height: 64,
              child: ElevatedButton(
                onPressed: () async {
                  AudioService.instance.playClick();
                  String nextStatus = 'preparing';
                  if (ticket['status'] == 'pending') nextStatus = 'preparing';
                  else if (ticket['status'] == 'preparing') nextStatus = 'ready';
                  else if (ticket['status'] == 'ready') nextStatus = 'served';

                  await Supabase.instance.client
                      .from('order_items')
                      .update({'status': nextStatus})
                      .eq('order_id', ticket['id'])
                      .eq('batch_id', ticket['batch_id']);

                  if (nextStatus == 'served') {
                    // Check if all items in this order are now served
                    final remaining = await Supabase.instance.client
                        .from('order_items')
                        .select('id')
                        .eq('order_id', ticket['id'])
                        .neq('status', 'served');
                    
                    if (remaining == null || (remaining as List).isEmpty) {
                      await Supabase.instance.client
                          .from('orders')
                          .update({
                            'status': 'served',
                            'is_open': false,
                          })
                          .eq('id', ticket['id']);
                    }
                  } else {
                    await Supabase.instance.client
                        .from('orders')
                        .update({'status': nextStatus})
                        .eq('id', ticket['id']);
                  }
                  
                  onUpdate();
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primary,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
                ),
                child: Text(_getActionLabel(ticket['status'])),
              ),
            ),
          ),
        ],
      ),
    ).animate().fadeIn().scale(begin: const Offset(0.98, 0.98));
  }

  Color _getStatusColor(String? status) {
    if (status == 'pending') return Colors.orange;
    if (status == 'preparing') return Colors.blue;
    if (status == 'ready') return Colors.green;
    return Colors.grey;
  }

  String _getActionLabel(String? status) {
    if (status == 'pending') return 'START COOKING';
    if (status == 'preparing') return 'MARK READY';
    return 'SERVE BATCH';
  }

  Widget _buildTimer(int mins) {
    final color = mins > 15 ? Colors.red : (mins > 8 ? Colors.orange : Colors.green);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
      child: Row(
        children: [
          Icon(LucideIcons.clock, size: 14, color: color),
          const SizedBox(width: 6),
          Text('${mins}m', style: TextStyle(color: color, fontWeight: FontWeight.w900, fontSize: 12)),
        ],
      ),
    );
  }
}
