import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { BrandMark } from './components'
import { t } from '../game/i18n'
import { introSound, introUnlocked, soundOn, unlockAudio } from './audio'
import titleArt from './title-bg.webp'
import { preloadAllArt } from './artPreload'
import { Glyph } from './glyphs'

/**
 * ---- THE OPENING TITLES (1.8.0) ----
 *
 * Owner, 26 Sep 2026: "I want a 5 second motion intro to the loading in of the
 * game. It should feel premium, the style of the game with the logo of the game
 * before the menu page launches." And a day later, with the key art: "The intro
 * title should be more based around the title card - the desk, steam rising
 * from the coffee mug, the light flickering, sound of a rugby game on the tv in
 * the background. With some sound fx as the title appears."
 *
 * So it is the manager's office from the title card, and it comes alive:
 *
 *   0.0 - 1.1  dark; the desk lamp flickers on (a click on each flicker, the
 *              mains buzz), the framed match on the wall glows and flickers
 *              like a telly, and the telly's crowd is on in the background
 *   0.8 -      steam curls up off the coffee mug; the room slowly pushes in
 *   1.9 - 2.6  a whoosh rises
 *   2.6 - 3.6  the title lands as the key art sets it: the badge, PHASE in
 *              green, RUGBY and MANAGER stacked in white, the rule, and the
 *              strapline with its last word in green; a low hit and a chord
 *   4.3 - 5.0  it lifts away, and the title screen (the same office) is there
 *
 * The lamp, the mug and the frame are placed on the art itself: their spots in
 * the 900 x 1601 picture are mapped through the same cover crop the screen uses,
 * so they sit on the lamp, the mug and the frame on any phone or tablet.
 *
 * SOUND. Browsers (and Android's web view) hold sound until the first tap, and
 * this plays before anyone has tapped. If the device lets it play, it plays; if
 * not, a small speaker button starts it from where the pictures are, without
 * skipping. Everywhere else a tap skips. The sound setting silences it.
 *
 * WHAT IT IS NOT: the launch screen. Apple's guidelines say a launch screen
 * "isn't a branding opportunity" and Android's splash API wants its icon
 * animation under a second, so the native launch screens are untouched and this
 * is the game's own title sequence: once per launch, a switch in Settings to
 * turn it off, and never under reduce motion.
 *
 * Automated browsers skip it (navigator.webdriver): some fifty harnesses open on
 * the title screen. scripts/introprobe.mjs plays it on purpose with ?intro=1.
 */
export const INTRO_KEY = 'phase.intro'
const LENGTH_MS = 5000
let playedThisLaunch = false

/** the art's own size, and where things are in it (fractions of the picture).
 *  The key art was redrawn on 28 Sep 2026 (owner: the STARTING XV sheet showed
 *  a football pitch; the new art has a rugby pitch, posts and all), so these
 *  are measured off the new picture. */
const ART = { w: 1024, h: 1536 }
/** where the crop sits across the art: near the left edge, so the mug (far
 *  left of the picture) stays in frame on a portrait phone. theme.css matches it. */
const POS_X = 0.06
const SPOT = {
  mug: { x: 0.059, y: 0.505 },   // the coffee's surface
  lamp: { x: 0.088, y: 0.173 },  // under the shade
  tv: { x: 0.054, y: 0.042, w: 0.283, h: 0.179 }, // the framed match, top left
}

export function introOn(): boolean {
  try { return localStorage.getItem(INTRO_KEY) !== 'off' } catch { return true }
}
export function setIntroOn(on: boolean) {
  try { localStorage.setItem(INTRO_KEY, on ? 'on' : 'off') } catch { /* private mode */ }
}

function shouldPlay(): boolean {
  if (playedThisLaunch) return false
  const forced = typeof location !== 'undefined' && /[?&]intro=1\b/.test(location.search)
  if (forced) return true
  if (typeof navigator !== 'undefined' && navigator.webdriver) return false
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false
  return introOn()
}

