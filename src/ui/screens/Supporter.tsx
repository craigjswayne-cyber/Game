import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import { SectionTitle } from '../components'
import {
  CHARTER_SKU, ESTATE_SKU, HEAL_SKU, LICENSE_SKU, PINNACLE_SKU, SUPPORTER_SKU,
  adBridge, buyConsumable, buyOwnable, consume, hasEntitlement, hasSupporter,
  pendingConsumables, restore, skuPrice, tillOpen,
} from '../../game/monetise'
import { HEALS_PER_SEASON, healsLeft } from '../../game/grants'
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
 *  - Board funding is a signpost, not a till: the injections are club
 *    business, priced on this season's books, and they live in the
 *    Boardroom where the books are.
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

const OwnedChip = () => (
  <span className="chip" style={{ flexShrink: 0, color: 'var(--gold)', fontWeight: 700 }}>✓ {t('store.owned')}</span>
)

export default function Supporter() {
  const game = useStore(s => s.game)
  const go = useStore(s => s.go)
  const claim = useStore(s => s.claimSupporter)
  const { healSquad, buildEstate, makeTheCall } = useStore.getState()
  useStore(s => s.tick)
  const [busy, setBusy] = useState(false)
  const [msgs, setMsgs] = useState<Record<string, string | null>>({})
  const [healPending, setHealPending] = useState(false)
  const [estateArm, setEstateArm] = useState(false)
  const say = (sku: string, text: string | null) => setMsgs(m => ({ ...m, [sku]: text }))

  // a heal paid for and not yet applied (a crash, a full-strength squad, a
  // spent seasonal limit) is surfaced here until it lands - same recovery
  // promise the Boardroom makes for injections
  useEffect(() => {
    void pendingConsumables().then(skus => setHealPending(skus.includes(HEAL_SKU)))
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
      say(HEAL_SKU, t('store.healHeld', { n: HEALS_PER_SEASON }))
    }
  }
  const buyHeal = async () => {
    setBusy(true)
    const out = await buyConsumable(HEAL_SKU)
    setBusy(false)
    if (out === 'owned') await applyHealNow()
    else say(HEAL_SKU, t(endingKey(out)))
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
  const ownsLicense = hasEntitlement(LICENSE_SKU)
  const ownsPinnacle = hasEntitlement(PINNACLE_SKU)
  const ownsEstate = hasEntitlement(ESTATE_SKU)
  const ownsCharter = hasEntitlement(CHARTER_SKU)

  return (
    <>
      <SectionTitle sub={t('store.sub')}>{t('store.title')}</SectionTitle>

      {(adsExist || ownsAds) && (
        <Row icon="🚫" title={t('store.removeAds')} line={t('store.removeAdsLine')} msg={msgs[SUPPORTER_SKU]}
          right={ownsAds ? <OwnedChip /> : <BuyBtn sku={SUPPORTER_SKU} busy={busy} onBuy={() => void buyNC(SUPPORTER_SKU)} />} />
      )}

      <Row icon="🎓" title={t('store.license')} line={t('store.licenseLine')} msg={msgs[LICENSE_SKU]}
        right={ownsLicense ? <OwnedChip /> : <BuyBtn sku={LICENSE_SKU} busy={busy} onBuy={() => void buyNC(LICENSE_SKU)} />} />

      <Row icon="🏥" title={t('store.heal')} line={t('store.healLine', { n: HEALS_PER_SEASON })} msg={msgs[HEAL_SKU]}
        right={<BuyBtn sku={HEAL_SKU} busy={busy} onBuy={() => void buyHeal()} />}>
        {inCareer && game && healsLeft(game) <= 0 && !healPending && (
          <div className="meta muted">{t('store.healSpent')}</div>
        )}
        {healPending && (
          <button className="btn ghost block" onClick={() => void applyHealNow()}>{t('till.applyHere')}</button>
        )}
      </Row>

      <Row icon="🌍" title={t('store.pinnacle')} line={t('store.pinnacleLine')} msg={msgs[PINNACLE_SKU]}
        right={ownsPinnacle
          ? (inCareer && game && !game.pinnacleCalled
            ? <button className="btn gold" style={{ flexShrink: 0 }} onClick={() => { say(PINNACLE_SKU, makeTheCall() ? t('store.callMade') : t('store.callRefused')) }}>{t('store.makeCall')}</button>
            : <OwnedChip />)
          : <BuyBtn sku={PINNACLE_SKU} busy={busy} onBuy={() => void buyNC(PINNACLE_SKU, () => {
              // the owner's brief is "an offer follows soon after purchase":
              // in a live career the call goes out with the receipt
              if (inCareer && game && !game.pinnacleCalled && makeTheCall()) say(PINNACLE_SKU, t('store.callMade'))
            })} />} />

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

      <Row icon="💰" title={t('store.funding')} line={t('store.fundingLine')}
        right={<button className="btn ghost" style={{ flexShrink: 0 }} onClick={() => go('finances')}>{t('store.openBoardroom')}</button>} />

      <button className="btn ghost block" style={{ margin: '4px 14px' }} disabled={busy} onClick={() => { void doRestore() }}>
        {t('supporter.restore')}
      </button>
      {msgs.restore && <div className="meta sheet-log" style={{ margin: '0 16px' }}>{msgs.restore}</div>}

      <div className="muted" style={{ padding: '10px 16px', fontSize: 12 }}>{t('store.fineprint')}</div>
      <div className="spacer" />
    </>
  )
}
