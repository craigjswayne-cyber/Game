import { useMemo, useState } from 'react'
import { useStore } from '../../store'
import { POS_ORDER, fmtMoney, fmtWage, type Player } from '../../game/model'
import { starPlayerIds } from '../../game/analysis'
import { SQUAD_LIMIT, seniorsOf } from '../../game/transferRules'
import { AvailTag, condColour, LoanKey, LoanName, Mark, Nat, PosBadge, StickyControls } from '../components'
import { STATUSES, clubMatchesPlayed, ledgerRow, statusOf, type SquadStatus } from '../../game/gametime'
import SelectionPane from './Selection'
import { t } from '../../game/i18n'
import { condBand } from '../../game/condition'
import { Glyph } from '../glyphs'
import { rowNavTr } from '../rowNav'
import { DataTable, type Col, type SortState } from '../DataTable'

// Handheld squad layout: the team sheet first, then the tables - Pkd chip,
// fitness ring, starred names, morale arrows, Av R and Value.

type View = 'selection' | 'general' | 'stats' | 'gametime' | 'contracts'
type SortKey = 'pos' | 'name' | 'age' | 'ca' | 'form' | 'cond' | 'value' | 'apps' | 'tries' | 'points' | 'avr' | 'pkd' | 'wage' | 'until'

/**
 * Fitness, as a dial rather than as a colour.
 *
 * Pass 9 of the release audit went looking for the thing nobody had checked and
 * found it here. Every other state indicator in this interface already carries
 * a second channel - MoraleArrow has its glyph, FormPill prints the number, the
 * ability delta has an arrow - but this ring was three hues and nothing else,
 * with a `title` tooltip that a phone will never show. Simulating the three
 * common dichromacies on the real tokens (scripts/colourblind.ts) put gold and
 * red 61 apart under deuteranopia, which at eleven pixels is the same dot: a
 * man carrying a knock and a man who cannot play looked identical to about one
 * reader in twelve.
 *
 * So the ARC now carries the number and the colour only agrees with it. A full
 * ring is a fit man and a quarter ring is not, in any colour vision, in
 * greyscale, and through a bad phone screen in sunlight.
 */
function FitRing({ v }: { v: number }) {
  const pct = Math.max(0, Math.min(100, v))
  const c = condColour(v)
  const band = condBand(v)
  const state = t(band === 'fit' ? 'squad.fitFully' : band === 'knock' ? 'squad.fitKnock' : 'squad.fitUnfit')
  return (
    <span role="img" aria-label={t('squad.fitLabel', { state, pct: Math.round(v) })}
      title={t('squad.fitTitle', { pct: Math.round(v) })} style={{
        display: 'inline-block', width: 11, height: 11, borderRadius: '50%',
        verticalAlign: -1,
        background: `conic-gradient(${c} ${(pct * 3.6).toFixed(0)}deg, var(--surface-3) 0)`,
        boxShadow: 'inset 0 0 0 1px var(--border-strong)',
      }} />
  )
}

function MoraleArrow({ v }: { v: number }) {
  if (v >= 7) return <span style={{ color: 'var(--text-positive)', fontSize: '0.875rem' }}>▲</span>
  if (v >= 4.5) return <span style={{ color: 'var(--gold)', fontSize: '0.875rem' }}>►</span>
  return <span style={{ color: 'var(--danger)', fontSize: '0.875rem' }}>▼</span>
}

