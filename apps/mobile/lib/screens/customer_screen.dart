import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../core/theme.dart';
import '../services/auth_service.dart';
import '../widgets/numeric_keypad.dart';

class CustomerScreen extends ConsumerStatefulWidget {
  const CustomerScreen({super.key});

  @override
  ConsumerState<CustomerScreen> createState() => _CustomerScreenState();
}

class _CustomerScreenState extends ConsumerState<CustomerScreen> {
  List<Map<String, dynamic>> customers = [];
  bool isLoading = true;
  String? _editingCustomerId;
  bool _activePhoneField = false;

  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadCustomers();
  }

  Future<void> _loadCustomers() async {
    final ctx = ref.read(contextProvider);
    if (ctx.restaurantId == null) return;

    setState(() => isLoading = true);
    try {
      final data = await Supabase.instance.client
          .from('customers')
          .select()
          .eq('restaurant_id', ctx.restaurantId!)
          .order('name');

      if (mounted) {
        setState(() {
          customers = List<Map<String, dynamic>>.from(data);
          isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
        setState(() => isLoading = false);
      }
    }
  }

  Future<void> _saveCustomer() async {
    if (_nameController.text.isEmpty || _phoneController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Name and Phone are required')));
      return;
    }

    final ctx = ref.read(contextProvider);
    try {
      if (_editingCustomerId != null) {
        await Supabase.instance.client.from('customers').update({
          'name': _nameController.text.trim(),
          'phone': _phoneController.text.trim(),
          'email': _emailController.text.trim().isEmpty ? null : _emailController.text.trim(),
        }).eq('id', _editingCustomerId!);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Customer updated')));
      } else {
        await Supabase.instance.client.from('customers').insert({
          'restaurant_id': ctx.restaurantId,
          'name': _nameController.text.trim(),
          'phone': _phoneController.text.trim(),
          'email': _emailController.text.trim().isEmpty ? null : _emailController.text.trim(),
        });
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Customer added')));
      }
      _resetForm();
      _loadCustomers();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  void _resetForm() {
    setState(() {
      _editingCustomerId = null;
      _activePhoneField = false;
      _nameController.clear();
      _phoneController.clear();
      _emailController.clear();
    });
  }

  void _deleteCustomer(String id) async {
    try {
      await Supabase.instance.client.from('customers').delete().eq('id', id);
      _loadCustomers();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Customer deleted')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('CUSTOMER MASTER'),
        leading: IconButton(
          icon: const Icon(LucideIcons.chevronLeft),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            _buildForm(),
            const SizedBox(height: 32),
            _buildCustomerList(),
          ],
        ),
      ),
    );
  }

  Widget _buildForm() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: AppTheme.premiumShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(_editingCustomerId != null ? 'EDIT CUSTOMER' : 'ADD NEW CUSTOMER', style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.grey, letterSpacing: 2)),
              if (_editingCustomerId != null)
                IconButton(onPressed: _resetForm, icon: const Icon(LucideIcons.xCircle, size: 20, color: Colors.grey)),
            ],
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _nameController,
            decoration: InputDecoration(
              hintText: 'Customer Name',
              prefixIcon: const Icon(LucideIcons.user, size: 18),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
              contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            ),
          ),
          const SizedBox(height: 12),
          GestureDetector(
            onTap: () => setState(() => _activePhoneField = true),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: _activePhoneField ? AppTheme.primary : Colors.grey.shade300, width: _activePhoneField ? 2 : 1),
              ),
              child: Row(
                children: [
                  Icon(LucideIcons.phone, size: 18, color: _activePhoneField ? AppTheme.primary : Colors.grey),
                  const SizedBox(width: 12),
                  Text(
                    _phoneController.text.isEmpty ? 'Phone Number' : _phoneController.text,
                    style: TextStyle(
                      color: _phoneController.text.isEmpty ? Colors.grey.shade400 : Colors.black,
                      fontSize: 16,
                      fontWeight: _phoneController.text.isEmpty ? FontWeight.normal : FontWeight.bold,
                    ),
                  ),
                  const Spacer(),
                  if (_activePhoneField) const Icon(LucideIcons.edit3, size: 16, color: AppTheme.primary),
                ],
              ),
            ),
          ),
          if (_activePhoneField) ...[
            const SizedBox(height: 20),
            NumericKeypad(
              onKeyPress: (key) {
                if (key != '.') setState(() => _phoneController.text += key);
              },
              onDelete: () {
                if (_phoneController.text.isNotEmpty) {
                  setState(() => _phoneController.text = _phoneController.text.substring(0, _phoneController.text.length - 1));
                }
              },
              onClear: () => setState(() => _phoneController.clear()),
            ),
          ],
          const SizedBox(height: 12),
          TextField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            decoration: InputDecoration(
              hintText: 'Email (Optional)',
              prefixIcon: const Icon(LucideIcons.mail, size: 18),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
              contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            ),
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _saveCustomer,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.secondary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 18),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
              child: Text(_editingCustomerId != null ? 'UPDATE CUSTOMER' : 'SAVE CUSTOMER', style: const TextStyle(fontWeight: FontWeight.bold, letterSpacing: 1)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCustomerList() {
    if (isLoading) return const Center(child: CircularProgressIndicator());
    if (customers.isEmpty) return const Center(child: Text('No customers found'));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('CUSTOMER DATABASE', style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.grey, letterSpacing: 2)),
        const SizedBox(height: 16),
        ...customers.map((c) => Container(
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
                decoration: BoxDecoration(color: AppTheme.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
                child: const Icon(LucideIcons.user, color: AppTheme.primary, size: 20),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(c['name'], style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                    Text(c['phone'], style: TextStyle(color: Colors.grey.shade500, fontSize: 13, fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
              IconButton(
                onPressed: () {
                  setState(() {
                    _editingCustomerId = c['id'];
                    _nameController.text = c['name'] ?? '';
                    _phoneController.text = c['phone'] ?? '';
                    _emailController.text = c['email'] ?? '';
                    _activePhoneField = false;
                  });
                },
                icon: const Icon(LucideIcons.pencil, size: 18, color: Colors.blueAccent),
              ),
              IconButton(
                onPressed: () => _deleteCustomer(c['id']),
                icon: const Icon(LucideIcons.trash2, size: 18, color: Colors.redAccent),
              ),
            ],
          ),
        )),
      ],
    );
  }
}
