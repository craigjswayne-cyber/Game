import { useEffect, useState } from 'react'
import { proLocked, useStore, type Screen } from '../store'
import { canBuy, msSincePurchase, purchaseActive } from '../game/monetise'
import { proDue, readFunnel } from '../game/profunnel'
import { userMatchThisWeek } from '../game/season'
import { askStoreReview } from '../game/storekit'
import { markReviewAsked, reviewAsked, reviewDue } from '../game/reviewask'
import { readUsage } from '../game/usage'
import { nativePlatform } from '../game/shell'

/**
 * ---- THE STORE REVIEW CARD (game/reviewask.ts) ----
 *
 * Draws nothing itself: the card is the store's own (Play In-App Review,
 * StoreKit), laid over the game by the phone. This only picks the moment, by
 * the Pro card's rules (ProPrompt.tsx): Home or the day room, never during a
 * match, never over a modal, a menu, the tutorial, a celebration, the sack,
 * the opening titles, a Pro or feedback card or a payment sheet, and never
 * within thirty seconds of a purchase. Only in the phone shells: the website
 * has no store to rate it in. Automated browsers never get it.
 */
const SAFE: ReadonlySet<Screen> = new Set<Screen>(['home', 'day'])
const OVERLAYS = '.modal-veil, .tut-veil, .celebrate-veil, .sack-veil, .submenu-veil, .intro, .pro-veil, .fb-veil'
const AFTER_PURCHASE_MS = 30_000

let asking = false

export function ReviewAsk() {
  const nav = useStore(s => s.nav)
  const tick = useStore(s => s.tick)
  const [again, setAgain] = useState(0)
  const screen = nav[nav.length - 1]?.screen

  useEffect(() => {
    if (asking || !nativePlatform()) return
    if (typeof navigator !== 'undefined' && navigator.webdriver) return
    if (!reviewDue(readUsage().matches, reviewAsked())) return
    const blocked = (): boolean => {
      const s = useStore.getState()
      const g = s.game
      const here = s.nav[s.nav.length - 1]?.screen
      if (!g || !here || !SAFE.has(here)) return true
      if (s.liveMatch || s.resuming || s.tut) return true
      if (g.sacked || g.celebration || g.annual) return true
      if (purchaseActive() || msSincePurchase() < AFTER_PURCHASE_MS) return true
      // a Pro card due on this landing goes first, even while it is still
      // fetching the store's price (ProPrompt.tsx); this waits for the next
      const fx = g.unemployed ? undefined : userMatchThisWeek(g)
      if (canBuy() && proLocked() && proDue(readFunnel(), !!fx && fx.compId !== 'fr')) return true
      return typeof document !== 'undefined' && !!document.querySelector(OVERLAYS)
    }
    if (!screen || !SAFE.has(screen)) return
    // a beat after landing, so a Pro or feedback card due on this landing
    // opens first and this waits for the next quiet one
    const timer = setTimeout(() => {
      if (asking || reviewAsked()) return
      if (blocked()) { setAgain(n => n + 1); return }
      asking = true
      markReviewAsked()
      void askStoreReview().finally(() => { asking = false })
    }, 2500)
    return () => clearTimeout(timer)
  }, [screen, tick, again])

  return null
}
