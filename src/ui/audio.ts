// Synthesised match-day sound & haptics. No audio assets - everything is
// generated with WebAudio so the PWA stays tiny and offline.

let ctx: AudioContext | null = null
let muted = typeof localStorage !== 'undefined' && localStorage.getItem('rm-sound') === '0'

export function soundOn(): boolean { return !muted }

export function toggleSound(): boolean {
  muted = !muted
  try { localStorage.setItem('rm-sound', muted ? '0' : '1') } catch { /* private mode */ }
  return !muted
}

function ac(): AudioContext | null {
  if (muted) return null
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch { return null }
}

/** Crowd swell: filtered noise burst with an envelope. */
function crowd(dur = 1.1, vol = 0.5, freq = 900) {
  const a = ac(); if (!a) return
  const n = a.sampleRate * dur
  const buf = a.createBuffer(1, n, a.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1)
  const src = a.createBufferSource()
  src.buffer = buf
  const bp = a.createBiquadFilter()
  bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 0.6
  const g = a.createGain()
  const t = a.currentTime
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.25)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(bp).connect(g).connect(a.destination)
  src.start()
}

/** Referee whistle: a shrill dual-tone burst (or several). */
function whistle(blasts = 1) {
  const a = ac(); if (!a) return
  const t0 = a.currentTime
  for (let b = 0; b < blasts; b++) {
    const t = t0 + b * 0.32
    const dur = b === blasts - 1 && blasts > 1 ? 0.5 : 0.18
    for (const f of [2350, 2680]) {
      const o = a.createOscillator()
      o.type = 'square'; o.frequency.value = f
      const g = a.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.06, t + 0.02)
      g.gain.setValueAtTime(0.06, t + dur - 0.04)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      o.connect(g).connect(a.destination)
      o.start(t); o.stop(t + dur + 0.02)
    }
  }
}

/** Low thud for cards / big hits. */
function thud() {
  const a = ac(); if (!a) return
  const o = a.createOscillator()
  o.type = 'sine'
  const t = a.currentTime
  o.frequency.setValueAtTime(150, t)
  o.frequency.exponentialRampToValueAtTime(50, t + 0.25)
  const g = a.createGain()
  g.gain.setValueAtTime(0.4, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3)
  o.connect(g).connect(a.destination)
  o.start(t); o.stop(t + 0.35)
}

function vibrate(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern) } catch { /* unsupported */ }
}

/** Play the right effect for a live-match event type. */
export function matchSfx(type: string) {
  switch (type) {
    case 'TRY': crowd(1.4, 0.6, 800); vibrate([30, 40, 60]); break
    case 'CON':
    case 'PEN': crowd(0.6, 0.25, 1100); break
    case 'DG': crowd(1.0, 0.45, 900); vibrate(30); break
    case 'YC': whistle(1); thud(); vibrate(60); break
    case 'RC': whistle(1); thud(); vibrate([80, 60, 80]); break
    case 'INJ': whistle(1); break
    case 'KO': whistle(1); crowd(0.9, 0.3, 700); break
    case 'HT': whistle(2); break
    case 'FT': whistle(3); crowd(1.6, 0.5, 750); vibrate([50, 50, 50, 50, 120]); break
  }
}
