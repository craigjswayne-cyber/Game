// THE MATCH, LIVE, ON THE NEW ENGINE (round 8, stage 6 first step: "the real Extended match screen
// plays the new engine, live, with the manager's decisions").
//
// THE PLAN (written before the code, from reading Live.tsx, store/slices/match.ts and the sheets):
//  1. Live.tsx stays the screen for Skip, Key and everything with SIM2_EXTENDED off. When the manager
//     watches on Extended (prefs.highlights 'extended', not the highlights ticker) and SIM2_EXTENDED is on,
//     Live renders this instead. The match was kicked off as today by the store's kickOff (the pre-match
//     save, the dressing room), which with SIM2_EXTENDED on makes GAMEPLAY's session (startSim2) and puts
//     it on liveMatch.sim2, its ctx the game's own live match.
//  2. The match here is that ONE session (seen through stream.ts fromSim2), stepped a passage (dead ball
//     to dead ball) at a time as the pitch needs it, with the store told after each (noteProgress) so a
//     reload can replay it. The pitch bakes as it goes (makeBaker) and plays on its own clock (StreamClock):
//     clip pace for key moments and every play of a scoring possession, fast forward elsewhere, eased.
//  3. His decisions go to the engine as they are made: a substitution or a tactics change is made at the
//     next dead ball the engine has not played (the screen says "at the next stoppage" until it shows
//     on the pitch, or says why it was refused); the half-time talk when the match stops at half-time;
//     his penalty calls when the engine stops for one (posts, corner, tap, scrum, with a timer and the
//     game's call if he lets it run out); a man of his hurt stops the match and opens the substitution
//     sheet for him (session.pendingInjury, answered with session.cover).
//  4. The screen is the preview's layout promoted: the scoreboard with cards, the painted stadium in the
//     club's kits with the fixture's weather and time of day, the ticker with its flashes, the brief live
//     stats, the controls row (play/pause, squad, tactics, speed, skip to the end), and the ad space at
//     the foot left as it is. It fits a 360 x 640 phone without scrolling during play.
//  5. Full time: the store's finishMatch, which runs session.finish() (the game's own full time and
//     finalizeMatch on the record watched) and turns the week as now. A match picked up after a reload is
//     replayed by the store (replaySim2) and shown on the old screen, which plays a session to the end:
//     this screen would have to show the match from kick-off again to reach where it was.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../../../store'
import { HalfTimeWord } from './Panels'
import { matchSfx } from '../../audio'
import { contextFromGame } from '../../../game/sim/context'
import { refFor } from '../../../game/match/referee'
import { goalKicker } from '../../../game/match/field'
import { t, compLabel } from '../../../game/i18n'
import { teamShort } from '../../../game/matchEngine'
import { SLIDER_INFO } from '../../../game/tactics'
import { HT_TONES, type HtTone } from '../../../game/teamtalk'
import { commentate, render as renderLine, territory, type Line } from '../../../game/sim/commentary'
import type { Play, PenaltyCall } from '../../../game/sim/record'
import { duelsOf } from '../../../game/sim/skeleton'
import type { GameState, Fixture } from '../../../game/model'
import { CrestT } from '../../components'
import { Glyph } from '../../glyphs'
import { IcoFastForward, IcoPause, IcoPlay, IcoPeople } from '../../icons'
import { luma } from '../../kit'
import { wornKits, wornPattern, type Kit } from '../../livepitch/kitclash'
import { kitPattern } from '../../../game/kits'
import { tokenColor } from '../../HighlightClip'
import { AdSlot } from '../../AdSlot'
import { Veil } from '../../Veil'
import { NAMES as SPONSOR_NAMES } from '../../../game/commercial'
import { LivePitch, type PitchSide } from '../../livepitch/LivePitch'
import { Ticker, type TickLine } from '../../livepitch/Ticker'
import { fromSim2, StreamFeed, type Session } from '../../livepitch/stream'
import { FPS } from '../../livepitch/fromRecord'
import { WEATHER_ICON, weatherWord } from './weather'

/** THE SWITCH: the watched Extended match on the new engine. Off, everything is as before. */
export { SIM2_EXTENDED } from '../../../game/sim/toResult'

/** the speed buttons: they scale every rate alike (fast forward stays as it is at Normal) */
const SPEEDS = [{ k: 'matchday.spdSlow', x: 0.7 }, { k: 'matchday.spdNormal', x: 1 }, { k: 'matchday.spdFast', x: 1.6 }]
/** how long he has to make a penalty call before the captain makes it (seconds) */
const CALL_S = 10
/** the commentary's lines about a decision of the manager's (his talk, his change, his call, his cover, his tactics), by their key */
const MINE_LINE = /([Tt]alk|[Ss]ub(Made|Cover|Why)|[Tt]actic|[Cc]all|[Cc]over|[Mm]gr|[Dd]ecision|[Cc]aptain)/
const CALL_KEY: Record<string, string> = { posts: 'matchday.optPosts', corner: 'matchday.optCorner', tap: 'matchday.optTap', scrum: 'matchday.optScrum' }

/** a word from the locales, or the English given when the key is not there yet (asked for in requests.md) */
/** why a change was refused, in the player's language: the engine gives its reason in English (Play.cause),
 *  mapped to the commentary's own lines as commentary.ts does (REFUSED_WHY) */
const REFUSED_WHY: Record<string, string> = { 'not on the field': 'sim.whyNotOn1', 'in the bin or sent off': 'sim.whyBinned1', 'not on the bench': 'sim.whyNotBench1', refused: 'sim.whyLaws1' }


/** THE PRE-MATCH, at least this long (seconds): the fixture card for the first 28% of it, the run-out to 60%, then
 *  the team sheets; longer, to 21 s, when the commentary's pre-match block has more lines (a line every 1.8 s) */
const PRE_END = 11.0

/** the brief stats, from the record as far as the pitch has got */
function statsTo(plays: Play[], n: number): { label: string; v: [number, number]; pct?: boolean }[] {
  let live0 = 0, live1 = 0, terr = 0, terrW = 0
  const tries: [number, number] = [0, 0], pens: [number, number] = [0, 0], tackles: [number, number] = [0, 0]
  for (let k = 0; k <= Math.min(n, plays.length - 1); k++) {
    const p = plays[k]
    if (p.ball === 0) live0 += p.live; else live1 += p.live
    if (p.live > 0) { terr += p.x * p.live; terrW += p.live }
    if (p.kind === 'try' || p.kind === 'penaltyTry') tries[p.side]++
    if (p.kind === 'penalty') pens[p.side === 0 ? 1 : 0]++
    if (p.kind === 'carry' && p.vs?.length) tackles[p.side === 0 ? 1 : 0]++
  }
  const poss = live0 + live1 > 0 ? Math.round(100 * live0 / (live0 + live1)) : 50
  const ter = terrW > 0 ? Math.round(terr / terrW) : 50
  return [
    { label: t('matchday.statPossession'), v: [poss, 100 - poss], pct: true },
    { label: t('matchday.statTerritory'), v: [ter, 100 - ter], pct: true },
    { label: t('matchday.statTries'), v: tries },
    { label: t('matchday.statTackles'), v: tackles },
    { label: t('matchday.statPensConceded'), v: pens },
  ]
}

type Queued = { kind: 'sub' | 'tactics'; off?: string; on?: string; at: number; label: string }

