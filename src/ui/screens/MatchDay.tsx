import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../../store'
import {
  matchStats, teamShort, teamUnits, rosterOf, autoSelect, availablePlayers,
  rollWeather, sideEnergy, type LiveCtx, type SideCtx,
} from '../../game/matchEngine'
import { BENCH_SLOTS, XV_SLOTS, weekDate, type MatchEvent, type Player, type Pos } from '../../game/model'
import { userFixtureThisWeek, weekRng } from '../../game/season'
import { effAt } from '../../game/attributes'
import { PRESETS, SLIDER_INFO, sliderReadout } from '../../game/tactics'
import { CrestT, Jersey, PosBadge, SectionTitle, Stars } from '../components'
import { stageName } from './Home'
import { matchSfx, soundOn, toggleSound } from '../audio'
import { derbyName } from '../../game/rivalries'

const WEATHER_ICON: Record<string, string> = { Dry: '☀️', Rain: '🌧️', Wind: '💨', Snow: '❄️' }

export default function MatchDay() {
  const game = useStore(s => s.game)!
  const live = useStore(s => s.liveMatch)
  const { back } = useStore.getState()

  const fx = live?.fixture ?? userFixtureThisWeek(game)
  if (!fx) {
    return (
      <div className="title-screen">
        <div>No fixture this week.</div>
        <button className="btn gold" style={{ marginTop: 16 }} onClick={back}>Back</button>
      </div>
    )
  }
  return live ? <Live /> : <Preview fxId={fx.id} />
}

// ------------------------------------------------------------------
// Pre-match
// ------------------------------------------------------------------

const SPEECHES = [
  { id: 'calm', icon: '🧊', name: 'Calm the nerves', desc: 'No panic, no cheap penalties. Solid start.' },
  { id: 'fire', icon: '🔥', name: 'Light the fuse', desc: 'Fly out of the blocks — but watch the ref.' },
  { id: 'underdog', icon: '🐺', name: 'Nobody rates us', desc: 'Best when you\'re written off. Shackles off.' },
  { id: 'expect', icon: '👑', name: 'I expect a win', desc: 'Demand standards. Big if it lands, risky if not.' },
  { id: 'enjoy', icon: '😄', name: 'Go and enjoy it', desc: 'Loose and confident. Small, safe lift.' },
] as const
type SpeechId = typeof SPEECHES[number]['id']

