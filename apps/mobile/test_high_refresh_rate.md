# High Refresh Rate Testing Guide

## Quick Test Checklist

### 1. Visual Verification (Debug Mode)
- [ ] Launch app in debug mode
- [ ] Look for FPS counter in top-right corner
- [ ] Tap FPS counter to expand details
- [ ] Verify "Mode" shows correct refresh rate (60fps or 120fps)
- [ ] Check "Target" matches device specs

### 2. Console Output Verification
Look for these debug prints on app startup:
```
🎯 Display refresh rate: 120.0Hz
🎯 High refresh rate mode: true
⚡ Enabling 120fps optimizations
📊 Performance monitoring started
```

### 3. Performance Verification

#### On 60Hz Device (iPhone 11, Standard Android)
- [ ] FPS counter shows 55-60 FPS (green)
- [ ] Mode shows "60fps"
- [ ] Target shows "60Hz"
- [ ] Scrolling feels smooth
- [ ] Search debounce: 300ms
- [ ] Cart throttle: 200ms

#### On 120Hz Device (iPhone 13 Pro+, Samsung S20+)
- [ ] FPS counter shows 110-120 FPS (green)
- [ ] Mode shows "120fps"
- [ ] Target shows "120Hz"
- [ ] Scrolling feels ultra-smooth
- [ ] Search debounce: 200ms
- [ ] Cart throttle: 100ms

### 4. Functional Tests

#### Menu Scrolling
- [ ] Open POS screen
- [ ] Scroll through menu items rapidly
- [ ] FPS should stay green (95%+)
- [ ] No stuttering or lag
- [ ] Items load smoothly

#### Tab Switching
- [ ] Open Reports screen (4 tabs)
- [ ] Switch between tabs rapidly
- [ ] Each switch should be <300ms
- [ ] No visible lag
- [ ] Content loads instantly

#### Search Performance
- [ ] Open POS screen
- [ ] Type in search box rapidly
- [ ] Debouncing should feel natural
- [ ] Results appear smoothly
- [ ] No input lag

#### Cart Operations
- [ ] Add items to cart rapidly
- [ ] Throttling prevents duplicates
- [ ] Updates feel instant
- [ ] No lag or delay

### 5. Device-Specific Tests

#### Test on Multiple Devices

**60Hz Devices:**
- iPhone 11 and earlier
- Standard Android phones
- Budget devices

**90Hz Devices:**
- OnePlus 7 Pro+
- Google Pixel 4+
- Some Samsung Galaxy

**120Hz Devices:**
- iPhone 13 Pro+
- Samsung Galaxy S20+
- OnePlus 8 Pro+
- iPad Pro (2018+)

### 6. Performance Metrics

#### Expected Results

**60Hz Device:**
```
Average FPS: 58-60
Dropped Frames: <5 per minute
Mode: 60fps
Target: 60Hz
Cache Extent: 500px
Debounce: 300ms
Throttle: 200ms
```

**120Hz Device:**
```
Average FPS: 115-120
Dropped Frames: <5 per minute
Mode: 120fps
Target: 120Hz
Cache Extent: 800px
Debounce: 200ms
Throttle: 100ms
```

### 7. Common Issues

#### FPS Counter Shows Red
- **Cause**: Heavy background processes, thermal throttling
- **Fix**: Close background apps, let device cool down

#### Mode Shows 60fps on 120Hz Device
- **Cause**: Battery saver enabled, power saving mode
- **Fix**: Disable battery saver, charge device

#### Inconsistent FPS
- **Cause**: Network requests blocking UI, heavy computations
- **Fix**: Check debug logs, profile with DevTools

#### High Dropped Frames
- **Cause**: Complex widget trees, no RepaintBoundary
- **Fix**: Review widget structure, add RepaintBoundary

### 8. Debug Commands

#### Check Performance Config
```dart
print('Refresh Rate: ${PerformanceConfig().refreshRate}');
print('High Refresh: ${PerformanceConfig().isHighRefreshRate}');
print('Cache Extent: ${PerformanceConfig().optimalCacheExtent}');
print('Debounce: ${PerformanceConfig().optimalDebounceDuration}');
print('Throttle: ${PerformanceConfig().optimalThrottleDuration}');
```

#### Get Performance Report
```dart
final report = PerformanceMonitor().getReport();
print('Performance Report: $report');
```

### 9. Profiling with DevTools

1. Run app in profile mode: `flutter run --profile`
2. Open DevTools: `flutter pub global run devtools`
3. Navigate to Performance tab
4. Record performance while scrolling
5. Check for:
   - Frame rendering time (<8.33ms for 120fps)
   - Shader compilation jank
   - Layout/paint time
   - Memory usage

### 10. Success Criteria

- [ ] FPS counter shows green (95%+) on all screens
- [ ] Dropped frames <10 per minute
- [ ] Scrolling feels smooth at native refresh rate
- [ ] Search debouncing feels natural
- [ ] Cart operations feel instant
- [ ] Tab switching <300ms
- [ ] No visible stuttering or lag
- [ ] Memory usage stable (<200MB)

---

## Quick Test Script

Run this on each device type:

1. **Launch app** → Check console for refresh rate detection
2. **Open POS** → Scroll menu, check FPS counter
3. **Search items** → Type rapidly, verify debouncing
4. **Add to cart** → Tap rapidly, verify throttling
5. **Switch tabs** → Reports screen, rapid switching
6. **Check stats** → Tap FPS counter, verify metrics
7. **Profile** → DevTools, record performance

**Expected Time**: 5-10 minutes per device

---

## Automated Testing (Future)

```dart
// Integration test example
testWidgets('High refresh rate performance', (tester) async {
  await tester.pumpWidget(MyApp());
  
  // Verify initialization
  expect(PerformanceConfig().refreshRate, greaterThanOrEqualTo(60));
  
  // Test scrolling performance
  await tester.fling(find.byType(GridView), Offset(0, -500), 1000);
  await tester.pumpAndSettle();
  
  // Verify FPS
  expect(PerformanceMonitor().averageFps, greaterThan(55));
  
  // Verify dropped frames
  expect(PerformanceMonitor().droppedFrames, lessThan(10));
});
```

---

**Status**: Ready for Testing  
**Priority**: High  
**Estimated Time**: 30-60 minutes (all devices)
