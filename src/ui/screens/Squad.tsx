import { useMemo, useState } from 'react'
import { useStore } from '../../store'
import { POS_ORDER, fmtMoney, fmtWage, type Player } from '../../game/model'
import { starPlayerIds } from '../../game/analysis'
import { AvailTag, Nat, PosBadge, Stars, StickyControls } from '../components'
import { STATUSES, STATUS_BY_ID, clubMatchesPlayed, ledgerRow, statusOf, type SquadStatus } from '../../game/gametime'

// FM Mobile squad layout: Pkd chip, fitness ring, starred names,
// morale arrows, Av R and Value - with a View switcher.

type View = 'selection' | 'general' | 'stats' | 'gametime' | 'contracts'
type SortKey = 'pos' | 'name' | 'age' | 'ca' | 'form' | 'cond' | 'value' | 'apps' | 'tries' | 'points' | 'avr' | 'pkd' | 'wage' | 'until'

function FitRing({ v }: { v: number }) {
  const c = v >= 85 ? '#2f7d4f' : v >= 68 ? '#c9a227' : '#a12f2f'
  return (
    <span title={`${Math.round(v)}% fit`} style={{
      display: 'inline-block', width: 11, height: 11, borderRadius: '50%',
      border: `2.5px solid ${c}`, verticalAlign: -1,
    }} />
  )
}

