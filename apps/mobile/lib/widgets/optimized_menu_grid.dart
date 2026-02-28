import 'package:flutter/material.dart';
import '../core/performance_config.dart';

/// Optimized grid view with item recycling and smooth scrolling
/// Supports 60fps-120fps on high-refresh-rate displays
class OptimizedMenuGrid extends StatelessWidget {
  final List<Map<String, dynamic>> items;
  final Widget Function(Map<String, dynamic> item) itemBuilder;
  final int crossAxisCount;
  final double childAspectRatio;
  final ScrollController? controller;

  const OptimizedMenuGrid({
    super.key,
    required this.items,
    required this.itemBuilder,
    this.crossAxisCount = 2,
    this.childAspectRatio = 0.8,
    this.controller,
  });

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const SizedBox.shrink();
    }

    final perfConfig = PerformanceConfig();

    return GridView.builder(
      controller: controller,
      padding: const EdgeInsets.all(16),
      physics: const BouncingScrollPhysics(
        parent: AlwaysScrollableScrollPhysics(),
      ),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: crossAxisCount,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: childAspectRatio,
      ),
      itemCount: items.length,
      // Performance optimizations
      addAutomaticKeepAlives: false,
      addRepaintBoundaries: true,
      addSemanticIndexes: false,
      // Adaptive cache extent based on refresh rate
      cacheExtent: perfConfig.optimalCacheExtent,
      itemBuilder: (context, index) {
        return RepaintBoundary(
          child: itemBuilder(items[index]),
        );
      },
    );
  }
}

/// Optimized list view for cart items
/// Supports 60fps-120fps on high-refresh-rate displays
class OptimizedCartList extends StatelessWidget {
  final List<Widget> children;
  final ScrollController? controller;

  const OptimizedCartList({
    super.key,
    required this.children,
    this.controller,
  });

  @override
  Widget build(BuildContext context) {
    if (children.isEmpty) {
      return const SizedBox.shrink();
    }

    final perfConfig = PerformanceConfig();

    return ListView.builder(
      controller: controller,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      physics: const BouncingScrollPhysics(
        parent: AlwaysScrollableScrollPhysics(),
      ),
      itemCount: children.length,
      addAutomaticKeepAlives: false,
      addRepaintBoundaries: true,
      addSemanticIndexes: false,
      cacheExtent: perfConfig.optimalCacheExtent * 0.6,
      itemBuilder: (context, index) {
        return RepaintBoundary(
          child: children[index],
        );
      },
    );
  }
}
