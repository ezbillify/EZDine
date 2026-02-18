import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../core/theme.dart';
import '../services/auth_service.dart';
import '../widgets/numeric_keypad.dart';

class MenuScreen extends ConsumerStatefulWidget {
  const MenuScreen({super.key});

  @override
  ConsumerState<MenuScreen> createState() => _MenuScreenState();
}

class _MenuScreenState extends ConsumerState<MenuScreen> {
  List<Map<String, dynamic>> categories = [];
  List<Map<String, dynamic>> items = [];
  bool isLoading = true;
  String? selectedCategoryId;
  int selectedGstRate = 5;
  String? _editingCategoryId;
  String? _editingItemId;
  bool _activePriceField = false;
  String _selectedDietary = 'veg'; // 'veg', 'non-veg', 'egg'

  final _categoryController = TextEditingController();
  final _itemNameController = TextEditingController();
  final _itemPriceController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadMenu();
  }

  Future<void> _loadMenu() async {
    final ctx = ref.read(contextProvider);
    if (ctx.branchId == null) return;

    setState(() => isLoading = true);
    try {
      final supabase = Supabase.instance.client;
      
      final categoriesData = await supabase
          .from('menu_categories')
          .select()
          .eq('branch_id', ctx.branchId!)
          .order('name');
      
      final itemsData = await supabase
          .from('menu_items')
          .select('*, menu_categories(name)')
          .eq('branch_id', ctx.branchId!)
          .order('name');

      if (mounted) {
        setState(() {
          categories = List<Map<String, dynamic>>.from(categoriesData);
          items = List<Map<String, dynamic>>.from(itemsData);
          if (categories.isNotEmpty && selectedCategoryId == null) {
            selectedCategoryId = categories[0]['id'];
          }
          isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error loading menu: $e'))
        );
        setState(() => isLoading = false);
      }
    }
  }

  Future<void> _addCategory() async {
    if (_categoryController.text.isEmpty) return;
    
    final ctx = ref.read(contextProvider);
    try {
      if (_editingCategoryId != null) {
        await Supabase.instance.client.from('menu_categories').update({
          'name': _categoryController.text.trim(),
        }).eq('id', _editingCategoryId!);
        setState(() => _editingCategoryId = null);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Category updated')));
      } else {
        await Supabase.instance.client.from('menu_categories').insert({
          'restaurant_id': ctx.restaurantId,
          'branch_id': ctx.branchId,
          'name': _categoryController.text.trim(),
        });
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Category added')));
      }
      _categoryController.clear();
      _loadMenu();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  Future<void> _addItem() async {
    if (_itemNameController.text.isEmpty || _itemPriceController.text.isEmpty) return;
    
    final ctx = ref.read(contextProvider);
    try {
      if (_editingItemId != null) {
        await Supabase.instance.client.from('menu_items').update({
          'category_id': selectedCategoryId,
          'name': _itemNameController.text.trim(),
          'base_price': double.tryParse(_itemPriceController.text) ?? 0,
          'gst_rate': selectedGstRate,
          'is_veg': _selectedDietary == 'veg',
          'is_egg': _selectedDietary == 'egg',
        }).eq('id', _editingItemId!);
        setState(() => _editingItemId = null);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Item updated')));
      } else {
        await Supabase.instance.client.from('menu_items').insert({
          'restaurant_id': ctx.restaurantId,
          'branch_id': ctx.branchId,
          'category_id': selectedCategoryId,
          'name': _itemNameController.text.trim(),
          'base_price': double.tryParse(_itemPriceController.text) ?? 0,
          'gst_rate': selectedGstRate,
          'is_veg': _selectedDietary == 'veg',
          'is_egg': _selectedDietary == 'egg',
          'is_available': true,
          'is_active': true,
        });
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Item created')));
      }
      _itemNameController.clear();
      _itemPriceController.clear();
      setState(() => _activePriceField = false);
      _loadMenu();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  void _onPriceKeyPress(String key) {
    setState(() {
      if (key == '.') {
        if (!_itemPriceController.text.contains('.')) {
          _itemPriceController.text += key;
        }
      } else {
        _itemPriceController.text += key;
      }
    });
  }

  void _onPriceDelete() {
    if (_itemPriceController.text.isNotEmpty) {
      setState(() {
        _itemPriceController.text = _itemPriceController.text.substring(0, _itemPriceController.text.length - 1);
      });
    }
  }

  void _onPriceClear() {
    setState(() {
      _itemPriceController.clear();
    });
  }

  void _showCategoryModal() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(32))),
      builder: (context) => Container(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('SELECT CATEGORY', style: GoogleFonts.outfit(fontWeight: FontWeight.w900, fontSize: 12, letterSpacing: 2, color: Colors.grey)),
            const SizedBox(height: 24),
            Expanded(
              child: ListView.separated(
                itemCount: categories.length,
                separatorBuilder: (context, index) => const Divider(height: 1),
                itemBuilder: (context, index) {
                  final c = categories[index];
                  final isSelected = selectedCategoryId == c['id'];
                  return ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(c['name'], style: GoogleFonts.outfit(fontWeight: isSelected ? FontWeight.w900 : FontWeight.w600, color: isSelected ? AppTheme.primary : Colors.black)),
                    trailing: isSelected ? const Icon(LucideIcons.checkCircle2, color: AppTheme.primary) : null,
                    onTap: () {
                      setState(() => selectedCategoryId = c['id']);
                      Navigator.pop(context);
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showGstModal() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(32))),
      builder: (context) => Container(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('GST RATE', style: GoogleFonts.outfit(fontWeight: FontWeight.w900, fontSize: 12, letterSpacing: 2, color: Colors.grey)),
            const SizedBox(height: 24),
            ...[0, 5, 12, 18, 28].map((rate) {
              final isSelected = selectedGstRate == rate;
              return ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text('$rate% GST', style: GoogleFonts.outfit(fontWeight: isSelected ? FontWeight.w900 : FontWeight.w600, color: isSelected ? AppTheme.primary : Colors.black)),
                trailing: isSelected ? const Icon(LucideIcons.checkCircle2, color: AppTheme.primary) : null,
                onTap: () {
                  setState(() => selectedGstRate = rate);
                  Navigator.pop(context);
                },
              );
            }),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: Text('MENU MANAGER', style: GoogleFonts.outfit(fontWeight: FontWeight.w900, fontSize: 16, letterSpacing: 2)),
        actions: [
          IconButton(onPressed: _loadMenu, icon: const Icon(LucideIcons.refreshCw, size: 20)),
        ],
      ),
      body: isLoading 
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildAddCategory(),
                  const SizedBox(height: 32),
                  _buildAddItem(),
                  const SizedBox(height: 40),
                  _buildCategoryList(),
                  const SizedBox(height: 32),
                  _buildItemList(),
                  const SizedBox(height: 60),
                  Center(
                    child: Column(
                      children: [
                        Text('POWERED BY', style: GoogleFonts.outfit(fontSize: 8, fontWeight: FontWeight.w900, color: Colors.grey.shade400, letterSpacing: 2)),
                        const SizedBox(height: 4),
                        Text('EZBILLIFY', style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w900, color: AppTheme.primary, letterSpacing: 1)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                ],
              ),
            ),
    );
  }

  Widget _buildAddCategory() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28),
        boxShadow: AppTheme.premiumShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(_editingCategoryId != null ? 'EDIT CATEGORY' : 'ADD CATEGORY', style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.grey, letterSpacing: 2)),
              if (_editingCategoryId != null)
                TextButton(
                  onPressed: () {
                    setState(() {
                      _editingCategoryId = null;
                      _categoryController.clear();
                    });
                  },
                  child: const Text('CANCEL', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.red)),
                ),
            ],
          ),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _categoryController,
                  decoration: InputDecoration(
                    hintText: 'e.g. Beverages',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide(color: Colors.grey.shade100)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              ElevatedButton(
                onPressed: _addCategory,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.secondary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
                child: Text(_editingCategoryId != null ? 'UPDATE' : 'ADD'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildAddItem() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28),
        boxShadow: AppTheme.premiumShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(_editingItemId != null ? 'EDIT MENU ITEM' : 'ADD NEW ITEM', style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.grey, letterSpacing: 2)),
              if (_editingItemId != null)
                TextButton(
                  onPressed: () {
                    setState(() {
                      _editingItemId = null;
                      _activePriceField = false;
                      _itemNameController.clear();
                      _itemPriceController.clear();
                    });
                  },
                  child: const Text('CANCEL', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.red)),
                ),
            ],
          ),
          TextField(
            controller: _itemNameController,
            decoration: InputDecoration(
              hintText: 'Item Name',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
              contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            ),
          ),
          const SizedBox(height: 12),
          GestureDetector(
            onTap: () => setState(() => _activePriceField = true),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: _activePriceField ? AppTheme.primary : Colors.grey.shade300, width: _activePriceField ? 2 : 1),
              ),
              child: Row(
                children: [
                  Icon(LucideIcons.indianRupee, size: 16, color: _activePriceField ? AppTheme.primary : Colors.grey),
                  const SizedBox(width: 12),
                  Text(
                    _itemPriceController.text.isEmpty ? 'Price' : _itemPriceController.text,
                    style: TextStyle(
                      color: _itemPriceController.text.isEmpty ? Colors.grey.shade400 : Colors.black,
                      fontSize: 16,
                      fontWeight: _itemPriceController.text.isEmpty ? FontWeight.normal : FontWeight.bold,
                    ),
                  ),
                  const Spacer(),
                  if (_activePriceField) const Icon(LucideIcons.edit3, size: 16, color: AppTheme.primary),
                ],
              ),
            ),
          ),
          if (_activePriceField) ...[
            const SizedBox(height: 20),
            NumericKeypad(
              onKeyPress: _onPriceKeyPress,
              onDelete: _onPriceDelete,
              onClear: _onPriceClear,
            ),
          ],
          const SizedBox(height: 12),
          const SizedBox(height: 12),
          GestureDetector(
            onTap: () => _showCategoryModal(),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.grey.shade300),
              ),
              child: Row(
                children: [
                  const Icon(LucideIcons.tag, size: 16, color: Colors.grey),
                  const SizedBox(width: 12),
                  Text(
                    selectedCategoryId == null 
                      ? 'Select Category' 
                      : (categories.firstWhere((c) => c['id'] == selectedCategoryId, orElse: () => {'name': 'Select Category'})['name']),
                    style: TextStyle(
                      color: selectedCategoryId == null ? Colors.grey.shade400 : Colors.black,
                      fontSize: 16,
                      fontWeight: selectedCategoryId == null ? FontWeight.normal : FontWeight.bold,
                    ),
                  ),
                  const Spacer(),
                  const Icon(LucideIcons.chevronDown, size: 16, color: Colors.grey),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          GestureDetector(
            onTap: () => _showGstModal(),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.grey.shade300),
              ),
              child: Row(
                children: [
                  const Icon(LucideIcons.percent, size: 16, color: Colors.grey),
                  const SizedBox(width: 12),
                  Text(
                    '$selectedGstRate% GST',
                    style: const TextStyle(
                      color: Colors.black,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const Spacer(),
                  const Icon(LucideIcons.chevronDown, size: 16, color: Colors.grey),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _buildDietaryChip('veg', 'VEG', LucideIcons.leaf, Colors.green)),
              const SizedBox(width: 8),
              Expanded(child: _buildDietaryChip('egg', 'EGG', LucideIcons.egg, Colors.orange)),
              const SizedBox(width: 8),
              Expanded(child: _buildDietaryChip('non-veg', 'NON-VEG', LucideIcons.flame, Colors.red)),
            ],
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _addItem,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 18),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
              child: Text(_editingItemId != null ? 'UPDATE MENU ITEM' : 'CREATE MENU ITEM (INCLUSIVE)', style: const TextStyle(fontWeight: FontWeight.bold, letterSpacing: 1)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDietaryChip(String type, String label, IconData icon, Color color) {
    bool isSelected = _selectedDietary == type;
    return GestureDetector(
      onTap: () => setState(() => _selectedDietary = type),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: isSelected ? color.withOpacity(0.1) : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: isSelected ? color : Colors.grey.shade200, width: isSelected ? 2 : 1),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 14, color: isSelected ? color : Colors.grey),
            const SizedBox(width: 6),
            Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: isSelected ? color : Colors.grey)),
          ],
        ),
      ),
    );
  }

  Widget _buildCategoryList() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('CATEGORIES', style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.grey, letterSpacing: 2)),
        const SizedBox(height: 16),
        ...categories.map((c) => Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.grey.shade50),
          ),
          child: Row(
            children: [
              const Icon(LucideIcons.tag, size: 16, color: AppTheme.primary),
              const SizedBox(width: 12),
              Text(c['name'], style: const TextStyle(fontWeight: FontWeight.bold)),
              const Spacer(),
              IconButton(
                onPressed: () {
                  setState(() {
                    _editingCategoryId = c['id'];
                    _categoryController.text = c['name'];
                  });
                },
                icon: const Icon(LucideIcons.pencil, size: 18, color: Colors.blueAccent),
              ),
              IconButton(
                onPressed: () => _delete('menu_categories', c['id']),
                icon: const Icon(LucideIcons.trash2, size: 18, color: Colors.redAccent),
              ),
            ],
          ),
        )),
      ],
    );
  }

  Widget _buildItemList() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('MENU ITEMS', style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.grey, letterSpacing: 2)),
        const SizedBox(height: 16),
        ...items.map((i) {
                  final isVeg = i['is_veg'] ?? false;
                  final isEgg = i['is_egg'] ?? false;
                  final dietaryColor = isVeg ? Colors.green : (isEgg ? Colors.orange : Colors.red);
                  final dietaryIcon = isVeg ? LucideIcons.leaf : (isEgg ? LucideIcons.egg : LucideIcons.flame);

                  return Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: Colors.grey.shade50),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(color: dietaryColor.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
                          child: Icon(dietaryIcon, color: dietaryColor, size: 20),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(i['name'], style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                              const SizedBox(height: 4),
                              Text(
                                '${i['menu_categories']?['name'] ?? 'No Category'} • ₹${i['base_price']} (Inc. ${i['gst_rate'] ?? 0}% Tax)',
                                style: TextStyle(fontSize: 11, color: Colors.grey.shade500, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          onPressed: () {
                            setState(() {
                              _editingItemId = i['id'];
                              _itemNameController.text = i['name'];
                              _itemPriceController.text = i['base_price'].toString();
                              selectedCategoryId = i['category_id'];
                              selectedGstRate = (i['gst_rate'] as num?)?.toInt() ?? 5;
                              _selectedDietary = isVeg ? 'veg' : (isEgg ? 'egg' : 'non-veg');
                            });
                          },
                          icon: const Icon(LucideIcons.pencil, size: 18, color: Colors.blueAccent),
                        ),
                        IconButton(
                          onPressed: () => _delete('menu_items', i['id']),
                          icon: const Icon(LucideIcons.trash2, size: 20, color: Colors.redAccent),
                        ),
                      ],
                    ),
                  );
        }).toList(),
      ],
    );
  }

  Future<void> _delete(String table, String id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Confirm Delete'),
        content: const Text('Are you sure you want to remove this item?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('CANCEL')),
          TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('DELETE', style: TextStyle(color: Colors.red))),
        ],
      ),
    );

    if (confirm == true) {
      try {
        await Supabase.instance.client.from(table).delete().eq('id', id);
        _loadMenu();
      } catch (e) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Delete failed: $e')));
      }
    }
  }
}
