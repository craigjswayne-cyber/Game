import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../../store'
import {
  matchStats, teamShort, teamUnits, rosterOf, autoSelect, availablePlayers,
  refFor, refNotes, frontRowCover, repairSheet, rollWeather, sideEnergy, type LiveCtx, type SideCtx,
} from '../../game/matchEngine'
import { BENCH_SLOTS, CHEM_SLOTS, XV_SLOTS, chemKey, chemTier, fixtureDate, fixtureDayOff, grudgeBetween, inRedZone, oldBoyApps, weekDate, type MatchEvent, type Player, type Pos } from '../../game/model'
import { BRIEF_BY_ID, SPLIT_BY_ID, benchSeats, briefForSeat, splitFor } from '../../game/bench'
import { natFixtureThisWeek, userFixtureThisWeek, weekRng } from '../../game/season'
import { effAt } from '../../game/attributes'
import { PRESETS, SLIDER_INFO, sliderReadout, type SliderKey } from '../../game/tactics'
import { coachFixes, unitBattles } from '../../game/coachfix'
import { CrestT, Jersey, PosBadge, SectionTitle, Stars } from '../components'
import { stageName } from './Home'
import { matchSfx, soundOn, toggleSound } from '../audio'
import { derbyName } from '../../game/rivalries'
import { dialLine, philosophyOf } from '../../game/philosophy'
import { venueEffect } from '../../game/venue'

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
  { id: 'calm', icon: '🧊', name: 'Calm the nerves', desc: 'Defence up, discipline up. Solid start.' },
  { id: 'fire', icon: '🔥', name: 'Light the fuse', desc: 'Attack & breakdown up - but cards loom.' },
  { id: 'underdog', icon: '🐺', name: 'Nobody rates us', desc: 'Big lift when written off; flat if you\'re favourites.' },
  { id: 'expect', icon: '👑', name: 'I expect a win', desc: 'Standards. Lands when strongest; risky otherwise.' },
] as const
type SpeechId = typeof SPEECHES[number]['id']

/** Three ways to spend a match (F5).
 *
 *  A season is forty-odd fixtures and a phone is not a sofa. Watching every ruck
 *  of a pre-season friendly is not immersion, it is a chore, and the game already
 *  had the two extremes (full commentary, or Instant Result buried under the
 *  team sheet). The middle one is the useful one, and putting all three in a row
 *  makes the choice a decision rather than a button nobody finds. */
const VIEW_MODES = [
  { id: 'full', icon: '📺', name: 'Every minute', desc: 'The full commentary, ruck by ruck. Every touchline call is yours.' },
  { id: 'highlights', icon: '🎬', name: 'Highlights', desc: 'The ticker stops for scores, cards and injuries only. Half-time and the hour are still yours.' },
  { id: 'instant', icon: '⏩', name: 'Assistant', desc: 'He takes the touchline and you read the report. Straight to the result.' },
] as const

/** Chips on one line with a readout underneath, the same shape as the exit
 *  strategy and penalty instruction on the Tactics page.
 *
 *  It started as three explanatory cards, which is clearer in isolation and cost
 *  95px in a modal that already filled a 390px-tall screen: the "say nothing"
 *  button fell off the bottom. One line plus a sentence about the choice you
 *  have actually made says the same thing in half the room. */
function ViewPicker({ view, onPick }: {
  view: 'full' | 'highlights' | 'instant'
  onPick: (v: 'full' | 'highlights' | 'instant') => void
}) {
  return (
    <>
      <div className="set-label">How will you watch this one?</div>
      <div className="preset-row">
        {VIEW_MODES.map(v => (
          <button key={v.id} className={`preset-chip${view === v.id ? ' on' : ''}`} title={v.desc}
            onClick={() => onPick(v.id)}>{v.icon} {v.name}</button>
        ))}
      </div>
      <div className="meta" style={{ marginTop: 4 }}>
        {VIEW_MODES.find(v => v.id === view)?.desc}
      </div>
    </>
  )
}

