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
import { t, compLabel } from '../../../game/i18n'
import { teamShort } from '../../../game/matchEngine'
import { SLIDER_INFO } from '../../../game/tactics'
import { HT_TONES, type HtTone } from '../../../game/teamtalk'
import { commentate, render as renderLine, type Line } from '../../../game/sim/commentary'
import type { Play, PenaltyCall } from '../../../game/sim/record'
import { CrestT } from '../../components'
import { Glyph } from '../../glyphs'
import { IcoFastForward, IcoPause, IcoPlay, IcoPeople } from '../../icons'
import { luma } from '../../kit'
import { wornKits, type Kit } from '../../livepitch/kitclash'
import { tokenColor } from '../../HighlightClip'
import { AdSlot } from '../../AdSlot'
import { Veil } from '../../Veil'
import { NAMES as SPONSOR_NAMES } from '../../../game/commercial'
import { LivePitch, type PitchSide } from '../../livepitch/LivePitch'
import { Ticker, type TickLine } from '../../livepitch/Ticker'
import { fromSim2, StreamFeed, type Session } from '../../livepitch/stream'
import { WEATHER_ICON, weatherWord } from './weather'

/** THE SWITCH: the watched Extended match on the new engine. Off, everything is as before. */
export { SIM2_EXTENDED } from '../../../game/sim/toResult'

/** the speed buttons: they scale every rate alike (fast forward stays as it is at Normal) */
const SPEEDS = [{ k: 'matchday.spdSlow', x: 0.7 }, { k: 'matchday.spdNormal', x: 1 }, { k: 'matchday.spdFast', x: 1.6 }]
/** how long he has to make a penalty call before the captain makes it (seconds) */
const CALL_S = 10

/** a word from the locales, or the English given when the key is not there yet (asked for in requests.md) */
/** why a change was refused, in the player's language: the engine gives its reason in English (Play.cause),
 *  mapped to the commentary's own lines as commentary.ts does (REFUSED_WHY) */
