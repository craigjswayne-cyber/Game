"""Original trailer score for the PHASE showreel, synthesised with numpy only.

Every hit sits on the composition's own timeline: 120 BPM from the door burst
at 4.4s, so beat k lands at 4.4 + 0.5k. Writes a stereo 44.1 kHz WAV.

    python3 score.py out.wav
"""
import sys
import wave

import numpy as np

SR = 44100
DUR = 28.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
mix = np.zeros((2, N))


def beat(k):
    return 4.4 + 0.5 * k


def hz(note):
    names = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
    name, octave = note[:-1], int(note[-1])
    return 440.0 * 2 ** ((names[name] + 12 * (octave - 4) - 9) / 12)


def add(sig, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= N:
        return
    sig = sig[: N - i]
    l = np.cos((pan + 1) * np.pi / 4)
    r = np.sin((pan + 1) * np.pi / 4)
    mix[0, i : i + len(sig)] += sig * gain * l * 1.414
    mix[1, i : i + len(sig)] += sig * gain * r * 1.414


def fft_filter(x, lo=None, hi=None):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    g = np.ones_like(f)
    if lo:
        g *= 1 / (1 + (lo / np.maximum(f, 1)) ** 4)
    if hi:
        g *= 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * g, len(x))


def saw_stack(freqs, dur, cutoff_fn, detune=0.006, nh=40):
    """Band-limited detuned saws whose brightness follows cutoff_fn(t) in Hz."""
    t = np.arange(int(dur * SR)) / SR
    cut = cutoff_fn(t)
    out = np.zeros_like(t)
    for f0 in freqs:
        for d in (-detune, 0, detune):
            f = f0 * (1 + d)
            ph = rng.uniform(0, 2 * np.pi)
            for h in range(1, nh + 1):
                if f * h > 16000:
                    break
                w = np.exp(-(f * h) / cut) / h
                out += w * np.sin(2 * np.pi * f * h * t + ph * h)
    return out / (len(freqs) * 3)


def env(dur, a, r, hold=0.0):
    t = np.arange(int(dur * SR)) / SR
    e = np.minimum(t / max(a, 1e-4), 1.0)
    rel = np.clip((t - a - hold) / r, 0, None)
    return e * np.exp(-3 * rel)


def braam(t0, notes, dur=2.6, gain=1.0, bright=1800):
    s = saw_stack([hz(n) for n in notes], dur, lambda t: 120 + bright * np.exp(-t / 0.5) * np.minimum(t / 0.05, 1))
    s *= env(dur, 0.02, dur * 0.45, 0.15)
    add(np.tanh(s * 3.0) * 0.6, t0, gain)


def sub_hit(t0, gain=1.0, dur=1.8):
    t = np.arange(int(dur * SR)) / SR
    f = 32 + 90 * np.exp(-t / 0.08)
    ph = 2 * np.pi * np.cumsum(f) / SR
    add(np.sin(ph) * np.exp(-t / 0.55), t0, gain)


def kick(t0, gain=1.0):
    t = np.arange(int(0.45 * SR)) / SR
    f = 45 + 120 * np.exp(-t / 0.03)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t / 0.16)
    s[:200] += rng.normal(0, 0.3, 200) * np.linspace(1, 0, 200)
    add(np.tanh(s * 1.6), t0, gain)


def taiko(t0, gain=1.0, pitch=1.0):
    t = np.arange(int(0.9 * SR)) / SR
    f = (62 + 70 * np.exp(-t / 0.04)) * pitch
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / 0.28)
    skin = fft_filter(rng.normal(0, 1, len(t)), lo=80, hi=900) * np.exp(-t / 0.05) * 0.5
    add(np.tanh((body + skin) * 1.4), t0, gain)


def snare(t0, gain=1.0):
    t = np.arange(int(0.3 * SR)) / SR
    n = fft_filter(rng.normal(0, 1, len(t)), lo=900, hi=7000) * np.exp(-t / 0.07)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05) * 0.6
    add(n * 0.7 + tone, t0, gain, pan=0.05)


def hat(t0, gain=1.0, pan=0.2):
    t = np.arange(int(0.06 * SR)) / SR
    add(fft_filter(rng.normal(0, 1, len(t)), lo=7000) * np.exp(-t / 0.012), t0, gain, pan)


def tick(t0, gain=1.0):
    t = np.arange(int(0.03 * SR)) / SR
    add(fft_filter(rng.normal(0, 1, len(t)), lo=2500, hi=6000) * np.exp(-t / 0.004), t0, gain, pan=0.35)


