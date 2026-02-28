# Bug Fix: Cart Delete and Total Amount Issues on Mobile

## Issues Description

### Issue 1: Delete Not Working
When using the POS screen on mobile devices, clicking the delete button (minus icon) to remove items from the cart was not working. The item quantity would decrease but when it reached 0, the item would not be removed from the cart display.

### Issue 2: Total Amount Not Updating
When items were deleted or quantities changed in the mobile cart, the total amount displayed at the bottom was not updating in real-time. It would only update after closing and reopening the cart.

## Root Cause

The mobile cart is displayed in a modal bottom sheet (`showModalBottomSheet`). The issues were:

1. **Delete Issue**: The modal's widget tree was built once and did not rebuild when the parent widget's state changed
2. **Total Issue**: The total was calculated from `widget.total` (parent state) instead of the local cart state, so it didn't reflect real-time changes

## Solution

Created a new `_MobileCartSheet` StatefulWidget that:

1. **Maintains local state**: Keeps a local copy of the cart (`_localCart`) that can be updated independently
2. **Calculates local total**: Computes total from `_localCart` in real-time using a getter
3. **Syncs with parent**: Updates both the local state and the parent state when items are modified
4. **Rebuilds on changes**: Uses its own `setState` to rebuild the modal when items are deleted or quantities change

### Code Changes

**File**: `apps/mobile/lib/screens/pos_screen.dart`

#### Before (Broken)
```dart
void _showMobileCart(BuildContext context) {
  showModalBottomSheet(
    context: context,
    builder: (c) => Material(
      child: Container(
        child: _buildCartArea(), // Static, doesn't rebuild
      ),
    ),
  );
}
```

#### After (Fixed)
```dart
void _showMobileCart(BuildContext context) {
  showModalBottomSheet(
    context: context,
    builder: (c) => _MobileCartSheet(
      cart: _cart,
      onUpdateQty: _updateQty,
      // ... other props
    ),
  );
}

class _MobileCartSheet extends StatefulWidget {
  // Maintains its own state
  final List<Map<String, dynamic>> cart;
  final Function(String, int) onUpdateQty;
  
  @override
  State<_MobileCartSheet> createState() => _MobileCartSheetState();
}

class _MobileCartSheetState extends State<_MobileCartSheet> {
  late List<Map<String, dynamic>> _localCart;
  
  @override
  void initState() {
    super.initState();
    _localCart = List.from(widget.cart);
  }
  
  // Calculate total from local cart in real-time
  double get _localTotal {
    return _localCart.fold<double>(0, (sum, item) {
      final price = (item['base_price'] ?? 0).toDouble();
      final qty = (item['qty'] ?? 0).toInt();
      return sum + (price * qty);
    });
  }
  
  void _updateLocalQty(String id, int delta) {
    setState(() {
      // Update local cart
      final index = _localCart.indexWhere((i) => i['id'] == id);
      if (index >= 0) {
        _localCart[index]['qty'] += delta;
        if (_localCart[index]['qty'] <= 0) {
          _localCart.removeAt(index); // Item removed immediately
        }
      }
      // Total recalculates automatically via _localTotal getter
    });
    // Also update parent
    widget.onUpdateQty(id, delta);
  }
  
  @override
  Widget build(BuildContext context) {
    return Material(
      child: Column(
        children: [
          // ... cart items ...
          
          // Total display - uses _localTotal for real-time updates
          Text('₹${(_localTotal + widget.existingOrderTotal).toStringAsFixed(2)}'),
        ],
      ),
    );
  }
}
```

## Technical Details

### Why StatefulWidget?

The modal bottom sheet needs to maintain its own state to:
- Respond immediately to user interactions
- Rebuild its UI when items are deleted
- Sync changes back to the parent widget

### State Management Flow

```
User clicks minus button
    ↓
_updateLocalQty called
    ↓
Local cart updated (setState)
    ↓
_localTotal getter recalculates automatically
    ↓
Modal rebuilds with new items and total
    ↓
Parent state updated (onUpdateQty)
    ↓
Both states in sync
```

### Benefits

1. **Immediate feedback**: UI updates instantly when delete is clicked
2. **Real-time total**: Total amount recalculates automatically
3. **Proper state sync**: Parent and modal stay synchronized
4. **No breaking changes**: Existing functionality preserved
5. **Clean separation**: Modal manages its own display state
6. **Performance**: Total calculated efficiently using getter

## Testing

### Test Steps

1. Open POS screen on mobile device
2. Add items to cart
3. Tap cart icon to open mobile cart modal
4. Click minus button to decrease quantity
5. When quantity reaches 0, item should disappear immediately
6. Verify cart total updates correctly
7. Close and reopen modal to verify parent state is synced

### Expected Behavior

- ✅ Item quantity decreases when minus is clicked
- ✅ Item disappears from cart when quantity reaches 0
- ✅ Cart total updates immediately and accurately
- ✅ Total recalculates in real-time as items change
- ✅ Empty cart message shows when all items removed
- ✅ Parent state stays synchronized
- ✅ No lag or delay in total updates

### Edge Cases Tested

- [x] Delete last item in cart
- [x] Delete multiple items in sequence
- [x] Delete item then close/reopen modal
- [x] Delete item with existing order items present
- [x] Clear entire cart with trash icon

## Files Modified

- `apps/mobile/lib/screens/pos_screen.dart`
  - Modified `_showMobileCart` function
  - Added `_MobileCartSheet` StatefulWidget
  - Added `_MobileCartSheetState` class

## Lines Changed

- **Added**: ~260 lines (new widget with total calculation)
- **Modified**: ~20 lines (_showMobileCart function)
- **Total**: ~280 lines

## Impact

- **Scope**: Mobile cart modal only
- **Breaking Changes**: None
- **Performance**: No impact (same number of rebuilds)
- **Compatibility**: Fully backward compatible

## Related Issues

This fix also improves:
- Cart responsiveness on mobile
- State management clarity
- Modal interaction reliability
- Real-time total calculation accuracy
- User experience with instant feedback

## Future Improvements

Consider:
- Add swipe-to-delete gesture
- Add undo functionality
- Add haptic feedback on delete
- Add delete confirmation for expensive items

---

**Status**: ✅ Fixed  
**Priority**: High  
**Tested**: Yes  
**Breaking Changes**: None  
**Ready for Production**: Yes
