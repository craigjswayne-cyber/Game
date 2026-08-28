import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import { SectionTitle } from '../components'
import {
  CHARTER_SKU, ESTATE_SKU, HEAL_SKU, INJECT_SKUS, PINNACLE_SKU, SUPPORT_SKU, SUPPORTER_SKU,
  adBridge, buyConsumable, buyOwnable, consume, hasEntitlement, hasSupporter,
  pendingConsumables, restore, skuPrice, tillHealth, tillOpen,
} from '../../game/monetise'
import { INJECT_TIERS, healReady, injectionCash, injectionsLeft, type InjectTier } from '../../game/grants'
import { fmtMoney, fmtWage } from '../../game/model'
import { NAT_TIERS, flagOf, nationName } from '../../game/nations'
import { t } from '../../game/i18n'

/**
 * THE STORE. One row per product, one line per row (owner, v1.1.4: "strip
 * the store copy right down - each product instantly clear"). The essays
 * about what the till does and does not do are gone; what remains is the
 * one-line fineprint at the foot, because "nothing here plays the matches"
 * is the whole of the old two cards in nine words.
 *
 * Reachable only where a store exists to open it (tillOpen), like always.
 * Two rows carry their own extra gate:
 *  - Remove all ads renders only where an ad provider actually exists
 *    (adBridge) or the removal is already owned. Selling the absence of ads
 *    in a build that has none is the dishonesty v1.1.3 removed; the row
 *    appears the day a wrapper ships ads, and not an hour before.
 *  - Board funding sells HERE since v1.1.5 (owner: "board funding should
 *    all be on the store too, not where it currently is") - four fixed
 *    resolutions, 10m to 130m, each with its season of cap-exempt wages.
 *    The Boardroom keeps only the Charter's signing desk.
 *
 * Every ending of a purchase still gets its sentence (cancelled / pending /
 * unavailable / error), one line under the row it belongs to.
 */

type Ending = 'owned' | 'cancelled' | 'pending' | 'unavailable' | 'error'
const endingKey = (out: Ending) =>
  out === 'cancelled' ? 'supporter.cancelled'
    : out === 'pending' ? 'supporter.pending'
    : out === 'unavailable' ? 'supporter.unavailable'
    : 'supporter.error'

/** One product on the shelf: icon, name, one line, one button. */
function Row({ icon, title, line, right, msg, children }: {
  icon: string; title: string; line: string
  right?: React.ReactNode; msg?: string | null; children?: React.ReactNode
}) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
          <div className="meta" style={{ marginTop: 1 }}>{line}</div>
        </div>
        {right}
      </div>
      {children}
      {msg && <div className="meta sheet-log" style={{ borderLeft: '3px solid var(--gold)', paddingLeft: 8 }}>{msg}</div>}
    </div>
  )
}

/** The one-tap buy button, price on its face when the store will say one. */
function BuyBtn({ sku, busy, onBuy }: { sku: string; busy: boolean; onBuy: () => void }) {
  const [price, setPrice] = useState<string | null>(null)
  useEffect(() => { void skuPrice(sku).then(setPrice) }, [sku])
  return (
    <button className="btn gold" style={{ flexShrink: 0 }} disabled={busy} onClick={onBuy}>
      {price ? t('till.buyFor', { price }) : t('till.buy')}
    </button>
  )
}

const TIER_KEY: Record<InjectTier, string> = {
  s: 'till.injectS', m: 'till.injectM', l: 'till.injectL', xl: 'till.injectXL',
}

/**
 * IS THE TILL ACTUALLY OPEN?
 *
 * tillOpen() only says a bridge object exists. It cannot say whether the
 * store behind it will answer, and the reference prices (monetise.ts) make a
 * store that will not answer look exactly like one that will: a full shelf,
 * priced, until you tap it and it says nothing was charged. That is precisely
 * the fault the owner hit on v1.1.6, and it cost an evening to read.
 *
 * So the shelf reports its own health, in one line, before anybody spends a
 * tap on it. Silent when the store answers - which is every shipped build that
 * is set up properly, so nearly all of them.
 */
