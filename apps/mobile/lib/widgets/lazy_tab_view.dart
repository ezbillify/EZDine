import 'package:flutter/material.dart';

/// Optimized TabBarView that only builds visible tabs
/// Reduces lag and improves performance on mobile devices
class LazyTabView extends StatefulWidget {
  final TabController controller;
  final List<Widget Function()> tabBuilders;
  final bool keepAlive;

  const LazyTabView({
    super.key,
    required this.controller,
    required this.tabBuilders,
    this.keepAlive = false,
  });

  @override
  State<LazyTabView> createState() => _LazyTabViewState();
}

class _LazyTabViewState extends State<LazyTabView> {
  late List<Widget?> _cachedTabs;
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    _cachedTabs = List.filled(widget.tabBuilders.length, null);
    _currentIndex = widget.controller.index;
    
    // Build initial tab
    _buildTab(_currentIndex);
    
    // Listen to tab changes
    widget.controller.addListener(_onTabChanged);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onTabChanged);
    super.dispose();
  }

  void _onTabChanged() {
    if (widget.controller.index != _currentIndex) {
      setState(() {
        _currentIndex = widget.controller.index;
        _buildTab(_currentIndex);
      });
    }
  }

  void _buildTab(int index) {
    if (_cachedTabs[index] == null || !widget.keepAlive) {
      _cachedTabs[index] = widget.tabBuilders[index]();
    }
  }

  @override
  Widget build(BuildContext context) {
    return IndexedStack(
      index: _currentIndex,
      children: List.generate(
        widget.tabBuilders.length,
        (index) => _cachedTabs[index] ?? const SizedBox.shrink(),
      ),
    );
  }
}

/// Wrapper for tab content that preserves state
class KeepAliveTab extends StatefulWidget {
  final Widget child;

  const KeepAliveTab({super.key, required this.child});

  @override
  State<KeepAliveTab> createState() => _KeepAliveTabState();
}

class _KeepAliveTabState extends State<KeepAliveTab>
    with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return widget.child;
  }
}
