// The match stats: the live panel between highlights and the full-time one.

import type { CSSProperties } from 'react'
import { useStore } from '../../../store'
import { matchStats, visitsTo22, teamShort } from '../../../game/matchEngine'
import type { MatchEvent } from '../../../game/model'
import { t } from '../../../game/i18n'
import { CrestT } from '../../components'
import { tokenColor } from '../../HighlightClip'
import { kitColours, pageSpares } from '../../kit'

// VISITS TO THE 22, and what each side came away with (1.8.0). Owner-led
// research: the "we were robbed" feeling comes from stats that show
// dominance without showing why it failed. Nine visits and ten points is
// the reason a side lost, and now it is on the screen. The count itself is
// the engine's (visitsTo22), shared with the Visits panel so the two can
// never disagree.
function visitStats(shown: MatchEvent[], homeId: string, home: boolean): [number, number] {
  const v = visitsTo22(shown, homeId, home)
  return [v.visits, v.pts]
}

const perVisit = (p: number, v: number) => v ? Math.round((p / v) * 10) / 10 : 0

/**
 * THE SCORING ROWS READ THE TICKER, NOT THE ENGINE (1.8.0). The engine plays a
 * tick ahead of the lines on screen (and further when a highlight looks
 * ahead), so a total read off the match sheet put a try, a kick or a card on
 * the stats before the commentary had got to it: an 18-0 scoreboard beside
 * four kicks from four. These are counted from what has been shown; kicks
 * from the engine's kick log up to the line the ticker is on.
 */
function shownStats(live: { ctx: { kickLog?: [number, 0 | 1, 0 | 1][] }; cursor: number },
  shown: MatchEvent[], homeId: string, sheet: [[number, number], [number, number]]) {
  const side = (e: MatchEvent) => (e.teamId === homeId ? 0 : 1)
  const tries: [number, number] = [0, 0], cards: [number, number] = [0, 0]
  for (const e of shown) {
    if (!e.teamId) continue
    if (e.type === 'TRY' && e.fx !== 'TMO' && e.fx !== 'NOTRY') tries[side(e)]++
    if (e.type === 'YC' || e.type === 'RC') cards[side(e)]++
  }
  let kicks = sheet
  if (live.ctx.kickLog) {
    const k: [[number, number], [number, number]] = [[0, 0], [0, 0]]
    for (const [at, who, made] of live.ctx.kickLog) {
      if (at >= live.cursor) continue
      k[who][1]++
      k[who][0] += made
    }
    kicks = k
  }
  return { tries, cards, kicks }
}

/**
 * THE LIVE STATS (1.8.0): what fills the screen between highlights, as FM's
 * match screen does. The match sheet's own numbers (matchStats) plus the two
 * read off the lines shown so far: territory, and visits to the opposition 22.
 * Two columns, a split bar per row in the clubs' colours.
 */
export function LiveStats({ shown }: { shown: MatchEvent[] }) {
  const game = useStore(s => s.game)!
  const live = useStore(s => s.liveMatch)!
  const st = matchStats(live.ctx)
  const homeId = live.fixture.homeId
  const kits = kitColours(pageSpares(tokenColor), game.clubs[homeId]?.colors, game.clubs[live.fixture.awayId]?.colors)
  const col = (id: string) => {
    if (!game.clubs[id]?.colors) return 'var(--text-muted)'
    return (id === homeId ? kits.home : kits.away)[0]
  }
  // TERRITORY is where the ball has been on average: 50 is halfway, and the
  // further up the away side's end the play has lived the bigger the home
  // share. (Counting lines either side of halfway swung to 0 and 100 on a
  // handful of lines early in a match.)
  const withF = shown.filter(e => e.fld != null)
  const homeTerr = withF.length ? Math.round(withF.reduce((a, e) => a + e.fld!, 0) / withF.length) : 50
  const [hv, hp] = visitStats(shown, homeId, true), [av, ap] = visitStats(shown, homeId, false)
  const shownSt = shownStats(live, shown, homeId, st.goalKicks)
  const [gk0, gk1] = shownSt.kicks
  // a row: the label, the two numbers the bar splits, and how each side reads
  type Row = [string, [number, number], ((i: 0 | 1) => string)?]
  const pct = (v: [number, number]) => (i: 0 | 1) => `${v[i]}%`
  const rows: Row[] = [
    [t('matchday.stPossession'), st.possession, pct(st.possession)],
    [t('matchday.stTerritory'), [homeTerr, 100 - homeTerr], pct([homeTerr, 100 - homeTerr])],
    [t('matchday.stTries'), shownSt.tries],
    [t('matchday.st22'), [hv, av]],
    [t('matchday.stPerVisit'), [perVisit(hp, hv), perVisit(ap, av)], i => (i ? perVisit(ap, av) : perVisit(hp, hv)).toFixed(1)],
    // the bar is the success rate, so 4 from 4 beats 5 from 9
    [t('matchday.stGoalKicks'), [gk0[1] ? gk0[0] / gk0[1] : 0, gk1[1] ? gk1[0] / gk1[1] : 0], i => `${(i ? gk1 : gk0)[0]}/${(i ? gk1 : gk0)[1]}`],
    [t('matchday.stTackles'), st.tackles],
    [t('matchday.stScrums'), st.scrumsWon],
    [t('matchday.stLineouts'), st.lineoutsWon],
    [t('matchday.stCards'), shownSt.cards],
  ]
  return (
    <div className="live-stats" data-testid="live-stats">
      {/* the crests carry the three-letter code; a tablet shows them in
          place of the names, which ran into each other and into the title in
          its narrow panel (owner, tablet round: "can you use team logos") */}
      <div className="ls-head">
        <span><i className="ls-crest"><CrestT g={game} teamId={homeId} size={30} mr={0} /></i><i className="ls-name">{teamShort(game, homeId)}</i></span>
        <b>{t('matchday.liveStats')}</b>
        <span><i className="ls-name">{teamShort(game, live.fixture.awayId)}</i><i className="ls-crest"><CrestT g={game} teamId={live.fixture.awayId} size={30} mr={0} /></i></span>
      </div>
      {rows.map(([label, v, fmt]) => {
        const share = v[0] + v[1] > 0 ? v[0] / (v[0] + v[1]) : 0.5
        return (
          <div key={label} className="ls-row">
            <b>{fmt ? fmt(0) : v[0]}</b>
            <span className="ls-mid">
              <span className="ls-label">{label}</span>
              <span className="ls-bar">
                <i style={{ width: `${(share * 100).toFixed(1)}%`, background: col(homeId) }} />
                <i style={{ width: `${((1 - share) * 100).toFixed(1)}%`, background: col(live.fixture.awayId) }} />
              </span>
            </span>
            <b>{fmt ? fmt(1) : v[1]}</b>
          </div>
        )
      })}
    </div>
  )
}

