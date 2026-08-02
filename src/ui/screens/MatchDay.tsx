import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../../store'
import { teamShort, teamUnits, rosterOf, autoSelect, availablePlayers } from '../../game/matchEngine'
import { XV_SLOTS, weekDate, type MatchEvent } from '../../game/model'
import { userFixtureThisWeek } from '../../game/season'
import { CrestT, SectionTitle } from '../components'
import { stageName } from './Home'

export default function MatchDay() {
  const game = useStore(s => s.game)!
  const live = useStore(s => s.liveMatch)
  const { kickOff, finishMatch, matchCursor, back } = useStore.getState()

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

function Preview({ fxId }: { fxId: number }) {
  const game = useStore(s => s.game)!
  const { kickOff, back, go } = useStore.getState()
  const fx = game.fixtures.find(f => f.id === fxId)!
  const comp = game.comps[fx.compId]
  const home = game.clubs[fx.homeId]
  const isHome = fx.homeId === game.userClubId
  const opp = isHome ? fx.awayId : fx.homeId

  const oppLineup = useMemo(() => {
    const pool = availablePlayers(game, rosterOf(game, opp))
    return autoSelect(game, pool)
  }, [game, opp])
  const oppUnits = teamUnits(game, oppLineup)
  const myUnits = teamUnits(game, game.clubs[game.userClubId].tactic.lineup)

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
            <span style={{ fontFamily: 'var(--cond)', fontWeight: 700, fontSize: 15, color: 'var(--ink-faint)', letterSpacing: 2 }}>VS</span>
            <CrestT g={game} teamId={fx.awayId} size={38} />
          </div>
          <h3 style={{ fontSize: 19 }}>{teamShort(game, fx.homeId)} v {teamShort(game, fx.awayId)}</h3>
          <div className="meta">🏟️ {home?.stadium ?? 'Neutral venue'}{home ? `, ${home.city}` : ''}</div>
        </div>
        <SectionTitle sub="your colours on the left">Head to Head</SectionTitle>
        {bar('Scrum', myUnits.scrum, oppUnits.scrum)}
        {bar('Lineout', myUnits.lineout, oppUnits.lineout)}
        {bar('Breakdown', myUnits.breakdown, oppUnits.breakdown)}
        {bar('Attack', myUnits.attack, oppUnits.attack)}
        {bar('Defence', myUnits.defence, oppUnits.defence)}
        <SectionTitle>Your XV</SectionTitle>
        <table className="dtable"><tbody>
          {XV_SLOTS.map((s, i) => {
            const pid = game.clubs[game.userClubId].tactic.lineup[i]
            const p = pid != null ? game.players[pid] : null
            const out = p && (p.injury || p.bans > 0 || p.natSquad)
            return (
              <tr key={i}>
                <td className="num" style={{ fontFamily: 'monospace', fontWeight: 700 }}>{s.shirt}</td>
                <td className="name">
                  {p?.name ?? <span style={{ color: '#9b2c2c' }}>MISSING — fix in Tactics</span>}
                  {out && <span style={{ color: '#9b2c2c', fontSize: 11, fontWeight: 700 }}>
                    {' '}({p!.injury ? 'INJURED' : p!.bans > 0 ? 'SUSPENDED' : 'INTL DUTY'} — will be replaced)
                  </span>}
                </td>
              </tr>
            )
          })}
        </tbody></table>
        <div className="btn-row">
          <button className="btn ghost" onClick={() => go('tactics')}>Tactics</button>
          <button className="btn gold" style={{ fontSize: 16 }} onClick={kickOff}>Kick Off ▸</button>
        </div>
        <div className="spacer" />
      </main>
    </>
  )
}

const SPEEDS = [{ label: '▶', ms: 900 }, { label: '▶▶', ms: 350 }, { label: '▶▶▶', ms: 90 }]

