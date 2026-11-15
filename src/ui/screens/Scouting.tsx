/**
 * ---- SCOUTING, A PAGE OF ITS OWN ----
 *
 * Owner: "Scouting needs to be more visible as an option. Make it a page
 * underneath Training and Staff." And: "Scout page is a mess for format with
 * text blocks and things messy. It should have a list and you click in for a
 * scout report."
 *
 * The scout's verdicts were a table on the Transfer Centre's Scouting tab in
 * which every row carried his whole sentence, two ratings and a button, so on
 * a phone the sentence wrapped into a column three words wide. Now a row is a
 * row: position, name, age and club, and a compact rating. Tap it and the full
 * report opens: his verdict and his words, current and potential stars as he
 * estimated them, what the file says the man is good and poor at, the price,
 * and what to do about him.
 *
 * The same body is the Transfer Centre's Scouting tab, so the two can never
 * disagree; this page is the door to it from the Hub.
 */
import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import { clubCode, fmtMoney, fmtWage, newsBody, newsSubject, POS_ORDER, weekDate, weeksBetween100, type GameState, type Player, type Pos } from '../../game/model'
import { fuzzedCa, knowledge, scoutPa, scoutWatchList, seenValue, shownCa, toggleScoutWatch, watchSlots, watchWeeks } from '../../game/scout'
import { commissionScout, searchFee, type BriefAim, type SearchMonths } from '../../game/commission'
import { hindsight, recFor, scoutList, scoutRecord, surenessOf, type ScoutRec } from '../../game/scoutrecs'
import { askingPrice } from '../../game/transferRules'
import { rivalTalk } from '../../game/recruit'
import { badgeLabel } from '../../game/staff'
import { compLabel, posName, t } from '../../game/i18n'
import { PosBadge, SectionTitle, Stars } from '../components'
import { Glyph } from '../glyphs'
import { plainNews } from '../NewsBody'
import ScoutReportCard from '../ScoutReport'
import AttrGrid, { bestInShirt } from '../AttrGrid'
import { offerFocus, tabFocus } from './PlayerScreen'
import { rowNav } from '../rowNav'
import { Veil } from '../Veil'

/** The verdict's colour, the same ladder the old table used. */
const gradeColour = (g: number) =>
  g >= 3 ? 'var(--text-positive)' : g === 2 ? 'var(--text-secondary)' : g === 1 ? 'var(--text-muted)' : 'var(--text-negative)'

/** "Bring him in", in the reader's language and the player's world. */
const gradeWord = (g: number) => t(`news.grade${g}`)

/** The leagues the scouts can be pointed at, the MRC beside the Premier
 *  (owner, 27 Sep 2026: "MRC should be on the same line as prem ... not on its
 *  own down below"). It was the last league created, so it came last and sat
 *  alone on a row of its own. The game's own order is left alone: the season
 *  runs its leagues in that order. */
function scoutLeagues(game: GameState) {
  const all = Object.values(game.comps).filter(c => c.type === 'league')
  const mrc = all.find(c => c.id === 'mrc')
  if (!mrc) return all
  const rest = all.filter(c => c !== mrc)
  const at = rest.findIndex(c => c.id === 'prem')
  return at < 0 ? all : [...rest.slice(0, at + 1), mrc, ...rest.slice(at + 1)]
}

/** One man, one line: nothing in it wraps. The name gives way, never the
 *  rating. */
function ScoutRow({ game, p, rec, onOpen }: { game: GameState; p: Player; rec: ScoutRec | null; onOpen: () => void }) {
  const club = p.clubId ? game.clubs[p.clubId] : null
  const talk = rivalTalk(game, p)
  return (
    <button className="scout-row" onClick={onOpen}>
      <PosBadge pos={p.pos} />
      <span className="scout-row-who">
        <b>{p.name}{talk && <span style={{ color: 'var(--gold)' }} title={t('recruit.talkMark')} aria-label={t('recruit.talkMark')}> <Glyph name="talk" /></span>}</b>
        <span className="muted">{p.age} · {club ? clubCode(club.short) : t('transfers.freeAgent')}</span>
      </span>
      <span className="scout-row-rate">
        <Stars ca={rec ? rec.cur : shownCa(game, p)} />
        {rec
          ? <span className="scout-row-verdict" style={{ color: gradeColour(rec.grade) }}>{gradeWord(rec.grade)}</span>
          : <span className="scout-row-verdict" style={{ color: knowledge(game, p) >= 95 ? 'var(--text-positive)' : undefined }}>
            {t('scouting.known', { n: Math.round(knowledge(game, p)) })}
          </span>}
      </span>
      <span className="scout-row-go" aria-hidden>›</span>
    </button>
  )
}

