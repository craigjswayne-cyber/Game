import { useEffect, useRef, useState } from 'react'
import { proLocked, useStore, type Screen } from '../store'
import { t } from '../game/i18n'
import {
  PRO_INTRO_SKU, SUPPORTER_SKU, adBridgePresent, buyOwnable, canBuy, hasSupporter, msSincePurchase,
  proDiscount, proPrices, purchaseActive, type Product,
} from '../game/monetise'
import { proDue, proOfferAnswered, proShown, readFunnel, writeFunnel, type ProKind } from '../game/profunnel'
import { userMatchThisWeek } from '../game/season'
import { endingText } from './purchase'
import { Glyph } from './glyphs'

/**
 * ---- THE PRO MANAGER CARD (1.8.6, docs/pro-manager.md) ----
 *
 * PREMIUM, NOT PUSHY. The free game is the whole game; this card says once,
 * plainly, what Pro Manager is and what it costs, and gets out of the way.
 * game/profunnel.ts decides WHICH card is due; this decides WHETHER NOW is a
 * decent moment, and draws it.
 *
 * WHEN: only on Home or the day room, which is where a manager lands after
 * the full-time round-up is dismissed. Never during a match, never on team
 * selection or tactics (they are other screens), never over a modal, the
 * tutorial, a celebration, the sack, the opening titles or a payment sheet,
 * and never within thirty seconds of a purchase ending. Blocked is not lost: the
 * card is still due at the next safe moment.
 *
 * WHERE: only where Pro Manager would change something - a store to buy it
 * from AND the perks locked behind it (proLocked: a till, an advert bridge,
 * and Pro not owned). The website has neither and never sees this.
 *
 * WHAT: the store's own price, read live. A card the store cannot price does
 * not open (and is not spent): a door that opens onto "the store is not
 * answering" is the dead shelf v1.1.6 taught the game not to show.
 */

/** Where a card may appear: the desk and the day room. */
const SAFE: ReadonlySet<Screen> = new Set<Screen>(['home', 'day'])
/** Anything already floating over the screen. The card never stacks on one. */
const OVERLAYS = '.modal-veil, .tut-veil, .celebrate-veil, .sack-veil, .submenu-veil, .intro'
/** How long after a purchase ends before a card may follow it: long enough
 *  that the line the purchase printed has been read and left behind. */
const AFTER_PURCHASE_MS = 30_000
/** How long to leave the store alone after it could not price Pro. */
const RETRY_MS = 60_000

let asking = false
let quietUntil = 0

interface Open {
  kind: ProKind
  /** the product the primary button buys */
  sku: string
  price: string
  /** the offer only: the normal price, for "Usually" */
  usual: string | null
  /** the offer only: a TRUE percentage, or null (proDiscount) */
  pct: number | null
  /** the offer, shown at the normal price because the store did not list
   *  the intro product: no one-time wording at all */
  fallback: boolean
}

