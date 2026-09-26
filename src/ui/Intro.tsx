import { useEffect, useState } from 'react'
import { BrandMark } from './components'
import { t } from '../game/i18n'

/**
 * ---- THE OPENING TITLES (1.8.0) ----
 *
 * Owner, 26 Sep 2026: "I want a 5 second motion intro to the loading in of the
 * game. It should feel premium, the style of the game with the logo of the game
 * before the menu page launches."
 *
 * Five seconds, in four beats, all of it transform and opacity so a budget
 * Android phone plays it on the compositor and not the main thread:
 *
 *   0.0 - 1.2  the pitch lines draw across the dark, halfway first
 *   0.5 - 2.0  the badge lands and the ball turns into its place
 *   1.6 - 3.4  PHASE rises letter by letter, the rule wipes out, RUGBY MANAGER
 *              27 tracks in with the 27 in gold, and a light runs over it
 *   4.3 - 5.0  the whole card lifts away and the title screen is underneath
 *
 * WHAT IT IS NOT: the launch screen. Apple's guidelines say a launch screen
 * "isn't a branding opportunity" and Android's splash API wants its icon
 * animation under a second, so the native launch screens stay exactly as they
 * are and this plays once the app has drawn, as the game's own title sequence.
 * Which is also why it gives way at once: a tap anywhere skips it, it plays
 * once per launch, a manager can turn it off in Settings, and a phone set to
 * reduce motion never sees it.
 *
 * Automated browsers skip it too (navigator.webdriver). Some fifty harnesses
 * open on the title screen and click New Career in the first second; they are
 * testing the game, not waiting for the credits. scripts/introprobe.mjs plays
 * it on purpose with ?intro=1.
 */
export const INTRO_KEY = 'phase.intro'
const LENGTH_MS = 5000
let playedThisLaunch = false

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
  useEffect(() => {
    if (!on) return
    playedThisLaunch = true
    const out = setTimeout(() => setLeaving(true), LENGTH_MS - 700)
    const done = setTimeout(() => setOn(false), LENGTH_MS)
    return () => { clearTimeout(out); clearTimeout(done) }
  }, [on])
  if (!on) return null
  const skip = () => { setLeaving(true); setTimeout(() => setOn(false), 280) }
  return (
    <div className={`intro${leaving ? ' leaving' : ''}`} onClick={skip} role="presentation" data-testid="intro">
      <svg className="intro-pitch" viewBox="0 0 100 160" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <rect x="8" y="8" width="84" height="144" rx="1" pathLength={1} className="l l0" />
        <line x1="8" y1="80" x2="92" y2="80" pathLength={1} className="l l1" />
        <line x1="8" y1="48" x2="92" y2="48" pathLength={1} className="l l2" />
        <line x1="8" y1="112" x2="92" y2="112" pathLength={1} className="l l2" />
        <line x1="8" y1="68" x2="92" y2="68" pathLength={1} className="l l3 dash" />
        <line x1="8" y1="92" x2="92" y2="92" pathLength={1} className="l l3 dash" />
        <line x1="8" y1="18" x2="92" y2="18" pathLength={1} className="l l4" />
        <line x1="8" y1="142" x2="92" y2="142" pathLength={1} className="l l4" />
      </svg>
      <div className="intro-glow" />
      <div className="intro-lockup">
        <div className="intro-badge"><BrandMark size={92} /></div>
        <div className="intro-word" aria-label="PHASE">
          {'PHASE'.split('').map((ch, i) => <span key={i} style={{ animationDelay: `${1.6 + i * 0.08}s` }}>{ch}</span>)}
        </div>
        <div className="intro-rule" />
        <div className="intro-sub">RUGBY MANAGER <b>27</b></div>
        <div className="intro-tag">{t('menu.tagline')}</div>
      </div>
      <div className="intro-skip">{t('intro.skip')}</div>
    </div>
  )
}
