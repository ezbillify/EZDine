import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../core/theme.dart';

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

  @override
  void initState() {
    super.initState();
    // Default to full cash
    _controllers['cash']?.text = widget.totalAmount.toStringAsFixed(2);
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
      // Clear other fields for simple quick fill, or subtract from total
      for (var key in _controllers.keys) {
        if (key != method) _controllers[key]?.text = '';
      }
      _controllers[method]?.text = widget.totalAmount.toStringAsFixed(2);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 20),
      child: Container(
        padding: const EdgeInsets.all(24),
        constraints: const BoxConstraints(maxWidth: 400),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(32),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.2),
              blurRadius: 24,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: SingleChildScrollView(
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
              const SizedBox(height: 16),
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
                      '₹${widget.totalAmount.toStringAsFixed(2)}',
                      style: const TextStyle(
                        fontSize: 36,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -1,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              _buildPaymentInput(
                'cash',
                'Cash',
                LucideIcons.banknote,
                Colors.green.shade600,
              ),
              const SizedBox(height: 12),
              _buildPaymentInput(
                'upi',
                'UPI / Scan',
                LucideIcons.smartphone,
                AppTheme.primary,
              ),
              const SizedBox(height: 12),
              _buildPaymentInput(
                'card',
                'Card',
                LucideIcons.creditCard,
                Colors.indigo,
              ),
              const SizedBox(height: 24),
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
                          'PAID: ₹${_currentTotal.toStringAsFixed(2)}',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                        ),
                        Text(
                          _remaining <= 0.01 ? 'FULLY PAID' : 'REMAINING: ₹${_remaining.toStringAsFixed(2)}',
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
      ),
    );
  }

  Widget _buildPaymentInput(String key, String label, IconData icon, Color color) {
    return Row(
      children: [
        GestureDetector(
          onTap: () => _handleQuickFill(key),
          child: Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: color.withOpacity(0.3),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Icon(icon, color: Colors.white, size: 24),
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: TextField(
            controller: _controllers[key],
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            onChanged: (v) => setState(() {}),
            decoration: InputDecoration(
              labelText: label,
              hintText: '0.00',
              prefixText: '₹ ',
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
            ),
            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18),
          ),
        ),
      ],
    );
  }
}
