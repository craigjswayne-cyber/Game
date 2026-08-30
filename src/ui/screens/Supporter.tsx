import { Fragment, useEffect, useState } from 'react'
import { useStore } from '../../store'
import { SectionTitle } from '../components'
import {
  CHARTER_SKU, ESTATE_SKU, GROUND_SKU, HEAL_SKU, INJECT_SKUS, PINNACLE_SKU, SUPPORT_SKU, SUPPORTER_SKU,
  adBridge, buyConsumable, buyOwnable, consume, hasEntitlement, hasSupporter,
  billingReason, pendingConsumables, recordSupport, restore, skuPriceFrom,
  supportCount, tillHealth, tillOpen,
} from '../../game/monetise'
import { INJECT_TIERS, estateBuiltHere, healReady, injectionCash, injectionsLeft, type InjectTier } from '../../game/grants'
import { fmtMoney, fmtWage } from '../../game/model'
import { NAT_TIERS, flagOf, nationName } from '../../game/nations'
import { t } from '../../game/i18n'
import { endingText } from '../purchase'

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

/**
 * The one-tap buy button. IT ONLY NAMES A PRICE THE STORE ITSELF NAMED.
 *
 * v1.1.5 put a price on every button and gave the catalogue's reference prices
 * as a fallback so no row could stand priceless. That fallback then told a lie
 * with real money behind it: the owner's shelf read "Buy - £0.99" and Play
 * charged £1.19, because £0.99 was OUR figure, typed into monetise.ts, and
 * £1.19 was PLAY'S - the same product with UK VAT on top of a tax-exclusive
 * console price. A shelf price that disagrees with the checkout is worse than
 * no shelf price at all, and the owner said as much: "maybe dont show the cost
 * on the store until they click on it".
 *
 * So the button carries a figure only when `live` is true - when Play answered
 * getDetails and that figure IS the one the sheet will charge. Otherwise it
 * says Buy, and Play's own sheet names the price before a penny moves. The
 * reference prices stay in the catalogue, where they are still the right tool
 * for asking whether the till is answering at all (tillHealth).
 */
