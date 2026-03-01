import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'dart:async';
import '../core/performance_config.dart';

/// Performance overlay showing FPS and refresh rate
/// Only visible in debug mode
class PerformanceOverlay extends StatefulWidget {
  final Widget child;
  final bool enabled;

  const PerformanceOverlay({
    super.key,
    required this.child,
    this.enabled = kDebugMode,
  });

  @override
  State<PerformanceOverlay> createState() => _PerformanceOverlayState();
}

class _PerformanceOverlayState extends State<PerformanceOverlay> {
  Timer? _updateTimer;
  double _currentFps = 0;
  bool _showOverlay = false;

  @override
  void initState() {
    super.initState();
    if (widget.enabled) {
      _startMonitoring();
    }
  }

  @override
  void dispose() {
    _updateTimer?.cancel();
    super.dispose();
  }

  void _startMonitoring() {
    _updateTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) {
        setState(() {
          _currentFps = PerformanceMonitor().averageFps;
        });
      }
    });
  }

  void _toggleOverlay() {
    setState(() {
      _showOverlay = !_showOverlay;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.enabled) {
      return widget.child;
    }

    return Directionality(
      textDirection: TextDirection.ltr,
      child: Stack(
        children: [
          widget.child,
          
          // Toggle button
          Positioned(
            top: MediaQuery.of(context).padding.top + 10,
            right: 10,
            child: GestureDetector(
              onTap: _toggleOverlay,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.7),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '${_currentFps.toStringAsFixed(0)} FPS',
                  style: TextStyle(
                    color: _getFpsColor(),
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
          ),
        
        // Detailed overlay
        if (_showOverlay)
          Positioned(
            top: MediaQuery.of(context).padding.top + 40,
            right: 10,
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.85),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white.withOpacity(0.2)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  _buildStatRow('FPS', _currentFps.toStringAsFixed(1), _getFpsColor()),
                  const SizedBox(height: 4),
                  _buildStatRow(
                    'Target',
                    '${PerformanceConfig().refreshRate.toStringAsFixed(0)}Hz',
                    Colors.white70,
                  ),
                  const SizedBox(height: 4),
                  _buildStatRow(
                    'Mode',
                    PerformanceConfig().isHighRefreshRate ? '120fps' : '60fps',
                    PerformanceConfig().isHighRefreshRate ? Colors.green : Colors.blue,
                  ),
                  const SizedBox(height: 4),
                  _buildStatRow(
                    'Dropped',
                    '${PerformanceMonitor().droppedFrames}',
                    PerformanceMonitor().droppedFrames > 10 ? Colors.red : Colors.green,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatRow(String label, String value, Color color) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          '$label: ',
          style: const TextStyle(
            color: Colors.white70,
            fontSize: 10,
            fontWeight: FontWeight.normal,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            color: color,
            fontSize: 10,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }

  Color _getFpsColor() {
    final targetFps = PerformanceConfig().refreshRate;
    final percentage = (_currentFps / targetFps) * 100;
    
    if (percentage >= 95) return Colors.green;
    if (percentage >= 80) return Colors.yellow;
    if (percentage >= 60) return Colors.orange;
    return Colors.red;
  }
}