const REFUSED_WHY: Record<string, string> = { 'not on the field': 'sim.whyNotOn1', 'in the bin or sent off': 'sim.whyBinned1', 'not on the bench': 'sim.whyNotBench1', refused: 'sim.whyLaws1' }


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
  // ---- the session and the stream (once per match)
  const { session, feed, from } = useMemo(() => {
    const session: Session = fromSim2(live.sim2!, game)
    const names = new Map([...session.sides[0].players, ...session.sides[1].players].map(p => [p.id, p.name]))
    const feed = new StreamFeed(session, ids, id => names.get(id))
    // A MATCH PICKED UP AGAIN (the store replays the session's save after a reload): the pitch stands where
    // it was when the app went away, not at the engine's head (the engine plays ahead of the picture)
    const was = live.resumed ? Number(readView(fixture.id) ?? -1) : -1
    if (was > 0) feed.startAt(was)
    else feed.pump(40)
    // (the headless checks, ?hl=1 only: scripts/tmp/sim2run.mjs reads the session's record to find its moments)
    try { if (/[?&]hl=1\b/.test(location.search)) (window as unknown as { __sim2?: unknown }).__sim2 = { session, feed } } catch { /* no window */ }
    return { session, feed, from: was > 0 ? feed.n : 0 }
  }, [fixture.id])
  const names = useMemo(() => new Map([...session.sides[0].players, ...session.sides[1].players].map(p => [p.id, p.name])), [session])
  const nameOf = (id?: string) => (id ? names.get(id) ?? '' : '')
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
  const [talked, setTalked] = useState<HtTone | null>(null)
  const [callAt, setCallAt] = useState(0)
  const [lines, setLines] = useState<Line[]>([])
  const [ticks, setTicks] = useState<TickLine[]>([])
  // (picked up again: the last few lines before it on the ticker, not the whole match)
  const tickedTo = useRef(from > 0 ? from - 4 : -1)
  const linesFor = useRef(-1)
  const paused = !playing || !!sheet || !!hurt || !!waiting || ended
  // ---- the frame loop: bake ahead, read where the pitch is, stop for the manager
  useEffect(() => {
    let raf = 0
    const loop = () => {
      feed.pump(paused ? 2 : 5)
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
      if (session.plays.length !== linesFor.current) {
        linesFor.current = session.plays.length
        // where the session has got to, for a reload (the store writes only the small record)
        useStore.getState().noteProgress()
        setLines(commentate(session.result(), { teams: [session.sides[0].name, session.sides[1].name], player: id => names.get(id) ?? '' }))
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [feed, n, landed, waiting, paused, ended])
  // ---- the ticker: each play's lines go up as the pitch reaches it
  useEffect(() => {
    if (n <= tickedTo.current || !lines.length) return
    const add: TickLine[] = []
    const P = session.plays
    for (const l of lines) {
      if (l.n <= tickedTo.current || l.n > n) continue
      const k = P[l.n]?.kind
      add.push({ n: l.n, text: renderLine(l), at: feed.view + add.length * 0.25, hold: (l as Line & { hold?: number }).hold ?? 1.2,
        flash: (l as Line & { flash?: TickLine['flash'] }).flash ?? (k === 'try' || k === 'penaltyTry' ? 'try' : k === 'yellowCard' || k === 'redCard' ? 'card' : null),
        side: l.side, card: k === 'redCard' ? 'r' : k === 'yellowCard' ? 'y' : undefined, minute: Math.min(80, Math.floor((P[l.n]?.clock ?? P[l.n]?.t ?? 0) / 60) + 1) })
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
    return { home: w.home, away: w.away, slate: nt.slate }
  }, [fixture.id])
  const onPanel = (k: Kit): Kit => (luma(k[0]) >= 40 ? k : luma(k[1]) >= 40 ? [k[1], k[0]] : [kits.slate, k[0]])
  const panel = { home: onPanel(kits.home), away: onPanel(kits.away) }
  const pitchSide = (s: 0 | 1): PitchSide => {
    const xi = session.sides[s].players.filter(p => p.shirt <= 15).sort((a, b) => a.shirt - b.shirt)
    return { lineup: Array.from({ length: 15 }, (_, i) => { const p = xi.find(z => z.shirt === i + 1); return p ? Number(p.id) : null }), nums: Array.from({ length: 15 }, (_, i) => i + 1), kit: s === 0 ? kits.home : kits.away }
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
  const lineup = me != null ? session.lineup(me) : null
  const refusals = P.filter(x => x.kind === 'substitution' && x.side === me && x.result === 'refused').slice(-1)

  return (
    <div className="live-wrap full-match sim2" data-testid="sim2-live" data-sim2-n={n} data-sim2-waiting={waiting ?? ''} data-sim2-ended={ended ? '1' : '0'}>
      <div className="scoreboard" style={{ '--home-c': panel.home[0], '--away-c': panel.away[0] } as React.CSSProperties}>
        <div className="teams">
          <div className="tname"><CrestT g={game} teamId={fixture.homeId} size={26} />{teamShort(game, fixture.homeId)}<span className="clubbar" style={{ background: panel.home[0] }} />{cards(0)}</div>
          <div className="score" key={`${score[0]}-${score[1]}`} data-testid="sim2-score">{score[0]} – {score[1]}</div>
          <div className="tname"><CrestT g={game} teamId={fixture.awayId} size={26} />{teamShort(game, fixture.awayId)}<span className="clubbar" style={{ background: panel.away[0] }} />{cards(1)}</div>
        </div>
        <div className="minute">
          {minute}
          {compLabel(game.comps[fixture.compId]?.short) ? ` · ${compLabel(game.comps[fixture.compId]?.short)}` : ''}
          {fixture.weather && fixture.weather !== 'Dry' ? <> · <Glyph name={WEATHER_ICON[fixture.weather]} /> {weatherWord(fixture.weather)}</> : ''}
        </div>
      </div>
      {!ended && (
        <LivePitch feed={feed} events={[]} cursor={0} homeId={fixture.homeId} paused={paused} speed={SPEEDS[speed].x}
          home={pitchSide(0)} away={pitchSide(1)} night={night} wet={fixture.weather === 'Rain'} snow={fixture.weather === 'Snow'} boards={boards}
          tr={(k, v) => t(k, v)} teams={{ home: teamShort(game, fixture.homeId), away: teamShort(game, fixture.awayId) }} names={id => names.get(String(id))} />
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
          <Ticker lines={ticks} feed={feed} kits={panel} />
          <div className="live-stats brief" data-testid="live-stats">
            {stats.map(r => {
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
          <h3>{t('matchday.penCall')}</h3>
          <div className="meta">{t('sim2.penOut', { n: Math.round(pend.toLine) })}</div>
          <div className="sim2-timer"><i key={callAt} style={{ animationDuration: `${CALL_S}s` }} /></div>
          <div className="sim2-opts">
            {pend.options.map(o => (
              <button key={o} className="btn ghost" data-call={o} onClick={() => call(o)}>
                <Glyph name={o === 'posts' ? 'posts' : o === 'tap' ? 'bolt' : o === 'corner' ? 'attack' : 'team'} />
                <b>{o === 'posts' ? t('matchday.optPosts') : o === 'corner' ? t('matchday.optCorner') : o === 'tap' ? t('matchday.optTap') : t('matchday.optScrum')}</b>
              </button>
            ))}
          </div>
          <button className="btn ghost block" data-call="captain" onClick={() => call(null)}>{t('sim2.captainCall')}</button>
        </div>
      )}

      {/* HALF-TIME: the match stops for his talk, with the half's stats */}
      {waiting === 'halfTime' && !ended && (
        <div className="content ticker panel-area" data-testid="sim2-ht">
          <div className="card" style={{ margin: '8px 14px' }}>
            <div className="fact-label">{t('matchday.halfTime')}</div>
            {stats.map(r => <div key={r.label} className="meta" style={{ display: 'flex', gap: 8 }}><b style={{ flex: '0 0 44px' }}>{r.v[0]}{r.pct ? '%' : ''}</b><span style={{ flex: 1, textAlign: 'center' }}>{r.label}</span><b style={{ flex: '0 0 44px', textAlign: 'right' }}>{r.v[1]}{r.pct ? '%' : ''}</b></div>)}
          </div>
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
          <div className="card" style={{ margin: '8px 14px' }}>
            <div className="fact-label">{t('matchday.fullTime')}</div>
            {statsTo(P, P.length - 1).map(r => <div key={r.label} className="meta" style={{ display: 'flex', gap: 8 }}><b style={{ flex: '0 0 44px' }}>{r.v[0]}{r.pct ? '%' : ''}</b><span style={{ flex: 1, textAlign: 'center' }}>{r.label}</span><b style={{ flex: '0 0 44px', textAlign: 'right' }}>{r.v[1]}{r.pct ? '%' : ''}</b></div>)}
          </div>
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