function MoraleArrow({ v }: { v: number }) {
  if (v >= 7) return <span style={{ color: '#2f7d4f', fontSize: 14 }}>▲</span>
  if (v >= 4.5) return <span style={{ color: '#c9a227', fontSize: 14 }}>►</span>
  return <span style={{ color: '#a12f2f', fontSize: 14 }}>▼</span>
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
  /** Game Time opens on the men who are out of line rather than on all 42.
   *
   *  The page's job is "who is unhappy about minutes", and the answer is
   *  usually three or four names. Listing the whole squad buried them four
   *  screenfuls deep (user: "game time feels more packed then other pages in
   *  squad. make it clearer and all on one page - not scroll"), so the default
   *  view is the shortlist and Everyone is one tap away. */
  const [gtAll, setGtAll] = useState(false)

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
    if (view === 'gametime' && !gtAll) {
      ps = ps.filter(p => {
        const row = ledgerRow(game, club, p, played)
        return row.gap <= -2 || row.mood === 'restless' || row.mood === 'unhappy'
      })
    }
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
  }, [club.players, game.players, sort, desc, game.week, club.tactic.lineup, group, avail, view, gtAll, game, club, played])

  const Th = ({ k, children, right }: { k: SortKey; children: React.ReactNode; right?: boolean }) => (
    <th className={`th-sort${sort === k ? ' active' : ''}${right ? ' num' : ''}`}
      onClick={() => (sort === k ? setDesc(!desc) : (setSort(k), setDesc(false)))}>
      {children}{sort === k ? (desc ? ' ▴' : ' ▾') : ''}
    </th>
  )

  const Pkd = ({ p }: { p: Player }) => {
    const i = club.tactic.lineup.indexOf(p.id)
    if (i < 0) return <td />
    const xv = i < 15
    return (
      <td>
        <span style={{
          display: 'inline-block', minWidth: 26, textAlign: 'center',
          fontFamily: 'var(--cond)', fontWeight: 700, fontSize: 12.5,
          borderRadius: 4, padding: '1.5px 4px',
          background: xv ? 'var(--club1)' : 'color-mix(in srgb, var(--club1) 30%, var(--paper))',
          color: xv ? '#fff' : 'var(--ink)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.15)',
        }}>{xv ? i + 1 : `S${i - 14}`}</span>
      </td>
    )
  }

  const NameCell = ({ p }: { p: Player }) => (
    <td className="name">
      <FitRing v={p.cond} />{' '}
      {/* red while he is away with his country (user: "if a player is on
          International duty they should have a red colour for their name") -
          one glance down the list shows who the Test window has taken */}
      <span style={p.natSquad ? { color: '#d4574e', fontWeight: 700 } : undefined}>{p.name}</span>{game.clubs[game.userClubId].captain === p.id ? <b style={{ color: '#a8841a' }}> (C)</b> : ''}{stars.has(p.id) ? ' ⭐' : ''} <AvailTag p={p} g={game} />
    </td>
  )

  return (
    <>
      {/* the tabs and the chips ride along with the scroll: a 38-man table is
          four screenfuls, and the controls used to sail off the top of it */}
      <StickyControls>
      <div className="tab-bar">
        {/* The first view was labelled Selection, and the game ALSO has a
            Selection tab on Selection & Tactics - two pages wearing the same
            name, one showing the pick and one making it (user: "there's two
            selection pages which are confusing"). This one is the overview
            table with the Pkd chips, so it says so; picking happens in one
            place only, on Selection & Tactics via the hub. */}
        {(['selection', 'general', 'stats', 'gametime', 'contracts'] as View[]).map(v => (
          <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>
            {v === 'selection' ? 'Overview' : v === 'general' ? 'General Info'
              : v === 'stats' ? 'Stats' : v === 'gametime' ? 'Game Time' : 'Contracts'}
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
      <div className="filter-row">
        {/* Forwards and Backs are gone (user: "you can remove forwards and backs
            as a sort here"): the list is ordered by shirt number, so 1 to 8 are
            already the forwards and 9 to 15 the backs. The chips filtered a
            list that had grouped itself. */}
        {([['all', 'First Team'], ['aca', '🎓 Academy']] as const).map(([k, label]) => (
          <button key={k} className="preset-chip" style={group === k ? undefined : { background: 'var(--cream-3)', color: 'var(--ink-soft)' }}
            onClick={() => setGroup(k)}>{label}</button>
        ))}
        {/* the academy has its own A League now, so the filter hands off to it
            rather than pretending 27 scholars are a selection problem */}
        {group === 'aca' && (
          <button className="preset-chip" onClick={() => go('academy')}>A League ▸</button>
        )}
        {/* U23 is gone at the user's request, and so is the search box: on a
            portrait phone the two words "Available" and "Unavailable" plus an
            input took two rows for filters that a squad of 42 barely needs, and
            Find A Player already exists as a whole screen on the rail. The
            availability filter is now the two icons it always was really
            (user: "get unavailable and available as just ✅🚑 icons and on the
            same line as first team and academy"). */}
        {([['any', 'Everyone', 'the whole squad'], ['fit', '✅', 'available to pick'], ['out', '🚑', 'injured, banned, away or on loan']] as const).map(([k, label, why]) => (
          <button key={k} className="preset-chip" title={why} aria-label={why}
            style={avail === k ? undefined : { background: 'var(--cream-3)', color: 'var(--ink-soft)' }}
            onClick={() => setAvail(k)}>{label}</button>
        ))}
        {view === 'gametime' && (
          <button className="preset-chip" style={gtAll ? undefined : { background: 'var(--cream-3)', color: 'var(--ink-soft)' }}
            onClick={() => setGtAll(!gtAll)}>{gtAll ? 'Everyone shown' : 'Needs a word'}</button>
        )}
      </div>
      </StickyControls>
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
      <div className="tblwrap fitwrap"><table className="dtable zebra fit">
        {view === 'selection' && <colgroup><col width="34" /><col /><col width="36" /><col width="62" /><col width="40" /><col width="42" /></colgroup>}
        {view === 'general' && <colgroup><col width="32" /><col /><col width="36" /><col width="32" /><col width="28" /><col width="26" /><col width="44" /><col width="56" /></colgroup>}
        {view === 'stats' && <colgroup><col /><col width="34" /><col width="30" /><col width="38" /><col width="32" /><col width="32" /><col width="44" /></colgroup>}
        {view === 'gametime' && <colgroup><col width="32" /><col /><col width="104" /><col width="30" /><col width="32" /><col width="48" /></colgroup>}
        {view === 'contracts' && <colgroup><col width="32" /><col /><col width="36" /><col width="30" /><col width="48" /><col width="44" /><col width="36" /></colgroup>}
        <thead>
          {view === 'selection' && (
            <tr>
              <Th k="pkd">Pkd</Th>
              <Th k="name">Name</Th>
              <Th k="pos">Pos</Th>
              <Th k="ca">Ability</Th>
              <Th k="form" right>Form</Th>
              <Th k="cond" right>Fit</Th>
            </tr>
          )}
          {view === 'general' && (
            <tr>
              <Th k="pkd">Pkd</Th>
              <Th k="name">Name</Th>
              <Th k="pos">Pos</Th>
              <Th k="age" right>Age</Th>
              <th>Nat</th>
              <th>Mor</th>
              <Th k="avr" right>Av R</Th>
              <Th k="value" right>Value</Th>
            </tr>
          )}
          {view === 'gametime' && (
            <tr>
              <Th k="pkd">Pkd</Th>
              <Th k="name">Name</Th>
              <th>He Was Told</th>
              <Th k="apps" right>Ap</Th>
              <th className="num">Due</th>
              <th>Mood</th>
            </tr>
          )}
          {view === 'stats' && (
            <tr>
              <Th k="name">Name</Th>
              <Th k="apps" right>Ap</Th>
              <Th k="tries" right>T</Th>
              <Th k="points" right>Pts</Th>
              <th className="num">YC</th>
              <th className="num">RC</th>
              <th className="num">MotM</th>
            </tr>
          )}
          {view === 'contracts' && (
            <tr>
              <Th k="pkd">Pkd</Th>
              <Th k="name">Name</Th>
              <Th k="pos">Pos</Th>
              <Th k="age" right>Age</Th>
              <Th k="wage" right>Wage /wk</Th>
              <Th k="until" right>Until</Th>
              {/* an icon, not a phrase: "under contract" is the answer for 38 of
                  42 men and it was eating 78px of a 412px screen to say so */}
              <th>?</th>
            </tr>
          )}
        </thead>
        <tbody>
          {players.length === 0 && (
            <tr><td colSpan={8} className="muted" style={{ padding: 12, whiteSpace: 'normal' }}>
              {view === 'gametime' && !gtAll
                ? 'Nobody is short of the minutes he was promised. Tap Everyone Shown to set what the rest of the squad has been told.'
                : 'Nobody matches that. Clear the filters to see the whole squad.'}
            </td></tr>
          )}
          {players.map(p => {
            const avr = p.stats.apps ? (p.stats.ratingSum / p.stats.apps) : 0
            return (
              <tr key={p.id} onClick={() => go('player', p.id)}>
                {view !== 'stats' && <Pkd p={p} />}
                <NameCell p={p} />
                {view === 'selection' && (<>
                  <td><PosBadge pos={p.pos} /></td>
                  <td><Stars ca={p.ca} /></td>
                  <td className="num" style={{ fontWeight: 700, color: p.form >= 7 ? '#2f7d4f' : p.form < 4.5 ? '#a12f2f' : undefined }}>{p.form.toFixed(1)}</td>
                  <td className="num" style={{ color: p.cond < 70 ? '#a12f2f' : undefined }}>{Math.round(p.cond)}%</td>
                </>)}
                {view === 'general' && (<>
                  <td><PosBadge pos={p.pos} /></td>
                  <td className="num">{p.age}</td>
                  <td><Nat code={p.nat} /></td>
                  <td><MoraleArrow v={p.morale} /></td>
                  {/* JUST THE RATING. The ability-trend arrow (ca vs season start)
                      used to render inside this cell, so a man with no apps showed
                      an up arrow next to a dash and it read as his average rating
                      rising without playing (user: "how have these players average
                      rating gone up when they haven't played"). The arrow is real
                      information - he has developed - so it moves to the Value
                      cell, which is the number that actually moves with ability. */}
                  <td className="num">{avr ? avr.toFixed(2) : '-'}</td>
                  <td className="num" style={{ fontWeight: 700 }}>
                    {(p.ca0 != null && p.ca !== p.ca0) && (
                      <span style={{ color: p.ca > p.ca0 ? '#2f7d4f' : '#a12f2f', marginRight: 3, fontWeight: 400 }}
                        title={p.ca > p.ca0 ? 'Ability has grown this season' : 'Ability has slipped this season'}>
                        {p.ca > p.ca0 ? '▲' : '▼'}
                      </span>
                    )}
                    {fmtMoney(p.value)}
                  </td>
                </>)}
                {view === 'gametime' && (() => {
                  // The ledger (F18). The status select is the whole point of the
                  // page, so it lives in the row rather than behind a tap: telling
                  // a man where he stands has to be as cheap as reading that he
                  // is unhappy about it.
                  const row = ledgerRow(game, club, p, played)
                  const cur = statusOf(game, club, p)
                  const MOOD: Record<string, [string, string]> = {
                    happy: ['😀', '#2f7d4f'], content: ['🙂', '#2f7d4f'],
                    restless: ['😐', '#c9a227'], unhappy: ['😠', '#a12f2f'],
                  }
                  const [icon, col] = MOOD[row.mood]
                  return (<>
                    <td onClick={e => e.stopPropagation()}>
                      <select className="inline-input gt-sel" value={cur}
                        onChange={e => { p.status = e.target.value as SquadStatus; touch() }}>
                        {STATUSES.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
                      </select>
                    </td>
                    <td className="num" style={{ fontWeight: 700 }}>{row.actual}</td>
                    <td className="num" style={{ color: row.gap < -2 ? '#a12f2f' : undefined }}>{row.expected}</td>
                    <td title={STATUS_BY_ID[cur].desc} style={{ color: col, whiteSpace: 'nowrap' }}>
                      {icon} {row.gap >= 0 ? `+${row.gap}` : row.gap}
                    </td>
                  </>)
                })()}
                {view === 'contracts' && (<>
                  <td><PosBadge pos={p.pos} /></td>
                  <td className="num">{p.age}</td>
                  <td className="num">{fmtWage(p.wage)}</td>
                  <td className="num" style={{ fontWeight: 700, color: p.contractEnds <= game.season ? '#a12f2f' : p.contractEnds === game.season + 1 ? '#a8841a' : undefined }}>
                    {2026 + p.contractEnds}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {p.contractEnds <= game.season
                      ? <span title="deal expires this summer">⏳</span>
                      : (p.wantsDeal ?? 0) > 0
                        ? <span title="his camp wants improved terms">💼</span>
                        : <span className="muted" title="under contract, nothing to do">·</span>}
                  </td>
                </>)}
                {view === 'stats' && (<>
                  <td className="num">{p.stats.apps}</td>
                  <td className="num">{p.stats.tries}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{p.stats.points}</td>
                  <td className="num">{p.stats.yc}</td>
                  <td className="num">{p.stats.rc}</td>
                  <td className="num">{p.stats.motm}</td>
                </>)}
              </tr>
            )
          })}
        </tbody>
      </table></div>
      {view === 'contracts' && (
        <div className="meta" style={{ padding: '6px 14px 0' }}>
          ⏳ runs out this summer · 💼 his camp wants improved terms · red year expiring, amber next summer. Tap a man to open talks.
        </div>
      )}
      {view === 'gametime' && (
        <div className="meta" style={{ padding: '6px 14px 0' }}>
          Ap is what he has played, Due is what a man on that promise should have played by now. Tell a squad man he is a Key Player and he will hold you to it.
        </div>
      )}
      <div className="spacer" />
    </>
  )
}