function Live() {
  const game = useStore(s => s.game)!
  const live = useStore(s => s.liveMatch)!
  const { matchCursor, finishMatch } = useStore.getState()
  const [speedIdx, setSpeedIdx] = useState(0)
  const tickerRef = useRef<HTMLDivElement>(null)

  const { events, cursor, playing, fixture } = live
  const shown = events.slice(0, cursor)
  const last = shown[shown.length - 1]
  const done = cursor >= events.length

  useEffect(() => {
    if (!playing || done) return
    const t = setTimeout(() => matchCursor(cursor + 1, true), SPEEDS[speedIdx].ms)
    return () => clearTimeout(t)
  }, [cursor, playing, speedIdx, done])

  useEffect(() => {
    tickerRef.current?.scrollTo({ top: tickerRef.current.scrollHeight, behavior: 'smooth' })
  }, [cursor])

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
    TRY: '🏉', CON: '🎯', PEN: '🥅', DG: '🎯', YC: '🟨', RC: '🟥', INJ: '🩹', HT: '⏸', FT: '🏁', KO: '⏱', SUB: '·',
  }[e.type] ?? '·')

  const homeC = game.clubs[fixture.homeId]?.colors ?? ['#c9a227', '#082b20']
  const awayC = game.clubs[fixture.awayId]?.colors ?? ['#c9a227', '#082b20']

  return (
    <>
      <div className="scoreboard" style={{ '--home-c': homeC[0], '--away-c': awayC[0] } as React.CSSProperties}>
        <div className="teams">
          <div className="tname"><CrestT g={game} teamId={fixture.homeId} size={26} />{teamShort(game, fixture.homeId)}<span className="clubbar" style={{ background: homeC[0] }} /></div>
          <div className="score">{hs} – {as}</div>
          <div className="tname"><CrestT g={game} teamId={fixture.awayId} size={26} />{teamShort(game, fixture.awayId)}<span className="clubbar" style={{ background: awayC[0] }} /></div>
        </div>
        <div className="minute">{done ? 'Full Time' : `${Math.min(80, min)}'`} · {game.comps[fixture.compId]?.short}{fixture.stage ? ` ${stageName(fixture.stage)}` : ''}</div>
      </div>

      <div className="pitch">
        <div className="tryzone" style={{ left: 0, background: `linear-gradient(90deg, ${homeC[0]}cc, ${homeC[0]}55)` }} />
        <div className="tryzone" style={{ right: 0, background: `linear-gradient(270deg, ${awayC[0]}cc, ${awayC[0]}55)` }} />
        {[22, 50, 78].map(x => <div key={x} className="line" style={{ left: `${x}%` }} />)}
        {[36, 64].map(x => <div key={x} className="line dashed" style={{ left: `${x}%` }} />)}
        <div className="posts" style={{ left: '7%' }} />
        <div className="posts" style={{ right: '7%' }} />
        <div className="zone-label" style={{ left: '2.5%' }}>{teamShort(game, fixture.homeId).slice(0, 3).toUpperCase()}</div>
        <div className="zone-label" style={{ right: '2.5%' }}>{teamShort(game, fixture.awayId).slice(0, 3).toUpperCase()}</div>
        <div className="ball" style={{ left: `${ballLeft}%`, top: `${38 + ((min * 13) % 25)}%` }} />
      </div>

      <div className="speed-controls">
        {SPEEDS.map((s, i) => (
          <button key={i} className={`btn ${i === speedIdx && playing ? 'gold' : 'ghost'}`}
            onClick={() => { setSpeedIdx(i); matchCursor(cursor, true) }}>{s.label}</button>
        ))}
        <button className="btn ghost" onClick={() => matchCursor(playing ? cursor : cursor, !playing)}>
          {playing ? '⏸' : '▶'}
        </button>
        {!done && <button className="btn" onClick={() => matchCursor(events.length, false)}>Skip ⏭</button>}
      </div>

      <div className="content ticker" ref={tickerRef} style={{ flex: 1 }}>
        {shown.map((e, i) => (
          <div key={i} className={`tick-event ${cls(e)}`}>
            <span className="min">{e.min}'</span>
            <span className="txt">{icon(e)} {e.text}</span>
          </div>
        ))}
        {done && (
          <button className="btn gold block" style={{ margin: '14px 0' }} onClick={finishMatch}>
            Continue to Results ▸
          </button>
        )}
      </div>
    </>
  )
}