function Preview({ fxId }: { fxId: number }) {
  const game = useStore(s => s.game)!
  useStore(s => s.tick)
  const { kickOff, instantResult, back, touch } = useStore.getState()
  const [speech, setSpeech] = useState<SpeechId | null>(null)
  const [pickSlot, setPickSlot] = useState<number | null>(null)
  const [sel, setSel] = useState<number | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [planApplied, setPlanApplied] = useState(false)
  const [ptab, setPtab] = useState<'brief' | 'team' | 'talk'>('team')
  /**
   * The dressing room comes to you (user: "a pre-game team talk should pop up
   * before the game starts as you load into the game section").
   *
   * It was a tab called Talk, which meant the single most characterful decision
   * of a match week was opt-in and most weeks nobody opted in - the kick-off
   * warning "no dressing-room speech chosen" was the game admitting it. Now the
   * room is the first thing you walk into, once per match, and you can still
   * shut the door and come back to the tab.
   */
  const [talkOpen, setTalkOpen] = useState(false)
  const [talkDone, setTalkDone] = useState(false)

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

  // the bench seats are whatever the split says they are (F4)
  const seats = benchSeats(club)
  /** The position a slot is asking for. An open bench seat asks for whatever the
   *  man in it plays (user: "use players positions"), so a winger in the 21 shirt
   *  reads WG rather than being mislabelled a scrum-half. The front-row three are
   *  never open: Law 3 wants them covered. */
  const slotPos = (slot: number): Pos => {
    if (slot < 15) return XV_SLOTS[slot].pos
    const seat = seats[slot - 15]
    if (seat.open) {
      const id = t.lineup[slot]
      const p = id != null ? game.players[id] : null
      if (p) return p.pos
    }
    return seat.pos[0]
  }

  /** A sheet edited here is the manager's, same as on the Selection screen:
   *  the engine must not re-pick it on the way out of the tunnel. */
  const claim = () => { t.userPicked = true }

  const setSlot = (slot: number, pid: number | null) => {
    if (pid != null) {
      const other = t.lineup.indexOf(pid)
      if (other >= 0) t.lineup[other] = t.lineup[slot]
    }
    t.lineup[slot] = pid
    claim()
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
    claim()
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
    if (prob) warnings.push({ level: 'bad', text: `No fit no. ${XV_SLOTS[i].shirt} (${prob === 'EMPTY' ? 'empty slot' : `${p!.name} - ${prob.toLowerCase()}`}) - he'll be auto-replaced at kick-off.` })
    else if ((p!.rust ?? 0) > 0) warnings.push({ level: 'warn', text: `${p!.name} is RUSTY (${p!.rust}w) - high re-injury risk if he plays.` })
    else if (p!.cond < 60) warnings.push({ level: 'warn', text: `${p!.name} is only ${Math.round(p!.cond)}% fit - his tank will empty early.` })
  }
  // Law 3: without cover at all three front-row positions the referee orders
  // uncontested scrums, and the set piece leaves the game for both sides. Loud,
  // because it is the one warning here that voids a whole game plan.
  //
  // JUDGED ON THE SHEET THAT WILL PLAY, NOT THE SHEET AS SAVED. Reported from a
  // live game: "my wife had props on the bench and a hooker but the game flashed
  // up this message." She was right and the warning was wrong. It used to read
  // t.lineup, the sheet exactly as she left it, and frontRowCover does not count a
  // man who is injured - so a tighthead who picked up a knock during the week and
  // was still named at 3 took the count from two to one, and the warning shouted
  // about uncontested scrums while a tighthead sat on the bench she was looking at.
  //
  // The engine never had this bug: beginMatch feeds it the repaired sheet, so the
  // scrum WAS contested. The warning was the only thing that was wrong, which is
  // the worst version of it - it told her to fix a side that needed no fixing.
  //
  // repairSheet is the right thing to ask because it is what kick-off does and it
  // is pure: every named man who can play keeps his own shirt, and only the broken
  // slots are filled, from the men she did not name.
  const frontRow = frontRowCover(game, repairSheet(game, club, t.lineup, splitFor(club)))
  if (!frontRow.legal) {
    const missing = ([['LP', 'loosehead'], ['HK', 'hooker'], ['TP', 'tighthead']] as const)
      .filter(([k]) => frontRow[k] < 2)
      .map(([k, word]) => `${word} (${frontRow[k]} of 2)`)
      .join(', ')
    warnings.push({
      level: 'bad',
      text: `UNCONTESTED SCRUMS: your 23 cannot cover ${missing}. Law 3 needs two men able to play each front-row shirt, and without them nobody contests a scrum all afternoon.`,
    })
  }
  // milestone watch: pre-announce the numbers worth playing for today
  for (const pid of t.lineup.slice(0, 15)) {
    const pl = pid != null ? game.players[pid] : null
    if (!pl) continue
    const cTries = pl.career.reduce((s, c) => s + c.tries, 0) + pl.stats.tries + (pl.hist?.tries ?? 0)
    const cApps = pl.career.reduce((s, c) => s + c.apps, 0) + pl.stats.apps + (pl.hist?.apps ?? 0)
    const cPts = pl.career.reduce((s, c) => s + c.points, 0) + pl.stats.points + (pl.hist?.points ?? 0)
    for (const [val, at, label] of [
      [cApps + 1, [100, 200, 300, 400], 'career appearance'],
      [cTries, [49, 99], 'career try - one more today'],
      [cPts, [495, 496, 497, 498, 499, 995, 996, 997, 998, 999], 'career point milestone in reach'],
    ] as const) {
      if ((at as readonly number[]).includes(val as number)) {
        warnings.push({ level: 'note', text: `MILESTONE WATCH: ${pl.name} - ${label === 'career appearance' ? `${val}th career appearance today` : label === 'career try - one more today' ? `try number ${(val as number) + 1} of his career would bring up ${(val as number) + 1 === 50 ? '50' : '100'}` : `closing on ${(val as number) < 990 ? '500' : '1,000'} career points`}.` })
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
  if (gapDays <= 5) warnings.push({ level: 'warn', text: `Only a ${gapDays}-day turnaround since the last match - the squad recovered slower this week. Watch the tanks.` })
  if (!speech) warnings.push({ level: 'note', text: 'No dressing-room speech chosen - the players will make their own minds up.' })

  // rotation dilemma: before a cup tie or on a quick turnaround, the
  // assistant flags overloaded/underdone legs and offers a one-tap rotation
  const rotFlagged = t.lineup.slice(0, 15)
    .map(id => id != null ? game.players[id] : null)
    .filter((p): p is Player => !!p && !p.injury && p.clubId === club.id && (inRedZone(p) || p.cond < 62))
  const rotWindow = comp?.type !== 'league' || gapDays <= 5
  const rotReason = (p: Player) => inRedZone(p) ? 'red zone' : `${Math.round(p.cond)}% fit`
  const rotateXV = () => {
    const rest = new Set(rotFlagged.map(p => p.id))
    const pool = availablePlayers(game, club.players).filter(p => !rest.has(p.id))
    const fresh = autoSelect(game, pool)
    for (let i = 0; i < 23; i++) t.lineup[i] = fresh[i]
    touch()
  }

  // the assistant reads the matchup and proposes a game plan in plain English
  const forecast = rollWeather(game.week, weekRng(game))
  const matchRef = refFor(fx.id)
  const oppCond = (() => {
    const xv = oppLineup.slice(0, 15).map(id => id != null ? game.players[id] : null).filter(Boolean)
    return xv.length ? xv.reduce((s, p) => s + p!.cond, 0) / xv.length : 85
  })()
  const heated = !!derbyName(fx.homeId, fx.awayId) || !!grudgeBetween(game, fx.homeId, fx.awayId)
  const gamePlan = (() => {
    // the assistant's voice rotates per fixture (fx.id keeps it stable
    // across re-renders) so the same advice never reads the same twice
    const v = (opts: string[]) => opts[fx.id % opts.length]
    const plans: { text: string; d: Partial<Record<SliderKey, number>>; w: number }[] = []
    if (forecast === 'Rain' || forecast === 'Snow')
      plans.push({ w: 3, text: v([
        `${forecast} forecast - put boot to ball and pin the corners. Handling sides drown in this.`,
        `${forecast} on the way. Territory wins this one: kick long, chase hard, let them make the mistakes.`,
        `Filthy weather due. Keep the ball off the deck at your peril - this is a day for the boot and the maul.`,
      ]), d: { kicking: 15, style: -8 } })
    if (oppUnits.scrum < myUnits.scrum * 0.94)
      plans.push({ w: 2.5, text: v([
        'Their scrum creaks. Keep it tight and squeeze the penalties out of them.',
        'We have them at the scrum. March them backwards until the referee gets bored of whistling.',
        'Their front row is the weak link. Every scrum is three points waiting to happen.',
      ]), d: { style: -10, aggression: 8 } })
    if (myUnits.scrum < oppUnits.scrum * 0.94)
      plans.push({ w: 2, text: v([
        'Avoid the arm wrestle - their pack is a handful. Play away from the set-piece.',
        'Do not feed their scrum. Quick taps, quick lineouts, keep the big lads honest and blowing.',
        'Their pack wants a fight we cannot win. Deny them the set-piece and stretch the game.',
      ]), d: { style: 8, kicking: 6 } })
    if (oppUnits.defence < myUnits.attack * 0.95)
      plans.push({ w: 2, text: v([
        'Their edge defence is the soft spot. Go wide and shift the point of attack.',
        'Numbers out wide win this. Two passes past the ruck and they are scrambling.',
        'Their wings tuck in. Earn the corner and the tries will follow.',
      ]), d: { style: 12, tempo: 8 } })
    if (myUnits.lineout > oppUnits.lineout * 1.07)
      plans.push({ w: 1.5, text: v([
        'You own the air. Kick for touch and strangle the field position.',
        'Their lineout wobbles under pressure. Kick to the corners and feast on the throw.',
      ]), d: { kicking: 10 } })
    if (matchRef.style === 'strict')
      plans.push({ w: 2, text: v([
        `${matchRef.name} cards early - discipline first at the ruck.`,
        `${matchRef.name} referees the letter of the law. Stay on your feet, hands off, no cheap shots.`,
      ]), d: { aggression: -12 } })
    if (matchRef.style === 'lenient')
      plans.push({ w: 1.5, text: v([
        `${matchRef.name} lets it flow - lift the tempo and fight every breakdown.`,
        `${matchRef.name} keeps the whistle in his pocket. The breakdown is a street fight today - win it.`,
      ]), d: { tempo: 10, aggression: 6 } })
    if (oppCond < 78)
      plans.push({ w: 2, text: v([
        'Their legs are heavy this week. Run them off their feet.',
        'They backed up a hard match and it shows. High tempo from the first whistle and they will crack late.',
      ]), d: { tempo: 12 } })
    if (heated)
      plans.push({ w: 1.8, text: v([
        'This one will boil over. Be the calmer side and let them implode.',
        'Bad blood in this fixture. Let them throw the punches and take the points from the penalties.',
      ]), d: { aggression: -8 } })
    return plans.sort((a, b) => b.w - a.w).slice(0, 3)
  })()
  const applyPlan = () => {
    for (const p of gamePlan) {
      for (const [k, dv] of Object.entries(p.d) as [SliderKey, number][]) {
        t[k] = Math.max(5, Math.min(95, t[k] + dv))
      }
    }
    setPlanApplied(true)
    touch()
  }

  /**
   * Kick Off is the moment the dressing room happens (user: "the team talk
   * should come as you press kick off").
   *
   * It used to open on arrival, which put a modal between the manager and the
   * team sheet he came to look at. Now it is the last thing before the tunnel:
   * press Kick Off, say your piece, and go. The speech is passed straight
   * through rather than read back off state, because setState has not landed
   * by the time we need it.
   */
  /** How this one gets watched (F5). Remembered per competition, because the
   *  answer for a Premiership Saturday is rarely the answer for a pre-season
   *  friendly, and being asked afresh forty times a season is its own tax. */
  const view = game.viewPref?.[fx.compId] ?? 'full'
  const setView = (v: 'full' | 'highlights' | 'instant') => {
    game.viewPref = { ...(game.viewPref ?? {}), [fx.compId]: v }
    touch()
  }
  const goDownTheTunnel = (sp: SpeechId | null) => {
    if (warnings.length) { setConfirm(true); return }
    if (view === 'instant') instantResult(sp ?? undefined)
    else kickOff(sp ?? undefined, view)
  }
  const tryKickOff = () => {
    if (!talkDone && !speech) { setTalkOpen(true); return }
    goDownTheTunnel(speech)
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
          <div style={{ width: `${pct}%`, background: 'var(--club1)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.15)' }} />
          <div style={{ flex: 1, background: game.clubs[opp]?.colors[0] ?? '#c9a227', opacity: .85 }} />
        </div>
      </div>
    )
  }

  const renderSlot = (slot: number) => {
    const shirt = slot < 15 ? XV_SLOTS[slot].shirt : seats[slot - 15].shirt
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
          {p ? p.name : <span className="muted">- tap to pick -</span>}
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
          <SectionTitle sub={`shirt ${pickSlot < 15 ? XV_SLOTS[pickSlot].shirt : seats[pickSlot - 15].shirt}`}>
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
          <div style={{ padding: '0 18px 4px' }}>
            <h3 style={{ fontSize: 17, margin: '2px 0 8px', textAlign: 'center' }}>Are you ready for the game?</h3>
            {warnings.length === 0 && (
              <div className="meta" style={{ margin: '6px 0', textAlign: 'center' }}>Everything looks in order. The tunnel awaits.</div>
            )}
            {warnings.length > 0 && (
              <div style={{ maxHeight: '34vh', overflowY: 'auto', border: '1px solid var(--hairline)', borderRadius: 10, padding: '2px 10px' }}>
                {warnings.map((w, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 8, padding: '6px 0', fontSize: 12.5, lineHeight: 1.4,
                    color: w.level === 'bad' ? '#9b2c2c' : w.level === 'warn' ? '#8a6d1a' : 'var(--ink-soft)',
                    borderBottom: i < warnings.length - 1 ? '1px solid var(--hairline)' : 'none',
                  }}>
                    <span>{w.level === 'bad' ? '⛔' : w.level === 'warn' ? '⚠️' : 'ℹ️'}</span>
                    <span>{w.text}</span>
                  </div>
                ))}
              </div>
            )}
            {speech && (
              <div className="meta" style={{ marginTop: 8, textAlign: 'center' }}>
                Speech: <b>{SPEECHES.find(s => s.id === speech)?.name}</b>
              </div>
            )}
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn ghost" onClick={() => setConfirm(false)}>Not Yet</button>
              <button className="btn gold" style={{ flex: 1.5, fontSize: 15 }}
                onClick={() => {
                  setConfirm(false)
                  if (view === 'instant') instantResult(speech ?? undefined)
                  else kickOff(speech ?? undefined, view)
                }}>
                {view === 'instant' ? '⏩ Let Him Take It' : '▸ Take the Field'}
              </button>
            </div>
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
            <div className="date">{comp?.name ?? (fx.compId === 'fr' ? 'Club Friendly' : '')}{fx.stage ? ` · ${stageName(fx.stage)}` : ''} · {fixtureDate(game.season, fx.week, fx.id)}</div>
          </div>
          <button className="continue-btn" onClick={tryKickOff}>Kick Off ▸</button>
        </div>
      </header>
      <main className="content">
        {/* landscape splits this: badges left, the fixture's details right. As a
            centred stack it was 280px tall on a 390px screen, so the XV you came
            here to pick started below the fold. */}
        <div className="card center mday-head">
          <div className="mday-badges" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 4 }}>
            <CrestT g={game} teamId={fx.homeId} size={38} />
            {game.clubs[fx.homeId] && <Jersey club={game.clubs[fx.homeId]} size={54} />}
            <span style={{ fontFamily: 'var(--cond)', fontWeight: 700, fontSize: 15, color: 'var(--ink-faint)', letterSpacing: 2 }}>VS</span>
            {game.clubs[fx.awayId] && <Jersey club={game.clubs[fx.awayId]} size={54} />}
            <CrestT g={game} teamId={fx.awayId} size={38} />
          </div>
          <div className="mday-facts">
          <h3 style={{ fontSize: 19 }}>{teamShort(game, fx.homeId)} v {teamShort(game, fx.awayId)}</h3>
          <div className="meta">🏟️ {home?.stadium ?? 'Neutral venue'}{home ? `, ${home.city}` : ''}</div>
          <div className="meta" style={{ marginTop: 3 }}>
            {WEATHER_ICON[rollWeather(game.week, weekRng(game))]} Forecast: {rollWeather(game.week, weekRng(game))}
            {derbyName(fx.homeId, fx.awayId) && <span style={{ color: '#a12f2f', fontWeight: 700 }}> · {derbyName(fx.homeId, fx.awayId)} - expect a cauldron</span>}
          </div>
          </div>
        </div>

        <div className="tab-bar" style={{ marginTop: 4 }}>
          <button className={ptab === 'brief' ? 'active' : ''} onClick={() => setPtab('brief')}>Briefing</button>
          <button className={ptab === 'team' ? 'active' : ''} onClick={() => setPtab('team')}>Team</button>
          <button className={ptab === 'talk' ? 'active' : ''} onClick={() => setPtab('talk')}>Talk{speech ? ' ✓' : ''}</button>
        </div>

        {ptab === 'brief' && <>
        {(() => {
          const danger = oppLineup.slice(0, 15)
            .map(id => id != null ? game.players[id] : null)
            .filter(Boolean)
            .sort((a, b) => b!.ca - a!.ca)[0]
          const oppClub = game.clubs[opp]
          const meetings = game.fixtures.filter(f => f.played &&
            ((f.homeId === opp && f.awayId === game.userClubId) || (f.homeId === game.userClubId && f.awayId === opp)))
          const QUOTES = [
            'We know exactly how they want to play - and we\'re ready for it.',
            'No excuses from us this week. We\'ve targeted this one.',
            'They\'re a good side, but this is our patch.',
            'People keep writing us off. Suits us fine.',
            'We\'ve had a good week. You\'ll see a response on Saturday.',
          ]
          return (
            <>
              {game.matchPrep && (
                <div className="card" style={{ borderLeft: '4px solid var(--stripe)' }}>
                  <div className="fact-label">This Week's Preparation</div>
                  <div className="meta">
                    {{
                      attack: '⚡ Attacking Shapes - strike moves drilled all week. Attack sharpened.',
                      defence: '🛡 Defensive Drills - the wall is built. Defence sharpened.',
                      setpiece: '🏗 Set-Piece Work - scrum and lineout honed to a point.',
                      fitness: '🏃 Conditioning - the legs will last longer than theirs.',
                      recovery: '🧖 Recovery Week - fresh bodies, full tanks.',
                    }[game.matchPrep]}
                  </div>
                </div>
              )}
              {fx.stage === 'F' && (
                <div className="card" style={{ borderLeft: '4px solid var(--stripe)' }}>
                  <div className="fact-label">🏆 THE FINAL</div>
                  <div className="meta">
                    Eighty minutes from the {game.comps[fx.compId]?.name ?? 'trophy'}. Everything the
                    season has been builds to this - there is no next week, no second leg, no points
                    for a brave defeat. Win it.
                  </div>
                </div>
              )}
              {(() => {
                const dn = derbyName(fx.homeId, fx.awayId)
                if (!dn) return null
                const rec = game.derbyBook?.[opp]
                const played = rec ? rec.w + rec.d + rec.l : 0
                return (
                  <div className="card" style={{ borderLeft: '4px solid #a12f2f' }}>
                    <div className="fact-label">🔥 {dn}</div>
                    <div className="meta">
                      The form book goes in the bin, the cards come out, and the town keeps the score
                      longer than the league table does.
                      {played > 0
                        ? <> Your ledger against {oppClub?.short ?? 'them'}: <b>{rec!.w}W {rec!.d}D {rec!.l}L</b>.</>
                        : <> Your first one. Win it and they will sing your name; lose it and they will remember that too.</>}
                    </div>
                  </div>
                )
              })()}
              {(() => {
                const g = !derbyName(fx.homeId, fx.awayId) ? grudgeBetween(game, fx.homeId, fx.awayId) : null
                return g ? (
                  <div className="card" style={{ borderLeft: '4px solid #a12f2f' }}>
                    <div className="fact-label">Bad Blood</div>
                    <div className="meta">
                      There's history here - <b>{g.reason}</b>. Expect cards, a hostile
                      atmosphere and a contest the form book can't call.
                    </div>
                  </div>
                ) : null
              })()}
              {(() => {
                const theirs = oppLineup
                  .map(id => id != null ? game.players[id] : null)
                  .filter((p): p is Player => !!p && oldBoyApps(p, game.userClubId) > 0)
                  .sort((a, b) => oldBoyApps(b, game.userClubId) - oldBoyApps(a, game.userClubId))
                const ours = t.lineup
                  .map(id => id != null ? game.players[id] : null)
                  .filter((p): p is Player => !!p && oldBoyApps(p, opp) > 0)
                  .sort((a, b) => oldBoyApps(b, opp) - oldBoyApps(a, opp))
                if (!theirs.length && !ours.length) return null
                return (
                  <div className="card" style={{ borderLeft: '4px solid var(--stripe)' }}>
                    <div className="fact-label">Old Boys</div>
                    {theirs.slice(0, 3).map(p => (
                      <div key={p.id} className="meta">
                        <b>{p.name}</b> ({p.pos}) faces the club he left - {oldBoyApps(p, game.userClubId)} appearances
                        in your colours. Expect him to play like it is a final.
                      </div>
                    ))}
                    {ours.slice(0, 3).map(p => (
                      <div key={p.id} className="meta">
                        Your <b>{p.name}</b> ({p.pos}) returns to a former home -
                        {' '}{oldBoyApps(p, opp)} appearances for {oppClub?.short ?? 'them'}. He knows their calls.
                      </div>
                    ))}
                  </div>
                )
              })()}
              {(() => {
                const bowing = oppLineup
                  .map(id => id != null ? game.players[id] : null)
                  .filter((p): p is Player => !!p && !!p.retiring && (p.ca >= 72 || (p.caps ?? 0) >= 25))
                  .sort((a, b) => b.ca - a.ca)[0]
                if (!bowing) return null
                const home = fx.homeId === game.userClubId
                return (
                  <div className="card" style={{ borderLeft: '4px solid var(--stripe)' }}>
                    <div className="fact-label">The Farewell Tour</div>
                    <div className="meta">
                      <b>{bowing.name}</b> ({bowing.age}, {bowing.pos}) has announced this season is his last.
                      {home
                        ? ` This is the final time ${oppClub?.short ?? 'they'} bring him to your ground. Beat him, then applaud him off.`
                        : ` This is your last trip to face him on his own patch. Great players deserve a great send-off - just not the winning kind.`}
                    </div>
                  </div>
                )
              })()}
              {(() => {
                // milestone anticipation. Appearances use the full salute
                // ladder (exact, so it shows one match only); tries and
                // points would linger for weeks at 'one away', so only the
                // numbers worth waiting on make the card
                const APPS = [50, 100, 150, 200, 250]
                const TRIES = [50, 100]
                const PTS = [1000, 1500]
                const lines: { p: Player; text: string }[] = []
                for (const id of t.lineup.slice(0, 15)) {
                  const p = id != null ? game.players[id] : null
                  if (!p) continue
                  const cApps = p.career.reduce((s, c) => s + c.apps, 0) + p.stats.apps + (p.hist?.apps ?? 0)
                  const cTries = p.career.reduce((s, c) => s + c.tries, 0) + p.stats.tries + (p.hist?.tries ?? 0)
                  const cPts = p.career.reduce((s, c) => s + c.points, 0) + p.stats.points + (p.hist?.points ?? 0)
                  if (APPS.includes(cApps + 1)) {
                    lines.push({ p, text: `makes career appearance number ${cApps + 1} if he takes the field` })
                  } else if (TRIES.some(m => m - cTries === 1) && p.form >= 6.5) {
                    lines.push({ p, text: `is one try away from ${cTries + 1} in his career, and he is in the form to get it` })
                  } else {
                    const target = PTS.find(m => m > cPts && m - cPts <= 9)
                    if (target) lines.push({ p, text: `needs ${target - cPts} points to reach ${target.toLocaleString()} in his career` })
                  }
                }
                if (!lines.length) return null
                return (
                  <div className="card" style={{ borderLeft: '4px solid var(--stripe)' }}>
                    <div className="fact-label">On The Brink</div>
                    {lines.slice(0, 3).map(({ p, text }) => (
                      <div key={p.id} className="meta">
                        <b>{p.name}</b> ({p.pos}) {text}. The ground will know the moment it happens.
                      </div>
                    ))}
                  </div>
                )
              })()}
              {danger && (
                <div className="card" style={{ borderLeft: '4px solid #a12f2f' }}>
                  <div className="fact-label">Danger Man</div>
                  <div className="meta">
                    <b>{danger.name}</b> ({danger.pos}) is the one to shackle - {oppClub?.short ?? 'they'} play
                    through him. Keep him quiet and you're halfway there.
                  </div>
                </div>
              )}
              {(() => {
                // His actual opinions, not a bucket label. This used to read
                // "a stickler" or "firm but fair", which told you nothing you
                // could pick a back row around.
                const ref = refFor(fx.id)
                const notes = refNotes(ref)
                return (
                  <div className="card">
                    <div className="fact-label">The Whistle</div>
                    <div className="meta" style={{ marginBottom: notes.length ? 4 : 0 }}>
                      <b>{ref.name}</b> has the appointment.
                    </div>
                    {notes.map((n, i) => <div key={i} className="meta">· {n}</div>)}
                    {notes.length === 0 && <div className="meta">Nothing marked in his book: he lets the players decide it.</div>}
                  </div>
                )
              })()}
              {(() => {
                // The bench plan, in words, before you go out (F4). The split is
                // set on the Tactics bench page; this is where you find out what
                // you actually named without counting shirts.
                const def = SPLIT_BY_ID[splitFor(club)]
                const briefed = seats
                  .map((_, i) => ({ i, b: briefForSeat(club, i), id: t.lineup[15 + i] }))
                  .filter(x => x.b !== 'orders' && x.id != null)
                return (
                  <div className="card">
                    <div className="fact-label">The Finishers</div>
                    <div className="meta" style={{ marginBottom: briefed.length ? 4 : 0 }}>
                      <b>{def.name}.</b> {def.desc}
                    </div>
                    {briefed.map(x => (
                      <div key={x.i} className="meta">
                        · {game.players[x.id!]?.name}: {BRIEF_BY_ID[x.b].name.toLowerCase()}
                      </div>
                    ))}
                    {briefed.length === 0 && (
                      <div className="meta">Every replacement is simply covering a shirt. No special instructions.</div>
                    )}
                  </div>
                )
              })()}
              {/* F27: the trip itself. Only when WE are the ones travelling - the
                  home side has no journey to be briefed about - and only when
                  there is something worth saying, which noteFor decides. */}
              {!isHome && (() => {
                const v = venueEffect(game, fx.homeId, fx.awayId, fx.week)
                if (!v.note) return null
                return (
                  <div className="card">
                    <div className="fact-label">The Trip</div>
                    <div className="meta">{v.note}</div>
                    <div className="meta muted">
                      {v.km.toLocaleString()}km
                      {v.tz >= 1 ? ` · ${v.tz}h clock change` : ''}
                      {v.altGap >= 250 ? ` · ${Math.round(v.alt).toLocaleString()}m above sea level` : ''}
                    </div>
                  </div>
                )
              })()}
              {oppClub?.coach && (
                <div className="card">
                  <div className="fact-label">The Opposite Number</div>
                  <div className="meta">
                    <b>{oppClub.coach}</b> ({oppClub.short} head coach): “{QUOTES[(fx.id + game.week) % QUOTES.length]}”
                  </div>
                  {/* F23: what he actually asks of them. How a side plays is
                      public knowledge - you can watch them - so the philosophy
                      and the dials are always here. Where it leaves them open is
                      analysis, and analysis needs a briefing suite. */}
                  {(() => {
                    const ph = philosophyOf(oppClub)
                    if (!ph) return null
                    const suite = game.clubs[game.userClubId]?.facilities?.briefing ?? 0
                    return (
                      <>
                        <div className="meta" style={{ marginTop: 4 }}>
                          <b>{ph.name}.</b> {ph.blurb}
                        </div>
                        <div className="meta muted">{dialLine(oppClub.tactic)}</div>
                        {suite >= 1 && (
                          <div className="meta" style={{ marginTop: 4 }}>
                            <b>The angle:</b> {ph.soft}
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>
              )}
              {(() => {
                const rec = game.vsBook?.[opp]
                const total = rec ? rec.w + rec.d + rec.l : 0
                if (!meetings.length && !total) return null
                return (
                  <div className="card">
                    <div className="fact-label">The Book On Them</div>
                    {total > 0 && (
                      <div className="meta">
                        Under you: <b>{rec!.w}W {rec!.d}D {rec!.l}L</b> against {oppClub?.short ?? 'them'}.
                        {rec!.w === 0 && rec!.l >= 3 && <> <b style={{ color: '#9b2c2c' }}>Your bogey side</b> - you have never beaten them, and the players know it. End it today.</>}
                        {rec!.l === 0 && rec!.w >= 5 && <> <b style={{ color: '#2f7d4f' }}>Happy hunting ground</b> - they have never beaten you. Keep it that way.</>}
                        {(rec!.run ?? 0) >= 3 && !(rec!.l === 0 && rec!.w >= 5) && <> <b style={{ color: '#2f7d4f' }}>{rec!.run} straight wins</b> over them - the streak is yours to protect.</>}
                        {(rec!.run ?? 0) <= -3 && !(rec!.w === 0 && rec!.l >= 3) && <> <b style={{ color: '#9b2c2c' }}>{-(rec!.run ?? 0)} straight defeats</b> to this lot - somebody has to break the hoodoo.</>}
                      </div>
                    )}
                    {meetings.map(m => (
                      <div key={m.id} className="meta">
                        {teamShort(game, m.homeId)} {m.homeScore} – {m.awayScore} {teamShort(game, m.awayId)}
                        {' '}<span className="muted">({game.comps[m.compId]?.short})</span>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </>
          )
        })()}
        <SectionTitle sub="your colours on the left">Head to Head</SectionTitle>
        {bar('Scrum', myUnits.scrum, oppUnits.scrum)}
        {bar('Lineout', myUnits.lineout, oppUnits.lineout)}
        {bar('Breakdown', myUnits.breakdown, oppUnits.breakdown)}
        {bar('Attack', myUnits.attack, oppUnits.attack)}
        {bar('Defence', myUnits.defence, oppUnits.defence)}

        {gamePlan.length > 0 && (
          <div className="card" style={{ borderLeft: '4px solid var(--stripe)', marginTop: 8 }}>
            <div className="fact-label">Assistant's Game Plan</div>
            {gamePlan.map((p, i) => (
              <div key={i} className="meta" style={{ padding: '2px 0' }}>• {p.text}</div>
            ))}
            <button className="btn ghost block" style={{ marginTop: 8 }} disabled={planApplied} onClick={applyPlan}>
              {planApplied ? '✓ Plan applied - tactics adjusted' : '📋 Apply the plan - adjust my tactics'}
            </button>
          </div>
        )}

        {(() => {
          const label: Record<number, string> = { 0: 'Front row', 3: 'Locks', 8: 'Halfbacks', 11: 'Centres' }
          const rows = CHEM_SLOTS.filter(([i]) => label[i]).map(([i, j]) => {
            const a = t.lineup[i] != null ? game.players[t.lineup[i]!] : null
            const b = t.lineup[j] != null ? game.players[t.lineup[j]!] : null
            if (!a || !b) return null
            const g = game.chem?.[chemKey(a.id, b.id)] ?? 0
            return { key: label[i], a, b, g, tier: chemTier(g) }
          }).filter(Boolean) as { key: string; a: Player; b: Player; g: number; tier: string }[]
          if (!rows.length) return null
          const surname = (n: string) => n.split(' ').slice(-1)[0]
          return (
            <>
              <SectionTitle sub="combinations click with games together">Partnerships</SectionTitle>
              <div className="card" style={{ paddingTop: 6, paddingBottom: 6 }}>
                {rows.map(r => (
                  <div key={r.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--hairline)', fontSize: 12.5 }}>
                    <span><span style={{ color: 'var(--ink-faint)', fontFamily: 'var(--cond)', textTransform: 'uppercase', letterSpacing: .5, fontSize: 11 }}>{r.key}</span> · {surname(r.a.name)} & {surname(r.b.name)}</span>
                    <span style={{ color: r.g >= 25 ? '#2f7d4f' : r.g < 5 ? '#9b2c2c' : 'var(--ink-soft)', fontWeight: 600 }}>
                      {r.g} together · {r.tier}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )
        })()}
        </>}

        {ptab === 'team' && <>
        {rotWindow && rotFlagged.length >= 2 && (
          <div className="card" style={{ borderLeft: '4px solid var(--stripe)' }}>
            <div className="fact-label">Assistant's Rotation Plan</div>
            <div className="meta">
              {comp?.type !== 'league'
                ? 'A cup tie is the week to trust the squad. '
                : `A ${gapDays}-day turnaround is no week for heavy legs. `}
              {rotFlagged.map(p => `${p.name} (${rotReason(p)})`).join(', ')} - {rotFlagged.length === 2 ? 'both' : `all ${rotFlagged.length}`} flagged
              by the medical staff. Say the word and I'll name a fresh XV around them.
            </div>
            <button className="btn ghost block" style={{ marginTop: 8 }} onClick={rotateXV}>
              🔄 Rotate the XV - rest the flagged {rotFlagged.length === 1 ? 'man' : 'men'}
            </button>
          </div>
        )}
        <SectionTitle sub={sel != null ? `moving ${game.players[t.lineup[sel] ?? -1]?.name ?? 'empty slot'} - tap his new position` : 'tap a player, tap another to swap · tap twice for the squad list'}>Your XV</SectionTitle>
        {/* forwards left, backs right, exactly as the Tactics team sheet does it.
            The same information was laid out two different ways one screen apart. */}
        <div className="xv-split">
          <table className="dtable"><tbody>{XV_SLOTS.slice(0, 8).map((_, i) => renderSlot(i))}</tbody></table>
          <table className="dtable"><tbody>{XV_SLOTS.slice(8).map((_, i) => renderSlot(8 + i))}</tbody></table>
        </div>
        <SectionTitle sub={SPLIT_BY_ID[splitFor(club)]?.name.toLowerCase()}>Replacements</SectionTitle>
        <div className="xv-split">
          <table className="dtable"><tbody>{seats.slice(0, 4).map((_, i) => renderSlot(15 + i))}</tbody></table>
          <table className="dtable"><tbody>{seats.slice(4).map((_, i) => renderSlot(19 + i))}</tbody></table>
        </div>
        </>}

        {ptab === 'talk' && <>
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
        </>}

        <div className="btn-row" style={{ marginTop: 10 }}>
          <button className="btn gold block" style={{ fontSize: 16, width: '100%' }} onClick={tryKickOff}>
            {view === 'instant' ? 'Instant Result ▸' : view === 'highlights' ? 'Kick Off (Highlights) ▸' : 'Kick Off ▸'}
          </button>
        </div>
        <div className="spacer" />
      </main>
      {picker()}
      {readyModal()}
      {talkOpen && (
        <div className="modal-veil" onClick={() => setTalkOpen(false)}>
          <div className="modal talk-modal" onClick={e => e.stopPropagation()}>
            <div className="grab" />
            <div style={{ padding: '0 12px 10px' }}>
              <SectionTitle sub={`${teamShort(game, club.id)} v ${teamShort(game, opp)} · one speech, choose the tone`}>
                The Dressing Room
              </SectionTitle>
              {/* How you watch it (F5) lives here rather than at the foot of the
                  page. Measured: below the team sheet it sat 320px under the fold
                  on a 844x390 phone, which is exactly where Instant Result was
                  buried and nobody found it. This modal is the last thing before
                  the tunnel and has nothing above it. */}
              <ViewPicker view={view} onPick={setView} />
              <div className="speech-grid" style={{ marginTop: 6 }}>
                {SPEECHES.map(sp => (
                  <button key={sp.id} className={`speech-tile${speech === sp.id ? ' sel' : ''}`}
                    onClick={() => {
                      setSpeech(sp.id); setTalkDone(true); setTalkOpen(false)
                      goDownTheTunnel(sp.id)
                    }}>
                    <span className="ico">{sp.icon}</span>
                    <b>{sp.name}</b>
                    <span className="d">{sp.desc}</span>
                  </button>
                ))}
              </div>
              <button className="btn ghost block" style={{ marginTop: 8 }}
                onClick={() => { setTalkDone(true); setTalkOpen(false); goDownTheTunnel(null) }}>
                Say nothing - straight out
              </button>
            </div>
          </div>
        </div>
      )}
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

  // a Test week gets the same choice as a club week (F5)
  const view = game.viewPref?.[fx.compId] ?? 'full'
  const setView = (v: 'full' | 'highlights' | 'instant') => {
    game.viewPref = { ...(game.viewPref ?? {}), [fx.compId]: v }
    touch()
  }

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
          <div style={{ width: `${pct}%`, background: 'var(--brand-700)' }} />
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
            <h1>Test Match - {nat}</h1>
            <div className="date">{comp?.name ?? (fx.compId === 'fr' ? 'Club Friendly' : '')}{fx.stage ? ` · ${stageName(fx.stage)}` : ''} · {fixtureDate(game.season, fx.week, fx.id)}</div>
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
          <div className="meta">🌍 International rugby - the whole country is watching, coach.</div>
        </div>
        <SectionTitle sub="your nation on the left">Head to Head</SectionTitle>
        {bar('Scrum', myUnits.scrum, oppUnits.scrum)}
        {bar('Lineout', myUnits.lineout, oppUnits.lineout)}
        {bar('Breakdown', myUnits.breakdown, oppUnits.breakdown)}
        {bar('Attack', myUnits.attack, oppUnits.attack)}
        {bar('Defence', myUnits.defence, oppUnits.defence)}

        <SectionTitle sub={sel != null ? `moving ${game.players[myLineup[sel] ?? -1]?.name ?? 'empty slot'} - tap his new position` : 'tap a player, tap another to swap · tap twice for the full squad'}>Your Test XV</SectionTitle>
        <div className="tblwrap"><table className="dtable"><tbody>
          {XV_SLOTS.map((s, i) => {
            const pid = myLineup[i]
            const p = pid != null ? game.players[pid] : null
            return (
              <tr key={i} onClick={() => tapSlot(i)} className={sel === i ? 'held-row' : undefined}>
                <td className="num" style={{ fontFamily: 'monospace', fontWeight: 700 }}>{s.shirt}</td>
                <td><PosBadge pos={s.pos} /></td>
                <td className="name">{p?.name ?? <span className="muted">- tap to pick -</span>}</td>
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
                <td className="name">{p?.name ?? <span className="muted">- tap to pick -</span>}</td>
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
        <div className="spacer" />
      </main>
      {confirm && (
        <div className="modal-veil" onClick={() => setConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="grab" />
            <h3 style={{ fontSize: 17, margin: '4px 0 8px' }}>Ready to lead {nat} out?</h3>
            <div className="meta">Anthems done, jerseys presented. Substitutions and the team talk are yours from the touchline.</div>
            {/* the viewing choice sits here, not at the foot of a team sheet (F5) */}
            <ViewPicker view={view} onPick={setView} />
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn ghost" onClick={() => setConfirm(false)}>Not Yet</button>
              <button className="btn gold" style={{ flex: 1.5, fontSize: 15 }}
                onClick={() => {
                  setConfirm(false)
                  if (view === 'instant') instantResult(speech ?? undefined)
                  else kickOff(speech ?? undefined, view)
                }}>
                {view === 'instant' ? '⏩ Let Him Take It' : '▸ Take the Field'}
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

// Speeds live behind the ⚙ button now. They used to be three buttons on the
// control row, and the slowest of them was labelled '▶' - the same glyph the
// play/pause button shows when the match is paused, so the row genuinely had
// two play buttons on it. Words instead of glyphs, inside a settings sheet:
// speed is something you set once, not something you reach for every minute.
const SPEEDS = [
  { label: 'Slow', ms: 900, name: 'Slow - a minute at a time' },
  { label: 'Normal', ms: 350, name: 'Normal - the default' },
  { label: 'Fast', ms: 90, name: 'Fast - straight to the incidents' },
]

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

  // cards respect the replay clock: a binned man vanishes for his ten
  // minutes, a sent-off man from the moment of the red - derived from the
  // event timeline, not the final-state sets
  const sentOffEvts = ctx.events.filter(e => e.type === 'RC' && e.playerId != null)
  const sentOffIds = new Set(sentOffEvts.map(e => e.playerId!))
  const binEvts = ctx.events.filter(e => e.type === 'YC' && e.playerId != null)
  const cardedNow = (id: number) =>
    sentOffEvts.some(e => e.playerId === id && e.min <= min) ||
    binEvts.some(e => e.playerId === id && min >= e.min && min < e.min + 10)

  // Where the ball is across the field, not just up it. It follows the man in the
  // commentary when there is one, so the ball is with the carrier instead of
  // drifting on a sawtooth of its own.
  const carrierSlotOf = (s: SideCtx) => (last?.playerId != null ? s.lineup.slice(0, 15).indexOf(last.playerId) : -1)
  const carrierSlot = Math.max(carrierSlotOf(ctx.home), carrierSlotOf(ctx.away))
  const ballTop = carrierSlot >= 0
    ? 8 + SPOTS[carrierSlot][1] * 0.84
    : 38 + ((min * 13) % 25)

  const dots = (side: SideCtx, isHome: boolean) => {
    const cols = isHome ? homeC : awayC
    const capId = game!.clubs[side.teamId]?.captain
    const attacking = !!last && last.teamId === side.teamId

    // Both sides live around the BALL, not around their own tryline.
    //
    // They used to be pinned to their own half: home spanned 10-40% of the pitch
    // and away 60-90%, with a twenty-percent dead band down the middle that
    // neither could enter. Fifteen men in green at one end and fifteen in yellow
    // at the other never met, so the pitch read as two teams lined up for the
    // anthems rather than a game - the packs were never in contact and the
    // defence never faced the attack.
    //
    // SPOTS gives each shirt its distance from its own line (sx) and its position
    // across the field (sy). Read sx as DEPTH BEHIND THE BALL instead and the
    // whole thing falls out correctly: front rows meet over the ball, back rows
    // sit deeper, and each side stays on its own side of it. Home defends the
    // left, so its shape runs leftwards from the ball; away mirrors it.
    const dir = isHome ? -1 : 1
    // A defending line is flatter than an attacking shape and sits off the ball,
    // roughly where the offside line would be.
    const depthScale = attacking ? 0.34 : 0.26
    const standOff = attacking ? 1.5 : 5.5
    const anchor = ballLeft + dir * standOff
    const baseX = (slot: number) => anchor + dir * (SPOTS[slot][0] - 14) * depthScale

    // the two nearest forwards of each side work the breakdown
    const fwdSlots = [0, 1, 2, 3, 4, 5, 6, 7]
    const ruckers = [...fwdSlots]
      .sort((a, b) => Math.abs(baseX(a) - ballLeft) - Math.abs(baseX(b) - ballLeft))
      .slice(0, 2)
    return side.lineup.slice(0, 15).map((id, slot) => {
      if (id == null) return null
      if (cardedNow(id)) return null
      // sent-off men are out of the final onPitch set but must still render
      // before their card; everyone else absent from onPitch was subbed off
      if (!side.onPitch.has(id) && !sentOffIds.has(id)) return null
      const p = game!.players[id]
      if (!p) return null
      const [, sy] = SPOTS[slot]
      // every man moves: work-rate wander re-seeded each match minute
      const wx = ((min * 13 + slot * 29 + (isHome ? 0 : 7)) % 9) - 4
      const wy = ((min * 11 + slot * 17 + (isHome ? 3 : 0)) % 7) - 3
      const ruck = ruckers.includes(slot)
      let x = baseX(slot) + wx * 0.35
      let y = 8 + sy * 0.84 + wy * 0.9
      if (ruck) {
        // converge on the ball - bodies over the tackle area
        x = x * 0.45 + (ballLeft + dir * 1.5) * 0.55
        y = y * 0.5 + ballTop * 0.5
      } else if (attacking && slot >= 8) {
        // backs fan out wider and deeper, looking for space
        y = y + (y > 50 ? 3 : -3)
        x -= dir * 1.2
      }
      const isCarrier = last?.playerId === id
      // The man the commentary is talking about has the ball, so he stands where
      // the ball is. He used to hold his formation spot while the ball sat ten
      // metres away, which made the one dot you were actually reading the least
      // convincing thing on the pitch.
      if (isCarrier && !ruck) {
        x = x * 0.35 + ballLeft * 0.65
        y = y * 0.35 + ballTop * 0.65
      }
      // the shape follows the ball, so near either tryline it has to be held on
      // the field rather than running off the end of it
      x = Math.max(3.5, Math.min(96.5, x))
      y = Math.max(5, Math.min(95, y))
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
  const { advanceLive, matchCursor, finishMatch, skipToBreak, matchMode } = useStore.getState()
  const [speedIdx, setSpeedIdx] = useState(0)
  const [sound, setSound] = useState(soundOn())
  const [drawer, setDrawer] = useState(false)
  const [settings, setSettings] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [showRatings, setShowRatings] = useState(false)
  const [injury, setInjury] = useState<{ hurt: string; desc: string; weeks: number; coverId: number | null } | null>(null)
  /** the match-day squad, opened from the Squad button in the control row */
  const [sheet, setSheet] = useState(false)
  const tickerRef = useRef<HTMLDivElement>(null)

  const { events, cursor, playing, fixture, ctx } = live
  const shown = events.slice(0, cursor)
  const last = shown[shown.length - 1]
  const caughtUp = cursor >= events.length
  const atHalfTime = caughtUp && ctx.awaiting === 'HT'
  const atBreak = caughtUp && ctx.awaiting === 'BRK'
  const atDecision = caughtUp && !!ctx.decision && ctx.seg < 3
  const done = caughtUp && ctx.seg === 3

  // coming back from another app can strand the heartbeat - kick it awake
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

  // A serious injury stops the clock and opens the match-day squad (feedback
  // 9-3). The engine had to fill the hole the instant he went down - the same
  // code covers fourteen AI sides and Instant Result - so the assistant's pick
  // is already on. This hands the decision back: swap the cover for free, and
  // reshape the rest of the side while the physios are on.
  //
  // Only for a lay-off of three weeks or more. A one-week knock happens most
  // matches and stopping the game for it would be nagging, not managing.
  const injSeen = useRef<number>(-1)
  useEffect(() => {
    if (cursor <= 0 || cursor <= injSeen.current) return
    const e = events[cursor - 1]
    if (!e || e.type !== 'INJ' || e.teamId !== ctx.userSideId || e.playerId == null) return
    const hurt = game.players[e.playerId]
    const weeks = hurt?.injury?.weeks ?? 0
    // ANY injury stops the game, not only a three-week one. It used to wave a
    // one-week knock through on the reasoning that stopping for it would be
    // nagging; but a man who cannot continue is a man off the pitch, and who
    // replaces him is the manager's call every single time.
    if (!hurt?.injury) return
    // whoever the assistant sent on: the SUB the engine pushed alongside it
    const coverEv = events.slice(cursor - 1, cursor + 3).find(x => x.type === 'SUB' && x.teamId === e.teamId && x.playerId != null)
    injSeen.current = cursor
    matchCursor(cursor, false)
    setDrawer(false)
    setSettings(false)
    setInjury({ hurt: hurt.name, desc: hurt.injury.desc, weeks, coverId: coverEv?.playerId ?? null })
  }, [cursor])

  useEffect(() => {
    // a panel (half-time talk, break, full-time) must open at its TOP -
    // scrolling to the bottom buried the team talk (8C feedback)
    if (atHalfTime || atBreak || done) tickerRef.current?.scrollTo({ top: 0 })
    else tickerRef.current?.scrollTo({ top: tickerRef.current.scrollHeight, behavior: 'smooth' })
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
  // Half-time and the 60' break are the two states where the match is stopped
  // waiting for the manager rather than paused. The control row treats them as
  // one thing: Play means "get back out there".
  const atInterval = atHalfTime || atBreak
  const intervalLabel = atHalfTime ? 'Second Half' : 'Final Quarter'
  /** Restart play, optionally fast-forwarding the period we are restarting. */
  const leaveInterval = (thenSkip = false) => {
    setDrawer(false)
    setSettings(false)
    useStore.getState().startSecondHalf()
    if (thenSkip) skipToBreak()
  }
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
          {/* say so, or a ticker that skips the quiet minutes looks broken (F5) */}
          {live.mode === 'highlights' && !done ? ' · 🎬 HIGHLIGHTS' : ''}
        </div>
        {!done && (() => {
          const win = (ctx.momoHist ?? []).slice(-3)
          // no history yet means no measurement: a half-filled bar at 0' reads
          // as "possession is even" when nothing has happened at all
          const live = win.length > 0
          const share = live ? win.reduce((s, x) => s + x, 0) / win.length : 0.5
          const ref = refFor(fixture.id)
          const binAt = ref.style === 'strict' ? 4 : ref.style === 'lenient' ? 7 : 5
          const penC = (n: number) => n >= binAt ? '#e05a4d' : n === binAt - 1 ? '#e0b34d' : undefined
          return (
            <div className="last10">
              <span className="l10-pens" title="Penalties conceded (referee bins repeat offenders)">
                ⚠ <b style={{ color: penC(ctx.home.consPens) }}>{ctx.home.consPens}</b>
              </span>
              {/* the flanking numbers are penalties conceded, and a phone cannot
                  hover a tooltip to find that out - so the label says it */}
              <span className="l10-label">{live ? "PENALTIES · POSSESSION LAST 10'" : 'PENALTIES · AWAITING KICK-OFF'}</span>
              <div className="l10-bar" title="Who has the ball" style={live ? undefined : { opacity: .35 }}>
                <div className="l10-home" style={{ width: `${Math.round(share * 100)}%`, background: homeC[0] }} />
                <div className="l10-away" style={{ background: awayC[0] }} />
                <div className="momo-needle" style={{ left: `${50 + ctx.momo * 44}%` }} />
              </div>
              <span className="l10-pens" title="Penalties conceded (referee bins repeat offenders)">
                <b style={{ color: penC(ctx.away.consPens) }}>{ctx.away.consPens}</b> ⚠
              </span>
            </div>
          )
        })()}
      </div>

      {done && ctx.userSideId && (() => {
        const isHome = ctx.userSideId === fixture.homeId
        const us = isHome ? hs : as
        const them = isHome ? as : hs
        const kind = us > them ? 'w' : us < them ? 'l' : 'd'
        return (
          <div className={`ft-stamp ${kind}`} key={`stamp-${fixture.id}`}>
            <b>{us > them ? 'VICTORY' : us < them ? 'DEFEAT' : 'DRAW'}</b>
            <span>{hs} - {as}</span>
          </div>
        )
      })()}

      {!panelActive && (
        <PitchViz ctx={ctx} game={game} last={last} ballLeft={ballLeft}
          fxKey={cursor} showFx={showFx} showBig={playing} lastTeamC={lastTeamC} />
      )}

      {/* One row, four jobs: play, skip, touchline, settings. Speed and sound
          moved into the settings sheet - they are set once a season, and having
          them out here is what put two ▶ buttons side by side. */}
      <div className="speed-controls">
        {/* the whistle has gone: playback controls make no sense at FT */}
        {/* At an interval, Play restarts the match (user: "the play buttons
            should trigger the start second half. you shouldn't have to scroll").
            It used to do nothing at all: advanceLive returns early while
            ctx.awaiting is set, so pressing Play set playing true and the very
            next tick set it straight back to false. The only way out of the
            interval was the resume button at the foot of the half-time panel,
            below the team talk and the squad button - so on a 390px screen you
            had to scroll to find it. Skip was dead for the same reason: its loop
            is `while (!ctx.awaiting ...)`, which never ran. */}
        {!done && (
          <button className={`btn ${playing ? 'ghost' : 'gold'}`} style={{ flex: 1.6 }}
            disabled={atDecision}
            title={atInterval ? intervalLabel : atDecision ? 'The touchline call is yours first' : playing ? 'Pause' : 'Resume'}
            aria-label={atInterval ? intervalLabel : playing ? 'Pause' : 'Resume'}
            onClick={() => {
              if (atInterval) { leaveInterval(); return }
              matchCursor(cursor, !playing)
            }}>
            {playing ? '❚❚' : '▶'} <span className="ctrl-cap">{atInterval ? intervalLabel : playing ? 'Pause' : 'Play'}</span>
          </button>
        )}
        {!done && (
          <button className="btn" style={{ flex: 1.2 }} disabled={atDecision}
            onClick={() => {
              setDrawer(false)
              setSettings(false)
              // out of the interval first, or there is nothing to skip through
              if (atInterval) leaveInterval(true)
              else skipToBreak()
            }}>Skip ▸</button>
        )}
        {/* Squad, not "Touchline" (user: "rather than touchline ... have it as
            squad selection so you click it and can make changes"). The panel it
            used to open was a tactics drawer with a substitution list buried in
            it; this goes straight to the match-day squad, which is what anyone
            pressing it wants. Tactics still live behind the same panel via the
            drawer button on the squad sheet. */}
        {!done && ctx.seg < 3 && (
          <button className={`btn ${sheet ? 'gold' : 'ghost'}`} style={{ flex: 1.2 }}
            title="Match-day squad: make a substitution"
            aria-label="Match-day squad: make a substitution"
            onClick={() => {
              matchCursor(cursor, false)
              setSettings(false)
              setDrawer(false)
              setSheet(true)
            }}>👥 <span className="ctrl-cap">Squad</span></button>
        )}
        <button className={`btn ${settings ? 'gold' : 'ghost'}`} style={{ flex: '0 0 46px' }}
          title="Match settings: speed and sound" aria-label="Match settings: speed and sound"
          onClick={() => { setDrawer(false); setSettings(!settings) }}>⚙</button>
      </div>

      {sheet && !injury && (
        <SquadSheet
          onClose={() => { setSheet(false); matchCursor(cursor, true) }}
          onTactics={() => { setSheet(false); setDrawer(true) }}
        />
      )}
      {injury && (
        <SquadSheet
          title={`🏥 ${injury.hurt} is off`}
          hurtName={injury.hurt}
          hurtDesc={`${injury.desc}, out for ${injury.weeks} week${injury.weeks === 1 ? '' : 's'}`}
          note="Name his replacement before play restarts."
          freeCoverId={injury.coverId ?? undefined}
          /* forced: the physio is on, the clock is stopped, and the only way back
             to the match is through naming somebody */
          mustDecide
          onClose={() => { setInjury(null); matchCursor(cursor, true) }}
        />
      )}

      {settings && (
        <div className="modal-veil" onClick={() => setSettings(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="grab" />
            <h3 style={{ fontSize: 16, margin: '2px 0 8px' }}>Match Settings</h3>
            <div className="set-label">Commentary speed</div>
            <div className="btn-row">
              {SPEEDS.map((s, i) => (
                <button key={i} className={`btn ${i === speedIdx ? 'gold' : 'ghost'}`} style={{ flex: 1 }}
                  title={s.name} onClick={() => setSpeedIdx(i)}>{s.label}</button>
              ))}
            </div>
            <div className="set-label">What the ticker stops for</div>
            <div className="btn-row">
              <button className={`btn ${live.mode === 'full' ? 'gold' : 'ghost'}`} style={{ flex: 1 }}
                onClick={() => matchMode('full')}>📺 Every minute</button>
              <button className={`btn ${live.mode === 'highlights' ? 'gold' : 'ghost'}`} style={{ flex: 1 }}
                onClick={() => matchMode('highlights')}>🎬 Highlights</button>
            </div>
            <div className="set-label">Sound</div>
            <button className="btn ghost block" onClick={() => setSound(toggleSound())}>
              {sound ? '🔊 Crowd and whistle on' : '🔇 Silent'}
            </button>
            <button className="btn gold block" style={{ marginTop: 10 }}
              onClick={() => { setSettings(false); if (!done) matchCursor(cursor, true) }}>
              {done ? 'Close' : '▸ Back to the Match'}
            </button>
          </div>
        </div>
      )}

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
          <TouchlinePanel title="⏸ Play is paused - change the picture" showTalk={false} onResume={() => { setDrawer(false); matchCursor(cursor, true) }} resumeLabel="▸ Resume Play" />
        )}
        {(atHalfTime || atBreak) && (
          <TouchlinePanel
            title={atBreak ? "60' - a break in play, final quarter ahead" : 'Half-Time - the dressing room waits'}
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

/** A kickable penalty: posts, corner, or tap - your call, gaffer. */
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
      desc: `${kicker ? kicker.name : 'Your kicker'} lines it up. Safe three${diff < 0 && diff >= -3 ? ' - levels or leads' : ''}.`,
    },
    {
      id: 'corner' as const, icon: '🚀', name: 'Kick to the Corner',
      desc: 'Lineout five metres out. Maul for the try - glory or nothing.',
    },
    {
      id: 'tap' as const, icon: '⚡', name: 'Tap & Go',
      desc: 'Catch them flat-footed. Keeps the tempo scorching.',
    },
  ]

  return (
    <div className="card" style={{ margin: '12px 0', borderLeft: '4px solid #a12f2f' }}>
      <h3 style={{ fontSize: 15 }}>⏱ Penalty - your call from the touchline</h3>
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
    ? (myPoss < 45 ? 'We won without the ball - the defensive shift was enormous. Take that anywhere.'
      : margin >= 20 ? 'Ruthless. The assistant wants the same standards next week, not a lap of honour.'
      : 'Winning tight ones is a habit - and we just fed the habit.')
    : margin === 0
      ? 'A draw that will feel like a loss or a win by Tuesday, depending on the video.'
      : (myPoss >= 55 ? 'All that ball and nothing to show for it - the assistant circles our finishing in red.'
        : margin <= -20 ? 'Beaten in every collision. The review will be honest, and it will sting.'
        : 'Fine margins. Fix the two below and that is our game.')
  // The verdict used to stop at the sentence above, which names nothing (user:
  // "it should outline what the two fixes would be etc so the player can keep
  // tweaking the tactics"). game/coachfix reads the same match data and turns it
  // into two instructions that each point at a real control.
  const myClub = game.clubs[mine.teamId]
  const fixes = coachFixes(game, ctx, mine, opp, myClub?.tactic ?? null, 2)
  const units = unitBattles(ctx, mine, opp)
  return (
    <div className="card" style={{ borderLeft: '4px solid var(--stripe)' }}>
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

      {fixes.length > 0 && (
        <>
          <div className="fact-label" style={{ marginTop: 8 }}>
            {fixes.length === 1 ? 'The Fix' : 'The Two Fixes'} <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>- before next Saturday</span>
          </div>
          {fixes.map((f, i) => (
            <div key={i} className="fix-row">
              <span className="fix-no">{i + 1}</span>
              <span>
                <b style={{ display: 'block', fontSize: 12.5 }}>{f.head}</b>
                <span className="muted" style={{ fontSize: 11.5 }}>{f.how}</span>
              </span>
            </div>
          ))}
        </>
      )}

      <div className="fact-label" style={{ marginTop: 8 }}>The Unit Battles</div>
      {units.map(({ label, pct, verdict }) => {
        const color = pct >= 52 ? '#2f7d4f' : pct <= 48 ? '#9b2c2c' : undefined
        return (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: '1px solid var(--hairline)', fontSize: 12.5 }}>
            <span style={{ color: 'var(--ink-soft)' }}>{label}</span>
            <span><b style={{ color, fontFamily: 'var(--cond)', fontSize: 14 }}>{pct}%</b>
              <span className="muted"> won · {pct > 48 && pct < 52 ? verdict : pct >= 52 ? `we ${verdict}` : `they ${verdict === 'shaded' ? 'shaded it' : 'bullied us'}`}</span>
            </span>
          </div>
        )
      })}
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
    <div className="card" style={{ margin: '12px 0', borderLeft: '4px solid var(--stripe)' }}>
      <h3 style={{ fontSize: 14 }}>🎬 The Highlights</h3>
      {picks.map((e, i) => (
        <div key={i} className="meta" style={{ padding: '3px 0' }}>
          <b style={{ fontFamily: 'var(--cond)' }}>{e.min}'</b> - {e.text}
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
  const { teamTalk, liveTactics, touch } = useStore.getState()
  const [squadOpen, setSquadOpen] = useState(false)
  const [explain, setExplain] = useState<string | null>(null)

  const ctx = live.ctx
  const club = game.clubs[game.userClubId]
  const isClubMatch = ctx.userSideId === game.userClubId
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
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
      advice.push(`🔋 ${p!.name} is running on fumes (${Math.round(e)}%)${cover ? ` - ${cover.name} covers ${p!.pos} from the bench` : ''}.`)
    }
  }
  const min = ctx.tick * 4
  if (min >= 45) {
    const poor = [...mine.ratings.entries()]
      .map(([id, r]) => ({ p: game.players[id], r }))
      .filter(x => x.p && mine.onPitch.has(x.p.id) && x.r < 4.6)
      .sort((a, b) => a.r - b.r)[0]
    if (poor) advice.push(`📉 ${poor.p!.name} is having one of those days (${poor.r.toFixed(1)}) - fresh legs might spare him.`)
  }
  for (const e of live.events.slice(0, live.cursor)) {
    if (e.type === 'YC' && e.playerId != null && mine.onPitch.has(e.playerId) && (mine.yellowUntil.get(e.playerId) ?? 0) <= min) {
      const p = game.players[e.playerId]
      if (p) advice.push(`🟨 ${p.name} is walking a tightrope - one more infringement and it's red.`)
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
    <div className="card" style={{ margin: '12px 0', borderLeft: '4px solid var(--stripe)' }}>
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

      <div className="fact-label" style={{ marginTop: 10 }}>In-Match Tactics <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>- tap a name to see what it does</span></div>
      {SLIDER_INFO.map(s => (
        <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
          <span style={{ width: 78, fontSize: 11, color: 'var(--ink-faint)', fontFamily: 'var(--cond)', textTransform: 'uppercase', letterSpacing: .5, cursor: 'pointer' }}
            onClick={() => setExplain(`${s.label}: ${sliderReadout(s.key, club.tactic[s.key])}`)}>
            {s.label}
          </span>
          <input type="range" min={0} max={100} value={club.tactic[s.key]} style={{ flex: 1, accentColor: 'var(--brand-700)' }}
            onChange={e => { club.tactic[s.key] = Number(e.target.value); liveTactics(); touch() }} />
        </div>
      ))}
      {explain && <div className="meta" style={{ margin: '6px 0' }}>{explain}</div>}
      </>}

      {/* One button into the match-day squad, where several changes can be made
          in one visit. This used to be two dropdowns and a Make button: one sub
          per trip, no shirt numbers, no sight of who was carrying a knock. */}
      <div className="fact-label" style={{ marginTop: 12 }}>Replacements ({5 - ctx.subsUsed} of 5 left)</div>
      <button className="btn ghost block" style={{ marginTop: 6 }} disabled={ctx.subsUsed >= 5}
        onClick={() => setSquadOpen(true)}>
        🔁 {ctx.subsUsed >= 5 ? 'All five changes used' : 'Match-Day Squad - make replacements'}
      </button>
      <EnergyBars mine={mine} />
      {squadOpen && <SquadSheet onClose={() => setSquadOpen(false)} />}
      <button className="btn gold block" style={{ margin: '14px 0 2px', width: '100%' }} onClick={onResume}>
        {resumeLabel}
      </button>
    </div>
  )
}

/** The match-day squad, mid-match: the XV on the left, the bench on the right,
 *  tap one then the other to make a change, and keep going until the five are
 *  gone or you are happy.
 *
 *  It replaces a pair of <select> dropdowns and a Make button. Those could only
 *  do one change per visit to the panel, showed no shirt number, no rating and
 *  no sign of who had picked up a knock, and gave the bench in squad order
 *  rather than telling you who actually covered the shirt you were emptying.
 *
 *  `forcedOffId` is the injury flow (feedback 9-3): when a man goes down badly
 *  the sheet opens with him already armed, so the only decision left is who
 *  comes on. */
export function SquadSheet({ onClose, freeCoverId, title, note, hurtName, hurtDesc, mustDecide, onTactics }: {
  onClose: () => void
  /** The man the assistant sent on to cover an injury. Swapping him is free. */
  freeCoverId?: number
  title?: string
  note?: string
  /** The injured man, named in the sheet body as well as the heading, because the
   *  heading scrolls out of reach on a phone once the bench is in view. */
  hurtName?: string
  hurtDesc?: string
  /** A forced stop: the sheet cannot be dismissed until a change is made. Used
   *  for injuries, where somebody has to come on and the choice is the
   *  manager's, not the assistant's. */
  mustDecide?: boolean
  /** route through to the tactics panel, for the Squad button in the control row */
  onTactics?: () => void
}) {
  const game = useStore(s => s.game)!
  const live = useStore(s => s.liveMatch)!
  const { halfTimeSub, injuryCover } = useStore.getState()
  const [offId, setOffId] = useState<number | null>(freeCoverId ?? null)
  const [freeLeft, setFreeLeft] = useState(freeCoverId != null)
  const [log, setLog] = useState<string[]>([])

  const ctx = live.ctx
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  const left = 5 - ctx.subsUsed

  // The XV in shirt order, because that is how a team sheet reads and how the
  // man you are looking for is found.
  const xv = mine.lineup.slice(0, 15).map((id, i) => ({
    shirt: i + 1,
    p: id != null ? game.players[id] : null,
  })).filter((r): r is { shirt: number; p: Player } => !!r.p)

  const bench = mine.lineup.slice(15)
    .map(id => (id != null ? game.players[id] : null))
    .filter((p): p is Player => !!p && !p.injury && !mine.onPitch.has(p.id) && !mine.ratings.has(p.id))

  const off = offId != null ? game.players[offId] : null
  // Natural cover first, same as the engine's own bench discipline, so the
  // like-for-like choice is the one at the top of the list.
  const covers = (p: Player) => !!off && (p.pos === off.pos || p.alt.includes(off.pos))
  const benchSorted = [...bench].sort((a, b) => Number(covers(b)) - Number(covers(a)) || b.ca - a.ca)

  // Swapping the injury cover is free and does not burn one of the five, so it
  // routes through injuryCover rather than a normal substitution.
  const isFreeSwap = freeLeft && offId != null && offId === freeCoverId
  const doSub = (inP: Player) => {
    if (offId == null) return
    const msg = isFreeSwap ? injuryCover(offId, inP.id) : halfTimeSub(offId, inP.id)
    if (isFreeSwap) setFreeLeft(false)
    setLog(l => [msg, ...l].slice(0, 4))
    setOffId(null)
  }

  // a forced stop is satisfied by any change, including keeping the assistant's
  // man - tapping him again is a decision, it is just the same decision
  const settled = !mustDecide || log.length > 0 || !freeLeft
  return (
    <div className="modal-veil" onClick={() => { if (settled) onClose() }}>
      <div className="modal squad-sheet" onClick={e => e.stopPropagation()}>
        <div className="grab" />
        <div className="sheet-head">
          <h3>{title ?? 'Match-Day Squad'}</h3>
          <span className="meta">{left} change{left === 1 ? '' : 's'} left</span>
        </div>
        {/* WHO IS HURT, stated where the decision is made.
            A phone screenshot showed this sheet scrolled down to reach the bench
            with the heading off the top of the screen, so the manager was being
            asked to replace a man the screen no longer named. The heading is
            sticky now, and the casualty is named again here in his own line
            rather than buried in the middle of a paragraph of instructions. */}
        {hurtName && (
          <div className="sheet-casualty">
            🏥 <b>{hurtName}</b> is off{hurtDesc ? ` - ${hurtDesc}` : ''}
          </div>
        )}
        <div className="meta sheet-hint">
          {note ? <>{note}{' '}</> : null}
          {isFreeSwap && off ? `The assistant has sent ${off.name} on. Tap someone else to change it, free of charge, or tap him again to keep him.`
            : off ? `${off.name} is coming off. Now tap his replacement.`
            : left <= 0 ? 'No tactical replacements left.'
            : 'Tap a man on the pitch, then tap who comes on for him.'}
        </div>
        <div className="sheet-cols">
          <div className="sheet-col">
            <div className="fact-label">On the Pitch</div>
            {xv.map(({ shirt, p }) => {
              const on = mine.onPitch.has(p.id)
              const e = Math.round(mine.energy.get(p.id) ?? 70)
              const r = mine.ratings.get(p.id)
              const binned = (mine.yellowUntil.get(p.id) ?? 0) > ctx.tick * 4
              // the free injury swap stays available even with all five used
              const canFree = freeLeft && p.id === freeCoverId
              return (
                <button key={p.id} className={`sheet-row ${offId === p.id ? 'armed' : ''}`}
                  disabled={!on || (left <= 0 && !canFree)}
                  onClick={() => {
                    // Re-tapping the man the assistant sent on means "he stays".
                    // That is a decision, so it settles a forced stop - and it has
                    // to be answerable here, because he is already on the pitch
                    // and so never appears in the bench column.
                    if (canFree && offId === p.id) {
                      setFreeLeft(false)
                      setLog(l => [`${p.name} keeps the shirt.`, ...l].slice(0, 4))
                      setOffId(null)
                      return
                    }
                    setOffId(offId === p.id ? null : p.id)
                  }}>
                  <span className="sh-num">{shirt}</span>
                  <span className="sh-name">{p.name}</span>
                  {binned && <span className="sh-flag" title="In the bin">🟨</span>}
                  {p.injury && <span className="sh-flag" title="Injured">🏥</span>}
                  {r != null && <span className="sh-rate">{r.toFixed(1)}</span>}
                  <span className={`sh-nrg ${e < 25 ? 'red' : e < 50 ? 'amber' : ''}`}>{e}%</span>
                </button>
              )
            })}
          </div>
          <div className="sheet-col">
            <div className="fact-label">Bench{off ? ` - cover for ${off.pos}` : ''}</div>
            {benchSorted.length === 0 && <div className="meta">The bench is empty.</div>}
            {benchSorted.map(p => {
              // what he was told before kick-off, so the choice is informed (F4)
              const seat = mine.seatOf.get(p.id)
              const brief = seat != null ? briefForSeat(game.clubs[mine.teamId], seat) : 'orders'
              return (
                <button key={p.id} className={`sheet-row ${off && covers(p) ? 'cover' : ''}`}
                  disabled={!off || (left <= 0 && !isFreeSwap)}
                  onClick={() => doSub(p)}>
                  <span className="sh-num">{p.pos}</span>
                  <span className="sh-name">{p.name}</span>
                  {brief !== 'orders' && (
                    <span className="sh-flag" title={BRIEF_BY_ID[brief].name}>{BRIEF_BY_ID[brief].icon}</span>
                  )}
                  {off && covers(p) && <span className="sh-flag" title="Natural cover">✓</span>}
                  <span className="sh-rate">{p.ca}</span>
                </button>
              )
            })}
          </div>
        </div>
        {log.map((m, i) => <div key={i} className="meta sheet-log">{m}</div>)}
        {mustDecide && !settled && (
          <div className="meta sheet-log" style={{ color: 'var(--red)', fontWeight: 700 }}>
            Play is stopped until somebody takes his shirt. Tap the man you want on, or tap the
            assistant's pick again to keep him.
          </div>
        )}
        <div className="btn-row" style={{ marginTop: 8 }}>
          {onTactics && (
            <button className="btn ghost" onClick={onTactics}>📋 Tactics</button>
          )}
          <button className="btn gold" style={{ flex: 1.6 }} disabled={!settled} onClick={onClose}>
            {log.length ? `▸ Done (${log.length} change${log.length === 1 ? '' : 's'} made)`
              : settled ? '▸ Back to the Match' : '▸ Name a replacement first'}
          </button>
        </div>
      </div>
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
