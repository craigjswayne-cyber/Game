import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { HEAL_SKU, buyConsumable, consume, pendingConsumables, skuPriceFrom, tillOpen } from '../game/monetise'
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
  const [price, setPrice] = useState<string | null>(null)

  useEffect(() => {
    if (!tillOpen()) return
    void pendingConsumables().then(skus => setPending(skus.includes(HEAL_SKU)))
    void skuPriceFrom(HEAL_SKU).then(p => setPrice(p.live ? p.price : null))
  }, [])

  if (!tillOpen() || !game || game.unemployed) return null
  // NOTHING TO SELL A FIT SQUAD. healReady is the same gate the Store uses -
  // it is false when nobody is hurt and when this season's allowance is spent.
  if (!healReady(game) && !pending) return null

  const apply = async () => {
    if (healSquad()) {
      await consume(HEAL_SKU)
      setPending(false)
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
    const out = await buyConsumable(HEAL_SKU)
    if (out === 'owned') await apply()
    else setMsg(out === 'cancelled' ? null : endingText(out))
    setBusy(false)
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
        <button className="btn gold" style={{ flexShrink: 0 }} disabled={busy}
          onClick={() => void (pending ? apply() : buy())}>
          {pending ? t('till.applyHere') : price ? t('till.buyFor', { price }) : t('till.buy')}
        </button>
      </div>
      {msg && <div className="meta sheet-log" style={{ borderLeft: '3px solid var(--gold)', paddingLeft: 8 }}>{msg}</div>}
    </div>
  )
}
