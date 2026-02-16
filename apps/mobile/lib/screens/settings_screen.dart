import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../services/audio_service.dart';
import '../core/theme.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('SYSTEM CONFIG', style: GoogleFonts.outfit(fontWeight: FontWeight.w900, fontSize: 16)),
        leading: IconButton(
          icon: const Icon(LucideIcons.chevronLeft),
          onPressed: () {
            AudioService.instance.playClick();
            Navigator.pop(context);
          },
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          _buildSettingItem(
            icon: LucideIcons.user,
            title: 'Profile Settings',
            subtitle: 'Manage your personal information',
          ),
          _buildSettingItem(
            icon: LucideIcons.bell,
            title: 'Notifications',
            subtitle: 'Configure alerts and sounds',
          ),
          _buildSettingItem(
            icon: LucideIcons.lock,
            title: 'Security',
            subtitle: 'Password and session management',
          ),
          _buildSettingItem(
            icon: LucideIcons.helpCircle,
            title: 'Help & Support',
            subtitle: 'Contact HQ or view documentation',
          ),
        ],
      ),
    );
  }

  Widget _buildSettingItem({required IconData icon, required String title, required String subtitle}) {
    return GestureDetector(
      onTap: () => AudioService.instance.playClick(),
      child: Container(
        margin: const EdgeInsets.only(bottom: 20),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(28),
          border: Border.all(color: Colors.grey.shade50),
          boxShadow: AppTheme.premiumShadow,
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(icon, size: 20, color: AppTheme.secondary),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: GoogleFonts.outfit(fontWeight: FontWeight.w900, fontSize: 15)),
                  Text(subtitle, style: GoogleFonts.outfit(color: Colors.grey.shade400, fontSize: 11, fontWeight: FontWeight.bold)),
                ],
              ),
            ),
            Icon(LucideIcons.chevronRight, size: 16, color: Colors.grey.shade300),
          ],
        ),
      ),
    );
  }
}
