import 'package:flutter/material.dart';
import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import '../services/auth_service.dart';
import '../core/theme.dart';


// Providers
final reservationsProvider = FutureProvider.family<List<Map<String, dynamic>>, String>((ref, branchId) async {
  final res = await Supabase.instance.client
      .from('reservations')
      .select()
      .eq('branch_id', branchId)
      .gte('reservation_time', DateTime.now().toIso8601String().split('T')[0]) // From today onwards
      .order('reservation_time', ascending: true);
  return List<Map<String, dynamic>>.from(res);
});

final waitlistProvider = FutureProvider.family<List<Map<String, dynamic>>, String>((ref, branchId) async {
  final res = await Supabase.instance.client
      .from('waitlist')
      .select()
      .eq('branch_id', branchId)
      .or('status.eq.waiting,status.eq.notified') // Only active
      .order('token_number', ascending: true);
  return List<Map<String, dynamic>>.from(res);
});

class ReservationScreen extends ConsumerStatefulWidget {
  const ReservationScreen({super.key});

  @override
  ConsumerState<ReservationScreen> createState() => _ReservationScreenState();
}

class _ReservationScreenState extends ConsumerState<ReservationScreen> {
  int _activeTab = 0; // 0: Reservations, 1: Waitlist (Token)

  @override
  Widget build(BuildContext context) {
    final ctx = ref.watch(contextProvider);
    if (ctx.branchId == null) return Scaffold(body: Center(child: Text('Please select branch')));

    final reservationsAsync = ref.watch(reservationsProvider(ctx.branchId!));
    final waitlistAsync = ref.watch(waitlistProvider(ctx.branchId!));

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('GUEST MANAGEMENT', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
        leading: IconButton(
          icon: const Icon(LucideIcons.chevronLeft),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: Column(
        children: [
          // Tabs
          Container(
            padding: const EdgeInsets.all(16),
            color: Colors.white,
            child: Row(
              children: [
                _TabButton(
                  label: 'RESERVATIONS',
                  icon: LucideIcons.calendar,
                  isSelected: _activeTab == 0,
                  onTap: () => setState(() => _activeTab = 0),
                ),
                const SizedBox(width: 12),
                _TabButton(
                  label: 'WAITLIST TOKEN',
                  icon: LucideIcons.ticket,
                  isSelected: _activeTab == 1,
                  onTap: () => setState(() => _activeTab = 1),
                ),
              ],
            ),
          ),

          // Content
          Expanded(
            child: _activeTab == 0
                ? _buildReservationsList(reservationsAsync)
                : _buildWaitlistList(waitlistAsync),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppTheme.secondary,
        icon: const Icon(LucideIcons.plus, color: Colors.white),
        label: Text(_activeTab == 0 ? 'NEW BOOKING' : 'ISSUE TOKEN', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
        onPressed: () {
            if (_activeTab == 0) {
              _showAddReservationSheet();
            } else {
              _showAddWaitlistSheet();
            }
        },
      ),
    );
  }

  Widget _buildReservationsList(AsyncValue<List<Map<String, dynamic>>> async) {
    return async.when(
      data: (reservations) {
        if (reservations.isEmpty) return _emptyState('No active reservations');
        return ListView.separated(
          padding: const EdgeInsets.all(24),
          itemCount: reservations.length,
          separatorBuilder: (c, i) => const SizedBox(height: 16),
          itemBuilder: (context, index) {
            final res = reservations[index];
            final time = DateTime.parse(res['reservation_time']).toLocal();
            final status = res['status'].toString().toUpperCase();

            // Disable interactions for cancelled reservations
            final isCancelled = res['status'] == 'cancelled';

            return Opacity(
              opacity: isCancelled ? 0.6 : 1.0, 
              child: Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: Colors.grey.shade100),
                ),
                child: Row(
                  children: [
                    Column(
                      children: [
                        Text(DateFormat('MMM').format(time).toUpperCase(), style: TextStyle(color: AppTheme.primary, fontWeight: FontWeight.w900, fontSize: 10)),
                        Text(DateFormat('dd').format(time), style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 24)),
                        Text(DateFormat('HH:mm').format(time), style: TextStyle(color: Colors.grey.shade500, fontSize: 10, fontWeight: FontWeight.bold)),
                      ],
                    ),
                    const SizedBox(width: 24),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(res['customer_name'], style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, decoration: isCancelled ? TextDecoration.lineThrough : null)),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                               Icon(LucideIcons.users, size: 12, color: Colors.grey.shade400),
                               const SizedBox(width: 4),
                               Text('${res['party_size']} Guests', style: TextStyle(color: Colors.grey.shade500, fontSize: 12)),
                            ],
                          ),
                          const SizedBox(height: 8),
                          _statusBadge(status, _getResStatusColor(res['status'])),
                        ],
                      ),
                    ),
                    if (!isCancelled)
                      IconButton(
                        icon: const Icon(LucideIcons.moreVertical, size: 18),
                        onPressed: () => _showResActionSheet(res), // Show actions
                      ),
                  ],
                ),
              ).animate().fadeIn(delay: (index * 50).ms).slideX(begin: 0.1, end: 0),
            );
          },
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, s) => Center(child: Text('Error: $e')),
    );
  }

  Widget _buildWaitlistList(AsyncValue<List<Map<String, dynamic>>> async) {
    return async.when(
      data: (waitlist) {
        if (waitlist.isEmpty) return _emptyState('Waitlist is empty');
        return ListView.separated(
          padding: const EdgeInsets.all(24),
          itemCount: waitlist.length,
          separatorBuilder: (c, i) => const SizedBox(height: 16),
          itemBuilder: (context, index) {
            final entry = waitlist[index];
            final status = entry['status'].toString().toUpperCase();

            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: Colors.grey.shade100),
              ),
              child: Row(
                children: [
                   Container(
                     height: 50, width: 50,
                     decoration: BoxDecoration(color: AppTheme.secondary.withOpacity(0.1), borderRadius: BorderRadius.circular(16)),
                     child: Center(
                       child: Column(
                         mainAxisAlignment: MainAxisAlignment.center,
                         children: [
                           Text('TOKEN', style: TextStyle(fontSize: 8, fontWeight: FontWeight.bold, color: AppTheme.secondary)),
                           Text('${entry['token_number']}', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: AppTheme.secondary)),
                         ],
                       ),
                     ),
                   ),
                   const SizedBox(width: 16),
                   Expanded(
                     child: Column(
                       crossAxisAlignment: CrossAxisAlignment.start,
                       children: [
                         Text(entry['customer_name'], style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                         Text('Party of ${entry['party_size']} • ${entry['phone']}', style: TextStyle(color: Colors.grey.shade500, fontSize: 12)),
                       ],
                     ),
                   ),
                   _statusBadge(status, Colors.orange),
                   IconButton(
                     icon: const Icon(LucideIcons.moreVertical, size: 18),
                     onPressed: () => _showWaitActionSheet(entry),
                   ),
                ],
              ),
            ).animate().fadeIn(delay: (index * 50).ms).slideX(begin: 0.1, end: 0);
          },
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, s) => Center(child: Text('Error: $e')),
    );
  }

  Future<void> _updateWaitStatus(String id, String status) async {
    try {
      await Supabase.instance.client.from('waitlist').update({'status': status}).eq('id', id);
      ref.refresh(waitlistProvider(ref.read(contextProvider).branchId!));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  void _showWaitActionSheet(Map<String, dynamic> entry) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (c) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.symmetric(vertical: 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(LucideIcons.bell, color: Colors.blue),
              title: const Text('Notify Customer'),
              onTap: () {
                Navigator.pop(context);
                _updateWaitStatus(entry['id'], 'notified');
              },
            ),
            ListTile(
              leading: const Icon(LucideIcons.checkCircle, color: Colors.green),
              title: const Text('Mark as Seated'),
              onTap: () {
                Navigator.pop(context);
                _updateWaitStatus(entry['id'], 'seated');
              },
            ),
             ListTile(
              leading: const Icon(LucideIcons.xCircle, color: Colors.red),
              title: const Text('Cancel Token', style: TextStyle(color: Colors.red)),
              onTap: () {
                Navigator.pop(context);
                _updateWaitStatus(entry['id'], 'cancelled');
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _emptyState(String msg) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(LucideIcons.clipboardList, size: 64, color: Colors.grey.shade200),
          const SizedBox(height: 16),
          Text(msg, style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey.shade400)),
        ],
      ),
    );
  }

  Widget _statusBadge(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
      child: Text(text, style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1)),
    );
  }

  Color _getResStatusColor(String status) {
    if (status == 'confirmed') return Colors.blue;
    if (status == 'seated') return const Color(0xFF10B981);
    return Colors.grey;
  }

  Future<void> _updateResStatus(String id, String status) async {
    try {
      await Supabase.instance.client.from('reservations').update({'status': status}).eq('id', id);
      ref.refresh(reservationsProvider(ref.read(contextProvider).branchId!));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  void _showResActionSheet(Map<String, dynamic> res) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (c) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.symmetric(vertical: 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(LucideIcons.checkCircle, color: Colors.green),
              title: const Text('Mark as Seated'),
              onTap: () {
                Navigator.pop(context);
                _updateResStatus(res['id'], 'seated');
              },
            ),
             ListTile(
              leading: const Icon(LucideIcons.xCircle, color: Colors.red),
              title: const Text('Cancel Booking', style: TextStyle(color: Colors.red)),
              onTap: () {
                Navigator.pop(context);
                _updateResStatus(res['id'], 'cancelled');
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showAddReservationSheet() {
    showModalBottomSheet(
      context: context, 
      isScrollControlled: true,
      backgroundColor: Colors.transparent, // Fixes extended background issue
      builder: (_) => _AddReservationSheet(ref: ref)
    ).then((_) => ref.refresh(reservationsProvider(ref.read(contextProvider).branchId!)));
  }

  void _showAddWaitlistSheet() {
     showModalBottomSheet(
      context: context, 
      isScrollControlled: true,
      backgroundColor: Colors.transparent, // Fixes extended background issue
      builder: (_) => _AddWaitlistSheet(ref: ref)
    ).then((_) => ref.refresh(waitlistProvider(ref.read(contextProvider).branchId!)));
  }
}

class _TabButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool isSelected;
  final VoidCallback onTap;

  const _TabButton({required this.label, required this.icon, required this.isSelected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: isSelected ? Colors.black : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: isSelected ? Colors.black : Colors.grey.shade200),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 16, color: isSelected ? Colors.white : Colors.black),
              const SizedBox(width: 8),
              Text(label, style: TextStyle(fontWeight: FontWeight.w900, color: isSelected ? Colors.white : Colors.black, fontSize: 12)),
            ],
          ),
        ),
      ),
    );
  }
}