export function ProPrompt() {
  const game = useStore(s => s.game)
  const nav = useStore(s => s.nav)
  const live = useStore(s => s.liveMatch)
  const resuming = useStore(s => s.resuming)
  const tut = useStore(s => s.tut)
  const tick = useStore(s => s.tick)
  const claim = useStore(s => s.claimSupporter)
  const [open, setOpen] = useState<Open | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  /** bumped to look again when a due card was held back on a safe screen by
   *  something that closes without telling the store (a menu, a sheet) */
  const [again, setAgain] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const screen = nav[nav.length - 1]?.screen

  /** Every reason not to, in one place, read again right before opening. */
  const blocked = (): boolean => {
    const s = useStore.getState()
    const g = s.game
    const here = s.nav[s.nav.length - 1]?.screen
    if (!g || !here || !SAFE.has(here)) return true
    if (s.liveMatch || s.resuming || s.tut) return true
    if (g.sacked || g.celebration || g.annual) return true
    if (!canBuy() || !proLocked() || hasSupporter()) return true
    if (purchaseActive() || msSincePurchase() < AFTER_PURCHASE_MS) return true
    if (typeof document !== 'undefined' && document.querySelector(OVERLAYS)) return true
    return false
  }

  const due = (): ProKind | null => {
    const g = useStore.getState().game
    if (!g) return null
    const fx = g.unemployed ? undefined : userMatchThisWeek(g)
    return proDue(readFunnel(), !!fx && fx.compId !== 'fr')
  }

  useEffect(() => {
    if (open || asking || Date.now() < quietUntil) return
    if (!due()) return
    if (blocked()) {
      // on Home or the day room with a card due, look again shortly: the menu
      // or modal in the way closes without the store hearing about it. Off
      // those screens nothing polls - the next landing looks for itself.
      const navNow = useStore.getState().nav
      const here = navNow[navNow.length - 1]?.screen
      if (!here || !SAFE.has(here)) return
      const t = setTimeout(() => setAgain(n => n + 1), 1500)
      return () => clearTimeout(t)
    }
    // a beat after landing, so whatever else this screen opens has opened
    // first and the card never arrives in the same frame as a tap
    const timer = setTimeout(() => {
      void (async () => {
        if (asking) return
        if (blocked()) { setAgain(n => n + 1); return }
        const kind = due()
        if (!kind) return
        asking = true
        try {
          const { normal, intro } = await proPrices()
          if (blocked() || due() !== kind) return
          let card: Open | null = null
          if (kind === 'offer' && intro) {
            card = { kind, sku: PRO_INTRO_SKU, price: intro.price, usual: normal?.price ?? null, pct: proDiscount(normal, intro), fallback: false }
          } else if (normal) {
            card = { kind, sku: SUPPORTER_SKU, price: normal.price, usual: null, pct: null, fallback: kind === 'offer' }
          }
          if (!card) { quietUntil = Date.now() + RETRY_MS; return }
          // the card is spent THE MOMENT it is shown, so a restart mid-card
          // or mid-purchase can never show the one-time offer twice. A device
          // that cannot remember that does not get the card at all.
          if (!writeFunnel(proShown(readFunnel(), kind, card.fallback))) { quietUntil = Infinity; return }
          setMsg(null); setDone(false); setOpen(card)
        } finally { asking = false }
      })()
    }, 700)
    return () => clearTimeout(timer)
  }, [screen, game, live, resuming, tut, tick, open, again])

  // the primary button gets focus, so a keyboard or switch user lands on the
  // card rather than behind it
  useEffect(() => { if (open) box.current?.querySelector<HTMLButtonElement>('button')?.focus() }, [open])

  if (!open) return null

  const isOffer = open.kind === 'offer' && !open.fallback
  const close = () => {
    // Continue Free on the real offer declines it for good, and that is all
    // it does: no confirm, no follow-up, nothing taken away
    if (isOffer && !done) writeFunnel(proOfferAnswered(readFunnel(), false))
    setOpen(null)
  }
  const buy = async () => {
    if (busy) return
    setBusy(true); setMsg(null)
    try {
      const out = await buyOwnable(open.sku)
      if (out === 'owned') {
        if (isOffer) writeFunnel(proOfferAnswered(readFunnel(), true))
        claim() // repaint now: the skins unlock and the adverts go this frame
        setDone(true)
      } else {
        // cancelled, pending, refused: nothing granted, the card stays so the
        // player can read why and choose again
        setMsg(endingText(out))
      }
    } finally { setBusy(false) }
  }

  const ads = adBridgePresent()
  const title = t('pro.title')
  const headId = 'pro-card-title'

  return (
    <div className="pro-veil" role="presentation">
      <div ref={box} className={`pro-card${open.kind === 'reminder' ? ' pro-light' : ''}`}
        role="dialog" aria-modal="true" aria-labelledby={headId} data-pro={open.kind} data-sku={open.sku}>
        {done ? (
          <>
            <div className="pro-head">
              <span className="pro-ico"><Glyph name="star" /></span>
              <h2 id={headId}>{title}</h2>
            </div>
            <p className="pro-line">{t('pro.done')}</p>
            <button className="btn gold pro-btn" onClick={() => setOpen(null)}>{t('pro.close')}</button>
          </>
        ) : (
          <>
            {isOffer && <div className="pro-tag">{t('pro.offerTag')}</div>}
            <div className="pro-head">
              <span className="pro-ico"><Glyph name="star" /></span>
              <h2 id={headId}>{title}</h2>
            </div>
            <p className="pro-line">
              {open.kind === 'first' ? t('pro.firstLine')
                : isOffer ? t('pro.offerLine')
                : t(ads ? 'pro.reminderLine' : 'pro.reminderLineSkins')}
            </p>
            {open.kind !== 'reminder' && (
              <ul className="pro-list">
                {ads && <li>{t('pro.benefitAds')}</li>}
                <li>{t('pro.benefitSkins')}</li>
                <li>{t('pro.benefitBack')}</li>
              </ul>
            )}
            <div className="pro-price">
              <b>{open.price}</b>
              {isOffer && open.pct != null && <span className="pro-off">{t('pro.off', { n: open.pct })}</span>}
              {isOffer && open.usual && <span className="pro-usual">{t('pro.usually', { price: open.usual })}</span>}
            </div>
            <button className="btn gold pro-btn" disabled={busy} onClick={() => void buy()}>
              {busy ? t('till.asking') : t('pro.buy')}
            </button>
            <button className="btn ghost pro-btn" disabled={busy} onClick={close}>{t('pro.free')}</button>
            {msg && <div className="meta pro-msg" role="status">{msg}</div>}
            <p className="pro-fine">{t(isOffer ? 'pro.offerFine' : 'pro.laterFine')}</p>
          </>
        )}
      </div>
    </div>
  )
}
