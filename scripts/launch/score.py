"""The PHASE trailer score and sound design, composed in code.

An original piece, written for this edit: no samples, no library, no
third-party material, so there is nothing to licence. It follows the picture:
the chord changes land on the cuts, and the arrangement builds with the story.

  open      a single low note and a high answer
  decision  quiet piano arpeggio
  match     a soft pulse arrives, the bass with it
  memory    strings and a melody, the emotional peak
  career    the fullest it gets, still restrained
  close     everything stops but the room: one chord
  end       a soft impact and a long tail

Sound design is the game's own: the referee's whistle and the low thud are
the recipes in src/ui/audio.ts (dual square tones at 2350 and 2680 Hz; a
sine falling from 150 to 50 Hz), softened for a mix. Taps, the crowd bed and
the turn of a page are synthesised here.

  python3 scripts/launch/score.py storeart/audio/plan-60.json

The plan (written by scripts/launch/cut.mjs) lists each beat's start, length,
energy and any taps. Writes <plan>-music.wav and <plan>-sfx.wav, 48 kHz stereo.
"""
import json
import sys
import wave

import numpy as np

SR = 48000
RNG = np.random.default_rng(1871)  # fixed: the same score every build

def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)

# A minor, voiced low and open. [bass, upper voices...]
CHORDS = {
    'Am': [45, 57, 60, 64, 71],
    'F': [41, 57, 60, 65, 67],
    'C': [36, 55, 60, 64, 67],
    'G': [43, 55, 59, 62, 69],
    'Fadd9': [41, 60, 65, 67, 69],
    'Cadd9': [36, 55, 62, 64, 67],
}
PROG = ['Am', 'F', 'C', 'G']
TEMPO = 92
EIGHTH = 60 / TEMPO / 2


def env_adsr(n, a, r, sustain_end=None):
    e = np.ones(n)
    na = max(1, int(a * SR))
    e[:na] = np.linspace(0, 1, na) ** 2
    nr = max(1, int(r * SR))
    if nr < n:
        e[-nr:] *= np.linspace(1, 0, nr) ** 2
    return e


def piano(f, dur, vel):
    """Additive piano: stretched partials, faster decay up the series, a
    breath of hammer, and two strings a fraction out of tune."""
    n = int((dur + 2.5) * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    B = 0.00035
    bright = 0.6 + 0.6 * vel
    for k in range(1, 11):
        fk = f * k * np.sqrt(1 + B * k * k)
        if fk > 9000:
            break
        amp = (1 / k ** (1.6 - 0.4 * bright)) * (0.85 if k % 2 == 0 else 1)
        decay = (0.9 + 0.55 * k) * (f / 220) ** 0.35
        part = np.exp(-t * decay)
        for det in (-0.6, 0.6):
            out += amp * part * np.sin(2 * np.pi * fk * (1 + det / 1731) * t + RNG.uniform(0, 6.28))
    hammer = RNG.normal(0, 1, int(0.012 * SR)) * np.exp(-np.linspace(0, 6, int(0.012 * SR)))
    out[:hammer.size] += 0.04 * np.convolve(hammer, np.ones(8) / 8, 'same')
    a = int(0.004 * SR)
    out[:a] *= np.linspace(0, 1, a)
    rel = int(min(dur, n / SR) * SR)
    if rel < n:  # key up: a quick but soft damp
        damp = np.ones(n)
        tail = n - rel
        damp[rel:] = np.exp(-np.arange(tail) / (0.35 * SR))
        out *= damp
    return out * vel * 0.18


def pad(freqs, dur, level, bright=1600, vibrato=0.0, attack=1.8, release=2.2):
    """Detuned saws, built additively so the top end is clean."""
    n = int((dur + release) * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    vib = 1 + vibrato * np.sin(2 * np.pi * 5.2 * t)
    for f in freqs:
        for det in (-7, 0, 7):
            fd = f * 2 ** (det / 1200)
            phase = 2 * np.pi * np.cumsum(fd * vib) / SR
            for k in range(1, 20):
                if fd * k > bright:
                    break
                out += (1 / k) * np.exp(-k / 7) * np.sin(k * phase + RNG.uniform(0, 6.28))
    e = env_adsr(n, attack, release)
    return out * e * level / (len(freqs) * 3)


def kick(level):
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    f = 48 + 70 * np.exp(-t * 30)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 8) * level


def tick(level):
    n = int(0.05 * SR)
    x = np.diff(RNG.normal(0, 1, n + 1)) * np.exp(-np.linspace(0, 9, n))
    return x * level * 0.15


def sub(f, dur, level):
    n = int((dur + 0.3) * SR)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * f * t) * env_adsr(n, 0.08, 0.4) * level