class _AddReservationSheet extends StatefulWidget {
  final WidgetRef ref;
  const _AddReservationSheet({required this.ref});

  @override
  State<_AddReservationSheet> createState() => _AddReservationSheetState();
}

class _AddReservationSheetState extends State<_AddReservationSheet> {
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _partyCtrl = TextEditingController(text: '2');
  DateTime _date = DateTime.now();
  TimeOfDay _time = TimeOfDay.now();
  bool _isLoading = false;

  Future<void> _save() async {
    if (_nameCtrl.text.isEmpty || _phoneCtrl.text.isEmpty) return;
    setState(() => _isLoading = true);
    
    try {
      final ctx = widget.ref.read(contextProvider);
      final dt = DateTime(_date.year, _date.month, _date.day, _time.hour, _time.minute);

      await Supabase.instance.client.from('reservations').insert({
        'restaurant_id': ctx.restaurantId!,
        'branch_id': ctx.branchId!,
        'customer_name': _nameCtrl.text,
        'phone': _phoneCtrl.text,
        'party_size': int.tryParse(_partyCtrl.text) ?? 2,
        'reservation_time': dt.toIso8601String(),
        'status': 'confirmed'
      });
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.9,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (_, scrollController) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
             Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)), margin: const EdgeInsets.only(bottom: 24)),
             Expanded(
               child: ListView(
                 controller: scrollController,
                 children: [
                    const Text('NEW RESERVATION', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                    const SizedBox(height: 24),
                    _MobileCustomerSearch(
                      onSelect: (cust) {
                        _nameCtrl.text = cust['name'];
                        _phoneCtrl.text = cust['phone'];
                      },
                      ref: widget.ref,
                    ),
                    const SizedBox(height: 12),
                    TextField(controller: _nameCtrl, decoration: const InputDecoration(labelText: 'Guest Name', border: OutlineInputBorder())),
                    const SizedBox(height: 12),
                    TextField(controller: _phoneCtrl, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone', border: OutlineInputBorder())),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(child: TextField(controller: _partyCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Party Size', border: OutlineInputBorder()))),
                        const SizedBox(width: 12),
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () async {
                              final t = await showTimePicker(context: context, initialTime: _time);
                              if (t != null) setState(() => _time = t);
                            },
                            child: Text(_time.format(context), style: const TextStyle(fontWeight: FontWeight.bold)),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _isLoading ? null : _save,
                        style: ElevatedButton.styleFrom(backgroundColor: Colors.black, foregroundColor: Colors.white, padding: const EdgeInsets.all(16)),
                        child: _isLoading ? const CircularProgressIndicator(color: Colors.white) : const Text('CONFIRM BOOKING'),
                      ),
                    )
                 ],
               ),
             ),
          ],
        ),
      ),
    );
  }
}

