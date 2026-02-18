import wave
import math
import struct
import random

def generate_tone(frequency, duration, sample_rate=44100, volume=0.5):
    n_frames = int(sample_rate * duration)
    data = []
    for i in range(n_frames):
        # Apply a simple decay envelope
        t = i / sample_rate
        envelope = math.exp(-3 * t) # Exponential decay
        
        # Add some harmonics for a "bell" like sound
        value = math.sin(2.0 * math.pi * frequency * t) 
        value += 0.5 * math.sin(2.0 * math.pi * (frequency * 2.0) * t) # Octave
        value += 0.25 * math.sin(2.0 * math.pi * (frequency * 3.0) * t) # 5th
        
        sample = int(32767.0 * volume * envelope * value / 1.75)
        data.append(sample)
    return data

sample_rate = 44100
# Generate a "Ding-Dong" effect
# First note: High (C6 ~ 1046 Hz)
note1 = generate_tone(1046.50, 0.4, sample_rate)
# Second note: Lower (G5 ~ 783.99 Hz)
note2 = generate_tone(783.99, 0.8, sample_rate)

# Combine
full_sound = note1 + note2
audio_data = struct.pack('<' + ('h' * len(full_sound)), *full_sound)

with wave.open('apps/mobile/assets/sounds/order_alert.wav', 'w') as f:
    f.setnchannels(1)
    f.setsampwidth(2)
    f.setframerate(sample_rate)
    f.writeframes(audio_data)

print("Generated pleasant Ding-Dong notification.")
