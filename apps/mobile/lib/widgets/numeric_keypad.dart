import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:google_fonts/google_fonts.dart';

class NumericKeypad extends StatelessWidget {
  final Function(String) onKeyPress;
  final VoidCallback onDelete;
  final VoidCallback onClear;

  const NumericKeypad({
    super.key,
    required this.onKeyPress,
    required this.onDelete,
    required this.onClear,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.grey.shade100),
      ),
      child: Column(
        children: [
          _buildRow(['1', '2', '3']),
          _buildRow(['4', '5', '6']),
          _buildRow(['7', '8', '9']),
          _buildRow(['.', '0', 'DEL']),
        ],
      ),
    );
  }

  Widget _buildRow(List<String> keys) {
    return Row(
      children: keys.map((key) => Expanded(child: _buildKey(key))).toList(),
    );
  }

  Widget _buildKey(String key) {
    final bool isDel = key == 'DEL';
    
    return Padding(
      padding: const EdgeInsets.all(6),
      child: InkWell(
        onTap: () {
          if (isDel) {
             onDelete();
          } else {
             onKeyPress(key);
          }
        },
        onLongPress: isDel ? onClear : null,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          height: 60,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: isDel ? Colors.red.withValues(alpha: 0.05) : Colors.grey.shade50,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isDel ? Colors.red.withValues(alpha: 0.1) : Colors.transparent,
            ),
          ),
          child: isDel
              ? Icon(LucideIcons.delete, color: Colors.red.shade400, size: 22)
              : Text(
                  key,
                  style: GoogleFonts.outfit(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    color: key == '.' ? Colors.blueGrey.shade300 : Colors.blueGrey.shade900,
                  ),
                ),
        ),
      ),
    );
  }
}
