import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final dashboardServiceProvider = Provider((ref) => DashboardService());

class DashboardStats {
  final double grossVolume;
  final int pendingOrders;
  final int activeTables;

  DashboardStats({
    required this.grossVolume,
    required this.pendingOrders,
    required this.activeTables,
  });

  factory DashboardStats.empty() => DashboardStats(grossVolume: 0, pendingOrders: 0, activeTables: 0);
}

class DashboardService {
  final _client = Supabase.instance.client;

  Stream<DashboardStats> getRealtimeStats(String branchId) {
    // We combine three streams to get the overall stats
    // 1. Bills (for volume)
    // 2. Orders (for pending count)
    // 3. Active tables (count of tables with open orders)
    
    // For now, let's pulse every 5 seconds or use some combine logic if possible.
    // However, Supabase's real-time can be used on tables.
    
    return _client
        .from('orders')
        .stream(primaryKey: ['id'])
        .eq('branch_id', branchId)
        .asyncMap((orders) async {
          // Calculate volume from bills associated with these orders or just for the branch today
          final today = DateTime.now().toIso8601String().split('T')[0];
          
          final billsRes = await _client
              .from('bills')
              .select('total')
              .eq('branch_id', branchId)
              .gte('created_at', today);

          double volume = 0;
          for (var b in (billsRes as List)) {
            volume += (b['total'] as num).toDouble();
          }

          final pending = orders.where((o) => o['status'] == 'pending' || o['status'] == 'preparing').length;
          
          // Tables with open orders
          final activeTables = orders.where((o) => o['status'] != 'served' && o['status'] != 'cancelled').map((o) => o['table_id']).toSet().length;

          return DashboardStats(
            grossVolume: volume,
            pendingOrders: pending,
            activeTables: activeTables,
          );
        });
  }
}

final statsProvider = StreamProvider.family<DashboardStats, String>((ref, branchId) {
  return ref.watch(dashboardServiceProvider).getRealtimeStats(branchId);
});
