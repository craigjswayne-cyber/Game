import { useMemo, useState } from 'react'
import { useStore } from '../../store'
import { clubCode, fmtMoney, fmtWage, POS_ORDER, seasonLabel, type Attrs, type Pos } from '../../game/model'
import { counterIncomingOffer, renewalDemand, respondToOffer, windowOpen } from '../../game/ai'
import { isDeadlineWeek, openDate, shutDate } from '../../game/window'
import { LOAN_LENGTHS, LOAN_SHARES, loanIn, loanMarket, loanTargets, type LoanLength } from '../../game/loans'
import { noteUse } from '../../game/usage'
import { attrRange, fuzzedCa, knowledge, searchKey, seenValue } from '../../game/scout'
import { FormPill, Mark, Nat, PosBadge, SectionTitle, Stars, TwoStep } from '../components'
import { attrName, posName, t, compLabel } from '../../game/i18n'
import { userWageBudget } from '../../game/grants'
import { transferInterest } from '../../game/interest'
import { ScoutingBody } from './Scouting'
import { ariaSort, rowNav } from '../rowNav'

/** The classic search screen's views (1.8.0): which columns the table shows. */
type SearchView = 'general' | 'contract' | 'physical' | 'setpiece' | 'handling' | 'mind'
const SEARCH_VIEWS: SearchView[] = ['general', 'contract', 'physical', 'setpiece', 'handling', 'mind']
/** four attributes a view, so a phone never scrolls sideways (sidescroll.mjs) */
const VIEW_ATTRS: Record<Exclude<SearchView, 'general' | 'contract'>, (keyof Attrs)[]> = {
  physical: ['pac', 'str', 'sta', 'agi'],
  setpiece: ['scr', 'lin', 'kic', 'goa'],
  handling: ['pas', 'han', 'tac', 'ruc'],
  mind: ['vis', 'dec', 'pos', 'lea'],
}
/** "Louis Bielle-Biarrey" as "L. Bielle-Biarrey": the search table's form of a
 *  name, as the classic manager games print it, so eight columns fit a phone
 *  without cutting anyone's surname. A single name stays whole. */
function initialName(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts.length < 2 ? name : `${parts[0][0]}. ${parts.slice(1).join(' ')}`
}

const ATTR_ORDER: (keyof Attrs)[] = ['pac', 'str', 'sta', 'agi', 'scr', 'lin', 'kic', 'goa', 'pas', 'han', 'tac', 'ruc', 'vis', 'dec', 'pos', 'lea', 'agg', 'wor']

