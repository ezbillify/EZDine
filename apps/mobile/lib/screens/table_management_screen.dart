import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../core/theme.dart';
import '../services/auth_service.dart';
import '../services/audio_service.dart';

final tablesProvider = FutureProvider.family<List<Map<String, dynamic>>, String>((ref, branchId) async {
  final res = await Supabase.instance.client
      .from('tables')
      .select()
      .eq('branch_id', branchId)
      .order('name');
  return List<Map<String, dynamic>>.from(res);
});

class TableManagementScreen extends ConsumerStatefulWidget {
  const TableManagementScreen({super.key});

  @override
  ConsumerState<TableManagementScreen> createState() => _TableManagementScreenState();
}

class _TableManagementScreenState extends ConsumerState<TableManagementScreen> {
  String _filterStatus = 'all'; // all, active, inactive

  @override
  Widget build(BuildContext context) {
    final ctx = ref.watch(contextProvider);
    
    if (ctx.branchId == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('TABLE MANAGEMENT')),
        body: const Center(child: Text('No branch selected')),
      );
    }

    final tablesAsync = ref.watch(tablesProvider(ctx.branchId!));

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text(
          'TABLE MANAGEMENT',
          style: GoogleFonts.outfit(fontWeight: FontWeight.w900, fontSize: 14, letterSpacing: 2),
        ),
        leading: IconButton(
          icon: const Icon(LucideIcons.chevronLeft),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          IconButton(
            icon: const Icon(LucideIcons.plus, size: 20),
            onPressed: () => _showAddTableDialog(ctx.branchId!),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Column(
        children: [
          // Filter
          Container(
            padding: const EdgeInsets.all(16),
            color: Colors.white,
            child: Row(
              children: [
                _buildFilterChip('All', 'all'),
                const SizedBox(width: 8),
                _buildFilterChip('Active', 'active'),
                const SizedBox(width: 8),
                _buildFilterChip('Inactive', 'inactive'),
              ],
            ),
          ),
          
          // Tables Grid
          Expanded(
            child: tablesAsync.when(
              data: (tables) {
                final filtered = tables.where((t) {
                  if (_filterStatus == 'all') return true;
                  if (_filterStatus == 'active') return t['is_active'] == true;
                  if (_filterStatus == 'inactive') return t['is_active'] == false;
                  return true;
                }).toList();

                if (filtered.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(LucideIcons.armchair, size: 64, color: Colors.grey.shade200),
                        const SizedBox(height: 16),
                        Text(
                          'NO TABLES FOUND',
                          style: TextStyle(
                            fontWeight: FontWeight.w900,
                            color: Colors.grey.shade300,
                            fontSize: 14,
                            letterSpacing: 2,
                          ),
                        ),
                        const SizedBox(height: 8),
                        TextButton.icon(
                          onPressed: () => _showAddTableDialog(ctx.branchId!),
                          icon: const Icon(LucideIcons.plus, size: 16),
                          label: const Text('Add First Table'),
                        ),
                      ],
                    ),
                  );
                }

                return GridView.builder(
                  padding: const EdgeInsets.all(16),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 1.0,
                  ),
                  itemCount: filtered.length,
                  itemBuilder: (c, i) => _buildTableCard(filtered[i], ctx.branchId!),
                );
              },
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, s) => Center(child: Text('Error: $e')),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label, String value) {
    final isSelected = _filterStatus == value;
    return GestureDetector(
      onTap: () {
        AudioService.instance.playClick();
        setState(() => _filterStatus = value);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.primary : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? AppTheme.primary : Colors.grey.shade300,
          ),
        ),
        child: Text(
          label,
          style: GoogleFonts.outfit(
            fontWeight: FontWeight.bold,
            fontSize: 12,
            color: isSelected ? Colors.white : Colors.grey.shade600,
          ),
        ),
      ),
    );
  }

  Widget _buildTableCard(Map<String, dynamic> table, String branchId) {
    final isActive = table['is_active'] == true;
    final name = table['name'] ?? 'Table';
    final capacity = table['capacity'] ?? 4;

    return GestureDetector(
      onTap: () => _showEditTableDialog(table, branchId),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isActive ? AppTheme.primary.withOpacity(0.2) : Colors.grey.shade200,
            width: 2,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.03),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isActive ? AppTheme.primary.withOpacity(0.1) : Colors.grey.shade100,
                shape: BoxShape.circle,
              ),
              child: Icon(
                LucideIcons.armchair,
                size: 24,
                color: isActive ? AppTheme.primary : Colors.grey.shade400,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              name,
              style: GoogleFonts.outfit(
                fontWeight: FontWeight.w900,
                fontSize: 14,
                color: isActive ? AppTheme.secondary : Colors.grey.shade400,
              ),
            ),
            const SizedBox(height: 4),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(LucideIcons.users, size: 12, color: Colors.grey.shade400),
                const SizedBox(width: 4),
                Text(
                  '$capacity seats',
                  style: TextStyle(
                    fontSize: 11,
                    color: Colors.grey.shade600,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: isActive ? Colors.green.withOpacity(0.1) : Colors.red.withOpacity(0.1),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                isActive ? 'ACTIVE' : 'INACTIVE',
                style: TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.w900,
                  color: isActive ? Colors.green : Colors.red,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showAddTableDialog(String branchId) async {
    final nameController = TextEditingController();
    final capacityController = TextEditingController(text: '4');

    await showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(
          'Add New Table',
          style: GoogleFonts.outfit(fontWeight: FontWeight.w900),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameController,
              decoration: const InputDecoration(
                labelText: 'Table Name',
                hintText: 'e.g., T1, Table 1',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: capacityController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Capacity (seats)',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              if (nameController.text.isEmpty) return;
              
              try {
                await Supabase.instance.client.from('tables').insert({
                  'branch_id': branchId,
                  'name': nameController.text.trim(),
                  'capacity': int.tryParse(capacityController.text) ?? 4,
                  'is_active': true,
                });
                
                if (mounted) {
                  Navigator.pop(context);
                  ref.invalidate(tablesProvider(branchId));
                  AudioService.instance.playSuccess();
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Table added successfully'),
                      backgroundColor: Colors.green,
                    ),
                  );
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Error: $e')),
                  );
                }
              }
            },
            child: const Text('Add Table'),
          ),
        ],
      ),
    );
  }

  Future<void> _showEditTableDialog(Map<String, dynamic> table, String branchId) async {
    final nameController = TextEditingController(text: table['name']);
    final capacityController = TextEditingController(text: table['capacity'].toString());
    bool isActive = table['is_active'] == true;

    await showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: Text(
            'Edit Table',
            style: GoogleFonts.outfit(fontWeight: FontWeight.w900),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameController,
                decoration: const InputDecoration(
                  labelText: 'Table Name',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: capacityController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Capacity (seats)',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              SwitchListTile(
                title: const Text('Active'),
                value: isActive,
                onChanged: (val) => setState(() => isActive = val),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () async {
                final confirm = await showDialog<bool>(
                  context: context,
                  builder: (c) => AlertDialog(
                    title: const Text('Delete Table?'),
                    content: const Text('This action cannot be undone.'),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(c, false),
                        child: const Text('Cancel'),
                      ),
                      ElevatedButton(
                        onPressed: () => Navigator.pop(c, true),
                        style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
                        child: const Text('Delete'),
                      ),
                    ],
                  ),
                );

                if (confirm == true && mounted) {
                  try {
                    await Supabase.instance.client
                        .from('tables')
                        .delete()
                        .eq('id', table['id']);
                    
                    if (mounted) {
                      Navigator.pop(context);
                      ref.invalidate(tablesProvider(branchId));
                      AudioService.instance.playSuccess();
                    }
                  } catch (e) {
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Error: $e')),
                      );
                    }
                  }
                }
              },
              child: const Text('Delete', style: TextStyle(color: Colors.red)),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () async {
                try {
                  await Supabase.instance.client.from('tables').update({
                    'name': nameController.text.trim(),
                    'capacity': int.tryParse(capacityController.text) ?? 4,
                    'is_active': isActive,
                  }).eq('id', table['id']);
                  
                  if (mounted) {
                    Navigator.pop(context);
                    ref.invalidate(tablesProvider(branchId));
                    AudioService.instance.playSuccess();
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Table updated successfully'),
                        backgroundColor: Colors.green,
                      ),
                    );
                  }
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Error: $e')),
                    );
                  }
                }
              },
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
  }
}
