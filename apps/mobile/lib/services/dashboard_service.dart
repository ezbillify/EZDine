import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final dashboardServiceProvider = Provider((ref) => DashboardService());

class DashboardStats {
  final double grossVolume;
  final int pendingOrders;
  final int activeTables;
  final int lowStockCount;

  DashboardStats({
    required this.grossVolume,
    required this.pendingOrders,
    required this.activeTables,
    required this.lowStockCount,
  });

  factory DashboardStats.empty() => DashboardStats(
    grossVolume: 0, 
    pendingOrders: 0, 
    activeTables: 0,
    lowStockCount: 0,
  );
}

class DashboardService {
  final _client = Supabase.instance.client;

  Stream<DashboardStats> getRealtimeStats(String branchId) {
    return _client
        .from('orders')
        .stream(primaryKey: ['id'])
        .eq('branch_id', branchId)
        .asyncMap((orders) async {
          final today = DateTime.now().toIso8601String().split('T')[0];
          
          final billsRes = await _client
              .from('bills')
              .select('total')
              .eq('branch_id', branchId)
              .gte('created_at', today);

          final inventoryRes = await _client
              .from('inventory_items')
              .select('current_stock, reorder_level')
              .eq('branch_id', branchId)
              .eq('is_active', true);

          double volume = 0;
          for (var b in (billsRes as List)) {
            volume += (b['total'] as num).toDouble();
          }

          final pending = orders.where((o) => o['status'] == 'pending' || o['status'] == 'preparing').length;
          final activeTables = orders.where((o) => o['status'] != 'served' && o['status'] != 'cancelled').map((o) => o['table_id']).toSet().length;
          final lowStock = (inventoryRes as List).where((i) => (i['current_stock'] as num) <= (i['reorder_level'] as num)).length;

          return DashboardStats(
            grossVolume: volume,
            pendingOrders: pending,
            activeTables: activeTables,
            lowStockCount: lowStock,
          );
        });
  }
}

final statsProvider = StreamProvider.family<DashboardStats, String>((ref, branchId) {
  return ref.watch(dashboardServiceProvider).getRealtimeStats(branchId);
});