class _AddWaitlistSheet extends StatefulWidget {
  final WidgetRef ref;
  const _AddWaitlistSheet({required this.ref});

  @override
  State<_AddWaitlistSheet> createState() => _AddWaitlistSheetState();
}

class _AddWaitlistSheetState extends State<_AddWaitlistSheet> {
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _partyCtrl = TextEditingController(text: '2');
  bool _isLoading = false;

  Future<void> _save() async {
    if (_nameCtrl.text.isEmpty) return;
    setState(() => _isLoading = true);
    
    try {
      final ctx = widget.ref.read(contextProvider);
      
      // 1. Get Token
      final token = await Supabase.instance.client.rpc('next_waitlist_token', params: {'p_branch_id': ctx.branchId!});

      // 2. Insert
      await Supabase.instance.client.from('waitlist').insert({
        'restaurant_id': ctx.restaurantId!,
        'branch_id': ctx.branchId!,
        'customer_name': _nameCtrl.text,
        'phone': _phoneCtrl.text,
        'party_size': int.tryParse(_partyCtrl.text) ?? 2,
        'token_number': token,
        'status': 'waiting'
      });
      
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Token #$token Issued!')));
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.9,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (_, scrollController) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
             Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)), margin: const EdgeInsets.only(bottom: 24)),
             Expanded(
               child: ListView(
                 controller: scrollController,
                 children: [
                    const Text('ISSUE WAITLIST TOKEN', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                    const SizedBox(height: 24),
                    _MobileCustomerSearch(
                      onSelect: (cust) {
                        _nameCtrl.text = cust['name'];
                        _phoneCtrl.text = cust['phone'];
                      },
                      ref: widget.ref,
                    ),
                    const SizedBox(height: 12),
                    TextField(controller: _nameCtrl, decoration: const InputDecoration(labelText: 'Guest Name', border: OutlineInputBorder())),
                    const SizedBox(height: 12),
                    TextField(controller: _phoneCtrl, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone', border: OutlineInputBorder())),
                    const SizedBox(height: 12),
                    TextField(controller: _partyCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Party Size', border: OutlineInputBorder())),
                    const SizedBox(height: 24),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _isLoading ? null : _save,
                        style: ElevatedButton.styleFrom(backgroundColor: AppTheme.secondary, foregroundColor: Colors.white, padding: const EdgeInsets.all(16)),
                        child: _isLoading ? const CircularProgressIndicator(color: Colors.white) : const Text('GENERATE TOKEN'),
                      ),
                    )
                 ],
               ),
             ),
          ],
        ),
      ),
    );
  }
}