def place(buf, x, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    if i >= buf.shape[1] or i + x.size <= 0:
        return
    j = min(buf.shape[1], i + x.size)
    seg = x[: j - i] * gain
    buf[0, i:j] += seg * np.sqrt(0.5 * (1 - pan))
    buf[1, i:j] += seg * np.sqrt(0.5 * (1 + pan))


def reverb(x, seconds=2.6, predelay=0.022):
    """A dark, wide room: exponentially decaying noise, different per side,
    convolved by FFT."""
    n = int(seconds * SR)
    t = np.arange(n) / SR
    out = np.zeros_like(x)
    for ch in range(2):
        ir = RNG.normal(0, 1, n) * np.exp(-t / (seconds / 6.9))
        ir = np.convolve(ir, np.ones(24) / 24, 'same')  # darken
        ir = np.concatenate([np.zeros(int(predelay * SR)), ir])
        ir /= np.sqrt(np.sum(ir ** 2))
        size = 1 << int(np.ceil(np.log2(x.shape[1] + ir.size)))
        y = np.fft.irfft(np.fft.rfft(x[ch], size) * np.fft.rfft(ir, size), size)
        out[ch] = y[: x.shape[1]]
    return out


def compose(plan):
    total = plan['total']
    n = int((total + 0.5) * SR)
    dry = {k: np.zeros((2, n)) for k in ('piano', 'pad', 'strings', 'drums', 'sub')}
    beats = plan['beats']
    ci = 0
    for b in beats:
        s, d, e = b['start'], b['dur'], b['energy']
        if e == 'end':
            ch = CHORDS['Cadd9']
            place(dry['sub'], sub(midi(ch[0]), d, 0.22), s)
            for i, m in enumerate(ch[1:]):  # a rolled chord
                place(dry['piano'], piano(midi(m), d, 0.42), s + 0.06 * i, pan=-0.3 + 0.15 * i)
            place(dry['piano'], piano(midi(ch[0] + 12), d, 0.5), s)
            place(dry['pad'], pad([midi(m) for m in ch[1:4]], d - 0.5, 0.5, attack=0.6, release=3.0), s)
            continue
        if e == 'drop':
            ch = CHORDS['Fadd9']
            place(dry['piano'], piano(midi(ch[0] + 12), d, 0.38), s)
            for i, m in enumerate(ch[1:4]):
                place(dry['piano'], piano(midi(m), d, 0.3), s + 0.05 * i, pan=-0.2 + 0.2 * i)
            place(dry['pad'], pad([midi(m) for m in ch[1:4]], d, 0.32, attack=1.2), s)
            continue
        if e == 0:
            # the open: one low A, then a high E answers
            place(dry['piano'], piano(midi(45), d + 0.5, 0.42), s + 0.15)
            place(dry['piano'], piano(midi(76), 1.6, 0.22), s + 1.5, pan=0.25)
            place(dry['pad'], pad([midi(57), midi(64)], d, 0.18, attack=2.0), s)
            continue
        name = PROG[ci % len(PROG)]
        ci += 1
        ch = CHORDS[name]
        upper = ch[1:4]
        # bass note on the cut
        place(dry['piano'], piano(midi(ch[0]), d, 0.36 + 0.05 * e), s)
        # the arpeggio: eighths through the upper voices
        pattern = [0, 1, 2, 1] if e < 3 else [0, 1, 2, 3, 2, 1]
        voices = upper + [ch[1] + 12]
        t = s + EIGHTH * 0.5
        k = 0
        vel = 0.18 + 0.055 * e
        while t < s + d - 0.05:
            m = voices[pattern[k % len(pattern)]]
            accent = 1.15 if k % 4 == 0 else 1.0
            place(dry['piano'], piano(midi(m + (12 if e >= 4 and k % 2 else 0)), EIGHTH * 1.6, vel * accent),
                  t, pan=(-0.35 + 0.23 * (pattern[k % len(pattern)])))
            t += EIGHTH
            k += 1
        place(dry['pad'], pad([midi(m) for m in upper], d, 0.14 + 0.05 * e, attack=1.4 if e < 3 else 0.9), s)
        if e >= 2:
            # the pulse: soft, on the half-bar; the bass beneath it
            q = 60 / TEMPO
            t = s
            j = 0
            while t < s + d - 0.1:
                if j % 2 == 0 or e >= 4:
                    place(dry['drums'], kick(0.5 if j % 2 == 0 else 0.3), t)
                if e >= 3:
                    place(dry['drums'], tick(0.6), t + q / 2, pan=0.3)
                t += q
                j += 1
            place(dry['sub'], sub(midi(ch[0] + 12), d, 0.16 + 0.02 * e), s)
        if e >= 3:
            # strings and a melody: the memory beats
            place(dry['strings'], pad([midi(ch[1] - 12), midi(ch[3])], d, 0.26 + 0.06 * (e - 3),
                                      bright=2600, vibrato=0.0016, attack=1.0), s)
            mel = [ch[3] + 12, ch[2] + 12] if ci % 2 else [ch[4] + 12, ch[3] + 12]
            place(dry['piano'], piano(midi(mel[0]), d * 0.55, 0.30), s + 0.02, pan=0.15)
            place(dry['piano'], piano(midi(mel[1]), d * 0.45, 0.26), s + d * 0.55, pan=0.15)

    wet_mix = {'piano': 0.38, 'pad': 0.55, 'strings': 0.5, 'drums': 0.12, 'sub': 0.0}
    bus = np.zeros((2, n))
    send = np.zeros((2, n))
    for k, x in dry.items():
        bus += x
        send += x * wet_mix[k]
    bus += reverb(send) * 0.9
    # gentle glue, then headroom: loudness is set in the final mix
    bus = np.tanh(bus * 1.4) / 1.4
    bus /= max(1e-9, np.max(np.abs(bus))) / 0.89
    fade = int(0.05 * SR)
    bus[:, :fade] *= np.linspace(0, 1, fade)
    return bus[:, : int(total * SR)]


# ------------------------------------------------------------------ sound design
def whistle(blasts):
    """The game's whistle (audio.ts): 2350 and 2680 Hz, square, short blasts
    and a long last one; here band-limited so it sits in a mix."""
    out = []
    for b in range(blasts):
        dur = 0.5 if (b == blasts - 1 and blasts > 1) else 0.18
        n = int(dur * SR)
        t = np.arange(n) / SR
        x = np.zeros(n)
        for f in (2350, 2680):
            for k in (1, 3, 5):
                x += np.sin(2 * np.pi * f * k * t) / k
        e = np.minimum(1, t / 0.02) * np.minimum(1, (dur - t) / 0.04)
        out.append((b * 0.32, x * e * 0.05))
    return out


def thud():
    """The game's thud (audio.ts): a sine from 150 down to 50 Hz."""
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    f = 150 * (50 / 150) ** np.minimum(1, t / 0.25)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.4 * np.exp(-t / 0.08)


def tap():
    n = int(0.03 * SR)
    t = np.arange(n) / SR
    click = np.sin(2 * np.pi * 1700 * t) * np.exp(-t * 260)
    click += np.diff(RNG.normal(0, 1, n + 1)) * np.exp(-t * 600) * 0.08
    return click * 0.22


def crowd(dur):
    n = int(dur * SR)
    x = RNG.normal(0, 1, n)
    lo = np.convolve(x, np.ones(9) / 9, 'same') - np.convolve(x, np.ones(90) / 90, 'same')  # a rough band
    t = np.arange(n) / SR
    swell = 0.7 + 0.3 * np.sin(2 * np.pi * 0.17 * t + 1.3) * np.sin(2 * np.pi * 0.05 * t)
    e = np.minimum(1, t / 0.6) * np.minimum(1, (dur - t) / 0.6)
    return lo * swell * e * 0.11


def page():
    n = int(0.42 * SR)
    t = np.arange(n) / SR
    x = np.diff(RNG.normal(0, 1, n + 1))
    x = np.convolve(x, np.ones(3) / 3, 'same')
    e = np.sin(np.pi * np.minimum(1, t / 0.42)) ** 2
    return x * e * 0.035


def sound_design(plan):
    total = plan['total']
    n = int(total * SR)
    buf = np.zeros((2, n))
    for b in plan['beats']:
        s, d, sfx = b['start'], b['dur'], b.get('sfx', [])
        if 'thud' in sfx:
            place(buf, thud(), s + 0.05, 0.5)
        if 'crowd' in sfx:
            c = crowd(d + 0.4)
            place(buf, c, s - 0.2, 1.0, pan=-0.2)
            place(buf, crowd(d + 0.4), s - 0.2, 1.0, pan=0.2)
        for blasts_key, blasts in (('whistle1', 1), ('whistle2', 2), ('whistle3', 3)):
            if blasts_key in sfx:
                for off, x in whistle(blasts):
                    place(buf, x, s + b.get('whistleAt', 0.3) + off, 0.7)
        if 'page' in sfx:
            place(buf, page(), s + 0.05, 1.0, pan=0.15)
        for tt in b.get('taps', []):
            place(buf, tap(), tt, 1.0, pan=0.1)
    buf = reverb(buf, seconds=0.9) * 0.25 + buf
    return buf


def write(path, x):
    x = np.clip(x, -1, 1)
    data = (x.T * 32767).astype('<i2').tobytes()
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data)


if __name__ == '__main__':
    plan_path = sys.argv[1]
    plan = json.load(open(plan_path))
    base = plan_path[:-5]
    write(base + '-music.wav', compose(plan))
    write(base + '-sfx.wav', sound_design(plan))
    print(f'score: {base}-music.wav, {base}-sfx.wav ({plan["total"]:.1f} s)')