function TillHealth() {
  const [state, setState] = useState<{ live: number; asked: number } | null>(null)
  useEffect(() => { void tillHealth().then(setState) }, [])
  if (!state || state.live === state.asked) return null
  const key = state.live === 0 ? 'store.tillSilent' : 'store.tillPartial'
  return (
    <div className="card" style={{ borderLeft: '3px solid var(--gold)' }}>
      <div className="meta">{t(key, { live: state.live, asked: state.asked })}</div>
    </div>
  )
}

const OwnedChip = () => (
  <span className="chip" style={{ flexShrink: 0, color: 'var(--gold)', fontWeight: 700 }}>✓ {t('store.owned')}</span>
)

export default function Supporter() {
  const game = useStore(s => s.game)
  const go = useStore(s => s.go)
  const claim = useStore(s => s.claimSupporter)
  const { healSquad, buildEstate, makeTheCall } = useStore.getState()
  const boardInject = useStore(s => s.boardInject)
  useStore(s => s.tick)
  const [busy, setBusy] = useState(false)
  const [msgs, setMsgs] = useState<Record<string, string | null>>({})
  const [healPending, setHealPending] = useState(false)
  const [estateArm, setEstateArm] = useState(false)
  const [natPick, setNatPick] = useState<string>(NAT_TIERS[0][0])
  const [pendingInj, setPendingInj] = useState<InjectTier[]>([])
  const say = (sku: string, text: string | null) => setMsgs(m => ({ ...m, [sku]: text }))

  // a heal paid for and not yet applied (a crash, a full-strength squad, a
  // spent seasonal limit) is surfaced here until it lands - same recovery
  // promise the Boardroom makes for injections
  useEffect(() => {
    void pendingConsumables().then(skus => {
      setHealPending(skus.includes(HEAL_SKU))
      setPendingInj((Object.keys(INJECT_TIERS) as InjectTier[]).filter(tier => skus.includes(INJECT_SKUS[tier])))
    })
  }, [])

  if (!tillOpen()) return null

  const inCareer = !!game && !game.unemployed

  const buyNC = async (sku: string, thenApply?: () => void) => {
    setBusy(true)
    const out = await buyOwnable(sku)
    setBusy(false)
    if (out === 'owned') { claim(); thenApply?.(); say(sku, t('store.bought')) }
    else say(sku, t(endingKey(out)))
  }

  const applyHealNow = async () => {
    if (!inCareer) { say(HEAL_SKU, t('store.needCareer')); return }
    if (healSquad()) {
      await consume(HEAL_SKU)
      setHealPending(false)
      say(HEAL_SKU, t('store.healDone'))
    } else {
      // squad already fit, or the seasonal limit is spent: the purchase is
      // held at the store, not swallowed
      setHealPending(true)
      say(HEAL_SKU, t('store.healHeld'))
    }
  }
  const buyHeal = async () => {
    setBusy(true)
    const out = await buyConsumable(HEAL_SKU)
    setBusy(false)
    if (out === 'owned') await applyHealNow()
    else say(HEAL_SKU, t(endingKey(out)))
  }

  /** Land a paid injection in this career, and only then spend the receipt -
   *  the same promise the Boardroom shelf used to make: a purchase the career
   *  refuses stays owned at the store and is offered back until it lands. */
  const landInjection = async (tier: InjectTier) => {
    if (!inCareer || !game) { say(INJECT_SKUS[tier], t('store.needCareer')); return }
    const amount = fmtMoney(injectionCash(game, tier))
    if (boardInject(tier)) {
      await consume(INJECT_SKUS[tier])
      setPendingInj(p => p.filter(x => x !== tier))
      say(INJECT_SKUS[tier], t('till.injLanded', { amount }))
    } else {
      setPendingInj(p => (p.includes(tier) ? p : [...p, tier]))
      say(INJECT_SKUS[tier], t('till.injHeld'))
    }
  }
  const buyInjection = async (tier: InjectTier) => {
    if (!inCareer) { say(INJECT_SKUS[tier], t('store.needCareer')); return }
    setBusy(true)
    const out = await buyConsumable(INJECT_SKUS[tier])
    if (out === 'owned') await landInjection(tier)
    else say(INJECT_SKUS[tier], t(endingKey(out)))
    setBusy(false)
  }

  const doRestore = async () => {
    setBusy(true)
    const changed = await restore()
    setBusy(false)
    if (changed) claim()
    say('restore', t(changed ? 'supporter.restored' : hasSupporter() ? 'supporter.alreadyYours' : 'supporter.nothingToRestore'))
  }

  const adsExist = !!adBridge()
  const ownsAds = hasEntitlement(SUPPORTER_SKU)
  const ownsSupport = hasEntitlement(SUPPORT_SKU)
  const ownsPinnacle = hasEntitlement(PINNACLE_SKU)
  const ownsEstate = hasEntitlement(ESTATE_SKU)
  const ownsCharter = hasEntitlement(CHARTER_SKU)

  return (
    <>
      <SectionTitle sub={t('store.sub')}>{t('store.title')}</SectionTitle>
      <TillHealth />

      {(adsExist || ownsAds) && (
        <Row icon="🚫" title={t('store.removeAds')} line={t('store.removeAdsLine')} msg={msgs[SUPPORTER_SKU]}
          right={ownsAds ? <OwnedChip /> : <BuyBtn sku={SUPPORTER_SKU} busy={busy} onBuy={() => void buyNC(SUPPORTER_SKU)} />} />
      )}

      <Row icon="💛" title={t('store.support')} line={t('store.supportLine')} msg={msgs[SUPPORT_SKU]}
        right={ownsSupport ? <OwnedChip /> : <BuyBtn sku={SUPPORT_SKU} busy={busy} onBuy={() => void buyNC(SUPPORT_SKU)} />} />

      <Row icon="🏥" title={t('store.heal')} line={t('store.healLine')} msg={msgs[HEAL_SKU]}
        right={<BuyBtn sku={HEAL_SKU} busy={busy} onBuy={() => void buyHeal()} />}>
        {inCareer && game && !healReady(game) && !healPending && (
          <div className="meta muted">{t('store.healWait')}</div>
        )}
        {healPending && (
          <button className="btn ghost block" onClick={() => void applyHealNow()}>{t('till.applyHere')}</button>
        )}
      </Row>

      <Row icon="🌍" title={t('store.pinnacle')} line={t('store.pinnacleLine')} msg={msgs[PINNACLE_SKU]}
        right={ownsPinnacle
          ? (inCareer && game && !game.pinnacleCalled ? undefined : <OwnedChip />)
          : <BuyBtn sku={PINNACLE_SKU} busy={busy} onBuy={() => void buyNC(PINNACLE_SKU, () => {
              if (inCareer && game && !game.pinnacleCalled) say(PINNACLE_SKU, t('store.pickNation'))
            })} />}>
        {/* v1.1.5, the owner's brief: the buyer picks the federation. The
            whole ladder is on offer - the product is the introduction, and
            the choice is the point of it. */}
        {ownsPinnacle && inCareer && game && !game.pinnacleCalled && (
          <div className="btn-row" style={{ alignItems: 'stretch' }}>
            <select value={natPick} onChange={e => setNatPick(e.target.value)} style={{ flex: 1, minWidth: 0 }}>
              {NAT_TIERS.map(([code]) => (
                <option key={code} value={code}>{flagOf(code)} {nationName(code)}</option>
              ))}
            </select>
            <button className="btn gold" style={{ flexShrink: 0 }}
              onClick={() => { say(PINNACLE_SKU, makeTheCall(natPick) ? t('store.callMade', { nat: nationName(natPick) }) : t('store.callRefused')) }}>
              {t('store.makeCall')}
            </button>
          </div>
        )}
      </Row>

      <Row icon="🏗️" title={t('store.estate')} line={t('store.estateLine')} msg={msgs[ESTATE_SKU]}
        right={ownsEstate
          ? (inCareer && game && !game.estateMaxed ? undefined : <OwnedChip />)
          : <BuyBtn sku={ESTATE_SKU} busy={busy} onBuy={() => void buyNC(ESTATE_SKU)} />}>
        {ownsEstate && inCareer && game && !game.estateMaxed && (
          estateArm ? (
            <div className="btn-row">
              <button className="btn ghost" onClick={() => setEstateArm(false)}>{t('till.charterStay')}</button>
              <button className="btn gold" style={{ flex: 1.4 }} onClick={() => {
                setEstateArm(false)
                say(ESTATE_SKU, buildEstate() ? t('store.estateDone') : t('store.estateRefused'))
              }}>{t('store.estateConfirm')}</button>
            </div>
          ) : (
            <button className="btn ghost block" onClick={() => setEstateArm(true)}>{t('store.estateBuild')}</button>
          )
        )}
      </Row>

      <Row icon="🖋" title={t('store.charter')} line={t('store.charterLine')} msg={msgs[CHARTER_SKU]}
        right={ownsCharter ? <OwnedChip /> : <BuyBtn sku={CHARTER_SKU} busy={busy} onBuy={() => void buyNC(CHARTER_SKU)} />}>
        {ownsCharter && inCareer && game && !game.uncapped && (
          <button className="btn ghost block" onClick={() => go('finances')}>{t('store.signInBoardroom')}</button>
        )}
      </Row>

      <Row icon="💰" title={t('store.funding')} line={t('store.fundingLine')}>
        {(Object.keys(INJECT_TIERS) as InjectTier[]).map(tier => {
          const sku = INJECT_SKUS[tier]
          const left = game ? injectionsLeft(game, tier) : INJECT_TIERS[tier].perSeason
          const baseCap = (inCareer && game && game.clubs[game.userClubId]?.leagueId && game.caps?.[game.clubs[game.userClubId].leagueId]) || null
          return (
            <div key={tier} style={{ display: 'flex', flexDirection: 'column', gap: 3, borderTop: '1px solid var(--edge, rgba(128,128,128,.18))', paddingTop: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{t(TIER_KEY[tier])}</div>
                  <div className="meta" style={{ marginTop: 1 }}>
                    {t('till.injAdds', { amount: fmtMoney(INJECT_TIERS[tier].amount) })}
                    {baseCap != null && <> {t('till.injWage', { weekly: fmtWage(Math.round(INJECT_TIERS[tier].wage * baseCap)) })}</>}
                  </div>
                </div>
                {left > 0
                  ? <BuyBtn sku={sku} busy={busy} onBuy={() => void buyInjection(tier)} />
                  : <span className="chip muted" style={{ flexShrink: 0 }}>{t('till.injNone')}</span>}
              </div>
              {pendingInj.includes(tier) && (
                <button className="btn ghost block" disabled={busy} onClick={() => { setBusy(true); void landInjection(tier).finally(() => setBusy(false)) }}>
                  {t('till.applyHere')}
                </button>
              )}
              {msgs[sku] && <div className="meta sheet-log" style={{ borderLeft: '3px solid var(--gold)', paddingLeft: 8 }}>{msgs[sku]}</div>}
            </div>
          )
        })}
      </Row>

      <button className="btn ghost block" style={{ margin: '4px 14px' }} disabled={busy} onClick={() => { void doRestore() }}>
        {t('supporter.restore')}
      </button>
      {msgs.restore && <div className="meta sheet-log" style={{ margin: '0 16px' }}>{msgs.restore}</div>}

      <div className="muted" style={{ padding: '10px 16px', fontSize: 12 }}>{t('store.fineprint')}</div>
      <div className="spacer" />
    </>
  )
}
