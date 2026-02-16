import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/services.dart';

class AudioService {
  static final AudioService instance = AudioService._internal();
  AudioService._internal();

  final AudioPlayer _player = AudioPlayer();

  Future<void> playClick() async {
    HapticFeedback.lightImpact();
    // Use a short, subtle click sound if available, otherwise just haptic
  }

  Future<void> playSuccess() async {
    HapticFeedback.mediumImpact();
    // await _player.play(AssetSource('sounds/success.mp3'));
  }

  Future<void> playError() async {
    HapticFeedback.heavyImpact();
    // await _player.play(AssetSource('sounds/error.mp3'));
  }

  Future<void> playOrderAlert() async {
    HapticFeedback.vibrate();
    // play a more prominent sound for kitchen alerts
    // await _player.play(AssetSource('sounds/order_alert.mp3'));
  }
}