type RecSort = 'verdict' | 'new' | 'age' | 'fee'

/** The scout's verdicts, newest first: the list the owner asked for. `limit`
 *  shortens it and hands the rest to the Scouting page.
 *
 *  SORTED AND FILTERED (1.9.12). Forty verdicts in the order they were filed
 *  could not answer the question a manager actually has: who is the best
 *  lock on this list that I can pay for. The full page sorts by verdict,
 *  date, age or price, filters by shirt, and can hide every man whose asking
 *  price is over the budget. The short preview is left as it was. */
export function ScoutRecList({ onOpen, limit }: { onOpen: (id: number) => void; limit?: number }) {
  const game = useStore(s => s.game)!
  const go = useStore(s => s.go)
  const [all, setAll] = useState(false)
  const [sort, setSort] = useState<RecSort>('new')
  const [pos, setPos] = useState<Pos | 'any'>('any')
  const [afford, setAfford] = useState(false)
  const every = scoutList(game).filter(r => game.players[r.playerId]?.clubId !== game.userClubId)
  const budget = game.clubs[game.userClubId]?.budget ?? 0
  const fee = (r: ScoutRec) => { const p = game.players[r.playerId]; return p.clubId ? askingPrice(game, p) : 0 }
  let list = every
  if (!limit) {
    if (pos !== 'any') list = list.filter(r => { const p = game.players[r.playerId]; return p.pos === pos || p.alt.includes(pos) })
    if (afford) list = list.filter(r => fee(r) <= budget)
    if (sort !== 'new') {
      list = [...list].sort((a, b) =>
        sort === 'verdict' ? b.grade - a.grade || b.pot - a.pot
          : sort === 'age' ? game.players[a.playerId].age - game.players[b.playerId].age || b.grade - a.grade
            : fee(a) - fee(b) || b.grade - a.grade)
    }
  }
  const cap = limit ?? (all ? list.length : 12)
  return (
    <>
      <SectionTitle sub={t('transfers.scoutsReportSub', { g: game.staffPeople?.scout?.g ?? 'm' })}>{t('transfers.scoutsReport')}</SectionTitle>
      {!every.length && <div className="muted" style={{ padding: '4px 14px 10px', fontSize: '0.8125rem' }}>{t('scouting.empty')}</div>}
      {!limit && every.length > 3 && (
        <div className="scout-filters">
          <select className="inline-input" value={sort} aria-label={t('scouting.sortBy')} onChange={e => setSort(e.target.value as RecSort)}>
            <option value="new">{t('scouting.sortNew')}</option>
            <option value="verdict">{t('scouting.sortVerdict')}</option>
            <option value="age">{t('scouting.sortAge')}</option>
            <option value="fee">{t('scouting.sortFee')}</option>
          </select>
          <select className="inline-input" value={pos} aria-label={t('transfers.filterPosition')} onChange={e => setPos(e.target.value as Pos | 'any')}>
            <option value="any">{t('transfers.anyPosition')}</option>
            {POS_ORDER.map(p => <option key={p} value={p}>{posName(p)}</option>)}
          </select>
          <label className="check-row scout-afford">
            <input type="checkbox" checked={afford} onChange={e => setAfford(e.target.checked)} />
            <span>{t('scouting.affordable')}</span>
          </label>
        </div>
      )}
      {every.length > 0 && !list.length && <div className="muted" style={{ padding: '4px 14px 10px', fontSize: '0.8125rem' }}>{t('scouting.noneMatch')}</div>}
      {list.length > 0 && (
        <div className="scout-list">
          {list.slice(0, cap).map(r => <ScoutRow key={r.playerId} game={game} p={game.players[r.playerId]} rec={r} onOpen={() => onOpen(r.playerId)} />)}
        </div>
      )}
      {list.length > cap && (limit
        ? <button className="btn ghost block" style={{ marginTop: 6 }} onClick={() => go('scouting')}>{t('scouting.seeAll', { n: every.length })}</button>
        : <button className="btn ghost block" style={{ marginTop: 6 }} onClick={() => setAll(true)}>{t('scouting.showAll', { n: list.length })}</button>)}
    </>
  )
}

