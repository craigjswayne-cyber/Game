import { useMemo, useState } from 'react'
import { useStore } from '../../store'
import { POS_ORDER, fmtMoney, fmtWage, type Player } from '../../game/model'
import { starPlayerIds } from '../../game/analysis'
import { AvailTag, Nat, PosBadge, Stars, StickyControls } from '../components'
import { STATUSES, STATUS_BY_ID, clubMatchesPlayed, ledgerRow, statusOf, type SquadStatus } from '../../game/gametime'
import SelectionPane from './Selection'
import { t } from '../../game/i18n'

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
  const c = v >= 85 ? 'var(--text-positive)' : v >= 68 ? 'var(--gold)' : 'var(--danger)'
  const state = t(v >= 85 ? 'squad.fitFully' : v >= 68 ? 'squad.fitKnock' : 'squad.fitUnfit')
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
  if (v >= 7) return <span style={{ color: 'var(--text-positive)', fontSize: 14 }}>▲</span>
  if (v >= 4.5) return <span style={{ color: 'var(--gold)', fontSize: 14 }}>►</span>
  return <span style={{ color: 'var(--danger)', fontSize: 14 }}>▼</span>
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
          background: xv ? 'var(--club1)' : 'color-mix(in srgb, var(--club1) 30%, var(--surface-1))',
          color: xv ? 'var(--club1-ink)' : 'var(--text-primary)',
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
      <span style={p.natSquad ? { color: 'var(--danger)', fontWeight: 700 } : undefined}>{p.name}</span>{game.clubs[game.userClubId].captain === p.id ? <b style={{ color: 'var(--gold)' }}> (C)</b> : ''}{stars.has(p.id) ? ' ⭐' : ''} <AvailTag p={p} g={game} />
    </td>
  )

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
        {([['any', 'squad.everyone', 'squad.whyEveryone'], ['fit', '✅', 'squad.whyFit'], ['out', '🚑', 'squad.whyOut']] as const).map(([k, label, why]) => (
          <button key={k} className="preset-chip" title={t(why)} aria-label={t(why)}
            style={avail === k ? undefined : { background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
            onClick={() => setAvail(k)}>{label.includes('.') ? t(label) : label}</button>
        ))}
        {view === 'gametime' && (
          <button className="preset-chip" style={gtAll ? undefined : { background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
            onClick={() => setGtAll(!gtAll)}>{t(gtAll ? 'squad.everyoneShown' : 'squad.needsAWord')}</button>
        )}
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
      {view !== 'selection' && <div className="tblwrap fitwrap"><table className="dtable zebra fit">
        {view === 'general' && <colgroup><col width="32" /><col /><col width="36" /><col width="32" /><col width="28" /><col width="26" /><col width="44" /><col width="56" /></colgroup>}
        {view === 'stats' && <colgroup><col /><col width="34" /><col width="30" /><col width="38" /><col width="32" /><col width="32" /><col width="44" /></colgroup>}
        {view === 'gametime' && <colgroup><col width="32" /><col /><col width="104" /><col width="30" /><col width="32" /><col width="48" /></colgroup>}
        {view === 'contracts' && <colgroup><col width="32" /><col /><col width="36" /><col width="30" /><col width="48" /><col width="44" /><col width="36" /></colgroup>}
        <thead>
          {view === 'general' && (
            <tr>
              <Th k="pkd">{t('squad.colPkd')}</Th>
              <Th k="name">{t('squad.colName')}</Th>
              <Th k="pos">{t('squad.colPos')}</Th>
              <Th k="age" right>{t('squad.colAge')}</Th>
              <th>{t('squad.colNat')}</th>
              <th>{t('squad.colMor')}</th>
              <Th k="avr" right>{t('squad.colAvR')}</Th>
              <Th k="value" right>{t('squad.colValue')}</Th>
            </tr>
          )}
          {view === 'gametime' && (
            <tr>
              <Th k="pkd">{t('squad.colPkd')}</Th>
              <Th k="name">{t('squad.colName')}</Th>
              <th>{t('squad.colToldHim')}</th>
              <Th k="apps" right>{t('squad.colAp')}</Th>
              <th className="num">{t('squad.colDue')}</th>
              <th>{t('squad.colMood')}</th>
            </tr>
          )}
          {view === 'stats' && (
            <tr>
              <Th k="name">{t('squad.colName')}</Th>
              <Th k="apps" right>{t('squad.colAp')}</Th>
              <Th k="tries" right>{t('squad.colT')}</Th>
              <Th k="points" right>{t('squad.colPts')}</Th>
              <th className="num">{t('squad.colYC')}</th>
              <th className="num">{t('squad.colRC')}</th>
              <th className="num">{t('squad.colMotM')}</th>
            </tr>
          )}
          {view === 'contracts' && (
            <tr>
              <Th k="pkd">{t('squad.colPkd')}</Th>
              <Th k="name">{t('squad.colName')}</Th>
              <Th k="pos">{t('squad.colPos')}</Th>
              <Th k="age" right>{t('squad.colAge')}</Th>
              <Th k="wage" right>{t('squad.colWage')}</Th>
              <Th k="until" right>{t('squad.colUntil')}</Th>
              {/* an icon, not a phrase: "under contract" is the answer for 38 of
                  42 men and it was eating 78px of a 412px screen to say so */}
              <th>?</th>
            </tr>
          )}
        </thead>
        <tbody>
          {players.length === 0 && (
            <tr><td colSpan={8} className="muted" style={{ padding: 12, whiteSpace: 'normal' }}>
              {t(view === 'gametime' && !gtAll ? 'squad.emptyGameTime' : 'squad.emptyFiltered')}
            </td></tr>
          )}
          {players.map(p => {
            const avr = p.stats.apps ? (p.stats.ratingSum / p.stats.apps) : 0
            return (
              <tr key={p.id} onClick={() => go('player', p.id)}>
                {view !== 'stats' && <Pkd p={p} />}
                <NameCell p={p} />
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
                    {fmtMoney(p.value)}
                    {/* the arrow FOLLOWS the figure (owner, v1.1.18: "put the
                        arrow up/down on the right of the money") - the money is
                        what the column is for, the trend is its footnote */}
                    {(p.ca0 != null && p.ca !== p.ca0) && (
                      <span style={{ color: p.ca > p.ca0 ? 'var(--text-positive)' : 'var(--danger)', marginLeft: 3, fontWeight: 400 }}
                        title={t(p.ca > p.ca0 ? 'squad.abilityUp' : 'squad.abilityDown')}>
                        {p.ca > p.ca0 ? '▲' : '▼'}
                      </span>
                    )}
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
                    happy: ['😀', 'var(--text-positive)'], content: ['🙂', 'var(--text-positive)'],
                    restless: ['😐', 'var(--gold)'], unhappy: ['😠', 'var(--danger)'],
                  }
                  const [icon, col] = MOOD[row.mood]
                  return (<>
                    <td onClick={e => e.stopPropagation()}>
                      <select className="inline-input gt-sel" value={cur}
                        onChange={e => { p.status = e.target.value as SquadStatus; touch() }}>
                        {/* the engine keeps the English name on the def; the
                            option shows the translated one, keyed by id */}
                        {STATUSES.map(st => <option key={st.id} value={st.id}>{t(`squad.status${st.id[0].toUpperCase()}${st.id.slice(1)}`)}</option>)}
                      </select>
                    </td>
                    <td className="num" style={{ fontWeight: 700 }}>{row.actual}</td>
                    <td className="num" style={{ color: row.gap < -2 ? 'var(--danger)' : undefined }}>{row.expected}</td>
                    <td title={t(`squad.status${cur[0].toUpperCase()}${cur.slice(1)}Desc`)} style={{ color: col, whiteSpace: 'nowrap' }}>
                      {icon} {row.gap >= 0 ? `+${row.gap}` : row.gap}
                    </td>
                  </>)
                })()}
                {view === 'contracts' && (<>
                  <td><PosBadge pos={p.pos} /></td>
                  <td className="num">{p.age}</td>
                  <td className="num">{fmtWage(p.wage)}</td>
                  <td className="num" style={{ fontWeight: 700, color: p.contractEnds <= game.season ? 'var(--danger)' : p.contractEnds === game.season + 1 ? 'var(--gold)' : undefined }}>
                    {2026 + p.contractEnds}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {p.contractEnds <= game.season
                      ? <span title={t('squad.dealExpires')}>⏳</span>
                      : (p.wantsDeal ?? 0) > 0
                        ? <span title={t('squad.wantsTerms')}>💼</span>
                        : <span className="muted" title={t('squad.underContract')}>·</span>}
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
      </table></div>}
      {view === 'contracts' && (
        <div className="meta" style={{ padding: '6px 14px 0' }}>
          {t('squad.contractsNote')}
        </div>
      )}
      {view === 'gametime' && (
        <div className="meta" style={{ padding: '6px 14px 0' }}>
          {t('squad.gameTimeNote')}
        </div>
      )}
      <div className="spacer" />
    </>
  )
}
