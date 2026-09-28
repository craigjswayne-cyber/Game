import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import { absWeek, boardObjective, facLevel, fmtMoney, fmtWage, operatingCost, pressAnswer, pressLabel, pressQuestion, pressReaction, SEASON_WEEKS, weeklyCentral } from '../../game/model'
import {
  CHARTER_SKU, buyOwnable, hasEntitlement,
  billingReason, rewardedAvailable, tillOpen,
} from '../../game/monetise'
import { canTownCollection } from '../../game/rewarded'
import { staffWageBill } from '../../game/staff'
import { OBJECTIVE_DEFS, objectiveBonus } from '../../game/objectives'
import { MARQUEE_SLOTS, capPosition, capWord, rosterGrid, rosterWarnings } from '../../game/cap'
import { SectionTitle, RewardedButton } from '../components'
import { IcoClock, IcoOpen, IcoTick } from '../icons'
import { t } from '../../game/i18n'
import { bookEvent, bookedThisWeek, eventFee, eventSlate, isCloseSeason } from '../../game/closeseason'
import {
  CLAUSES, SLOTS, clauseActive, commercialWeekly, dealWeekly, endDealEarly, marketRate,
  offersFor,
} from '../../game/commercial'
import {
  MAX_MOVES, STRUCTURES, acceptTalk, breakOff, leverage, moodOf, openTalk, perfTerms, pushTalk,
  restructure, slotOpen, talksOf, walkChance, type Structure,
} from '../../game/sponsortalks'
import { sheetOf } from '../../game/books'
import { RELEASE_STEP, belowReserve, cashReserve, releasable, releaseBlock, releaseToBudget } from '../../game/treasury'
import { requestFunds } from '../../game/season'
import { PRESS_KEEP_WEEKS, isBoardroom } from '../../game/media'
import { INJECT_TIERS, injectionsLeft, userWageBudget, type InjectTier } from '../../game/grants'

