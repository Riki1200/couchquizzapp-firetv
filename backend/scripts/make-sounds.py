#!/usr/bin/env python3
"""Synthesizes Couch Quiz's sound effects and lobby music (original, no samples).

    python3 backend/scripts/make-sounds.py        # writes backend/assets/sounds/*.m4a (needs macOS afconvert)
"""
import math
import os
import random
import struct
import subprocess
import tempfile
import wave

RATE = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sounds')


def note(name):
    """'C5' -> frequency in Hz."""
    names = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
    semitone = names[name[0]] + (1 if '#' in name else 0)
    octave = int(name[-1])
    return 440.0 * 2 ** ((semitone - 9) / 12 + (octave - 4))


def tone(freq, seconds, volume=0.5, decay=6.0, harmonics=(1.0, 0.3, 0.1), attack=0.005):
    """Bell/pluck-like tone: a few sine harmonics with a fast attack and exponential decay."""
    n = int(seconds * RATE)
    out = []
    for i in range(n):
        t = i / RATE
        env = min(1.0, t / attack) * math.exp(-decay * t)
        s = sum(a * math.sin(2 * math.pi * freq * (k + 1) * t) for k, a in enumerate(harmonics))
        out.append(volume * env * s / sum(harmonics))
    return out


def noise(seconds, volume=0.2, decay=40.0):
    n = int(seconds * RATE)
    return [volume * math.exp(-decay * i / RATE) * (random.random() * 2 - 1) for i in range(n)]


def silence(seconds):
    return [0.0] * int(seconds * RATE)


def mix(*tracks):
    length = max(len(t) for t in tracks)
    return [sum(t[i] for t in tracks if i < len(t)) for i in range(length)]


def place(track, at, length):
    """Puts `track` at `at` seconds inside a silent buffer of `length` seconds."""
    buf = silence(length)
    start = int(at * RATE)
    for i, s in enumerate(track):
        if start + i < len(buf):
            buf[start + i] += s
    return buf


def concat(*tracks):
    return [s for t in tracks for s in t]


def write(name, samples):
    peak = max(1e-9, max(abs(s) for s in samples))
    gain = min(1.0, 0.9 / peak)
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
        with wave.open(tmp.name, 'wb') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(RATE)
            w.writeframes(b''.join(struct.pack('<h', int(s * gain * 32767)) for s in samples))
        target = os.path.join(OUT, f'{name}.m4a')
        subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '96000', tmp.name, target], check=True)
    os.unlink(tmp.name)
    print(f'{name}.m4a  {len(samples) / RATE:.2f}s')


def main():
    random.seed(7)
    os.makedirs(OUT, exist_ok=True)

    # A player joined: quick rising two-note chime.
    write('join', concat(tone(note('C6'), 0.12, decay=18), tone(note('G6'), 0.35, decay=9)))

    # A player locked in an answer: soft wooden "tock".
    write('lock', mix(tone(1300, 0.09, volume=0.6, decay=45, harmonics=(1.0, 0.2)), noise(0.03, 0.08, 120)))

    # Last seconds of the countdown: short tick.
    write('tick', tone(1900, 0.05, volume=0.5, decay=80, harmonics=(1.0,)))

    # Time's up: two descending tones.
    write('timesup', concat(tone(note('G4'), 0.22, decay=6, harmonics=(1.0, 0.5, 0.3)),
                            tone(note('C4'), 0.45, decay=4, harmonics=(1.0, 0.5, 0.3))))

    # Answer reveal: bright major arpeggio.
    arp = ['C5', 'E5', 'G5', 'C6']
    write('reveal', mix(*[place(tone(note(n), 0.8, volume=0.4, decay=4), i * 0.07, 1.1) for i, n in enumerate(arp)]))

    # Podium: short fanfare ending on a long chord.
    fanfare = [('G4', 0.0), ('C5', 0.13), ('E5', 0.26), ('G5', 0.39), ('E5', 0.62), ('G5', 0.75)]
    parts = [place(tone(note(n), 0.3, volume=0.45, decay=7), at, 2.6) for n, at in fanfare]
    chord = [place(tone(note(n), 1.6, volume=0.35, decay=1.6), 1.0, 2.6) for n in ('C5', 'E5', 'G5', 'C6')]
    write('podium', mix(*parts, *chord))

    # Lobby music: 4 bars at 112 BPM that loop seamlessly (bass, plucked arpeggio, light hi-hat).
    beat = 60 / 112
    bars = [('C', ['C5', 'E5', 'G5', 'E5']), ('A', ['A4', 'C5', 'E5', 'C5']),
            ('F', ['F4', 'A4', 'C5', 'A4']), ('G', ['G4', 'B4', 'D5', 'B4'])]
    length = 16 * beat
    layers = []
    for b, (root, arp_notes) in enumerate(bars):
        bar_start = b * 4 * beat
        for k in range(4):  # bass on every beat
            layers.append(place(tone(note(root + '2'), beat * 0.9, volume=0.5, decay=5, harmonics=(1.0, 0.5, 0.25)),
                                bar_start + k * beat, length))
        for k in range(8):  # eighth-note arpeggio
            n = arp_notes[k % 4]
            layers.append(place(tone(note(n), beat * 0.6, volume=0.22, decay=9), bar_start + k * beat / 2, length))
        for k in range(8):  # off-beat hi-hat
            layers.append(place(noise(0.04, 0.05, 90), bar_start + k * beat / 2 + beat / 4, length))
    write('music', mix(*layers))


if __name__ == '__main__':
    main()
