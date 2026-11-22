// THE RECORD ON THE STADIUM PITCH, ON ITS OWN PAGE (2.0.0 rebuild).
//
// Open /lp-record.html?rec=4242 with the dev server running. It builds a new
// game on that seed, takes the user's first fixture, plays it with the new
// engine (worldFromMatch + simSkeleton, as scripts/simread.ts does) and plays
// the record on the stadium pitch with the commentary line under it. The live
// game is not touched.
//   ?rec=<seed>   the seed (default 4242)
//   &from=<s>     start this many seconds into the four-minute match
//   &x=<k>        play k times quicker than the schedule (for a quick look)
// window.__lp holds the feed and the schedule, for the headless recorder.
import { createRoot } from 'react-dom/client'
import { useEffect, useMemo, useRef, useState } from 'react'
import '../tokens.css'
import '../theme.css'
import { LivePitch, type PitchSide } from './LivePitch'
import { RecordFeed, schedule, type Slot } from './fromRecord'
import { newGame } from '../../game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek } from '../../game/season'
import { mulberry32 } from '../../game/rng'
import type { Fixture } from '../../game/model'
import { worldFromMatch, type SimSide } from '../../game/sim/fromMatch'
import { simSkeleton } from '../../game/sim/skeleton'
import type { Play, SimResult } from '../../game/sim/record'
import { kitColours, pageSpares } from '../kit'
import { tokenColor } from '../highlight/draw'
import en from '../../locales/en.json'

/** the commentary agent's module, if it is there (src/game/sim/commentary.ts) */
interface CLine { n: number; key: string; params: Record<string, string | number>; level: 'key' | 'normal' | 'minor'; side: 0 | 1 | null }
type CMod = { commentate(r: SimResult, names: { teams: [string, string]; player(id: string): string }): CLine[]; render(l: CLine): string }
const commentaryModule = import.meta.glob<CMod>('../../game/sim/commentary.ts')

const q = new URLSearchParams(location.search)
const SEED = Number(q.get('rec') ?? 4242)
const FROM = Number(q.get('from') ?? 0)
const X = Number(q.get('x') ?? 1)

const tr = (k: string, v?: Record<string, string | number>) => {
  let x: unknown = en
  for (const part of k.split('.')) x = (x as Record<string, unknown> | undefined)?.[part]
  let o = String(x ?? k)
  for (const [a, b] of Object.entries(v ?? {})) o = o.replace(`{${a}}`, String(b))
  return o
}

/** a plain label from the Play, when there is no commentary module */
function plain(p: Play, teams: [string, string], name: (id?: string) => string): string {
  const a = teams[p.side], who = name(p.who)
  const by = who ? ` (${who})` : ''
  switch (p.kind) {
    case 'kickoff': return `${a} kick off${by}.`
    case 'try': return `TRY ${a}${by}! ${p.score[0]}-${p.score[1]}`
    case 'conversion': return p.good ? `Converted. ${p.score[0]}-${p.score[1]}` : 'The conversion is missed.'
    case 'penaltyGoal': return p.good ? `${a} kick the penalty. ${p.score[0]}-${p.score[1]}` : `${a} miss the penalty.`
    case 'penalty': return `Penalty to ${a}.`
    case 'yellowCard': return `Yellow card, ${a}${by}.`
    case 'redCard': return `Red card, ${a}${by}.`
    case 'halfTime': return `Half-time. ${p.score[0]}-${p.score[1]}`
    case 'fullTime': return `Full time. ${p.score[0]}-${p.score[1]}`
    default: return `${a}: ${p.kind} ${p.result}${by}`
  }
}

interface Match { plays: Play[]; result: SimResult; sides: [SimSide, SimSide]; homeId: string; awayId: string; kits: { home: [string, string]; away: [string, string] } }

