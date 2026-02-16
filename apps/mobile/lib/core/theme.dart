import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  static const Color primary = Color(0xFF007AFF);
  static const Color secondary = Color(0xFF1C1C1E);
  static const Color background = Color(0xFFF2F2F7);
  static const Color surface = Colors.white;
  static const Color error = Color(0xFFFF3B30);
  static const Color success = Color(0xFF34C759);

  static ThemeData lightTheme = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: primary,
      primary: primary,
      secondary: secondary,
      surface: background,
      onSurface: secondary,
      error: error,
    ),
    scaffoldBackgroundColor: background,
    textTheme: GoogleFonts.outfitTextTheme(),
    appBarTheme: AppBarTheme(
      backgroundColor: surface.withOpacity(0.9),
      elevation: 0,
      centerTitle: true,
      scrolledUnderElevation: 0,
      titleTextStyle: GoogleFonts.outfit(
        color: secondary,
        fontSize: 17,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.3,
      ),
      iconTheme: const IconThemeData(color: primary, size: 22),
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(28),
        side: BorderSide(color: Colors.grey.shade100, width: 1),
      ),
      color: surface,
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: GoogleFonts.outfit(fontWeight: FontWeight.w700, letterSpacing: -0.2),
        backgroundColor: primary,
        foregroundColor: Colors.white,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 22),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(24),
        borderSide: BorderSide(color: Colors.grey.shade100),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(24),
        borderSide: BorderSide(color: Colors.grey.shade100),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(24),
        borderSide: const BorderSide(color: primary, width: 2),
      ),
      labelStyle: GoogleFonts.outfit(color: Colors.grey, fontWeight: FontWeight.w500),
      hintStyle: GoogleFonts.outfit(
        color: Colors.grey.shade400,
        fontWeight: FontWeight.w500,
      ),
    ),
  );

  static List<BoxShadow> premiumShadow = [
    BoxShadow(
      color: Colors.black.withOpacity(0.04),
      blurRadius: 16,
      offset: const Offset(0, 4),
    ),
  ];
}
