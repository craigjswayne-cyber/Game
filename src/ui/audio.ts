// Synthesised match-day sound & haptics. No audio assets - everything is
// generated with WebAudio so the PWA stays tiny and offline.

let ctx: AudioContext | null = null
let muted = typeof localStorage !== 'undefined' && localStorage.getItem('rm-sound') === '0'

export function soundOn(): boolean { return !muted }

export function toggleSound(): boolean {
  muted = !muted
  try { localStorage.setItem('rm-sound', muted ? '0' : '1') } catch { /* private mode */ }
  if (muted) groundSound(null)
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

/**
 * Buzz the phone, unless the phone's owner has said no twice over.
 *
 * This used to fire whatever the settings said. Silent mode killed the crowd and
 * the whistle and left the handset buzzing in your palm, which is the one thing
 * someone reaching for a mute toggle in a quiet room is trying to stop. Reduced
 * motion is the other half: it is the closest thing a browser offers to "stop
 * shaking things at me", and a phone that jumps in your hand is motion.
 */
function vibrate(pattern: number | number[]) {
  if (muted) return
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  } catch { /* no matchMedia: fall through and buzz */ }
  try { navigator.vibrate?.(pattern) } catch { /* unsupported */ }
}

/**
 * THE GROUND (idea 7). Under the whistles and the roars, a crowd that never
 * quite stops: a bed of shaped noise whose level follows the match - it
 * builds as the ball nears a tryline, louder when it is the home side doing
 * the building, and swells in a close finish and while the TMO decides. On a
 * wet day the rain hisses under it, on a windy one the wind rushes and eases.
 *
 * One set of nodes for the whole match, looped, with the level eased to each
 * new target so it breathes rather than steps. `groundSound(null)` fades it
 * out and lets it go (a pause, an interval, full time, leaving the screen).
 */
interface Bed { master: GainNode; gain: GainNode; stops: AudioScheduledSourceNode[]; weather: string }
let bed: Bed | null = null

/** Loopable noise, a little browner than white so a crowd does not hiss. */
function noiseBuffer(a: AudioContext, secs: number, brown: number): AudioBuffer {
  const n = Math.floor(a.sampleRate * secs)
  const buf = a.createBuffer(1, n, a.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1
    last = last * brown + w * (1 - brown)
    d[i] = last * (1 + brown * 2.5)
  }
  return buf
}

export function groundSound(level: number | null, weather = 'Dry') {
  if (level == null || muted) {
    if (!bed) return
    const old = bed
    bed = null
    try {
      // everything goes out together, the weather with the crowd, so nothing clicks
      const t = old.master.context.currentTime
      old.master.gain.cancelScheduledValues(t)
      old.master.gain.setTargetAtTime(0.0001, t, 0.25)
      for (const s of old.stops) s.stop(t + 1.2)
    } catch { /* context gone */ }
    return
  }
  const a = ac(); if (!a) return
  if (bed && bed.weather !== weather) groundSound(null)
  if (!bed) {
    const master = a.createGain()
    master.gain.value = 0.0001
    master.connect(a.destination)
    master.gain.setTargetAtTime(1, a.currentTime, 0.4)
    const gain = a.createGain()
    gain.gain.value = 0.0001
    gain.connect(master)
    // the crowd: voices sit in the low mids
    const src = a.createBufferSource()
    src.buffer = noiseBuffer(a, 4, 0.6); src.loop = true
    const bp = a.createBiquadFilter()
    bp.type = 'bandpass'; bp.frequency.value = 620; bp.Q.value = 0.45
    src.connect(bp).connect(gain)
    src.start()
    const stops: AudioScheduledSourceNode[] = [src]
    if (weather === 'Rain' || weather === 'Snow') {
      // rain on the stand roof: bright, steady, well under the crowd
      const r = a.createBufferSource()
      r.buffer = noiseBuffer(a, 3, 0.1); r.loop = true
      const hp = a.createBiquadFilter()
      hp.type = 'highpass'; hp.frequency.value = weather === 'Snow' ? 5200 : 3200
      const rg = a.createGain(); rg.gain.value = weather === 'Snow' ? 0.012 : 0.035
      r.connect(hp).connect(rg).connect(master)
      r.start(); stops.push(r)
    }
    if (weather === 'Wind') {
      // the wind: low and rushing, gusting on a slow swell
      const w = a.createBufferSource()
      w.buffer = noiseBuffer(a, 5, 0.92); w.loop = true
      const lp = a.createBiquadFilter()
      lp.type = 'lowpass'; lp.frequency.value = 420
      const wg = a.createGain(); wg.gain.value = 0.05
      const lfo = a.createOscillator(); lfo.frequency.value = 0.13
      const depth = a.createGain(); depth.gain.value = 0.035
      lfo.connect(depth).connect(wg.gain)
      w.connect(lp).connect(wg).connect(master)
      w.start(); lfo.start(); stops.push(w, lfo)
    }
    bed = { master, gain, stops, weather }
  }
  const target = 0.015 + 0.13 * Math.max(0, Math.min(1, level))
  const t = a.currentTime
  bed.gain.gain.cancelScheduledValues(t)
  bed.gain.gain.setTargetAtTime(target, t, 0.7)
}

/** Play the right effect for a live-match event type. */
export function matchSfx(type: string) {
  switch (type) {
    case 'TRY': crowd(1.4, 0.6, 800); vibrate([30, 40, 60]); break
    // The strike, not the result. A kick that goes over gets one short tick, the
    // length of a keyboard tap - enough to feel the contact without competing
    // with the try. A miss is pushed as a plain commentary line by the engine and
    // reaches no case here, so nothing buzzes when the kick drifts wide, which is
    // exactly right: you do not want the phone celebrating a miss.
    case 'CON':
    case 'PEN': crowd(0.6, 0.25, 1100); vibrate(12); break
    case 'DG': crowd(1.0, 0.45, 900); vibrate(30); break
    case 'YC': whistle(1); thud(); vibrate(60); break
    case 'RC': whistle(1); thud(); vibrate([80, 60, 80]); break
    case 'INJ': whistle(1); break
    case 'KO': whistle(1); crowd(0.9, 0.3, 700); break
    case 'HT': whistle(2); break
    case 'FT': whistle(3); crowd(1.6, 0.5, 750); vibrate([50, 50, 50, 50, 120]); break
    // the TMO's NO TRY: a long low groan from most of the ground
    case 'NOTRY': crowd(1.5, 0.4, 330); break
  }
}