def heartbeat(t0, gain=1.0):
    for dt, g in ((0, 1.0), (0.17, 0.7)):
        t = np.arange(int(0.35 * SR)) / SR
        f = 40 + 30 * np.exp(-t / 0.03)
        add(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.09), t0 + dt, gain * g)


def pluck(t0, note, gain=1.0, pan=0.0, dur=0.22):
    s = saw_stack([hz(note)], dur, lambda t: 300 + 2600 * np.exp(-t / 0.05), detune=0.003, nh=14)
    add(s * env(dur, 0.003, 0.08), t0, gain, pan)


def bass(t0, note, dur=0.24, gain=1.0):
    s = saw_stack([hz(note)], dur, lambda t: 140 + 500 * np.exp(-t / 0.06), detune=0.0, nh=12)
    t = np.arange(len(s)) / SR
    s += 0.6 * np.sin(2 * np.pi * hz(note) * t)
    add(np.tanh(s * env(dur, 0.004, 0.1) * 2), t0, gain)


def pad(t0, notes, dur, gain=1.0, bright=900):
    s = saw_stack([hz(n) for n in notes], dur, lambda t: bright + 0 * t, detune=0.008, nh=24)
    add(s * env(dur, 0.35, 0.5, dur - 0.9), t0, gain)


def riser(t0, dur, gain=1.0):
    t = np.arange(int(dur * SR)) / SR
    n = rng.normal(0, 1, len(t))
    lo = fft_filter(n, lo=300, hi=1500)
    hi = fft_filter(n, lo=3000, hi=12000)
    x = t / dur
    s = (lo * (1 - x) + hi * x) * x ** 2.2
    f = 100 * 2 ** (x * 4)
    s += 0.25 * np.sin(2 * np.pi * np.cumsum(f) / SR) * x ** 2
    add(s, t0, gain)


def crash(t0, gain=1.0, dur=2.5):
    t = np.arange(int(dur * SR)) / SR
    add(fft_filter(rng.normal(0, 1, len(t)), lo=3500) * np.exp(-t / 0.7), t0, gain, pan=-0.1)


# ---------------- 0 - 4.4: the corridor ----------------
drone_d = 4.6
d = saw_stack([hz("A1"), hz("E2")], drone_d, lambda t: 90 + 260 * (t / drone_d) ** 2, detune=0.01, nh=30)
add(d * env(drone_d, 1.5, 0.2, drone_d - 1.7), 0.0, 0.9)
for t0 in (0.25, 1.05, 1.75, 2.4, 2.95, 3.4, 3.8, 4.12):
    heartbeat(t0, 0.9)
for k in range(9):
    tick(0.05 + 0.5 * k, 0.25 + 0.03 * k)
riser(3.1, 1.3, 0.55)

# ---------------- 4.4 - 7.9: the door, the hook ----------------
braam(4.4, ["A1", "E2", "A2", "C3"], dur=3.0, gain=1.0)
sub_hit(4.4, 1.0)
taiko(4.4, 1.0)
crash(4.4, 0.25)
for k, notes in ((1, ["A1", "E2", "A2"]), (3, ["F1", "C2", "F2"]), (5, ["E1", "B1", "E2", "G#2"])):
    taiko(beat(k), 0.9)
    sub_hit(beat(k), 0.5, dur=0.8)
    braam(beat(k), notes, dur=1.0, gain=0.6, bright=1200)
for k in range(2, 7):
    kick(beat(k) + 0.25, 0.25)
pad(4.6, ["A2", "E3", "C4"], 3.3, gain=0.35, bright=700)

# ---------------- 7.9 - 11.4: the build ----------------
PROG = [("A", ["A2", "C3", "E3"]), ("F", ["F2", "A2", "C3"]), ("D", ["D2", "F2", "A2"]), ("E", ["E2", "G#2", "B2"])]
OST = {"A": ["A3", "E4", "C4", "E4"], "F": ["F3", "C4", "A3", "C4"], "D": ["D3", "A3", "F3", "A3"], "E": ["E3", "B3", "G#3", "B3"]}
BASS = {"A": "A1", "F": "F1", "D": "D2", "E": "E1"}