class _MobileCustomerSearch extends StatefulWidget {
  final Function(Map<String, dynamic>) onSelect;
  final WidgetRef ref;
  const _MobileCustomerSearch({required this.onSelect, required this.ref});

  @override
  State<_MobileCustomerSearch> createState() => _MobileCustomerSearchState();
}

class _MobileCustomerSearchState extends State<_MobileCustomerSearch> {
  final _searchCtrl = TextEditingController();
  List<Map<String, dynamic>> _results = [];
  bool _isLoading = false;
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }

  void _onSearch(String query) {
    if (_debounce?.isActive ?? false) _debounce!.cancel();
    if (query.length < 3) {
      if (mounted) setState(() => _results = []);
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 500), () => _performSearch(query));
  }

  Future<void> _performSearch(String query) async {
    setState(() => _isLoading = true);
    try {
      final res = await Supabase.instance.client
          .from('customers')
          .select()
          .ilike('phone', '%$query%')
          .limit(3);
      if (mounted) setState(() => _results = List<Map<String, dynamic>>.from(res));
    } catch (e) {
      // silent fail
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        TextField(
          controller: _searchCtrl,
          onChanged: _onSearch,
          keyboardType: TextInputType.phone,
          decoration: InputDecoration(
            labelText: 'Search Customer (Phone)',
            prefixIcon: const Icon(LucideIcons.search, size: 16),
            suffixIcon: _isLoading ? const Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator(strokeWidth: 2)) : null,
            border: const OutlineInputBorder(),
            filled: true,
            fillColor: Colors.grey.shade50,
          ),
        ),
        if (_results.isNotEmpty)
          Container(
            margin: const EdgeInsets.only(top: 8),
            decoration: BoxDecoration(
              border: Border.all(color: Colors.grey.shade200),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              children: _results.map((c) => ListTile(
                dense: true,
                leading: const Icon(LucideIcons.user, size: 16),
                title: Text(c['name'], style: const TextStyle(fontWeight: FontWeight.bold)),
                subtitle: Text(c['phone']),
                onTap: () {
                  widget.onSelect(c);
                  setState(() {
                    _results = [];
                    _searchCtrl.clear();
                  });
                },
              )).toList(),
            ),
          )
      ],
    );
  }
}