export function Intro() {
  const [on, setOn] = useState(shouldPlay)
  const [leaving, setLeaving] = useState(false)
  const [needTap, setNeedTap] = useState(false)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const el = useRef<HTMLDivElement>(null)
  const stopSound = useRef<() => void>(() => {})
  const began = useRef(0)

  useEffect(() => {
    if (!on) return
    playedThisLaunch = true
    began.current = performance.now()
    // the five seconds nothing else is fetching: every picture in the game
    // comes down now, so no page waits for one later (artPreload.ts)
    preloadAllArt({ now: true })
    const measure = () => { const r = el.current; if (r) setBox({ w: r.clientWidth, h: r.clientHeight }) }
    measure()
    window.addEventListener('resize', measure)
    if (soundOn()) {
      stopSound.current = introSound(0)
      // if the browser is holding sound until a tap, offer the speaker
      const check = setTimeout(() => { if (!introUnlocked()) setNeedTap(true) }, 250)
      const out = setTimeout(() => setLeaving(true), LENGTH_MS - 700)
      const done = setTimeout(() => { stopSound.current(); setOn(false) }, LENGTH_MS)
      return () => { clearTimeout(check); clearTimeout(out); clearTimeout(done); window.removeEventListener('resize', measure) }
    }
    const out = setTimeout(() => setLeaving(true), LENGTH_MS - 700)
    const done = setTimeout(() => setOn(false), LENGTH_MS)
    return () => { clearTimeout(out); clearTimeout(done); window.removeEventListener('resize', measure) }
  }, [on])

  if (!on) return null
  const skip = () => { stopSound.current(); setLeaving(true); setTimeout(() => setOn(false), 280) }
  const sound = (e: React.MouseEvent) => {
    e.stopPropagation()
    stopSound.current()
    unlockAudio()
    stopSound.current = introSound((performance.now() - began.current) / 1000)
    setNeedTap(false)
  }

  // the art's cover crop, so a spot in the picture lands on the screen
  const k = Math.max(box.w / ART.w, box.h / ART.h) || 0
  const ox = (box.w - ART.w * k) * POS_X, oy = (box.h - ART.h * k) / 2
  const at = (x: number, y: number) => ({ left: ox + x * ART.w * k, top: oy + y * ART.h * k })
  const mug = at(SPOT.mug.x, SPOT.mug.y)
  const lamp = at(SPOT.lamp.x, SPOT.lamp.y)
  const tv = at(SPOT.tv.x, SPOT.tv.y)
  const words = t('menu.tagline').split(' ')
  const lastWord = words.pop()

  return (
    <div ref={el} className={`intro${leaving ? ' leaving' : ''}`} onClick={skip} role="presentation" data-testid="intro"
      style={{ '--art': `url(${titleArt})`, '--k': k } as CSSProperties}>
      <div className="intro-room">
        <div className="intro-art" />
        {k > 0 && (
          <>
            <div className="intro-tv" style={{ left: tv.left, top: tv.top, width: SPOT.tv.w * ART.w * k, height: SPOT.tv.h * ART.h * k }} />
            <div className="intro-lamp" style={{ left: lamp.left, top: lamp.top }} />
            <div className="intro-steam" style={{ left: mug.left, top: mug.top }}>
              <i /><i /><i />
            </div>
          </>
        )}
      </div>
      <div className="intro-dark" />
      <div className="intro-lockup">
        <div className="intro-badge"><BrandMark size={84} /></div>
        <div className="intro-word">PHASE</div>
        <div className="intro-sub"><span>RUGBY</span><span>MANAGER</span></div>
        <div className="intro-rule"><span /><i /><span /></div>
        <div className="intro-tag">{words.join(' ')} <b>{lastWord}</b></div>
      </div>
      {needTap && (
        <button className="intro-sound" onClick={sound} aria-label={t('intro.sound')}><Glyph name="sound" /></button>
      )}
      <div className="intro-skip">{t('intro.skip')}</div>
    </div>
  )
}
