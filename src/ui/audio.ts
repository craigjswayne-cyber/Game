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
 * This used to fire whatever the settings said. Silent mode killed the whistle
 * and the thud and left the handset buzzing in your palm, which is the one thing
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
 * Short shaped noise for the title's lamp clicks and whoosh. Nothing loops it
 * and nothing plays it as a bed: the crowd it used to carry (the ground under
 * the match, the roars on a try, the telly on the title) was taken out at the
 * owner's call because it came through as static.
 */
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

/** Play the right effect for a live-match event type. */
export function matchSfx(type: string) {
  switch (type) {
    case 'TRY': vibrate([30, 40, 60]); break
    // The strike, not the result. A kick that goes over gets one short tick, the
    // length of a keyboard tap - enough to feel the contact without competing
    // with the try. A miss is pushed as a plain commentary line by the engine and
    // reaches no case here, so nothing buzzes when the kick drifts wide, which is
    // exactly right: you do not want the phone celebrating a miss.
    case 'CON':
    case 'PEN': vibrate(12); break
    case 'DG': vibrate(30); break
    case 'YC': whistle(1); thud(); vibrate(60); break
    case 'RC': whistle(1); thud(); vibrate([80, 60, 80]); break
    case 'INJ': whistle(1); break
    case 'KO': whistle(1); break
    case 'HT': whistle(2); break
    case 'FT': whistle(3); vibrate([50, 50, 50, 50, 120]); break
  }
}

/**
 * ---- THE OFFICE, BEFORE THE MENU (1.8.0, Intro.tsx) ----
 *
 * Owner: "the desk, steam rising from the coffee mug, the light flickering,
 * sound of a rugby game on the tv in the background. With some sound fx as
 * the title appears." All synthesised, like the rest of the game's sound.
 * The telly's crowd (a looped noise bed) came out at the owner's call: it
 * sounded like static, so the telly keeps only its distant whistle.
 *
 *   0.2 - 1.1  the lamp: a mains buzz and a click on each flicker
 *   1.1        a whistle, far off, on the telly in the corner
 *   1.9 - 2.6  a rising whoosh into the title
 *   2.6        the title lands: a low hit and a chord that rings out
 *
 * Returns a stop that fades it all out (a tap to skip, the end of the intro).
 * Silent if the manager has the sound off. The browser may hold the context
 * suspended until a tap: `introUnlocked()` says whether it is running.
 */
export function introUnlocked(): boolean {
  return !muted && !!ctx && ctx.state === 'running'
}

export function introSound(offset = 0): () => void {
  const a = ac()
  if (!a) return () => {}
  const out = a.createGain()
  out.gain.value = 0.9
  out.connect(a.destination)
  const t0 = a.currentTime - offset
  const at = (s: number) => Math.max(a.currentTime, t0 + s)
  // started late (the sound button, mid-intro): one-off sounds already in the
  // past are skipped rather than all fired at once
  const gone = (s: number) => t0 + s < a.currentTime - 0.02
  const nodes: AudioScheduledSourceNode[] = []

  // a whistle, far off, on the telly
  if (!gone(1.1)) for (const f of [2350, 2680]) {
    const o = a.createOscillator(); o.type = 'square'; o.frequency.value = f
    const g = a.createGain()
    g.gain.setValueAtTime(0.0001, at(1.1))
    g.gain.exponentialRampToValueAtTime(0.008, at(1.12))
    g.gain.exponentialRampToValueAtTime(0.0001, at(1.34))
    const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600
    o.connect(lp).connect(g).connect(out)
    o.start(at(1.1)); o.stop(at(1.4)); nodes.push(o)
  }

  // the lamp: mains buzz while it catches, and a click on each flicker
  const hum = a.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 100
  const humLp = a.createBiquadFilter(); humLp.type = 'lowpass'; humLp.frequency.value = 400
  const humG = a.createGain()
  humG.gain.setValueAtTime(0.0001, at(0.2))
  humG.gain.exponentialRampToValueAtTime(0.03, at(0.3))
  humG.gain.exponentialRampToValueAtTime(0.0001, at(1.2))
  hum.connect(humLp).connect(humG).connect(out)
  hum.start(at(0.2)); hum.stop(at(1.25)); nodes.push(hum)
  const click = noiseBuffer(a, 0.03, 0)
  for (const s of [0.22, 0.38, 0.52, 0.78, 1.02]) {
    if (gone(s)) continue
    const c = a.createBufferSource(); c.buffer = click
    const cg = a.createGain(); cg.gain.value = 0.18
    const chp = a.createBiquadFilter(); chp.type = 'highpass'; chp.frequency.value = 1800
    c.connect(chp).connect(cg).connect(out)
    c.start(at(s)); nodes.push(c)
  }

  // the whoosh into the title
  if (!gone(1.9)) {
  const wh = a.createBufferSource(); wh.buffer = noiseBuffer(a, 1, 0.2)
  const whF = a.createBiquadFilter(); whF.type = 'bandpass'; whF.Q.value = 1.2
  whF.frequency.setValueAtTime(300, at(1.9))
  whF.frequency.exponentialRampToValueAtTime(3200, at(2.6))
  const whG = a.createGain()
  whG.gain.setValueAtTime(0.0001, at(1.9))
  whG.gain.exponentialRampToValueAtTime(0.22, at(2.55))
  whG.gain.exponentialRampToValueAtTime(0.0001, at(2.7))
  wh.connect(whF).connect(whG).connect(out)
  wh.start(at(1.9)); wh.stop(at(2.75)); nodes.push(wh)
  }

  // the title lands: a low hit, and a chord that rings out
  if (!gone(2.6)) {
  const hit = a.createOscillator(); hit.type = 'sine'
  hit.frequency.setValueAtTime(120, at(2.6))
  hit.frequency.exponentialRampToValueAtTime(42, at(2.95))
  const hitG = a.createGain()
  hitG.gain.setValueAtTime(0.5, at(2.6))
  hitG.gain.exponentialRampToValueAtTime(0.0001, at(3.1))
  hit.connect(hitG).connect(out)
  hit.start(at(2.6)); hit.stop(at(3.15)); nodes.push(hit)
  for (const [f, v] of [[110, 0.05], [164.8, 0.04], [220, 0.035], [329.6, 0.02]] as const) {
    const o = a.createOscillator(); o.type = 'triangle'; o.frequency.value = f
    const g = a.createGain()
    g.gain.setValueAtTime(0.0001, at(2.6))
    g.gain.exponentialRampToValueAtTime(v, at(2.68))
    g.gain.exponentialRampToValueAtTime(0.0001, at(4.8))
    o.connect(g).connect(out)
    o.start(at(2.6)); o.stop(at(4.9)); nodes.push(o)
  }
  }

  return () => {
    try {
      const t = a.currentTime
      out.gain.cancelScheduledValues(t)
      out.gain.setTargetAtTime(0.0001, t, 0.12)
      for (const n of nodes) { try { n.stop(t + 0.6) } catch { /* already stopped */ } }
    } catch { /* context gone */ }
  }
}

/** Wake the audio context from a tap (browsers hold it until one). */
export function unlockAudio(): boolean {
  const a = ac()
  if (!a) return false
  if (a.state === 'suspended') void a.resume()
  return true
}