function BuyBtn({ sku, busy, onBuy }: { sku: string; busy: boolean; onBuy: () => void }) {
  const [price, setPrice] = useState<string | null>(null)
  useEffect(() => { void skuPriceFrom(sku).then(p => setPrice(p.live ? p.price : null)) }, [sku])
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
  // ONE LINE, NOT TWO (owner, v1.1.13: "few error messages showing on shop").
  //
  // This used to print the store's raw failure underneath - "getDetails threw
  // OperationError: clientAppUnavailable - the billing service is attached but
  // not answering". That sentence solved a day-long billing fault and it is
  // still worth having, but a shopper who came to buy a 99p thank-you should
  // not meet two stacked paragraphs of apology on the way. It rides in the bug
  // report now (bugreport.ts), which is where a diagnostic belongs, and the
  // shelf keeps the one sentence that tells a customer what he can do.
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
  const { healSquad, buildEstate, makeTheCall, signCharter } = useStore.getState()
  const boardInject = useStore(s => s.boardInject)
  useStore(s => s.tick)
  const [busy, setBusy] = useState(false)
  const [msgs, setMsgs] = useState<Record<string, string | null>>({})
  const [healPending, setHealPending] = useState(false)
  const [estateArm, setEstateArm] = useState(false)
  const [charterArm, setCharterArm] = useState(false)
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
    else say(sku, endingText(out))
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
    else say(HEAL_SKU, endingText(out))
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
  /** THE TIP JAR. A consumable that grants nothing: buy it, spend the receipt
   *  at once so Play will sell it again, and say thank you by name. Nothing
   *  here can fail in a way that costs the player anything - a consume that
   *  does not land just leaves the receipt owned, and the next tap consumes
   *  it. */
  const buySupport = async () => {
    setBusy(true)
    const out = await buyConsumable(SUPPORT_SKU)
    if (out === 'owned') {
      await consume(SUPPORT_SKU)
      say(SUPPORT_SKU, t('store.supportDone', { n: recordSupport() }))
    } else say(SUPPORT_SKU, endingText(out))
    setBusy(false)
  }

  /* THE ESTATE AT A SECOND GROUND. Play sells a non-consumable exactly once,
     so the repeat is its own consumable product - bought, spent, and the
     buildings go up straight away at the club being managed today. Nothing is
     cached in rm-ent: the receipt is the ground, and estateClubs remembers it. */
  const buyGround = async () => {
    if (!inCareer) { say(ESTATE_SKU, t('store.needCareer')); return }
    setBusy(true)
    const out = await buyConsumable(GROUND_SKU)
    if (out === 'owned') {
      const built = buildEstate()
      if (built) await consume(GROUND_SKU)
      say(ESTATE_SKU, built ? t('store.estateDone') : t('store.estateRefused'))
    } else say(ESTATE_SKU, endingText(out))
    setBusy(false)
  }

  const buyInjection = async (tier: InjectTier) => {
    if (!inCareer) { say(INJECT_SKUS[tier], t('store.needCareer')); return }
    setBusy(true)
    const out = await buyConsumable(INJECT_SKUS[tier])
    if (out === 'owned') await landInjection(tier)
    else say(INJECT_SKUS[tier], endingText(out))
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
  // v1.1.12: the jar takes as many coins as anyone wants to put in it, so
  // there is no "owned" state to show - only how many times it has been done
  const tips = supportCount()
  const ownsPinnacle = hasEntitlement(PINNACLE_SKU)
  const ownsEstate = hasEntitlement(ESTATE_SKU)
  const ownsCharter = hasEntitlement(CHARTER_SKU)
  /** Is there a federation door to walk through right now? Owning the product
   *  is not enough and having used it is no bar: what shuts it is a national
   *  job already in hand, or an offer still standing. */
  const canCall = inCareer && !!game && !game.natTeam && !game.natOffer

  /**
   * THE SHELF SORTS ITSELF (owner, v1.1.13: "when you purchase anything in the
   * store it should move to the bottom of the store so the available products
   * are at the top").
   *
   * Three owned rows had collected at the top - the International Stage, the
   * Estate and the Charter - pushing Board funding, the one thing still
   * buyable, below the fold on a phone. A shelf that leads with what you
   * cannot buy is a shelf nobody scrolls.
   *
   * `done` is deliberately NOT "owned": it means there is nothing left to do
   * with this row right now. A Charter you own but have not applied to this
   * career still has a button on it, so it stays up top; a tip jar is never
   * done because it takes another coin whenever you like. The order inside
   * each group is unchanged, so a shelf nobody has bought from looks exactly
   * as it always did.
   */
  const shelf: { key: string; done: boolean; node: React.ReactNode }[] = []
  const row = (key: string, done: boolean, node: React.ReactNode) => shelf.push({ key, done, node })

  if (adsExist || ownsAds) {
    row('ads', ownsAds,
      <Row icon="🚫" title={t('store.removeAds')} line={t('store.removeAdsLine')} msg={msgs[SUPPORTER_SKU]}
        right={ownsAds ? <OwnedChip /> : <BuyBtn sku={SUPPORTER_SKU} busy={busy} onBuy={() => void buyNC(SUPPORTER_SKU)} />} />)
  }

  // the jar is never done: it takes another coin whenever anybody wants to
  row('support', false,
      <Row icon="💛" title={t('store.support')} line={t('store.supportLine')} msg={msgs[SUPPORT_SKU]}
        right={<BuyBtn sku={SUPPORT_SKU} busy={busy} onBuy={() => void buySupport()} />}>
        {tips > 0 && <div className="meta muted">{t('store.supportThanks', { n: tips })}</div>}
      </Row>)

  // a heal is bought per match played, so the row always has a next time
  row('heal', false,
      <Row icon="🏥" title={t('store.heal')} line={t('store.healLine')} msg={msgs[HEAL_SKU]}
        right={<BuyBtn sku={HEAL_SKU} busy={busy} onBuy={() => void buyHeal()} />}>
        {inCareer && game && !healReady(game) && !healPending && (
          <div className="meta muted">{t('store.healWait')}</div>
        )}
        {healPending && (
          <button className="btn ghost block" onClick={() => void applyHealNow()}>{t('till.applyHere')}</button>
        )}
      </Row>)

  // THE DOOR IS CLOSED BY HOLDING THE JOB, NOT BY HAVING HELD IT (owner,
  // v1.1.13: "if you buy the international option, take a job and step down
  // then you should then still have the pick a nation and take offer available
  // to you if you want to").
  //
  // The picker used to disappear the moment the call was made, for ever - a
  // leftover from when this product placed a one-time OFFER rather than an
  // appointment. A coach who resigns has not used up a job he paid for, so the
  // row shows the picker again whenever no national post is in hand, and only
  // counts as done when there is no door to walk through.
  row('pinnacle', ownsPinnacle && !canCall,
      <Row icon="🌍" title={t('store.pinnacle')} line={t('store.pinnacleLine')} msg={msgs[PINNACLE_SKU]}
        right={ownsPinnacle
          ? (canCall ? undefined : <OwnedChip />)
          : <BuyBtn sku={PINNACLE_SKU} busy={busy} onBuy={() => void buyNC(PINNACLE_SKU, () => {
              if (canCall) say(PINNACLE_SKU, t('store.pickNation'))
            })} />}>
        {/* v1.1.5, the owner's brief: the buyer picks the federation. The
            whole ladder is on offer - the product is the introduction, and
            the choice is the point of it. */}
        {ownsPinnacle && canCall && (
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
      </Row>)

  /* ONE ESTATE PER GROUND (v1.1.14). The row used to read one save-wide flag,
     so the first build anywhere greyed the product out for the rest of the
     career - the owner resigned, took a job at a club with poor facilities and
     had no way to use or re-buy the thing he had paid for.
     Three states now:
       nothing owned            buy the Estate
       owned, no ground built   build it here, free - this IS that purchase
       owned, a ground built    buy the repeat (GROUND_SKU) for this ground
     and if the estate already stands at THIS club, the row is done and sinks
     to the foot of the shelf like every other finished product. */
  const builtHere = inCareer && !!game && estateBuiltHere(game)
  const groundsBuilt = (game?.estateClubs ?? []).length
  const canBuildFree = ownsEstate && inCareer && !!game && !builtHere && groundsBuilt === 0
  const needsRepeat = ownsEstate && inCareer && !!game && !builtHere && groundsBuilt > 0
  row('estate', ownsEstate && !canBuildFree && !needsRepeat,
      <Row icon="🏗️" title={t('store.estate')} line={t('store.estateLine')} msg={msgs[ESTATE_SKU]}
        right={!ownsEstate
          ? <BuyBtn sku={ESTATE_SKU} busy={busy} onBuy={() => void buyNC(ESTATE_SKU)} />
          : needsRepeat
            ? <BuyBtn sku={GROUND_SKU} busy={busy} onBuy={() => void buyGround()} />
            : canBuildFree ? undefined : <OwnedChip />}>
        {needsRepeat && <div className="meta muted">{t('store.estateAgain')}</div>}
        {canBuildFree && (
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
      </Row>)

  // owned AND already applied to this career - an unapplied one still has a button
  row('charter', ownsCharter && !(inCareer && !!game && !game.uncapped),
      <Row icon="🖋" title={t('store.charter')} line={t('store.charterLine')} msg={msgs[CHARTER_SKU]}
        right={ownsCharter ? <OwnedChip /> : <BuyBtn sku={CHARTER_SKU} busy={busy} onBuy={() => void buyNC(CHARTER_SKU)} />}>
        {/* ALREADY PAID FOR MEANS ACTIVATE, NOT PAY AGAIN (owner, v1.1.13: "if
            they've paid for it previously and started a new game it should be
            an activate option. but not pay again").
            The entitlement is for ever and the LAW is per save, so a new career
            starts capped with the receipt still in hand. That was already true
            - and the only thing on the row was a link to go and find the
            boardroom, which reads like being sent away rather than being given
            what you own. It signs here, behind the same two-tap confirmation
            the Boardroom uses, because it cannot be undone. */}
        {ownsCharter && inCareer && game && !game.uncapped && (
          charterArm ? (
            <div className="btn-row">
              <button className="btn ghost" onClick={() => setCharterArm(false)}>{t('till.charterStay')}</button>
              <button className="btn gold" style={{ flex: 1.4 }} onClick={() => {
                setCharterArm(false)
                say(CHARTER_SKU, signCharter() ? t('till.charterDone') : t('store.charterRefused'))
              }}>{t('store.charterConfirm')}</button>
            </div>
          ) : (
            <button className="btn ghost block" onClick={() => setCharterArm(true)}>{t('store.charterActivate')}</button>
          )
        )}
      </Row>)

  // spent for the season across every tier - the well refills at the rollover
  row('funding', !!game && (Object.keys(INJECT_TIERS) as InjectTier[]).every(tr => injectionsLeft(game, tr) <= 0),
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
                {left > 0 && <BuyBtn sku={sku} busy={busy} onBuy={() => void buyInjection(tier)} />}
              </div>
              {/* SOLD OUT IS A LINE, NOT A CHIP.
                  A fifty-one character sentence in a `flexShrink: 0` chip
                  cannot shrink, so the flex row gave it everything and squeezed
                  the title column to nothing: "The Sugar Daddy" came out one
                  word per line down the left of the card with the sentence
                  floating over it. This is what the owner reported as "sugar
                  daddy money formatting goes weird after purchasing" - the
                  money was never wrong, the row was. It only ever showed after
                  a purchase, which is exactly why it read as a consequence of
                  buying. */}
              {left <= 0 && <div className="meta muted">{t('till.injNone')}</div>}
              {pendingInj.includes(tier) && (
                <button className="btn ghost block" disabled={busy} onClick={() => { setBusy(true); void landInjection(tier).finally(() => setBusy(false)) }}>
                  {t('till.applyHere')}
                </button>
              )}
              {msgs[sku] && <div className="meta sheet-log" style={{ borderLeft: '3px solid var(--gold)', paddingLeft: 8 }}>{msgs[sku]}</div>}
            </div>
          )
        })}
      </Row>)

  return (
    <>
      <SectionTitle sub={t('store.sub')}>{t('store.title')}</SectionTitle>
      <TillHealth />

      {/* a stable sort: what is still buyable first, each group in the order it
          was declared, so nothing jumps about except across the one boundary */}
      {[...shelf.filter(r => !r.done), ...shelf.filter(r => r.done)]
        .map(r => <Fragment key={r.key}>{r.node}</Fragment>)}

      <button className="btn ghost block" style={{ margin: '4px 14px' }} disabled={busy} onClick={() => { void doRestore() }}>
        {t('supporter.restore')}
      </button>
      {msgs.restore && <div className="meta sheet-log" style={{ margin: '0 16px' }}>{msgs.restore}</div>}

      <div className="muted" style={{ padding: '10px 16px', fontSize: 12 }}>{t('store.fineprint')}</div>
      <div className="spacer" />
    </>
  )
}