export default function Transfers() {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  /** bumped by touch() after every in-place change to the game: the lists
   *  below are cached, and a loan, a bid or a signing struck this week has to
   *  reach them this week (round 183) */
  const tick = useStore(s => s.tick)
  const go = useStore(s => s.go)
  const [pos, setPos] = useState<Pos | 'ALL'>('ALL')
  const [query, setQuery] = useState('')
  const [maxVal, setMaxVal] = useState(0)
  const [maxAge, setMaxAge] = useState(0)
  const [league, setLeague] = useState('ALL')
  const [listedOnly, setListedOnly] = useState(false)
  /** the loan being negotiated: who, for how long, and who pays (v1.2.8) */
  const [loanDeal, setLoanDeal] = useState<{ id: number; length: LoanLength; share: number } | null>(null)
  /** TRANSFER OR LOAN (owner, 27 Sep 2026: "loans should be part of the
   *  transfer market with a loan option available in the filter section").
   *  Loan shows the men offered on loan, and, once three letters of a name are
   *  typed, anyone else a club might lend (the unsolicited approach): tapping
   *  either opens the loan sheet. */
  const [deal, setDeal] = useState<'transfer' | 'loan'>('transfer')
  // WHO WOULD ACTUALLY COME? The engine has always refused a bid from a club
  // far below a happy player's, and never said so until you had spent the bid
  // (interest.ts). This chip asks that same question up front.
  const [keenOnly, setKeenOnly] = useState(false)
  // 1.8.0, the classic search screen: which columns you are looking at, one
  // attribute to filter on, the injured and the expiring
  const [view, setView] = useState<SearchView>('general')
  const [attrKey, setAttrKey] = useState<keyof Attrs | ''>('')
  const [attrMin, setAttrMin] = useState(12)
  const [withInjured, setWithInjured] = useState(true)
  const [expiringOnly, setExpiringOnly] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [msort, setMsort] = useState<'ca' | 'value' | 'age' | 'name' | 'form'>('ca')
  const [mdesc, setMdesc] = useState(false)
  // KEYED TO THE ROW, not to the page. Same class of bug as the coach market:
  // a banner above the tab bar answers a Sign on loan tapped eleven rows down,
  // where the manager never sees it.
  const [msg, setMsg] = useState<{ key: string; text: string } | null>(null)
  // Market, Scouting and Deals. Shortlist became Scouting and Loans moved into
  // the market's filters (owner, 27 Sep 2026)
  const [xtab, setXtab] = useState<'market' | 'scouting' | 'deals'>('market')
  const [page, setPage] = useState(0)
  const PER_PAGE = 10

  const user = game.clubs[game.userClubId]

  // WHO YOU MAY RING ABOUT. The loan list is the shop window; beyond it, the
  // unsolicited approach finds anyone loanApproachable (the same gate the
  // engine applies), but only from a typed name: every under-23 in the world
  // is far too many rows to browse.
  //
  // KEYED ON THE TICK AS WELL AS THE WEEK (owner, round 183: "when a player is
  // loaned out, he still appears in the available loan list"). The game is
  // changed in place, so a loan struck on this screen left `game` and
  // `game.week` exactly as they were and both lists below kept serving the
  // man who had just signed, until the week turned or the screen was left.
  const listedLoans = useMemo(() => new Set(loanTargets(game).map(p => p.id)), [game, game.week, tick])
  const loanIds = useMemo(() => deal === 'loan' ? new Set(loanMarket(game, query).map(p => p.id)) : null,
    [game, game.week, tick, deal, query])
  const offers = game.offers.filter(o => o.status === 'pending' && o.forUser)

  const MTh = ({ k, children, right }: { k: typeof msort; children: React.ReactNode; right?: boolean }) => (
    <th className={`th-sort${msort === k ? ' active' : ''}${right ? ' num' : ''}`}
      aria-sort={ariaSort(msort === k, mdesc, k === 'age' || k === 'name')}>
      <button type="button" className="th-btn"
        onClick={() => (msort === k ? setMdesc(!mdesc) : (setMsort(k), setMdesc(false)))}>
        {children}{msort === k ? (mdesc ? ' ▴' : ' ▾') : ''}
      </button>
    </th>
  )

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = Object.values(game.players).filter(p => p.clubId !== game.userClubId)
    // the engine's market (loans.loanMarket), not a second opinion of it
    if (loanIds) list = list.filter(p => loanIds.has(p.id))
    if (pos !== 'ALL') list = list.filter(p => p.pos === pos || p.alt.includes(pos))
    if (q) list = list.filter(p => p.name.toLowerCase().includes(q) || (p.clubId ? game.clubs[p.clubId]?.short.toLowerCase().includes(q) : false))
    // value and ability are read through the scouts (1.8.2): a filter or sort
    // on the true figures ranked hidden ceilings for free
    if (maxVal > 0) list = list.filter(p => seenValue(game, p) <= maxVal)
    if (maxAge > 0) list = list.filter(p => p.age <= maxAge)
    if (league === 'FA') list = list.filter(p => !p.clubId)
    else if (league !== 'ALL') list = list.filter(p => p.clubId && game.clubs[p.clubId]?.leagueId === league)
    if (listedOnly) list = list.filter(p => p.transferListed)
    if (keenOnly) list = list.filter(p => transferInterest(game, p) !== 'no')
    if (!withInjured) list = list.filter(p => !p.injury)
    if (expiringOnly) list = list.filter(p => p.clubId && p.contractEnds <= game.season)
    // an attribute filter reads what the scouts can see: the middle of the range
    if (attrKey) list = list.filter(p => { const [lo, hi] = attrRange(game, p, attrKey); return (lo + hi) / 2 >= attrMin })
    const dir = mdesc ? -1 : 1
    list.sort((a, b) => {
      switch (msort) {
        case 'value': return (searchKey(game, b, 'value') - searchKey(game, a, 'value')) * dir
        case 'age': return (a.age - b.age) * dir
        case 'name': return a.name.localeCompare(b.name) * dir
        case 'form': return (b.form - a.form) * dir
        default: return (searchKey(game, b, 'ca') - searchKey(game, a, 'ca')) * dir
      }
    })
    return list.slice(0, 120)
  }, [game, game.players, game.clubs, pos, query, maxVal, maxAge, league, listedOnly, keenOnly, withInjured, expiringOnly, attrKey, attrMin, msort, mdesc, game.week, tick, deal, loanIds])
  const activeFilters = [deal === 'loan', pos !== 'ALL', league !== 'ALL', maxVal > 0, maxAge > 0, !!attrKey,
    listedOnly, keenOnly, expiringOnly, !withInjured].filter(Boolean).length
  const pages = Math.max(1, Math.ceil(results.length / PER_PAGE))
  const pageSafe = Math.min(page, pages - 1)
  const pageRows = results.slice(pageSafe * PER_PAGE, (pageSafe + 1) * PER_PAGE)
  // a row opens the player, or in Loan the loan sheet
  const openRow = (id: number) => deal === 'loan'
    ? (setLoanDeal({ id, length: 'season', share: 0.5 }), setMsg(null))
    : go('player', id)

  return (
    <>
      <div className="chips" style={{
        position: 'sticky', top: 0, zIndex: 5, margin: 0, padding: '10px 14px 8px',
        background: 'color-mix(in srgb, var(--canvas) 92%, transparent)', backdropFilter: 'blur(6px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <span className="chip">{t('transfers.budget')} <b>{fmtMoney(user.budget)}</b></span>
        <span className="chip">{t('transfers.wageRoom')} <b>{Number.isFinite(userWageBudget(game, user)) ? `${fmtWage(Math.max(0, userWageBudget(game, user) - user.players.reduce((s, id) => s + (game.players[id]?.wage ?? 0), 0)))}${t('common.perWeek')}` : t('finances.noLimit')}</b></span>
        <span className="chip" style={{
          color: windowOpen(game.week) ? 'var(--text-positive)' : 'var(--text-muted)',
          fontWeight: 700,
        }}>
          {!windowOpen(game.week) ? t('transfers.windowClosed', openDate(game))
            : t(isDeadlineWeek(game.week) ? 'transfers.deadlineWindow' : 'transfers.windowOpen', shutDate(game))}
        </span>
      </div>

      <div className="tab-bar">
        <button className={xtab === 'market' ? 'active' : ''} onClick={() => setXtab('market')}>{t('transfers.tabMarket')}</button>
        <button className={xtab === 'scouting' ? 'active' : ''} onClick={() => setXtab('scouting')}>{t('transfers.tabScouting')}</button>
        <button className={xtab === 'deals' ? 'active' : ''} onClick={() => setXtab('deals')}>{t('transfers.tabDeals')}</button>
      </div>

      {xtab === 'deals' && (() => {
        const committed = new Set((game.preContracts ?? []).map(pc => pc.playerId))
        const expiring = user.players
          .map(id => game.players[id])
          .filter(Boolean)
          .filter(p => p.contractEnds <= game.season || (p.wantsDeal ?? 0) > 0)
          .sort((a, b) => b.ca - a.ca)
        const incoming = (game.preContracts ?? [])
          .filter(pc => pc.toClubId === game.userClubId)
          .map(pc => game.players[pc.playerId])
          .filter(Boolean)
        return (
          <>
            <SectionTitle sub={t('transfers.contractSituationsSub')}>{t('transfers.contractSituations')}</SectionTitle>
            {expiring.length === 0 && (
              <div className="muted" style={{ padding: 14 }}>
                {t('transfers.nothingUrgent')}
              </div>
            )}
            {expiring.map(p => {
              const gazumped = committed.has(p.id)
              const demand = renewalDemand(p)
              return (
                <div key={p.id} className="row-item" {...rowNav(() => go('player', p.id))}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                  <PosBadge pos={p.pos} />
                  {/* THE NAME GIVES WAY, NOT THE VERDICT. "signed elsewhere"
                      is the whole point of the row and it was free to wrap to
                      two lines behind a long name on a narrow phone. */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {t('transfers.dealLine', { age: p.age, wage: fmtWage(p.wage), demand: fmtWage(demand), morale: p.morale.toFixed(0) })}
                    </div>
                  </div>
                  {p.retiring
                    ? <span className="chip" style={{ borderColor: 'var(--danger)', color: 'var(--danger)', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>{t('transfers.retiring')}</span>
                    : gazumped
                    ? <span className="chip" style={{ borderColor: 'var(--danger)', color: 'var(--danger)', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>{t('transfers.signedElsewhere')}</span>
                    : (p.wantsDeal ?? 0) > 0
                      ? <span className="chip" style={{ borderColor: 'var(--gold)', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>{t('transfers.wantsADeal')}</span>
                      : <span className="chip" style={{ fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>{t('transfers.expiring')}</span>}
                </div>
              )
            })}
            {expiring.length > 0 && (
              <div className="muted" style={{ padding: '8px 14px', fontSize: 12 }}>
                {t('transfers.renewNote')}
              </div>
            )}
            {incoming.length > 0 && (
              <>
                <SectionTitle sub={t('transfers.arrivingSummerSub')}>{t('transfers.arrivingSummer')}</SectionTitle>
                {incoming.map(p => (
                  <div key={p.id} className="row-item" {...rowNav(() => go('player', p.id))}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                    <PosBadge pos={p.pos} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>{p.name}</div>
                      <div className="muted" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t('transfers.incomingLine', { age: p.age, from_k: p.clubId ? 'transfers.fromClub' : 'transfers.fromFree', club: p.clubId ? game.clubs[p.clubId]?.short ?? '?' : '' })}
                      </div>
                    </div>
                    <span className="chip" style={{ borderColor: 'var(--gold)', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>{t('transfers.agreed')}</span>
                  </div>
                ))}
              </>
            )}
          </>
        )
      })()}

      {/* THE SCOUTING TAB IS THE SCOUTING PAGE (owner: "It should have a
          list and you click in for a scout report"). One body, Scouting.tsx,
          with the verdicts cut to a short preview here and the whole list on
          the Hub's own Scouting page. */}
      {xtab === 'scouting' && <ScoutingBody preview />}

      {xtab === 'market' && offers.length > 0 && (
        <>
          <SectionTitle>{t('transfers.offersForYourPlayers')}</SectionTitle>
          {offers.map(o => {
            const p = game.players[o.playerId]
            const bidder = game.clubs[o.fromClubId]
            if (!p || !bidder) return null
            return (
              <div className="card" key={o.id}>
                <h3>{t('transfers.bidLine', { club: bidder.name, fee: fmtMoney(o.fee), player: p.name })}</h3>
                <div className="meta">
                  {t('transfers.bidMeta', { value: fmtMoney(p.value), age: p.age, morale: p.morale.toFixed(0) })}
                  {[7, 26, 27].includes(game.week) && <b style={{ color: 'var(--danger)' }}>{t('transfers.diesAtDeadline')}</b>}
                </div>
                <div className="btn-row" style={{ margin: '10px 0 0' }}>
                  <TwoStep className="btn gold" label={t('transfers.accept')} confirm={t('common.confirmSell')}
                    onConfirm={() => { setMsg({ key: `offer:${o.id}`, text: respondToOffer(game, o.id, true) }); touch() }} />
                  {/* ghost, not plain: the plain button is surface-3 on a surface-1 card,
                      which on the light skins is the same colour twice, and the owner
                      could not tell Demand More was a button at all (v1.2.6) */}
                  <button className="btn ghost" onClick={() => { setMsg({ key: `offer:${o.id}`, text: counterIncomingOffer(game, o.id) }); touch() }}>{t('transfers.demandMore')}</button>
                  <button className="btn danger" onClick={() => { setMsg({ key: `offer:${o.id}`, text: respondToOffer(game, o.id, false) }); touch() }}>{t('transfers.reject')}</button>
                </div>
                {msg?.key === `offer:${o.id}` && (
                  <div className="meta" style={{ fontSize: 12, fontWeight: 600, marginTop: 6 }}>{msg.text}</div>
                )}
              </div>
            )
          })}
        </>
      )}

      {loanDeal && (() => {
        const lp = game.players[loanDeal.id]
        const parent = lp?.clubId ? game.clubs[lp.clubId] : null
        const reply = msg?.key === `loan:${loanDeal.id}` ? msg.text : null
        const gone = !lp || lp.clubId === game.userClubId
        return (
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- tap-outside-to-close veil, and Escape closes it (a11y.ts); the sheet has its own buttons
          <div className="modal-veil" onClick={() => setLoanDeal(null)}>
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- swallows taps inside the sheet so it stays open; not a control */}
            <div className="modal loan-sheet" onClick={e => e.stopPropagation()}>
              <div className="grab" />
              <SectionTitle sub={parent ? t('transfers.loanSheetSub', { club: parent.name }) : ''}>{lp?.name ?? ''}</SectionTitle>
              {!gone && (
                <div className="loan-deal">
                  <label className="meta">{t('transfers.loanLength')}
                    <select className="inline-input" value={loanDeal.length}
                      onChange={e => setLoanDeal({ ...loanDeal, length: e.target.value as LoanLength })}>
                      {LOAN_LENGTHS.map(l => <option key={l} value={l}>{t(`transfers.loanLen${l[0].toUpperCase()}${l.slice(1)}`)}</option>)}
                    </select>
                  </label>
                  <label className="meta">{t('transfers.loanShare')}
                    <select className="inline-input" value={loanDeal.share}
                      onChange={e => setLoanDeal({ ...loanDeal, share: Number(e.target.value) })}>
                      {LOAN_SHARES.map(sh => <option key={sh} value={sh}>{t('transfers.loanSharePct', { n: Math.round(sh * 100) })}</option>)}
                    </select>
                  </label>
                  {lp && <div className="meta muted">{t('transfers.loanCostLine', { wage: fmtWage(Math.round(lp.wage * loanDeal.share)) })}</div>}
                </div>
              )}
              {reply && <div className="meta sheet-log" style={{ borderLeft: '3px solid var(--gold)', paddingLeft: 8, margin: '8px 14px 0', whiteSpace: 'normal' }}>{reply}</div>}
              <div className="btn-row" style={{ margin: '12px 14px 4px' }}>
                <button className="btn ghost" onClick={() => setLoanDeal(null)}>{t(gone ? 'transfers.loanDone' : 'transfers.loanClose')}</button>
                {!gone && (
                  <button className="btn gold" style={{ flex: 1.6 }}
                    onClick={() => { setMsg({ key: `loan:${loanDeal.id}`, text: loanIn(game, loanDeal.id, loanDeal.length, loanDeal.share) }); noteUse('loan'); touch() }}>
                    {t('transfers.loanOffer')}
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {xtab === 'market' && <>
      {/* "120 found (best 120)" said the cap twice and paid for it in width:
          the device matrix clipped "tap to bid" clean off at 360px. Once. */}
      <SectionTitle sub={deal === 'loan'
        ? t('transfers.loanMarketSub2', { n: results.length })
        : t('transfers.marketSub', { n: results.length === 120 ? t('transfers.best120') : results.length })}>
        {t(deal === 'loan' ? 'transfers.loanMarket' : 'transfers.scoutTheMarket')}
      </SectionTitle>
      {/* ---- six filters, two tidy rows, nothing bigger than it needs to be ----
          These controls were three different sizes: a flex-grow search box, a
          116px select whose label "All positions" did not fit inside it, and
          four equal-flex controls below. Different heights and a clipped label
          read as boxes overlapping each other (user: "the filters below scout
          the market are to big in box size that they overlap"). Both rows are
          .filter-line now, so every control is the same height and divides its
          row equally, and every resting label is the filter's own name - short
          enough to fit, and it reads as a placeholder, which is what an unset
          filter is. */}
      {/* ---- ONE ROW, THEN A SHEET (1.8.0) ----
          Owner, 26 Sep 2026, circling the four rows of dropdowns and chips:
          "tidy this section up. Make it so its a filter and you select what
          you want to see". The name search stays on the page because it is
          the one thing typed every time; every other filter lives in a sheet
          behind one button that says how many are on, and the columns are a
          single View menu. */}
      <div className="filter-line">
        <input className="inline-input" placeholder={t('transfers.nameOrClub')} value={query}
          onChange={e => { setQuery(e.target.value); setPage(0) }}
          style={{ flex: '2 1 0' }} />
        <button className={`inline-input filter-btn${activeFilters ? ' on' : ''}`} onClick={() => setFiltersOpen(true)}>
          {activeFilters ? t('search.filtersOn', { n: activeFilters }) : t('search.filters')}
        </button>
        <select className="inline-input" aria-label={t('search.view')} value={view} onChange={e => setView(e.target.value as SearchView)}>
          {SEARCH_VIEWS.map(v => <option key={v} value={v}>{t(`search.view_${v}`)}</option>)}
        </select>
      </div>
      {filtersOpen && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- tap-outside-to-close veil, and Escape closes it (a11y.ts); the sheet has its own buttons
        <div className="modal-veil" onClick={() => setFiltersOpen(false)}>
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- swallows taps inside the sheet so it stays open; not a control */}
          <div className="modal filter-sheet" onClick={e => e.stopPropagation()}>
            <div className="grab" />
            <h3>{t('search.filters')}</h3>
            <div className="fs-grid">
              <label>{t('search.deal')}</label>
              <select className="inline-input" value={deal} onChange={e => { setDeal(e.target.value as 'transfer' | 'loan'); setPage(0) }}>
                <option value="transfer">{t('search.dealTransfer')}</option>
                <option value="loan">{t('search.dealLoan')}</option>
              </select>
              <label>{t('transfers.filterPosition')}</label>
              <select className="inline-input" value={pos} onChange={e => { setPos(e.target.value as Pos | 'ALL'); setPage(0) }}>
                <option value="ALL">{t('search.any')}</option>
                {POS_ORDER.map(p => <option key={p} value={p}>{posName(p)}</option>)}
              </select>
              <label>{t('transfers.filterLeague')}</label>
              <select className="inline-input" value={league} onChange={e => { setLeague(e.target.value); setPage(0) }}>
                <option value="ALL">{t('search.any')}</option>
                {/* a free agent's league is nowhere, which makes this the natural
                    place to find him (user: "you should be able to search for free
                    agents on the transfer centre") */}
                <option value="FA">{t('transfers.freeAgents')}</option>
                {Object.values(game.comps).filter(c => c.type === 'league').map(c => (
                  <option key={c.id} value={c.id}>{compLabel(c.short)}</option>
                ))}
              </select>
              <label>{t('transfers.filterValue')}</label>
              <select className="inline-input" value={maxVal} onChange={e => { setMaxVal(Number(e.target.value)); setPage(0) }}>
                <option value={0}>{t('search.any')}</option>
                <option value={250000}>{t('transfers.toValue', { amount: '£250k' })}</option>
                <option value={1000000}>{t('transfers.toValue', { amount: '£1m' })}</option>
                <option value={3000000}>{t('transfers.toValue', { amount: '£3m' })}</option>
                <option value={8000000}>{t('transfers.toValue', { amount: '£8m' })}</option>
              </select>
              <label>{t('transfers.filterAge')}</label>
              <select className="inline-input" value={maxAge} onChange={e => { setMaxAge(Number(e.target.value)); setPage(0) }}>
                <option value={0}>{t('search.any')}</option>
                {[21, 24, 28, 32].map(n => <option key={n} value={n}>{t('transfers.ageOrUnder', { n })}</option>)}
              </select>
              {/* the attributes are what the scouts can see (scout.attrRange) */}
              <label>{t('search.anyAttr')}</label>
              <div className="fs-pair">
                <select className="inline-input" value={attrKey} onChange={e => { setAttrKey(e.target.value as keyof Attrs | ''); setPage(0) }}>
                  <option value="">{t('search.any')}</option>
                  {ATTR_ORDER.map(k => <option key={k} value={k}>{attrName(k)}</option>)}
                </select>
                <select className="inline-input" value={attrMin} disabled={!attrKey} onChange={e => { setAttrMin(Number(e.target.value)); setPage(0) }}>
                  {[8, 10, 12, 14, 16, 18].map(n => <option key={n} value={n}>{t('search.atLeast', { n })}</option>)}
                </select>
              </div>
            </div>
            <div className="fs-toggles">
              {([
                [listedOnly, () => setListedOnly(!listedOnly), 'search.onlyListed'],
                [keenOnly, () => setKeenOnly(!keenOnly), 'search.onlyInterested'],
                [expiringOnly, () => setExpiringOnly(!expiringOnly), 'search.onlyExpiring'],
                [withInjured, () => setWithInjured(!withInjured), 'search.includeInjured'],
              ] as [boolean, () => void, string][]).map(([on, flip, k]) => (
                <label key={k} className="fs-toggle">
                  <input type="checkbox" checked={on} onChange={() => { flip(); setPage(0) }} />
                  <span>{t(k)}</span>
                </label>
              ))}
            </div>
            <div className="btn-row" style={{ marginTop: 10 }}>
              <button className="btn ghost" onClick={() => {
                setDeal('transfer'); setPos('ALL'); setLeague('ALL'); setMaxVal(0); setMaxAge(0); setAttrKey('')
                setListedOnly(false); setKeenOnly(false); setExpiringOnly(false); setWithInjured(true); setPage(0)
              }}>{t('search.reset')}</button>
              <button className="btn gold" style={{ flex: 2 }} onClick={() => setFiltersOpen(false)}>
                {t('search.show', { n: results.length === 120 ? t('transfers.best120') : results.length })}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* codefirst: the leading column is a position code, so it forgoes the
          16px first-column gutter - eight columns already fill a 412px phone */}
      {view !== 'general' ? (
      <div className="tblwrap"><table className="dtable codefirst">
        <thead><tr>
          <th>{t('squad.colPos')}</th>
          <MTh k="name">{t('squad.colName')}</MTh>
          {view === 'contract'
            ? <><th className="num">{t('search.colUntil')}</th><th className="num">{t('search.colWage')}</th><th>{t('search.colStatus')}</th></>
            : VIEW_ATTRS[view].map(k => <th key={k} className="num" title={attrName(k)}>{t(`attrShort.${k}`)}</th>)}
        </tr></thead>
        <tbody>
          {pageRows.length === 0 && (
            <tr><td colSpan={6} className="muted" style={{ padding: 12 }}>
              {t('transfers.noMatches', { listedHint: listedOnly ? t('transfers.listedHint') : '' })}
            </td></tr>
          )}
          {pageRows.map(p => (
            <tr key={p.id} {...rowNav(() => openRow(p.id))}>
              <td><PosBadge pos={p.pos} /></td>
              <td className="name" title={p.name}>{initialName(p.name)}{p.injury && <> <Mark name="medical" color="var(--danger)" title={t('selection.injured')} /></>}</td>
              {view === 'contract'
                ? <>
                    <td className="num">{p.clubId ? seasonLabel(p.contractEnds) : '-'}</td>
                    <td className="num">{fmtWage(p.wage)}</td>
                    <td className="muted">{p.transferListed ? t('search.listed') : p.clubId && p.contractEnds <= game.season ? t('search.expiringShort') : !p.clubId ? t('transfers.freeAgent') : ''}</td>
                  </>
                : VIEW_ATTRS[view].map(k => {
                    const [lo, hi] = attrRange(game, p, k)
                    return <td key={k} className="num attr-cell">{lo === hi ? lo : `${lo}-${hi}`}</td>
                  })}
            </tr>
          ))}
        </tbody>
      </table></div>
      ) : (
      <div className="tblwrap"><table className="dtable codefirst">
        <thead><tr>
          <th>{t('squad.colPos')}</th>
          <MTh k="name">{t('squad.colName')}</MTh>
          <MTh k="age" right>{t('squad.colAge')}</MTh>
          <th>{t('squad.colNat')}</th>
          <th>{t('transfers.colClub')}</th>
          <MTh k="ca">{t('transfers.colAbility')}</MTh>
          <MTh k="form" right>{t('transfers.colForm')}</MTh>
          <MTh k="value" right>{t('squad.colValue')}</MTh>
        </tr></thead>
        <tbody>
          {pageRows.length === 0 && (
            <tr><td colSpan={8} className="muted" style={{ padding: 12 }}>
              {t('transfers.noMatches', { listedHint: listedOnly ? t('transfers.listedHint') : '' })}
            </td></tr>
          )}
          {pageRows.map(p => (
            <tr key={p.id} {...rowNav(() => openRow(p.id))}>
              <td><PosBadge pos={p.pos} /></td>
              <td className="name" title={p.name}>{initialName(p.name)}{deal === 'transfer' && p.transferListed && <> <Mark name="tag" color="var(--gold)" title={t('player.transferListed')} /></>}{deal === 'loan' && !listedLoans.has(p.id) ? <span className="muted"> {t('transfers.loanAskTag')}</span> : ''}</td>
              <td className="num">{p.age}</td>
              <td><Nat code={p.nat} /></td>
              {/* THREE LETTERS. This column was 76px of an eight-column table
                  that ran 64px off the side of a 412px phone (owner, v1.1.17:
                  "make the teams initials or first three letters of their name
                  be used... so you dont have to scroll right at all").
                  clubCode is what the crest draws and the touchline paints, so
                  everything that names a club agrees. The search box above
                  still matches the full name - only the cell shortens. */}
              <td className="muted">{p.clubId ? clubCode(game.clubs[p.clubId]?.short ?? '') : t('transfers.freeAgent')}</td>
              <td><Stars ca={fuzzedCa(game, p)} />{knowledge(game, p) < 95 && <span className="muted">?</span>}</td>
              <td className="num"><FormPill v={p.form} /></td>
              <td className="num">{fmtMoney(seenValue(game, p))}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      )}
      {pages > 1 && (
        <div className="pager">
          <button className="btn ghost" disabled={pageSafe === 0} onClick={() => setPage(pageSafe - 1)}>{t('transfers.prev')}</button>
          <span className="meta" style={{ fontFamily: 'var(--cond)', fontWeight: 700, letterSpacing: 1 }}>
            {t('transfers.page', { n: pageSafe + 1, total: pages })}
          </span>
          <button className="btn ghost" disabled={pageSafe >= pages - 1} onClick={() => setPage(pageSafe + 1)}>{t('transfers.next')}</button>
        </div>
      )}
      </>}
      <div className="spacer" />
    </>
  )
}
