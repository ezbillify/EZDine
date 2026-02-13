import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'core/theme.dart';
import 'core/responsive.dart';
import 'core/supabase_config.dart';
import 'services/auth_service.dart';
import 'services/dashboard_service.dart';
import 'widgets/stat_card.dart';
import 'screens/pos_screen.dart';
import 'screens/kds_screen.dart';
import 'screens/inventory_screen.dart';
import 'screens/staff_roster_screen.dart';
import 'screens/purchase_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/reservation_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  await Supabase.initialize(
    url: SupabaseConfig.url,
    anonKey: SupabaseConfig.anonKey,
  );

  runApp(const ProviderScope(child: EZDineApp()));
}

class EZDineApp extends StatelessWidget {
  const EZDineApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'EZDine Pro',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      home: const SplashScreen(),
    );
  }
}

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    await Future.delayed(const Duration(milliseconds: 2500));
    if (!mounted) return;

    final session = Supabase.instance.client.auth.currentSession;
    if (session != null) {
      Navigator.pushReplacement(
        context, 
        PageRouteBuilder(
          pageBuilder: (c, a, sa) => const DashboardScreen(),
          transitionsBuilder: (c, a, sa, child) => FadeTransition(opacity: a, child: child),
          transitionDuration: 800.ms,
        ),
      );
    } else {
      Navigator.pushReplacement(
        context, 
        PageRouteBuilder(
          pageBuilder: (c, a, sa) => const LoginScreen(),
          transitionsBuilder: (c, a, sa, child) => FadeTransition(opacity: a, child: child),
          transitionDuration: 800.ms,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Stack(
        children: [
          Positioned(
            top: -100,
            right: -100,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppTheme.primary.withOpacity(0.05),
              ),
            ),
          ).animate(onPlay: (c) => c.repeat()).scale(begin: const Offset(1, 1), end: const Offset(1.5, 1.5), duration: 5.seconds, curve: Curves.easeInOut).fadeOut(),
          
          Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  height: 120,
                  width: 120,
                  decoration: BoxDecoration(
                    color: AppTheme.primary,
                    borderRadius: BorderRadius.circular(40),
                    boxShadow: [
                      BoxShadow(
                        color: AppTheme.primary.withOpacity(0.4),
                        blurRadius: 40,
                        offset: const Offset(0, 20),
                      ),
                    ],
                  ),
                  child: const Icon(LucideIcons.sparkles, color: Colors.white, size: 56),
                ).animate().scale(delay: 200.ms, duration: 600.ms, curve: Curves.easeOutBack).shimmer(delay: 1.seconds, duration: 1500.ms),
                const SizedBox(height: 40),
                Text(
                  'EZDine Pro',
                  style: GoogleFonts.outfit(
                    fontSize: 40,
                    fontWeight: FontWeight.w900,
                    color: AppTheme.secondary,
                    letterSpacing: -1.5,
                  ),
                ).animate().fadeIn(delay: 400.ms).slideY(begin: 0.2, end: 0),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: AppTheme.primary.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(100),
                  ),
                  child: Text(
                    'RESTAURANT OS',
                    style: GoogleFonts.outfit(
                      fontSize: 12,
                      fontWeight: FontWeight.w900,
                      color: AppTheme.primary,
                      letterSpacing: 3,
                    ),
                  ),
                ).animate().fadeIn(delay: 600.ms).scale(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _otpController = TextEditingController();
  bool _otpSent = false;
  bool _loading = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          Positioned(
            bottom: -150,
            left: -100,
            child: Container(
              width: 400,
              height: 400,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppTheme.primary.withOpacity(0.03),
              ),
            ),
          ),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 32.0),
                child: Container(
                  constraints: const BoxConstraints(maxWidth: 450),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _otpSent ? 'Verification\nRequired' : 'Enterprise\nAccess',
                        style: GoogleFonts.outfit(
                          fontSize: Responsive.isMobile(context) ? 48 : 64,
                          fontWeight: FontWeight.w900,
                          color: AppTheme.secondary,
                          height: 0.9,
                          letterSpacing: -2,
                        ),
                      ).animate().fadeIn().slideX(begin: -0.1, end: 0),
                      const SizedBox(height: 20),
                      Text(
                        _otpSent 
                          ? 'Authentication required. Check your inbox for the 6-digit secure code.'
                          : 'Sign in to your restaurant operating system to manage live service metrics.',
                        style: GoogleFonts.outfit(
                          fontSize: 16,
                          color: Colors.grey.shade500,
                          fontWeight: FontWeight.w500,
                          height: 1.5,
                        ),
                      ).animate().fadeIn(delay: 200.ms),
                      const SizedBox(height: 48),
                      
                      if (!_otpSent)
                        _buildInputField(
                          controller: _emailController,
                          hint: 'Work Email Address',
                          icon: LucideIcons.mail,
                          type: TextInputType.emailAddress,
                        ).animate().fadeIn(delay: 300.ms).slideY(begin: 0.1, end: 0)
                      else
                        _buildInputField(
                          controller: _otpController,
                          hint: '6-Digit Security Code',
                          icon: LucideIcons.shieldCheck,
                          type: TextInputType.number,
                        ).animate().fadeIn().scale(begin: const Offset(0.9, 0.9)),
                        
                      const SizedBox(height: 32),
                      
                      SizedBox(
                        width: double.infinity,
                        height: 68,
                        child: Consumer(
                          builder: (context, ref, _) {
                            return ElevatedButton(
                              onPressed: _loading ? null : () async {
                                HapticFeedback.mediumImpact();
                                setState(() => _loading = true);
                                try {
                                  final auth = ref.read(authServiceProvider);
                                  if (!_otpSent) {
                                    await auth.signInWithOtp(_emailController.text.trim());
                                    setState(() => _otpSent = true);
                                  } else {
                                    await auth.verifyOtp(_emailController.text.trim(), _otpController.text.trim());
                                    if (mounted) {
                                      Navigator.pushAndRemoveUntil(
                                        context, 
                                        PageRouteBuilder(
                                          pageBuilder: (c, a, sa) => const DashboardScreen(),
                                          transitionsBuilder: (c, a, sa, child) => FadeTransition(opacity: a, child: child),
                                          transitionDuration: 800.ms,
                                        ),
                                        (route) => false,
                                      );
                                    }
                                  }
                                } catch (e) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text('Auth Error: $e'), 
                                      backgroundColor: const Color(0xFFF43F5E),
                                      behavior: SnackBarBehavior.floating,
                                    )
                                  );
                                } finally {
                                  if (mounted) setState(() => _loading = false);
                                }
                              },
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppTheme.secondary,
                                foregroundColor: Colors.white,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(24),
                                ),
                                elevation: 0,
                              ),
                              child: _loading 
                                ? const SizedBox(height: 24, width: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                                : Text(
                                    _otpSent ? 'AUTHENTICATE' : 'GENERATE ACCESS CODE',
                                    style: GoogleFonts.outfit(
                                      fontWeight: FontWeight.w900,
                                      letterSpacing: 2,
                                      fontSize: 13,
                                    ),
                                  ),
                            );
                          }
                        ),
                      ).animate().fadeIn(delay: 500.ms).slideY(begin: 0.1, end: 0),
                      
                      const SizedBox(height: 24),
                      Center(
                        child: TextButton(
                          onPressed: () {
                             if(_otpSent) setState(() => _otpSent = false);
                          },
                          child: Text(
                            _otpSent ? 'Use a different email address' : 'Enterprise login troubleshooting',
                            style: GoogleFonts.outfit(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              color: Colors.grey.shade400,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInputField({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    TextInputType type = TextInputType.text,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.grey.shade100),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: TextField(
        controller: controller,
        keyboardType: type,
        autocorrect: false,
        style: GoogleFonts.outfit(fontWeight: FontWeight.w600, color: AppTheme.secondary),
        decoration: InputDecoration(
          hintText: hint,
          prefixIcon: Icon(icon, size: 22, color: AppTheme.secondary.withOpacity(0.5)),
          border: InputBorder.none,
          enabledBorder: InputBorder.none,
          focusedBorder: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 22),
          hintStyle: GoogleFonts.outfit(color: Colors.grey.shade400, fontWeight: FontWeight.w500),
        ),
      ),
    );
  }
}

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  void _showRestaurantSelector(BuildContext context, WidgetRef ref) async {
    final auth = ref.read(authServiceProvider);
    final contextState = ref.read(contextProvider);
    final restaurants = await auth.getMyRestaurants();

    if (!context.mounted) return;

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(32))),
      builder: (context) => Container(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('SWITCH RESTAURANT', style: GoogleFonts.outfit(fontWeight: FontWeight.w900, fontSize: 12, letterSpacing: 2, color: Colors.grey)),
            const SizedBox(height: 24),
            ...restaurants.map((r) => ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(r['name'], style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
              trailing: contextState.restaurantId == r['id'] ? const Icon(LucideIcons.checkCircle2, color: AppTheme.primary) : null,
              onTap: () {
                ref.read(contextProvider.notifier).switchRestaurant(r['id'], r['name']);
                Navigator.pop(context);
              },
            )),
          ],
        ),
      ),
    );
  }

  void _showBranchSelector(BuildContext context, WidgetRef ref) async {
    final contextState = ref.read(contextProvider);
    if (contextState.restaurantId == null) return;
    
    final auth = ref.read(authServiceProvider);
    final branches = await auth.getAccessibleBranches(contextState.restaurantId!);

    if (!context.mounted) return;

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(32))),
      builder: (context) => Container(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('SELECT BRANCH', style: GoogleFonts.outfit(fontWeight: FontWeight.w900, fontSize: 12, letterSpacing: 2, color: Colors.grey)),
            const SizedBox(height: 24),
            ...branches.map((b) => ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(b['name'], style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
              trailing: contextState.branchId == b['id'] ? const Icon(LucideIcons.checkCircle2, color: AppTheme.primary) : null,
              onTap: () {
                ref.read(contextProvider.notifier).switchBranch(b['id'], b['name']);
                Navigator.pop(context);
              },
            )),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bool isTablet = Responsive.isTablet(context) || Responsive.isDesktop(context);
    final ctx = ref.watch(contextProvider);
    final user = ref.watch(authServiceProvider).currentUser;
    final roleAsync = ref.watch(userRoleProvider);

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              ctx.restaurantName?.toUpperCase() ?? 'DASHBOARD',
              style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w900, letterSpacing: 2, color: AppTheme.secondary),
            ),
            if (ctx.branchName != null)
              Text(
                ctx.branchName!,
                style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.w600, color: Colors.grey),
              ),
          ],
        ),
        actions: [
          IconButton(onPressed: () => _showRestaurantSelector(context, ref), icon: const Icon(LucideIcons.building2, size: 20)),
          IconButton(onPressed: () => _showBranchSelector(context, ref), icon: const Icon(LucideIcons.mapPin, size: 20)),
          const SizedBox(width: 8),
          _buildUserMenu(context, ref, user),
          const SizedBox(width: 20),
        ],
      ),
      body: ctx.isLoading 
          ? const Center(child: CircularProgressIndicator())
          : roleAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, s) => Center(child: Text('Auth error: $e')),
              data: (role) {
                final String activeRole = role ?? 'waiter';
                return SingleChildScrollView(
                  key: const PageStorageKey('dashboard_scroll'),
                  padding: const EdgeInsets.all(24),
                  child: Center(
                    child: Container(
                      constraints: const BoxConstraints(maxWidth: 1200),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _buildServicePulse(activeRole).animate().fadeIn().slideY(begin: 0.1, end: 0),
                          const SizedBox(height: 32),
                          Text('OPERATIONAL INTELLIGENCE', style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.grey.shade400, letterSpacing: 2)).animate().fadeIn(delay: 200.ms),
                          const SizedBox(height: 20),
                          
                          if (ctx.branchId != null)
                            Consumer(
                              builder: (context, ref, _) {
                                final statsAsync = ref.watch(statsProvider(ctx.branchId!));
                                return statsAsync.when(
                                  data: (stats) => _buildStatGrid(isTablet, stats),
                                  loading: () => const Center(child: LinearProgressIndicator()),
                                  error: (e, s) => Text('Stats error: $e'),
                                );
                              }
                            ).animate().fadeIn(delay: 300.ms)
                          else
                            _buildStatGrid(isTablet, DashboardStats.empty()).animate().fadeIn(delay: 300.ms),

                          const SizedBox(height: 40),
                          Text('CONTROL MODULES', style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.grey.shade400, letterSpacing: 2)).animate().fadeIn(delay: 400.ms),
                          const SizedBox(height: 20),
                          _buildFilteredModuleGrid(context, activeRole, isTablet),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
    );
  }

  Widget _buildUserMenu(BuildContext context, WidgetRef ref, User? user) {
    return PopupMenuButton(
      offset: const Offset(0, 50),
      elevation: 10,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Container(
        padding: const EdgeInsets.all(2),
        decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: AppTheme.primary.withOpacity(0.2), width: 2)),
        child: const CircleAvatar(radius: 16, backgroundColor: AppTheme.secondary, child: Icon(LucideIcons.user, color: Colors.white, size: 16)),
      ),
      itemBuilder: (context) => <PopupMenuEntry>[
         PopupMenuItem(
           enabled: false,
           child: Column(
             crossAxisAlignment: CrossAxisAlignment.start,
             children: [
               Text(user?.email?.split('@')[0].toUpperCase() ?? 'ADMIN', style: GoogleFonts.outfit(fontWeight: FontWeight.w900, fontSize: 14)),
               Text(user?.email ?? '', style: GoogleFonts.outfit(fontSize: 11, color: Colors.grey)),
             ],
           ),
         ),
         const PopupMenuDivider(),
         PopupMenuItem(
           onTap: () async {
              await ref.read(authServiceProvider).signOut();
              if (context.mounted) {
                Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute(builder: (c) => const LoginScreen()), (route) => false);
              }
           },
           child: Row(
             children: [
               const Icon(LucideIcons.logOut, size: 18, color: Color(0xFFF43F5E)),
               const SizedBox(width: 12),
               Text('Terminate Session', style: GoogleFonts.outfit(color: const Color(0xFFF43F5E), fontWeight: FontWeight.bold)),
             ],
           ),
         ),
      ],
    );
  }

  Widget _buildServicePulse(String role) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppTheme.secondary,
        borderRadius: BorderRadius.circular(32),
        boxShadow: [BoxShadow(color: AppTheme.secondary.withOpacity(0.2), blurRadius: 30, offset: const Offset(0, 15))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('SYSTEM INTEGRITY', style: GoogleFonts.outfit(color: Colors.white.withOpacity(0.5), fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 2)),
                    const SizedBox(height: 4),
                    Text('Operational Level: High', style: GoogleFonts.outfit(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900), overflow: TextOverflow.ellipsis),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(color: const Color(0xFF10B981).withOpacity(0.2), borderRadius: BorderRadius.circular(100), border: Border.all(color: const Color(0xFF10B981).withOpacity(0.3))),
                child: Row(
                  children: [
                    Container(width: 8, height: 8, decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0xFF10B981))),
                    const SizedBox(width: 8),
                    Text(role.toUpperCase(), style: GoogleFonts.outfit(color: const Color(0xFF10B981), fontSize: 10, fontWeight: FontWeight.w900)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Row(
            children: List.generate(20, (i) {
              final h = 10 + (20 * (i % 3 == 0 ? 0.8 : (i % 2 == 0 ? 1.2 : 0.5)));
              return Expanded(
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 2),
                  height: h,
                  decoration: BoxDecoration(color: i > 12 ? Colors.white.withOpacity(0.1) : const Color(0xFF10B981).withOpacity(0.8), borderRadius: BorderRadius.circular(2)),
                ).animate(onPlay: (c) => c.repeat(reverse: true)).scaleY(begin: 0.5, end: 1.5, duration: (500 + (i * 50)).ms),
              );
            }),
          ),
        ],
      ),
    );
  }

  Widget _buildStatGrid(bool isTablet, DashboardStats stats) {
    if (isTablet) {
      return Row(
        children: [
          Expanded(child: AppStatCard(label: 'Gross Volume', value: '₹${stats.grossVolume.toStringAsFixed(0)}', icon: LucideIcons.trendingUp, color: AppTheme.primary, trend: 'LIVE', isUp: true)),
          const SizedBox(width: 20),
          Expanded(child: AppStatCard(label: 'Pending Orders', value: stats.pendingOrders.toString(), icon: LucideIcons.timer, color: Colors.amber, trend: 'LIVE', isUp: false)),
          const SizedBox(width: 20),
          Expanded(child: AppStatCard(label: 'Active Tables', value: stats.activeTables.toString(), icon: LucideIcons.users, color: Colors.indigo, trend: 'LIVE', isUp: true)),
        ],
      );
    }
    return Column(
      children: [
        AppStatCard(label: 'Gross Volume', value: '₹${stats.grossVolume.toStringAsFixed(0)}', icon: LucideIcons.trendingUp, color: AppTheme.primary, trend: 'LIVE', isUp: true),
        const SizedBox(height: 16),
        AppStatCard(label: 'Pending Orders', value: stats.pendingOrders.toString(), icon: LucideIcons.timer, color: Colors.amber, trend: 'LIVE', isUp: false),
      ],
    );
  }

  Widget _buildFilteredModuleGrid(BuildContext context, String role, bool isTablet) {
    final List<Map<String, dynamic>> allModules = [
      {
        'label': 'POS TERMINAL',
        'icon': LucideIcons.monitorCheck,
        'color': Colors.indigo,
        'roles': ['owner', 'manager', 'cashier', 'waiter'],
        'onTap': () => Navigator.push(context, MaterialPageRoute(builder: (c) => const PosScreen())),
      },
      {
        'label': 'KITCHEN KDS',
        'icon': LucideIcons.chefHat,
        'color': const Color(0xFF10B981),
        'roles': ['owner', 'manager', 'kitchen'],
        'onTap': () => Navigator.push(context, MaterialPageRoute(builder: (c) => const KdsScreen())),
      },
      {
        'label': 'RESERVATIONS',
        'icon': LucideIcons.calendarCheck,
        'color': Colors.deepPurple,
        'roles': ['owner', 'manager', 'host', 'waiter', 'cashier'],
        'onTap': () => Navigator.push(context, MaterialPageRoute(builder: (c) => const ReservationScreen())),
      },
      {
        'label': 'INVENTORY',
        'icon': LucideIcons.warehouse,
        'color': Colors.amber,
        'roles': ['owner', 'manager'],
        'onTap': () => Navigator.push(context, MaterialPageRoute(builder: (c) => const InventoryScreen())),
      },
      {
        'label': 'PURCHASE',
        'icon': LucideIcons.shoppingBag,
        'color': Colors.blueGrey,
        'roles': ['owner', 'manager'],
        'onTap': () => Navigator.push(context, MaterialPageRoute(builder: (c) => const PurchaseScreen())),
      },
      {
        'label': 'STAFF ROSTER',
        'icon': LucideIcons.users,
        'color': const Color(0xFFF43F5E),
        'roles': ['owner'],
        'onTap': () => Navigator.push(context, MaterialPageRoute(builder: (c) => const StaffRosterScreen())),
      },
      {
        'label': 'SETTINGS',
        'icon': LucideIcons.settings,
        'color': Colors.grey,
        'roles': ['owner', 'manager'],
        'onTap': () => Navigator.push(context, MaterialPageRoute(builder: (c) => const SettingsScreen())),
      },
    ];

    final filtered = allModules.where((m) => (m['roles'] as List).contains(role)).toList();

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: isTablet ? 4 : 2, mainAxisSpacing: 20, crossAxisSpacing: 20, childAspectRatio: 1.1),
      itemCount: filtered.length,
      itemBuilder: (context, index) {
        final mod = filtered[index];
        return _buildActionCard(mod['icon'], mod['label'], mod['color'], mod['onTap']).animate().fadeIn(delay: (500 + index * 100).ms).scale(curve: Curves.easeOutBack);
      },
    );
  }

  Widget _buildActionCard(IconData icon, String label, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(32),
          border: Border.all(color: Colors.grey.shade100),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.015), blurRadius: 20, offset: const Offset(0, 10))],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(padding: const EdgeInsets.all(16), decoration: BoxDecoration(color: color.withOpacity(0.08), shape: BoxShape.circle), child: Icon(icon, color: color, size: 30)),
            const SizedBox(height: 16),
            Text(label, style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.w900, color: AppTheme.secondary, letterSpacing: 1.2)),
          ],
        ),
      ),
    );
  }
}
