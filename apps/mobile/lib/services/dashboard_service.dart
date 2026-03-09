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

  Stream<int> getOrdersCount(String branchId) {
    return _client
        .from('orders')
        .stream(primaryKey: ['id'])
        .eq('branch_id', branchId)
        .map((orders) => orders.where((o) => o['status'] == 'pending' || o['status'] == 'preparing').length);
  }

  Stream<int> getActiveTablesCount(String branchId) {
    return _client
        .from('orders')
        .stream(primaryKey: ['id'])
        .eq('branch_id', branchId)
        .map((orders) => orders.where((o) => o['status'] != 'served' && o['status'] != 'cancelled').map((o) => o['table_id']).toSet().length);
  }

  Future<double> getDailyVolume(String branchId) async {
    final currentUtc = DateTime.now().toUtc();
    final currentIst = currentUtc.add(const Duration(hours: 5, minutes: 30));
    final startOfDayUtc = DateTime.utc(currentIst.year, currentIst.month, currentIst.day).subtract(const Duration(hours: 5, minutes: 30));
    final endOfDayUtc = DateTime.utc(currentIst.year, currentIst.month, currentIst.day, 23, 59, 59, 999).subtract(const Duration(hours: 5, minutes: 30));

    final res = await _client
        .from('bills')
        .select('total')
        .eq('branch_id', branchId)
        .gte('created_at', startOfDayUtc.toIso8601String())
        .lte('created_at', endOfDayUtc.toIso8601String());
    
    double volume = 0;
    for (var b in (res as List)) {
      volume += (b['total'] as num?)?.toDouble() ?? 0.0;
    }
    return volume;
  }

  Future<int> getLowStockCount(String branchId) async {
    final res = await _client
        .from('inventory_items')
        .select('current_stock, reorder_level')
        .eq('branch_id', branchId)
        .eq('is_active', true);
    
    return (res as List).where((i) => 
      ((i['current_stock'] as num?)?.toDouble() ?? 0.0) <= ((i['reorder_level'] as num?)?.toDouble() ?? 0.0)
    ).length;
  }
}

final ordersCountProvider = StreamProvider.family<int, String>((ref, branchId) {
  return ref.watch(dashboardServiceProvider).getOrdersCount(branchId);
});

final activeTablesProvider = StreamProvider.family<int, String>((ref, branchId) {
  return ref.watch(dashboardServiceProvider).getActiveTablesCount(branchId);
});

final dailyVolumeProvider = FutureProvider.family<double, String>((ref, branchId) {
  return ref.watch(dashboardServiceProvider).getDailyVolume(branchId);
});

final lowStockProvider = FutureProvider.family<int, String>((ref, branchId) {
  return ref.watch(dashboardServiceProvider).getLowStockCount(branchId);
});

final statsProvider = Provider.family<DashboardStats, String>((ref, branchId) {
  final orders = ref.watch(ordersCountProvider(branchId)).value ?? 0;
  final tables = ref.watch(activeTablesProvider(branchId)).value ?? 0;
  final volume = ref.watch(dailyVolumeProvider(branchId)).value ?? 0.0;
  final lowStock = ref.watch(lowStockProvider(branchId)).value ?? 0;

  return DashboardStats(
    grossVolume: volume,
    pendingOrders: orders,
    activeTables: tables,
    lowStockCount: lowStock,
  );
});
