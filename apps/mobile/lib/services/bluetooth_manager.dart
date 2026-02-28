import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:permission_handler/permission_handler.dart';

/// Manages persistent Bluetooth connections with automatic reconnection
class BluetoothManager {
  static final BluetoothManager _instance = BluetoothManager._internal();
  factory BluetoothManager() => _instance;
  BluetoothManager._internal();

  final Map<String, BluetoothDevice> _connectedDevices = {};
  final Map<String, StreamSubscription> _connectionSubscriptions = {};
  final Map<String, DateTime> _lastConnectionAttempt = {};
  final Map<String, int> _reconnectAttempts = {};
  
  static const int _maxReconnectAttempts = 3;
  static const Duration _reconnectDelay = Duration(seconds: 2);
  static const Duration _connectionTimeout = Duration(seconds: 10);

  /// Get or create a persistent connection to a device
  Future<BluetoothDevice?> getDevice(String deviceId) async {
    try {
      // Check if already connected
      if (_connectedDevices.containsKey(deviceId)) {
        final device = _connectedDevices[deviceId]!;
        final isConnected = await device.connectionState.first == BluetoothConnectionState.connected;
        if (isConnected) {
          debugPrint("✓ Device $deviceId already connected");
          return device;
        }
      }

      // Ensure Bluetooth is ready
      if (!await _ensureBluetoothReady()) {
        return null;
      }

      // Create device instance
      final device = BluetoothDevice(remoteId: DeviceIdentifier(deviceId));
      
      // Attempt connection with retry logic
      return await _connectWithRetry(device, deviceId);
    } catch (e) {
      debugPrint("❌ Error getting device $deviceId: $e");
      return null;
    }
  }

  /// Connect to device with exponential backoff retry
  Future<BluetoothDevice?> _connectWithRetry(BluetoothDevice device, String deviceId) async {
    final attempts = _reconnectAttempts[deviceId] ?? 0;
    
    if (attempts >= _maxReconnectAttempts) {
      debugPrint("❌ Max reconnection attempts reached for $deviceId");
      _reconnectAttempts[deviceId] = 0;
      return null;
    }

    try {
      // Check rate limiting
      final lastAttempt = _lastConnectionAttempt[deviceId];
      if (lastAttempt != null) {
        final elapsed = DateTime.now().difference(lastAttempt);
        if (elapsed < _reconnectDelay) {
          await Future.delayed(_reconnectDelay - elapsed);
        }
      }

      _lastConnectionAttempt[deviceId] = DateTime.now();
      debugPrint("🔄 Connecting to $deviceId (attempt ${attempts + 1}/$_maxReconnectAttempts)");

      // Connect with timeout
      await device.connect(
        timeout: _connectionTimeout,
        autoConnect: false,
      );

      // Wait for connection to stabilize
      await Future.delayed(const Duration(milliseconds: 300));

      // Verify connection
      final state = await device.connectionState.first;
      if (state != BluetoothConnectionState.connected) {
        throw Exception("Connection failed");
      }

      // Request MTU for better throughput (Android)
      if (Platform.isAndroid) {
        try {
          await device.requestMtu(223);
        } catch (_) {}
      }

      // Store device and setup monitoring
      _connectedDevices[deviceId] = device;
      _reconnectAttempts[deviceId] = 0;
      _setupConnectionMonitoring(device, deviceId);

      debugPrint("✓ Successfully connected to $deviceId");
      return device;
    } catch (e) {
      debugPrint("⚠️ Connection attempt failed: $e");
      _reconnectAttempts[deviceId] = attempts + 1;
      
      // Retry with exponential backoff
      if (attempts + 1 < _maxReconnectAttempts) {
        final delay = _reconnectDelay * (attempts + 1);
        await Future.delayed(delay);
        return await _connectWithRetry(device, deviceId);
      }
      
      return null;
    }
  }

  /// Monitor connection state and auto-reconnect
  void _setupConnectionMonitoring(BluetoothDevice device, String deviceId) {
    _connectionSubscriptions[deviceId]?.cancel();
    
    _connectionSubscriptions[deviceId] = device.connectionState.listen((state) {
      debugPrint("📡 Device $deviceId state: $state");
      
      if (state == BluetoothConnectionState.disconnected) {
        debugPrint("⚠️ Device $deviceId disconnected, will reconnect on next use");
        _connectedDevices.remove(deviceId);
        _connectionSubscriptions[deviceId]?.cancel();
        _connectionSubscriptions.remove(deviceId);
      }
    });
  }

  /// Ensure Bluetooth is ready for use
  Future<bool> _ensureBluetoothReady() async {
    try {
      if (await FlutterBluePlus.isSupported == false) {
        debugPrint("❌ Bluetooth not supported");
        return false;
      }

      // Check permissions
      if (Platform.isAndroid) {
        final statuses = await [
          Permission.bluetoothScan,
          Permission.bluetoothConnect,
        ].request();
        
        if (statuses.values.any((s) => s.isDenied)) {
          debugPrint("❌ Bluetooth permissions denied");
          return false;
        }
      } else if (Platform.isIOS) {
        final status = await Permission.bluetooth.request();
        if (status.isDenied) {
          debugPrint("❌ Bluetooth permission denied");
          return false;
        }
      }

      // Check adapter state
      final state = await FlutterBluePlus.adapterState.first;
      if (state != BluetoothAdapterState.on) {
        if (Platform.isAndroid) {
          try {
            await FlutterBluePlus.turnOn();
            await FlutterBluePlus.adapterState
                .where((s) => s == BluetoothAdapterState.on)
                .first
                .timeout(const Duration(seconds: 3));
          } catch (e) {
            debugPrint("❌ Failed to turn on Bluetooth: $e");
            return false;
          }
        } else {
          debugPrint("❌ Bluetooth is off (iOS cannot turn on programmatically)");
          return false;
        }
      }

      return true;
    } catch (e) {
      debugPrint("❌ Error ensuring Bluetooth ready: $e");
      return false;
    }
  }

  /// Disconnect a specific device
  Future<void> disconnect(String deviceId) async {
    try {
      _connectionSubscriptions[deviceId]?.cancel();
      _connectionSubscriptions.remove(deviceId);
      
      final device = _connectedDevices.remove(deviceId);
      if (device != null) {
        await device.disconnect();
        debugPrint("✓ Disconnected from $deviceId");
      }
    } catch (e) {
      debugPrint("⚠️ Error disconnecting $deviceId: $e");
    }
  }

  /// Disconnect all devices
  Future<void> disconnectAll() async {
    final deviceIds = _connectedDevices.keys.toList();
    for (final id in deviceIds) {
      await disconnect(id);
    }
  }

  /// Reset reconnection attempts for a device
  void resetReconnectAttempts(String deviceId) {
    _reconnectAttempts[deviceId] = 0;
  }

  /// Get connection status
  Future<bool> isConnected(String deviceId) async {
    final device = _connectedDevices[deviceId];
    if (device == null) return false;
    
    try {
      final state = await device.connectionState.first;
      return state == BluetoothConnectionState.connected;
    } catch (_) {
      return false;
    }
  }
}
