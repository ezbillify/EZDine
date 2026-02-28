# High Refresh Rate - Quick Reference Card

## 🚀 Quick Start

Your app now automatically optimizes for 60Hz, 90Hz, 120Hz, and 144Hz+ displays!

---

## How It Works

```
App Launch → Detect Refresh Rate → Set Adaptive Values → All Components Optimize Automatically
```

**No configuration needed!** Everything adapts automatically.

---

## Key Components

### 1. PerformanceConfig (Singleton)
```dart
// Get refresh rate
final hz = PerformanceConfig().refreshRate; // 60, 90, 120, etc.

// Check if high refresh rate
final isHigh = PerformanceConfig().isHighRefreshRate; // true if >= 90Hz

// Get adaptive values
final debounce = PerformanceConfig().optimalDebounceDuration;
final throttle = PerformanceConfig().optimalThrottleDuration;
final cacheExtent = PerformanceConfig().optimalCacheExtent;
```

### 2. Adaptive Debouncer
```dart
// Create (automatically uses optimal delay)
final debouncer = Debouncer();

// Use in search
debouncer(() {
  performSearch(query);
});

// Custom delay (optional)
final customDebouncer = Debouncer(delay: Duration(milliseconds: 150));
```

### 3. Adaptive Throttler
```dart
// Create (automatically uses optimal duration)
final throttler = Throttler();

// Use in rapid operations
if (throttler.shouldExecute()) {
  addToCart(item);
}

// Custom duration (optional)
final customThrottler = Throttler(duration: Duration(milliseconds: 50));
```

### 4. Performance Monitor
```dart
// Get current FPS
final fps = PerformanceMonitor().averageFps;

// Get dropped frames
final dropped = PerformanceMonitor().droppedFrames;

// Get full report
final report = PerformanceMonitor().getReport();
print('FPS: ${report['averageFps']}');
print('Dropped: ${report['droppedFrames']}');
```

### 5. Performance Overlay (Debug Only)
```dart
// Wrap your app
PerformanceOverlay(
  child: MaterialApp(...),
)

// Shows FPS counter in top-right
// Tap to expand for details
// Only visible in debug mode
```

### 6. Optimized Grid
```dart
OptimizedMenuGrid(
  items: menuItems,
  itemBuilder: (item) => MenuCard(item: item),
  crossAxisCount: 2,
  childAspectRatio: 0.8,
)

// Automatically uses adaptive cache extent
// 500px on 60Hz, 800px on 120Hz
```

---

## Adaptive Values

| Value | 60Hz Device | 120Hz Device |
|-------|-------------|--------------|
| Debounce | 300ms | 200ms |
| Throttle | 200ms | 100ms |
| Cache Extent | 500px | 800px |
| Target FPS | 60 | 120 |

---

## Debug Features

### Console Output
```
🎯 Display refresh rate: 120.0Hz
🎯 High refresh rate mode: true
⚡ Enabling 120fps optimizations
📊 Performance monitoring started
```

### FPS Counter (Debug Mode)
- Top-right corner
- Color-coded: Green (95%+), Yellow (80-94%), Orange (60-79%), Red (<60%)
- Tap to expand for details

### Performance Stats
```dart
final report = PerformanceMonitor().getReport();
// {
//   'averageFps': '118.5',
//   'droppedFrames': 3,
//   'targetFps': 120.0,
//   'isHighRefreshRate': true
// }
```

---

## Common Patterns

### Search with Debouncing
```dart
final _debouncer = Debouncer();

TextField(
  onChanged: (value) {
    _debouncer(() {
      setState(() => _searchQuery = value);
    });
  },
)
```

### Cart with Throttling
```dart
final _throttler = Throttler();

void addToCart(item) {
  if (_throttler.shouldExecute()) {
    setState(() {
      _cartItems.add(item);
    });
  }
}
```

### Optimized List
```dart
OptimizedMenuGrid(
  items: items,
  itemBuilder: (item) => RepaintBoundary(
    child: ItemCard(item: item),
  ),
)
```

---

## Performance Targets

### 60Hz Display
- Target: 60 FPS
- Frame Time: 16.67ms
- Acceptable: 55+ FPS

### 120Hz Display
- Target: 120 FPS
- Frame Time: 8.33ms
- Acceptable: 114+ FPS

---

## Best Practices

### ✅ DO
- Use adaptive debouncer/throttler
- Add RepaintBoundary to complex widgets
- Use const constructors
- Let components use adaptive values automatically
- Monitor FPS in debug mode

### ❌ DON'T
- Hardcode timing values
- Block the main thread
- Ignore performance warnings
- Skip RepaintBoundary on complex widgets
- Forget to dispose resources

---

## Quick Test

1. Launch app in debug mode
2. Check console for: `🎯 Display refresh rate: XXHz`
3. Look for FPS counter in top-right
4. Tap counter to see details
5. Verify mode matches device (60fps or 120fps)

---

## Troubleshooting

### FPS Counter Red
- Close background apps
- Disable battery saver
- Let device cool down

### Wrong Mode Detected
- Disable power saving
- Charge device
- Restart app

### Inconsistent FPS
- Profile with DevTools
- Check debug logs
- Review widget structure

---

## Files Reference

| File | Purpose |
|------|---------|
| `lib/core/performance_config.dart` | Config & monitoring |
| `lib/widgets/performance_overlay.dart` | Visual FPS counter |
| `lib/services/pos_cache_service.dart` | Debouncer & throttler |
| `lib/widgets/optimized_menu_grid.dart` | Optimized grid |
| `HIGH_REFRESH_RATE.md` | Full documentation |
| `test_high_refresh_rate.md` | Testing guide |

---

## Support

### Documentation
- **Full Guide**: `HIGH_REFRESH_RATE.md`
- **Testing**: `test_high_refresh_rate.md`
- **Status**: `FINAL_STATUS.md`

### Debug Tools
- Flutter DevTools
- Performance overlay
- Console logs
- FPS counter

---

**Quick Tip**: Everything adapts automatically! Just use the components and they'll optimize for the device's refresh rate.

**Status**: ✅ Production Ready  
**Supported**: 60Hz, 90Hz, 120Hz, 144Hz+  
**Configuration**: None needed (automatic)