/** The full report on one man, as a sheet over the list. */
export function ScoutSheet({ playerId, onClose }: { playerId: number; onClose: () => void }) {
  const game = useStore(s => s.game)!
  const go = useStore(s => s.go)
  const toggleShortlist = useStore(s => s.toggleShortlist)
  const touch = useStore(s => s.touch)
  useStore(s => s.tick)
  const [msg, setMsg] = useState<string | null>(null)
  const [compare, setCompare] = useState(false)
  const p = game.players[playerId]
  if (!p) return null
  const rec = recFor(game, playerId)
  const club = p.clubId ? game.clubs[p.clubId] : null
  const ours = p.clubId === game.userClubId
  const listed = game.shortlist.includes(p.id)
  const watched = scoutWatchList(game).includes(p.id)
  const sure = rec ? surenessOf(rec) : null
  const best = bestInShirt(game, p)
  const hs = rec ? hindsight(game, rec) : null
  const cur = rec ? rec.cur : fuzzedCa(game, p)
  const pot = rec ? rec.pot : Math.max(cur, scoutPa(game, p))
  // THE NUMBERS ARE ONE TAP AWAY (1.9.12, tester: "it doesn't show their
  // attributes, have to click make an offer to go and see"). The second button
  // said "Player page" and opened the Profile tab; it now says Attributes and
  // opens them. Make an offer still goes to the deal.
  const toPlayer = (offer: boolean) => {
    offerFocus.id = offer ? p.id : null
    tabFocus.id = offer ? null : p.id
    tabFocus.tab = 'attrs'
    onClose()
    go('player', p.id)
  }
  return (
    <Veil onClose={onClose} boxClassName="modal scout-sheet" role="dialog" label={p.name}>
      <div className="grab" />
      <div className="scout-sheet-head">
        <PosBadge pos={p.pos} />
        <div style={{ minWidth: 0 }}>
          <div className="scout-sheet-name">{p.name}</div>
          <div className="meta">{posName(p.pos)} · {t('scouting.age', { n: p.age })} · {club ? club.name : t('transfers.freeAgent')}</div>
        </div>
      </div>
      {rec && (
        <div className="card scout-verdict">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span className="fact-label">{t('scouting.verdict')}</span>
            <span className="meta muted" style={{ fontSize: '0.6875rem' }}>{t('scouting.filed', { date: weekDate(rec.season, rec.week) })}</span>
          </div>
          <div className="scout-verdict-word" style={{ color: gradeColour(rec.grade) }}>{gradeWord(rec.grade)}</div>
          {/* his words without the opener: the verdict is the headline above it */}
          <div className="scout-verdict-quote">{`${t(rec.note.body_k)}${t(rec.note.growth_k)}`.trim()}</div>
          {/* how sure he was when he said it (1.9.12): a verdict from one
              badge after a month is not the same thing as one from three
              badges after nine */}
          {sure && <div className="meta" style={{ marginTop: 4 }}>{t(`scouting.sure_${sure}`)}</div>}
          {hs && <div className="meta" style={{ marginTop: 6, fontWeight: 700, color: hs === 'worse' ? 'var(--text-negative)' : hs === 'better' ? 'var(--text-positive)' : undefined }}>{t(`scouting.hs_${hs}`)}</div>}
        </div>
      )}
      <div className="card scout-facts">
        <div className="scout-fact"><span className="muted">{t('scouting.current')}</span><Stars ca={rec || shownCa(game, p) != null ? cur : null} /></div>
        <div className="scout-fact"><span className="muted">{t('scouting.potential')}</span><Stars ca={pot} /></div>
        {!ours && <div className="scout-fact"><span className="muted">{t('scouting.value')}</span><b>{t('scouting.about', { fee: fmtMoney(seenValue(game, p)) })}</b></div>}
        <div className="scout-fact"><span className="muted">{t('scouting.wage')}</span><b>{fmtWage(p.wage)}{t('common.perWeek')}</b></div>
        <div className="meta muted" style={{ fontSize: '0.6875rem', marginTop: 4 }}>{t(rec ? 'scouting.starsNote' : 'scouting.starsFile')}</div>
      </div>
      {!ours && <div style={{ margin: '0 0 0' }}><ScoutReportCard game={game} p={p} onMsg={setMsg} /></div>}
      {/* THE NUMBERS, ON THE SHEET (1.9.12, tester: "when you click on scouted
          players it doesn't show their attributes"). As the file reads them:
          a figure where it is exact, a range where it is not. And beside
          them, on a tap, your best man in the same shirt. */}
      {knowledge(game, p) >= 35 && (
        <div className="card scout-attrs">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="fact-label">{t('player.attributes')}</span>
            {best && (
              <button className={`btn tiny ${compare ? 'gold' : 'ghost'}`} onClick={() => setCompare(!compare)} aria-pressed={compare}>
                {t(compare ? 'scouting.comparing' : 'scouting.compare', { name: best.name.split(' ').slice(-1)[0] })}
              </button>
            )}
          </div>
          <div className="meta muted" style={{ fontSize: '0.6875rem', margin: '2px 0 6px' }}>{t('scouting.attrsNote')}</div>
          <AttrGrid game={game} p={p} rival={compare ? best : null} />
        </div>
      )}
      {watched && <div className="meta" style={{ margin: '6px 14px', fontWeight: 700 }}><Glyph name="scout" /> {t(watchWeeks(game, p) === 1 ? 'scouting.watchingOne' : 'scouting.watching', { n: watchWeeks(game, p) })}</div>}
      {msg && <div className="meta" style={{ margin: '6px 14px', color: 'var(--gold)', fontWeight: 700 }}>{msg}</div>}
      <div className="btn-row" style={{ margin: '12px 14px 4px' }}>
        {!ours && (
          <button className={`btn ${listed ? '' : 'ghost'}`} onClick={() => toggleShortlist(p.id)}>
            {t(listed ? 'scouting.unlist' : 'scouting.shortlist')}
          </button>
        )}
        {!ours && <button className="btn gold" onClick={() => toPlayer(true)}>{t('scouting.makeOffer')}</button>}
      </div>
      <div className="btn-row" style={{ margin: '4px 14px 4px' }}>
        {/* THE SCOUT IN PERSON (1.9.12): the shortlist reads a man as far as a
            proper report; the full file, exact numbers and character, is the
            chief scout's own work, a man at a time (scout.ts) */}
        {!ours && (watched || knowledge(game, p) < 100) && (
          <button className={`btn ${watched ? '' : 'ghost'}`} onClick={() => { const r = toggleScoutWatch(game, p.id); setMsg(t(r.k, r.v)); touch() }}>
            {t(watched ? 'scouting.watchStop' : 'scouting.watch')}
          </button>
        )}
        <button className="btn" onClick={() => toPlayer(false)}>{t('scouting.toPlayer')}</button>
      </div>
      <div className="btn-row" style={{ margin: '4px 14px 4px' }}>
        <button className="btn ghost" onClick={onClose}>{t('scouting.close')}</button>
      </div>
    </Veil>
  )
}

