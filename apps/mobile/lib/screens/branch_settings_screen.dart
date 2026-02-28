import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../services/auth_service.dart';
import '../services/audio_service.dart';
import '../core/theme.dart';

class BranchSettingsScreen extends ConsumerStatefulWidget {
  const BranchSettingsScreen({super.key});

  @override
  ConsumerState<BranchSettingsScreen> createState() => _BranchSettingsScreenState();
}

class _BranchSettingsScreenState extends ConsumerState<BranchSettingsScreen> {
  final _formKey = GlobalKey<FormState>();
  bool _isSaving = false;

  late TextEditingController _nameController;
  late TextEditingController _phoneController;
  late TextEditingController _addressController;
  late TextEditingController _gstinController;
  late TextEditingController _fssaiController;

  @override
  void initState() {
    super.initState();
    final ctx = ref.read(contextProvider);
    _nameController = TextEditingController(text: ctx.branchName);
    _phoneController = TextEditingController(text: ctx.branchPhone);
    _addressController = TextEditingController(text: ctx.branchAddress);
    _gstinController = TextEditingController(text: ctx.gstin);
    _fssaiController = TextEditingController(text: ctx.fssai);
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _addressController.dispose();
    _gstinController.dispose();
    _fssaiController.dispose();
    super.dispose();
  }

  Future<void> _saveSettings() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSaving = true);
    AudioService.instance.playClick();

    try {
      final ctx = ref.read(contextProvider);
      if (ctx.branchId == null) return;

      await Supabase.instance.client.from('branches').update({
        'name': _nameController.text,
        'phone': _phoneController.text,
        'address': _addressController.text,
        'gstin': _gstinController.text,
        'fssai_no': _fssaiController.text,
      }).eq('id', ctx.branchId!);

      // Refresh context
      await ref.read(contextProvider.notifier).init();

      if (mounted) {
        AudioService.instance.playSuccess();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Branch details updated successfully!'), backgroundColor: Colors.green),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text('BRANCH DETAILS', 
          style: GoogleFonts.outfit(fontWeight: FontWeight.w900, fontSize: 16, letterSpacing: 1)),
        leading: IconButton(
          icon: const Icon(LucideIcons.chevronLeft),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildSectionHeader("Official Information"),
              _buildField(
                controller: _nameController,
                label: "Branch Name",
                icon: LucideIcons.building,
                validator: (v) => v!.isEmpty ? "Required" : null,
              ),
              const SizedBox(height: 16),
              _buildField(
                controller: _phoneController,
                label: "Contact Number",
                icon: LucideIcons.phone,
                keyboardType: TextInputType.phone,
              ),
              const SizedBox(height: 16),
              _buildField(
                controller: _addressController,
                label: "Physical Address",
                icon: LucideIcons.mapPin,
                maxLines: 3,
              ),
              
              const SizedBox(height: 32),
              _buildSectionHeader("Tax & Compliance"),
              _buildField(
                controller: _gstinController,
                label: "GSTIN Number",
                icon: LucideIcons.fileText,
                placeholder: "e.g. 29AAAAA0000A1Z5",
              ),
              const SizedBox(height: 16),
              _buildField(
                controller: _fssaiController,
                label: "FSSAI License No",
                icon: LucideIcons.shieldCheck,
                placeholder: "e.g. 12345678901234",
              ),
              
              const SizedBox(height: 48),
              SizedBox(
                width: double.infinity,
                height: 60,
                child: ElevatedButton(
                  onPressed: _isSaving ? null : _saveSettings,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.black,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                    elevation: 0,
                  ),
                  child: _isSaving 
                    ? const CircularProgressIndicator(color: Colors.white)
                    : Text("SAVE METADATA", style: GoogleFonts.outfit(fontWeight: FontWeight.w900, letterSpacing: 1.5)),
                ),
              ),
              const SizedBox(height: 40),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16, left: 4),
      child: Text(title.toUpperCase(), 
        style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w900, color: Colors.grey.shade400, letterSpacing: 1.5)),
    );
  }

  Widget _buildField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    String? placeholder,
    int maxLines = 1,
    TextInputType? keyboardType,
    String? Function(String?)? validator,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 20, offset: const Offset(0, 8)),
        ],
      ),
      child: TextFormField(
        controller: controller,
        maxLines: maxLines,
        keyboardType: keyboardType,
        validator: validator,
        style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 14),
        decoration: InputDecoration(
          labelText: label,
          hintText: placeholder,
          prefixIcon: Icon(icon, size: 18, color: AppTheme.secondary),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide.none),
          filled: true,
          fillColor: Colors.white,
          labelStyle: GoogleFonts.outfit(color: Colors.grey.shade400, fontWeight: FontWeight.bold),
          contentPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        ),
      ),
    );
  }
}
