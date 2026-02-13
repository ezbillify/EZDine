import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('SETTINGS'),
        leading: IconButton(
          icon: const Icon(LucideIcons.chevronLeft),
          onPressed: () => Navigator.pop(context),
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
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.grey.shade100),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 20, color: const Color(0xFF0F172A)),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                Text(subtitle, style: TextStyle(color: Colors.grey.shade500, fontSize: 12)),
              ],
            ),
          ),
          Icon(LucideIcons.chevronRight, size: 16, color: Colors.grey.shade400),
        ],
      ),
    );
  }
}