/** The men on the shortlist, as the same rows. */
function ShortlistRows({ onOpen }: { onOpen: (id: number) => void }) {
  const game = useStore(s => s.game)!
  const men = game.shortlist.map(id => game.players[id]).filter(Boolean)
  if (!men.length) return null
  return (
    <>
      <SectionTitle sub={t('transfers.shortlistSub')}>{t('transfers.shortlist')}</SectionTitle>
      <div className="scout-list">
        {men.map(p => <ScoutRow key={p.id} game={game} p={p} rec={null} onOpen={() => onOpen(p.id)} />)}
      </div>
    </>
  )
}

/** The men under the chief scout's own eye (1.9.12). */
function WatchRows({ onOpen }: { onOpen: (id: number) => void }) {
  const game = useStore(s => s.game)!
  const slots = watchSlots(game)
  const men = scoutWatchList(game).map(id => game.players[id]).filter(Boolean)
  return (
    <>
      <SectionTitle sub={slots > 0 ? t('scouting.watchSub', { n: men.length, slots }) : t('transfers.noChiefScout')}>{t('scouting.watchTitle')}</SectionTitle>
      {!men.length && <div className="muted" style={{ padding: '4px 14px 10px', fontSize: '0.8125rem' }}>{t('scouting.watchEmpty')}</div>}
      {men.length > 0 && (
        <div className="scout-list">
          {men.map(p => <ScoutRow key={p.id} game={game} p={p} rec={null} onOpen={() => onOpen(p.id)} />)}
        </div>
      )}
    </>
  )
}