function buildMatch(seed: number): Match {
  const g = newGame('leicester', 'T', seed)
  let fx: Fixture | null | undefined = null
  for (let i = 0; i < 12 && !fx; i++) { fx = userFixtureThisWeek(g); if (!fx) processWeekAndAdvance(g) }
  if (!fx) throw new Error('no fixture for the user in the first twelve weeks')
  const { world, home, away } = worldFromMatch(g, fx, mulberry32(seed))
  const result = simSkeleton({ seed, world })
  const white = tokenColor('--prop-ink')
  const k = kitColours(pageSpares(tokenColor), g.clubs[fx.homeId]?.colors ?? [tokenColor('--kit-home'), white], g.clubs[fx.awayId]?.colors ?? [tokenColor('--kit-away'), white], false)
  return { plays: result.plays, result, sides: [home, away], homeId: fx.homeId, awayId: fx.awayId, kits: { home: [k.home[0], k.home[1] ?? white], away: [k.away[0], k.away[1] ?? white] } }
}

const pitchSide = (sd: SimSide, kit: [string, string]): PitchSide => {
  const xi = sd.players.filter(p => p.shirt <= 15).sort((a, b) => a.shirt - b.shirt)
  return { lineup: Array.from({ length: 15 }, (_, i) => { const p = xi.find(z => z.shirt === i + 1); return p ? Number(p.id) : null }), nums: Array.from({ length: 15 }, (_, i) => i + 1), kit }
}

function App() {
  const m = useMemo(() => buildMatch(SEED), [])
  const names = useMemo(() => new Map([...m.sides[0].players, ...m.sides[1].players].map(p => [p.id, p.name])), [m])
  const teams: [string, string] = [m.sides[0].name, m.sides[1].name]
  const feed = useMemo(() => new RecordFeed(m.plays, m.sides, [m.homeId, m.awayId], id => names.get(id)), [m, names])
  const slots: Slot[] = useMemo(() => schedule(m.plays, m.sides), [m])
  const [lines, setLines] = useState<{ n: number; text: string }[] | null>(null)
  useEffect(() => {
    const load = commentaryModule['../../game/sim/commentary.ts']
    if (!load) return
    load().then(mod => {
      const ls = mod.commentate(m.result, { teams, player: id => names.get(id) ?? '' })
      setLines(ls.map(l => ({ n: l.n, text: mod.render(l) })))
    }).catch(() => setLines(null))
  }, [m])
  const [n, setN] = useState(0)
  const raf = useRef(0)
  const nRef = useRef(-1)
  useEffect(() => {
    feed.seek(FROM)
    ;(window as unknown as { __lp: unknown }).__lp = { feed, slots, plays: m.plays, firstTry: slots[m.plays.findIndex(p => p.kind === 'try')]?.start ?? null }
    const tick = () => { if (feed.n !== nRef.current) { nRef.current = feed.n; setN(feed.n) } raf.current = requestAnimationFrame(tick) }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [feed])
  const p = m.plays[n]
  const name = (id?: string) => (id ? (names.get(id) ?? '').split(' ').slice(-1)[0] : '')
  // the words for the play on screen: the latest line said at or before it
  let text = plain(p, teams, name)
  if (lines) { let best: string | null = null; for (const l of lines) { if (l.n > n) break; best = l.text } if (best) text = best }
  const min = Math.min(80, Math.floor(p.t / 60) + 1)
  return <div className="app night" style={{ width: 390, height: 844, display: 'flex', flexDirection: 'column', fontFamily: 'system-ui', color: '#fff', background: '#0b0f14' }}>
    <div style={{ padding: '10px 14px 4px', fontWeight: 800, fontSize: 17, display: 'flex', justifyContent: 'space-between' }}>
      <span>{teams[0]} {p.score[0]} - {p.score[1]} {teams[1]}</span><span>{min}'</span></div>
    <div style={{ flex: 1, minHeight: 0, display: 'grid', padding: '0 8px' }}>
      <LivePitch feed={feed} events={[]} cursor={0} homeId={m.homeId} speed={X}
        home={pitchSide(m.sides[0], m.kits.home)} away={pitchSide(m.sides[1], m.kits.away)}
        tr={tr} teams={{ home: teams[0], away: teams[1] }} names={id => names.get(String(id))} />
    </div>
    <div data-testid="rec-line" style={{ padding: '8px 14px 12px', fontSize: 14, height: 54 }}>{text}</div>
  </div>
}
createRoot(document.getElementById('root')!).render(<App />)
