import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import { boardObjective, facLevel, fmtMoney, fmtWage, operatingCost, weeklyCentral } from '../../game/model'
import {
  CHARTER_SKU, buyOwnable, hasEntitlement,
  rewardedAvailable, showRewarded, skuPrice, tillOpen,
} from '../../game/monetise'
import { canTownCollection } from '../../game/rewarded'
import { staffWageBill } from '../../game/staff'
import { OBJECTIVE_DEFS } from '../../game/objectives'
import { MARQUEE_SLOTS, capPosition, capWord, rosterGrid, rosterWarnings } from '../../game/cap'
import { SectionTitle } from '../components'
import { t } from '../../game/i18n'
import {
  CLAUSES, SLOTS, clauseActive, commercialWeekly, dealWeekly, endDealEarly, marketRate,
  offersFor, signOffer,
} from '../../game/commercial'
import { RELEASE_STEP, cashReserve, releaseBlock, releaseToBudget } from '../../game/treasury'
import { requestFunds } from '../../game/season'

export default function Finances() {
  // two pages rather than one long scroll
  const [ftab, setFtab] = useState<'money' | 'deals' | 'cap' | 'board'>('money')
  const [dealMsg, setDealMsg] = useState<string | null>(null)
  const [endArm, setEndArm] = useState<string | null>(null)
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const rewardTown = useStore(s => s.rewardTown)
  const [askMsg, setAskMsg] = useState<string | null>(null)
  const [relMsg, setRelMsg] = useState<string | null>(null)
  const club = game.clubs[game.userClubId]
  // The ask itself lives in the engine now (requestFunds, season.ts) where
  // the escalation ledger can see it. The button stays LIVE inside a refusal
  // on purpose: asking again is a real choice with a real price - warning
  // and halved respect, then the sack - and the replies say so before the
  // second tap. It only greys out once this season's ask ended in a yes.
  const fundsDenied = game.boardAsks?.funds != null &&
    Math.floor(game.boardAsks.funds.deniedAt / 100) === game.season
  const asked = game.fundsAskedSeason === game.season && !fundsDenied
  const wages = club.players.reduce((s, id) => s + (game.players[id]?.wage ?? 0), 0)
  const gate = game.fixtures.filter(f => f.played && f.homeId === club.id && f.att)
  const avgAtt = gate.length ? Math.round(gate.reduce((s, f) => s + (f.att ?? 0), 0) / gate.length) : 0
  const topEarners = club.players.map(id => game.players[id]).filter(Boolean)
    .sort((a, b) => b.wage - a.wage).slice(0, 10)

  return (
    <>
      <div className="tab-bar">
        <button className={ftab === 'money' ? 'active' : ''} onClick={() => setFtab('money')}>{t('finances.tabFinances')}</button>
        <button className={ftab === 'deals' ? 'active' : ''} onClick={() => setFtab('deals')}>{t('finances.tabCommercial')}</button>
        <button className={ftab === 'cap' ? 'active' : ''} onClick={() => setFtab('cap')}>{t('finances.tabCapSquad')}</button>
        <button className={ftab === 'board' ? 'active' : ''} onClick={() => setFtab('board')}>{t('finances.tabBoard')}</button>
      </div>
      {/* the ledger and the graph sit side by side in landscape: two chip
          blocks under a full-width chart was a screenful before the table.
          The chips label themselves, so the Matchday heading was only height. */}
      <div className="fin-head">
        <div className="chips">
          <span className="chip">{t('finances.balance')} <b style={{ color: club.balance < 0 ? 'var(--text-negative)' : 'var(--text-positive)' }}>{fmtMoney(club.balance)}</b></span>
          <span className="chip">{t('finances.transferBudget')} <b>{fmtMoney(club.budget)}</b></span>
          <span className="chip">{t('finances.wageBill')} <b>{fmtMoney(wages)}{t('common.perWeek')}</b></span>
          <span className="chip">{t('finances.wageBudget')} <b>{fmtMoney(club.wageBudget)}{t('common.perWeek')}</b></span>
          {ftab === 'money' && <>
            <span className="chip">{club.stadium} <b>{club.capacity.toLocaleString()}</b></span>
            <span className="chip">{t('finances.avgAttendance')} <b>{avgAtt ? avgAtt.toLocaleString() : '-'}</b></span>
            <span className="chip">{t('finances.estGate')} <b>{avgAtt ? fmtMoney(avgAtt * 30) : '-'}</b></span>
            <span className="chip">{t('finances.weeklyCommercial')} <b>{fmtMoney(weeklyCentral(club) + commercialWeekly(game))}</b></span>
            {/* the ground and the estate cost money every week of the year, and
                a cost the manager cannot see reads to him as a bug */}
            <span className="chip">{t('finances.upkeep')} <b>{fmtMoney(operatingCost(game))}{t('common.perWeek')}</b></span>
          </>}
        </div>
        {(game.finHist?.length ?? 0) >= 2 && <div className="fin-chart"><BalanceChart hist={game.finHist!} /></div>}
      </div>
      {ftab === 'money' && <>
      {/* ---- where the money actually goes ----
          The chips above are a set of true numbers that never added up to
          anything (user: "make it more clear what the balance etc is being spent
          on"). Every line below is read from the same functions the weekly
          settlement uses - see weeklyFinance in season.ts - so the bottom line
          here is the number that will hit the balance on Continue, not an
          estimate of it. */}
      <SectionTitle sub={t('finances.weeklyLedgerSub')}>{t('finances.weeklyLedger')}</SectionTitle>
      <div className="card">
        {(() => {
          const staff = staffWageBill(game)
          const upkeep = operatingCost(game)
          const central = weeklyCentral(club)
          const deals = commercialWeekly(game)
          const commercial = central + deals
          const shopLvl = facLevel(game, 'shop')
          const shop = shopLvl > 0 ? Math.round(shopLvl * 9_000 * (0.6 + (game.fanMood ?? 60) / 100)) : 0
          // a home gate arrives every third week or so, so it is shown as one
          // and labelled as one rather than smeared across the average
          const homeGate = avgAtt ? Math.round(avgAtt * 30) : 0
          const net = commercial + shop - wages - staff - upkeep
          const line = (label: string, amount: number, note?: string) => (
            <div className="ledger-row" key={label}>
              <span className="lg-what">{label}{note ? <span className="muted"> {note}</span> : null}</span>
              <span className="lg-amt" style={{ color: amount >= 0 ? 'var(--text-positive)' : 'var(--text-negative)' }}>
                {amount >= 0 ? '+' : '−'}{fmtMoney(Math.abs(amount))}
              </span>
            </div>
          )
          return (
            <>
              {/* F30 split these: the deals are yours to sell, the central money
                  arrives regardless, and showing them as one line again would
                  hide the hole an unsold slot leaves. */}
              {line(t('finances.lgCommercialDeals'), deals, t('finances.lgSlotsSold', { n: SLOTS.filter(x => game.deals?.[x.id]).length }))}
              {line(t('finances.lgBroadcast'), central)}
              {shop > 0 && line(t('finances.lgShop'), shop, t('finances.lgShopLevel', { n: shopLvl }))}
              {line(t('finances.lgWages'), -wages, t('finances.lgMen', { n: club.players.length }))}
              {line(t('finances.lgStaff'), -staff)}
              {line(t('finances.lgUpkeep'), -upkeep)}
              <div className="ledger-row total">
                <span className="lg-what">{t('finances.lgTotal')}</span>
                <span className="lg-amt" style={{ color: net >= 0 ? 'var(--text-positive)' : 'var(--text-negative)' }}>
                  {net >= 0 ? '+' : '−'}{fmtMoney(Math.abs(net))}
                </span>
              </div>
              <div className="meta" style={{ marginTop: 6 }}>
                {homeGate > 0 ? t('finances.gateNote', { amount: fmtMoney(homeGate) }) : t('finances.gateNoteNone')}
                {' '}{t(net >= 0 ? 'finances.paysItsWay' : 'finances.losesMoney')}
              </div>
            </>
          )
        })()}
      </div>
      <SectionTitle>{t('finances.topEarners')}</SectionTitle>
      <div className="tblwrap"><table className="dtable">
        <thead><tr><th>{t('squad.colName')}</th><th className="num">{t('finances.colWage')}</th><th className="num">{t('squad.colUntil')}</th><th className="num">{t('squad.colValue')}</th></tr></thead>
        <tbody>
          {topEarners.map(p => (
            <tr key={p.id}>
              <td className="name">{p.name}</td>
              <td className="num">{fmtWage(p.wage)}</td>
              <td className="num">{2026 + p.contractEnds}</td>
              <td className="num">{fmtMoney(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      {askMsg && <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>{askMsg}</div>}
      {rewardedAvailable('collection') && canTownCollection(game) && (
        <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
          <h3 style={{ fontSize: 14 }}>{t('till.townTitle')}</h3>
          <div className="meta">{t('till.townBody')}</div>
          <button className="btn ghost block" style={{ marginTop: 6 }} onClick={() => {
            void showRewarded('collection').then(out => {
              if (out === 'completed') {
                const amt = rewardTown()
                setAskMsg(amt != null ? t('till.townDone', { amount: fmtMoney(amt) }) : t('till.favourGone'))
              } else setAskMsg(t(out === 'skipped' ? 'till.spotSkipped' : 'till.spotUnavailable'))
            })
          }}>{t('till.watchTown')}</button>
        </div>
      )}
      <button className="btn ghost block" disabled={asked} onClick={() => {
        if (asked) return
        setAskMsg(requestFunds(game))
        touch()
      }}>
        {t(asked ? 'finances.askedThisSeason' : 'finances.askBoard')}
      </button>
      {/* THE TREASURY (user: "should be able to transfer balance into
          transfer money"). The button and the engine read one predicate
          (releaseBlock), so when the move is off the button says why - the
          reason in front of the decision, not a refusal after it. */}
      {(() => {
        const block = releaseBlock(game)
        return (
          <>
            {relMsg && <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>{relMsg}</div>}
            <button className="btn ghost block" disabled={!!block}
              onClick={() => { const r = releaseToBudget(game); setRelMsg(r.msg); touch() }}>
              {t('finances.moveMoney', { amount: fmtMoney(RELEASE_STEP) })}
            </button>
            <div className="meta" style={{ padding: '2px 16px 8px', fontSize: 11.5 }}>
              {block ?? t('finances.reserveNote', { reserve: fmtMoney(cashReserve(game)), step: fmtMoney(RELEASE_STEP) })}
            </div>
          </>
        )
      })()}
      </>}
      {/* ---- the commercial department (F30) ----
          Three things to sell, and what is in each slot right now. The offers
          are deliberately shown with their multiple of market rate on them: the
          judgement is meant to be about YOUR season, not about decoding whether
          a number is good. */}
      {ftab === 'deals' && <>
        <SectionTitle sub={t('finances.commercialSub', { amount: fmtMoney(commercialWeekly(game)), n: SLOTS.filter(x => game.deals?.[x.id]).length })}>
          {t('finances.commercialDept')}
        </SectionTitle>
        {dealMsg && <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}><div className="meta">{dealMsg}</div></div>}
        {/* v1.1.5, "the commercial page is very messy, too much text": the
            slot blurbs and the advice card are gone - the label, the deal and
            the offers say it all. What arrived instead is the early exit: end
            a live deal and three new parties present themselves at once, on
            wider terms than the season's standard three - the gamble is real
            in both directions (offersFor, dealReroll). */}
        {SLOTS.map(slot => {
          const live = game.deals?.[slot.id]
          const inTerm = !!live && live.until >= game.season
          const mkt = marketRate(club.rep, slot.id)
          const ending = endArm === slot.id
          return (
            <div className="card" key={slot.id}>
              <div className="fact-label">{slot.icon} {t(slot.name)}</div>
              {inTerm ? (
                <>
                  <div className="meta" style={{ marginTop: 4 }}>
                    {t('finances.dealLive', { sponsor: live!.sponsor, weekly: fmtMoney(dealWeekly(game, live!)), year: 2026 + live!.until })}
                    {live!.weekly < mkt * 0.92 && <span className="muted"> · {t('finances.underMarket', { rate: fmtMoney(mkt) })}</span>}
                  </div>
                  {live!.clause !== 'none' && (
                    <div className="meta muted">
                      {t(CLAUSES[live!.clause].text)}{' '}
                      <b style={{ color: clauseActive(game, live!.clause) ? 'var(--text-positive)' : undefined }}>
                        {t(clauseActive(game, live!.clause) ? 'finances.payingNow' : 'finances.notPaying')}
                      </b>
                    </div>
                  )}
                  {ending ? (
                    <div className="btn-row" style={{ marginTop: 6 }}>
                      <button className="btn danger" onClick={() => { setEndArm(null); setDealMsg(endDealEarly(game, slot.id)); touch() }}>
                        {t('finances.endConfirm')}
                      </button>
                      <button className="btn ghost" onClick={() => setEndArm(null)}>{t('till.charterStay')}</button>
                    </div>
                  ) : (
                    <button className="btn ghost tiny" style={{ marginTop: 6 }} onClick={() => setEndArm(slot.id)}>
                      {t('finances.endEarly')}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div className="meta" style={{ marginTop: 4 }}>
                    <b>{t('finances.unsold')}</b>{t('finances.unsoldRest', { rate: fmtMoney(mkt) })}
                  </div>
                  {offersFor(game, slot.id).map((o, i) => (
                    <div className="ledger-row" key={i} style={{ alignItems: 'center' }}>
                      <span className="lg-what">
                        <b>{o.sponsor}</b>{' '}
                        <span className="muted">
                          {t('finances.offerMeta', { weekly: fmtMoney(o.weekly), years: o.years === 1 ? t('finances.oneSeason') : t('finances.seasons', { n: o.years }), pct: Math.round(o.vsMarket * 100) })}
                        </span>
                        {o.clause !== 'none' && <div className="meta muted">{t(CLAUSES[o.clause].text)}</div>}
                      </span>
                      <button className="btn gold tiny" onClick={() => { setDealMsg(signOffer(game, o)); touch() }}>{t('finances.sign')}</button>
                    </div>
                  ))}
                </>
              )}
            </div>
          )
        })}
      </>}

      {ftab === 'cap' && (() => {
        const pos = capPosition(game, club.id)
        const grid = rosterGrid(game, club.id)
        const warn = rosterWarnings(game, club.id)
        const marquee = pos.marquee.map(id => game.players[id]).filter(Boolean)
        return (
          <>
            <SectionTitle sub={t('finances.salaryCapSub')}>
              {t('finances.salaryCap')}
            </SectionTitle>
            <div className="card">
              {pos.cap == null ? (
                <div className="meta">{t('finances.noCap')}</div>
              ) : (
                <>
                  <div className="cap-line">
                    <b>{fmtMoney(pos.bill)}/wk</b>
                    <span className="meta">{t('finances.capOf', { cap: fmtMoney(pos.cap) })}</span>
                  </div>
                  <div className="cap-bar">
                    <div className={`cap-fill${pos.over ? ' over' : pos.used > 0.9 ? ' tight' : ''}`}
                      style={{ width: `${Math.min(100, Math.round(pos.used * 100))}%` }} />
                    <div className="cap-mark" />
                  </div>
                  <div className="meta" style={{ marginTop: 6 }}>{capWord(pos)}</div>
                  {pos.embargo > 0 && (
                    <div className="meta" style={{ marginTop: 6, color: 'var(--danger)', fontWeight: 700 }}>
                      {t('finances.embargoLine')}
                    </div>
                  )}
                </>
              )}
            </div>
            <SectionTitle sub={t('finances.marqueeSub', { n: MARQUEE_SLOTS })}>
              {t('finances.marqueePlayers')}
            </SectionTitle>
            <div className="card">
              {marquee.length === 0
                ? <div className="meta">{t('finances.noMarquee')}</div>
                : marquee.map(p => (
                  <div key={p.id} className="ledger-row">
                    <span>{p.name}</span>
                    <span className="num">{fmtWage(p.wage)}</span>
                  </div>
                ))}
            </div>
            <SectionTitle sub={t('finances.squadCoverSub')}>
              {t('finances.squadCover')}
            </SectionTitle>
            <div className="tblwrap fitwrap"><table className="dtable fit">
              <colgroup><col style={{ width: '34%' }} />{grid.seasons.map(sn => <col key={sn} />)}</colgroup>
              {/* two-digit years: four full ones jammed the last column against
                  the screen edge in portrait (user: "squad cover needs to be
                  better fitted") */}
              <thead><tr><th>{t('finances.colUnit')}</th>{grid.seasons.map(sn => <th key={sn} className="num">{`'${String(26 + sn).padStart(2, '0')}`}</th>)}</tr></thead>
              <tbody>
                {grid.rows.map(row => (
                  <tr key={row.label}>
                    <td className="name">{t(row.label)}</td>
                    {row.cells.map((cell, i) => (
                      <td key={i} className="num" style={{
                        fontWeight: cell.count < cell.need ? 700 : 400,
                        color: cell.count < cell.need ? 'var(--danger)' : cell.count === cell.need ? 'var(--gold)' : undefined,
                      }}>{cell.count}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table></div>
            <div className="card">
              {warn.length === 0
                ? <div className="meta">{t('finances.allCovered')}</div>
                : <>
                  <div className="meta" style={{ fontWeight: 700, marginBottom: 4 }}>{t('finances.holesToFill')}</div>
                  {warn.map(w => <div key={w} className="meta">{w}</div>)}
                </>}
            </div>
          </>
        )
      })()}
      {ftab === 'board' && <>
      <SectionTitle>{t('finances.seasonObjectives')}</SectionTitle>
      <div className="card" style={{ marginTop: 6 }}>
        <h3 style={{ fontSize: 15 }}>{t('finances.boardExpects', { objective: t(boardObjective(club.rep).text) })}</h3>
        <div className="meta">{t('finances.fallShort')}</div>
        {(game.objectives ?? []).map(id => {
          const def = OBJECTIVE_DEFS.find(o => o.id === id)
          if (!def || !def.applies(game)) return null
          const ok = def.met(game)
          // banked means it cannot be lost, so a tick is honest. A standing
          // condition only settles in May (see ObjectiveDef.banked and the
          // Bedford report behind it), so it reads as on course until then.
          const done = ok && def.banked
          return (
            <div key={id} style={{ display: 'flex', gap: 8, marginTop: 8, fontSize: 12.5, alignItems: 'flex-start' }}>
              <span>{done ? '✅' : ok ? '🕗' : '⬜'}</span>
              <span style={{ color: done ? 'var(--text-positive)' : 'var(--text-secondary)' }}>
                {t(def.textKey(game))}{ok && !def.banked ? t('finances.onCourseSettled') : ''}
                {' '}<b style={{ color: 'var(--text-muted)' }}>{t('finances.objReward')}</b>
              </span>
            </div>
          )
        })}
      </div>
      <SectionTitle sub={`${Math.round(club.boardConfidence)}%`}>{t('finances.boardConfidence')}</SectionTitle>
      <div style={{ margin: '8px 14px', height: 10, background: 'var(--border-strong)', borderRadius: 5 }}>
        <div style={{
          width: `${club.boardConfidence}%`, height: '100%', borderRadius: 5,
          background: club.boardConfidence > 60 ? 'var(--primary)' : club.boardConfidence > 30 ? 'var(--gold-fill)' : 'var(--danger)',
        }} />
      </div>
      <div className="muted" style={{ padding: '4px 14px 14px' }}>
        {t(club.boardConfidence > 75 ? 'finances.boardDelighted'
          : club.boardConfidence > 50 ? 'finances.boardSatisfied'
          : club.boardConfidence > 30 ? 'finances.boardExpectsBetter'
          : 'finances.boardImpatient')}
      </div>
      <BoardFunds />
      </>}
    </>
  )
}

/**
 * The Boardroom desk (v1.1.0; thinned in v1.1.5). The four board injections
 * sold here until the owner moved all board funding to the Store - what
 * remains is the Charter, because signing it is club business done at the
 * club: bought once for the account (here or at the Store), then signed per
 * save behind a two-step confirm, because there is no way back. Rendered
 * ONLY where a store bridge exists; the web build never mounts a row of
 * this, so the free game reads as complete (storeprobe holds that).
 */
function BoardFunds() {
  const game = useStore(s => s.game)!
  const signCharter = useStore(s => s.signCharter)
  const claim = useStore(s => s.claimSupporter)
  const [prices, setPrices] = useState<Record<string, string | null>>({})
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ key: string; text: string } | null>(null)
  const [confirmCharter, setConfirmCharter] = useState(false)

  const open = tillOpen()
  useEffect(() => {
    if (!open) return
    let live = true
    void (async () => {
      const price = await skuPrice(CHARTER_SKU)
      if (live) setPrices({ [CHARTER_SKU]: price })
    })()
    return () => { live = false }
  }, [open])
  if (!open || game.unemployed) return null

  const sayOutcome = (key: string, out: string) => setMsg({
    key,
    text: t(out === 'cancelled' ? 'supporter.cancelled'
      : out === 'pending' ? 'till.pending'
      : out === 'unavailable' ? 'supporter.unavailable'
      : 'supporter.error'),
  })

  const buyCharter = async () => {
    setBusy(true)
    const out = await buyOwnable(CHARTER_SKU)
    if (out === 'owned') { claim(); setMsg({ key: 'charter', text: t('till.charterOwned') }) }
    else sayOutcome('charter', out)
    setBusy(false)
  }

  return (
    <>
      <SectionTitle sub={t('till.boardSub')}>{t('till.boardTitle')}</SectionTitle>
      <div className="muted" style={{ padding: '0 14px 6px', fontSize: 12.5 }}>{t('till.boardBlurb')}</div>

      {game.uncapped ? (
        <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
          <h3 style={{ fontSize: 15 }}>{t('till.charterTitle')}</h3>
          <div className="meta">{t('till.charterSigned')}</div>
          {/* the signing tap's own answer renders HERE, because the card it
              belonged to just changed into this branch - dropping it is the
              vanishing-reply bug replyreach.mjs polices, met again one screen
              over (storeprobe caught this one) */}
          {msg?.key === 'charter' && (
            <div className="meta sheet-log" style={{ marginTop: 8, borderLeft: '3px solid var(--gold)', paddingLeft: 8 }}>{msg.text}</div>
          )}
        </div>
      ) : (
        <div className="card">
          <h3 style={{ fontSize: 15 }}>{t('till.charterTitle')}</h3>
          <div className="meta">{t('till.charterBody')}</div>
          {hasEntitlement(CHARTER_SKU) ? (
            !confirmCharter ? (
              <button className="btn ghost block" style={{ marginTop: 8 }} disabled={busy}
                onClick={() => setConfirmCharter(true)}>{t('till.charterApply')}</button>
            ) : (
              <div className="btn-row" style={{ marginTop: 8 }}>
                <button className="btn danger" disabled={busy}
                  onClick={() => { setConfirmCharter(false); if (signCharter()) setMsg({ key: 'charter', text: t('till.charterDone') }) }}>
                  {t('till.charterConfirm')}
                </button>
                <button className="btn ghost" onClick={() => setConfirmCharter(false)}>{t('till.charterStay')}</button>
              </div>
            )
          ) : (
            <button className="btn gold block" style={{ marginTop: 8 }} disabled={busy} onClick={() => { void buyCharter() }}>
              {prices[CHARTER_SKU] ? t('till.buyFor', { price: prices[CHARTER_SKU]! }) : t('till.buy')}
            </button>
          )}
          {msg?.key === 'charter' && (
            <div className="meta sheet-log" style={{ marginTop: 8, borderLeft: '3px solid var(--gold)', paddingLeft: 8 }}>{msg.text}</div>
          )}
        </div>
      )}
      <div className="muted" style={{ padding: '4px 16px 10px', fontSize: 12 }}>{t('till.fineprint')}</div>
    </>
  )
}

/** Season balance, week by week. Blue above zero, red below - one glance
 *  tells you which way the club is heading. */
function BalanceChart({ hist }: { hist: { w: number; b: number }[] }) {
  const max = Math.max(...hist.map(h => Math.abs(h.b)), 1)
  const first = hist[0], latest = hist[hist.length - 1]
  const trend = latest.b - first.b
  return (
    <>
      <SectionTitle sub={t('finances.sinceWeek', { delta: `${trend >= 0 ? '+' : '−'}${fmtMoney(Math.abs(trend))}`, week: first.w })}>{t('finances.seasonBalance')}</SectionTitle>
      <div className="card">
        <div style={{ position: 'relative', display: 'flex', gap: 2, height: 72 }}>
          <span style={{ position: 'absolute', left: 0, right: 0, top: 35, height: 1, background: 'var(--border)' }} />
          {hist.map(h => {
            const bar = Math.max(2, Math.round((Math.abs(h.b) / max) * 34))
            return (
              <span key={h.w} title={t('finances.weekBalance', { w: h.w, amount: fmtMoney(h.b) })}
                style={{ flex: 1, minWidth: 2, position: 'relative' }}>
                <i style={{
                  position: 'absolute', left: 0, right: 0,
                  ...(h.b >= 0 ? { bottom: 36, height: bar } : { top: 36, height: bar }),
                  background: h.b >= 0 ? 'var(--surface-3)' : 'var(--danger)',
                  borderRadius: 2.5,
                }} />
              </span>
            )
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span className="meta">{t('finances.wkFrom', { w: first.w, amount: fmtMoney(first.b) })}</span>
          <span className="meta" style={{ fontWeight: 700 }}>{t('finances.nowIs', { amount: fmtMoney(latest.b) })}</span>
        </div>
      </div>
    </>
  )
}
