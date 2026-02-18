import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';


class AudioService {
  static final AudioService instance = AudioService._internal();
  AudioService._internal();

  final AudioPlayer _player = AudioPlayer();

  Future<void> init() async {
    // Configure for high importance playback (overrides silent switch on iOS)
    final AudioContext audioContext = AudioContext(
      iOS: AudioContextIOS(
        category: AVAudioSessionCategory.playback,
        options: {
          AVAudioSessionOptions.mixWithOthers,
        },
      ),
      android: AudioContextAndroid(
        isSpeakerphoneOn: true,
        stayAwake: true,
        contentType: AndroidContentType.sonification,
        usageType: AndroidUsageType.notificationEvent,
        audioFocus: AndroidAudioFocus.gainTransientMayDuck,
      ),
    );
    await AudioPlayer.global.setAudioContext(audioContext);
  }

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
    try {
      // Use standard audio player with bundled asset
      await _player.stop(); // Stop any previous sound
      
      // Force reload source to avoid stale state
      await _player.setReleaseMode(ReleaseMode.stop);

      // Ensure volume is max
      await _player.setVolume(1.0);
      
      await _player.play(AssetSource('sounds/order_alert.wav'));
    } catch (e) {
      // Fallback
      SystemSound.play(SystemSoundType.click);
    }
  }
}