function Preview({ fxId }: { fxId: number }) {
  const game = useStore(s => s.game)!
  useStore(s => s.tick)
  const { kickOff, back, touch } = useStore.getState()
  const [speech, setSpeech] = useState<SpeechId | null>(null)
  const [pickSlot, setPickSlot] = useState<number | null>(null)
  const [confirm, setConfirm] = useState(false)

  const fx = game.fixtures.find(f => f.id === fxId)!
  const comp = game.comps[fx.compId]
  const home = game.clubs[fx.homeId]
  const isHome = fx.homeId === game.userClubId
  const opp = isHome ? fx.awayId : fx.homeId
  const club = game.clubs[game.userClubId]
  const t = club.tactic

  const oppLineup = useMemo(() => {
    const pool = availablePlayers(game, rosterOf(game, opp))
    return autoSelect(game, pool)
  }, [game, opp])
  const oppUnits = teamUnits(game, oppLineup)
  const myUnits = teamUnits(game, t.lineup)

  const slotPos = (slot: number): Pos => slot < 15 ? XV_SLOTS[slot].pos : BENCH_SLOTS[slot - 15].pos[0]

  const setSlot = (slot: number, pid: number | null) => {
    if (pid != null) {
      const other = t.lineup.indexOf(pid)
      if (other >= 0) t.lineup[other] = t.lineup[slot]
    }
    t.lineup[slot] = pid
    setPickSlot(null)
    touch()
  }

  const problem = (p: Player | null) =>
    p ? (p.injury ? 'INJURED' : p.bans > 0 ? 'SUSPENDED' : p.natSquad ? 'INTL DUTY' : p.clubId !== club.id ? 'GONE' : null) : 'EMPTY'

  // pre-flight warnings for the ready check
  const warnings: { level: 'bad' | 'warn' | 'note'; text: string }[] = []
  for (let i = 0; i < 15; i++) {
    const pid = t.lineup[i]
    const p = pid != null ? game.players[pid] : null
    const prob = problem(p)
    if (prob) warnings.push({ level: 'bad', text: `No fit no. ${XV_SLOTS[i].shirt} (${prob === 'EMPTY' ? 'empty slot' : `${p!.name} — ${prob.toLowerCase()}`}) — he'll be auto-replaced at kick-off.` })
    else if ((p!.rust ?? 0) > 0) warnings.push({ level: 'warn', text: `${p!.name} is RUSTY (${p!.rust}w) — high re-injury risk if he plays.` })
    else if (p!.cond < 60) warnings.push({ level: 'warn', text: `${p!.name} is only ${Math.round(p!.cond)}% fit — his tank will empty early.` })
  }
  if (!speech) warnings.push({ level: 'note', text: 'No dressing-room speech chosen — the players will make their own minds up.' })

  const bar = (label: string, mine: number, theirs: number) => {
    const total = mine + theirs
    const pct = total ? (mine / total) * 100 : 50
    return (
      <div style={{ padding: '4px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-soft)' }}>
          <span>{mine.toFixed(1)}</span><b style={{ color: 'var(--accent-ink)' }}>{label}</b><span>{theirs.toFixed(1)}</span>
        </div>
        <div style={{ height: 8, background: 'var(--cream-3)', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
          <div style={{ width: `${pct}%`, background: 'var(--club1)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.15)' }} />
          <div style={{ flex: 1, background: game.clubs[opp]?.colors[0] ?? '#c9a227', opacity: .85 }} />
        </div>
      </div>
    )
  }

  const renderSlot = (slot: number) => {
    const shirt = slot < 15 ? XV_SLOTS[slot].shirt : BENCH_SLOTS[slot - 15].shirt
    const pos = slotPos(slot)
    const pid = t.lineup[slot]
    const p = pid != null ? game.players[pid] : null
    const prob = problem(p)
    return (
      <tr key={slot} onClick={() => setPickSlot(slot)} className={prob ? 'prob-row' : undefined}>
        <td className="num" style={{ fontFamily: 'monospace', fontWeight: 700 }}>{shirt}</td>
        <td><PosBadge pos={pos} /></td>
        <td className="name">
          {p ? p.name : <span className="muted">— tap to pick —</span>}
          {prob && p && <span style={{ color: '#9b2c2c', fontSize: 10.5, fontWeight: 700 }}> {prob}</span>}
          {!prob && p && (p.rust ?? 0) > 0 && <span style={{ color: '#a8841a', fontSize: 10.5, fontWeight: 700 }}> ⚠ RUSTY</span>}
        </td>
        <td>{p && <Stars ca={effAt(p, pos)} />}</td>
        <td className="num">{p ? `${Math.round(p.cond)}%` : ''}</td>
      </tr>
    )
  }

  const picker = () => {
    if (pickSlot == null) return null
    const pos = slotPos(pickSlot)
    const pool = availablePlayers(game, club.players)
      .sort((a, b) => effAt(b, pos) - effAt(a, pos))
    return (
      <div className="modal-veil" onClick={() => setPickSlot(null)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="grab" />
          <SectionTitle sub={`shirt ${pickSlot < 15 ? XV_SLOTS[pickSlot].shirt : BENCH_SLOTS[pickSlot - 15].shirt}`}>
            Pick a {pos}
          </SectionTitle>
          <table className="dtable"><tbody>
            {pool.map(p => (
              <tr key={p.id} onClick={() => setSlot(pickSlot, p.id)}
                style={t.lineup.includes(p.id) ? { opacity: .55 } : undefined}>
                <td><PosBadge pos={p.pos} /></td>
                <td className="name">{p.name}{t.lineup.includes(p.id) ? ' (selected)' : ''}
                  {(p.rust ?? 0) > 0 && <span style={{ color: '#a8841a', fontSize: 10.5, fontWeight: 700 }}> ⚠ RUSTY {p.rust}w</span>}
                </td>
                <td><Stars ca={effAt(p, pos)} /></td>
                <td className="num">{Math.round(p.cond)}%</td>
              </tr>
            ))}
          </tbody></table>
          <button className="btn ghost block" onClick={() => setSlot(pickSlot, null)}>Clear Slot</button>
        </div>
      </div>
    )
  }

  const readyModal = () => {
    if (!confirm) return null
    return (
      <div className="modal-veil" onClick={() => setConfirm(false)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="grab" />
          <h3 style={{ fontSize: 17, margin: '4px 0 8px' }}>Are you ready for the game?</h3>
          {warnings.length === 0 && (
            <div className="meta" style={{ margin: '6px 0' }}>Everything looks in order. The tunnel awaits.</div>
          )}
          {warnings.map((w, i) => (
            <div key={i} style={{
              display: 'flex', gap: 8, padding: '6px 0', fontSize: 12.5, lineHeight: 1.4,
              color: w.level === 'bad' ? '#9b2c2c' : w.level === 'warn' ? '#8a6d1a' : 'var(--ink-soft)',
              borderBottom: '1px solid var(--hairline)',
            }}>
              <span>{w.level === 'bad' ? '⛔' : w.level === 'warn' ? '⚠️' : 'ℹ️'}</span>
              <span>{w.text}</span>
            </div>
          ))}
          {speech && (
            <div className="meta" style={{ marginTop: 8 }}>
              Speech: <b>{SPEECHES.find(s => s.id === speech)?.name}</b>
            </div>
          )}
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn ghost" onClick={() => setConfirm(false)}>Not Yet</button>
            <button className="btn gold" style={{ flex: 1.5, fontSize: 15 }}
              onClick={() => { setConfirm(false); kickOff(speech ?? undefined) }}>
              ▸ Take the Field
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <header className="masthead">
        <div className="masthead-row">
          <button className="back-btn" onClick={back}>‹</button>
          <div style={{ flex: 1 }}>
            <h1>Match Day</h1>
            <div className="date">{comp?.name}{fx.stage ? ` · ${stageName(fx.stage)}` : ''} · {weekDate(game.season, fx.week)}</div>
          </div>
        </div>
      </header>
      <main className="content">
        <div className="card center">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 4 }}>
            <CrestT g={game} teamId={fx.homeId} size={38} />
            {game.clubs[fx.homeId] && <Jersey club={game.clubs[fx.homeId]} size={54} />}
            <span style={{ fontFamily: 'var(--cond)', fontWeight: 700, fontSize: 15, color: 'var(--ink-faint)', letterSpacing: 2 }}>VS</span>
            {game.clubs[fx.awayId] && <Jersey club={game.clubs[fx.awayId]} size={54} />}
            <CrestT g={game} teamId={fx.awayId} size={38} />
          </div>
          <h3 style={{ fontSize: 19 }}>{teamShort(game, fx.homeId)} v {teamShort(game, fx.awayId)}</h3>
          <div className="meta">🏟️ {home?.stadium ?? 'Neutral venue'}{home ? `, ${home.city}` : ''}</div>
          <div className="meta" style={{ marginTop: 3 }}>
            {WEATHER_ICON[rollWeather(game.week, weekRng(game))]} Forecast: {rollWeather(game.week, weekRng(game))}
            {derbyName(fx.homeId, fx.awayId) && <span style={{ color: '#a12f2f', fontWeight: 700 }}> · {derbyName(fx.homeId, fx.awayId)} — expect a cauldron</span>}
          </div>
        </div>

        {(() => {
          const danger = oppLineup.slice(0, 15)
            .map(id => id != null ? game.players[id] : null)
            .filter(Boolean)
            .sort((a, b) => b!.ca - a!.ca)[0]
          return danger ? (
            <div className="card" style={{ borderLeft: '4px solid #a12f2f' }}>
              <div className="fact-label">Danger Man</div>
              <div className="meta">
                <b>{danger.name}</b> ({danger.pos}) is the one to shackle — {game.clubs[opp]?.short ?? 'they'} play
                through him. Keep him quiet and you're halfway there.
              </div>
            </div>
          ) : null
        })()}
        <SectionTitle sub="your colours on the left">Head to Head</SectionTitle>
        {bar('Scrum', myUnits.scrum, oppUnits.scrum)}
        {bar('Lineout', myUnits.lineout, oppUnits.lineout)}
        {bar('Breakdown', myUnits.breakdown, oppUnits.breakdown)}
        {bar('Attack', myUnits.attack, oppUnits.attack)}
        {bar('Defence', myUnits.defence, oppUnits.defence)}

        <SectionTitle sub="tap any shirt to change it">Your XV</SectionTitle>
        <div className="tblwrap">
          <table className="dtable"><tbody>{XV_SLOTS.map((_, i) => renderSlot(i))}</tbody></table>
        </div>
        <SectionTitle>Replacements</SectionTitle>
        <div className="tblwrap">
          <table className="dtable"><tbody>{BENCH_SLOTS.map((_, i) => renderSlot(15 + i))}</tbody></table>
        </div>

        <SectionTitle sub="one speech, choose the tone">Dressing Room</SectionTitle>
        <div className="speech-grid">
          {SPEECHES.map(s => (
            <button key={s.id} className={`speech-tile${speech === s.id ? ' sel' : ''}`}
              onClick={() => setSpeech(speech === s.id ? null : s.id)}>
              <span className="ico">{s.icon}</span>
              <b>{s.name}</b>
              <span className="d">{s.desc}</span>
            </button>
          ))}
        </div>

        <div className="btn-row" style={{ marginTop: 10 }}>
          <button className="btn gold block" style={{ fontSize: 16, width: '100%' }} onClick={() => setConfirm(true)}>
            Kick Off ▸
          </button>
        </div>
        <div className="spacer" />
      </main>
      {picker()}
      {readyModal()}
    </>
  )
}

// ------------------------------------------------------------------
// Live match
// ------------------------------------------------------------------

const SPEEDS = [{ label: '▶', ms: 900 }, { label: '▶▶', ms: 350 }, { label: '▶▶▶', ms: 90 }]

/** XV formation spots: [x across own half 0-100, y down the pitch 0-100] */
const SPOTS: [number, number][] = [
  [14, 30], [14, 50], [14, 70],   // 1 2 3
  [22, 40], [22, 60],             // 4 5
  [30, 24], [30, 76], [33, 50],   // 6 7 8
  [42, 44], [50, 60],             // 9 10
  [64, 10], [58, 40], [63, 66], [64, 90], [76, 50], // 11-15
]

function PitchViz({ ctx, game, last, ballLeft }: {
  ctx: LiveCtx
  game: ReturnType<typeof useStore.getState>['game'] & object
  last: MatchEvent | undefined
  ballLeft: number
}) {
  const fx = ctx.fx
  const homeC = game!.clubs[fx.homeId]?.colors ?? ['#c9a227', '#082b20']
  const awayC = game!.clubs[fx.awayId]?.colors ?? ['#1a3a5c', '#f0eadc']
  const min = last?.min ?? 0
  const drift = (ballLeft - 50) * 0.14

  const dots = (side: SideCtx, isHome: boolean) => {
    const cols = isHome ? homeC : awayC
    return side.lineup.slice(0, 15).map((id, slot) => {
      if (id == null || !side.onPitch.has(id)) return null
      const binned = (side.yellowUntil.get(id) ?? 0) > min
      if (binned) return null
      const p = game!.players[id]
      if (!p) return null
      const [sx, sy] = SPOTS[slot]
      const x = isHome ? 5 + sx * 0.40 + drift : 95 - sx * 0.40 + drift
      const hl = last?.playerId === id
      return (
        <div key={id} className={`pdot${hl ? ' hl' : ''}`}
          style={{
            left: `${x}%`, top: `${8 + sy * 0.84}%`,
            background: cols[0], borderColor: cols[1], color: contrastText(cols[0]),
          }}>
          {XV_SLOTS[slot].shirt}
          {hl && <span className="pname">{p.name.split(' ').slice(-1)[0]}</span>}
        </div>
      )
    })
  }

  return (
    <div className="pitch">
      <div className="tryzone" style={{ left: 0, background: `linear-gradient(90deg, ${homeC[0]}cc, ${homeC[0]}55)` }} />
      <div className="tryzone" style={{ right: 0, background: `linear-gradient(270deg, ${awayC[0]}cc, ${awayC[0]}55)` }} />
      {[22, 50, 78].map(x => <div key={x} className="line" style={{ left: `${x}%` }} />)}
      {[36, 64].map(x => <div key={x} className="line dashed" style={{ left: `${x}%` }} />)}
      <div className="posts" style={{ left: '7%' }} />
      <div className="posts" style={{ right: '7%' }} />
      <div className="zone-label" style={{ left: '2.5%' }}>{teamShort(game!, fx.homeId).slice(0, 3).toUpperCase()}</div>
      <div className="zone-label" style={{ right: '2.5%' }}>{teamShort(game!, fx.awayId).slice(0, 3).toUpperCase()}</div>
      {dots(ctx.home, true)}
      {dots(ctx.away, false)}
      <div className="ball" style={{ left: `${ballLeft}%`, top: `${38 + ((min * 13) % 25)}%` }} />
    </div>
  )
}

function contrastText(bg: string): string {
  const hex = bg.replace('#', '')
  if (hex.length < 6) return '#fff'
  const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 140 ? '#0d241c' : '#fff'
}

function Live() {
  const game = useStore(s => s.game)!
  const live = useStore(s => s.liveMatch)!
  useStore(s => s.tick)
  const { advanceLive, matchCursor, finishMatch, skipToBreak } = useStore.getState()
  const [speedIdx, setSpeedIdx] = useState(0)
  const [sound, setSound] = useState(soundOn())
  const [drawer, setDrawer] = useState(false)
  const tickerRef = useRef<HTMLDivElement>(null)

  const { events, cursor, playing, fixture, ctx } = live
  const shown = events.slice(0, cursor)
  const last = shown[shown.length - 1]
  const caughtUp = cursor >= events.length
  const atHalfTime = caughtUp && ctx.awaiting === 'HT'
  const atBreak = caughtUp && ctx.awaiting === 'BRK'
  const done = caughtUp && ctx.seg === 3

  useEffect(() => {
    if (!playing) return
    const t = setTimeout(() => advanceLive(), SPEEDS[speedIdx].ms)
    return () => clearTimeout(t)
  }, [cursor, playing, speedIdx, events.length])

  // stadium sound & haptics on key events (skip when fast-forwarding)
  useEffect(() => {
    if (last && speedIdx < 2 && playing) matchSfx(last.type)
  }, [cursor])

  useEffect(() => {
    tickerRef.current?.scrollTo({ top: tickerRef.current.scrollHeight, behavior: 'smooth' })
  }, [cursor, atHalfTime, atBreak, done])

  const hs = last?.homeScore ?? 0
  const as = last?.awayScore ?? 0
  const min = last?.min ?? 0

  // ball position: drift by event team, jump for big events
  const ballLeft = useMemo(() => {
    if (!last) return 50
    const towardHome = last.teamId === fixture.homeId
    const base = last.type === 'TRY' ? (towardHome ? 88 : 12)
      : last.type === 'PEN' || last.type === 'DG' ? (towardHome ? 72 : 28)
      : 50 + (towardHome ? 1 : -1) * (10 + (last.min % 20))
    return Math.max(6, Math.min(94, base))
  }, [cursor])

  const cls = (e: MatchEvent) =>
    e.type === 'TRY' || e.type === 'FT' || e.type === 'DG' ? 'big'
      : e.type === 'YC' ? 'card-y'
      : e.type === 'RC' ? 'card-r'
      : e.type === 'INJ' ? 'inj' : ''

  const icon = (e: MatchEvent) => ({
    TRY: '🏉', CON: '🎯', PEN: '🥅', DG: '🎯', YC: '🟨', RC: '🟥', INJ: '🩹', HT: '⏸', FT: '🏁', KO: '⏱', SUB: '·', BRK: '💧',
  }[e.type] ?? '·')

  const homeC = game.clubs[fixture.homeId]?.colors ?? ['#c9a227', '#082b20']
  const awayC = game.clubs[fixture.awayId]?.colors ?? ['#c9a227', '#082b20']
  const paused = !playing && !done && !atHalfTime && !atBreak

  return (
    <div className="live-wrap">
      <div className="scoreboard" style={{ '--home-c': homeC[0], '--away-c': awayC[0] } as React.CSSProperties}>
        <div className="teams">
          <div className="tname"><CrestT g={game} teamId={fixture.homeId} size={26} />{teamShort(game, fixture.homeId)}<span className="clubbar" style={{ background: homeC[0] }} /></div>
          <div className="score">{hs} – {as}</div>
          <div className="tname"><CrestT g={game} teamId={fixture.awayId} size={26} />{teamShort(game, fixture.awayId)}<span className="clubbar" style={{ background: awayC[0] }} /></div>
        </div>
        <div className="minute">
          {done ? 'Full Time' : atHalfTime ? 'Half-Time' : atBreak ? "60' Break" : `${Math.min(80, min)}'`} · {game.comps[fixture.compId]?.short}{fixture.stage ? ` ${stageName(fixture.stage)}` : ''}
          {fixture.weather && fixture.weather !== 'Dry' ? ` · ${WEATHER_ICON[fixture.weather]} ${fixture.weather}` : ''}
          {fixture.att ? ` · 👥 ${fixture.att.toLocaleString()}` : ''}
        </div>
      </div>

      <PitchViz ctx={ctx} game={game} last={last} ballLeft={ballLeft} />

      <div className="speed-controls">
        {SPEEDS.map((s, i) => (
          <button key={i} className={`btn ${i === speedIdx && playing ? 'gold' : 'ghost'}`}
            onClick={() => { setSpeedIdx(i); setDrawer(false); matchCursor(cursor, true) }}>{s.label}</button>
        ))}
        <button className="btn ghost" onClick={() => matchCursor(cursor, !playing)}>
          {playing ? '⏸' : '▶'}
        </button>
        {!done && ctx.seg < 3 && (
          <button className={`btn ${drawer ? 'gold' : 'ghost'}`}
            onClick={() => {
              if (!drawer) matchCursor(cursor, false)
              setDrawer(!drawer)
            }}>📋</button>
        )}
        <button className="btn ghost" onClick={() => setSound(toggleSound())}>
          {sound ? '🔊' : '🔇'}
        </button>
        {!done && <button className="btn" onClick={() => { setDrawer(false); skipToBreak() }}>⏭</button>}
      </div>

      <div className="content ticker" ref={tickerRef}>
        {shown.map((e, i) => (
          <div key={i} className={`tick-event ${cls(e)}`}>
            <span className="min">{e.min}'</span>
            <span className="txt">{icon(e)} {e.text}</span>
          </div>
        ))}
        {drawer && paused && !done && (
          <TouchlinePanel title="⏸ Play is paused — change the picture" showTalk={false} onResume={() => { setDrawer(false); matchCursor(cursor, true) }} resumeLabel="▸ Resume Play" />
        )}
        {(atHalfTime || atBreak) && (
          <TouchlinePanel
            title={atBreak ? "60' — a break in play, final quarter ahead" : 'Half-Time — the dressing room waits'}
            showTalk={atHalfTime}
            onResume={() => { setDrawer(false); useStore.getState().startSecondHalf() }}
            resumeLabel={atBreak ? '▸ Play the Final Quarter' : '▸ Start Second Half'}
          />
        )}
        {done && (
          <>
            <StatsPanel />
            <RatingsPanel />
            <button className="btn gold block" style={{ margin: '14px 0' }} onClick={finishMatch}>
              Continue to Results ▸
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function StatsPanel() {
  const game = useStore(s => s.game)!
  const live = useStore(s => s.liveMatch)!
  const st = matchStats(live.ctx)
  const row = (label: string, v: [number, number], pct = false) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: '1px solid var(--hairline)', fontSize: 13 }}>
      <b style={{ width: 34, textAlign: 'right', fontFamily: 'var(--cond)', fontSize: 15 }}>{v[0]}{pct ? '%' : ''}</b>
      <span style={{ flex: 1, textAlign: 'center', color: 'var(--ink-faint)', fontFamily: 'var(--cond)', textTransform: 'uppercase', letterSpacing: 1, fontSize: 12 }}>{label}</span>
      <b style={{ width: 34, fontFamily: 'var(--cond)', fontSize: 15 }}>{v[1]}{pct ? '%' : ''}</b>
    </div>
  )
  return (
    <div className="card" style={{ margin: '12px 0' }}>
      <h3 style={{ fontSize: 14, textAlign: 'center' }}>
        {teamShort(game, live.fixture.homeId)} · Match Stats · {teamShort(game, live.fixture.awayId)}
      </h3>
      {row('Possession', st.possession, true)}
      {row('Tries', st.tries)}
      {row('Penalty goals', st.pens)}
      {row('Cards', st.cards)}
      {row('Energy left', st.energy, true)}
    </div>
  )
}

/** Post-match player ratings for the user's side, FM style. */
function RatingsPanel() {
  const game = useStore(s => s.game)!
  const live = useStore(s => s.liveMatch)!
  const ctx = live.ctx
  const mine = ctx.home.teamId === game.userClubId ? ctx.home : ctx.away
  if (!game.clubs[mine.teamId] || mine.teamId !== game.userClubId) return null
  const rows = [...mine.ratings.entries()]
    .map(([id, r]) => ({ p: game.players[id], r }))
    .filter(x => x.p)
    .sort((a, b) => b.r - a.r)
  return (
    <div className="card" style={{ margin: '0 0 12px' }}>
      <h3 style={{ fontSize: 14 }}>Your Player Ratings</h3>
      <table className="dtable"><tbody>
        {rows.map(({ p, r }) => (
          <tr key={p!.id}>
            <td><PosBadge pos={p!.pos} /></td>
            <td className="name">{p!.name}{ctx.motmId === p!.id ? ' ⭐' : ''}</td>
            <td className="num" style={{ fontWeight: 700, color: r >= 7.5 ? '#2f7d4f' : r < 5.5 ? '#9b2c2c' : undefined }}>
              {Math.min(10, Math.max(1, r)).toFixed(1)}
            </td>
          </tr>
        ))}
      </tbody></table>
    </div>
  )
}

/** The touchline panel: team talk (HT only), tactics with plain-English
 *  readouts and one-tap presets, and substitutions with energy bars. */
function TouchlinePanel({ title, showTalk, onResume, resumeLabel }: {
  title: string
  showTalk: boolean
  onResume: () => void
  resumeLabel: string
}) {
  const game = useStore(s => s.game)!
  const live = useStore(s => s.liveMatch)!
  const { teamTalk, halfTimeSub, liveTactics, touch } = useStore.getState()
  const [subMsg, setSubMsg] = useState<string | null>(null)
  const [outId, setOutId] = useState<number | ''>('')
  const [inId, setInId] = useState<number | ''>('')
  const [explain, setExplain] = useState<string | null>(null)

  const ctx = live.ctx
  const club = game.clubs[game.userClubId]
  const mine = ctx.home.teamId === game.userClubId ? ctx.home : ctx.away
  const starters = mine.lineup.slice(0, 15).map(id => id != null ? game.players[id] : null).filter(Boolean)
  const bench = mine.lineup.slice(15).map(id => id != null ? game.players[id] : null)
    .filter(p => p && !p.injury && !mine.onPitch.has(p.id) && !mine.ratings.has(p.id))

  const talks = [
    ['fire', '🔥 Let them have it'],
    ['calm', '🧊 Stay composed'],
    ['praise', '👏 Praise the effort'],
    ['demand', '💪 Demand more'],
  ] as const

  const applyPreset = (values: { style: number; tempo: number; kicking: number; aggression: number }) => {
    club.tactic.style = values.style
    club.tactic.tempo = values.tempo
    club.tactic.kicking = values.kicking
    club.tactic.aggression = values.aggression
    liveTactics()
    touch()
  }

  return (
    <div className="card" style={{ margin: '12px 0', borderLeft: '4px solid var(--gold)' }}>
      <h3 style={{ fontSize: 15 }}>{title}</h3>
      <StatsPanel />
      {showTalk && (!ctx.talkUsed ? (
        <>
          <div className="fact-label" style={{ marginTop: 4 }}>Team Talk</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
            {talks.map(([k, label]) => (
              <button key={k} className="btn ghost" style={{ fontSize: 12.5, padding: '9px 6px' }}
                onClick={() => teamTalk(k)}>{label}</button>
            ))}
          </div>
        </>
      ) : live.talkMsg && (
        <div className="meta" style={{ fontStyle: 'italic', margin: '6px 0' }}>{live.talkMsg}</div>
      ))}

      <div className="fact-label" style={{ marginTop: 12 }}>Quick Game Plans</div>
      <div className="preset-row">
        {PRESETS.map(p => (
          <button key={p.id} className="preset-chip" title={p.desc}
            onClick={() => { applyPreset(p.values); setExplain(`${p.icon} ${p.name}: ${p.desc}`) }}>
            {p.icon} {p.name}
          </button>
        ))}
      </div>

      <div className="fact-label" style={{ marginTop: 10 }}>In-Match Tactics <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— tap a name to see what it does</span></div>
      {SLIDER_INFO.map(s => (
        <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
          <span style={{ width: 78, fontSize: 11, color: 'var(--ink-faint)', fontFamily: 'var(--cond)', textTransform: 'uppercase', letterSpacing: .5, cursor: 'pointer' }}
            onClick={() => setExplain(`${s.label}: ${sliderReadout(s.key, club.tactic[s.key])}`)}>
            {s.label}
          </span>
          <input type="range" min={0} max={100} value={club.tactic[s.key]} style={{ flex: 1, accentColor: 'var(--green-700)' }}
            onChange={e => { club.tactic[s.key] = Number(e.target.value); liveTactics(); touch() }} />
        </div>
      ))}
      {explain && <div className="meta" style={{ margin: '6px 0', fontStyle: 'italic' }}>{explain}</div>}

      <div className="fact-label" style={{ marginTop: 12 }}>Substitution ({5 - ctx.subsUsed} left)</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        <select className="inline-input" style={{ margin: 0 }} value={outId} onChange={e => setOutId(Number(e.target.value))}>
          <option value="">Off…</option>
          {starters.map(p => p && mine.onPitch.has(p.id) && (
            <option key={p.id} value={p.id}>
              {p.name} · {Math.round(mine.energy.get(p.id) ?? 70)}%
            </option>
          ))}
        </select>
        <select className="inline-input" style={{ margin: 0 }} value={inId} onChange={e => setInId(Number(e.target.value))}>
          <option value="">On…</option>
          {bench.map(p => p && <option key={p.id} value={p.id}>{p.name} ({p.pos})</option>)}
        </select>
        <button className="btn" disabled={!outId || !inId || ctx.subsUsed >= 5}
          onClick={() => { if (outId && inId) { setSubMsg(halfTimeSub(outId, inId)); setOutId(''); setInId('') } }}>
          Make
        </button>
      </div>
      <EnergyBars mine={mine} />
      {subMsg && <div className="meta" style={{ marginTop: 6 }}>{subMsg}</div>}
      <button className="btn gold block" style={{ margin: '14px 0 2px', width: '100%' }} onClick={onResume}>
        {resumeLabel}
      </button>
    </div>
  )
}

/** Tiny petrol gauges for the XV, most tired first. */
function EnergyBars({ mine }: { mine: SideCtx }) {
  const game = useStore(s => s.game)!
  const rows = mine.lineup.slice(0, 15)
    .map(id => id != null ? game.players[id] : null)
    .filter((p): p is Player => !!p && mine.onPitch.has(p.id))
    .map(p => ({ p, e: mine.energy.get(p.id) ?? 70 }))
    .sort((a, b) => a.e - b.e)
    .slice(0, 6)
  return (
    <div style={{ marginTop: 8 }}>
      <div className="fact-label">Emptiest Tanks</div>
      {rows.map(({ p, e }) => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0', fontSize: 11.5 }}>
          <span style={{ width: 120, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
          <div style={{ flex: 1, height: 7, background: 'var(--cream-3)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${e}%`, height: '100%', background: e < 25 ? '#9b2c2c' : e < 50 ? '#c9a227' : '#2f7d4f' }} />
          </div>
          <span style={{ width: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{Math.round(e)}%</span>
        </div>
      ))}
    </div>
  )
}
