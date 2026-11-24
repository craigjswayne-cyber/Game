// THE RECORD ON THE STADIUM PITCH, AS THE MATCH SCREEN SHOWS IT (2.0.0 rebuild).
//
// Open /lp-record.html?rec=4242 with the dev server running. It builds a new
// game on that seed, takes the user's first fixture, plays it with the new
// engine (worldFromMatch + simSkeleton, as scripts/simread.ts does) and plays
// the record on the stadium pitch inside the same frame as the real match
// screen (Live.tsx, `live-wrap full-match`): the scoreboard with the referee's
// clock and the cards, the 4:3 pitch box (so the game is drawn on its side in
// the painted stadium, as the owner chose on 17 Nov), the commentary feed
// under it (commentary.ts, each line when its play comes on), and a few stats
// from the record so far. The live game is not touched.
//   ?rec=<seed>   the seed (default 4242)
//   &from=<s>     start this many seconds into the match
//   &x=<k>        play k times quicker (for a quick look)
//   &cap=1        frame-exact capture: nothing moves until window.__setT(seconds) is called
// window.__lp holds the feed and the schedule, for the recorder (scripts/tmp/recframes.mjs).
import { createRoot } from 'react-dom/client'
import { useEffect, useMemo, useRef, useState } from 'react'
import '../tokens.css'
import '../theme.css'
import { LivePitch, type PitchSide } from './LivePitch'
import { RecordFeed, schedule, type Slot } from './fromRecord'
import { Ticker, type TickLine } from './Ticker'
import { Compare, installFakeClock } from './Compare'
import { newGame } from '../../game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek } from '../../game/season'
import { mulberry32 } from '../../game/rng'
import type { Fixture, GameState } from '../../game/model'
import { worldFromMatch, type SimSide } from '../../game/sim/fromMatch'
import { simSkeleton } from '../../game/sim/skeleton'
import type { Play, SimResult } from '../../game/sim/record'
import { teamShort } from '../../game/matchEngine'
import { NAMES as SPONSOR_NAMES } from '../../game/commercial'
import { kitColours, kitInk, pageSpares } from '../kit'
import { tokenColor } from '../highlight/draw'
import { CrestT } from '../components'
import { useFeedGlide } from '../screens/matchday/feedGlide'
import en from '../../locales/en.json'

/** the commentary agent's module, if it is there (src/game/sim/commentary.ts) */
interface CLine { n: number; key: string; params: Record<string, string | number>; level: 'key' | 'normal' | 'minor'; side: 0 | 1 | null; flash?: 'try' | 'goal' | 'card' | 'key' | null; hold?: number }
type CMod = { commentate(r: SimResult, names: { teams: [string, string]; player(id: string): string }): CLine[]; render(l: CLine): string; thin?(lines: CLine[], slots: Slot[], gap?: number): CLine[]; feed?(lines: CLine[], slots: Slot[]): { line: CLine; at: number; hold: number }[] }
const commentaryModule = import.meta.glob<CMod>('../../game/sim/commentary.ts')

const q = new URLSearchParams(location.search)
const SEED = Number(q.get('rec') ?? 4242)
const FROM = Number(q.get('from') ?? 0)
const X = Number(q.get('x') ?? 1)
const CAPTURE = q.get('cap') === '1'
const COMPARE = q.get('compare') === '1'

const tr = (k: string, v?: Record<string, string | number>) => {
  let x: unknown = en
  for (const part of k.split('.')) x = (x as Record<string, unknown> | undefined)?.[part]
  let o = String(x ?? k)
  for (const [a, b] of Object.entries(v ?? {})) o = o.replace(`{${a}}`, String(b))
  return o
}

/** a plain label from the Play, when there is no commentary module */
function plain(p: Play, teams: [string, string]): string {
  const a = teams[p.side]
  switch (p.kind) {
    case 'kickoff': return `${a} kick off.`
    case 'try': return `TRY ${a}! ${p.score[0]}-${p.score[1]}`
    case 'conversion': return p.good ? `Converted. ${p.score[0]}-${p.score[1]}` : 'The conversion is missed.'
    case 'penaltyGoal': return p.good ? `${a} kick the penalty.` : `${a} miss the penalty.`
    case 'penalty': return `Penalty to ${a}.`
    default: return `${a}: ${p.kind}`
  }
}