/** Where the network looks every week. */
function ScoutAssignment() {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  return (
    <div className="card">
      <div className="fact-label">{t('transfers.scoutingAssignment')}</div>
      <div className="meta" style={{ marginBottom: 6 }}>
        {t('transfers.assignmentNote', { unassigned: game.scoutFocus ? '' : t('transfers.unassigned') })}
      </div>
      <div className="chips" style={{ padding: 0 }}>
        {scoutLeagues(game).map(c => (
          <button key={c.id} className="chip" onClick={() => { game.scoutFocus = game.scoutFocus === c.id ? null : c.id; touch() }}
            style={game.scoutFocus === c.id ? { borderColor: 'var(--gold)', color: 'var(--info)', fontWeight: 700 } : undefined}>
            {game.scoutFocus === c.id && <><Glyph name="scout" /> </>}{compLabel(c.short)}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Commissioned scouting (8-batch feedback): send the chief scout out for 3, 6
 * or 9 months and read what he brings back. The report is deliberately mixed -
 * his verdict on each man is the point, not a list of ready-made signings.
 * Its names now land in the verdicts list above, one row each.
 */
function ScoutCommission() {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const [pos, setPos] = useState<Pos | 'any'>('any')
  const [maxAge, setMaxAge] = useState(0)
  const [maxFee, setMaxFee] = useState(0)
  const [aim, setAim] = useState<BriefAim | 'any'>('any')
  const [msg, setMsg] = useState('')
  const abs = game.season * 100 + game.week
  const record = scoutRecord(game)
  const budget = game.clubs[game.userClubId]?.budget ?? 0
  const fees = [...new Set([250_000, 500_000, 1_000_000, 2_000_000, budget].filter(f => f > 0))].sort((a, b) => a - b)
  const man = game.staffPeople?.scout
  const tier = game.staff.scout ?? 0
  const out = game.commission
  const weeksLeft = out ? Math.max(1, weeksBetween100(out.done, abs)) : 0
  return (
    <>
      <SectionTitle sub={man ? t('transfers.scoutBadge', { name: man.name, badge: badgeLabel(tier).toLowerCase() }) : t('transfers.noChiefScout')}>{t('transfers.commissionedSearch')}</SectionTitle>
      <div className="card">
        {!man && (
          <div className="meta">
            {t('transfers.nobodyToSend')}
          </div>
        )}
        {man && out && (
          <div className="meta">
            <Glyph name="scout" /> <b>{t('transfers.onTheRoad', { name: man.name })}</b>
            {t('transfers.briefLine', {
              months: out.months,
              pos: out.pos !== 'any' ? t('transfers.briefForPos', { pos: posName(out.pos).toLowerCase() }) : t('transfers.briefForAnyone'),
              league: out.leagueId ? t('transfers.briefInLeague', { league: compLabel(game.comps[out.leagueId]?.short) ?? t('transfers.focusLeague') }) : '',
            })}
            {t(weeksLeft === 1 ? 'transfers.reportsBackOne' : 'transfers.reportsBack', { n: weeksLeft, g: man.g ?? 'm' })}
          </div>
        )}
        {man && !out && (
          <>
            <div className="meta" style={{ marginBottom: 6 }}>
              {t('transfers.longerTrip', {
                g: game.staffPeople?.scout?.g ?? 'm',
                where: game.scoutFocus
                  ? t('transfers.watchesLeague', { league: compLabel(game.comps[game.scoutFocus]?.short) ?? t('transfers.focusLeague') })
                  : t('transfers.watchesWorld'),
              })}
            </div>
            {/* THE BRIEF ON ONE ROW, THE THREE TRIPS ON THE NEXT (owner, 1.5.8:
                "all three buttons should be below on the same line"). Each
                trip takes a third of the row, so they compare at a glance. */}
            <select className="inline-input" style={{ margin: '0 0 8px', width: '100%' }} value={pos} aria-label={t('transfers.filterPosition')}
              onChange={e => setPos(e.target.value as Pos | 'any')}>
              <option value="any">{t('transfers.anyPosition')}</option>
              {POS_ORDER.map(p => <option key={p} value={p}>{posName(p)}</option>)}
            </select>
            {/* THE SPECIFICATION (1.9.12): what the manager actually wants,
                which a position and a league could not say */}
            <div className="scout-spec">
              <select className="inline-input" value={aim} aria-label={t('scouting.specAim')} onChange={e => setAim(e.target.value as BriefAim | 'any')}>
                <option value="any">{t('scouting.aimAny')}</option>
                <option value="now">{t('scouting.aimNow')}</option>
                <option value="future">{t('scouting.aimFuture')}</option>
              </select>
              <select className="inline-input" value={maxAge} aria-label={t('scouting.specAge')} onChange={e => setMaxAge(Number(e.target.value))}>
                <option value={0}>{t('scouting.anyAge')}</option>
                {[21, 23, 25, 28].map(n => <option key={n} value={n}>{t('scouting.ageUpTo', { n })}</option>)}
              </select>
              <select className="inline-input" value={maxFee} aria-label={t('scouting.specFee')} onChange={e => setMaxFee(Number(e.target.value))}>
                <option value={0}>{t('scouting.anyFee')}</option>
                {fees.map(f => <option key={f} value={f}>{t('scouting.feeUpTo', { fee: fmtMoney(f) })}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {([3, 6, 9] as SearchMonths[]).map(m => (
                <button key={m} className="btn gold" style={{ flex: '1 1 0', minWidth: 0, padding: '9px 4px', fontSize: '0.75rem', lineHeight: 1.25 }}
                  onClick={() => { setMsg(commissionScout(game, pos, m, { maxAge: maxAge || undefined, maxFee: maxFee || undefined, aim: aim === 'any' ? undefined : aim })); touch() }}>
                  {t('transfers.months', { n: m })}<br />
                  <span style={{ fontSize: '0.6875rem', fontWeight: 600 }}>{fmtMoney(searchFee(m, Math.max(1, tier)))}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {msg && <div className="meta" style={{ marginTop: 6, color: 'var(--gold)', fontWeight: 700 }}>{msg}</div>}
        {/* HIS RECORD (1.9.12): of the calls that can be judged, how many held */}
        {man && <div className="meta muted" style={{ marginTop: 8, fontSize: '0.75rem' }}>
          {record.judged ? t('scouting.record', { held: record.held, judged: record.judged }) : t('scouting.recordNone')}
        </div>}
      </div>
    </>
  )
}

/** Everything the department has ever written home, in one pile.
 *
 *  The postcards and reports land in the inbox and then age off its five-day
 *  shelf, which left the manager asking a fair question (user: "when you hit
 *  scout on a player ... where do those reports go? They should appear in news
 *  and a section called scout reports"). They still arrive as news; this is the
 *  filing cabinet copy, read straight off the same list by its scout tag, so
 *  nothing here can drift from what the inbox said. */
function ScoutReports() {
  const game = useStore(s => s.game)!
  const [openId, setOpenId] = useState<number | null>(null)
  const reports = [...game.news].filter(n => n.tag === 'scout').sort((a, b) => b.id - a.id).slice(0, 10)
  if (!reports.length) return null
  return (
    <>
      <SectionTitle sub={t('transfers.scoutReportsSub')}>{t('transfers.scoutReports')}</SectionTitle>
      <div className="card" style={{ padding: '2px 10px' }}>
        {reports.map((n, i) => (
          <div key={n.id} style={{ padding: '6px 0', borderTop: i ? '1px solid var(--border)' : undefined }}
            {...rowNav(() => setOpenId(openId === n.id ? null : n.id))} aria-expanded={openId === n.id}>
            <div className="meta" style={{ fontSize: '0.6875rem' }}>{weekDate(n.season, n.week)}</div>
            <div style={{ fontWeight: 700, fontSize: '0.8125rem', lineHeight: 1.3 }}>{newsSubject(n)}</div>
            {openId === n.id && (
              <div className="meta" style={{ whiteSpace: 'pre-line', fontSize: '0.75rem', marginTop: 3 }}>{plainNews(newsBody(n))}</div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

/** The whole of scouting: the verdicts, the shortlist, the brief, the
 *  network's assignment and the filed reports. The Transfer Centre's Scouting
 *  tab shows a short preview of the verdicts and the rest of the same body. */
export function ScoutingBody({ initial, preview }: { initial?: number; preview?: boolean }) {
  const [open, setOpen] = useState<number | null>(initial ?? null)
  useEffect(() => { if (initial != null) setOpen(initial) }, [initial])
  return (
    <>
      <ScoutRecList onOpen={setOpen} limit={preview ? 3 : undefined} />
      {!preview && <WatchRows onOpen={setOpen} />}
      <ShortlistRows onOpen={setOpen} />
      <ScoutCommission />
      <ScoutAssignment />
      <ScoutReports />
      {open != null && <ScoutSheet playerId={open} onClose={() => setOpen(null)} />}
    </>
  )
}

export default function Scouting({ initial }: { initial?: number }) {
  useStore(s => s.tick)
  return (
    <>
      <ScoutingBody initial={initial} />
      <div className="spacer" />
    </>
  )
}
