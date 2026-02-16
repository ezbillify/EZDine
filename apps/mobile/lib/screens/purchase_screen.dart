import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import '../services/auth_service.dart';
import '../services/audio_service.dart';
import '../core/theme.dart';

final purchaseOrdersProvider = FutureProvider.family<List<Map<String, dynamic>>, String>((ref, branchId) async {
  final res = await Supabase.instance.client
      .from('purchase_orders')
      .select('*, vendors(name)')
      .eq('branch_id', branchId)
      .order('created_at', ascending: false);
  return List<Map<String, dynamic>>.from(res);
});

class PurchaseScreen extends ConsumerWidget {
  const PurchaseScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ctx = ref.watch(contextProvider);
    if (ctx.branchId == null) return Scaffold(body: Center(child: Text('Please select branch')));

    final ordersAsync = ref.watch(purchaseOrdersProvider(ctx.branchId!));

    return Scaffold(
      appBar: AppBar(
        title: const Text('PROCUREMENT'),
        leading: IconButton(
          icon: const Icon(LucideIcons.chevronLeft),
          onPressed: () {
            AudioService.instance.playClick();
            Navigator.pop(context);
          },
        ),
      ),
      body: ordersAsync.when(
        data: (orders) {
          if (orders.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(LucideIcons.shoppingBag, size: 64, color: Colors.grey.shade300),
                  const SizedBox(height: 16),
                  const Text('No purchase orders yet', style: TextStyle(fontWeight: FontWeight.bold)),
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
              final status = order['status'].toString().toUpperCase();
              final amount = NumberFormat.currency(symbol: '₹', decimalDigits: 0).format(order['total_amount']);

              return GestureDetector(
                onTap: () {
                  AudioService.instance.playClick();
                  // No detail view implemented yet, but haptic for consistency
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: Colors.black.withOpacity(0.03)),
                    boxShadow: AppTheme.premiumShadow,
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppTheme.primary.withOpacity(0.08),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: const Icon(LucideIcons.fileText, color: AppTheme.primary, size: 20),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(order['order_number'], style: TextStyle(color: Colors.grey.shade400, fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1.5)),
                            Text(order['vendors']?['name'] ?? 'Generic Vendor', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16, height: 1.1)),
                            const SizedBox(height: 12),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                _StatusChip(status: status),
                                Text(amount, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 17, color: AppTheme.secondary)),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ).animate().fadeIn(delay: (index * 50).ms).scale(begin: const Offset(0.95, 0.95));
            },
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, s) => Center(child: Text('Purchase Error: $e')),
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppTheme.primary,
        onPressed: () => AudioService.instance.playClick(),
        icon: const Icon(LucideIcons.plus, color: Colors.white, size: 20),
        label: const Text('NEW ORDER', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, letterSpacing: -0.2)),
      ).animate().scale(),
    );
  }
}

class _StatusChip extends StatelessWidget {
  final String status;
  const _StatusChip({required this.status});

  @override
  Widget build(BuildContext context) {
    Color color = Colors.grey;
    if (status == 'RECEIVED') color = const Color(0xFF10B981);
    if (status == 'ORDERED') color = Colors.blue;
    if (status == 'DRAFT') color = Colors.orange;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        status,
        style: TextStyle(color: color, fontSize: 9, fontWeight: FontWeight.w900, letterSpacing: 1),
      ),
    );
  }
}
