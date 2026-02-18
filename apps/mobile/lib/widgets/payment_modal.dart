import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../core/theme.dart';
import 'numeric_keypad.dart';

class PaymentModal extends StatefulWidget {
  final double totalAmount;
  final Function(List<Map<String, dynamic>>) onConfirm;

  const PaymentModal({
    super.key,
    required this.totalAmount,
    required this.onConfirm,
  });

  @override
  State<PaymentModal> createState() => _PaymentModalState();
}

class _PaymentModalState extends State<PaymentModal> {
  final Map<String, TextEditingController> _controllers = {
    'cash': TextEditingController(),
    'upi': TextEditingController(),
    'card': TextEditingController(),
  };

  String _activeField = 'cash';

  @override
  void initState() {
    super.initState();
    // Default to full cash
    _controllers['cash']?.text = _formatAmount(widget.totalAmount);
  }

  String _formatAmount(double amount) {
    if (amount == amount.truncateToDouble()) {
      return amount.toInt().toString();
    }
    return amount.toStringAsFixed(2);
  }

  @override
  void dispose() {
    for (var c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  double get _currentTotal {
    double sum = 0;
    for (var c in _controllers.values) {
      sum += double.tryParse(c.text) ?? 0;
    }
    return sum;
  }

  double get _remaining => widget.totalAmount - _currentTotal;

  void _handleQuickFill(String method) {
    setState(() {
      for (var key in _controllers.keys) {
        if (key != method) _controllers[key]?.text = '';
      }
      _controllers[method]?.text = _formatAmount(widget.totalAmount);
      _activeField = method;
    });
  }

  void _onKeyPress(String key) {
    final controller = _controllers[_activeField]!;
    setState(() {
      if (key == '.') {
        if (!controller.text.contains('.')) {
          controller.text += key;
        }
      } else {
        // If it was exactly 0.00 or initial amount, maybe we should clear first?
        // But for speed, let's just append.
        controller.text += key;
      }
    });
  }

  void _onDelete() {
    final controller = _controllers[_activeField]!;
    if (controller.text.isNotEmpty) {
      setState(() {
        controller.text = controller.text.substring(0, controller.text.length - 1);
      });
    }
  }

  void _onClear() {
    setState(() {
      _controllers[_activeField]!.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      child: Container(
        padding: const EdgeInsets.all(24),
        constraints: const BoxConstraints(maxWidth: 400),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(32),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.2),
              blurRadius: 24,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'RECORD SETTLEMENT',
                  style: TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 12,
                    color: Colors.grey,
                    letterSpacing: 1.5,
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(LucideIcons.x, size: 20),
                  visualDensity: VisualDensity.compact,
                ),
              ],
            ),
            const SizedBox(height: 12),
            Center(
              child: Column(
                children: [
                  const Text(
                    'TOTAL PAYABLE',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      color: Colors.grey,
                      letterSpacing: 1,
                    ),
                  ),
                  Text(
                    '₹${_formatAmount(widget.totalAmount)}',
                    style: const TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -1,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            _buildPaymentInput('cash', 'Cash', LucideIcons.banknote, Colors.green.shade600),
            const SizedBox(height: 10),
            _buildPaymentInput('upi', 'UPI / Scan', LucideIcons.smartphone, AppTheme.primary),
            const SizedBox(height: 10),
            _buildPaymentInput('card', 'Card', LucideIcons.creditCard, Colors.indigo),
            const SizedBox(height: 20),
            NumericKeypad(
              onKeyPress: _onKeyPress,
              onDelete: _onDelete,
              onClear: _onClear,
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.grey.shade50,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'PAID: ₹${_formatAmount(_currentTotal)}',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                      Text(
                        _remaining <= 0.01 ? 'FULLY PAID' : 'REMAINING: ₹${_formatAmount(_remaining)}',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w900,
                          color: _remaining <= 0.01 ? Colors.green : Colors.red,
                        ),
                      ),
                    ],
                  ),
                  ElevatedButton(
                    onPressed: _currentTotal < widget.totalAmount - 0.01
                        ? null
                        : () {
                            final payments = _controllers.entries
                                .map((e) => {
                                      'mode': e.key,
                                      'amount': double.tryParse(e.value.text) ?? 0.0,
                                    })
                                .where((p) => (p['amount'] as double) > 0)
                                .toList();
                            widget.onConfirm(payments);
                            Navigator.pop(context);
                          },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.black,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                    ),
                    child: const Text(
                      'CONFIRM',
                      style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPaymentInput(String key, String label, IconData icon, Color color) {
    bool isActive = _activeField == key;
    return GestureDetector(
      onTap: () => setState(() => _activeField = key),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isActive ? color.withValues(alpha: 0.05) : Colors.transparent,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isActive ? color : Colors.grey.shade200,
            width: isActive ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            GestureDetector(
              onTap: () => _handleQuickFill(key),
              child: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: color,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: Colors.white, size: 18),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label.toUpperCase(),
                    style: TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w900,
                      color: isActive ? color : Colors.grey,
                      letterSpacing: 1,
                    ),
                  ),
                  Text(
                    _controllers[key]!.text.isEmpty ? '0' : _controllers[key]!.text,
                    style: TextStyle(
                      fontWeight: FontWeight.w900, 
                      fontSize: 18,
                      color: _controllers[key]!.text.isEmpty ? Colors.grey.shade300 : Colors.blueGrey.shade900,
                    ),
                  ),
                ],
              ),
            ),
            if (isActive)
              Icon(LucideIcons.edit3, size: 14, color: color),
          ],
        ),
      ),
    );
  }
}
