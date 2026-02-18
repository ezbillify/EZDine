import wave
import math
import struct

# Generate a 440 Hz sine wave for 0.5 seconds
sample_rate = 44100
duration = 0.5
frequency = 880.0 # A5 (High beep)

n_frames = int(sample_rate * duration)
data = []

for i in range(n_frames):
    value = int(32767.0 * math.sin(2.0 * math.pi * frequency * i / sample_rate))
    data.append(value)

# Stereo
audio_data = struct.pack('<' + ('h' * len(data)), *data)

with wave.open('apps/mobile/assets/sounds/order_alert_gen.wav', 'w') as f:
    f.setnchannels(1)
    f.setsampwidth(2)
    f.setframerate(sample_rate)
    f.writeframes(audio_data)

print("Generated valid WAV file.")