export function Sim2Live() {
  const game = useStore(s => s.game)!
  const live = useStore(s => s.liveMatch)!
  const { fixture } = live
  const ids: [string, string] = [fixture.homeId, fixture.awayId]
  // the run-out's state: how far through it is, and where each man is going (set with the first bake, below)
  const intro0 = useMemo(() => ({ p: live.resumed ? 1 : 0 } as { p: number; to?: { x: number; y: number }[]; cap?: [number, number] }), [fixture.id])
  // ---- the session and the stream (once per match)
  const { session, feed, from } = useMemo(() => {
    const session: Session = fromSim2(live.sim2!, game)
    const names = new Map([...session.sides[0].players, ...session.sides[1].players].map(p => [p.id, p.name]))
    const feed = new StreamFeed(session, ids, id => names.get(id))
    // A MATCH PICKED UP AGAIN (the store replays the session's save after a reload): the pitch stands where
    // it was when the app went away, not at the engine's head (the engine plays ahead of the picture)
    const was = live.resumed ? Number(readView(fixture.id) ?? -1) : -1
    if (was > 0) feed.startAt(was)
    else {
      feed.pump(40)
      // (the first frame read now, so the kick-off formation is on the pitch for the run-out to go to: the feed
      // otherwise reads only as the match steps, and the pre-match holds it at the kick-off)
      feed.seek(0)
    }
    // (the headless checks, ?hl=1 only: scripts/tmp/sim2run.mjs reads the session's record to find its moments)
    try { if (/[?&]hl=1\b/.test(location.search)) (window as unknown as { __sim2?: unknown }).__sim2 = { session, feed } } catch { /* no window */ }
    return { session, feed, from: was > 0 ? feed.n : 0 }
  }, [fixture.id])
  // (the captains lead their sides out: their slots, 0 to 29)
  if (!intro0.cap) intro0.cap = [0, 1].map(sd => { const c = session.sides[sd as 0 | 1].captain, pl = session.sides[sd as 0 | 1].players.find(p => p.id === c && p.shirt <= 15); return pl ? sd * 15 + pl.shirt - 1 : sd * 15 + 1 }) as [number, number]
  const names = useMemo(() => new Map([...session.sides[0].players, ...session.sides[1].players].map(p => [p.id, p.name])), [session])
  const nameOf = (id?: string) => (id ? names.get(id) ?? '' : '')
  // the occasion for the commentary (COMMENTARY's context.ts: the table, the form, the referee, the crowd), read
  // once at kick-off from the game as it stood
  const occasion = useMemo(() => { try { return contextFromGame(game, fixture, live.sim2?.kickoffTeams) } catch { return {} } }, [fixture.id])
  // ---- THE PRE-MATCH (overnight run): the fixture card, the run-out, the team sheets, then the kick-off; skippable,
  // not on a match picked up again. preT: seconds into it, or -1 once it is over
  const intro = useRef(intro0)
  const [preT, setPreT] = useState(live.resumed ? -1 : 0)
  // (as long as COMMENTARY's pre-match block needs, a line every 1.8 s, 11 to 21 s; set as the lines arrive)
  const preDur = useRef(PRE_END)
  // (polish round: the fixture card for the first 18%, the run-out from 12% to 64% (the two groups come out under the
  // card's going), then the team sheets, home then away)
  const preRun = () => preDur.current * 0.18, preSheets = () => preDur.current * 0.64
  const preStage = preT < 0 ? -1 : preT < preRun() ? 0 : preT < preSheets() ? 1 : preT < preSheets() + (preDur.current - preSheets()) / 2 ? 2 : 3
  const endPre = () => {
    intro.current.p = 1; setPreT(-1)
    // (the match is shown from the kick-off formation the teams ran out to, not the walk out to it)
    const ff = feed.formationFrame()
    if (ff > 0) feed.seek(ff / FPS)
  }
  const me = session.managed
  // ---- what the screen shows, read off the stream each frame
  const [n, setN] = useState(0)
  const [landed, setLanded] = useState(false)
  const [waiting, setWaiting] = useState<StreamFeed['waiting']>(null)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [sheet, setSheet] = useState<null | 'subs' | 'tactics' | 'speed'>(null)
  const [hurt, setHurt] = useState<string | null>(null)
  const [queued, setQueued] = useState<Queued[]>([])
  const [ended, setEnded] = useState(false)
  // the commentary's block at half-time or full time (the summary, the analysis, the wrap), for the card
  const blockOf = (kind: 'halfTime' | 'fullTime'): string[] => {
    let k = P.length - 1
    while (k >= 0 && P[k].kind !== kind) k--
    return k < 0 ? [] : lines.filter(l => l.n === k).map(renderLine)
  }
  const [statTab, setStatTab] = useState<'team' | 'men' | 'duels'>('team')
  // (the day's wind, set at kick-off: read once)
  const dayWind = useMemo(() => session.result().conditions?.wind, [session])
  const dayHot = useMemo(() => !!session.result().conditions?.hot, [session])
  // (what the referee is known to be hot on, the record's view of him)
  const refHot = useMemo(() => session.result().referee?.hot, [session])
  // (the game's own full time as the card comes up, as the old screen blows it before its full-time screen:
  // the session names the player of the match there. finishMatch at Continue then finds it done)
  const motm = useMemo(() => { if (!ended || !live.sim2) return undefined; try { live.sim2.finish(); return live.sim2.motm } catch { return undefined } }, [ended])
  const [talked, setTalked] = useState<HtTone | null>(null)
  const [callAt, setCallAt] = useState(0)
  const [lines, setLines] = useState<Line[]>([])
  const [ticks, setTicks] = useState<TickLine[]>([])
  // (picked up again: the last few lines before it on the ticker, not the whole match)
  const tickedTo = useRef(from > 0 ? from - 4 : -1)
  const linesFor = useRef(-1)
  const paused = !playing || !!sheet || !!hurt || !!waiting || ended || preT >= 0
  useEffect(() => {
    if (preT < 0) return
    let raf = 0, last = performance.now(), t = 0, shown = 0
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now; t += dt
      const r0 = preDur.current * 0.12
      intro.current.p = Math.max(0, Math.min(1, (t - r0) / (preSheets() - r0 - 0.2)))
      // (the ticker reads the feed's viewing clock: the pre-match lines come in on it while the match waits)
      feed.view += dt
      if (t >= preDur.current) { endPre(); return }
      // (React hears only the change of stage, not every frame)
      const st = t < preRun() ? 0 : t < preSheets() ? 1 : t < preSheets() + (preDur.current - preSheets()) / 2 ? 2 : 3
      if (st !== shown) { shown = st; setPreT(t) }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [preT < 0])
  // ---- the commentary beside the pitch (commentary.worker.ts), falling back to the main thread where there are no workers
  const cw = useMemo(() => {
    const c: { worker: Worker | null; busy: boolean; sent: number; askedAt: number } = { worker: null, busy: false, sent: 0, askedAt: 0 }
    try { if (typeof Worker !== 'undefined') c.worker = new Worker(new URL('../../livepitch/commentary.worker.ts', import.meta.url), { type: 'module' }) } catch { c.worker = null }
    return c
  }, [fixture.id])
  useEffect(() => {
    const w = cw.worker
    if (!w) return
    w.onmessage = (e: MessageEvent<{ id: number; lines: Line[] | null; error?: string }>) => {
      cw.busy = false
      if (e.data.lines) setLines(e.data.lines)
      else console.warn('commentary:', e.data.error)
    }
    // (a worker that cannot load, as in a test page without module workers: the main thread takes it back)
    w.onerror = () => { cw.worker = null; cw.busy = false; linesFor.current = -1 }
    return () => w.terminate()
  }, [cw])
  // ---- the frame loop: bake ahead, read where the pitch is, stop for the manager
  useEffect(() => {
    let raf = 0
    const loop = () => {
      const t0 = performance.now()
      // (as much baking a frame as it needs: a little when the bake is well ahead of the picture, more as the
      // picture catches up; spread thin, so no frame is spent on it: overnight run, frame cost)
      const ahead = feed.baker.live().n / FPS - feed.a
      feed.pump(paused ? 2 : ahead > 30 ? 1.2 : ahead > 15 ? 2.5 : 5)
      if (feed.n !== n) { setN(feed.n); writeView(fixture.id, feed.n) }
      if (feed.landed !== landed) setLanded(feed.landed)
      const w = feed.waiting
      if (w !== waiting) {
        setWaiting(w)
        if (w === 'penalty') setCallAt(performance.now())
        const inj = session.pendingInjury
        if (w === 'injury' && inj) { setHurt(inj.who); setSheet('subs') }
      }
      if (feed.done && !ended) setEnded(true)
      // commentary for the record so far (each time the engine has played on)
      // (in the worker when there is one: commentate() reads the whole record, 127 ms at the end of a match on a
      // desktop; one ask at a time, the newest record each time)
      // (and not every dead ball: when the pitch is within a few plays of the lines there are, when the match
      // waits for him, or a second and a half on; commentate() reads the whole record every time)
      const wantLines = feed.n >= linesFor.current - 8 || !!feed.blockedBy || performance.now() - cw.askedAt > 1500
      if (session.plays.length !== linesFor.current && !cw.busy && wantLines) {
        cw.askedAt = performance.now()
        linesFor.current = session.plays.length
        // where the session has got to, for a reload (the store writes only the small record)
        useStore.getState().noteProgress()
        const teams: [string, string] = [session.sides[0].name, session.sides[1].name]
        if (cw.worker) {
          cw.busy = true
          const P2 = session.plays, from = cw.sent
          // (only the plays since the last ask; the names and the occasion the first time)
          const { plays: _all, ...rest } = session.result()
          void _all
          cw.worker.postMessage({ id: P2.length, from, plays: P2.slice(from), rest, ...(from === 0 ? { teams, names: [...names], context: occasion } : {}) })
          cw.sent = P2.length
        }
        else {
          // (a fault in the words keeps the lines there are: the frame loop never stops for it)
          try { setLines(commentate(session.result(), { teams, player: id => names.get(id) ?? '' }, occasion)) } catch (err) { console.warn('commentary:', err) }
        }
      }
      // (the screen's own share of the frame, beside the pitch's: scripts/tmp/perf.mjs, ?hl=1 only)
      const pf = (window as unknown as { __lpPerf?: { loop?: Float32Array; li?: number } }).__lpPerf
      if (pf) { pf.loop ??= new Float32Array(600); pf.li = (pf.li ?? 0) + 1; pf.loop[pf.li % 600] = performance.now() - t0 }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [feed, n, landed, waiting, paused, ended])
  // THE SOUND AND THE BUZZ (the old screen's matchSfx, on its own switches): each moment as it lands, not in Fast
  const sfxAt = useRef(-1)
  useEffect(() => {
    if (!landed || n === sfxAt.current || speed === 2 || preT >= 0) return
    sfxAt.current = n
    const p = P[n]
    if (!p) return
    const type = p.kind === 'try' || p.kind === 'penaltyTry' ? 'TRY' : p.kind === 'conversion' && p.good ? 'CON' : p.kind === 'penaltyGoal' && p.good ? 'PEN'
      : p.kind === 'dropGoal' && p.good ? 'DG' : p.kind === 'yellowCard' ? 'YC' : p.kind === 'redCard' ? 'RC' : p.kind === 'injury' ? 'INJ'
      : p.kind === 'halfTime' ? 'HT' : p.kind === 'fullTime' ? 'FT' : p.kind === 'kickoff' && n === 0 ? 'KO' : ''
    if (type) matchSfx(type)
  }, [n, landed])
  // (a light tap when the match stops for him)
  useEffect(() => { if (waiting === 'penalty') matchSfx('PEN'); else if (waiting === 'injury') matchSfx('INJ') }, [waiting])
  // a play that carries out a decision of his own: his call, his cover, his change, his tactics or his talk (the record marks them)
  const mineOf = (p?: Play): boolean => {
    if (!p || me == null) return false
    const q = p as Play & { callBy?: string; tactics?: { side: number }; talk?: { side: number } }
    return (q.callBy === 'manager' && (p.side === me || p.ball === me)) || (p.kind === 'substitution' && p.side === me && !p.cause && p.result === 'made')
      || q.tactics?.side === me || q.talk?.side === me
  }
  // ---- the ticker: each play's lines go up as the pitch reaches it
  useEffect(() => {
    if (n <= tickedTo.current || !lines.length) return
    const add: TickLine[] = []
    const P = session.plays
    for (const l of lines) {
      if (l.n <= tickedTo.current || l.n > n) continue
      const k = P[l.n]?.kind
      // (the pre-match lines: one every 1.7 s through the pre-match, from the fixture card on)
      const pre = (l as Line & { pre?: boolean }).pre && preT >= 0
      if (pre) preDur.current = Math.min(21, Math.max(preDur.current, 0.8 + (add.length + 1) * 1.8 + 1.4))
      // (and the kick-off's own lines wait for the kick-off)
      const atKick = preT >= 0 && l.n === 0 && !pre
      add.push({ n: l.n, text: renderLine(l), at: pre ? 0.8 + add.length * 1.8 : atKick ? preDur.current + 0.3 + add.length * 0.25 : feed.view + add.length * 0.25, hold: (l as Line & { hold?: number }).hold ?? 1.2,
        flash: (l as Line & { flash?: TickLine['flash'] }).flash ?? (k === 'try' || k === 'penaltyTry' ? 'try' : k === 'yellowCard' || k === 'redCard' ? 'card' : null),
        side: l.side, card: k === 'redCard' ? 'r' : k === 'yellowCard' ? 'y' : undefined, level: l.level, mine: mineOf(P[l.n]) && MINE_LINE.test(l.key), minute: Math.min(80, Math.floor((P[l.n]?.clock ?? P[l.n]?.t ?? 0) / 60) + 1) })
    }
    tickedTo.current = n
    if (add.length) setTicks(a => [...a, ...add])
  }, [n, lines])
  // ---- a change he asked for is made (or refused) when the pitch gets to it
  useEffect(() => {
    if (!queued.length) return
    const P = session.plays
    setQueued(q => q.filter(x => {
      if (x.kind !== 'sub') return !P.slice(x.at, n + 1).some(p => p.kind !== 'substitution' && p.n > x.at && (p.kind === 'kickoff' || p.kind === 'scrum' || p.kind === 'lineout' || p.kind === 'tap'))
      const k = P.findIndex((p, i) => i >= x.at && p.kind === 'substitution' && p.who === x.off)
      return k < 0 || k > n
    }))
  }, [n])

  // ---- the parts of the screen
  const white = tokenColor('--prop-ink')
  // THE KITS WORN (kitclash.ts): the home side in its own, the away side in its own unless the two cannot be
  // told apart on the grass, then its second colour, then a neutral trimmed in its own colour. The pitch wears
  // them; the scoreboard, the ticker (edges and flash) and the stats bars follow them, reading the trim
  // where a shirt is too dark to show on the dark panel.
  const kits = useMemo(() => {
    const nt = { white, ink: tokenColor('--kit-spare-ink'), slate: tokenColor('--kit-spare-slate'), gold: tokenColor('--kit-spare-gold'), home: tokenColor('--kit-home'), away: tokenColor('--kit-away') }
    const w = wornKits(nt, game.clubs[fixture.homeId]?.colors, game.clubs[fixture.awayId]?.colors)
    // (each club's own pattern on its discs, where it does not bring the two sides closer: kitclash.ts wornPattern)
    const pat = [wornPattern(kitPattern(fixture.homeId), w.home, w.away, 'home'), wornPattern(kitPattern(fixture.awayId), w.away, w.home, w.change)] as const
    return { home: w.home, away: w.away, slate: nt.slate, pat }
  }, [fixture.id])
  const onPanel = (k: Kit): Kit => (luma(k[0]) >= 40 ? k : luma(k[1]) >= 40 ? [k[1], k[0]] : [kits.slate, k[0]])
  const panel = { home: onPanel(kits.home), away: onPanel(kits.away) }
  const pitchSide = (s: 0 | 1): PitchSide => {
    const xi = session.sides[s].players.filter(p => p.shirt <= 15).sort((a, b) => a.shirt - b.shirt)
    return { lineup: Array.from({ length: 15 }, (_, i) => { const p = xi.find(z => z.shirt === i + 1); return p ? Number(p.id) : null }), nums: Array.from({ length: 15 }, (_, i) => i + 1), kit: s === 0 ? kits.home : kits.away, pattern: kits.pat[s] }
  }
  const night = useMemo(() => { let h = 0; for (const ch of String(fixture.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 3 === 0 }, [fixture.id])
  const boards = useMemo(() => [...new Set([...SPONSOR_NAMES.shirt, ...SPONSOR_NAMES.sleeve])].slice(0, 12), [])
  const P = session.plays
  const p = P[Math.min(n, P.length - 1)]
  const score = ended ? session.result().score : p ? (landed ? p.score : (P[n - 1]?.score ?? [0, 0])) : [0, 0]
  const clock = p ? (p.clock ?? p.t) : 0
  const minute = ended ? t('matchday.fullTime') : waiting === 'halfTime' ? t('matchday.halfTime') : `${Math.min(80, Math.floor(clock / 60) + 1)}'`
  const cards = (side: 0 | 1) => {
    const out: string[] = []
    for (let k = 0; k <= n && k < P.length; k++) { const c = P[k]; if (c.side !== side) continue; if (c.kind === 'redCard') out.push('rc'); if (c.kind === 'yellowCard' && (c.until ?? c.t + 600) > (p?.t ?? 0)) out.push('yc') }
    return out.length ? <span className="tcards" data-testid="tcards">{out.map((c, i) => <i key={i} className={c} />)}</span> : null
  }
  const stats = statsTo(P, landed ? n : n - 1)
  // THE OTHER COACH CHANGES IT (overnight run, the record's `coach`): a small plate with his reason, from the play
  // it takes effect on, for four plays
  const coachNote = useMemo(() => {
    for (let k = n; k >= 0 && k > n - 4; k--) {
      const c = (P[k] as Play & { coach?: { side: 0 | 1; reason: string } })?.coach
      if (c && (k < n || landed)) return { n: k, side: c.side, reason: c.reason }
    }
    return null
  }, [n, landed])
  const terr = useMemo(() => {
    const at = Math.max(0, Math.min(P.length - 1, landed ? n : n - 1)), now = P[at]?.t ?? 0
    const [h, a] = territory(P, at, now - 600)
    // (home attacks towards x = 100: its share is the time spent in the other half)
    return h + a > 0 ? Math.round(100 * h / (h + a)) : 50
  }, [n, landed])

  // ---- his decisions
  const subOn = (off: string, on: string) => {
    if (me == null) return
    const at = P.length
    // his man for the hurt man the match is waiting on, or a change of his own at the next stoppage
    if (hurt === off && session.pendingInjury) session.cover(on)
    else session.apply({ kind: 'substitution', side: me, off, on })
    setQueued(q => [...q, { kind: 'sub', off, on, at, label: t('sim2.subQueued', { on: nameOf(on), off: nameOf(off) }) }])
    feed.baker.more()
    setHurt(null); setSheet(null)
  }
  const tactic = (key: string, v: number) => {
    if (me == null) return
    // (the session writes it on the club's tactic and runs the game's own applyTacticsChange)
    const at = P.length
    session.apply({ kind: 'tactics', side: me, set: { [key]: v } })
    setQueued(q => [...q.filter(x => x.kind !== 'tactics'), { kind: 'tactics', at, label: t('sim2.tacQueued') }])
  }
  const call = (c: PenaltyCall | null) => { session.answer(c); feed.baker.more(); setWaiting(null) }
  const startSecond = () => { if (me != null && talked) session.apply({ kind: 'talk', side: me, tone: talked }); feed.releaseHalfTime(); feed.baker.more(); setWaiting(null); setTalked(null) }
  const skipToEnd = () => { session.playOut(); setEnded(true) }
  // the captain makes the call if he lets the timer run out
  useEffect(() => {
    if (waiting !== 'penalty') return
    const tm = setTimeout(() => call(null), CALL_S * 1000)
    return () => clearTimeout(tm)
  }, [waiting])
  const pend = session.pending
  // WHAT EACH CALL HAS GOING FOR IT, from today's record (overnight run): the range and angle for the posts, his
  // lineouts and scrums so far today for the corner and the scrum, the distance for a tap
  const callHint = (o: PenaltyCall): string => {
    if (!pend || me == null) return ''
    const upto = P.slice(0, n + 1)
    if (o === 'posts') return t('lp.hintPosts', { d: Math.round(pend.toLine), w: Math.round(Math.min(pend.y, 70 - pend.y)) })
    if (o === 'tap') return t('lp.hintTap', { d: Math.round(pend.toLine) })
    const kind = o === 'corner' ? 'lineout' : 'scrum'
    const own = upto.filter(p => p.kind === kind && p.side === me && p.result !== 'quick')
    const won = own.filter(p => p.ball === me).length
    return own.length ? t(o === 'corner' ? 'lp.hintCorner' : 'lp.hintScrum', { w: won, n: own.length }) : t(o === 'corner' ? 'lp.hintNoLineout' : 'lp.hintNoScrum')
  }
  // the call his captain would make if he leaves it (the session's own, by the score and the clock)
  const captainPick = useMemo(() => { try { return waiting === 'penalty' && live.sim2?.pending ? live.sim2.defaultCall() : null } catch { return null } }, [waiting, callAt])
  const lineup = me != null ? session.lineup(me) : null
  const refusals = P.filter(x => x.kind === 'substitution' && x.side === me && x.result === 'refused').slice(-1)

  return (
    <div className="live-wrap full-match sim2" data-testid="sim2-live" data-sim2-n={n} data-sim2-waiting={waiting ?? ''} data-sim2-ended={ended ? '1' : '0'}>
      <div className="scoreboard" style={{ '--home-c': panel.home[0], '--away-c': panel.away[0] } as React.CSSProperties}>
        <div className="teams">
          <div className="tname"><CrestT g={game} teamId={fixture.homeId} size={26} />{teamShort(game, fixture.homeId)}<span className="clubbar" style={{ background: panel.home[0] }} />{cards(0)}</div>
          <div className="score sb-score" data-testid="sim2-score"><Roll v={score[0]} /> – <Roll v={score[1]} /></div>
          <div className="tname"><CrestT g={game} teamId={fixture.awayId} size={26} />{teamShort(game, fixture.awayId)}<span className="clubbar" style={{ background: panel.away[0] }} />{cards(1)}</div>
        </div>
        <div className="minute">
          {minute}
          {compLabel(game.comps[fixture.compId]?.short) ? ` · ${compLabel(game.comps[fixture.compId]?.short)}` : ''}
          {fixture.weather && fixture.weather !== 'Dry' ? <> · <Glyph name={WEATHER_ICON[fixture.weather]} /> {weatherWord(fixture.weather)}</> : ''}
        </div>
        {/* TERRITORY, THE LAST TEN MINUTES (overnight run: a broadcast bar's momentum strip): where the ball has been
            played, home's share from the left in its colour, eased as the record moves */}
        <div className="sb-terr" aria-hidden="true"><i style={{ width: `${terr}%`, background: panel.home[0] }} /><i style={{ background: panel.away[0] }} /></div>
      </div>
      {!ended && (
        <div className={`sim2-stage${preT >= 0 ? ' pre' : ''}${waiting === 'halfTime' ? ' ht' : ''}`}>
          <LivePitch feed={feed} events={[]} cursor={0} homeId={fixture.homeId} paused={paused} speed={SPEEDS[speed].x} intro={intro.current} wind={dayWind} crowd={(occasion as { attendance?: number; capacity?: number }).capacity ? Math.min(1, ((occasion as { attendance?: number }).attendance ?? 0) / (occasion as { capacity: number }).capacity) : undefined}
            home={pitchSide(0)} away={pitchSide(1)} night={night} wet={fixture.weather === 'Rain'} snow={fixture.weather === 'Snow'} boards={boards}
            tr={(k, v) => t(k, v)} teams={{ home: teamShort(game, fixture.homeId), away: teamShort(game, fixture.awayId) }} names={id => names.get(String(id))} />
          {preStage === 0 && (
            <div className="pre-card" data-testid="pre-card">
              <div className="pre-comp">{[compLabel(game.comps[fixture.compId]?.name) ?? compLabel(game.comps[fixture.compId]?.short), fixture.stage ? '' : t('lp.preRound', { n: fixture.round + 1 })].filter(Boolean).join(' · ')}</div>
              <div className="pre-teams">
                <div><CrestT g={game} teamId={fixture.homeId} size={44} /><b>{teamShort(game, fixture.homeId)}</b></div>
                <span className="pre-v">v</span>
                <div><CrestT g={game} teamId={fixture.awayId} size={44} /><b>{teamShort(game, fixture.awayId)}</b></div>
              </div>
              <div className="pre-meta">{t('lp.preRef', { ref: refFor(fixture.id).name })}{refHot ? <> · {t(`lp.refHot_${refHot}`)}</> : null}{(occasion as { venue?: string }).venue ? <> · {(occasion as { venue?: string }).venue}</> : null}</div>
              <div className="pre-meta">{night ? t('lp.preLights') : t('lp.preDay')}{dayHot ? <> · {t('lp.preHot')}</> : null}{fixture.weather && fixture.weather !== 'Dry' ? <> · <Glyph name={WEATHER_ICON[fixture.weather]} /> {weatherWord(fixture.weather)}</> : null}</div>
            </div>
          )}
          {/* THE TEAM SHEETS, HOME THEN AWAY (polish round: at 360 x 640 the two sheets side by side covered the whole
              stadium). One side at a time across the foot of the pitch, its fifteen in two tight columns (the pack, the
              backs), the bench on one line: the stand and the men in their places stay in view above it. */}
          {(preStage === 2 || preStage === 3) && (() => {
            const sd = preStage === 2 ? 0 : 1
            const side = session.sides[sd as 0 | 1], cap = side.captain
            const kick = goalKicker(game, sd === 0 ? live.ctx.home : live.ctx.away)
            const xv = side.players.filter(p => p.shirt <= 15).sort((a, b) => a.shirt - b.shirt), bench = side.players.filter(p => p.shirt > 15).sort((a, b) => a.shirt - b.shirt)
            const last = (nm: string) => nm.split(' ').slice(-1)[0]
            const man = (p: (typeof xv)[number]) => (
              <div key={p.id} className="pre-man"><i>{p.shirt}</i><span>{last(p.name)}</span>
                {p.id === cap && <em className="pre-mark">{t('lp.preCaptain')}</em>}{kick && String(kick.id) === p.id && <em className="pre-mark k">{t('lp.preKicker')}</em>}</div>
            )
            return (
              <div className="pre-sheets" data-testid="pre-sheets">
                <div key={sd} className="pre-sheet" data-side={sd} style={{ '--side-c': (sd === 0 ? panel.home : panel.away)[0] } as React.CSSProperties}>
                  <div className="pre-sheet-h"><CrestT g={game} teamId={sd === 0 ? fixture.homeId : fixture.awayId} size={16} />{teamShort(game, sd === 0 ? fixture.homeId : fixture.awayId)}</div>
                  <div className="pre-cols"><div>{xv.filter(p => p.shirt <= 8).map(man)}</div><div>{xv.filter(p => p.shirt > 8).map(man)}</div></div>
                  <div className="pre-bench"><b>{t('lp.preBench')}</b> {bench.map(p => last(p.name)).join(', ')}</div>
                </div>
              </div>
            )
          })()}
          {coachNote && (
            <div className="coach-plate" key={coachNote.n} data-testid="coach-plate" style={{ '--side-c': (coachNote.side === 0 ? panel.home : panel.away)[0] } as React.CSSProperties}>
              <b>{t('lp.coachOf', { team: teamShort(game, coachNote.side === 0 ? fixture.homeId : fixture.awayId) })}</b>
              <span>{t(`lp.coach_${coachNote.reason}`)}</span>
            </div>
          )}
          {preT >= 0 && <button className="pre-skip" data-ctl="skip-pre" onClick={endPre}>{t('lp.preSkip')}</button>}
        </div>
      )}
      {!ended && (
        <div className="speed-controls">
          <button className={`btn ctl-ico ${playing ? 'ghost' : 'gold'}`} data-ctl="play" aria-label={t(playing ? 'matchday.pause' : 'matchday.resume')} onClick={() => setPlaying(!playing)}>{playing ? <IcoPause /> : <IcoPlay />}</button>
          <button className={`btn ctl-ico ${sheet === 'subs' ? 'gold' : 'ghost'}`} data-ctl="squad" aria-label={t('matchday.squadTitle')} disabled={me == null} onClick={() => setSheet('subs')}><IcoPeople /></button>
          <button className={`btn ${sheet === 'tactics' ? 'gold' : 'ghost'}`} data-ctl="tactics" aria-label={t('sim2.tactics')} disabled={me == null} onClick={() => setSheet('tactics')}><Glyph name="tactics" /></button>
          <button className="btn ghost" data-ctl="speed" aria-label={t('matchday.commentarySpeed')} onClick={() => setSpeed((speed + 1) % 3)}>{t(SPEEDS[speed].k)}</button>
          <button className="btn ctl-ico ghost" data-ctl="skip-end" aria-label={t('sim2.skipEnd')} onClick={skipToEnd}><IcoFastForward /></button>
        </div>
      )}
      {!ended && waiting !== 'halfTime' && (
        <div className="now-strip">
          {queued.length > 0 && (
            <div className="sim2-queued" data-testid="sim2-queued">{queued.map((q, i) => <div key={i}>{q.label}</div>)}</div>
          )}
          {refusals.length > 0 && refusals[0].n >= n - 3 && (
            <div className="sim2-queued refused">{t('sim2.subRefused', { why: t(REFUSED_WHY[refusals[0].cause ?? ''] ?? 'sim.whyLaws1', { player: nameOf(refusals[0].who), player2: nameOf(refusals[0].with?.[0]) }) })}</div>
          )}
          <Ticker lines={ticks} feed={feed} kits={panel} hush={!landed && ['conversion', 'penaltyGoal'].includes(P[n]?.kind ?? '')} />
          <div className="live-stats brief" data-testid="live-stats">
            {/* (overnight run) a tap between the team's numbers and the men's: the top carriers and tacklers so far */}
            <div className="ls-tabs" role="tablist">
              <button role="tab" aria-selected={statTab === 'team'} className={statTab === 'team' ? 'on' : ''} data-stat-tab="team" onClick={() => setStatTab('team')}>{t('lp.stTeam')}</button>
              <button role="tab" aria-selected={statTab === 'men'} className={statTab === 'men' ? 'on' : ''} data-stat-tab="men" onClick={() => setStatTab('men')}>{t('lp.stMen')}</button>
              <button role="tab" aria-selected={statTab === 'duels'} className={statTab === 'duels' ? 'on' : ''} data-stat-tab="duels" onClick={() => setStatTab('duels')}>{t('lp.stDuels')}</button>
            </div>
            {statTab === 'duels' && <Duels session={session} upto={landed ? n : n - 1} nameOf={nameOf} kits={panel} />}
            {statTab === 'men' && <MenStats P={P} upto={landed ? n : n - 1} nameOf={nameOf} kits={panel} />}
            {statTab === 'team' && stats.map(r => {
              const share = r.v[0] + r.v[1] > 0 ? r.v[0] / (r.v[0] + r.v[1]) : 0.5
              return <div key={r.label} className="ls-row">
                <b>{r.v[0]}{r.pct ? '%' : ''}</b>
                <span className="ls-mid"><span className="ls-label">{r.label}</span>
                  <span className="ls-bar"><i style={{ width: `${(share * 100).toFixed(1)}%`, background: panel.home[0] }} /><i style={{ width: `${((1 - share) * 100).toFixed(1)}%`, background: panel.away[0] }} /></span></span>
                <b>{r.v[1]}{r.pct ? '%' : ''}</b>
              </div>
            })}
          </div>
        </div>
      )}

      {/* THE PENALTY CALL: the match waits for him, the captain's call if the bar runs out */}
      {waiting === 'penalty' && pend && (
        <div className="card sim2-call" data-testid="sim2-call" role="dialog">
          <div className="sim2-call-h">
            <div><h3>{t('matchday.penCall')}</h3><div className="meta">{t('sim2.penOut', { n: Math.round(pend.toLine) })}</div></div>
            {/* (the time left as a calm ring, not a bar racing away; the captain calls it when it closes) */}
            <svg className="sim2-ring" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15" className="bg" /><circle key={callAt} cx="18" cy="18" r="15" className="fg" style={{ animationDuration: `${CALL_S}s` }} /></svg>
          </div>
          <div className="sim2-opts">
            {pend.options.map(o => (
              <button key={o} className="btn ghost" data-call={o} onClick={() => call(o)}>
                <Glyph name={o === 'posts' ? 'posts' : o === 'tap' ? 'bolt' : o === 'corner' ? 'attack' : 'team'} />
                <b>{o === 'posts' ? t('matchday.optPosts') : o === 'corner' ? t('matchday.optCorner') : o === 'tap' ? t('matchday.optTap') : t('matchday.optScrum')}</b>
                <small className="sim2-hint">{callHint(o)}</small>
              </button>
            ))}
          </div>
          <button className="btn ghost block" data-call="captain" onClick={() => call(null)}>{t('sim2.captainCall')}{captainPick ? <small className="sim2-hint"> · {t('lp.hintCaptain', { call_k: CALL_KEY[captainPick] })}</small> : null}</button>
        </div>
      )}

      {/* HALF-TIME: the match stops for his talk, with the half's stats */}
      {waiting === 'halfTime' && !ended && (
        <div className="content ticker panel-area" data-testid="sim2-ht">
          <MatchCard kind="ht" P={P} upto={P.length - 1} game={game} fixture={fixture} nameOf={nameOf} kits={panel} block={blockOf('halfTime')} />
          {/* THE ASSISTANT'S WORD, as the old half-time screen gives it (Panels.tsx): what is working and what is
              hurting, off the first half's evidence (the session fills ctx.htEv from the record), and the dial that
              answers it. Its tap opens the tactics sheet at that dial (the old screen scrolls to its own panel). */}
          <div onClickCapture={e => {
            const b = (e.target as HTMLElement).closest<HTMLElement>('[data-ht-lever]')
            if (!b) return
            const dial = b.dataset.htLever
            setSheet('tactics')
            window.setTimeout(() => {
              const row = document.querySelector<HTMLElement>(`.settings-sheet [data-dial="${dial}"]`)
              if (!row) return
              row.scrollIntoView({ block: 'center' }); row.style.outline = '2px solid var(--gold)'
              window.setTimeout(() => { row.style.outline = '' }, 1600)
            }, 60)
          }}><HalfTimeWord /></div>
          <div className="card" style={{ margin: '8px 14px' }}>
            <div className="fact-label">{t('sim2.talk')}</div>
            <div className="sim2-opts">
              {HT_TONES.map(tone => (
                <button key={tone} data-talk={tone} className={`btn ${talked === tone ? 'gold' : 'ghost'}`} onClick={() => setTalked(tone)}>
                  {t(`matchday.talk${tone[0].toUpperCase()}${tone.slice(1)}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="btn-row" style={{ margin: '4px 14px' }}>
            <button className="btn ghost" data-ctl="ht-subs" onClick={() => setSheet('subs')}><IcoPeople /> {t('matchday.squadTitle')}</button>
            <button className="btn ghost" data-ctl="ht-tactics" onClick={() => setSheet('tactics')}><Glyph name="tactics" /> {t('sim2.tactics')}</button>
          </div>
          <button className="btn gold block" data-ctl="second-half" style={{ margin: '8px 14px' }} onClick={startSecond}>{t('matchday.startSecondHalf')}</button>
        </div>
      )}

      {/* FULL TIME */}
      {ended && (
        <div className="content ticker panel-area" data-testid="sim2-ft">
          <MatchCard kind="ft" P={P} upto={P.length - 1} game={game} fixture={fixture} nameOf={nameOf} kits={panel} motm={motm} block={blockOf('fullTime')} />
          <button className="btn gold block ft-continue" data-ctl="continue" style={{ margin: '8px 14px' }} onClick={handOver}>{t('matchday.continueToResults')}</button>
        </div>
      )}

      {/* THE SUBSTITUTION SHEET: his fifteen and his bench, as the engine has them now */}
      {sheet === 'subs' && lineup && me != null && (
        <SubSheet session={session} side={me} nameOf={nameOf} hurt={hurt} n={n} cover={hurt ? session.pendingInjury : null}
          onPick={subOn} onClose={() => { if (!hurt) setSheet(null) }} />
      )}
      {sheet === 'tactics' && me != null && (
        <Veil onClose={() => setSheet(null)} boxClassName="modal settings-sheet">
          <div className="grab" />
          <h3 style={{ fontSize: '1rem', margin: '2px 16px 8px' }}>{t('sim2.tactics')}</h3>
          <div className="meta" style={{ margin: '0 16px 8px' }}>{t('sim2.tacNote')}</div>
          {SLIDER_INFO.slice(0, 5).map(s => {
            const tac = game.clubs[session.sides[me].teamId]?.tactic as unknown as Record<string, number> | undefined
            const v = tac?.[s.key] ?? 50
            return (
              <div key={s.key} className="ms-rows" data-dial={s.key} style={{ margin: '0 16px' }}>
                <div className="set-label">{t(s.label)}</div>
                <input type="range" min={0} max={100} step={5} defaultValue={v} data-tac={s.key}
                  onChange={e => tactic(s.key, Number((e.target as HTMLInputElement).value))} style={{ width: '100%' }} />
              </div>
            )
          })}
          <button className="btn gold block" style={{ marginTop: 10 }} onClick={() => setSheet(null)}>{t('matchday.backToMatch')}</button>
        </Veil>
      )}
      {!ended && !sheet && !waiting && <AdSlot place="match-foot" />}
    </div>
  )
}

/** the substitution sheet: tap the man off, then the man on */
function SubSheet({ session, side, nameOf, hurt, n, cover, onPick, onClose }: {
  session: Session; side: 0 | 1; nameOf: (id?: string) => string; hurt: string | null; n: number
  cover: Session['pendingInjury']
  onPick: (off: string, on: string) => void; onClose: () => void
}) {
  const lu = session.lineup(side)!
  const [off, setOff] = useState<string | null>(hurt)
  const P = session.plays
  // who is in the bin, sent off or hurt, from what the pitch has shown
  const binned = new Set<string>(), gone = new Set<string>()
  for (let k = 0; k <= n && k < P.length; k++) { const p = P[k]; if (p.side !== side || !p.who) continue; if (p.kind === 'yellowCard') binned.add(p.who); if (p.kind === 'redCard') gone.add(p.who); if (p.kind === 'injury') gone.add(p.who) }
  const used = P.filter(p => p.kind === 'substitution' && p.side === side && p.result === 'made').length
  return (
    <Veil onClose={onClose} boxClassName="modal settings-sheet">
      <div className="grab" />
      <h3 style={{ fontSize: '1rem', margin: '2px 16px 4px' }}>{hurt ? t('sim2.hurtTitle', { player: nameOf(hurt) }) : t('matchday.squadTitle')}</h3>
      <div className="meta" style={{ margin: '0 16px 8px' }}>{t('sim2.subNote', { n: used })}</div>
      <div className="sim2-sheet">
        <div>
          <div className="fact-label">{t('sim2.onField')}</div>
          {lu.field.map((id, i) => (
            <button key={id + i} className={`btn ${off === id ? 'gold' : 'ghost'} sim2-man`} data-off={id} disabled={!id || binned.has(id) || (!!hurt && id !== hurt)} onClick={() => setOff(id)}>
              <span className="num">{i + 1}</span> {nameOf(id)}{binned.has(id) ? ' (bin)' : gone.has(id) ? ' (hurt)' : ''}
            </button>
          ))}
        </div>
        <div>
          <div className="fact-label">{t('sim2.bench')}</div>
          {lu.bench.map((id, i) => (
            <button key={(id || 'x') + i} className={`btn ${cover?.like === id ? 'gold' : 'ghost'} sim2-man`} data-on={id} disabled={!id || !off || (!!cover && !cover.options.includes(id))} onClick={() => off && id && onPick(off, id)}>
              <span className="num">{16 + i}</span> {id ? nameOf(id) : t('sim2.used')}
            </button>
          ))}
        </div>
      </div>
      {!hurt && <button className="btn gold block" style={{ marginTop: 10 }} onClick={onClose}>{t('matchday.backToMatch')}</button>}
    </Veil>
  )
}

/** FULL TIME: the watched match to the game's normal flow. The store's finishMatch runs session.finish()
 *  (the game's own full time and finalizeMatch on the record watched) and turns the week as now. */
function handOver() {
  const lm = useStore.getState().liveMatch
  if (lm) writeView(lm.fixture.id, null)
  useStore.getState().finishMatch()
}

/** where the pitch is, kept on the device for a reload (the store keeps the session's save; the play the
 *  screen had reached is the screen's own) */
const VIEW_KEY = (fxId: number | string) => `lp.sim2view.${fxId}`
function readView(fxId: number | string): string | null { try { return localStorage.getItem(VIEW_KEY(fxId)) } catch { return null } }
function writeView(fxId: number | string, n: number | null) { try { if (n == null) localStorage.removeItem(VIEW_KEY(fxId)); else localStorage.setItem(VIEW_KEY(fxId), String(n)) } catch { /* private mode */ } }

/** A SCORE THAT ROLLS (overnight run): the new number drops into place as the old one goes, in the instant the
 *  ticker flashes (both land with the play) */
function Roll({ v }: { v: number }) {
  return <span className="sb-roll"><span key={v}>{v}</span></span>
}

/** WHAT A MAN DID, from the record (as toResult.ts counts it): carries and metres, tackles, line breaks, tries */
function manLine(P: Play[], id: string) {
  const m = { carries: 0, metres: 0, tackles: 0, breaks: 0, tries: 0 }
  for (const p of P) {
    if ((p.kind === 'carry' || p.kind === 'lineBreak') && p.who === id) { m.carries++; m.metres += Math.max(0, p.gain ?? 0); if (p.kind === 'lineBreak') m.breaks++ }
    if (p.kind === 'carry' && p.vs?.[0] === id) m.tackles++
    if ((p.kind === 'try' || p.kind === 'penaltyTry') && p.who === id) m.tries++
  }
  m.metres = Math.round(m.metres)
  return m
}

/** HALF-TIME AND FULL-TIME AS MOMENTS (overnight run): the score between the crests, who scored and when, the three
 *  numbers that most tell the story so far (the ones where the sides are furthest apart), and at full time the
 *  player of the match with his own numbers. It rises in, its bars fill; then the game's own flow. */
function MatchCard({ kind, P, upto, game, fixture, nameOf, kits, motm, block }: {
  kind: 'ht' | 'ft'; P: Play[]; upto: number; game: GameState; fixture: Fixture; nameOf: (id?: string) => string
  kits: { home: [string, string]; away: [string, string] }; motm?: string; block?: string[]
}) {
  const last = P[Math.max(0, Math.min(upto, P.length - 1))]
  const score = last?.score ?? [0, 0]
  const surname = (id?: string) => nameOf(id).split(' ').slice(-1)[0]
  const minOf = (p: Play) => Math.min(80, Math.floor((p.clock ?? p.t) / 60) + 1)
  // the tries, side by side, and each side's goal kicker's count
  const tries: [string[], string[]] = [[], []]
  const kicks: [Map<string, [number, number]>, Map<string, [number, number]>] = [new Map(), new Map()]
  let breaks: [number, number] = [0, 0], turns: [number, number] = [0, 0]
  for (let k = 0; k <= upto && k < P.length; k++) {
    const p = P[k]
    if ((p.kind === 'try' || p.kind === 'penaltyTry') && (p.side === 0 || p.side === 1)) tries[p.side].push(`${p.kind === 'penaltyTry' ? '' : surname(p.who)} ${minOf(p)}'`.trim())
    if ((p.kind === 'conversion' || p.kind === 'penaltyGoal' || p.kind === 'dropGoal') && (p.side === 0 || p.side === 1) && p.who) {
      const m = kicks[p.side], c = m.get(p.who) ?? [0, 0]; c[1]++; if (p.good) c[0]++; m.set(p.who, c)
    }
    if (p.kind === 'lineBreak' && (p.side === 0 || p.side === 1)) breaks[p.side]++
    if (((p.kind === 'ruck' && p.result === 'turnover') || (p.kind === 'lineout' && p.result === 'stolen') || (p.kind === 'scrum' && p.result === 'againstTheHead')) && (p.ball === 0 || p.ball === 1)) turns[p.ball]++
  }
  breaks = [breaks[0], breaks[1]]; turns = [turns[0], turns[1]]
  const all = [...statsTo(P, upto), { label: t('lp.mcBreaksLabel'), v: breaks }, { label: t('lp.mcTurnLabel'), v: turns }]
  const story = [...all].map(r => ({ r, d: Math.abs(r.v[0] - r.v[1]) / Math.max(1, r.v[0] + r.v[1]) })).sort((a, b) => b.d - a.d).slice(0, 3).map(x => x.r)
  const pm = kind === 'ft' && motm ? { id: motm, ...manLine(P, motm) } : null
  const side = (s: 0 | 1) => (
    <div className="mc-side">
      {tries[s].map((x, i) => <div key={i} className="mc-try">{x}</div>)}
      {[...kicks[s]].map(([id, [made, of]]) => <div key={id} className="mc-kick">{t('lp.mcKicks', { player: surname(id), made, of })}</div>)}
    </div>
  )
  return (
    <div className={`card mcard ${kind}`} data-testid={`match-card-${kind}`} style={{ '--home-c': kits.home[0], '--away-c': kits.away[0] } as React.CSSProperties}>
      <div className="mc-label">{t(kind === 'ht' ? 'matchday.halfTime' : 'matchday.fullTime')}</div>
      <div className="mc-score">
        <div className="mc-team"><CrestT g={game} teamId={fixture.homeId} size={34} /><span>{teamShort(game, fixture.homeId)}</span></div>
        <div className="mc-num"><b>{score[0]}</b><i>–</i><b>{score[1]}</b></div>
        <div className="mc-team"><CrestT g={game} teamId={fixture.awayId} size={34} /><span>{teamShort(game, fixture.awayId)}</span></div>
      </div>
      {tries[0].length + tries[1].length + kicks[0].size + kicks[1].size > 0
        ? <div className="mc-scorers">{side(0)}{side(1)}</div>
        : <div className="mc-none">{t('lp.mcNone')}</div>}
      <div className="mc-stats">
        {story.map((r, i) => {
          const share = r.v[0] + r.v[1] > 0 ? r.v[0] / (r.v[0] + r.v[1]) : 0.5
          return (
            <div key={r.label} className="mc-stat" style={{ animationDelay: `${0.15 + i * 0.1}s` }}>
              <b>{r.v[0]}{r.pct ? '%' : ''}</b>
              <span className="mc-mid"><span className="mc-lab">{r.label}</span><span className="mc-bar"><i style={{ width: `${(share * 100).toFixed(1)}%` }} /><i /></span></span>
              <b>{r.v[1]}{r.pct ? '%' : ''}</b>
            </div>
          )
        })}
      </div>
      {/* (the commentary's own block, a line every 0.8 s, so it can be read: COMMENTARY, overnight run) */}
      {block && block.length > 0 && (
        <div className="mc-block" data-testid={`block-${kind}`}>
          {block.map((x, i) => <p key={i} style={{ animationDelay: `${0.6 + i * 0.8}s` }}>{x}</p>)}
        </div>
      )}
      {pm && (
        <div className="mc-potm" data-testid="potm">
          <div className="mc-potm-l">{t('lp.mcPotm')}</div>
          <div className="mc-potm-n">{nameOf(pm.id)}</div>
          <div className="mc-potm-s">{[pm.tries ? (pm.tries === 1 ? t('lp.mcTry1') : t('lp.mcTries', { n: pm.tries })) : '', pm.carries ? t('lp.mcCarries', { n: pm.carries }) : '', pm.metres ? t('lp.mcMetres', { n: pm.metres }) : '', pm.tackles ? t('lp.mcTackles', { n: pm.tackles }) : '', pm.breaks ? t('lp.mcBreaks', { n: pm.breaks }) : ''].filter(Boolean).join(' · ')}</div>
        </div>
      )}
    </div>
  )
}

/** THE MEN SO FAR (overnight run): the three who have carried most (with their metres) and the three who have
 *  tackled most, both sides together, each marked in his side's colour, from the record as far as the pitch has got */
function MenStats({ P, upto, nameOf, kits }: { P: Play[]; upto: number; nameOf: (id?: string) => string; kits: { home: [string, string]; away: [string, string] } }) {
  const rows = useMemo(() => {
    const car = new Map<string, { n: number; m: number; s: number }>(), tk = new Map<string, { n: number; s: number }>()
    for (let k = 0; k <= upto && k < P.length; k++) {
      const p = P[k]
      if ((p.kind === 'carry' || p.kind === 'lineBreak') && p.who && (p.side === 0 || p.side === 1)) { const c = car.get(p.who) ?? { n: 0, m: 0, s: p.side }; c.n++; c.m += Math.max(0, p.gain ?? 0); car.set(p.who, c) }
      if (p.kind === 'carry' && p.vs?.[0] && (p.side === 0 || p.side === 1)) { const c = tk.get(p.vs[0]) ?? { n: 0, s: p.side === 0 ? 1 : 0 }; c.n++; tk.set(p.vs[0], c) }
    }
    return {
      car: [...car].sort((a, b) => b[1].n - a[1].n || b[1].m - a[1].m).slice(0, 3),
      tk: [...tk].sort((a, b) => b[1].n - a[1].n).slice(0, 3),
    }
  // (the counts change only when the pitch reaches another play)
  }, [upto])
  const surname = (id: string) => nameOf(id).split(' ').slice(-1)[0]
  const dot = (s: number) => <i className="ls-man-dot" style={{ background: (s === 0 ? kits.home : kits.away)[0] }} />
  const top = Math.max(1, rows.car[0]?.[1].n ?? 1), topT = Math.max(1, rows.tk[0]?.[1].n ?? 1)
  return (
    <div className="ls-men">
      <div className="ls-men-col">
        <div className="ls-label">{t('lp.stCarries')}</div>
        {rows.car.map(([id, c]) => <div key={id} className="ls-man">{dot(c.s)}<span>{surname(id)}</span><b>{c.n}</b><small>{Math.round(c.m)} m</small><em style={{ width: `${(100 * c.n / top).toFixed(0)}%` }} /></div>)}
      </div>
      <div className="ls-men-col">
        <div className="ls-label">{t('lp.stTackles')}</div>
        {rows.tk.map(([id, c]) => <div key={id} className="ls-man">{dot(c.s)}<span>{surname(id)}</span><b>{c.n}</b><em style={{ width: `${(100 * c.n / topT).toFixed(0)}%` }} /></div>)}
      </div>
    </div>
  )
}

/** THE DUELS SO FAR (overnight run, the record's duels: skeleton.ts duelsOf): the scrum, the breakdown and the
 *  lineout steals side against side, and each side's top carrier, tackler and most-penalised man */
function Duels({ session, upto, nameOf, kits }: { session: Session; upto: number; nameOf: (id?: string) => string; kits: { home: [string, string]; away: [string, string] } }) {
  // (counted off the plays the pitch has reached, not the engine's head)
  const du = useMemo(() => duelsOf(session.plays.slice(0, upto + 1)), [upto, session])
  if (!du) return <div className="mc-none">{t('lp.mcNone')}</div>
  const surname = (id?: string) => (id ? nameOf(id).split(' ').slice(-1)[0] : '')
  const bar = (label: string, v: [number, number]) => {
    const share = v[0] + v[1] > 0 ? v[0] / (v[0] + v[1]) : 0.5
    return <div key={label} className="ls-row"><b>{v[0]}</b><span className="ls-mid"><span className="ls-label">{label}</span>
      <span className="ls-bar"><i style={{ width: `${(share * 100).toFixed(1)}%`, background: kits.home[0] }} /><i style={{ width: `${((1 - share) * 100).toFixed(1)}%`, background: kits.away[0] }} /></span></span><b>{v[1]}</b></div>
  }
  const man = (label: string, a?: { who?: string; n?: number; m?: number }, b?: { who?: string; n?: number; m?: number }, unit = '') => (
    <div key={label} className="ls-row duel-men"><span>{surname(a?.who)} <small>{a ? (a.m ?? a.n ?? 0) + unit : ''}</small></span>
      <span className="ls-label">{label}</span><span>{surname(b?.who)} <small>{b ? (b.m ?? b.n ?? 0) + unit : ''}</small></span></div>
  )
  return (
    <>
      {bar(t('lp.duScrum'), du.scrum)}
      {bar(t('lp.duBreakdown'), du.breakdown)}
      {bar(t('lp.duSteals'), du.steals)}
      {man(t('lp.duCarrier'), du.carrier[0], du.carrier[1], ' m')}
      {man(t('lp.duTackler'), du.tackler[0], du.tackler[1])}
      {man(t('lp.duCulprit'), du.culprit[0], du.culprit[1])}
    </>
  )
}
