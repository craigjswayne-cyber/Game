import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../../store'
import {
  matchStats, teamShort, teamUnits, rosterOf, autoSelect, availablePlayers,
  refFor, rollWeather, sideEnergy, type LiveCtx, type SideCtx,
} from '../../game/matchEngine'
import { BENCH_SLOTS, XV_SLOTS, fixtureDate, fixtureDayOff, weekDate, type MatchEvent, type Player, type Pos } from '../../game/model'
import { natFixtureThisWeek, userFixtureThisWeek, weekRng } from '../../game/season'
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

  const clubFx = game.unemployed ? undefined : userFixtureThisWeek(game)
  const fx = live?.fixture ?? clubFx ?? natFixtureThisWeek(game)
  if (!fx) {
    return (
      <div className="title-screen">
        <div>No fixture this week.</div>
        <button className="btn gold" style={{ marginTop: 16 }} onClick={back}>Back</button>
      </div>
    )
  }
  if (live) return <Live />
  const isClubMatch = fx.homeId === game.userClubId || fx.awayId === game.userClubId
  return isClubMatch ? <Preview fxId={fx.id} /> : <NationPreview fxId={fx.id} />
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
  const { kickOff, instantResult, back, touch } = useStore.getState()
  const [speech, setSpeech] = useState<SpeechId | null>(null)
  const [pickSlot, setPickSlot] = useState<number | null>(null)
  const [sel, setSel] = useState<number | null>(null)
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
    setSel(null)
    touch()
  }

  // FM Mobile interaction: tap to pick up, tap again to swap; double-tap = picker
  const tapSlot = (slot: number) => {
    if (sel == null) { setSel(slot); return }
    if (sel === slot) { setSel(null); setPickSlot(slot); return }
    const a = t.lineup[sel]
    t.lineup[sel] = t.lineup[slot]
    t.lineup[slot] = a
    setSel(null)
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
  // milestone watch: pre-announce the numbers worth playing for today
  for (const pid of t.lineup.slice(0, 15)) {
    const pl = pid != null ? game.players[pid] : null
    if (!pl) continue
    const cTries = pl.career.reduce((s, c) => s + c.tries, 0) + pl.stats.tries
    const cApps = pl.career.reduce((s, c) => s + c.apps, 0) + pl.stats.apps
    const cPts = pl.career.reduce((s, c) => s + c.points, 0) + pl.stats.points
    for (const [val, at, label] of [
      [cApps + 1, [100, 200, 300, 400], 'career appearance'],
      [cTries, [49, 99], 'career try — one more today'],
      [cPts, [495, 496, 497, 498, 499, 995, 996, 997, 998, 999], 'career point milestone in reach'],
    ] as const) {
      if ((at as readonly number[]).includes(val as number)) {
        warnings.push({ level: 'note', text: `MILESTONE WATCH: ${pl.name} — ${label === 'career appearance' ? `${val}th career appearance today` : label === 'career try — one more today' ? `try number ${(val as number) + 1} of his career would bring up ${(val as number) + 1 === 50 ? '50' : '100'}` : `closing on ${(val as number) < 990 ? '500' : '1,000'} career points`}.` })
        break
      }
    }
  }

  // late-season six-pointer: same fight, four points or fewer between you
  if (game.week >= 28 && comp?.type === 'league') {
    const order = [...comp.table].sort((a, b) => b.pts - a.pts)
    const mine = order.findIndex(r => r.teamId === game.userClubId)
    const theirs = order.findIndex(r => r.teamId === opp)
    if (mine >= 0 && theirs >= 0 && Math.abs(order[mine].pts - order[theirs].pts) <= 4 && Math.abs(mine - theirs) <= 2) {
      warnings.push({ level: 'note', text: `SIX-POINTER: ${Math.abs(order[mine].pts - order[theirs].pts) === 0 ? 'level on points' : `${Math.abs(order[mine].pts - order[theirs].pts)} points between you`} and fighting for the same prize. Beat them and bury them.` })
    }
  }
  const lastPlayed = game.fixtures.find(f =>
    f.week === game.week - 1 && f.played && (f.homeId === game.userClubId || f.awayId === game.userClubId))
  const gapDays = lastPlayed ? 7 + fixtureDayOff(fx.id) - fixtureDayOff(lastPlayed.id) : 7
  if (gapDays <= 5) warnings.push({ level: 'warn', text: `Only a ${gapDays}-day turnaround since the last match — the squad recovered slower this week. Watch the tanks.` })
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
      <tr key={slot} onClick={() => tapSlot(slot)}
        className={`${prob ? 'prob-row' : ''}${sel === slot ? ' held-row' : ''}`}>
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
            <div className="date">{comp?.name}{fx.stage ? ` · ${stageName(fx.stage)}` : ''} · {fixtureDate(game.season, fx.week, fx.id)}</div>
          </div>
          <button className="continue-btn" onClick={() => setConfirm(true)}>Kick Off ▸</button>
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
          const oppClub = game.clubs[opp]
          const meetings = game.fixtures.filter(f => f.played &&
            ((f.homeId === opp && f.awayId === game.userClubId) || (f.homeId === game.userClubId && f.awayId === opp)))
          const QUOTES = [
            'We know exactly how they want to play — and we\'re ready for it.',
            'No excuses from us this week. We\'ve targeted this one.',
            'They\'re a good side, but this is our patch.',
            'People keep writing us off. Suits us fine.',
            'We\'ve had a good week. You\'ll see a response on Saturday.',
          ]
          return (
            <>
              {game.matchPrep && (
                <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
                  <div className="fact-label">This Week's Preparation</div>
                  <div className="meta">
                    {{
                      attack: '⚡ Attacking Shapes — strike moves drilled all week. Attack sharpened.',
                      defence: '🛡 Defensive Drills — the wall is built. Defence sharpened.',
                      setpiece: '🏗 Set-Piece Work — scrum and lineout honed to a point.',
                      fitness: '🏃 Conditioning — the legs will last longer than theirs.',
                      recovery: '🧖 Recovery Week — fresh bodies, full tanks.',
                    }[game.matchPrep]}
                  </div>
                </div>
              )}
              {danger && (
                <div className="card" style={{ borderLeft: '4px solid #a12f2f' }}>
                  <div className="fact-label">Danger Man</div>
                  <div className="meta">
                    <b>{danger.name}</b> ({danger.pos}) is the one to shackle — {oppClub?.short ?? 'they'} play
                    through him. Keep him quiet and you're halfway there.
                  </div>
                </div>
              )}
              {(() => {
                const ref = refFor(fx.id)
                const blurb = ref.style === 'strict'
                  ? 'a stickler — walks the line all game and cards early. Keep the penalty count down or play with 14.'
                  : ref.style === 'lenient'
                    ? 'lets the game breathe — advantage over whistle. Expect a fast, open contest.'
                    : 'firm but fair. The game should be decided by the players.'
                return (
                  <div className="card">
                    <div className="fact-label">The Whistle</div>
                    <div className="meta"><b>{ref.name}</b> is {blurb}</div>
                  </div>
                )
              })()}
              {oppClub?.coach && (
                <div className="card">
                  <div className="fact-label">The Opposite Number</div>
                  <div className="meta">
                    <b>{oppClub.coach}</b> ({oppClub.short} head coach): “{QUOTES[(fx.id + game.week) % QUOTES.length]}”
                  </div>
                </div>
              )}
              {meetings.length > 0 && (
                <div className="card">
                  <div className="fact-label">Earlier This Season</div>
                  {meetings.map(m => (
                    <div key={m.id} className="meta">
                      {teamShort(game, m.homeId)} {m.homeScore} – {m.awayScore} {teamShort(game, m.awayId)}
                      {' '}<span className="muted">({game.comps[m.compId]?.short})</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )
        })()}
        <SectionTitle sub="your colours on the left">Head to Head</SectionTitle>
        {bar('Scrum', myUnits.scrum, oppUnits.scrum)}
        {bar('Lineout', myUnits.lineout, oppUnits.lineout)}
        {bar('Breakdown', myUnits.breakdown, oppUnits.breakdown)}
        {bar('Attack', myUnits.attack, oppUnits.attack)}
        {bar('Defence', myUnits.defence, oppUnits.defence)}

        <SectionTitle sub={sel != null ? `moving ${game.players[t.lineup[sel] ?? -1]?.name ?? 'empty slot'} — tap his new position` : 'tap a player, tap another to swap · tap twice for the squad list'}>Your XV</SectionTitle>
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
        <button className="btn ghost block" style={{ marginTop: 2 }}
          onClick={() => instantResult(speech ?? undefined)}>
          ⏩ Instant Result — the assistant takes over
        </button>
        <div className="spacer" />
      </main>
      {picker()}
      {readyModal()}
    </>
  )
}

/** Test-match preview: you're coaching your COUNTRY this week. */
function NationPreview({ fxId }: { fxId: number }) {
  const game = useStore(s => s.game)!
  useStore(s => s.tick)
  const { kickOff, instantResult, back } = useStore.getState()
  const [speech, setSpeech] = useState<SpeechId | null>(null)
  const [confirm, setConfirm] = useState(false)

  const fx = game.fixtures.find(f => f.id === fxId)!
  const comp = game.comps[fx.compId]
  const nat = (fx.homeId === game.natTeam || fx.awayId === game.natTeam) ? game.natTeam! : 'LIO'
  const opp = fx.homeId === nat ? fx.awayId : fx.homeId
  const [sel, setSel] = useState<number | null>(null)
  const [pickSlot, setPickSlot] = useState<number | null>(null)

  // the coach's Test 23: saved selection if valid, otherwise the selectors' XV
  if (!game.natLineup || game.natLineup.team !== nat) {
    game.natLineup = { team: nat, lineup: autoSelect(game, availablePlayers(game, rosterOf(game, nat), true)) }
  }
  const myLineup = game.natLineup.lineup
  const oppLineup = useMemo(() => autoSelect(game, availablePlayers(game, rosterOf(game, opp), true)), [game, opp])
  const myUnits = teamUnits(game, myLineup)
  const oppUnits = teamUnits(game, oppLineup)
  const { touch } = useStore.getState()

  const tapSlot = (slot: number) => {
    if (sel == null) { setSel(slot); return }
    if (sel === slot) { setSel(null); setPickSlot(slot); return }
    const a = myLineup[sel]
    myLineup[sel] = myLineup[slot]
    myLineup[slot] = a
    setSel(null)
    touch()
  }

  const setSlot = (slot: number, pid: number | null) => {
    if (pid != null) {
      const other = myLineup.indexOf(pid)
      if (other >= 0) myLineup[other] = myLineup[slot]
    }
    myLineup[slot] = pid
    setPickSlot(null)
    setSel(null)
    touch()
  }

  const bar = (label: string, mine: number, theirs: number) => {
    const total = mine + theirs
    const pct = total ? (mine / total) * 100 : 50
    return (
      <div style={{ padding: '4px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-soft)' }}>
          <span>{mine.toFixed(1)}</span><b style={{ color: 'var(--accent-ink)' }}>{label}</b><span>{theirs.toFixed(1)}</span>
        </div>
        <div style={{ height: 8, background: 'var(--cream-3)', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
          <div style={{ width: `${pct}%`, background: 'var(--green-700)' }} />
          <div style={{ flex: 1, background: 'var(--gold)', opacity: .7 }} />
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
            <h1>Test Match — {nat}</h1>
            <div className="date">{comp?.name}{fx.stage ? ` · ${stageName(fx.stage)}` : ''} · {fixtureDate(game.season, fx.week, fx.id)}</div>
          </div>
        </div>
      </header>
      <main className="content">
        <div className="card center">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 4 }}>
            <CrestT g={game} teamId={fx.homeId} size={40} />
            <span style={{ fontFamily: 'var(--cond)', fontWeight: 700, fontSize: 15, color: 'var(--ink-faint)', letterSpacing: 2 }}>VS</span>
            <CrestT g={game} teamId={fx.awayId} size={40} />
          </div>
          <h3 style={{ fontSize: 19 }}>{teamShort(game, fx.homeId)} v {teamShort(game, fx.awayId)}</h3>
          <div className="meta">🌍 International rugby — the whole country is watching, coach.</div>
        </div>
        <SectionTitle sub="your nation on the left">Head to Head</SectionTitle>
        {bar('Scrum', myUnits.scrum, oppUnits.scrum)}
        {bar('Lineout', myUnits.lineout, oppUnits.lineout)}
        {bar('Breakdown', myUnits.breakdown, oppUnits.breakdown)}
        {bar('Attack', myUnits.attack, oppUnits.attack)}
        {bar('Defence', myUnits.defence, oppUnits.defence)}

        <SectionTitle sub={sel != null ? `moving ${game.players[myLineup[sel] ?? -1]?.name ?? 'empty slot'} — tap his new position` : 'tap a player, tap another to swap · tap twice for the full squad'}>Your Test XV</SectionTitle>
        <div className="tblwrap"><table className="dtable"><tbody>
          {XV_SLOTS.map((s, i) => {
            const pid = myLineup[i]
            const p = pid != null ? game.players[pid] : null
            return (
              <tr key={i} onClick={() => tapSlot(i)} className={sel === i ? 'held-row' : undefined}>
                <td className="num" style={{ fontFamily: 'monospace', fontWeight: 700 }}>{s.shirt}</td>
                <td><PosBadge pos={s.pos} /></td>
                <td className="name">{p?.name ?? <span className="muted">— tap to pick —</span>}</td>
                <td>{p && <Stars ca={effAt(p, s.pos)} />}</td>
              </tr>
            )
          })}
        </tbody></table></div>
        <SectionTitle>Test Bench</SectionTitle>
        <div className="tblwrap"><table className="dtable"><tbody>
          {BENCH_SLOTS.map((s, i) => {
            const slot = 15 + i
            const pid = myLineup[slot]
            const p = pid != null ? game.players[pid] : null
            return (
              <tr key={slot} onClick={() => tapSlot(slot)} className={sel === slot ? 'held-row' : undefined}>
                <td className="num" style={{ fontFamily: 'monospace', fontWeight: 700 }}>{s.shirt}</td>
                <td><PosBadge pos={s.pos[0]} /></td>
                <td className="name">{p?.name ?? <span className="muted">— tap to pick —</span>}</td>
                <td>{p && <Stars ca={effAt(p, s.pos[0])} />}</td>
              </tr>
            )
          })}
        </tbody></table></div>
        {pickSlot != null && (
          <div className="modal-veil" onClick={() => setPickSlot(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="grab" />
              <SectionTitle sub="the full Test squad">
                Pick a {pickSlot < 15 ? XV_SLOTS[pickSlot].pos : BENCH_SLOTS[pickSlot - 15].pos[0]}
              </SectionTitle>
              <table className="dtable"><tbody>
                {availablePlayers(game, rosterOf(game, nat), true)
                  .sort((a, b) => effAt(b, pickSlot < 15 ? XV_SLOTS[pickSlot].pos : BENCH_SLOTS[pickSlot - 15].pos[0]) - effAt(a, pickSlot < 15 ? XV_SLOTS[pickSlot].pos : BENCH_SLOTS[pickSlot - 15].pos[0]))
                  .map(p => (
                    <tr key={p.id} onClick={() => setSlot(pickSlot, p.id)}
                      style={myLineup.includes(p.id) ? { opacity: .55 } : undefined}>
                      <td><PosBadge pos={p.pos} /></td>
                      <td className="name">{p.name}{myLineup.includes(p.id) ? ' (selected)' : ''}</td>
                      <td><Stars ca={p.ca} /></td>
                      <td className="num">{Math.round(p.cond)}%</td>
                    </tr>
                  ))}
              </tbody></table>
            </div>
          </div>
        )}

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
        <button className="btn ghost block" style={{ marginTop: 2 }}
          onClick={() => instantResult(speech ?? undefined)}>
          ⏩ Instant Result — the assistant takes over
        </button>
        <div className="spacer" />
      </main>
      {confirm && (
        <div className="modal-veil" onClick={() => setConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="grab" />
            <h3 style={{ fontSize: 17, margin: '4px 0 8px' }}>Ready to lead {nat} out?</h3>
            <div className="meta">Anthems done, jerseys presented. Substitutions and the team talk are yours from the touchline.</div>
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn ghost" onClick={() => setConfirm(false)}>Not Yet</button>
              <button className="btn gold" style={{ flex: 1.5, fontSize: 15 }}
                onClick={() => { setConfirm(false); kickOff(speech ?? undefined) }}>
                ▸ Take the Field
              </button>
            </div>
          </div>
        </div>
      )}
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

const BANNER: Partial<Record<MatchEvent['type'], string>> = {
  TRY: 'TRY!', PEN: 'PENALTY GOAL', DG: 'DROP GOAL!', CON: 'CONVERTED',
  YC: 'YELLOW CARD', RC: 'RED CARD', INJ: 'INJURY',
}

function PitchViz({ ctx, game, last, ballLeft, fxKey, showFx, showBig, lastTeamC }: {
  ctx: LiveCtx
  game: ReturnType<typeof useStore.getState>['game'] & object
  last: MatchEvent | undefined
  ballLeft: number
  fxKey: number
  showFx: boolean
  /** score banners still fire at fast-forward speeds */
  showBig: boolean
  lastTeamC: [string, string]
}) {
  const fx = ctx.fx
  const homeC = game!.clubs[fx.homeId]?.colors ?? ['#c9a227', '#082b20']
  const awayC = game!.clubs[fx.awayId]?.colors ?? ['#1a3a5c', '#f0eadc']
  const min = last?.min ?? 0
  const drift = (ballLeft - 50) * 0.14
  const evType = last?.type
  const towardHome = last?.teamId === fx.homeId
  const scoringFx = evType === 'TRY' || evType === 'PEN' || evType === 'DG' || evType === 'CON'
  const kickFx = evType === 'PEN' || evType === 'CON' || evType === 'DG'
  const banner = evType && (showFx || (showBig && scoringFx)) ? BANNER[evType] : undefined
  const txt = last?.text ?? ''
  const setPiece = showFx && evType === 'SUB'
    ? (/scrum/i.test(txt) ? 'SCRUM' : /lineout|against the throw/i.test(txt) ? 'LINEOUT' : /maul/i.test(txt) ? 'MAUL' : null)
    : null
  const kickMiss = evType === 'SUB' && /wide/i.test(txt)
  const kickCam = showFx && (kickFx || kickMiss)
  const binned = (side: SideCtx) =>
    side.lineup.slice(0, 15)
      .map(id => (id != null && (side.yellowUntil.get(id) ?? 0) > min) ? (side.yellowUntil.get(id)! - min) : 0)
      .filter(m => m > 0)

  const dots = (side: SideCtx, isHome: boolean) => {
    const cols = isHome ? homeC : awayC
    const capId = game!.clubs[side.teamId]?.captain
    // the side with the ball steps up; the defence holds its line deeper
    const attacking = last && last.teamId === side.teamId
    const atk = attacking ? (isHome ? 2.4 : -2.4) : (isHome ? -1.4 : 1.4)
    const ballTop = 38 + ((min * 13) % 25)
    // the two nearest forwards of each side work the breakdown
    const fwdSlots = [0, 1, 2, 3, 4, 5, 6, 7]
    const baseX = (slot: number) => {
      const [sx] = SPOTS[slot]
      return isHome ? 5 + sx * 0.40 + drift : 95 - sx * 0.40 + drift
    }
    const ruckers = [...fwdSlots]
      .sort((a, b) => Math.abs(baseX(a) - ballLeft) - Math.abs(baseX(b) - ballLeft))
      .slice(0, 2)
    return side.lineup.slice(0, 15).map((id, slot) => {
      if (id == null || !side.onPitch.has(id)) return null
      const binned = (side.yellowUntil.get(id) ?? 0) > min
      if (binned) return null
      const p = game!.players[id]
      if (!p) return null
      const [sx, sy] = SPOTS[slot]
      // every man moves: work-rate wander re-seeded each match minute
      const wx = ((min * 13 + slot * 29 + (isHome ? 0 : 7)) % 9) - 4
      const wy = ((min * 11 + slot * 17 + (isHome ? 3 : 0)) % 7) - 3
      const ruck = ruckers.includes(slot)
      let x = (isHome ? 5 + sx * 0.40 + drift : 95 - sx * 0.40 + drift) + atk + wx * 0.35
      let y = 8 + sy * 0.84 + wy * 0.9
      if (ruck) {
        // converge on the ball — bodies over the tackle area
        x = x * 0.45 + (ballLeft + (isHome ? -1.5 : 1.5)) * 0.55
        y = y * 0.5 + ballTop * 0.5
      } else if (attacking && slot >= 8) {
        // backs fan out wider and deeper, looking for space
        y = y + (y > 50 ? 3 : -3)
        x += isHome ? 1.2 : -1.2
      }
      const hl = last?.playerId === id
      const scorerRun = hl && evType === 'TRY' && showFx
      return (
        <div key={id}
          className={`pdot${hl ? ' hl' : ''}${capId === id ? ' cap' : ''}${scorerRun ? (isHome ? ' run-r' : ' run-l') : hl ? '' : ' jog'}`}
          style={{
            left: `${x}%`, top: `${y}%`,
            background: cols[0], borderColor: cols[1], color: contrastText(cols[0]),
            animationDuration: `${2.2 + (slot % 5) * 0.35}s`,
            animationDelay: `-${((slot * 0.41) % 2.2).toFixed(2)}s`,
          }}>
          {XV_SLOTS[slot].shirt}
          {hl && <span className="pname">{p.name.split(' ').slice(-1)[0]}</span>}
        </div>
      )
    })
  }

  return (
    <div className={`pitch${showFx && evType === 'TRY' ? (towardHome ? ' try-r' : ' try-l') : ''}`}>
      <div className="tryzone tz-l" style={{ left: 0, background: `linear-gradient(90deg, ${homeC[0]}cc, ${homeC[0]}55)` }} />
      <div className="tryzone tz-r" style={{ right: 0, background: `linear-gradient(270deg, ${awayC[0]}cc, ${awayC[0]}55)` }} />
      {[22, 50, 78].map(x => <div key={x} className="line" style={{ left: `${x}%` }} />)}
      {[36, 64].map(x => <div key={x} className="line dashed" style={{ left: `${x}%` }} />)}
      <div className="posts" style={{ left: '7%' }} />
      <div className="posts" style={{ right: '7%' }} />
      <div className="zone-label" style={{ left: '2.5%' }}>{teamShort(game!, fx.homeId).slice(0, 3).toUpperCase()}</div>
      <div className="zone-label" style={{ right: '2.5%' }}>{teamShort(game!, fx.awayId).slice(0, 3).toUpperCase()}</div>
      {dots(ctx.home, true)}
      {dots(ctx.away, false)}
      <div key={kickFx && showFx ? `k${fxKey}` : 'ball'}
        className={`ball${kickFx && showFx ? (towardHome ? ' kick-r' : ' kick-l') : ''}`}
        style={{ left: `${ballLeft}%`, top: `${38 + ((min * 13) % 25)}%` }} />
      {setPiece && (
        <div key={`sp${fxKey}`} className={`setp${setPiece === 'MAUL' ? ' maul' : ''}`}
          style={{ left: `${ballLeft}%`, top: '48%' }}>
          {setPiece === 'LINEOUT' ? (
            <>
              <span className="lo-col" style={{ background: homeC[0] }} />
              <span className="lo-col away" style={{ background: awayC[0] }} />
            </>
          ) : (
            <>
              <span className="pack l" style={{ background: homeC[0] }} />
              <span className="pack r" style={{ background: awayC[0] }} />
            </>
          )}
          <span className="splabel">{setPiece}</span>
        </div>
      )}
      {showFx && evType === 'TRY' && (
        <div key={`tb${fxKey}`} className="try-burst" style={{ left: towardHome ? '90%' : '10%' }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <i key={i} style={{
              background: i % 2 ? lastTeamC[0] : (lastTeamC[1] ?? '#fff'),
              ['--ang' as string]: `${i * 36}deg`,
            } as React.CSSProperties} />
          ))}
        </div>
      )}
      {kickCam && (
        <div key={`kc${fxKey}`} className={`kickcam${kickMiss ? ' miss' : ''}`}>
          <span className="kc-post l" /><span className="kc-post r" /><span className="kc-bar" />
          <span className="kc-ball" />
          <span className="kc-verdict">{kickMiss ? 'WIDE' : 'GOOD!'}</span>
        </div>
      )}
      {binned(ctx.home).map((m, i) => (
        <span key={`bh${i}`} className="bin-chip" style={{ left: `${3 + i * 13}%` }}>🟨 {m}′</span>
      ))}
      {binned(ctx.away).map((m, i) => (
        <span key={`ba${i}`} className="bin-chip" style={{ right: `${3 + i * 13}%` }}>🟨 {m}′</span>
      ))}
      {banner && (
        <div key={`b${fxKey}`}
          className={`ev-banner${evType === 'YC' ? ' yc' : ''}${evType === 'RC' ? ' rc' : ''}${evType === 'INJ' ? ' inj' : ''}`}
          style={scoringFx ? { background: lastTeamC[0], color: contrastText(lastTeamC[0]) } : undefined}>
          {evType === 'YC' && <span className="cardchip y" />}
          {evType === 'RC' && <span className="cardchip r" />}
          {banner}
        </div>
      )}
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
  const [showLog, setShowLog] = useState(false)
  const [showRatings, setShowRatings] = useState(false)
  const tickerRef = useRef<HTMLDivElement>(null)

  const { events, cursor, playing, fixture, ctx } = live
  const shown = events.slice(0, cursor)
  const last = shown[shown.length - 1]
  const caughtUp = cursor >= events.length
  const atHalfTime = caughtUp && ctx.awaiting === 'HT'
  const atBreak = caughtUp && ctx.awaiting === 'BRK'
  const atDecision = caughtUp && !!ctx.decision && ctx.seg < 3
  const done = caughtUp && ctx.seg === 3

  // coming back from another app can strand the heartbeat — kick it awake
  useEffect(() => {
    const wake = () => {
      const lm = useStore.getState().liveMatch
      if (document.visibilityState === 'visible' && lm?.playing) advanceLive()
    }
    document.addEventListener('visibilitychange', wake)
    return () => document.removeEventListener('visibilitychange', wake)
  }, [])

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
  const lastTeamC = last?.teamId === fixture.awayId ? awayC : homeC
  const showFx = playing && speedIdx < 2
  const panelActive = done || atHalfTime || atBreak || atDecision || (drawer && paused)

  return (
    <div className="live-wrap">
      <div className="scoreboard" style={{ '--home-c': homeC[0], '--away-c': awayC[0] } as React.CSSProperties}>
        <div className="teams">
          <div className="tname"><CrestT g={game} teamId={fixture.homeId} size={26} />{teamShort(game, fixture.homeId)}<span className="clubbar" style={{ background: homeC[0] }} /></div>
          <div className="score" key={`${hs}-${as}`}>{hs} – {as}</div>
          <div className="tname"><CrestT g={game} teamId={fixture.awayId} size={26} />{teamShort(game, fixture.awayId)}<span className="clubbar" style={{ background: awayC[0] }} /></div>
        </div>
        <div className="minute">
          {done ? 'Full Time' : atHalfTime ? 'Half-Time' : atBreak ? "60' Break" : `${Math.min(80, min)}'`} · {game.comps[fixture.compId]?.short}{fixture.stage ? ` ${stageName(fixture.stage)}` : ''}
          {fixture.weather && fixture.weather !== 'Dry' ? ` · ${WEATHER_ICON[fixture.weather]} ${fixture.weather}` : ''}
          {fixture.att ? ` · 👥 ${fixture.att.toLocaleString()}` : ''}
        </div>
        {!done && (
          <div className="momo-bar" title="Momentum">
            <div className="momo-fill" style={{
              background: `linear-gradient(90deg, ${homeC[0]}, transparent 50%, ${awayC[0]})`,
            }} />
            <div className="momo-needle" style={{ left: `${50 + ctx.momo * 44}%` }} />
          </div>
        )}
      </div>

      {!panelActive && (
        <PitchViz ctx={ctx} game={game} last={last} ballLeft={ballLeft}
          fxKey={cursor} showFx={showFx} showBig={playing} lastTeamC={lastTeamC} />
      )}

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

      {!panelActive && (
        <div className="now-strip">
          {last && (
            <div key={cursor} className={`now-line ${cls(last)}`}>
              <span className="min">{Math.min(80, last.min)}'</span>
              <span className="txt">{icon(last)} {last.text}</span>
            </div>
          )}
        </div>
      )}
      {panelActive && (
      <div className="content ticker panel-area" ref={tickerRef}>
        {atDecision && <DecisionPanel />}
        {drawer && paused && !done && !atDecision && (
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
            <div className="review-grid">
              <div>
                <MatchVerdict />
                <Highlights />
              </div>
              <div>
                <StatsPanel />
              </div>
            </div>
            <div className="btn-row" style={{ margin: '4px 14px' }}>
              <button className="btn ghost" onClick={() => setShowRatings(!showRatings)}>
                {showRatings ? 'Hide ratings' : '⭐ Player ratings'}
              </button>
              <button className="btn ghost" onClick={() => setShowLog(!showLog)}>
                {showLog ? 'Hide commentary' : `📜 Commentary (${shown.length})`}
              </button>
            </div>
            {showRatings && <RatingsPanel />}
            {showLog && shown.map((e, i) => (
              <div key={i} className={`tick-event ${cls(e)}`}>
                <span className="min">{e.min}'</span>
                <span className="txt">{icon(e)} {e.text}</span>
              </div>
            ))}
            <button className="btn gold block" style={{ margin: '10px 14px 14px' }} onClick={finishMatch}>
              Continue to Results ▸
            </button>
          </>
        )}
      </div>
      )}
    </div>
  )
}

/** A kickable penalty: posts, corner, or tap — your call, gaffer. */
function DecisionPanel() {
  const game = useStore(s => s.game)!
  const live = useStore(s => s.liveMatch)!
  const { decide } = useStore.getState()
  const ctx = live.ctx
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  const opp = mine === ctx.home ? ctx.away : ctx.home
  const diff = mine.score - opp.score
  const kicker = mine.units.kickerId != null ? game.players[mine.units.kickerId] : null

  const options = [
    {
      id: 'posts' as const, icon: '🥅', name: 'Take the Points',
      desc: `${kicker ? kicker.name : 'Your kicker'} lines it up. Safe three${diff < 0 && diff >= -3 ? ' — levels or leads' : ''}.`,
    },
    {
      id: 'corner' as const, icon: '🚀', name: 'Kick to the Corner',
      desc: 'Lineout five metres out. Maul for the try — glory or nothing.',
    },
    {
      id: 'tap' as const, icon: '⚡', name: 'Tap & Go',
      desc: 'Catch them flat-footed. Keeps the tempo scorching.',
    },
  ]

  return (
    <div className="card" style={{ margin: '12px 0', borderLeft: '4px solid #a12f2f' }}>
      <h3 style={{ fontSize: 15 }}>⏱ Penalty — your call from the touchline</h3>
      <div className="meta" style={{ marginBottom: 8 }}>
        {teamShort(game, mine.teamId)} {mine.score} – {opp.score} {teamShort(game, opp.teamId)} ·
        {diff < 0 ? ` ${-diff} behind` : diff > 0 ? ` ${diff} ahead` : ' all square'} · {ctx.lastMin}'
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {options.map(o => (
          <button key={o.id} className="btn ghost" style={{ textAlign: 'left', padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'center' }}
            onClick={() => decide(o.id)}>
            <span style={{ fontSize: 20 }}>{o.icon}</span>
            <span>
              <b style={{ display: 'block', fontSize: 13.5 }}>{o.name}</b>
              <span style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>{o.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** The three moments everyone will be talking about on the drive home. */
function MatchVerdict() {
  const game = useStore(s => s.game)!
  const live = useStore(s => s.liveMatch)!
  const ctx = live.ctx
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  const opp = mine === ctx.home ? ctx.away : ctx.home
  const star = ctx.motmId != null ? game.players[ctx.motmId] : null
  const starMine = star && mine.ratings.has(star.id)
  const margin = mine.score - opp.score
  const t = ctx.home.poss + ctx.away.poss || 1
  const myPoss = Math.round(((mine === ctx.home ? ctx.home.poss : ctx.away.poss) / t) * 100)
  const feedback = margin > 0
    ? (myPoss < 45 ? 'We won without the ball — the defensive shift was enormous. Take that anywhere.'
      : margin >= 20 ? 'Ruthless. The assistant wants the same standards next week, not a lap of honour.'
      : 'Winning tight ones is a habit — and we just fed the habit.')
    : margin === 0
      ? 'A draw that will feel like a loss or a win by Tuesday, depending on the video.'
      : (myPoss >= 55 ? 'All that ball and nothing to show for it — the assistant circles our finishing in red.'
        : margin <= -20 ? 'Beaten in every collision. The review will be honest, and it will sting.'
        : 'Fine margins. Fix two moments and that is our game.')
  return (
    <div className="card" style={{ borderLeft: '4px solid var(--gold-bright)' }}>
      {star && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="fact-label">Star Player</div>
            <b>{star.name}</b> <span className="muted">({starMine ? 'yours' : teamShort(game, opp.teamId)})</span>
          </div>
          <span className="form-pill" style={{ background: '#2f7d4f', fontSize: 15 }}>
            {ctx.motmId != null ? (mine.ratings.get(ctx.motmId) ?? opp.ratings.get(ctx.motmId) ?? 7).toFixed(1) : ''}
          </span>
        </div>
      )}
      <div className="fact-label" style={{ marginTop: 8 }}>Coach's Verdict</div>
      <div className="meta">{feedback}</div>
    </div>
  )
}

function Highlights() {
  const live = useStore(s => s.liveMatch)!
  const weight = (e: MatchEvent) =>
    e.type === 'RC' ? 90 : e.type === 'TRY' ? 80 + e.min / 10 : e.type === 'DG' ? 55 : e.type === 'YC' ? 30 : 0
  const picks = [...live.ctx.events]
    .filter(e => weight(e) > 0)
    .sort((a, b) => weight(b) - weight(a))
    .slice(0, 3)
    .sort((a, b) => a.min - b.min)
  if (!picks.length) return null
  return (
    <div className="card" style={{ margin: '12px 0', borderLeft: '4px solid var(--gold-bright)' }}>
      <h3 style={{ fontSize: 14 }}>🎬 The Highlights</h3>
      {picks.map((e, i) => (
        <div key={i} className="meta" style={{ padding: '3px 0' }}>
          <b style={{ fontFamily: 'var(--cond)' }}>{e.min}'</b> — {e.text}
        </div>
      ))}
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
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  if (mine.teamId !== ctx.userSideId) return null
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
  const isClubMatch = ctx.userSideId === game.userClubId
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  const starters = mine.lineup.slice(0, 15).map(id => id != null ? game.players[id] : null).filter(Boolean)
  const bench = mine.lineup.slice(15).map(id => id != null ? game.players[id] : null)
    .filter(p => p && !p.injury && !mine.onPitch.has(p.id) && !mine.ratings.has(p.id))

  // the assistant's whisper: who's gassed, who's struggling, who's on thin ice
  const advice: string[] = []
  if (ctx.subsUsed < 5) {
    const tired = [...mine.onPitch]
      .map(id => ({ p: game.players[id], e: mine.energy.get(id) ?? 100 }))
      .filter(x => x.p && x.e < 38)
      .sort((a, b) => a.e - b.e)
    for (const { p, e } of tired.slice(0, 2)) {
      const cover = bench.find(b => b && (b.pos === p!.pos || b.alt.includes(p!.pos)))
      advice.push(`🔋 ${p!.name} is running on fumes (${Math.round(e)}%)${cover ? ` — ${cover.name} covers ${p!.pos} from the bench` : ''}.`)
    }
  }
  const min = ctx.tick * 4
  if (min >= 45) {
    const poor = [...mine.ratings.entries()]
      .map(([id, r]) => ({ p: game.players[id], r }))
      .filter(x => x.p && mine.onPitch.has(x.p.id) && x.r < 4.6)
      .sort((a, b) => a.r - b.r)[0]
    if (poor) advice.push(`📉 ${poor.p!.name} is having one of those days (${poor.r.toFixed(1)}) — fresh legs might spare him.`)
  }
  for (const e of live.events.slice(0, live.cursor)) {
    if (e.type === 'YC' && e.playerId != null && mine.onPitch.has(e.playerId) && (mine.yellowUntil.get(e.playerId) ?? 0) <= min) {
      const p = game.players[e.playerId]
      if (p) advice.push(`🟨 ${p.name} is walking a tightrope — one more infringement and it's red.`)
      break
    }
  }

  const talks = [
    ['fire', '🗣️ Shouting'],
    ['calm', '🧊 Calm'],
    ['demand', '📣 Encouraging'],
    ['praise', '😄 Delighted'],
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
      {advice.length > 0 && (
        <div style={{ margin: '6px 0 2px', padding: '8px 10px', background: 'color-mix(in srgb, var(--gold-bright) 14%, var(--paper))', borderRadius: 8 }}>
          <div className="fact-label">Assistant's Notes</div>
          {advice.slice(0, 3).map((a, i) => (
            <div key={i} className="meta" style={{ marginTop: 3 }}>{a}</div>
          ))}
        </div>
      )}
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
        <div className="meta" style={{ margin: '6px 0' }}>{live.talkMsg}</div>
      ))}

      {isClubMatch && <>
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
      {explain && <div className="meta" style={{ margin: '6px 0' }}>{explain}</div>}
      </>}

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