export function StatsPanel() {
  const game = useStore(s => s.game)!
  const live = useStore(s => s.liveMatch)!
  const st = matchStats(live.ctx)
  const shown = live.ctx.events.slice(0, live.cursor)
  const homeId = live.fixture.homeId
  const [hv, hp] = visitStats(shown, homeId, true), [av, ap] = visitStats(shown, homeId, false)
  const shownSt = shownStats(live, shown, homeId, st.goalKicks)
  const [gk0, gk1] = shownSt.kicks
  const kits = kitColours(pageSpares(tokenColor), game.clubs[homeId]?.colors, game.clubs[live.fixture.awayId]?.colors)
  const colour = (id: string) => (id === homeId ? kits.home : kits.away)[0]
  // Each row carries a split bar in the two clubs' colours, and the bars fill
  // in one after another as the panel opens (idea 5: "the match stats panel
  // animating"). Transform only, so the fill is compositor work.
  let n = 0
  const row = (label: string, v: [number, number], pct = false, text?: [string, string]) => {
    const share = v[0] + v[1] > 0 ? v[0] / (v[0] + v[1]) : 0.5
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem' }}>
        <b style={{ width: 34, textAlign: 'right', fontFamily: 'var(--cond)', fontSize: '1rem' }}>{text ? text[0] : `${v[0]}${pct ? '%' : ''}`}</b>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--cond)', textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.75rem' }}>{label}</span>
          <span className="stat-bar" style={{ '--d': `${150 + n++ * 110}ms` } as CSSProperties}>
            <i className="h" style={{ transform: `scaleX(${share.toFixed(3)})`, background: colour(live.fixture.homeId) }} />
            <i className="a" style={{ transform: `scaleX(${(1 - share).toFixed(3)})`, background: colour(live.fixture.awayId) }} />
          </span>
        </span>
        <b style={{ width: 34, fontFamily: 'var(--cond)', fontSize: '1rem' }}>{text ? text[1] : `${v[1]}${pct ? '%' : ''}`}</b>
      </div>
    )
  }
  return (
    <div className="card" style={{ margin: '12px 0' }}>
      <h3 style={{ fontSize: '0.875rem', textAlign: 'center' }}>
        {t('matchday.statsTitle', { home: teamShort(game, live.fixture.homeId), away: teamShort(game, live.fixture.awayId) })}
      </h3>
      {row(t('matchday.stPossession'), st.possession, true)}
      {row(t('matchday.stTries'), shownSt.tries)}
      {row(t('matchday.stScrums'), [st.scrumsWon[0], st.scrumsWon[1]])}
      {row(t('matchday.stLineouts'), [st.lineoutsWon[0], st.lineoutsWon[1]])}
      {row(t('matchday.stTackles'), st.tackles)}
      {row(t('matchday.st22'), [hv, av])}
      {row(t('matchday.stPerVisit'), [perVisit(hp, hv), perVisit(ap, av)], false, [perVisit(hp, hv).toFixed(1), perVisit(ap, av).toFixed(1)])}
      {row(t('matchday.stGoalKicks'), [gk0[1] ? gk0[0] / gk0[1] : 0, gk1[1] ? gk1[0] / gk1[1] : 0], false, [`${gk0[0]}/${gk0[1]}`, `${gk1[0]}/${gk1[1]}`])}
      {row(t('matchday.stCards'), shownSt.cards)}
      {row(t('matchday.stEnergy'), st.energy, true)}
    </div>
  )
}
