import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../services/auth_service.dart';
import '../core/theme.dart';

final inventoryProvider = FutureProvider.family<List<Map<String, dynamic>>, String>((ref, branchId) async {
  final res = await Supabase.instance.client
      .from('inventory_items')
      .select()
      .eq('branch_id', branchId)
      .order('name');
  return List<Map<String, dynamic>>.from(res);
});

class InventoryScreen extends ConsumerWidget {
  const InventoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ctx = ref.watch(contextProvider);
    if (ctx.branchId == null) return Scaffold(body: Center(child: Text('Please select a branch')));

    final itemsAsync = ref.watch(inventoryProvider(ctx.branchId!));

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('STOCK CONTROL', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
        leading: IconButton(
          icon: const Icon(LucideIcons.chevronLeft),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          IconButton(
            icon: const Icon(LucideIcons.refreshCcw, size: 20),
            onPressed: () => ref.refresh(inventoryProvider(ctx.branchId!)),
          ),
        ],
      ),
      body: itemsAsync.when(
        data: (items) {
          if (items.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(LucideIcons.warehouse, size: 64, color: Colors.grey.shade300),
                  const SizedBox(height: 16),
                  const Text('No Inventory Data', style: TextStyle(fontWeight: FontWeight.bold)),
                ],
              ),
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.all(24),
            itemCount: items.length,
            separatorBuilder: (c, i) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final item = items[index];
              final bool isLow = (item['current_stock'] as num) <= (item['reorder_level'] as num);

              return GestureDetector(
                onTap: () => _showUpdateStock(context, ref, item),
                child: Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: isLow ? Colors.red.withOpacity(0.2) : Colors.grey.shade100),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: (isLow ? Colors.red : AppTheme.primary).withOpacity(0.1),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          isLow ? LucideIcons.alertTriangle : LucideIcons.box,
                          color: isLow ? Colors.red : AppTheme.primary,
                          size: 20,
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(item['name'], style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                            Text('Unit: ${item['unit']}', style: TextStyle(color: Colors.grey.shade500, fontSize: 12)),
                          ],
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            '${item['current_stock'].toString()}',
                            style: TextStyle(
                              fontWeight: FontWeight.w900,
                              fontSize: 18,
                              color: isLow ? Colors.red : AppTheme.secondary,
                            ),
                          ),
                          Text(
                            isLow ? 'REORDER' : 'IN STOCK',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              color: isLow ? Colors.red : Colors.grey.shade400,
                              letterSpacing: 1,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ).animate().fadeIn(delay: (index * 50).ms).slideX(begin: 0.1, end: 0);
            },
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, s) => Center(child: Text('Inventory Error: $e')),
      ),
    );
  }

  void _showUpdateStock(BuildContext context, WidgetRef ref, Map<String, dynamic> item) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _UpdateStockSheet(item: item, ref: ref),
    );
  }
}

class _UpdateStockSheet extends StatefulWidget {
  final Map<String, dynamic> item;
  final WidgetRef ref;
  const _UpdateStockSheet({required this.item, required this.ref});

  @override
  State<_UpdateStockSheet> createState() => _UpdateStockSheetState();
}

class _UpdateStockSheetState extends State<_UpdateStockSheet> {
  late TextEditingController _ctrl;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: widget.item['current_stock'].toString());
  }

  Future<void> _save() async {
    final val = double.tryParse(_ctrl.text);
    if (val == null) return;
    
    setState(() => _isLoading = true);
    try {
      await Supabase.instance.client
          .from('inventory_items')
          .update({'current_stock': val})
          .eq('id', widget.item['id']);
      
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Stock Updated')));
        widget.ref.refresh(inventoryProvider(widget.item['branch_id']));
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(24, 24, 24, MediaQuery.of(context).viewInsets.bottom + 24),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('UPDATE STOCK: ${widget.item['name']}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: Colors.grey)),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _ctrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                    labelText: 'Current Quantity',
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(8)),
                child: Text(widget.item['unit'], style: const TextStyle(fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _isLoading ? null : _save,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.secondary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.all(16),
              ),
              child: _isLoading ? const CircularProgressIndicator(color: Colors.white) : const Text('SAVE UPDATES'),
            ),
          )
        ],
      ),
    );
  }
}
