import { useEffect, useMemo, useRef, useState } from 'react'
import { proLocked, useStore, type Screen } from '../store'
import { getLang, t } from '../game/i18n'
import { canBuy, msSincePurchase, purchaseActive, tillOpen } from '../game/monetise'
import { proDue, readFunnel } from '../game/profunnel'
import { userMatchThisWeek } from '../game/season'
import { mailtoUrl } from '../game/bugreport'
import { COMMUNITY_URL } from '../game/community'
import { nativePlatform } from '../game/shell'
import { genderOf } from '../game/gender'
import { FEEDBACK_SUBJECT, buildFeedbackReport, feedbackDue, readUsage, withOffered, writeUsage } from '../game/usage'
import { useTablet } from './tablet'
import { Glyph } from './glyphs'

/**
 * ---- THE FEEDBACK REPORT CARD (game/usage.ts) ----
 *
 * What the player has used so far, shown in full, and two ways to send it
 * that he drives himself: his mail app, or the clipboard for the #feedback
 * channel on Discord. Nothing leaves the device otherwise; the game has no
 * network call (scripts/netprobe.ts).
 *
 * OFFERED ONCE, after the first in-game month (usage.feedbackDue), and always
 * reachable again from the Report a Bug page, which opens this same card.
 *
 * WHEN, BY THE PRO CARD'S RULES (ProPrompt.tsx): Home or the day room only,
 * never during a match, never over a modal, a menu, the tutorial, a
 * celebration, the sack, the opening titles or a payment sheet. And never in
 * the same match flow as a Pro card: if one is due it goes first and this
 * waits; if one was shown this flow, this waits for the next. ProPrompt does
 * the same in reverse (usage.offeredAt).
 *
 * Automated browsers do not get the automatic card (navigator.webdriver, as
 * the opening titles), so the fifty-odd harnesses that play a month are not
 * met by it. scripts/feedbackui.mjs asks for it with ?feedback=1.
 */

const SAFE: ReadonlySet<Screen> = new Set<Screen>(['home', 'day'])
const OVERLAYS = '.modal-veil, .tut-veil, .celebrate-veil, .sack-veil, .submenu-veil, .intro, .pro-veil'
const AFTER_PURCHASE_MS = 30_000

function autoAllowed(): boolean {
  try {
    if (typeof navigator !== 'undefined' && navigator.webdriver) {
      return typeof location !== 'undefined' && /[?&]feedback=1\b/.test(location.search)
    }
    return true
  } catch { return false }
}

/** A Pro card is due, or was shown in this match flow: the feedback card waits. */
function proInTheWay(): boolean {
  try {
    if (!canBuy() || !proLocked()) return false
    const f = readFunnel()
    if (f.lastShownAt >= 0 && f.lastShownAt === f.played) return true
    const g = useStore.getState().game
    const fx = g && !g.unemployed ? userMatchThisWeek(g) : undefined
    return proDue(f, !!fx && fx.compId !== 'fr') != null
  } catch { return true }
}

export function FeedbackPrompt() {
  const open = useStore(s => s.feedback)
  const game = useStore(s => s.game)
  const nav = useStore(s => s.nav)
  const live = useStore(s => s.liveMatch)
  const resuming = useStore(s => s.resuming)
  const tut = useStore(s => s.tut)
  const tick = useStore(s => s.tick)
  const tablet = useTablet()
  const [msg, setMsg] = useState<string | null>(null)
  const [again, setAgain] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const pre = useRef<HTMLPreElement>(null)
  const screen = nav[nav.length - 1]?.screen

  const blocked = (): boolean => {
    const s = useStore.getState()
    const g = s.game
    const here = s.nav[s.nav.length - 1]?.screen
    if (s.feedback) return true
    if (!g || !here || !SAFE.has(here)) return true
    if (s.liveMatch || s.resuming || s.tut) return true
    if (g.sacked || g.celebration || g.annual) return true
    if (purchaseActive() || msSincePurchase() < AFTER_PURCHASE_MS) return true
    if (typeof document !== 'undefined' && document.querySelector(OVERLAYS)) return true
    if (proInTheWay()) return true
    return false
  }

  useEffect(() => {
    if (open || !autoAllowed()) return
    if (!feedbackDue(readUsage())) return
    if (blocked()) {
      // on a safe screen, look again shortly: a menu or modal in the way
      // closes without the store hearing about it
      const navNow = useStore.getState().nav
      const here = navNow[navNow.length - 1]?.screen
      if (!here || !SAFE.has(here)) return
      const tm = setTimeout(() => setAgain(n => n + 1), 1500)
      return () => clearTimeout(tm)
    }
    // a beat after landing, after the Pro card has had its own look (700ms)
    const timer = setTimeout(() => {
      if (blocked() || !feedbackDue(readUsage())) { setAgain(n => n + 1); return }
      // spent the moment it is shown; a device that cannot remember that
      // does not get the card at all
      if (!writeUsage(withOffered(readUsage()))) return
      setMsg(null)
      useStore.getState().openFeedback()
    }, 1200)
    return () => clearTimeout(timer)
  }, [screen, game, live, resuming, tut, tick, open, again])

  useEffect(() => {
    if (!open) return
    setMsg(null)
    box.current?.querySelector<HTMLElement>('.fb-btn')?.focus()
  }, [open])

  const report = useMemo(() => open ? buildFeedbackReport({
    usage: readUsage(),
    version: typeof __BUILD_TAG__ === 'string' ? __BUILD_TAG__ : 'unknown',
    platform: nativePlatform() ?? 'web',
    lang: getLang(),
    tablet,
    gender: game ? genderOf(game) : null,
    store: tillOpen(),
  }) : '', [open, tablet, game])

  if (!open) return null

  const close = () => useStore.getState().closeFeedback()

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(report)
      setMsg(t('feedback.copied'))
    } catch {
      // refused outright in some in-app browsers: the report is on screen,
      // so select it for the player to copy by hand
      try {
        const sel = window.getSelection()
        if (sel && pre.current) { const r = document.createRange(); r.selectNodeContents(pre.current); sel.removeAllRanges(); sel.addRange(r) }
      } catch { /* the message still says how */ }
      setMsg(t('feedback.copyFailed'))
    }
  }

  const headId = 'fb-card-title'
  return (
    <div className="fb-veil" role="presentation">
      <div ref={box} className="fb-card" role="dialog" aria-modal="true" aria-labelledby={headId}>
        <div className="pro-head">
          <span className="pro-ico"><Glyph name="chart" /></span>
          <h2 id={headId}>{t('feedback.title')}</h2>
        </div>
        <p className="pro-line">{t('feedback.line')}</p>
        <pre ref={pre} className="fb-report" tabIndex={0} aria-label={t('feedback.reportLabel')}>{report}</pre>
        <div className="fb-btns">
          <a className="btn gold fb-btn" href={mailtoUrl(report, FEEDBACK_SUBJECT, '[trimmed for e-mail - use Copy for the full report]')}>
            {t('feedback.email')}
          </a>
          <button className="btn fb-btn" onClick={() => { void doCopy() }}>{t('feedback.copy')}</button>
          <button className="btn ghost fb-btn" onClick={close}>{t('feedback.notNow')}</button>
        </div>
        {msg && <div className="meta pro-msg" role="status">{msg}</div>}
        <p className="pro-fine">
          {t('feedback.discord')}{' '}
          <a className="fb-discord" href={COMMUNITY_URL} target="_blank" rel="noopener noreferrer">{t('feedback.discordLink')}</a>
        </p>
      </div>
    </div>
  )
}