def bar_chord(k):
    # four beats a bar, counted from beat 0 at 4.4s
    return PROG[(k // 4) % 4]


for k in range(7, 14):
    kick(beat(k), 0.85)
for k in range(8, 14):
    root, _ = bar_chord(k)
    for s in range(4):
        pluck(beat(k) + s * 0.125, OST[root][s], 0.35 * (0.6 + 0.4 * (k - 8) / 5), pan=0.25 if s % 2 else -0.25)
    bass(beat(k), BASS[root], gain=0.6)
    bass(beat(k) + 0.25, BASS[root], gain=0.5)
    for s in range(4):
        hat(beat(k) + s * 0.125, 0.12 + 0.06 * (s == 2))
for i, t0 in enumerate(np.cumsum([0.25, 0.25, 0.125, 0.125, 0.0625, 0.0625, 0.0625])):
    snare(10.85 + t0 - 0.25, 0.25 + 0.08 * i)
taiko(10.9, 0.8, 1.2)
taiko(11.15, 0.9, 1.1)
riser(10.0, 1.4, 0.7)

# ---------------- 11.4 - 22.9: full drive ----------------
braam(11.4, ["A1", "E2", "A2", "C3", "E3"], dur=2.2, gain=0.9)
sub_hit(11.4, 1.0)
crash(11.4, 0.35)
for k in range(14, 37):
    root, chord = bar_chord(k)
    kick(beat(k), 0.95)
    if k % 2 == 1:
        snare(beat(k), 0.55)
    if k % 4 == 0:
        taiko(beat(k), 0.75)
    for s in range(4):
        pluck(beat(k) + s * 0.125, OST[root][s], 0.42, pan=0.3 if s % 2 else -0.3)
        hat(beat(k) + s * 0.125, 0.14 + 0.08 * (s == 2))
    bass(beat(k), BASS[root], gain=0.7)
    bass(beat(k) + 0.25, BASS[root], gain=0.6)
    if k % 4 == 0:
        pad(beat(k), chord + [chord[0][:-1] + "3", chord[2][:-1] + "4"], 2.05, gain=0.32, bright=1300)
# accents on the cuts and every feature slam
for t0 in (12.9, 14.4, 15.4):
    taiko(t0, 0.7, 1.1)
for k in range(6):
    t0 = 16.9 + k
    taiko(t0, 0.85)
    sub_hit(t0, 0.35, dur=0.6)
    if k >= 3:
        pluck(t0, "A5", 0.18, pan=0.4)
riser(22.0, 0.9, 0.75)

# ---------------- 22.9 - 24.9: the sack ----------------
low = saw_stack([hz("A0"), hz("A#1")], 2.2, lambda t: 80 + 120 * t, detune=0.012, nh=30)
add(low * env(2.2, 0.3, 0.6, 1.0), 22.9, 0.7)
for t0 in (22.95, 23.2, 23.4):
    tick(t0, 0.45)
braam(23.6, ["A1", "A#1", "E2", "A2"], dur=1.4, gain=1.0, bright=2400)
sub_hit(23.6, 1.0)
taiko(23.6, 1.0, 0.9)
crash(23.6, 0.3)
riser(24.2, 0.7, 0.55)

# ---------------- 24.9 - 28: the logo ----------------
braam(24.9, ["A1", "E2", "A2", "C3", "E3", "A3"], dur=3.1, gain=1.0, bright=2200)
sub_hit(24.9, 1.0, dur=2.5)
taiko(24.9, 1.0)
crash(24.9, 0.35, dur=3.0)
pad(25.1, ["A2", "E3", "A3", "C4", "E4"], 2.9, gain=0.45, bright=1100)
for t0 in (25.5, 26.0):
    taiko(t0, 0.6, 1.1)

# ---------------- reverb, master ----------------
ir_len = int(2.4 * SR)
ti = np.arange(ir_len) / SR
wet = np.zeros_like(mix)
size = 1 << int(np.ceil(np.log2(N + ir_len)))
for ch in range(2):
    ir = rng.normal(0, 1, ir_len) * np.exp(-ti / 0.55)
    ir = fft_filter(ir, hi=6000)
    ir /= np.sqrt(np.sum(ir ** 2))
    wet[ch] = np.fft.irfft(np.fft.rfft(mix[ch], size) * np.fft.rfft(ir, size), size)[:N]
out = mix + 0.35 * wet
out = np.tanh(out / np.max(np.abs(out)) * 1.4)
fade = np.ones(N)
fn = int(1.6 * SR)
fade[-fn:] = np.linspace(1, 0, fn) ** 1.5
out *= fade
out = out / np.max(np.abs(out)) * 0.89

pcm = (out.T * 32767).astype("<i2")
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("wrote", sys.argv[1], f"{DUR}s")
