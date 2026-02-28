import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:google_fonts/google_fonts.dart';
import '../core/theme.dart';
import 'numeric_keypad.dart';

class PaymentModal extends StatefulWidget {
  final double totalAmount;
  final bool isLoading;
  final Function(List<Map<String, dynamic>>) onConfirm;
  final bool isSheet;

  const PaymentModal({
    super.key,
    required this.totalAmount,
    this.isLoading = false,
    required this.onConfirm,
    this.isSheet = false,
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
        controller.text += key;
      }
    });

    final newAmount = double.tryParse(controller.text) ?? 0;
    final otherFieldsTotal = _controllers.entries
        .where((e) => e.key != _activeField)
        .fold(0.0, (sum, e) => sum + (double.tryParse(e.value.text) ?? 0));
    
    if (otherFieldsTotal + newAmount > widget.totalAmount + 0.01) {
      final maxAllowed = widget.totalAmount - otherFieldsTotal;
      setState(() {
        controller.text = _formatAmount(maxAllowed < 0 ? 0 : maxAllowed);
      });
    }
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
    return Material(
      color: Colors.white,
      borderRadius: widget.isSheet ? const BorderRadius.vertical(top: Radius.circular(40)) : BorderRadius.circular(32),
      clipBehavior: Clip.antiAlias,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
        constraints: const BoxConstraints(maxWidth: 450),
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: widget.isSheet ? null : [
            BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 40, offset: const Offset(0, 20)),
          ],
        ),
        child: SingleChildScrollView(
          physics: const BouncingScrollPhysics(),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'SETTLE BILL',
                    style: GoogleFonts.outfit(
                      fontWeight: FontWeight.w900,
                      fontSize: 14,
                      color: Colors.blueGrey.shade400,
                      letterSpacing: 2,
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(LucideIcons.x, size: 20, color: Colors.blueGrey),
                    style: IconButton.styleFrom(backgroundColor: Colors.grey.shade50, elevation: 0),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9), // Solid Slate 50 equivalent
                  borderRadius: BorderRadius.circular(24),
                ),
                child: Column(
                  children: [
                    Text(
                      'TOTAL PAYABLE',
                      style: GoogleFonts.outfit(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: Colors.blueGrey.shade400,
                        letterSpacing: 1,
                      ),
                    ),
                    Text(
                      '₹${_formatAmount(widget.totalAmount)}',
                      style: GoogleFonts.outfit(
                        fontSize: 44,
                        fontWeight: FontWeight.w900,
                        color: Colors.blueGrey.shade900,
                        letterSpacing: -1,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(width: 40, height: 1, color: Colors.blueGrey.shade100),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          child: Text(
                            _remaining <= 0.01 
                              ? 'PAID IN FULL' 
                              : 'DUE: ₹${_formatAmount(_remaining)}',
                            style: GoogleFonts.outfit(
                              fontSize: 14,
                              fontWeight: FontWeight.w900,
                              color: _remaining <= 0.01 ? Colors.green.shade600 : Colors.red.shade600,
                            ),
                          ),
                        ),
                        Container(width: 40, height: 1, color: Colors.blueGrey.shade100),
                      ],
                    ),
                  ],
                ),
              ),
              
              const SizedBox(height: 20),
              
              Row(
                children: [
                  Expanded(child: _buildPaymentOption('cash', 'CASH', LucideIcons.banknote, Colors.green)),
                  const SizedBox(width: 8),
                  Expanded(child: _buildPaymentOption('upi', 'UPI/SCAN', LucideIcons.qrCode, AppTheme.primary)),
                  const SizedBox(width: 8),
                  Expanded(child: _buildPaymentOption('card', 'CARD', LucideIcons.creditCard, Colors.indigo)),
                ],
              ),
              
              const SizedBox(height: 20),
              
              NumericKeypad(
                onKeyPress: _onKeyPress,
                onDelete: _onDelete,
                onClear: _onClear,
              ),
              
              const SizedBox(height: 20),
              
              SizedBox(
                width: double.infinity,
                height: 64,
                child: ElevatedButton(
                  onPressed: widget.isLoading || _currentTotal < widget.totalAmount - 0.01
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
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.black,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                  ),
                  child: widget.isLoading 
                    ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 3))
                    : Text(
                        'CONFIRM & SETTLE',
                        style: GoogleFonts.outfit(fontWeight: FontWeight.w900, letterSpacing: 1, fontSize: 15),
                      ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPaymentOption(String key, String label, IconData icon, Color color) {
    bool isActive = _activeField == key;
    bool hasValue = (double.tryParse(_controllers[key]?.text ?? '') ?? 0) > 0;
    
    return GestureDetector(
      onTap: () {
        if (_activeField == key && !hasValue) {
           _handleQuickFill(key);
        } else {
           setState(() => _activeField = key);
        }
      },
      onDoubleTap: () => _handleQuickFill(key),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: isActive ? color : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isActive ? color : Colors.grey.shade100,
            width: 2,
          ),
          boxShadow: isActive ? [BoxShadow(color: color.withValues(alpha: 0.15), blurRadius: 12, offset: const Offset(0, 6))] : [],
        ),
        child: Column(
          children: [
            Icon(icon, color: isActive ? Colors.white : Colors.blueGrey.shade400, size: 22),
            const SizedBox(height: 4),
            Text(
              label,
              style: GoogleFonts.outfit(
                fontSize: 10,
                fontWeight: FontWeight.w900,
                color: isActive ? Colors.white : Colors.blueGrey.shade600,
                letterSpacing: 0.5,
              ),
            ),
            if (hasValue) ...[
              const SizedBox(height: 4),
              Text(
                '₹${_controllers[key]!.text}',
                style: GoogleFonts.outfit(
                  fontSize: 12,
                  fontWeight: FontWeight.w900,
                  color: isActive ? Colors.white : color,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ]
          ],
        ),
      ),
    );
  }
}