interface Match {
  game: GameState; fx: Fixture; plays: Play[]; result: SimResult; sides: [SimSide, SimSide]
  kits: { home: [string, string]; away: [string, string] }; night: boolean
}
function buildMatch(seed: number): Match {
  const game = newGame('leicester', 'T', seed)
  let fx: Fixture | null | undefined = null
  for (let i = 0; i < 12 && !fx; i++) { fx = userFixtureThisWeek(game); if (!fx) processWeekAndAdvance(game) }
  if (!fx) throw new Error('no fixture for the user in the first twelve weeks')
  const { world, home, away } = worldFromMatch(game, fx, mulberry32(seed))
  const result = simSkeleton({ seed, world })
  const white = tokenColor('--prop-ink')
  const k = kitColours(pageSpares(tokenColor), game.clubs[fx.homeId]?.colors ?? [tokenColor('--kit-home'), white], game.clubs[fx.awayId]?.colors ?? [tokenColor('--kit-away'), white], false)
  // day or night as the match screen decides it (Live.tsx pitchNight): two in three in the afternoon
  let h = 0
  for (const ch of String(fx.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return { game, fx, plays: result.plays, result, sides: [home, away], kits: { home: [k.home[0], k.home[1] ?? white], away: [k.away[0], k.away[1] ?? white] }, night: h % 3 === 0 }
}

const pitchSide = (sd: SimSide, kit: [string, string]): PitchSide => {
  const xi = sd.players.filter(p => p.shirt <= 15).sort((a, b) => a.shirt - b.shirt)
  return { lineup: Array.from({ length: 15 }, (_, i) => { const p = xi.find(z => z.shirt === i + 1); return p ? Number(p.id) : null }), nums: Array.from({ length: 15 }, (_, i) => i + 1), kit }
}

/** the record so far, as the brief stats under the commentary */
function statsTo(plays: Play[], n: number): { label: string; v: [number, number]; fmt?: (i: 0 | 1) => string }[] {
  let live0 = 0, live1 = 0, terr = 0, terrW = 0
  const tries: [number, number] = [0, 0], pens: [number, number] = [0, 0], visits: [number, number] = [0, 0]
  let in22: 0 | 1 | null = null
  for (let k = 0; k <= n && k < plays.length; k++) {
    const p = plays[k]
    if (p.ball === 0) live0 += p.live; else live1 += p.live
    if (p.live > 0) { terr += p.x * p.live; terrW += p.live }
    if (p.kind === 'try' || p.kind === 'penaltyTry') tries[p.side]++
    // (penalties conceded: the side the penalty is against)
    if (p.kind === 'penalty') pens[p.side === 0 ? 1 : 0]++
    const at: 0 | 1 | null = p.x > 78 && p.ball === 0 ? 0 : p.x < 22 && p.ball === 1 ? 1 : null
    if (at != null && at !== in22) visits[at]++
    in22 = at
  }
  const poss = live0 + live1 > 0 ? Math.round(100 * live0 / (live0 + live1)) : 50
  const ter = terrW > 0 ? Math.round(100 * terr / terrW / 100) : 50
  return [
    { label: 'Possession', v: [poss, 100 - poss], fmt: i => `${i ? 100 - poss : poss}%` },
    { label: 'Territory', v: [ter, 100 - ter], fmt: i => `${i ? 100 - ter : ter}%` },
    { label: 'Tries', v: tries },
    { label: '22 entries', v: visits },
    { label: 'Penalties conceded', v: pens },
  ]
}

function App() {
  const m = useMemo(() => buildMatch(SEED), [])
  const { game, fx, plays } = m
  const names = useMemo(() => new Map([...m.sides[0].players, ...m.sides[1].players].map(p => [p.id, p.name])), [m])
  const teams: [string, string] = [teamShort(game, fx.homeId), teamShort(game, fx.awayId)]
  const feed = useMemo(() => new RecordFeed(plays, m.sides, [fx.homeId, fx.awayId], id => names.get(id)), [m, names])
  const slots: Slot[] = useMemo(() => schedule(plays, m.sides), [m])
  const [lines, setLines] = useState<{ n: number; text: string; level: string; side: 0 | 1 | null }[] | null>(null)
  const [ticks, setTicks] = useState<TickLine[] | null>(null)
  useEffect(() => {
    const load = commentaryModule['../../game/sim/commentary.ts']
    if (!load) return
    load().then(mod => {
      const all = mod.commentate(m.result, { teams: [m.sides[0].name, m.sides[1].name], player: id => names.get(id) ?? '' })
      // (thinned to what a reader can take in at the speed each play is shown: the commentary agent's thin())
      const ls = mod.thin ? mod.thin(all, slots) : all
      setLines(ls.map(l => ({ n: l.n, text: mod.render(l), level: l.level, side: l.side })))
      // THE TICKER: the commentary's own feed() places each line in viewing seconds (its play on screen)
      const shown = mod.feed ? mod.feed(all, slots) : ls.map(l => ({ line: l, at: slots[l.n]?.start ?? 0, hold: l.level === 'key' ? 3 : 1.2 }))
      setTicks(shown.map(x => {
        const k = plays[x.line.n]?.kind
        const flash = x.line.flash !== undefined ? x.line.flash : k === 'try' || k === 'penaltyTry' ? 'try' : k === 'yellowCard' || k === 'redCard' ? 'card' : null
        return { n: x.line.n, text: mod.render(x.line), at: x.at, hold: x.hold, flash, side: x.line.side, card: k === 'redCard' ? 'r' : k === 'yellowCard' ? 'y' : undefined,
          minute: Math.min(80, Math.floor((plays[x.line.n]?.clock ?? plays[x.line.n]?.t ?? 0) / 60) + 1) }
      }))
    }).catch(() => setLines(null))
  }, [m, slots])
  const [n, setN] = useState(0)
  const [landed, setLanded] = useState(false)
  const raf = useRef(0), nRef = useRef(-1), lRef = useRef(false)
  useEffect(() => {
    feed.frozen = CAPTURE
    feed.seek(FROM)
    const sync = () => {
      if (feed.n !== nRef.current) { nRef.current = feed.n; setN(feed.n) }
      if (feed.landed !== lRef.current) { lRef.current = feed.landed; setLanded(feed.landed) }
    }
    const w = window as unknown as Record<string, unknown>
    w.__lp = { feed, slots, plays, firstTry: slots[plays.findIndex(p => p.kind === 'try' || p.kind === 'penaltyTry')]?.start ?? null, length: feed.length }
    // the recorder's hook: the clock to this second, one frame drawn, the page brought up to it
    w.__setT = (v: number) => { feed.frozen = true; feed.seek(v); feed.redraw(); sync() }
    const tick = () => { sync(); raf.current = requestAnimationFrame(tick) }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [feed])

  // ---- the score and the clock: a score counts once its play has landed (the ball down, the kick over)
  const p = plays[n]
  const scored = landed ? p.score : (plays[n - 1]?.score ?? [0, 0])
  const clock = p.clock ?? p.t
  const minute = p.kind === 'fullTime' ? 'Full time' : p.kind === 'halfTime' ? 'Half-time' : `${Math.min(80, Math.floor(clock / 60) + 1)}'`
  const weather = fx.weather && fx.weather !== 'Dry' ? ` · ${fx.weather}` : ''
  // the cards a side is serving now
  const cards = (side: 0 | 1) => {
    const out: string[] = []
    for (let k = 0; k <= n; k++) {
      const c = plays[k]
      if (c.side !== side) continue
      if (c.kind === 'redCard') out.push('rc')
      if (c.kind === 'yellowCard' && (c.until ?? c.t + 600) > p.t) out.push('yc')
    }
    return out.length ? <span className="tcards">{out.map((c, i) => <i key={i} className={c === 'rc' ? 'rc' : ''} />)}</span> : null
  }
  // ---- the commentary: every line whose play is on screen or past, newest at the foot
  // (inside a condensed passage the minor lines are left out: the picture is travelling through it)
  const shown = useMemo(() => {
    if (!lines) return [{ n, text: plain(p, teams), level: 'normal', side: p.side as 0 | 1 | null }]
    return lines.filter(l => l.n <= n && !(l.level === 'minor' && feed.bk.segs[l.n]?.condensed && l.n < n))
  }, [lines, n])
  const rows = shown.slice(-5)
  const feedRef = useRef<HTMLDivElement>(null)
  useFeedGlide(feedRef, shown.length)
  const kitOf = (side: 0 | 1 | null) => (side === 1 ? m.kits.away : m.kits.home)
  const clsOf = (l: { n: number; level: string }) => {
    const k = plays[l.n]?.kind
    return k === 'yellowCard' ? 'card-y' : k === 'redCard' ? 'card-r' : k === 'penalty' || k === 'freeKick' ? 'pen'
      : k === 'try' || k === 'penaltyTry' || k === 'fullTime' || (l.level === 'key' && (k === 'dropGoal' || k === 'penaltyGoal' || k === 'conversion')) ? 'big' : ''
  }
  const stats = statsTo(plays, landed ? n : n - 1)
  const boards = useMemo(() => [...new Set([...SPONSOR_NAMES.shirt, ...SPONSOR_NAMES.sleeve])].slice(0, 12), [])
  return <div className={`app ${m.night ? 'night' : 'day'}${CAPTURE ? ' lp-cap' : ''}`} style={{ width: 390, height: 844, display: 'grid', overflow: 'hidden', background: 'var(--surface-0, #0b0f14)' }}>
    {CAPTURE && <style>{'.lp-cap *, .lp-cap *::before, .lp-cap *::after { animation: none !important; transition: none !important; }'}</style>}
    <div className="live-wrap full-match">
      <div className="scoreboard" style={{ '--home-c': m.kits.home[0], '--away-c': m.kits.away[0] } as React.CSSProperties}>
        <div className="teams">
          <div className="tname"><CrestT g={game} teamId={fx.homeId} size={26} />{teams[0]}<span className="clubbar" style={{ background: m.kits.home[0] }} />{cards(0)}</div>
          <div className="score" key={`${scored[0]}-${scored[1]}`}>{scored[0]} – {scored[1]}</div>
          <div className="tname"><CrestT g={game} teamId={fx.awayId} size={26} />{teams[1]}<span className="clubbar" style={{ background: m.kits.away[0] }} />{cards(1)}</div>
        </div>
        <div className="minute">{minute}{weather}</div>
      </div>
      <LivePitch feed={feed} events={[]} cursor={0} homeId={fx.homeId} speed={X}
        home={pitchSide(m.sides[0], m.kits.home)} away={pitchSide(m.sides[1], m.kits.away)}
        night={m.night} wet={fx.weather === 'Rain'} snow={fx.weather === 'Snow'} boards={boards}
        tr={tr} teams={{ home: teams[0], away: teams[1] }} names={id => names.get(String(id))} />
      <div className="now-strip">
        {ticks ? <Ticker lines={ticks} feed={feed} kits={m.kits} /> : <div className="comm-feed" aria-live="off">
          <div className="comm-list" ref={feedRef}>
            {rows.map((l, j) => {
              const age = rows.length - 1 - j, cls = clsOf(l), [fill, edge] = kitOf(l.side)
              const style: React.CSSProperties | undefined = l.side == null ? undefined
                : age === 0 ? { background: kitInk(fill).fill, color: kitInk(fill).ink, boxShadow: `inset 0 0 0 1px ${edge}`, ...(cls ? {} : { borderLeftColor: edge }) }
                : cls ? undefined : { borderLeftColor: fill }
              const mm = plays[l.n].clock ?? plays[l.n].t
              return <div key={`${l.n}-${j}-${l.text.length}`} data-k={`${l.n}:${l.text}`} data-testid={age === 0 ? 'rec-line' : undefined}
                className={`comm-line ${cls}${l.side != null ? ' kit' : ''}${age === 0 ? ' cur now-line fresh' : ` old a${Math.min(3, age)}`}`} style={style}>
                <span className="min">{Math.min(80, Math.floor(mm / 60) + 1)}'</span>
                <span className="txt">{l.text}</span>
              </div>
            })}
          </div>
        </div>}
        <div className="live-stats brief" data-testid="live-stats">
          {stats.map(r => {
            const share = r.v[0] + r.v[1] > 0 ? r.v[0] / (r.v[0] + r.v[1]) : 0.5
            return <div key={r.label} className="ls-row">
              <b>{r.fmt ? r.fmt(0) : r.v[0]}</b>
              <span className="ls-mid"><span className="ls-label">{r.label}</span>
                <span className="ls-bar"><i style={{ width: `${(share * 100).toFixed(1)}%`, background: m.kits.home[0] }} /><i style={{ width: `${((1 - share) * 100).toFixed(1)}%`, background: m.kits.away[0] }} /></span></span>
              <b>{r.fmt ? r.fmt(1) : r.v[1]}</b>
            </div>
          })}
        </div>
      </div>
    </div>
  </div>
}
function CompareApp() {
  const m = useMemo(() => buildMatch(SEED), [])
  const names = useMemo(() => new Map([...m.sides[0].players, ...m.sides[1].players].map(p => [p.id, p.name])), [m])
  const ids: [string, string] = [m.fx.homeId, m.fx.awayId]
  return <div className="app day lp-cap"><style>{'.lp-cap *, .lp-cap *::before, .lp-cap *::after { animation: none !important; transition: none !important; }'}</style>
    <Compare plays={m.plays} sides={m.sides} ids={ids} kits={m.kits} names={id => names.get(id)}
      homeSide={pitchSide(m.sides[0], m.kits.home)} awaySide={pitchSide(m.sides[1], m.kits.away)}
      teams={{ home: teamShort(m.game, m.fx.homeId), away: teamShort(m.game, m.fx.awayId) }} tr={tr} /></div>
}
if (COMPARE) installFakeClock()
createRoot(document.getElementById('root')!).render(COMPARE ? <CompareApp /> : <App />)
