import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { HEAL_SKU, bankReceipts, buyConsumable, claimHeld, creditCount, creditTake, heldConsumables, tillOpen } from '../game/monetise'
import { healReady } from '../game/grants'
import { t } from '../game/i18n'
import { endingText } from './purchase'

/**
 * ---- FULL FITNESS, WHERE THE INJURIES ARE ----
 *
 * Owner: "ok put the full fitness on the medical screen, country desk but also
 * keep in store."
 *
 * It only ever sold from the Store, which is the one screen nobody is on at the
 * moment they want it. A manager wants a fit squad while he is LOOKING at the
 * treatment table with four men on it, or picking a Test squad on a Thursday
 * and finding his openside in a boot - not two menus away in a shop he has to
 * remember exists.
 *
 * This is the whole product in one card, so the three places that offer it
 * offer exactly the same thing rather than three drifting copies:
 *
 *   - it is invisible where there is no till (the web build, and every browser
 *     this game has ever run in), like every other purchase door;
 *   - it is invisible where there is nothing to heal, so it never nags a
 *     manager with a fit squad;
 *   - a purchase that could not land - the app was killed, the squad came good
 *     between the sheet and the grant - is held, not swallowed, and offered
 *     back here as Apply;
 *   - and it names a price only when the store itself named one (BuyBtn's rule
 *     in the Store: our own figure said 99p where Play charged £1.19, and the
 *     game sells in storefronts where neither number means anything).
 */
export default function FullFitness({ compact }: { compact?: boolean }) {
  const game = useStore(s => s.game)
  const healSquad = useStore(s => s.healSquad)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!tillOpen()) return
    // held = a banked credit or a stray receipt - and re-read as the weeks
    // pass, because the one-shot version of this raced the bridge, showed Buy
    // over a paid heal, and walked the owner into Google's own "You already
    // own this item" sheet (31 Aug, the Medical Centre)
    void heldConsumables().then(skus => setPending(skus.includes(HEAL_SKU)))
  }, [game?.week])

  if (!tillOpen() || !game || game.unemployed) return null
  // USED THIS ROUND: SAY SO, DO NOT VANISH. healReady is the same gate the
  // Store uses. This card used to return null the moment the heal had been
  // spent, so between matches the Medical Centre simply had no Full Fitness
  // row - and the owner, who had used it, went to the Store to buy another
  // and could not tell why the tap did nothing (v1.2.5: "can we have a bit
  // that visibly says available after next game week"). The card stays, the
  // button is disabled, and one line says when it comes back.
  const spent = !healReady(game) && !pending

  const apply = async () => {
    await bankReceipts(HEAL_SKU)
    if (creditCount(HEAL_SKU) < 1) { setPending(false); setMsg(t('store.creditGone')); return }
    if (healSquad()) {
      creditTake(HEAL_SKU)
      setPending(creditCount(HEAL_SKU) > 0)
      setMsg(t('store.healDone'))
      return
    }
    // WHICH REASON, NOT BOTH OF THEM (owner, v1.1.16: "Ive just brought a full
    // fitness pack in the medical centre and it didnt refresh my players").
    //
    // There are exactly two ways this can fail to land, and the one message
    // used to name both: "nothing to heal right now, or no match since the
    // last visit". Read that standing on the Medical Centre with four men on
    // the table and the first half of it is plainly false, so the whole
    // sentence reads as the game not knowing what it did with the money.
    // healReady is the second reason on its own, so the two can be told apart
    // and the card can say the true one.
    setPending(true)
    setMsg(t(healReady(game) ? 'store.healNobody' : 'store.healWait'))
  }

  const buy = async () => {
    setBusy(true)
    try {
      // ask the bank before the till: a paid heal already banked must never
      // meet Play's sheet again (claimHeld does the banking itself)
      const owed = await claimHeld(HEAL_SKU)
      if (owed === 'stuck') { setMsg(t('till.owedHeld')); return }
      const out = owed === 'credit' ? 'owned' as const : await buyConsumable(HEAL_SKU)
      if (out === 'owned') { setPending(true); await apply() }
      else setMsg(out === 'cancelled' ? null : endingText(out))
    } finally { setBusy(false) }
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>🏥</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{t('store.heal')}</div>
          {!compact && <div className="meta" style={{ marginTop: 1 }}>{t('store.healLine')}</div>}
        </div>
        {/* flexShrink on the button and minWidth:0 on the column above it are
            not decoration: a non-shrinkable sibling in this row is exactly what
            collapsed the Sugar Daddy title to one word per line. */}
        <button className="btn gold" style={{ flexShrink: 0 }} disabled={busy || spent}
          onClick={() => void (pending ? apply() : buy())}>
          {busy ? t('till.asking') : pending ? t('till.applyHere') : t('till.buy')}
        </button>
      </div>
      {spent && <div className="meta muted heal-next">{t('store.healNext')}</div>}
      {msg && <div className="meta sheet-log" style={{ borderLeft: '3px solid var(--gold)', paddingLeft: 8 }}>{msg}</div>}
    </div>
  )
}
