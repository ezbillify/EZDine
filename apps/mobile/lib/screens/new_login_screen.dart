import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/theme.dart';
import '../core/responsive.dart';
import '../services/auth_service.dart';
import '../main.dart';

enum LoginMode { password, otp }

class NewLoginScreen extends ConsumerStatefulWidget {
  const NewLoginScreen({super.key});

  @override
  ConsumerState<NewLoginScreen> createState() => _NewLoginScreenState();
}

class _NewLoginScreenState extends ConsumerState<NewLoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _otpController = TextEditingController();
  
  LoginMode _loginMode = LoginMode.password;
  bool _otpSent = false;
  bool _loading = false;
  bool _obscurePassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _otpController.dispose();
    super.dispose();
  }

  Future<void> _handlePasswordLogin() async {
    if (_emailController.text.trim().isEmpty || _passwordController.text.isEmpty) {
      _showError('Please enter email and password');
      return;
    }

    setState(() => _loading = true);
    try {
      final response = await Supabase.instance.client.auth.signInWithPassword(
        email: _emailController.text.trim(),
        password: _passwordController.text,
      );
      
      if (response.session != null && mounted) {
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
    } catch (e) {
      _showError('Login failed: ${e.toString()}');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _handleOtpFlow() async {
    if (_emailController.text.trim().isEmpty) {
      _showError('Please enter your email');
      return;
    }

    setState(() => _loading = true);
    try {
      final auth = ref.read(authServiceProvider);
      
      if (!_otpSent) {
        // Send OTP
        await auth.signInWithOtp(_emailController.text.trim());
        setState(() => _otpSent = true);
      } else {
        // Verify OTP
        if (_otpController.text.trim().isEmpty) {
          _showError('Please enter the OTP code');
          return;
        }
        
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
      _showError('Error: ${e.toString()}');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: const Color(0xFFF43F5E),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _showForgotPassword() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _ForgotPasswordSheet(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Stack(
        children: [
          // Background decoration
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
                      // Logo
                      Center(
                        child: Container(
                          height: 80,
                          width: 80,
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(20),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.05),
                                blurRadius: 20,
                                offset: const Offset(0, 10),
                              ),
                            ],
                          ),
                          padding: const EdgeInsets.all(12),
                          child: Image.asset(
                            'assets/images/EZDineLOGO.png',
                            fit: BoxFit.contain,
                          ),
                        ),
                      ).animate().fadeIn().scale(begin: const Offset(0.8, 0.8)),
                      
                      const SizedBox(height: 32),
                      
                      // Title
                      Text(
                        'Welcome\nBack',
                        style: GoogleFonts.outfit(
                          fontSize: Responsive.isMobile(context) ? 48 : 64,
                          fontWeight: FontWeight.w900,
                          color: AppTheme.secondary,
                          height: 0.9,
                          letterSpacing: -2,
                        ),
                      ).animate().fadeIn(delay: 200.ms).slideX(begin: -0.1, end: 0),
                      
                      const SizedBox(height: 16),
                      
                      // Subtitle
                      Text(
                        _loginMode == LoginMode.otp && _otpSent
                            ? 'Enter the 6-digit code sent to your email'
                            : 'Sign in to your restaurant operating system',
                        style: GoogleFonts.outfit(
                          fontSize: 16,
                          color: Colors.grey.shade500,
                          fontWeight: FontWeight.w500,
                          height: 1.5,
                        ),
                      ).animate().fadeIn(delay: 200.ms),
                      
                      const SizedBox(height: 40),
                      
                      // Login Mode Tabs
                      if (!_otpSent) ...[
                        Container(
                          decoration: BoxDecoration(
                            color: Colors.grey.shade50,
                            borderRadius: BorderRadius.circular(16),
                          ),
                          padding: const EdgeInsets.all(4),
                          child: Row(
                            children: [
                              Expanded(
                                child: _buildModeTab(
                                  'Password',
                                  LoginMode.password,
                                  LucideIcons.lock,
                                ),
                              ),
                              Expanded(
                                child: _buildModeTab(
                                  'OTP',
                                  LoginMode.otp,
                                  LucideIcons.mail,
                                ),
                              ),
                            ],
                          ),
                        ).animate().fadeIn(delay: 300.ms),
                        const SizedBox(height: 32),
                      ],
                      
                      // Email Field (always shown)
                      _buildInputField(
                        controller: _emailController,
                        hint: 'Work Email Address',
                        icon: LucideIcons.mail,
                        type: TextInputType.emailAddress,
                        enabled: !_otpSent,
                      ).animate().fadeIn(delay: 400.ms).slideY(begin: 0.1, end: 0),
                      
                      const SizedBox(height: 16),
                      
                      // Password or OTP Field
                      if (_loginMode == LoginMode.password && !_otpSent)
                        _buildPasswordField()
                            .animate().fadeIn(delay: 500.ms).slideY(begin: 0.1, end: 0),
                      
                      if (_loginMode == LoginMode.otp && _otpSent)
                        _buildInputField(
                          controller: _otpController,
                          hint: '6-Digit Code',
                          icon: LucideIcons.shieldCheck,
                          type: TextInputType.number,
                        ).animate().fadeIn().scale(begin: const Offset(0.9, 0.9)),
                      
                      // Forgot Password Link
                      if (_loginMode == LoginMode.password && !_otpSent) ...[
                        const SizedBox(height: 12),
                        Align(
                          alignment: Alignment.centerRight,
                          child: TextButton(
                            onPressed: _showForgotPassword,
                            child: Text(
                              'Forgot Password?',
                              style: GoogleFonts.outfit(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: AppTheme.primary,
                              ),
                            ),
                          ),
                        ),
                      ],
                      
                      const SizedBox(height: 24),
                      
                      // Login Button
                      SizedBox(
                        width: double.infinity,
                        height: 64,
                        child: ElevatedButton(
                          onPressed: _loading ? null : () async {
                            HapticFeedback.mediumImpact();
                            if (_loginMode == LoginMode.password) {
                              await _handlePasswordLogin();
                            } else {
                              await _handleOtpFlow();
                            }
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.secondary,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(20),
                            ),
                            elevation: 0,
                          ),
                          child: _loading
                              ? const SizedBox(
                                  height: 24,
                                  width: 24,
                                  child: CircularProgressIndicator(
                                    color: Colors.white,
                                    strokeWidth: 2,
                                  ),
                                )
                              : Text(
                                  _getButtonText(),
                                  style: GoogleFonts.outfit(
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 1.5,
                                    fontSize: 14,
                                  ),
                                ),
                        ),
                      ).animate().fadeIn(delay: 600.ms).slideY(begin: 0.1, end: 0),
                      
                      // Back to Email (for OTP flow)
                      if (_otpSent) ...[
                        const SizedBox(height: 16),
                        Center(
                          child: TextButton(
                            onPressed: () {
                              setState(() {
                                _otpSent = false;
                                _otpController.clear();
                              });
                            },
                            child: Text(
                              'Use a different email',
                              style: GoogleFonts.outfit(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: Colors.grey.shade500,
                              ),
                            ),
                          ),
                        ),
                      ],
                      
                      const SizedBox(height: 32),
                      
                      // Legal Links (App Store Requirement)
                      Center(
                        child: Wrap(
                          alignment: WrapAlignment.center,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            TextButton(
                              onPressed: () async {
                                final uri = Uri.parse('https://ezdine.com/privacy');
                                if (await canLaunchUrl(uri)) {
                                  await launchUrl(uri, mode: LaunchMode.externalApplication);
                                } else {
                                  _showError('Could not open Privacy Policy');
                                }
                              },
                              child: Text(
                                'Privacy Policy',
                                style: GoogleFonts.outfit(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.grey.shade500,
                                  decoration: TextDecoration.underline,
                                ),
                              ),
                            ),
                            Text(' • ', style: TextStyle(color: Colors.grey.shade400)),
                            TextButton(
                              onPressed: () async {
                                final uri = Uri.parse('https://ezdine.com/terms');
                                if (await canLaunchUrl(uri)) {
                                  await launchUrl(uri, mode: LaunchMode.externalApplication);
                                } else {
                                  _showError('Could not open Terms of Service');
                                }
                              },
                              child: Text(
                                'Terms of Service',
                                style: GoogleFonts.outfit(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.grey.shade500,
                                  decoration: TextDecoration.underline,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      
                      const SizedBox(height: 24),
                      
                      // Branding
                      Center(
                        child: Text(
                          'POWERED BY EZBILLIFY',
                          style: GoogleFonts.outfit(
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                            color: Colors.grey.shade300,
                            letterSpacing: 2,
                          ),
                        ),
                      ),
                      
                      const SizedBox(height: 20),
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

  Widget _buildModeTab(String label, LoginMode mode, IconData icon) {
    final isActive = _loginMode == mode;
    return GestureDetector(
      onTap: () {
        setState(() {
          _loginMode = mode;
          _otpSent = false;
          _passwordController.clear();
          _otpController.clear();
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: isActive ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
          boxShadow: isActive
              ? [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 18,
              color: isActive ? AppTheme.secondary : Colors.grey.shade400,
            ),
            const SizedBox(width: 8),
            Text(
              label,
              style: GoogleFonts.outfit(
                fontWeight: isActive ? FontWeight.w900 : FontWeight.w600,
                fontSize: 13,
                color: isActive ? AppTheme.secondary : Colors.grey.shade400,
                letterSpacing: 0.5,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPasswordField() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
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
        controller: _passwordController,
        obscureText: _obscurePassword,
        autocorrect: false,
        style: GoogleFonts.outfit(
          fontWeight: FontWeight.w600,
          color: AppTheme.secondary,
        ),
        decoration: InputDecoration(
          hintText: 'Password',
          prefixIcon: Icon(
            LucideIcons.lock,
            size: 22,
            color: AppTheme.secondary.withOpacity(0.5),
          ),
          suffixIcon: IconButton(
            icon: Icon(
              _obscurePassword ? LucideIcons.eyeOff : LucideIcons.eye,
              size: 20,
              color: Colors.grey.shade400,
            ),
            onPressed: () {
              setState(() => _obscurePassword = !_obscurePassword);
            },
          ),
          border: InputBorder.none,
          enabledBorder: InputBorder.none,
          focusedBorder: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          hintStyle: GoogleFonts.outfit(
            color: Colors.grey.shade400,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }

  Widget _buildInputField({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    TextInputType type = TextInputType.text,
    bool enabled = true,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: enabled ? Colors.white : Colors.grey.shade50,
        borderRadius: BorderRadius.circular(20),
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
        enabled: enabled,
        style: GoogleFonts.outfit(
          fontWeight: FontWeight.w600,
          color: AppTheme.secondary,
        ),
        decoration: InputDecoration(
          hintText: hint,
          prefixIcon: Icon(
            icon,
            size: 22,
            color: AppTheme.secondary.withOpacity(0.5),
          ),
          border: InputBorder.none,
          enabledBorder: InputBorder.none,
          focusedBorder: InputBorder.none,
          disabledBorder: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          hintStyle: GoogleFonts.outfit(
            color: Colors.grey.shade400,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }

  String _getButtonText() {
    if (_loginMode == LoginMode.password) {
      return 'SIGN IN';
    } else {
      return _otpSent ? 'VERIFY CODE' : 'SEND CODE';
    }
  }
}

// Forgot Password Sheet
class _ForgotPasswordSheet extends StatefulWidget {
  @override
  State<_ForgotPasswordSheet> createState() => _ForgotPasswordSheetState();
}

enum ForgotPasswordStep { email, verifyOtp, newPassword }

class _ForgotPasswordSheetState extends State<_ForgotPasswordSheet> {
  final _emailController = TextEditingController();
  final _otpController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  
  ForgotPasswordStep _currentStep = ForgotPasswordStep.email;
  bool _loading = false;
  bool _obscureNewPassword = true;
  bool _obscureConfirmPassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _otpController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _sendOtp() async {
    if (_emailController.text.trim().isEmpty) {
      _showError('Please enter your email');
      return;
    }

    setState(() => _loading = true);
    try {
      await Supabase.instance.client.auth.signInWithOtp(
        email: _emailController.text.trim(),
        shouldCreateUser: false,
      );
      setState(() => _currentStep = ForgotPasswordStep.verifyOtp);
      _showSuccess('OTP sent to your email');
    } catch (e) {
      _showError('Error: ${e.toString()}');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _verifyOtp() async {
    if (_otpController.text.trim().isEmpty) {
      _showError('Please enter the OTP code');
      return;
    }

    setState(() => _loading = true);
    try {
      final response = await Supabase.instance.client.auth.verifyOTP(
        email: _emailController.text.trim(),
        token: _otpController.text.trim(),
        type: OtpType.email,
      );
      
      if (response.session != null) {
        setState(() => _currentStep = ForgotPasswordStep.newPassword);
        _showSuccess('OTP verified! Set your new password');
      } else {
        _showError('Invalid OTP code');
      }
    } catch (e) {
      _showError('Invalid OTP: ${e.toString()}');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _updatePassword() async {
    if (_newPasswordController.text.isEmpty) {
      _showError('Please enter a new password');
      return;
    }

    if (_newPasswordController.text.length < 6) {
      _showError('Password must be at least 6 characters');
      return;
    }

    if (_newPasswordController.text != _confirmPasswordController.text) {
      _showError('Passwords do not match');
      return;
    }

    setState(() => _loading = true);
    try {
      await Supabase.instance.client.auth.updateUser(
        UserAttributes(password: _newPasswordController.text),
      );
      
      if (mounted) {
        _showSuccess('Password updated successfully!');
        await Future.delayed(const Duration(seconds: 1));
        Navigator.pop(context);
      }
    } catch (e) {
      _showError('Error: ${e.toString()}');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: const Color(0xFFF43F5E),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _showSuccess(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: const Color(0xFF10B981),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  String _getTitle() {
    switch (_currentStep) {
      case ForgotPasswordStep.email:
        return 'Reset Password';
      case ForgotPasswordStep.verifyOtp:
        return 'Verify OTP';
      case ForgotPasswordStep.newPassword:
        return 'Set New Password';
    }
  }

  String _getDescription() {
    switch (_currentStep) {
      case ForgotPasswordStep.email:
        return 'Enter your email address to receive an OTP code';
      case ForgotPasswordStep.verifyOtp:
        return 'Enter the 6-digit code sent to your email';
      case ForgotPasswordStep.newPassword:
        return 'Choose a strong password for your account';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
      ),
      padding: EdgeInsets.only(
        left: 32,
        right: 32,
        top: 32,
        bottom: MediaQuery.of(context).viewInsets.bottom + 32,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  _getTitle(),
                  style: GoogleFonts.outfit(
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                    color: AppTheme.secondary,
                  ),
                ),
              ),
              IconButton(
                icon: const Icon(LucideIcons.x),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          
          const SizedBox(height: 16),
          
          Text(
            _getDescription(),
            style: GoogleFonts.outfit(
              fontSize: 14,
              color: Colors.grey.shade600,
              height: 1.5,
            ),
          ),
          
          const SizedBox(height: 24),
          
          // Step 1: Email Input
          if (_currentStep == ForgotPasswordStep.email) ...[
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: TextField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                autocorrect: false,
                style: GoogleFonts.outfit(
                  fontWeight: FontWeight.w600,
                  color: AppTheme.secondary,
                ),
                decoration: InputDecoration(
                  hintText: 'Work Email Address',
                  prefixIcon: Icon(
                    LucideIcons.mail,
                    size: 20,
                    color: AppTheme.secondary.withOpacity(0.5),
                  ),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 18,
                  ),
                  hintStyle: GoogleFonts.outfit(
                    color: Colors.grey.shade400,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 56,
              child: ElevatedButton(
                onPressed: _loading ? null : _sendOtp,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  elevation: 0,
                ),
                child: _loading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                    : Text(
                        'SEND OTP',
                        style: GoogleFonts.outfit(
                          fontWeight: FontWeight.w900,
                          letterSpacing: 1,
                          fontSize: 13,
                        ),
                      ),
              ),
            ),
          ],
          
          // Step 2: OTP Verification
          if (_currentStep == ForgotPasswordStep.verifyOtp) ...[
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: TextField(
                controller: _otpController,
                keyboardType: TextInputType.number,
                maxLength: 6,
                autocorrect: false,
                style: GoogleFonts.outfit(
                  fontWeight: FontWeight.w600,
                  color: AppTheme.secondary,
                  fontSize: 24,
                  letterSpacing: 8,
                ),
                textAlign: TextAlign.center,
                decoration: InputDecoration(
                  hintText: '000000',
                  counterText: '',
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 18,
                  ),
                  hintStyle: GoogleFonts.outfit(
                    color: Colors.grey.shade300,
                    fontWeight: FontWeight.w500,
                    letterSpacing: 8,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                TextButton(
                  onPressed: () => setState(() => _currentStep = ForgotPasswordStep.email),
                  child: Text(
                    'Change Email',
                    style: GoogleFonts.outfit(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Colors.grey.shade500,
                    ),
                  ),
                ),
                TextButton(
                  onPressed: _loading ? null : _sendOtp,
                  child: Text(
                    'Resend OTP',
                    style: GoogleFonts.outfit(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.primary,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              height: 56,
              child: ElevatedButton(
                onPressed: _loading ? null : _verifyOtp,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  elevation: 0,
                ),
                child: _loading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                    : Text(
                        'VERIFY OTP',
                        style: GoogleFonts.outfit(
                          fontWeight: FontWeight.w900,
                          letterSpacing: 1,
                          fontSize: 13,
                        ),
                      ),
              ),
            ),
          ],
          
          // Step 3: New Password
          if (_currentStep == ForgotPasswordStep.newPassword) ...[
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: TextField(
                controller: _newPasswordController,
                obscureText: _obscureNewPassword,
                autocorrect: false,
                style: GoogleFonts.outfit(
                  fontWeight: FontWeight.w600,
                  color: AppTheme.secondary,
                ),
                decoration: InputDecoration(
                  hintText: 'New Password',
                  prefixIcon: Icon(
                    LucideIcons.lock,
                    size: 20,
                    color: AppTheme.secondary.withOpacity(0.5),
                  ),
                  suffixIcon: IconButton(
                    icon: Icon(
                      _obscureNewPassword ? LucideIcons.eyeOff : LucideIcons.eye,
                      size: 20,
                      color: Colors.grey.shade400,
                    ),
                    onPressed: () => setState(() => _obscureNewPassword = !_obscureNewPassword),
                  ),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 18,
                  ),
                  hintStyle: GoogleFonts.outfit(
                    color: Colors.grey.shade400,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: TextField(
                controller: _confirmPasswordController,
                obscureText: _obscureConfirmPassword,
                autocorrect: false,
                style: GoogleFonts.outfit(
                  fontWeight: FontWeight.w600,
                  color: AppTheme.secondary,
                ),
                decoration: InputDecoration(
                  hintText: 'Confirm Password',
                  prefixIcon: Icon(
                    LucideIcons.lock,
                    size: 20,
                    color: AppTheme.secondary.withOpacity(0.5),
                  ),
                  suffixIcon: IconButton(
                    icon: Icon(
                      _obscureConfirmPassword ? LucideIcons.eyeOff : LucideIcons.eye,
                      size: 20,
                      color: Colors.grey.shade400,
                    ),
                    onPressed: () => setState(() => _obscureConfirmPassword = !_obscureConfirmPassword),
                  ),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 18,
                  ),
                  hintStyle: GoogleFonts.outfit(
                    color: Colors.grey.shade400,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 56,
              child: ElevatedButton(
                onPressed: _loading ? null : _updatePassword,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  elevation: 0,
                ),
                child: _loading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                    : Text(
                        'UPDATE PASSWORD',
                        style: GoogleFonts.outfit(
                          fontWeight: FontWeight.w900,
                          letterSpacing: 1,
                          fontSize: 13,
                        ),
                      ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