export default function Squad() {
  const game = useStore(s => s.game)!
  const go = useStore(s => s.go)
  const touch = useStore(s => s.touch)
  const [view, setView] = useState<View>('selection')
  const [sort, setSort] = useState<SortKey>('pkd')
  const [desc, setDesc] = useState(false)
  const [group, setGroup] = useState<'all' | 'aca'>('all')
  const [avail, setAvail] = useState<'any' | 'fit' | 'out'>('any')

  const club = game.clubs[game.userClubId]
  const stars = useMemo(() => starPlayerIds(game, club.id), [game, club.id, game.week])
  // the ledger's denominator, computed once for the whole table (F18)
  const played = useMemo(() => clubMatchesPlayed(game, club.id), [game, club.id, game.week])
  const pkdOf = (p: Player) => {
    const i = club.tactic.lineup.indexOf(p.id)
    return i < 0 ? 99 : i
  }

  const players = useMemo(() => {
    let ps = club.players.map(id => game.players[id]).filter(Boolean)
    ps = group === 'aca' ? ps.filter(p => p.acad) : ps.filter(p => !p.acad)
    const out = (p: Player) => !!p.injury || p.bans > 0 || !!p.natSquad || !!p.onLoan
    if (avail === 'fit') ps = ps.filter(p => !out(p))
    if (avail === 'out') ps = ps.filter(out)
    const dir = desc ? -1 : 1
    const posIdx = (p: Player) => POS_ORDER.indexOf(p.pos)
    const avr = (p: Player) => (p.stats.apps ? p.stats.ratingSum / p.stats.apps : 0)
    ps.sort((a, b) => {
      switch (sort) {
        case 'pkd': return (pkdOf(a) - pkdOf(b) || posIdx(a) - posIdx(b)) * dir
        case 'pos': return (posIdx(a) - posIdx(b) || b.ca - a.ca) * dir
        case 'name': return a.name.localeCompare(b.name) * dir
        case 'age': return (a.age - b.age) * dir
        case 'ca': return (b.ca - a.ca) * dir
        case 'form': return (b.form - a.form) * dir
        case 'cond': return (b.cond - a.cond) * dir
        case 'value': return (b.value - a.value) * dir
        case 'apps': return (b.stats.apps - a.stats.apps) * dir
        case 'tries': return (b.stats.tries - a.stats.tries) * dir
        case 'points': return (b.stats.points - a.stats.points) * dir
        case 'avr': return (avr(b) - avr(a)) * dir
        case 'wage': return (b.wage - a.wage) * dir
        // soonest expiry first, because the men running out are the work
        case 'until': return (a.contractEnds - b.contractEnds || b.ca - a.ca) * dir
      }
    })
    return ps
  }, [club.players, game.players, sort, desc, game.week, club.tactic.lineup, group, avail, view, game, club, played])

  const sortState: SortState = {
    key: sort, desc,
    onSort: k => { if (sort === k) setDesc(!desc); else { setSort(k as SortKey); setDesc(false) } },
  }

  // ONE LINE A MAN (owner, 1.8.9: "Messy names over two lines"). The name is
  // the only part that gives way, to an ellipsis; the fitness ring, (C), the
  // star and an availability tag always show. A loan man's name is in the
  // loan colour instead of a LOAN word after it.
  const nameCol: Col<Player> = {
    id: 'name', head: t('squad.colName'), className: 'name', sort: 'name', ascFirst: true,
    cell: p => (
      <span className="nm-line">
        <FitRing v={p.cond} />
        {/* red while he is away with his country (user: "if a player is on
            International duty they should have a red colour for their name") -
            one glance down the list shows who the Test window has taken */}
        <LoanName p={p} className="nm" style={p.natSquad ? { color: 'var(--danger)', fontWeight: 700 } : undefined} />
        {club.captain === p.id && <b style={{ color: 'var(--gold)' }}>(C)</b>}
        {stars.has(p.id) && <Mark name="star" color="var(--gold)" />}
        <AvailTag p={p} g={game} />
      </span>
    ),
  }
  const avrOf = (p: Player) => (p.stats.apps ? p.stats.ratingSum / p.stats.apps : 0)
  // the ledger (F18), once a man per render however many columns read it
  const ledger = new Map<number, ReturnType<typeof ledgerRow>>()
  const ledgerOf = (p: Player) => {
    let r = ledger.get(p.id)
    if (!r) { r = ledgerRow(game, club, p, played); ledger.set(p.id, r) }
    return r
  }
  // a coloured light and the word, not a face (owner, 27 Sep 2026: icons, not
  // emoji); the gap is in the tooltip, and the two columns beside it already
  // give both its halves
  const MOOD: Record<string, [string, string]> = {
    happy: ['squad.moodHappy', 'var(--positive)'], content: ['squad.moodContent', 'var(--positive)'],
    restless: ['squad.moodRestless', 'var(--gold)'], unhappy: ['squad.moodUnhappy', 'var(--danger)'],
  }
  const statusKey = (st: string, suffix = '') => `squad.status${st[0].toUpperCase()}${st.slice(1)}${suffix}`

  // ---- why this table is told its column widths ----
  // .tblwrap sets overflow-x: auto, and CSS computes the other axis to auto
  // with it, so the wrapper became the table's vertical scrollport and the
  // sticky heading parked itself among the players (user: "the column headers
  // are amongst the players names"). Fixed widths plus table-layout: fixed
  // make the table exactly as wide as the screen, the name column takes what
  // is left and ellipsises, and .fitwrap turns the wrapper's scrolling off.
  const COLS: Record<Exclude<View, 'selection'>, Col<Player>[]> = {
    // Mor 34 and Value 64 (UI QA, 1.8.0): at 26 the MOR heading was cut to
    // "MO", and a value carrying its trend arrow ran off the glass
    general: [
      nameCol,
      { id: 'pos', head: t('squad.colPos'), width: 36, sort: 'pos', ascFirst: true, cell: p => <PosBadge pos={p.pos} /> },
      { id: 'age', head: t('squad.colAge'), width: 32, align: 'right', sort: 'age', ascFirst: true, cell: p => p.age },
      { id: 'nat', head: t('squad.colNat'), width: 28, align: 'center', cell: p => <Nat code={p.nat} /> },
      { id: 'mor', head: t('squad.colMor'), width: 34, align: 'center', cell: p => <MoraleArrow v={p.morale} /> },
      // JUST THE RATING: the ability-trend arrow lives on the value, which is
      // the number that actually moves with ability (user: "how have these
      // players average rating gone up when they haven't played")
      { id: 'avr', head: t('squad.colAvR'), width: 42, align: 'right', sort: 'avr', cell: p => { const a = avrOf(p); return a ? a.toFixed(2) : '-' } },
      {
        id: 'value', head: t('squad.colValue'), width: 64, align: 'right', sort: 'value',
        td: () => ({ style: { fontWeight: 700 } }),
        // the arrow FOLLOWS the figure (owner, v1.1.18) and has a slot on
        // every row, empty or not, so the figures line up (owner, 1.9.4)
        cell: p => (<>
          {fmtMoney(p.value)}
          {(p.ca0 != null && p.ca !== p.ca0) ? (
            <span className="val-trend" style={{ color: p.ca > p.ca0 ? 'var(--text-positive)' : 'var(--danger)' }}
              title={t(p.ca > p.ca0 ? 'squad.abilityUp' : 'squad.abilityDown')}>
              {p.ca > p.ca0 ? '▲' : '▼'}
            </span>
          ) : <span className="val-trend" aria-hidden />}
        </>),
      },
    ],
    stats: [
      nameCol,
      { id: 'apps', head: t('squad.colAp'), width: 34, align: 'right', sort: 'apps', cell: p => p.stats.apps },
      { id: 'tries', head: t('squad.colT'), width: 30, align: 'right', sort: 'tries', cell: p => p.stats.tries },
      { id: 'points', head: t('squad.colPts'), width: 38, align: 'right', sort: 'points', td: () => ({ style: { fontWeight: 700 } }), cell: p => p.stats.points },
      { id: 'yc', head: t('squad.colYC'), width: 32, align: 'right', cell: p => p.stats.yc },
      { id: 'rc', head: t('squad.colRC'), width: 32, align: 'right', cell: p => p.stats.rc },
      { id: 'motm', head: t('squad.colMotM'), width: 54, align: 'right', cell: p => p.stats.motm },
    ],
    // Share, not pixels, for the two wide columns (owner, round 2: "NAM HE WAS
    // TOLD"): the name keeps about a third of whatever width there is
    gametime: [
      nameCol,
      {
        id: 'told', head: t('squad.colToldHim'), width: '29%',
        // swallows the row's tap so choosing a status does not open the
        // player; the select inside is the control
        td: () => ({ onClick: e => e.stopPropagation() }),
        // the box you see is the span's, drawn small; the select inside it
        // keeps the 44px a thumb needs (owner, round 183)
        cell: p => (
          <span className="gt-pick">
            <select className="inline-input gt-sel" value={statusOf(game, club, p)} aria-label={`${p.name}: ${t('squad.colStatus')}`}
              onChange={e => { p.status = e.target.value as SquadStatus; touch() }}>
              {/* the engine keeps the English name on the def; the option
                  shows the translated one, keyed by id */}
              {STATUSES.map(st => <option key={st.id} value={st.id}>{t(statusKey(st.id))}</option>)}
            </select>
          </span>
        ),
      },
      { id: 'apps', head: t('squad.colAp'), width: 30, align: 'right', sort: 'apps', td: () => ({ style: { fontWeight: 700 } }), cell: p => ledgerOf(p).actual },
      // 50, NOT 34 (owner, 1.9.5): the Afrikaans VERWAG and Italian ATTESE are
      // the words, so the column fits them rather than the words being cut
      { id: 'due', head: t('squad.colDue'), width: 50, align: 'right', td: p => ({ style: { color: ledgerOf(p).gap < -2 ? 'var(--danger)' : undefined } }), cell: p => ledgerOf(p).expected },
      {
        id: 'mood', head: t('squad.colMood'), width: '21%', className: 'gt-mood',
        td: p => { const r = ledgerOf(p); return { title: `${r.gap >= 0 ? `+${r.gap}` : r.gap} · ${t(statusKey(statusOf(game, club, p), 'Desc'))}` } },
        cell: p => { const [k, col] = MOOD[ledgerOf(p).mood]; return <><span className="status-dot" style={{ background: col }} /> {t(k)}</> },
      },
    ],
    contracts: [
      nameCol,
      { id: 'pos', head: t('squad.colPos'), width: 36, sort: 'pos', ascFirst: true, cell: p => <PosBadge pos={p.pos} /> },
      { id: 'age', head: t('squad.colAge'), width: 30, align: 'right', sort: 'age', ascFirst: true, cell: p => p.age },
      // may take two lines: WAGE /WK was clipped to WAGE /WI (owner, 1.9.4)
      { id: 'wage', head: t('squad.colWage'), width: 62, align: 'right', sort: 'wage', wrapHead: true, cell: p => fmtWage(p.wage) },
      {
        id: 'until', head: t('squad.colUntil'), width: 44, align: 'right', sort: 'until', ascFirst: true,
        td: p => ({ style: { fontWeight: 700, color: p.contractEnds <= game.season ? 'var(--danger)' : p.contractEnds === game.season + 1 ? 'var(--gold)' : undefined } }),
        cell: p => 2026 + p.contractEnds,
      },
      // A TRAFFIC LIGHT (owner, 27 Sep 2026: "red out of contract, amber
      // ending soon, green all good")
      {
        id: 'status', head: t('squad.colStatus'), width: 58, align: 'center',
        cell: p => {
          const [c, k] = p.contractEnds <= game.season ? ['var(--danger)', 'squad.dealExpires']
            : p.contractEnds === game.season + 1 || (p.wantsDeal ?? 0) > 0 ? ['var(--gold)', (p.wantsDeal ?? 0) > 0 ? 'squad.wantsTerms' : 'squad.endsSoon']
            : ['var(--text-positive)', 'squad.underContract']
          return <span className="status-dot" style={{ background: c }} title={t(k)} aria-label={t(k)} />
        },
      },
    ],
  }

  return (
    <>
      {/* the tabs and the chips ride along with the scroll: a 38-man table is
          four screenfuls, and the controls used to sail off the top of it */}
      <StickyControls>
      <div className="tab-bar">
        {/* THE PICK COMES FIRST. This tab spent one era as "Selection" (a
            read-only table that shared its name with the real picker on
            another screen) and one as "Overview" (the same table,
            disambiguated). Both eras made the manager cross the app to
            actually pick a side (user: "Selection should be the team section
            and replace overview"). Now tapping Team lands on the team sheet
            itself - the pane from screens/Selection.tsx - and the old
            overview table is gone: everything it showed lives on the pane or
            on General Info. */}
        {/* Depth has moved to the Team Report (owner, round 4), where the
            other squad-wide reading lives */}
        {(['selection', 'general', 'stats', 'gametime', 'contracts'] as View[]).map(v => (
          <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>
            {t(v === 'selection' ? 'squad.tabSelection' : v === 'general' ? 'squad.tabGeneral'
              : v === 'stats' ? 'squad.tabStats' : v === 'gametime' ? 'squad.tabGameTime' : 'squad.tabContracts')}
          </button>
        ))}
        {/* The squad summary used to sit here, sharing the tab row's spare
            space. On the phone it did not have any: the four tabs plus the
            Matchday button left it clipped mid-word ("58 hom...") every time.
            A line you cannot finish reading is worse than no line, and every
            number in it already has a home - the count is the table's own
            length, and the wage bill and homegrown count are on Finances and
            General Info. */}
      </div>
      {/* THE 46, ON SHOW (owner, 1.9.6: "First team: 46/46"). A French manager
          counted 45 in his first team and was told the squad was full: a man
          sent down still held a senior place, and no screen said how many were
          taken. This is the same count every signing reads (seniorsOf). */}
      {(() => {
        const club = game.clubs[game.userClubId]
        if (!club) return null
        const n = seniorsOf(game, club)
        return (
          <div className="meta" data-senior-places={n} style={{ padding: '6px 12px 0', fontWeight: 600, color: n >= SQUAD_LIMIT ? 'var(--gold)' : undefined }}>
            {t('squad.seniorPlaces', { n, max: SQUAD_LIMIT })}
          </div>
        )
      })()}
      {/* the chips filter the tables; the team sheet pane has no use for them */}
      {view !== 'selection' && <div className="filter-row">
        {/* Forwards and Backs are gone (user: "you can remove forwards and backs
            as a sort here"): the list is ordered by shirt number, so 1 to 8 are
            already the forwards and 9 to 15 the backs. The chips filtered a
            list that had grouped itself. */}
        {([['all', 'squad.firstTeam'], ['aca', 'squad.academy']] as const).map(([k, label]) => (
          <button key={k} className="preset-chip" style={group === k ? undefined : { background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
            onClick={() => setGroup(k)}>{t(label)}</button>
        ))}
        {/* the academy has its own A League now, so the filter hands off to it
            rather than pretending 27 scholars are a selection problem */}
        {group === 'aca' && (
          <button className="preset-chip" onClick={() => go('academy')}>{t('squad.aLeague')}</button>
        )}
        {/* U23 is gone at the user's request, and so is the search box: on a
            portrait phone the two words "Available" and "Unavailable" plus an
            input took two rows for filters that a squad of 42 barely needs, and
            Find A Player already exists as a whole screen on the rail. The
            availability filter is now the two icons it always was really
            (user: "get unavailable and available as just ✅🚑 icons and on the
            same line as first team and academy"). */}
        {/* the two icons carry no words in any language; only Everyone and the
            tooltips need the dictionary */}
        {([['any', 'squad.everyone', 'squad.whyEveryone'], ['fit', 'check', 'squad.whyFit'], ['out', 'medical', 'squad.whyOut']] as const).map(([k, label, why]) => (
          <button key={k} className="preset-chip" title={t(why)} aria-label={t(why)}
            style={avail === k ? undefined : { background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
            onClick={() => setAvail(k)}>{label.includes('.') ? t(label) : <Glyph name={label} />}</button>
        ))}
        {/* The "Needs a word" shortlist chip is gone (owner, round 2): the ledger
            lists the whole squad and the Mood column says who is unhappy. */}
      </div>}
      </StickyControls>

      {view === 'selection' && <SelectionPane />}
      {/* ---- why this table is told its column widths ----
          .tblwrap sets overflow-x: auto, and CSS computes the other axis to
          auto with it, so the wrapper became the table's vertical scrollport.
          It never scrolls vertically, so `position: sticky; top: 210px` on the
          heading row did not stick to anything - it simply pushed the heading
          210px DOWN from the wrapper's top and parked it among the players
          (user: "weird bug on select where the column headers are amongst the
          players names so not at the top - same for stats, game time,
          contracts"). The same wrapper was why the Fit column's "100%" sat past
          the right edge: the table was wider than the phone and the overflow
          hid it rather than fixing it.

          Both die together. A colgroup plus table-layout: fixed makes the
          table exactly as wide as the screen, with the name column taking
          whatever is left and ellipsising, which means the wrapper does not
          need to scroll and .fitwrap turns the scrollport off. Then .content is
          the scrollport again and the heading sticks under the controls where
          it belongs. */}
      {/* a filter nobody matches: the message alone. An empty table shrank to
          its fixed columns and stacked NAME a letter a line (owner, round 7) */}
      {view !== 'selection' && players.length === 0 && (
        <div className="muted" style={{ padding: '12px 16px' }}>{t('squad.emptyFiltered')}</div>
      )}
      {view !== 'selection' && players.length > 0 && (
        <div className="tblwrap fitwrap">
          <DataTable<Player> cols={COLS[view]} rows={players} rowKey={p => p.id}
            rowProps={p => rowNavTr(() => go('player', p.id))}
            className={`zebra fit sq-${view}`} headClass={view === 'gametime' ? 'gt-head' : undefined}
            focusKey="sq" sort={sortState} />
        </div>
      )}
      {view !== 'selection' && <LoanKey show={players.some(p => !!p.loanFrom)} />}
      <div className="spacer" />
    </>
  )
}