export default function Finances() {
  // two pages rather than one long scroll
  // a decision waiting for the board opens the page on it
  const [ftab, setFtab] = useState<'money' | 'deals' | 'cap' | 'board'>(
    () => useStore.getState().game?.press.some(p => !p.answered && isBoardroom(p)) ? 'board' : 'money')
  const [dealMsg, setDealMsg] = useState<string | null>(null)
  const [endArm, setEndArm] = useState<string | null>(null)
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const go = useStore(s => s.go)
  /** the reply to the last thing booked into the summer diary */
  const [diaryMsg, setDiaryMsg] = useState<string | null>(null)
  const rewardTown = useStore(s => s.rewardTown)
  const [askMsg, setAskMsg] = useState<string | null>(null)
  // five earners by default: ten rows was a screenful on a phone (scrollaudit)
  const [allEarners, setAllEarners] = useState(false)
  // the ledger opens on its bottom line; the six lines behind it are a tap away
  const [ledgerOpen, setLedgerOpen] = useState(false)
  // the balance sheet shows this season's books, or last season's closed ones
  const [sheetWhich, setSheetWhich] = useState<'now' | 'prev'>('now')
  const [relMsg, setRelMsg] = useState<string | null>(null)
  /** where the treasury slider is sitting; 0 means "not touched yet", which
   *  falls back to one step so the control is useful before it is dragged */
  const [relAmt, setRelAmt] = useState(0)
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
  const topEarners = club.players.map(id => game.players[id]).filter(Boolean)
    .sort((a, b) => b.wage - a.wage).slice(0, 10)

  return (
    <>
      {/* ---- THE SUMMER DIARY ----
          Owner, 7 Sep: "in the extra weeks, club can put on events... it
          shouldnt be completely impossible for them to make some money."
          It only exists in the weeks with no rugby in them, and it is the only
          money that moves in those weeks - so it sits above the ledger rather
          than buried in a tab, because for three weeks a year it IS the ledger. */}
      {isCloseSeason(game.week) && (() => {
        const booked = bookedThisWeek(game)
        return (
          <>
            <SectionTitle sub={t('close.slateSub')}>{t('close.title')}</SectionTitle>
            {booked ? (
              <div className="card"><div className="meta" style={{ padding: 10 }}>
                {t('close.alreadyBooked')} ({t(`close.${booked}`)})
              </div></div>
            ) : (
              /* THREE, DRAWN FROM WHAT THE GROUND CAN HOLD (owner, 1.5.8:
                 "three options, an explainer each"). All seven were listed
                 every week with the unavailable ones greyed out, which is a
                 price list rather than a decision - and the greyed rows were
                 an advert for an upgrade the Infrastructure page already
                 sells properly. eventSlate picks the week's three and holds
                 them steady, so the diary does not reshuffle under a thumb. */
              <div className="tblwrap"><table className="dtable"><tbody>
                {eventSlate(game).map(ev => (
                  <tr key={ev.id}>
                    <td className="name">
                      {t(`close.${ev.id}`)}
                      <div className="muted" style={{ fontSize: 11 }}>{t(`close.${ev.id}D`)}</div>
                      {/* the risk is named but never priced: which events can
                          bite is knowledge worth having, and whether THIS one
                          will is the part you are being asked to gamble on */}
                      {ev.mishap > 0 && (
                        <div className="muted" style={{ fontSize: 11, color: 'var(--text-negative)' }}>{t('close.risk')}</div>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn ghost" style={{ fontSize: 12, padding: '12px 14px', minHeight: 44 }}
                        onClick={() => { setDiaryMsg(bookEvent(game, ev.id)); touch() }}>
                        {t('close.fee', { fee: fmtMoney(eventFee(game, ev)) })}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody></table></div>
            )}
            {diaryMsg && <div className="card"><div className="meta" style={{ padding: 10 }}>{diaryMsg}</div></div>}
          </>
        )
      })()}
      <div className="tab-bar">
        <button className={ftab === 'money' ? 'active' : ''} onClick={() => setFtab('money')}>{t('finances.tabFinances')}</button>
        <button className={ftab === 'deals' ? 'active' : ''} onClick={() => setFtab('deals')}>{t('finances.tabCommercial')}</button>
        <button className={ftab === 'cap' ? 'active' : ''} onClick={() => setFtab('cap')}>{t('finances.tabCapSquad')}</button>
        <button className={ftab === 'board' ? 'active' : ''} onClick={() => setFtab('board')}>{t('finances.tabBoard')}</button>
      </div>
      {/* The other tabs keep a one-line summary of the money; the Finances tab
          carries the full sheet below instead, so it does not say it twice. */}
      {ftab !== 'money' && (
        <div className="chips">
          <span className="chip">{t('finances.cashInBank')} <b style={{ color: club.balance < 0 ? 'var(--text-negative)' : undefined }}>{fmtMoney(club.balance)}</b></span>
          <span className="chip">{t('finances.transferLeft')} <b>{fmtMoney(club.budget)}</b></span>
          <span className="chip">{t('finances.wageBill')} <b>{fmtWage(wages)}{t('common.perWeek')}</b></span>
        </div>
      )}
      {ftab === 'money' && <>
      {/* ---- THE BALANCE SHEET (1.8.0) ----
          Owner: "Can we make the financial page more clear and like a balance
          sheet. Balance in big at top, transfer money, wage bill with a + or
          negative if over spending in red. Needs to be more a list. Attendance
          isn't needed in this." The balance is the cash in the bank; then the
          budgets as a list of label and amount; then the season's money in and
          out, read from the books the engine keeps as it moves it (books.ts),
          so the bottom line is the bank and never an estimate of it. The
          actions that lived on this page sit under the sheet. */}
      {/* two columns in landscape (scrollaudit: one column of sheet, ledger,
          chart, treasury and earners measured 4.15 screenfuls at 844x390);
          display:contents in portrait, where it is one list top to bottom */}
      <div className="fin-cols"><div className="fin-col">
      <div className="card bs-cash">
        <div className="fact-label">{t('finances.cashInBank')}</div>
        <div className={`bs-cash-amt${club.balance < 0 ? ' neg' : ''}`}>{fmtMoney(club.balance)}</div>
      </div>
      {(() => {
        const wb = userWageBudget(game, club)
        const cap = capPosition(game, club.id)
        const signed = (v: number, fmt: (x: number) => string, suffix = '') => (
          <span className={`lg-amt ${v < 0 ? 'bs-neg' : 'bs-pos'}`}>{v < 0 ? '−' : '+'}{fmt(Math.abs(v))}{suffix}</span>
        )
        return (
          <div className="card bs">
            <div className="ledger-row">
              <span className="lg-what">{t('finances.transferLeft')}</span>
              <span className="lg-amt">{fmtMoney(club.budget)}</span>
            </div>
            <div className="ledger-row">
              <span className="lg-what">{t('finances.wageBill')}</span>
              <span className="lg-amt">{fmtWage(wages)}{t('common.perWeek')}</span>
            </div>
            <div className="ledger-row">
              <span className="lg-what">{t('finances.wageBudget')}</span>
              <span className="lg-amt">{Number.isFinite(wb) ? `${fmtWage(wb)}${t('common.perWeek')}` : t('finances.noLimit')}</span>
            </div>
            {Number.isFinite(wb) && (
              <div className="ledger-row bs-strong">
                <span className="lg-what">{t('finances.wageHeadroom')}</span>
                {signed(wb - wages, fmtWage, t('common.perWeek'))}
              </div>
            )}
            {cap.cap != null && <>
              <div className="ledger-row">
                <span className="lg-what">{t('finances.salaryCapRow')}</span>
                <span className="lg-amt">{fmtWage(cap.cap)}{t('common.perWeek')}</span>
              </div>
              <div className="ledger-row bs-strong">
                <span className="lg-what">{t('finances.capHeadroom')}</span>
                {signed(cap.headroom, fmtWage, t('common.perWeek'))}
              </div>
            </>}
          </div>
        )
      })()}
      {(() => {
        const which = sheetWhich === 'prev' && game.booksPrev ? 'prev' : 'now'
        const sh = sheetOf(game, which)
        if (!sh) return null
        const net = sh.totalIn - sh.totalOut
        const LABEL: Record<string, string> = {
          deals: 'finances.bkDeals', bonus: 'finances.bkBonus', central: 'finances.lgBroadcast',
          gate: 'finances.bkGate', shop: 'finances.lgShop', sales: 'finances.bkSales', prize: 'finances.bkPrize',
          wages: 'finances.lgWages', staff: 'finances.lgStaff', upkeep: 'finances.lgUpkeep',
          works: 'finances.bkWorks', buys: 'finances.bkBuys', other: 'finances.bkOther',
        }
        // a line that has not moved this season is left off: a sheet of
        // zeroes in August is a list of things that have not happened
        const rows = (xs: { line: string; amount: number }[]) => xs.filter(x => x.amount !== 0).map(x => (
          <div className="ledger-row" key={x.line}>
            <span className="lg-what">{t(LABEL[x.line])}</span>
            <span className="lg-amt">{fmtMoney(x.amount)}</span>
          </div>
        ))
        const hasOther = [...sh.income, ...sh.spend].some(x => x.line === 'other' && x.amount !== 0)
        return (
          <>
            <SectionTitle sub={sh.fromWeek > 1 ? t('finances.sheetFrom', { w: sh.fromWeek }) : undefined}
              right={game.booksPrev ? (
                <span className="bs-seg" role="group">
                  <button className={which === 'now' ? 'on' : ''} aria-pressed={which === 'now'} onClick={() => setSheetWhich('now')}>{t('finances.sheetThis')}</button>
                  <button className={which === 'prev' ? 'on' : ''} aria-pressed={which === 'prev'} onClick={() => setSheetWhich('prev')}>{t('finances.sheetPrev')}</button>
                </span>
              ) : undefined}>
              {t(which === 'prev' ? 'finances.sheetPrev' : 'finances.sheetThis')}
            </SectionTitle>
            <div className="card bs">
              <div className="ledger-row">
                <span className="lg-what">{t('finances.openingBal')}</span>
                <span className="lg-amt">{fmtMoney(sh.opening)}</span>
              </div>
              <div className="bs-head">{t('finances.income')}</div>
              {rows(sh.income)}
              <div className="ledger-row bs-sub">
                <span className="lg-what">{t('finances.totalIncome')}</span>
                <span className="lg-amt">{fmtMoney(sh.totalIn)}</span>
              </div>
              <div className="bs-head">{t('finances.spending')}</div>
              {rows(sh.spend)}
              <div className="ledger-row bs-sub">
                <span className="lg-what">{t('finances.totalSpending')}</span>
                <span className="lg-amt">{fmtMoney(sh.totalOut)}</span>
              </div>
              <div className="ledger-row bs-strong bs-net">
                <span className="lg-what">{t('finances.netSeason')}</span>
                <span className={`lg-amt ${net < 0 ? 'bs-neg' : 'bs-pos'}`}>{net < 0 ? '−' : '+'}{fmtMoney(Math.abs(net))}</span>
              </div>
              <div className="ledger-row bs-close">
                <span className="lg-what">{t('finances.cashInBank')}</span>
                <span className={`lg-amt${sh.closing < 0 ? ' bs-neg' : ''}`}>{fmtMoney(sh.closing)}</span>
              </div>
              {hasOther && <div className="meta bs-note">{t('finances.sheetOtherNote')}</div>}
            </div>
          </>
        )
      })()}
      </div><div className="fin-col">
      {/* ---- the week ahead ----
          Every line below is read from the same functions the weekly
          settlement uses - see weeklyFinance in season.ts - so the bottom line
          here is the number that will hit the balance on Continue, not an
          estimate of it. */}
      <SectionTitle sub={t('finances.weeklyLedgerSub')}>{t('finances.weeklyLedger')}</SectionTitle>
      <div className="card bs">
        {(() => {
          const staff = staffWageBill(game)
          const upkeep = operatingCost(game)
          const central = weeklyCentral(club)
          const deals = commercialWeekly(game)
          const shopLvl = facLevel(game, 'shop')
          const shop = shopLvl > 0 ? Math.round(shopLvl * 9_000 * (0.6 + (game.fanMood ?? 60) / 100)) : 0
          const net = central + deals + shop - wages - staff - upkeep
          const line = (label: string, amount: number, note?: string) => (
            <div className="ledger-row" key={label}>
              <span className="lg-what">{label}{note ? <span className="muted"> {note}</span> : null}</span>
              <span className="lg-amt">{amount < 0 ? '−' : ''}{fmtMoney(Math.abs(amount))}</span>
            </div>
          )
          return (
            <>
              {ledgerOpen && <>
                {line(t('finances.lgCommercialDeals'), deals, t('finances.lgSlotsSold', { n: SLOTS.filter(x => { const d = game.deals?.[x.id]; return !!d && d.until >= game.season }).length }))}
                {line(t('finances.lgBroadcast'), central)}
                {shop > 0 && line(t('finances.lgShop'), shop, t('finances.lgShopLevel', { n: shopLvl }))}
                {line(t('finances.lgWages'), -wages, t('finances.lgMen', { n: club.players.length }))}
                {line(t('finances.lgStaff'), -staff)}
                {line(t('finances.lgUpkeep'), -upkeep)}
              </>}
              <div className="ledger-row bs-strong">
                <span className="lg-what">{t('finances.lgTotal')}</span>
                <span className={`lg-amt ${net < 0 ? 'bs-neg' : 'bs-pos'}`}>{net < 0 ? '−' : '+'}{fmtMoney(Math.abs(net))}</span>
              </div>
              <div className="meta" style={{ marginTop: 6 }}>{t(net >= 0 ? 'finances.paysItsWay' : 'finances.losesMoney')}</div>
              {/* a full-width row, not an inline chip: the tap floor is 44px (tapsize, geosweep) */}
              <button className="btn ghost block" style={{ marginTop: 6 }} onClick={() => setLedgerOpen(v => !v)}>
                {t(ledgerOpen ? 'finances.hideLedgerLines' : 'finances.showLedgerLines')}
              </button>
            </>
          )
        })()}
      </div>
      {(game.finHist?.length ?? 0) >= 2 && <BalanceChart hist={game.finHist!} />}
      {/* THE TREASURY (user: "should be able to transfer balance into
          transfer money"). The button and the engine read one predicate
          (releaseBlock), so when the move is off the button says why - the
          reason in front of the decision, not a refusal after it. */}
      {(() => {
        // A SLIDING BAR, NOT A BUTTON YOU PRESS EIGHT TIMES (owner, v1.1.12:
        // "board finances - it should be a sliding bar for money in the
        // club/transfer money"). Moving £4m used to be eight taps of a fixed
        // £500k button, and the reserve - the thing that actually governs how
        // much you have - was a sentence underneath rather than a stop on the
        // control. The bar's right-hand end IS the reserve: it is drawn now
        // instead of explained, and at a skint club it simply has no travel.
        const block = releaseBlock(game)
        const most = releasable(game)
        const amount = Math.max(RELEASE_STEP, Math.min(most, relAmt || RELEASE_STEP))
        return (
          <>
            {relMsg && <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>{relMsg}</div>}
            <div className="card">
              <div className="fact-label">{t('finances.treasurySlide')}</div>
              {most > 0 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0 2px' }}>
                    <input type="range" style={{ flex: 1 }}
                      min={RELEASE_STEP} max={most} step={RELEASE_STEP}
                      value={amount}
                      onChange={e => setRelAmt(Number(e.target.value))} />
                    <b style={{ minWidth: 74, textAlign: 'right' }}>{fmtMoney(amount)}</b>
                  </div>
                  {/* THE RESERVE IS A LINE ON THE BAR NOW, NOT ITS FAR END
                      (owner, v1.1.13: "when moving money it doesnt let me
                      transfer everything?"). It used to stop the slider dead,
                      which at Northampton's opening balance of £2.4m against a
                      £17.0m reserve meant no travel at all - the control read
                      as broken from the first week of every career. The whole
                      balance moves now, and the readout says which side of the
                      line the manager is standing on before he commits. */}
                  {(() => {
                    const under = belowReserve(game, amount)
                    const safe = Math.max(0, club.balance - cashReserve(game))
                    return (
                      <div className="meta" style={{ fontSize: 12, marginBottom: 8, color: under > 0 ? 'var(--text-negative)' : undefined }}>
                        {under > 0
                          ? t('finances.treasuryDeep', { under: fmtMoney(under) })
                          : t('finances.treasurySafe', { safe: fmtMoney(safe) })}
                      </div>
                    )
                  })()}
                </>
              )}
              <button className="btn ghost block" disabled={!!block}
                onClick={() => { const r = releaseToBudget(game, amount); setRelMsg(r.msg); setRelAmt(0); touch() }}>
                {most > 0 ? t('finances.treasuryMove', { amount: fmtMoney(amount) }) : t('finances.moveMoney', { amount: fmtMoney(RELEASE_STEP) })}
              </button>
              <div className="meta" style={{ paddingTop: 6, fontSize: 12 }}>
                {block ?? t('finances.reserveNote', { reserve: fmtMoney(cashReserve(game)), step: fmtMoney(RELEASE_STEP) })}
              </div>
            </div>
          </>
        )
      })()}
      {/* ---- THE BOARD'S OWN CHEQUE, WHERE THE MONEY MOVES ----
          Owner, 1.5.8: the injections belong on Finances, under the transfer
          of money. A manager who has just dragged the treasury slider to its
          stop and still cannot afford the signing has answered the question
          this card asks, and the only place it was offered was the Store.

          It is a SIGNPOST, not a second till. An injection is a consumable:
          buy, land, consume the receipt, survive a throw in the middle (see
          landInjection and the v1.1.17 note above it). Two copies of that
          flow is two places for a receipt to be eaten, so this one points at
          the door rather than cutting a new one. */}
      {tillOpen() && !game.unemployed && (() => {
        const tiers = Object.keys(INJECT_TIERS) as InjectTier[]
        const left = tiers.reduce((n, tr) => n + injectionsLeft(game, tr), 0)
        if (left <= 0) return null
        return (
          <button className="card" onClick={() => go('supporter')}
            style={{ borderLeft: '4px solid var(--gold)', width: '100%', textAlign: 'left', display: 'block' }}>
            <div className="fact-label">{t('store.funding')}</div>
            <div className="meta" style={{ marginTop: 2 }}>{t('store.fundingLine')}</div>
            <div className="meta" style={{ marginTop: 6, color: 'var(--gold)', fontWeight: 700 }}>{t('store.title')} ▸</div>
          </button>
        )
      })()}
      <SectionTitle>{t('finances.topEarners')}</SectionTitle>
      <div className="tblwrap"><table className="dtable">
        <thead><tr><th>{t('squad.colName')}</th><th className="num">{t('finances.colWage')}</th><th className="num">{t('squad.colUntil')}</th><th className="num">{t('squad.colValue')}</th></tr></thead>
        <tbody>
          {(allEarners ? topEarners : topEarners.slice(0, 5)).map(p => (
            <tr key={p.id}>
              <td className="name">{p.name}</td>
              <td className="num">{fmtWage(p.wage)}</td>
              <td className="num">{2026 + p.contractEnds}</td>
              <td className="num">{fmtMoney(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      {topEarners.length > 5 && (
        <button className="btn ghost block" onClick={() => setAllEarners(v => !v)}>
          {t(allEarners ? 'finances.showFewerEarners' : 'finances.showAllEarners', { n: topEarners.length })}
        </button>
      )}
      </div></div>
      </>}
      {/* ---- the commercial department (F30; the negotiating table, 1.8.0) ----
          Four things to sell, and what is in each slot right now. An offer is
          the sponsor's opening position, not a price: tapping Negotiate sits
          the manager down with them (sponsortalks.ts). The odds of a push are
          never printed, only the sponsor's mood, because the owner asked for a
          gamble and a printed percentage is a calculation. */}
      {ftab === 'deals' && <>
        <SectionTitle sub={t('finances.commercialSub', { amount: fmtMoney(commercialWeekly(game)), n: SLOTS.filter(x => { const d = game.deals?.[x.id]; return !!d && d.until >= game.season }).length })}>
          {t('finances.commercialDept')}
        </SectionTitle>
        {dealMsg && <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}><div className="meta">{dealMsg}</div></div>}
        {/* v1.1.5, "the commercial page is very messy, too much text": the
            slot blurbs and the advice card are gone - the label, the deal and
            the offers say it all. The early exit stays: end a live deal and
            three new parties present themselves at once, on wider terms than
            the season's standard three (offersFor, dealReroll). */}
        {SLOTS.map(slot => {
          const live = game.deals?.[slot.id]
          const inTerm = !!live && live.until >= game.season
          const mkt = marketRate(club.rep, slot.id)
          const ending = endArm === slot.id
          const talks = talksOf(game)
          const talk = talks.open[slot.id]
          const gone = talks.gone[slot.id] ?? []
          const ended = talks.ended?.[slot.id]
          const years = (n: number) => n === 1 ? t('finances.oneSeason') : t('finances.seasons', { n })
          return (
            <div className="card" key={slot.id}>
              <div className="fact-label">{t(slot.name)}</div>
              {inTerm && (
                <>
                  <div className="meta" style={{ marginTop: 4 }}>
                    {t(live!.auto ? 'finances.dealStopgap' : live!.perf ? 'finances.dealPerf' : 'finances.dealLive', { sponsor: live!.sponsor, weekly: fmtMoney(dealWeekly(game, live!)), year: String(2026 + live!.until) })}
                    {!live!.perf && live!.weekly < mkt * 0.92 && <span className="muted"> · {t('finances.underMarket', { rate: fmtMoney(mkt) })}</span>}
                  </div>
                  {live!.perf && (
                    <div className="meta muted">
                      {t('finances.dealPerfBonus', { amount: fmtMoney(live!.perf.league + live!.perf.title + live!.perf.final + live!.perf.tries), n: live!.perf.target })}
                    </div>
                  )}
                  {live!.clause !== 'none' && (
                    <div className="meta muted">
                      {t(CLAUSES[live!.clause].text)}{' '}
                      <b style={{ color: clauseActive(game, live!.clause) ? 'var(--text-positive)' : undefined }}>
                        {t(clauseActive(game, live!.clause) ? 'finances.payingNow' : 'finances.notPaying')}
                      </b>
                    </div>
                  )}
                  {!live!.auto && (ending ? (
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
                  ))}
                </>
              )}
              {!inTerm && (
                <div className="meta" style={{ marginTop: 4 }}>
                  <b>{t('finances.unsold')}</b>{t('finances.unsoldRest', { rate: fmtMoney(mkt) })}
                </div>
              )}
              {slotOpen(game, slot.id) && talk && (() => {
                // ---- a negotiation in progress ----
                const p = walkChance(talk, 'ask', mkt, leverage(game))
                const mood = moodOf(p)
                const terms = perfTerms(game, talk.fee, talk.structure)
                const final = talk.moves >= MAX_MOVES
                // the sponsor's reply is on the talk itself (talk.last), so the
                // tap only has to clear the last handshake and redraw
                const act = () => { setDealMsg(null); touch() }
                return (
                  <div className="talk">
                    <div className="talk-head">
                      <b>{talk.sponsor}</b>
                      <span className={`talk-mood m-${mood}`}>{t('finances.talkMood')}: {t(`finances.mood_${mood}`)}</span>
                    </div>
                    {talk.last && <div className="talk-said">{t(talk.last.k, talk.last.v)}</div>}
                    <div className="fact-label" style={{ marginTop: 8 }}>{t('finances.talkStructure')}</div>
                    <div className="talk-struct" role="group">
                      {(Object.keys(STRUCTURES) as Structure[]).map(s => (
                        <button key={s} className={talk.structure === s ? 'on' : ''} aria-pressed={talk.structure === s}
                          disabled={final && talk.structure !== s}
                          onClick={() => { restructure(game, slot.id, s); act() }}>{t(STRUCTURES[s].label)}</button>
                      ))}
                    </div>
                    <div className="meta muted" style={{ marginTop: 4 }}>{t(STRUCTURES[talk.structure].desc)}</div>
                    <div className="fact-label" style={{ marginTop: 8 }}>{t('finances.talkOnTable')}</div>
                    <div className="ledger-row">
                      <span className="lg-what">{t('finances.talkGuaranteed')}</span>
                      <span className="lg-amt">{fmtWage(terms.weekly)}{t('common.perWeek')} · {years(talk.years)}</span>
                    </div>
                    {terms.perf && <>
                      <div className="ledger-row">
                        <span className="lg-what">{t('finances.bonusLeague', { n: terms.perf.target })}</span>
                        <span className="lg-amt">{fmtMoney(terms.perf.league)}</span>
                      </div>
                      <div className="ledger-row">
                        <span className="lg-what">{t('finances.bonusTitle')}</span>
                        <span className="lg-amt">{fmtMoney(terms.perf.title)}</span>
                      </div>
                      <div className="ledger-row">
                        <span className="lg-what">{t('finances.bonusFinal')}</span>
                        <span className="lg-amt">{fmtMoney(terms.perf.final)}</span>
                      </div>
                      <div className="ledger-row">
                        <span className="lg-what">{t('finances.bonusTries', { n: terms.perf.target })}</span>
                        <span className="lg-amt">{fmtMoney(terms.perf.tries)}</span>
                      </div>
                      <div className="ledger-row bs-sub">
                        <span className="lg-what">{t('finances.talkBonusMax')}</span>
                        <span className="lg-amt">{fmtMoney(terms.perf.league + terms.perf.title + terms.perf.final + terms.perf.tries)}</span>
                      </div>
                    </>}
                    {talk.clause !== 'none' && talk.structure === 'flat' && (
                      <div className="meta muted" style={{ marginTop: 4 }}>{t(CLAUSES[talk.clause].text)}</div>
                    )}
                    <div className="meta" style={{ marginTop: 6, fontWeight: 700 }}>
                      {final ? t('finances.talkFinalTag') : t('finances.talkMoves', { n: MAX_MOVES - talk.moves })}
                    </div>
                    <div className="talk-acts">
                      <button className="btn gold" onClick={() => { setDealMsg(acceptTalk(game, slot.id)); touch() }}>{t('finances.talkAccept')}</button>
                      <button className="btn ghost" disabled={final} onClick={() => { pushTalk(game, slot.id, 'ask'); act() }}>{t('finances.talkAsk')}</button>
                      <button className="btn ghost" disabled={final} onClick={() => { pushTalk(game, slot.id, 'demand'); act() }}>{t('finances.talkDemand')}</button>
                      <button className="btn ghost" onClick={() => { breakOff(game, slot.id); act() }}>{t('finances.talkBreak')}</button>
                    </div>
                    <div className="meta muted" style={{ marginTop: 6 }}>{t('finances.talkHint')}</div>
                  </div>
                )
              })()}
              {slotOpen(game, slot.id) && !talk && (() => {
                const offers = offersFor(game, slot.id)
                const left = offers.filter(o => !gone.includes(o.sponsor)).length
                return (
                  <>
                    {ended && <div className="talk-said" style={{ marginTop: 6 }}>{t(ended.k, ended.v)}</div>}
                    {offers.map((o, i) => {
                      const walked = gone.includes(o.sponsor)
                      return (
                        <div className="ledger-row" key={i} style={{ alignItems: 'center' }}>
                          <span className="lg-what">
                            <b>{o.sponsor}</b>{' '}
                            <span className="muted">
                              {t('finances.offerMeta', { weekly: fmtMoney(o.weekly), years: years(o.years), pct: Math.round(o.vsMarket * 100) })}
                            </span>
                            {o.clause !== 'none' && <div className="meta muted">{t(CLAUSES[o.clause].text)}</div>}
                          </span>
                          {walked
                            ? <span className="meta" style={{ color: 'var(--text-negative)', fontWeight: 700 }}>{t('finances.walkedTag')}</span>
                            : <button className="btn gold tiny" onClick={() => { setDealMsg(null); openTalk(game, slot.id, i); touch() }}>{t('finances.negotiate')}</button>}
                        </div>
                      )
                    })}
                    {left === 0 && <div className="meta" style={{ marginTop: 6 }}>{t('finances.allGone')}</div>}
                  </>
                )
              })()}
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
                    <b>{fmtWage(pos.bill)}/wk</b>
                    <span className="meta">{t('finances.capOf', { cap: fmtWage(pos.cap) })}</span>
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
      <BoardDecisions />
      {/* asking the board for transfer funds is a boardroom matter, and it
          lived on the money tab, which was the deepest page in the game
          (scrollaudit, 3.3 screenfuls); the ask and the town collection sit
          with the objectives and the confidence now (1.6.5) */}
      {askMsg && <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>{askMsg}</div>}
      {rewardedAvailable('collection') && canTownCollection(game) && (
        <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
          <h3 style={{ fontSize: 14 }}>{t('till.townTitle')}</h3>
          <div className="meta">{t('till.townBody')}</div>
          <RewardedButton place="collection" label={t('till.watchTown')} style={{ marginTop: 6 }}
            onDone={out => {
              if (out === 'completed') {
                const amt = rewardTown()
                setAskMsg(amt != null ? t('till.townDone', { amount: fmtMoney(amt) }) : t('till.favourGone'))
              } else setAskMsg(t(out === 'skipped' ? 'till.spotSkipped' : 'till.spotUnavailable'))
            }} />
        </div>
      )}
      <button className="btn ghost block" disabled={asked} onClick={() => {
        if (asked) return
        setAskMsg(requestFunds(game))
        touch()
      }}>
        {t(asked ? 'finances.askedThisSeason' : 'finances.askBoard')}
      </button>
      <SectionTitle>{t('finances.seasonObjectives')}</SectionTitle>
      <div className="card" style={{ marginTop: 6 }}>
        <h3 style={{ fontSize: 16 }}>{t('finances.boardExpects', { objective: t(boardObjective(club.rep).text) })}</h3>
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
            <div key={id} style={{ display: 'flex', gap: 8, marginTop: 8, fontSize: 13, alignItems: 'flex-start' }}>
              <span className="obj-mark" style={{ color: done ? 'var(--text-positive)' : ok ? 'var(--gold)' : 'var(--text-muted)' }}>
                {done ? <IcoTick /> : ok ? <IcoClock /> : <IcoOpen />}
              </span>
              <span style={{ color: done ? 'var(--text-positive)' : 'var(--text-secondary)' }}>
                {t(def.textKey(game))}{ok && !def.banked ? t('finances.onCourseSettled') : ''}
                {/* what it is worth TO THIS CLUB. It read a flat "+£250k" for
                    everybody, which is four per cent of one budget and six
                    times another - see objectives.objectiveBonus. */}
                {' '}<b style={{ color: 'var(--text-muted)' }}>{t('finances.objReward', { amount: fmtMoney(objectiveBonus(club.budget)) })}</b>
              </span>
            </div>
          )
        })}
      </div>
      {/* the confidence meter moved to Club Information (1.8.0, owner: the
          board belongs there); the objectives it is judged on stay here */}
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
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ key: string; text: string } | null>(null)
  const [confirmCharter, setConfirmCharter] = useState(false)

  // This desk used to fetch the charter's live price and print it on the
  // button. v1.2.3 stopped showing prices anywhere in the game ("just a buy
  // button"), so there is nothing to fetch: the payment sheet quotes the
  // figure, in the currency of whoever is holding the phone.
  const open = tillOpen()
  if (!open || game.unemployed) return null

  const sayOutcome = (key: string, out: string) => setMsg({
    key,
    // a refusal names itself here too - the Charter desk is the one shelf row
    // that did not move to the Store, so it needs the same diagnosis
    text: t(out === 'cancelled' ? 'supporter.cancelled'
      : out === 'pending' ? 'till.pending'
      : out === 'unavailable' ? 'supporter.unavailable'
      : out === 'refused' ? 'supporter.refused'
      : 'supporter.error')
      + (out === 'refused' && billingReason() ? ` (${billingReason()})` : ''),
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
      <div className="muted" style={{ padding: '0 14px 6px', fontSize: 13 }}>{t('till.boardBlurb')}</div>

      {game.uncapped ? (
        <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
          <h3 style={{ fontSize: 16 }}>{t('till.charterTitle')}</h3>
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
          <h3 style={{ fontSize: 16 }}>{t('till.charterTitle')}</h3>
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
              {busy ? t('till.asking') : t('till.buy')}
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

/**
 * BOARDROOM DECISIONS (owner, 28 Sep 2026). The pre-season camp, the pitch
 * for the season and the sponsor slot deals were asked in the press room,
 * among the journalists, when they are money and targets: the board's
 * business. They are asked here now (media.isBoardroom), answered through
 * the same store action, and what was decided stays on the page for as long
 * as the press room keeps its coverage.
 */
function BoardDecisions() {
  const game = useStore(s => s.game)!
  const answer = useStore(s => s.answerPressOption)
  const open = game.press.filter(p => !p.answered && isBoardroom(p))
  const now = game.season * SEASON_WEEKS + game.week
  const done = game.press
    .filter(p => p.answered && isBoardroom(p) && now - absWeek(p.season, p.week) <= PRESS_KEEP_WEEKS)
    .reverse()
  if (!open.length && !done.length) return null
  return (
    <>
      <SectionTitle>{t('finances.boardDecisions')}</SectionTitle>
      {open.map(item => (
        <div key={item.id} className="card">
          <div className="press-q" style={{ padding: 0, marginBottom: 10 }}>{pressQuestion(item)}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {item.options.map((o, i) => (
              <button key={i} className="btn ghost" style={{ textAlign: 'left' }}
                onClick={() => answer(item.id, i)}>
                {pressLabel(o)}
              </button>
            ))}
          </div>
        </div>
      ))}
      {done.map(item => (
        <div key={item.id} className="card">
          <div className="meta">{pressQuestion(item)}</div>
          <div style={{ marginTop: 6, fontSize: 14 }}>
            <b>{t('finances.boardDecided')}</b> {pressAnswer(item)}
          </div>
          <div className="meta" style={{ marginTop: 4 }}>{pressReaction(item)}</div>
        </div>
      ))}
    </>
  )
}
