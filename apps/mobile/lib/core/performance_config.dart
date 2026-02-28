import 'package:flutter/scheduler.dart';
import 'package:flutter/foundation.dart';

/// Performance configuration for high-refresh-rate displays
class PerformanceConfig {
  static final PerformanceConfig _instance = PerformanceConfig._internal();
  factory PerformanceConfig() => _instance;
  PerformanceConfig._internal();

  double? _displayRefreshRate;
  bool _isHighRefreshRate = false;

  /// Initialize and detect display refresh rate
  Future<void> initialize() async {
    try {
      // Get display refresh rate
      final display = SchedulerBinding.instance.platformDispatcher.displays.first;
      _displayRefreshRate = display.refreshRate;
      _isHighRefreshRate = (_displayRefreshRate ?? 60) >= 90;
      
      debugPrint('🎯 Display refresh rate: ${_displayRefreshRate}Hz');
      debugPrint('🎯 High refresh rate mode: $_isHighRefreshRate');
      
      // Enable high performance mode
      if (_isHighRefreshRate) {
        debugPrint('⚡ Enabling 120fps optimizations');
      }
    } catch (e) {
      debugPrint('⚠️ Could not detect refresh rate: $e');
      _displayRefreshRate = 60;
      _isHighRefreshRate = false;
    }
  }

  /// Get the display refresh rate
  double get refreshRate => _displayRefreshRate ?? 60;

  /// Check if device supports high refresh rate
  bool get isHighRefreshRate => _isHighRefreshRate;

  /// Get optimal animation duration based on refresh rate
  Duration getAnimationDuration(Duration baseAt60fps) {
    if (!_isHighRefreshRate) return baseAt60fps;
    
    // Scale animation duration for higher refresh rates
    // 120fps = half the duration for same smoothness
    final scaleFactor = 60 / refreshRate;
    return Duration(
      milliseconds: (baseAt60fps.inMilliseconds * scaleFactor).round(),
    );
  }

  /// Get optimal debounce duration
  Duration get optimalDebounceDuration {
    return _isHighRefreshRate 
        ? const Duration(milliseconds: 200) 
        : const Duration(milliseconds: 300);
  }

  /// Get optimal throttle duration
  Duration get optimalThrottleDuration {
    return _isHighRefreshRate 
        ? const Duration(milliseconds: 100) 
        : const Duration(milliseconds: 200);
  }

  /// Get optimal cache extent for lists
  double get optimalCacheExtent {
    return _isHighRefreshRate ? 800.0 : 500.0;
  }

  /// Get optimal chunk size for data loading
  int get optimalChunkSize {
    return _isHighRefreshRate ? 30 : 20;
  }

  /// Check if we should use advanced optimizations
  bool get useAdvancedOptimizations => _isHighRefreshRate;
}

/// Performance monitoring for frame drops
class PerformanceMonitor {
  static final PerformanceMonitor _instance = PerformanceMonitor._internal();
  factory PerformanceMonitor() => _instance;
  PerformanceMonitor._internal();

  final List<Duration> _frameTimes = [];
  int _droppedFrames = 0;

  /// Start monitoring performance
  void startMonitoring() {
    SchedulerBinding.instance.addTimingsCallback(_onFrameTimings);
    debugPrint('📊 Performance monitoring started');
  }

  /// Stop monitoring
  void stopMonitoring() {
    SchedulerBinding.instance.removeTimingsCallback(_onFrameTimings);
  }

  void _onFrameTimings(List<FrameTiming> timings) {
    for (final timing in timings) {
      final frameDuration = timing.totalSpan;
      _frameTimes.add(frameDuration);
      
      // Keep only last 60 frames
      if (_frameTimes.length > 60) {
        _frameTimes.removeAt(0);
      }

      // Detect dropped frames (>16.67ms for 60fps, >8.33ms for 120fps)
      final targetFrameTime = PerformanceConfig().isHighRefreshRate 
          ? const Duration(microseconds: 8333) 
          : const Duration(microseconds: 16667);
      
      if (frameDuration > targetFrameTime * 2) {
        _droppedFrames++;
      }
    }
  }

  /// Get average FPS
  double get averageFps {
    if (_frameTimes.isEmpty) return 0;
    
    final avgDuration = _frameTimes.fold<Duration>(
      Duration.zero,
      (sum, duration) => sum + duration,
    ) ~/ _frameTimes.length;
    
    return 1000000 / avgDuration.inMicroseconds;
  }

  /// Get dropped frame count
  int get droppedFrames => _droppedFrames;

  /// Reset statistics
  void reset() {
    _frameTimes.clear();
    _droppedFrames = 0;
  }

  /// Get performance report
  Map<String, dynamic> getReport() {
    return {
      'averageFps': averageFps.toStringAsFixed(1),
      'droppedFrames': _droppedFrames,
      'targetFps': PerformanceConfig().refreshRate,
      'isHighRefreshRate': PerformanceConfig().isHighRefreshRate,
    };
  }
}
