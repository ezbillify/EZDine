import 'dart:async';
import 'package:flutter/foundation.dart';
import '../core/performance_config.dart';

/// Intelligent caching service for POS operations
class PosCacheService {
  static final PosCacheService _instance = PosCacheService._internal();
  factory PosCacheService() => _instance;
  PosCacheService._internal();

  // Cache storage
  final Map<String, List<Map<String, dynamic>>> _orderItemsCache = {};
  final Map<String, Map<String, dynamic>> _orderDetailsCache = {};
  final Map<String, DateTime> _cacheTimestamps = {};
  
  // Cache configuration
  static const Duration _cacheExpiry = Duration(minutes: 5);
  static const int _maxCacheSize = 50;

  /// Get cached order items
  List<Map<String, dynamic>>? getOrderItems(String orderId) {
    if (!_isValid(orderId)) {
      _orderItemsCache.remove(orderId);
      return null;
    }
    return _orderItemsCache[orderId];
  }

  /// Cache order items
  void cacheOrderItems(String orderId, List<Map<String, dynamic>> items) {
    _cleanupIfNeeded();
    _orderItemsCache[orderId] = items;
    _cacheTimestamps[orderId] = DateTime.now();
    debugPrint('✓ Cached ${items.length} items for order $orderId');
  }

  /// Get cached order details
  Map<String, dynamic>? getOrderDetails(String orderId) {
    if (!_isValid(orderId)) {
      _orderDetailsCache.remove(orderId);
      return null;
    }
    return _orderDetailsCache[orderId];
  }

  /// Cache order details
  void cacheOrderDetails(String orderId, Map<String, dynamic> details) {
    _cleanupIfNeeded();
    _orderDetailsCache[orderId] = details;
    _cacheTimestamps[orderId] = DateTime.now();
  }

  /// Check if cache entry is valid
  bool _isValid(String key) {
    final timestamp = _cacheTimestamps[key];
    if (timestamp == null) return false;
    
    final age = DateTime.now().difference(timestamp);
    return age < _cacheExpiry;
  }

  /// Cleanup old cache entries
  void _cleanupIfNeeded() {
    if (_cacheTimestamps.length > _maxCacheSize) {
      final sortedKeys = _cacheTimestamps.entries.toList()
        ..sort((a, b) => a.value.compareTo(b.value));
      
      // Remove oldest 20%
      final removeCount = (_maxCacheSize * 0.2).ceil();
      for (var i = 0; i < removeCount; i++) {
        final key = sortedKeys[i].key;
        _orderItemsCache.remove(key);
        _orderDetailsCache.remove(key);
        _cacheTimestamps.remove(key);
      }
      
      debugPrint('🧹 Cleaned up $removeCount old cache entries');
    }
  }

  /// Invalidate specific order cache
  void invalidateOrder(String orderId) {
    _orderItemsCache.remove(orderId);
    _orderDetailsCache.remove(orderId);
    _cacheTimestamps.remove(orderId);
    debugPrint('🗑️ Invalidated cache for order $orderId');
  }

  /// Clear all cache
  void clearAll() {
    _orderItemsCache.clear();
    _orderDetailsCache.clear();
    _cacheTimestamps.clear();
    debugPrint('🗑️ Cleared all POS cache');
  }

  /// Get cache statistics
  Map<String, dynamic> getStats() {
    return {
      'orderItemsCount': _orderItemsCache.length,
      'orderDetailsCount': _orderDetailsCache.length,
      'totalEntries': _cacheTimestamps.length,
      'oldestEntry': _cacheTimestamps.values.isEmpty 
          ? null 
          : _cacheTimestamps.values.reduce((a, b) => a.isBefore(b) ? a : b),
    };
  }
}

/// Adaptive debouncer for search and filter operations
/// Automatically adjusts delay based on device refresh rate
class Debouncer {
  final Duration? delay;
  Timer? _timer;

  Debouncer({this.delay});

  /// Get optimal delay based on device capabilities
  Duration get _optimalDelay {
    return delay ?? PerformanceConfig().optimalDebounceDuration;
  }

  void call(VoidCallback action) {
    _timer?.cancel();
    _timer = Timer(_optimalDelay, action);
  }

  void dispose() {
    _timer?.cancel();
  }
}

/// Adaptive throttler for rapid operations
/// Automatically adjusts duration based on device refresh rate
class Throttler {
  final Duration? duration;
  DateTime? _lastExecution;

  Throttler({this.duration});

  /// Get optimal duration based on device capabilities
  Duration get _optimalDuration {
    return duration ?? PerformanceConfig().optimalThrottleDuration;
  }

  bool shouldExecute() {
    final now = DateTime.now();
    if (_lastExecution == null || 
        now.difference(_lastExecution!) > _optimalDuration) {
      _lastExecution = now;
      return true;
    }
    return false;
  }
}
