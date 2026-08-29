import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useStore } from '../../store'
import { analystArmed } from '../../game/rewarded'
import { rewardedAvailable, showRewarded } from '../../game/monetise'
import {
  matchStats, teamShort, teamUnits, rosterOf, assistantJudgement, autoSelect, availablePlayers,
  refFor, refNotes, frontRowCover, repairSheet, rollWeather, sideEnergy, MAX_SUBS, type LiveCtx, type SideCtx,
} from '../../game/matchEngine'
import { BENCH_SLOTS, CHEM_SLOTS, XV_SLOTS, chemKey, clubCode, chemTier, eventText, injuryDesc, fixtureDate, fixtureDayOff, grudgeBetween, inRedZone, oldBoyApps, weekDate, type MatchEvent, type Player, type Pos } from '../../game/model'
import { BRIEF_BY_ID, SPLIT_BY_ID, benchSeats, briefForSeat, splitFor } from '../../game/bench'
import { natFixtureThisWeek, userFixtureThisWeek, weekRng } from '../../game/season'
import { effAt } from '../../game/attributes'
import { PRESETS, SLIDER_INFO, sliderReadout, type SliderKey } from '../../game/tactics'
import { ord, posName, t } from '../../game/i18n'
import { coachFixes, gradeFixes, gradeLine, unitBattles, type FixTag } from '../../game/coachfix'
import { CrestT, Jersey, PosBadge, SectionTitle, Stars } from '../components'
import { stageName } from './Home'
import { matchSfx, soundOn, toggleSound } from '../audio'
import { derbyName } from '../../game/rivalries'
import { matchStakes } from '../../game/stakes'
import { dialLine, philosophyOf } from '../../game/philosophy'
import { venueEffect } from '../../game/venue'
import { sortTable } from '../../game/schedule'

const WEATHER_ICON: Record<string, string> = { Dry: '☀️', Rain: '🌧️', Wind: '💨', Snow: '❄️' }

/** The forecast in words. The VALUE stays English everywhere it is stored or
 *  compared - the engine reads fixture.weather - and only the label moves. */
const weatherWord = (w: string): string => t(`matchday.wx${w}`)

export default function MatchDay() {
  const game = useStore(s => s.game)!
  const live = useStore(s => s.liveMatch)
  const { back } = useStore.getState()

  const clubFx = game.unemployed ? undefined : userFixtureThisWeek(game)
  const fx = live?.fixture ?? clubFx ?? natFixtureThisWeek(game)
  if (!fx) {
    return (
      <div className="title-screen">
        <div>{t('matchday.noFixture')}</div>
        <button className="btn gold" style={{ marginTop: 16 }} onClick={back}>{t('matchday.back')}</button>
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

// the tables hold KEYS, the tiles call t() - the speech id is what reaches the
// engine and the save, so only the words on the tile change with the language
const SPEECHES = [
  { id: 'calm', icon: '🧊', name: 'matchday.spCalm', desc: 'matchday.spCalmD' },
  { id: 'fire', icon: '🔥', name: 'matchday.spFire', desc: 'matchday.spFireD' },
  { id: 'underdog', icon: '🐺', name: 'matchday.spUnderdog', desc: 'matchday.spUnderdogD' },
  { id: 'expect', icon: '👑', name: 'matchday.spExpect', desc: 'matchday.spExpectD' },
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
  { id: 'full', icon: '📺', name: 'matchday.vmFull', desc: 'matchday.vmFullD' },
  { id: 'highlights', icon: '🎬', name: 'matchday.vmHighlights', desc: 'matchday.vmHighlightsD' },
  { id: 'instant', icon: '⏩', name: 'matchday.vmInstant', desc: 'matchday.vmInstantD' },
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
      <div className="set-label">{t('matchday.howWatch')}</div>
      <div className="preset-row">
        {VIEW_MODES.map(v => (
          <button key={v.id} className={`preset-chip${view === v.id ? ' on' : ''}`} title={t(v.desc)}
            onClick={() => onPick(v.id)}>{v.icon} {t(v.name)}</button>
        ))}
      </div>
      <div className="meta" style={{ marginTop: 4 }}>
        {t(VIEW_MODES.find(v => v.id === view)?.desc ?? '')}
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
  const [spotMsg, setSpotMsg] = useState<string | null>(null)
  const rewardAnalyst = useStore(st => st.rewardAnalyst)
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
  // `tac`, not `t`: t() is the translator (src/game/i18n.ts)
  const tac = club.tactic

  const oppLineup = useMemo(() => {
    const pool = availablePlayers(game, rosterOf(game, opp))
    return autoSelect(game, pool)
  }, [game, opp])
  const oppUnits = teamUnits(game, oppLineup)
  const myUnits = teamUnits(game, tac.lineup)

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
      const id = tac.lineup[slot]
      const p = id != null ? game.players[id] : null
      if (p) return p.pos
    }
    return seat.pos[0]
  }

  /** A sheet edited here is the manager's, same as on the Selection screen:
   *  the engine must not re-pick it on the way out of the tunnel. */
  const claim = () => { tac.userPicked = true }

  const setSlot = (slot: number, pid: number | null) => {
    if (pid != null) {
      const other = tac.lineup.indexOf(pid)
      if (other >= 0) tac.lineup[other] = tac.lineup[slot]
    }
    tac.lineup[slot] = pid
    claim()
    setPickSlot(null)
    setSel(null)
    touch()
  }

  // FM Mobile interaction: tap to pick up, tap again to swap; double-tap = picker
  const tapSlot = (slot: number) => {
    if (sel == null) { setSel(slot); return }
    if (sel === slot) { setSel(null); setPickSlot(slot); return }
    const a = tac.lineup[sel]
    tac.lineup[sel] = tac.lineup[slot]
    tac.lineup[slot] = a
    claim()
    setSel(null)
    touch()
  }

  const problem = (p: Player | null) =>
    p ? (p.injury ? 'INJURED' : p.bans > 0 ? 'SUSPENDED' : p.natSquad ? 'INTL DUTY' : p.clubId !== club.id ? 'GONE' : null) : 'EMPTY'

  // pre-flight warnings for the ready check
  // Plain words, one line each (user: "can we make this easier to
  // understand?"). "No fit no. 3 (Smith - intl duty) - an unfit shirt cannot
  // be sent out" made the reader decode three abbreviations to learn one
  // thing: this man cannot play today.
  const PROB_WORD: Record<string, string> = {
    INJURED: t('matchday.probINJURED'), SUSPENDED: t('matchday.probSUSPENDED'),
    'INTL DUTY': t('matchday.probINTL'), GONE: t('matchday.probGONE'),
  }
  const warnings: { level: 'bad' | 'warn' | 'note'; text: string }[] = []
  for (let i = 0; i < 15; i++) {
    const pid = tac.lineup[i]
    const p = pid != null ? game.players[pid] : null
    const prob = problem(p)
    if (prob === 'EMPTY') warnings.push({ level: 'bad', text: t('matchday.warnEmpty', { shirt: XV_SLOTS[i].shirt }) })
    else if (prob) warnings.push({ level: 'bad', text: t('matchday.warnCannotStart', { player: p!.name, shirt: XV_SLOTS[i].shirt, problem: PROB_WORD[prob] }) })
    else if ((p!.rust ?? 0) > 0) warnings.push({ level: 'warn', text: t('matchday.warnRusty', { player: p!.name, n: p!.rust ?? 0 }) })
    else if (p!.cond < 60) warnings.push({ level: 'warn', text: t('matchday.warnUnfit', { player: p!.name, pct: Math.round(p!.cond) }) })
  }
  // The bench answers to the same rule as the XV (round 25, user: "I had an
  // injured player on the bench and the game play continued. All 23 should be
  // fit and ready to play"). An empty bench seat is a choice; a broken man in
  // one is a dead replacement the game would happily count all afternoon.
  for (let i = 15; i < tac.lineup.length; i++) {
    const pid = tac.lineup[i]
    if (pid == null) continue
    const p = game.players[pid] ?? null
    const prob = problem(p)
    if (prob && prob !== 'EMPTY') warnings.push({ level: 'bad', text: t('matchday.warnBench', { player: p!.name, shirt: i + 1, problem: PROB_WORD[prob] }) })
  }
  // Law 3: without cover at all three front-row positions the referee orders
  // uncontested scrums, and the set piece leaves the game for both sides. Loud,
  // because it is the one warning here that voids a whole game plan.
  //
  // JUDGED ON THE SHEET THAT WILL PLAY, NOT THE SHEET AS SAVED. Reported from a
  // live game: "my wife had props on the bench and a hooker but the game flashed
  // up this message." She was right and the warning was wrong. It used to read
  // tac.lineup, the sheet exactly as she left it, and frontRowCover does not count a
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
  const frontRow = frontRowCover(game, repairSheet(game, club, tac.lineup, splitFor(club)))
  if (!frontRow.legal) {
    // Plain words here too: "Law 3", "your 23" and "(1 of 2)" is how the
    // laws describe the problem, not how a player hears it. Say what is
    // short, what the referee will do about it, and what fixes it.
    const missing = ([['LP', 'matchday.frLoosehead'], ['HK', 'matchday.frHooker'], ['TP', 'matchday.frTighthead']] as const)
      .filter(([k]) => frontRow[k] < 2)
      .map(([k, word]) => t(frontRow[k] === 0 ? 'matchday.frNone' : 'matchday.frOnly', { n: frontRow[k], pos: t(word) }))
      .join(t('matchday.frJoin'))
    warnings.push({ level: 'bad', text: t('matchday.warnScrum', { missing }) })
  }
  // milestone watch: pre-announce the numbers worth playing for today
  for (const pid of tac.lineup.slice(0, 15)) {
    const pl = pid != null ? game.players[pid] : null
    if (!pl) continue
    const cTries = pl.career.reduce((s, c) => s + c.tries, 0) + pl.stats.tries + (pl.hist?.tries ?? 0)
    const cApps = pl.career.reduce((s, c) => s + c.apps, 0) + pl.stats.apps + (pl.hist?.apps ?? 0)
    const cPts = pl.career.reduce((s, c) => s + c.points, 0) + pl.stats.points + (pl.hist?.points ?? 0)
    for (const [val, at, label] of [
      [cApps + 1, [100, 200, 300, 400], 'apps'],
      [cTries, [49, 99], 'tries'],
      [cPts, [495, 496, 497, 498, 499, 995, 996, 997, 998, 999], 'points'],
    ] as const) {
      if ((at as readonly number[]).includes(val as number)) {
        const n = val as number
        const what = label === 'apps' ? t('matchday.msApps', { ord: ord(n) })
          : label === 'tries' ? t('matchday.msTry', { n: n + 1, mark: n + 1 === 50 ? 50 : 100 })
          : t('matchday.msPts', { mark: n < 990 ? 500 : 1000 })
        warnings.push({ level: 'note', text: t('matchday.warnMilestone', { player: pl.name, what }) })
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
      const gap = Math.abs(order[mine].pts - order[theirs].pts)
      warnings.push({ level: 'note', text: t('matchday.warnSixPointer', { gap: gap === 0 ? t('matchday.sixLevel') : t('matchday.sixGap', { n: gap }) }) })
    }
  }
  const lastPlayed = game.fixtures.find(f =>
    f.week === game.week - 1 && f.played && (f.homeId === game.userClubId || f.awayId === game.userClubId))
  const gapDays = lastPlayed ? 7 + fixtureDayOff(fx.id) - fixtureDayOff(lastPlayed.id) : 7
  if (gapDays <= 5) warnings.push({ level: 'warn', text: t('matchday.warnTurnaround', { n: gapDays }) })
  if (!speech) warnings.push({ level: 'note', text: t('matchday.warnNoSpeech') })

  // THE HARD GATE (user: "when a player is injured you shouldn't be able to
  // process the game without making changes"). A bad warning used to be
  // confirmable: the modal said the man would be auto-replaced and let you
  // wave the team through blind. Now an unfit shirt blocks the tunnel: the
  // one button that proceeds APPLIES the assistant's re-pick first, so the
  // change is made in front of you, or Not Yet takes you back to do it by
  // hand. Only a genuine crisis (no fit XV in the whole squad) falls back to
  // patching at kick-off, because refusing to play at all is not an option
  // the fixture list offers.
  const hasBad = warnings.some(w => w.level === 'bad')
  const fixedLineup = useMemo(() => {
    if (!confirm || !hasBad) return null
    // his re-pick, his eye: the tunnel fix is the assistant working, so it
    // carries assistantJudgement like every side he names
    const picked = autoSelect(game, availablePlayers(game, club.players), splitFor(club), assistantJudgement(game))
    for (let i = 0; i < 15; i++) {
      const p = picked[i] != null ? game.players[picked[i]!] : null
      if (problem(p)) return null // crisis: even the assistant cannot field 15 fit men
    }
    return picked
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirm, hasBad])

  // rotation dilemma: before a cup tie or on a quick turnaround, the
  // assistant flags overloaded/underdone legs and offers a one-tap rotation
  const rotFlagged = tac.lineup.slice(0, 15)
    .map(id => id != null ? game.players[id] : null)
    .filter((p): p is Player => !!p && !p.injury && p.clubId === club.id && (inRedZone(p) || p.cond < 62))
  const rotWindow = comp?.type !== 'league' || gapDays <= 5
  const rotReason = (p: Player) => inRedZone(p) ? t('matchday.rotRedZone') : t('matchday.rotFit', { pct: Math.round(p.cond) })
  const rotateXV = () => {
    const rest = new Set(rotFlagged.map(p => p.id))
    const pool = availablePlayers(game, club.players).filter(p => !rest.has(p.id))
    // the one-tap rotation is the assistant's draft too - same imperfect eye
    const fresh = autoSelect(game, pool, undefined, assistantJudgement(game))
    for (let i = 0; i < 23; i++) tac.lineup[i] = fresh[i]
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
  const allPlans = (() => {
    // the assistant's voice rotates per fixture (fx.id keeps it stable
    // across re-renders) so the same advice never reads the same twice
    const v = (opts: string[]) => opts[fx.id % opts.length]
    const plans: { text: string; d: Partial<Record<SliderKey, number>>; w: number }[] = []
    if (forecast === 'Rain' || forecast === 'Snow')
      plans.push({ w: 3, text: v([
        t('matchday.planWet1', { weather: weatherWord(forecast) }),
        t('matchday.planWet2', { weather: weatherWord(forecast) }),
        t('matchday.planWet3'),
      ]), d: { kicking: 15, style: -8 } })
    if (oppUnits.scrum < myUnits.scrum * 0.94)
      plans.push({ w: 2.5, text: v([
        t('matchday.planScrumUs1'), t('matchday.planScrumUs2'), t('matchday.planScrumUs3'),
      ]), d: { style: -10, aggression: 8 } })
    if (myUnits.scrum < oppUnits.scrum * 0.94)
      plans.push({ w: 2, text: v([
        t('matchday.planScrumThem1'), t('matchday.planScrumThem2'), t('matchday.planScrumThem3'),
      ]), d: { style: 8, kicking: 6 } })
    if (oppUnits.defence < myUnits.attack * 0.95)
      plans.push({ w: 2, text: v([
        t('matchday.planWide1'), t('matchday.planWide2'), t('matchday.planWide3'),
      ]), d: { style: 12, tempo: 8 } })
    if (myUnits.lineout > oppUnits.lineout * 1.07)
      plans.push({ w: 1.5, text: v([
        t('matchday.planAir1'), t('matchday.planAir2'),
      ]), d: { kicking: 10 } })
    if (matchRef.style === 'strict')
      plans.push({ w: 2, text: v([
        t('matchday.planStrict1', { ref: matchRef.name }), t('matchday.planStrict2', { ref: matchRef.name }),
      ]), d: { aggression: -12 } })
    if (matchRef.style === 'lenient')
      plans.push({ w: 1.5, text: v([
        t('matchday.planLenient1', { ref: matchRef.name }), t('matchday.planLenient2', { ref: matchRef.name }),
      ]), d: { tempo: 10, aggression: 6 } })
    if (oppCond < 78)
      plans.push({ w: 2, text: v([
        t('matchday.planTired1'), t('matchday.planTired2'),
      ]), d: { tempo: 12 } })
    if (heated)
      plans.push({ w: 1.8, text: v([
        t('matchday.planHeated1'), t('matchday.planHeated2'),
      ]), d: { aggression: -8 } })
    return plans.sort((a, b) => b.w - a.w)
  })()
  // the assistant's brief is the top three reads. The analyst's all-nighter
  // (v1.1.0, rewarded.ts) buys the rest of the list for this match - armed by
  // a watched spot, marked in the ledger, gone with the week.
  const fullRead = analystArmed(game)
  const gamePlan = fullRead ? allPlans : allPlans.slice(0, 3)
  const applyPlan = () => {
    for (const p of gamePlan) {
      for (const [k, dv] of Object.entries(p.d) as [SliderKey, number][]) {
        tac[k] = Math.max(5, Math.min(95, tac[k] + dv))
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
   *  answer for a Premier Division Saturday is rarely the answer for a pre-season
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
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)' }}>
          <span>{mine.toFixed(1)}</span><b style={{ color: 'var(--info)' }}>{label}</b><span>{theirs.toFixed(1)}</span>
        </div>
        <div style={{ height: 8, background: 'var(--border-strong)', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
          <div style={{ width: `${pct}%`, background: 'var(--club1)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.15)' }} />
          <div style={{ flex: 1, background: game.clubs[opp]?.colors[0] ?? 'var(--gold)', opacity: .85 }} />
        </div>
      </div>
    )
  }

  const renderSlot = (slot: number) => {
    const shirt = slot < 15 ? XV_SLOTS[slot].shirt : seats[slot - 15].shirt
    const pos = slotPos(slot)
    const pid = tac.lineup[slot]
    const p = pid != null ? game.players[pid] : null
    const prob = problem(p)
    // FIXED COLUMN WIDTHS, because the XV and the Replacements are separate
    // <table>s sharing this one row renderer: left to auto-layout, each table
    // sizes its own columns from its own longest name, so the bench's star
    // column drifted sideways from the XV's directly above it (user: "the
    // stars are unaligned for subs"). Pin every column but the name and the
    // two sections read as one sheet.
    return (
      <tr key={slot} onClick={() => tapSlot(slot)}
        className={`${prob ? 'prob-row' : ''}${sel === slot ? ' held-row' : ''}`}>
        <td className="num" style={{ fontFamily: 'monospace', fontWeight: 700, width: 26 }}>{shirt}</td>
        <td style={{ width: 38 }}><PosBadge pos={pos} /></td>
        <td className="name">
          {p ? p.name : <span className="muted">{t('matchday.tapToPick')}</span>}
          {prob && p && <span style={{ color: 'var(--text-negative)', fontSize: 10.5, fontWeight: 700 }}> {prob}</span>}
          {!prob && p && (p.rust ?? 0) > 0 && <span style={{ color: 'var(--gold)', fontSize: 10.5, fontWeight: 700 }}> {t('matchday.rusty')}</span>}
        </td>
        <td style={{ width: 92 }}>{p && <Stars ca={effAt(p, pos)} />}</td>
        <td className="num" style={{ width: 44 }}>{p ? `${Math.round(p.cond)}%` : ''}</td>
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
          <SectionTitle sub={t('matchday.pickerSub', { shirt: pickSlot < 15 ? XV_SLOTS[pickSlot].shirt : seats[pickSlot - 15].shirt })}>
            {t('matchday.pickerTitle', { pos: posName(pos) })}
          </SectionTitle>
          <table className="dtable"><tbody>
            {pool.map(p => (
              <tr key={p.id} onClick={() => setSlot(pickSlot, p.id)}
                style={tac.lineup.includes(p.id) ? { opacity: .55 } : undefined}>
                <td><PosBadge pos={p.pos} /></td>
                <td className="name">{p.name}{tac.lineup.includes(p.id) ? t('matchday.selected') : ''}
                  {(p.rust ?? 0) > 0 && <span style={{ color: 'var(--gold)', fontSize: 10.5, fontWeight: 700 }}> {t('matchday.rustyW', { n: p.rust ?? 0 })}</span>}
                </td>
                <td><Stars ca={effAt(p, pos)} /></td>
                <td className="num">{Math.round(p.cond)}%</td>
              </tr>
            ))}
          </tbody></table>
          <button className="btn ghost block" onClick={() => setSlot(pickSlot, null)}>{t('matchday.clearSlot')}</button>
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
            <h3 style={{ fontSize: 17, margin: '2px 0 8px', textAlign: 'center' }}>{t('matchday.readyTitle')}</h3>
            {warnings.length === 0 && (
              <div className="meta" style={{ margin: '6px 0', textAlign: 'center' }}>{t('matchday.readyOk')}</div>
            )}
            {warnings.length > 0 && (
              <div style={{ maxHeight: '34vh', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10, padding: '2px 10px' }}>
                {warnings.map((w, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 8, padding: '6px 0', fontSize: 12.5, lineHeight: 1.4,
                    color: w.level === 'bad' ? 'var(--text-negative)' : w.level === 'warn' ? 'var(--gold)' : 'var(--text-secondary)',
                    borderBottom: i < warnings.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <span>{w.level === 'bad' ? '⛔' : w.level === 'warn' ? '⚠️' : 'ℹ️'}</span>
                    <span>{w.text}</span>
                  </div>
                ))}
              </div>
            )}
            {speech && (
              <div className="meta" style={{ marginTop: 8, textAlign: 'center' }}>
                {t('matchday.speechLabel')}<b>{t(SPEECHES.find(s => s.id === speech)?.name ?? '')}</b>
              </div>
            )}
            {hasBad && fixedLineup && (
              <div className="meta" style={{ marginTop: 8, textAlign: 'center', color: 'var(--text-negative)', fontWeight: 600 }}>
                {t('matchday.fixItNote')}
              </div>
            )}
            {hasBad && !fixedLineup && (
              <div className="meta" style={{ marginTop: 8, textAlign: 'center', color: 'var(--text-negative)', fontWeight: 600 }}>
                {t('matchday.crisisNote')}
              </div>
            )}
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn ghost" onClick={() => setConfirm(false)}>{t('matchday.notYet')}</button>
              {/* the gold button's label keeps the exact 'Take the Field' text
                  inside it because that substring is what a tap looks for -
                  scripts/i18nprobe.ts pins the English value for the same reason */}
              <button className="btn gold" style={{ flex: 1.5, fontSize: 15 }}
                onClick={() => {
                  if (hasBad && fixedLineup) { tac.lineup = fixedLineup; touch() }
                  setConfirm(false)
                  if (view === 'instant') instantResult(speech ?? undefined)
                  else kickOff(speech ?? undefined, view)
                }}>
                {hasBad && fixedLineup ? t('matchday.fixItPrefix') : ''}{t(view === 'instant' ? 'matchday.letHimTakeIt' : 'matchday.takeField')}
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
            <h1>{t('matchday.mdTitle')}</h1>
            <div className="date">{comp?.name ?? (fx.compId === 'fr' ? t('matchday.clubFriendly') : '')}{fx.stage ? ` · ${stageName(fx.stage)}` : ''} · {fixtureDate(game.season, fx.week, fx.id)}</div>
          </div>
          <button className="continue-btn" onClick={tryKickOff}>{t('matchday.kickOff')}</button>
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
            <span style={{ fontFamily: 'var(--cond)', fontWeight: 700, fontSize: 15, color: 'var(--text-muted)', letterSpacing: 2 }}>{t('matchday.vs')}</span>
            {game.clubs[fx.awayId] && <Jersey club={game.clubs[fx.awayId]} size={54} />}
            <CrestT g={game} teamId={fx.awayId} size={38} />
          </div>
          <div className="mday-facts">
          <h3 style={{ fontSize: 19 }}>{t('matchday.vsLine', { home: teamShort(game, fx.homeId), away: teamShort(game, fx.awayId) })}</h3>
          <div className="meta">🏟️ {fx.venue
            ? t('matchday.venueNeutral', { name: fx.venue.name, city: fx.venue.city })
            : home ? t('matchday.venueHome', { stadium: home.stadium, city: home.city }) : t('common.neutralVenue')}</div>
          {/* THE DERBY IS NOT A FOOTNOTE ON THE WEATHER. It used to be glued to
              the forecast behind a middle dot, so on a phone the two ran
              together and wrapped into a centred red blob (owner screenshot,
              25 Aug: "tidy up the text next to weather forecast"). The
              forecast is a fact; the derby is the reason you are nervous.
              Separate lines, and the derby carries its own mark. */}
          <div className="meta" style={{ marginTop: 3 }}>
            {WEATHER_ICON[rollWeather(game.week, weekRng(game))]} {t('matchday.forecast', { weather: weatherWord(rollWeather(game.week, weekRng(game))) })}
          </div>
          {derbyName(fx.homeId, fx.awayId) && (
            <div className="meta derby-line" style={{ marginTop: 4 }}>
              🔥 <b>{t('matchday.derbyTag', { derby: derbyName(fx.homeId, fx.awayId) ?? '' })}</b>
            </div>
          )}
          </div>
        </div>

        {/* THE BILLING, in the tunnel. Same one line as the Home card, at the
            moment it lands hardest: this is what the next eighty minutes are
            actually for. Silent when the fixture has nothing to say. */}
        {(() => {
          const bill = matchStakes(game, fx)
          return bill ? (
            <div className="card" style={{ borderLeft: '4px solid var(--gold)', fontWeight: 600 }}>{bill}</div>
          ) : null
        })()}

        <div className="tab-bar" style={{ marginTop: 4 }}>
          <button className={ptab === 'brief' ? 'active' : ''} onClick={() => setPtab('brief')}>{t('matchday.tabBrief')}</button>
          <button className={ptab === 'team' ? 'active' : ''} onClick={() => setPtab('team')}>{t('matchday.tabTeam')}</button>
          <button className={ptab === 'talk' ? 'active' : ''} onClick={() => setPtab('talk')}>{t('matchday.tabTalk')}{speech ? ' ✓' : ''}</button>
        </div>

        {ptab === 'brief' && <>
        {(() => {
          // THE STAKES (audit 20A). The preview told you the matchup, the
          // weather and the milestones, but never what the result DOES - the
          // one line a supporter asks first. Everything here is read straight
          // off the live table, deterministically: position, the sides one
          // place either way with real point gaps, and late in the season the
          // lines that matter (playoffs, the bottom two). Knockout ties get
          // the only stake they have. Finals keep their own card below.
          const comp = game.comps[fx.compId]
          // ord() comes from i18n now - it was a local ternary here, and five
          // screens each had their own copy of it
          if (fx.stage && fx.stage !== 'F' && comp) {
            // the relegation playoff (21A) is knockout rugby with a whole
            // season's status on it, and the card should say exactly that
            const relBar = fx.stage === 'BAR' && comp.id === 'prem'
            return (
              <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
                <div className="fact-label">{t('matchday.stakes')}</div>
                <div className="meta">{relBar
                  ? t('matchday.stakesRelBar')
                  : t('matchday.stakesKnockout', { comp: comp.short })}</div>
              </div>
            )
          }
          if (fx.stage || !comp || comp.type !== 'league' || comp.id !== game.clubs[game.userClubId]?.leagueId) return null
          const order = sortTable(comp.table)
          const me = order.findIndex(r => r.teamId === game.userClubId)
          if (me < 0) return null
          const mine = order[me]
          if (mine.p < 2) return null
          const pos = me + 1
          const above = me > 0 ? order[me - 1] : null
          const below = me < order.length - 1 ? order[me + 1] : null
          const gapUp = above ? above.pts - mine.pts : 0
          const gapDown = below ? mine.pts - below.pts : 0
          const cutoff = comp.playoffTeams ?? 4
          const late = game.week >= 30
          const bits: string[] = []
          bits.push(pos === 1
            ? (below
              ? t('matchday.stakesTopClear', { comp: comp.short, pts: mine.pts, gap: gapDown, club: teamShort(game, below.teamId) })
              : t('matchday.stakesTop', { comp: comp.short, pts: mine.pts }))
            : (below
              ? t('matchday.stakesPosBoth', { pos: ord(pos), comp: comp.short, pts: mine.pts, above: teamShort(game, above!.teamId), gapUp, below: teamShort(game, below.teamId), gapDown })
              : t('matchday.stakesPos', { pos: ord(pos), comp: comp.short, pts: mine.pts, above: teamShort(game, above!.teamId), gapUp })))
          if (pos > 1 && gapUp <= 4) bits.push(t('matchday.stakesClimb'))
          else if (pos === 1 && gapDown <= 4) bits.push(t('matchday.stakesSlip'))
          if (late) {
            if (pos > cutoff && order[cutoff - 1]) {
              bits.push(t('matchday.stakesPlayoffGap', { n: order[cutoff - 1].pts - mine.pts, pos: ord(cutoff) }))
            } else if (pos <= cutoff && order[cutoff]) {
              bits.push(t('matchday.stakesPlayoffHold', { n: mine.pts - order[cutoff].pts }))
            }
            if (pos >= order.length - 1) bits.push(t('matchday.stakesBottomTwo'))
            else if (pos >= order.length - 3 && order[order.length - 2]) {
              bits.push(t('matchday.stakesAboveDrop', { n: mine.pts - order[order.length - 2].pts }))
            }
          }
          return (
            <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
              <div className="fact-label">{t('matchday.stakes')}</div>
              <div className="meta">{bits.join(' ')}</div>
            </div>
          )
        })()}
        {(() => {
          const danger = oppLineup.slice(0, 15)
            .map(id => id != null ? game.players[id] : null)
            .filter(Boolean)
            .sort((a, b) => b!.ca - a!.ca)[0]
          const oppClub = game.clubs[opp]
          const meetings = game.fixtures.filter(f => f.played &&
            ((f.homeId === opp && f.awayId === game.userClubId) || (f.homeId === game.userClubId && f.awayId === opp)))
          const QUOTES = [
            'matchday.quote1', 'matchday.quote2', 'matchday.quote3', 'matchday.quote4', 'matchday.quote5',
          ]
          return (
            <>
              {game.matchPrep && (
                <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
                  <div className="fact-label">{t('matchday.prepTitle')}</div>
                  <div className="meta">
                    {t({
                      attack: 'matchday.prepAttack',
                      defence: 'matchday.prepDefence',
                      setpiece: 'matchday.prepSetpiece',
                      fitness: 'matchday.prepFitness',
                      recovery: 'matchday.prepRecovery',
                    }[game.matchPrep])}
                  </div>
                </div>
              )}
              {fx.stage === 'F' && (
                <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
                  <div className="fact-label">{t('matchday.finalTitle')}</div>
                  <div className="meta">
                    {t('matchday.finalBody', { comp: game.comps[fx.compId]?.name ?? t('matchday.finalTrophy') })}
                  </div>
                </div>
              )}
              {(() => {
                const dn = derbyName(fx.homeId, fx.awayId)
                if (!dn) return null
                const rec = game.derbyBook?.[opp]
                const played = rec ? rec.w + rec.d + rec.l : 0
                return (
                  <div className="card" style={{ borderLeft: '4px solid var(--danger)' }}>
                    <div className="fact-label">🔥 {dn}</div>
                    <div className="meta">
                      {t('matchday.derbyBody')}
                      {played > 0
                        ? <>{t('matchday.derbyLedger', { club: oppClub?.short ?? t('matchday.them') })}<b>{rec!.w}{t('common.w')} {rec!.d}{t('common.d')} {rec!.l}{t('common.l')}</b>.</>
                        : <>{t('matchday.derbyFirst')}</>}
                    </div>
                  </div>
                )
              })()}
              {(() => {
                const g = !derbyName(fx.homeId, fx.awayId) ? grudgeBetween(game, fx.homeId, fx.awayId) : null
                return g ? (
                  <div className="card" style={{ borderLeft: '4px solid var(--danger)' }}>
                    <div className="fact-label">{t('matchday.badBlood')}</div>
                    <div className="meta">
                      {t('matchday.badBloodPre')}<b>{g.reason}</b>{t('matchday.badBloodRest')}
                    </div>
                  </div>
                ) : null
              })()}
              {(() => {
                const theirs = oppLineup
                  .map(id => id != null ? game.players[id] : null)
                  .filter((p): p is Player => !!p && oldBoyApps(p, game.userClubId) > 0)
                  .sort((a, b) => oldBoyApps(b, game.userClubId) - oldBoyApps(a, game.userClubId))
                const ours = tac.lineup
                  .map(id => id != null ? game.players[id] : null)
                  .filter((p): p is Player => !!p && oldBoyApps(p, opp) > 0)
                  .sort((a, b) => oldBoyApps(b, opp) - oldBoyApps(a, opp))
                if (!theirs.length && !ours.length) return null
                return (
                  <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
                    <div className="fact-label">{t('matchday.oldBoys')}</div>
                    {theirs.slice(0, 3).map(p => (
                      <div key={p.id} className="meta">
                        <b>{p.name}</b>{t('matchday.oldBoyTheirs', { pos: p.pos, n: oldBoyApps(p, game.userClubId) })}
                      </div>
                    ))}
                    {ours.slice(0, 3).map(p => (
                      <div key={p.id} className="meta">
                        {t('matchday.oldBoyOursPre')}<b>{p.name}</b>
                        {t('matchday.oldBoyOurs', { pos: p.pos, n: oldBoyApps(p, opp), club: oppClub?.short ?? t('matchday.them') })}
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
                  <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
                    <div className="fact-label">{t('matchday.farewell')}</div>
                    <div className="meta">
                      <b>{bowing.name}</b>{t('matchday.farewellPre', { age: bowing.age, pos: bowing.pos })}
                      {home
                        ? t('matchday.farewellHome', { club: oppClub?.short ?? t('matchday.theyShort') })
                        : t('matchday.farewellAway')}
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
                for (const id of tac.lineup.slice(0, 15)) {
                  const p = id != null ? game.players[id] : null
                  if (!p) continue
                  const cApps = p.career.reduce((s, c) => s + c.apps, 0) + p.stats.apps + (p.hist?.apps ?? 0)
                  const cTries = p.career.reduce((s, c) => s + c.tries, 0) + p.stats.tries + (p.hist?.tries ?? 0)
                  const cPts = p.career.reduce((s, c) => s + c.points, 0) + p.stats.points + (p.hist?.points ?? 0)
                  if (APPS.includes(cApps + 1)) {
                    lines.push({ p, text: t('matchday.brinkApps', { n: cApps + 1 }) })
                  } else if (TRIES.some(m => m - cTries === 1) && p.form >= 6.5) {
                    lines.push({ p, text: t('matchday.brinkTry', { n: cTries + 1 }) })
                  } else {
                    const target = PTS.find(m => m > cPts && m - cPts <= 9)
                    if (target) lines.push({ p, text: t('matchday.brinkPts', { n: target - cPts, mark: target }) })
                  }
                }
                if (!lines.length) return null
                return (
                  <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
                    <div className="fact-label">{t('matchday.onTheBrink')}</div>
                    {lines.slice(0, 3).map(({ p, text }) => (
                      <div key={p.id} className="meta">
                        <b>{p.name}</b>{t('matchday.brinkLine', { pos: p.pos, what: text })}
                      </div>
                    ))}
                  </div>
                )
              })()}
              {danger && (
                <div className="card" style={{ borderLeft: '4px solid var(--danger)' }}>
                  <div className="fact-label">{t('matchday.dangerMan')}</div>
                  <div className="meta">
                    <b>{danger.name}</b>{t('matchday.dangerBody', { pos: danger.pos, club: oppClub?.short ?? t('matchday.theyShort') })}
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
                    <div className="fact-label">{t('matchday.theWhistle')}</div>
                    <div className="meta" style={{ marginBottom: notes.length ? 4 : 0 }}>
                      <b>{ref.name}</b>{t('matchday.refAppointed')}
                    </div>
                    {notes.map((n, i) => <div key={i} className="meta">· {n}</div>)}
                    {notes.length === 0 && <div className="meta">{t('matchday.refNothing')}</div>}
                  </div>
                )
              })()}
              {(() => {
                // The bench plan, in words, before you go out (F4). The split is
                // set on the Tactics bench page; this is where you find out what
                // you actually named without counting shirts.
                const def = SPLIT_BY_ID[splitFor(club)]
                const briefed = seats
                  .map((_, i) => ({ i, b: briefForSeat(club, i), id: tac.lineup[15 + i] }))
                  .filter(x => x.b !== 'orders' && x.id != null)
                return (
                  <div className="card">
                    <div className="fact-label">{t('matchday.finishers')}</div>
                    <div className="meta" style={{ marginBottom: briefed.length ? 4 : 0 }}>
                      <b>{t(def.name)}.</b> {t(def.desc)}
                    </div>
                    {briefed.map(x => (
                      <div key={x.i} className="meta">
                        · {game.players[x.id!]?.name}: {t(BRIEF_BY_ID[x.b].name).toLowerCase()}
                      </div>
                    ))}
                    {briefed.length === 0 && (
                      <div className="meta">{t('matchday.finishersNone')}</div>
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
                    <div className="fact-label">{t('matchday.theTrip')}</div>
                    <div className="meta">{v.note}</div>
                    <div className="meta muted">
                      {t('matchday.tripKm', { n: v.km })}
                      {v.tz >= 1 ? t('matchday.tripTz', { n: v.tz }) : ''}
                      {v.altGap >= 250 ? t('matchday.tripAlt', { n: Math.round(v.alt) }) : ''}
                    </div>
                  </div>
                )
              })()}
              {oppClub?.coach && (
                <div className="card">
                  <div className="fact-label">{t('matchday.oppositeNumber')}</div>
                  <div className="meta">
                    <b>{oppClub.coach}</b>
                    {t('matchday.oppCoachLine', { club: oppClub.short, quote: t(QUOTES[(fx.id + game.week) % QUOTES.length]) })}
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
                          <b>{t(ph.name)}.</b> {t(ph.blurb)}
                        </div>
                        <div className="meta muted">{dialLine(oppClub.tactic)}</div>
                        {suite >= 1 && (
                          <div className="meta" style={{ marginTop: 4 }}>
                            <b>{t('matchday.theAngle')}</b> {t(ph.soft)}
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
                    <div className="fact-label">{t('matchday.bookOnThem')}</div>
                    {total > 0 && (
                      <div className="meta">
                        {t('matchday.underYou')}<b>{rec!.w}{t('common.w')} {rec!.d}{t('common.d')} {rec!.l}{t('common.l')}</b>
                        {t('matchday.againstClub', { club: oppClub?.short ?? t('matchday.them') })}
                        {rec!.w === 0 && rec!.l >= 3 && <> <b style={{ color: 'var(--text-negative)' }}>{t('matchday.bogeySide')}</b>{t('matchday.bogeyRest')}</>}
                        {rec!.l === 0 && rec!.w >= 5 && <> <b style={{ color: 'var(--text-positive)' }}>{t('matchday.happyGround')}</b>{t('matchday.happyRest')}</>}
                        {(rec!.run ?? 0) >= 3 && !(rec!.l === 0 && rec!.w >= 5) && <> <b style={{ color: 'var(--text-positive)' }}>{t('matchday.streakWins', { n: rec!.run ?? 0 })}</b>{t('matchday.streakWinsRest')}</>}
                        {(rec!.run ?? 0) <= -3 && !(rec!.w === 0 && rec!.l >= 3) && <> <b style={{ color: 'var(--text-negative)' }}>{t('matchday.streakLosses', { n: -(rec!.run ?? 0) })}</b>{t('matchday.streakLossesRest')}</>}
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
        <SectionTitle sub={t('matchday.h2hYours')}>{t('matchday.headToHead')}</SectionTitle>
        {bar(t('matchday.h2hScrum'), myUnits.scrum, oppUnits.scrum)}
        {bar(t('matchday.h2hLineout'), myUnits.lineout, oppUnits.lineout)}
        {bar(t('matchday.h2hBreakdown'), myUnits.breakdown, oppUnits.breakdown)}
        {bar(t('matchday.h2hAttack'), myUnits.attack, oppUnits.attack)}
        {bar(t('matchday.h2hDefence'), myUnits.defence, oppUnits.defence)}

        {gamePlan.length > 0 && (
          <div className="card" style={{ borderLeft: '4px solid var(--gold)', marginTop: 8 }}>
            <div className="fact-label">{t('matchday.gamePlanTitle')}</div>
            {gamePlan.map((p, i) => (
              <div key={i} className="meta" style={{ padding: '2px 0' }}>• {p.text}</div>
            ))}
            <button className="btn ghost block" style={{ marginTop: 8 }} disabled={planApplied} onClick={applyPlan}>
              {t(planApplied ? 'matchday.planApplied' : 'matchday.planApply')}
            </button>
            {rewardedAvailable('matchday') && !fullRead && allPlans.length > gamePlan.length && (
              <button className="btn ghost block" style={{ marginTop: 6, fontSize: 12.5 }} onClick={() => {
                void showRewarded('matchday').then(out => {
                  if (out === 'completed') rewardAnalyst()
                  else setSpotMsg(t(out === 'skipped' ? 'till.spotSkipped' : 'till.spotUnavailable'))
                })
              }}>{t('till.watchAnalyst', { n: allPlans.length - gamePlan.length })}</button>
            )}
            {fullRead && <div className="meta" style={{ marginTop: 6, color: 'var(--gold)' }}>{t('till.analystDone')}</div>}
            {spotMsg && <div className="meta sheet-log" style={{ marginTop: 6, borderLeft: '3px solid var(--gold)', paddingLeft: 8 }}>{spotMsg}</div>}
          </div>
        )}

        {(() => {
          const label: Record<number, string> = {
            0: t('matchday.partFrontRow'), 3: t('matchday.partLocks'),
            8: t('matchday.partHalfbacks'), 11: t('matchday.partCentres'),
          }
          const rows = CHEM_SLOTS.filter(([i]) => label[i]).map(([i, j]) => {
            const a = tac.lineup[i] != null ? game.players[tac.lineup[i]!] : null
            const b = tac.lineup[j] != null ? game.players[tac.lineup[j]!] : null
            if (!a || !b) return null
            const g = game.chem?.[chemKey(a.id, b.id)] ?? 0
            return { key: label[i], a, b, g, tier: chemTier(g) }
          }).filter(Boolean) as { key: string; a: Player; b: Player; g: number; tier: string }[]
          if (!rows.length) return null
          const surname = (n: string) => n.split(' ').slice(-1)[0]
          return (
            <>
              <SectionTitle sub={t('matchday.partnershipsSub')}>{t('matchday.partnerships')}</SectionTitle>
              <div className="card" style={{ paddingTop: 6, paddingBottom: 6 }}>
                {rows.map(r => (
                  <div key={r.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 12.5 }}>
                    <span><span style={{ color: 'var(--text-muted)', fontFamily: 'var(--cond)', textTransform: 'uppercase', letterSpacing: .5, fontSize: 11 }}>{r.key}</span> · {surname(r.a.name)} & {surname(r.b.name)}</span>
                    <span style={{ color: r.g >= 25 ? 'var(--text-positive)' : r.g < 5 ? 'var(--text-negative)' : 'var(--text-secondary)', fontWeight: 600 }}>
                      {t('matchday.partTogether', { n: r.g, tier: r.tier })}
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
          <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
            <div className="fact-label">{t('matchday.rotationTitle')}</div>
            <div className="meta">
              {comp?.type !== 'league'
                ? t('matchday.rotCup')
                : t('matchday.rotTurnaround', { n: gapDays })}
              {rotFlagged.length >= 5
                /* half a squad's worth of names with percentages was a wall
                   (owner: "the assistant rotation plan is very messy") - the
                   XV below already shows every man's fitness, so past four the
                   plan says the count and the button does the work */
                ? t('matchday.rotSummary', { n: rotFlagged.length })
                : t('matchday.rotFlagged', {
                  men: rotFlagged.map(p => t('matchday.rotMan', { player: p.name, why: rotReason(p) })).join(', '),
                  count: rotFlagged.length === 2 ? t('matchday.rotBoth') : t('matchday.rotAll', { n: rotFlagged.length }),
                })}
            </div>
            <button className="btn ghost block" style={{ marginTop: 8 }} onClick={rotateXV}>
              {t('matchday.rotButton', { n: rotFlagged.length })}
            </button>
          </div>
        )}
        <SectionTitle sub={sel != null
          ? t('matchday.moving', { player: game.players[tac.lineup[sel] ?? -1]?.name ?? t('matchday.emptySlot') })
          : t('matchday.tapSwapHint')}>{t('matchday.yourXV')}</SectionTitle>
        {/* forwards left, backs right, exactly as the Tactics team sheet does it.
            The same information was laid out two different ways one screen apart. */}
        <div className="xv-split">
          <table className="dtable"><tbody>{XV_SLOTS.slice(0, 8).map((_, i) => renderSlot(i))}</tbody></table>
          <table className="dtable"><tbody>{XV_SLOTS.slice(8).map((_, i) => renderSlot(8 + i))}</tbody></table>
        </div>
        <SectionTitle sub={t(SPLIT_BY_ID[splitFor(club)]?.name ?? '').toLowerCase()}>{t('selection.replacements')}</SectionTitle>
        <div className="xv-split">
          <table className="dtable"><tbody>{seats.slice(0, 4).map((_, i) => renderSlot(15 + i))}</tbody></table>
          <table className="dtable"><tbody>{seats.slice(4).map((_, i) => renderSlot(19 + i))}</tbody></table>
        </div>
        </>}

        {ptab === 'talk' && <>
        <SectionTitle sub={t('matchday.dressingRoomSub')}>{t('matchday.dressingRoom')}</SectionTitle>
        <div className="speech-grid">
          {SPEECHES.map(s => (
            <button key={s.id} className={`speech-tile${speech === s.id ? ' sel' : ''}`}
              onClick={() => setSpeech(speech === s.id ? null : s.id)}>
              <span className="ico">{s.icon}</span>
              <b>{t(s.name)}</b>
              <span className="d">{t(s.desc)}</span>
            </button>
          ))}
        </div>
        </>}

        <div className="btn-row" style={{ marginTop: 10 }}>
          <button className="btn gold block" style={{ fontSize: 16, width: '100%' }} onClick={tryKickOff}>
            {t(view === 'instant' ? 'matchday.instantResult' : view === 'highlights' ? 'matchday.kickOffHighlights' : 'matchday.kickOff')}
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
              <SectionTitle sub={t('matchday.talkModalSub', { home: teamShort(game, club.id), away: teamShort(game, opp) })}>
                {t('matchday.theDressingRoom')}
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
                    <b>{t(sp.name)}</b>
                    <span className="d">{t(sp.desc)}</span>
                  </button>
                ))}
              </div>
              <button className="btn ghost block" style={{ marginTop: 8 }}
                onClick={() => { setTalkDone(true); setTalkOpen(false); goDownTheTunnel(null) }}>
                {t('matchday.sayNothing')}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)' }}>
          <span>{mine.toFixed(1)}</span><b style={{ color: 'var(--info)' }}>{label}</b><span>{theirs.toFixed(1)}</span>
        </div>
        <div style={{ height: 8, background: 'var(--border-strong)', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
          <div style={{ width: `${pct}%`, background: 'var(--primary)' }} />
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
            <h1>{t('matchday.testMatch', { nat })}</h1>
            <div className="date">{comp?.name ?? (fx.compId === 'fr' ? t('matchday.clubFriendly') : '')}{fx.stage ? ` · ${stageName(fx.stage)}` : ''} · {fixtureDate(game.season, fx.week, fx.id)}</div>
          </div>
        </div>
      </header>
      <main className="content">
        <div className="card center">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 4 }}>
            <CrestT g={game} teamId={fx.homeId} size={40} />
            <span style={{ fontFamily: 'var(--cond)', fontWeight: 700, fontSize: 15, color: 'var(--text-muted)', letterSpacing: 2 }}>{t('matchday.vs')}</span>
            <CrestT g={game} teamId={fx.awayId} size={40} />
          </div>
          <h3 style={{ fontSize: 19 }}>{t('matchday.vsLine', { home: teamShort(game, fx.homeId), away: teamShort(game, fx.awayId) })}</h3>
          <div className="meta">{t('matchday.intlLine')}</div>
        </div>
        <SectionTitle sub={t('matchday.h2hNation')}>{t('matchday.headToHead')}</SectionTitle>
        {bar(t('matchday.h2hScrum'), myUnits.scrum, oppUnits.scrum)}
        {bar(t('matchday.h2hLineout'), myUnits.lineout, oppUnits.lineout)}
        {bar(t('matchday.h2hBreakdown'), myUnits.breakdown, oppUnits.breakdown)}
        {bar(t('matchday.h2hAttack'), myUnits.attack, oppUnits.attack)}
        {bar(t('matchday.h2hDefence'), myUnits.defence, oppUnits.defence)}

        <SectionTitle sub={sel != null
          ? t('matchday.moving', { player: game.players[myLineup[sel] ?? -1]?.name ?? t('matchday.emptySlot') })
          : t('matchday.tapSwapHintTest')}>{t('matchday.yourTestXV')}</SectionTitle>
        <div className="tblwrap"><table className="dtable"><tbody>
          {XV_SLOTS.map((s, i) => {
            const pid = myLineup[i]
            const p = pid != null ? game.players[pid] : null
            return (
              <tr key={i} onClick={() => tapSlot(i)} className={sel === i ? 'held-row' : undefined}>
                <td className="num" style={{ fontFamily: 'monospace', fontWeight: 700 }}>{s.shirt}</td>
                <td><PosBadge pos={s.pos} /></td>
                <td className="name">{p?.name ?? <span className="muted">{t('matchday.tapToPick')}</span>}</td>
                <td>{p && <Stars ca={effAt(p, s.pos)} />}</td>
              </tr>
            )
          })}
        </tbody></table></div>
        <SectionTitle>{t('matchday.testBench')}</SectionTitle>
        <div className="tblwrap"><table className="dtable"><tbody>
          {BENCH_SLOTS.map((s, i) => {
            const slot = 15 + i
            const pid = myLineup[slot]
            const p = pid != null ? game.players[pid] : null
            return (
              <tr key={slot} onClick={() => tapSlot(slot)} className={sel === slot ? 'held-row' : undefined}>
                <td className="num" style={{ fontFamily: 'monospace', fontWeight: 700 }}>{s.shirt}</td>
                <td><PosBadge pos={s.pos[0]} /></td>
                <td className="name">{p?.name ?? <span className="muted">{t('matchday.tapToPick')}</span>}</td>
                <td>{p && <Stars ca={effAt(p, s.pos[0])} />}</td>
              </tr>
            )
          })}
        </tbody></table></div>
        {pickSlot != null && (
          <div className="modal-veil" onClick={() => setPickSlot(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="grab" />
              <SectionTitle sub={t('matchday.testSquadSub')}>
                {t('matchday.pickerTitle', { pos: posName(pickSlot < 15 ? XV_SLOTS[pickSlot].pos : BENCH_SLOTS[pickSlot - 15].pos[0]) })}
              </SectionTitle>
              <table className="dtable"><tbody>
                {availablePlayers(game, rosterOf(game, nat), true)
                  .sort((a, b) => effAt(b, pickSlot < 15 ? XV_SLOTS[pickSlot].pos : BENCH_SLOTS[pickSlot - 15].pos[0]) - effAt(a, pickSlot < 15 ? XV_SLOTS[pickSlot].pos : BENCH_SLOTS[pickSlot - 15].pos[0]))
                  .map(p => (
                    <tr key={p.id} onClick={() => setSlot(pickSlot, p.id)}
                      style={myLineup.includes(p.id) ? { opacity: .55 } : undefined}>
                      <td><PosBadge pos={p.pos} /></td>
                      <td className="name">{p.name}{myLineup.includes(p.id) ? t('matchday.selected') : ''}</td>
                      <td><Stars ca={p.ca} /></td>
                      <td className="num">{Math.round(p.cond)}%</td>
                    </tr>
                  ))}
              </tbody></table>
            </div>
          </div>
        )}

        <SectionTitle sub={t('matchday.dressingRoomSub')}>{t('matchday.dressingRoom')}</SectionTitle>
        <div className="speech-grid">
          {SPEECHES.map(s => (
            <button key={s.id} className={`speech-tile${speech === s.id ? ' sel' : ''}`}
              onClick={() => setSpeech(speech === s.id ? null : s.id)}>
              <span className="ico">{s.icon}</span>
              <b>{t(s.name)}</b>
              <span className="d">{t(s.desc)}</span>
            </button>
          ))}
        </div>
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button className="btn gold block" style={{ fontSize: 16, width: '100%' }} onClick={() => setConfirm(true)}>
            {t('matchday.kickOff')}
          </button>
        </div>
        <div className="spacer" />
      </main>
      {confirm && (
        <div className="modal-veil" onClick={() => setConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="grab" />
            <h3 style={{ fontSize: 17, margin: '4px 0 8px' }}>{t('matchday.readyNation', { nat })}</h3>
            <div className="meta">{t('matchday.anthems')}</div>
            {/* the viewing choice sits here, not at the foot of a team sheet (F5) */}
            <ViewPicker view={view} onPick={setView} />
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn ghost" onClick={() => setConfirm(false)}>{t('matchday.notYet')}</button>
              <button className="btn gold" style={{ flex: 1.5, fontSize: 15 }}
                onClick={() => {
                  setConfirm(false)
                  if (view === 'instant') instantResult(speech ?? undefined)
                  else kickOff(speech ?? undefined, view)
                }}>
                {t(view === 'instant' ? 'matchday.letHimTakeIt' : 'matchday.takeField')}
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
  { label: 'matchday.spdSlow', ms: 900, name: 'matchday.spdSlowName' },
  { label: 'matchday.spdNormal', ms: 350, name: 'matchday.spdNormalName' },
  { label: 'matchday.spdFast', ms: 90, name: 'matchday.spdFastName' },
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
  TRY: 'matchday.banTRY', PEN: 'matchday.banPEN', DG: 'matchday.banDG', CON: 'matchday.banCON',
  YC: 'matchday.banYC', RC: 'matchday.banRC', INJ: 'matchday.banINJ',
}

function PitchViz({ ctx, game, last, ballLeft, fxKey, showFx, showBig, lastTeamC, tickMs }: {
  ctx: LiveCtx
  game: ReturnType<typeof useStore.getState>['game'] & object
  last: MatchEvent | undefined
  ballLeft: number
  fxKey: number
  showFx: boolean
  /** score banners still fire at fast-forward speeds */
  showBig: boolean
  lastTeamC: [string, string]
  /** the live beat in ms - how long until the next minute replaces every
   *  position on this pitch. The dots' travel is derived from it so a man
   *  ARRIVES before he is sent somewhere else; see --tick in theme.css. */
  tickMs: number
}) {
  const fx = ctx.fx
  const homeC = game!.clubs[fx.homeId]?.colors ?? ['var(--gold-fill)', 'var(--ramp-g9)']
  const awayC = game!.clubs[fx.awayId]?.colors ?? ['var(--ramp-n4)', 'var(--prop-white)']
  const min = last?.min ?? 0
  const evType = last?.type
  const towardHome = last?.teamId === fx.homeId
  const scoringFx = evType === 'TRY' || evType === 'PEN' || evType === 'DG' || evType === 'CON'
  const kickFx = evType === 'PEN' || evType === 'CON' || evType === 'DG'
  const banner = evType && (showFx || (showBig && scoringFx)) ? BANNER[evType] : undefined
  // The event says what it depicts (MatchEvent.fx, set in matchEngine's
  // DEPICTS). What follows is the way it used to be worked out - regular
  // expressions over the line's stored English - and it is kept ONLY for
  // events from a save written before the field existed. A career lives for
  // years and its match events live with it.
  //
  // The patterns run on `text` rather than eventText() and that is deliberate:
  // the stored English is the same in every language, so an old save draws its
  // pitch for a French reader too. What it cannot do is be right - "slow every
  // scrum reset" drew a scrum - which is what the field fixes going forward.
  const txt = last?.text ?? ''
  const legacyFx = (): MatchEvent['fx'] | null =>
    /scrum/i.test(txt) ? 'SCRUM'
      : /lineout|against the throw/i.test(txt) ? 'LINEOUT'
      : /maul/i.test(txt) ? 'MAUL'
      : /wide/i.test(txt) ? 'MISS'
      : null
  const depicts = last ? (last.k ? last.fx ?? null : legacyFx()) : null
  const setPiece = showFx && evType === 'SUB' && depicts !== 'MISS' ? depicts : null
  const kickMiss = evType === 'SUB' && depicts === 'MISS'
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
      // what each man is DOING between repositions (theme.css, v1.1.4):
      // ruckers work the breakdown (the jog, sped right up), attacking backs
      // make staggered support runs onto the ball, everyone defending steps up
      // and off as one line, and non-rucking forwards jog on the spot. The
      // carrier and the scorer keep their own animations.
      const motion = scorerRun ? (isHome ? ' run-r' : ' run-l')
        : hl ? ''
        : ruck ? ' jog'
        : attacking && slot >= 8 ? ' supp'
        : !attacking ? ' dline'
        : ' jog'
      // supp and dline own their duration in CSS (it rides --tick); the jog
      // keeps its per-shirt spread, faster at the ruck than in midfield
      const timing: CSSProperties = motion === ' jog'
        ? {
            animationDuration: ruck ? `${1.05 + (slot % 3) * 0.25}s` : `${2.2 + (slot % 5) * 0.35}s`,
            animationDelay: `-${((slot * 0.41) % 2.2).toFixed(2)}s`,
          }
        : motion === ' supp'
        ? { animationDelay: `-${((slot * 0.53) % 1.6).toFixed(2)}s` }
        : {}
      return (
        <div key={id}
          className={`pdot${hl ? ' hl' : ''}${capId === id ? ' cap' : ''}${motion}`}
          style={{
            left: `${x}%`, top: `${y}%`,
            background: cols[0], borderColor: cols[1], color: contrastText(cols[0]),
            '--adir': isHome ? 1 : -1,
            ...timing,
          } as CSSProperties}>
          {XV_SLOTS[slot].shirt}
          {hl && <span className="pname">{p.name.split(' ').slice(-1)[0]}</span>}
        </div>
      )
    })
  }

  return (
    <div className={`pitch${showFx && evType === 'TRY' ? (towardHome ? ' try-r' : ' try-l') : ''}`}
      style={{ '--tick': `${tickMs}ms` } as CSSProperties}>
      <div className="tryzone tz-l" style={{ left: 0, background: `linear-gradient(90deg, ${homeC[0]}cc, ${homeC[0]}55)` }} />
      <div className="tryzone tz-r" style={{ right: 0, background: `linear-gradient(270deg, ${awayC[0]}cc, ${awayC[0]}55)` }} />
      {[22, 50, 78].map(x => <div key={x} className="line" style={{ left: `${x}%` }} />)}
      {[36, 64].map(x => <div key={x} className="line dashed" style={{ left: `${x}%` }} />)}
      <div className="posts" style={{ left: '7%' }} />
      <div className="posts" style={{ right: '7%' }} />
      <div className="zone-label" style={{ left: '2.5%' }}>{clubCode(teamShort(game!, fx.homeId))}</div>
      <div className="zone-label" style={{ right: '2.5%' }}>{clubCode(teamShort(game!, fx.awayId))}</div>
      {dots(ctx.home, true)}
      {dots(ctx.away, false)}
      {/* ballTop, NOT a second copy of its fallback.
          ballTop (above) is the carrier's own row, and its comment says what it
          is for: "the ball is with the carrier instead of drifting on a sawtooth
          of its own". Every player already reads it - the ruckers converge on
          it, the carrier is pulled onto it - but the BALL re-derived the
          sawtooth `38 + ((min * 13) % 25)` inline, which is only ballTop's
          fallback for the case where nobody is carrying.
          So in the one situation the whole mechanism exists for - a carrier
          named in the commentary, which is exactly when a player is watching -
          thirty men converged on one row while the ball sat at an unrelated
          height. The ball was the only thing on the pitch that did not know
          where the ball was. */}
      <div key={kickFx && showFx ? `k${fxKey}` : 'ball'}
        className={`ball${kickFx && showFx ? (towardHome ? ' kick-r' : ' kick-l') : ''}`}
        style={{ left: `${ballLeft}%`, top: `${ballTop}%` }} />
      {setPiece && (
        <div key={`sp${fxKey}`} className={`setp${setPiece === 'MAUL' ? ' maul' : ''}`}
          style={{ left: `${ballLeft}%`, top: `${ballTop}%` }}>
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
          <span className="splabel">{t(`matchday.sp${setPiece}`)}</span>
        </div>
      )}
      {showFx && evType === 'TRY' && (
        <div key={`tb${fxKey}`} className="try-burst" style={{ left: towardHome ? '90%' : '10%' }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <i key={i} style={{
              background: i % 2 ? lastTeamC[0] : (lastTeamC[1] ?? 'var(--prop-white)'),
              ['--ang' as string]: `${i * 36}deg`,
            } as React.CSSProperties} />
          ))}
        </div>
      )}
      {kickCam && (
        <div key={`kc${fxKey}`} className={`kickcam${kickMiss ? ' miss' : ''}`}>
          <span className="kc-post l" /><span className="kc-post r" /><span className="kc-bar" />
          <span className="kc-ball" />
          <span className="kc-verdict">{t(kickMiss ? 'matchday.kickWide' : 'matchday.kickGood')}</span>
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
          {t(banner)}
        </div>
      )}
    </div>
  )
}

function contrastText(bg: string): string {
  const hex = bg.replace('#', '')
  if (hex.length < 6) return 'var(--prop-ink)'
  const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 140 ? 'var(--prop-ink-dark)' : 'var(--prop-ink)'
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
    setInjury({ hurt: hurt.name, desc: injuryDesc(hurt.injury), weeks, coverId: coverEv?.playerId ?? null })
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

  // TERRITORY IS MOMENTUM (v1.1.1).
  //
  // This used to be `50 + dir * (10 + min % 20)` - a sawtooth on the CLOCK.
  // The ball crept up the field for twenty minutes, snapped back, and did it
  // again, and none of it had the faintest thing to do with the match being
  // played. The owner watched four games live and said so: "it should reflect
  // momentum and possession".
  //
  // The engine has always known. ctx.momo is a real, tuned figure - possession
  // delta with a 0.62 decay, shoved 0.3 by a howler - and the scoreboard draws
  // it as a needle two centimetres above this pitch. So read it:
  //
  //   territory  50 + momo * 30   where the pressure is (20..80)
  //   nudge      +-9              whose work THIS event was
  //
  // +1 momo is home dominant and home attacks right, so the signs already
  // agree with the try-zone colours. Scores stay decisive and unchanged: a try
  // is at 88/12 because that is where tries happen.
  const ballLeft = useMemo(() => {
    if (!last) return 50
    const towardHome = last.teamId === fixture.homeId
    const base = last.type === 'TRY' ? (towardHome ? 88 : 12)
      : last.type === 'PEN' || last.type === 'DG' ? (towardHome ? 72 : 28)
      : 50 + (ctx.momo ?? 0) * 30 + (towardHome ? 9 : -9)
    return Math.max(6, Math.min(94, base))
  }, [cursor])

  // TENSION IS LATE **AND** CLOSE (v1.1.1), a product and deliberately so:
  // 3-0 at 20 minutes is not tense, and neither is 40-3 at 78. Both terms
  // have to be true, and either one alone reads as nothing.
  const tension = useMemo(() => {
    if (done || !last) return 0
    const late = Math.max(0, Math.min(1, (min - 55) / 25))   // nothing before the hour
    const close = Math.max(0, Math.min(1, 1 - Math.abs(hs - as) / 14)) // one score is 7
    return late * close
  }, [min, hs, as, done, last])

  // The heartbeat, and the one thing tension actually buys: the beat between
  // revealed events stretches by up to 60% when the game is late and close.
  // The clock will not hurry when you want it to, which is the whole of "make
  // you edgy". It never SHORTENS - that would race a probe and rob a rout of
  // its own pace - and Fast is left exactly alone, because a manager who has
  // asked the game to hurry up is not asking for drama.
  // THE BEAT ITSELF, hoisted out of the effect so the PITCH can be told what it
  // is. The men on the pitch move by CSS transition, and a transition only
  // looks like running if it FINISHES before the next minute replaces its
  // target. It did not: the transition was a flat 1.1s against a beat of 350ms
  // at Normal, so every new position landed while the previous move was a third
  // done, the browser restarted from wherever the dot had got to, and the dot
  // never once arrived anywhere. Fifteen men permanently two-thirds of the way
  // to somewhere is not a shape, and no amount of easing fixes a duration that
  // is three times its own cadence.
  // So the beat is the number, and theme.css divides it (see --tick).
  const tickMs = Math.round(SPEEDS[speedIdx].ms * (speedIdx < 2 ? 1 + 0.6 * tension : 1))

  useEffect(() => {
    if (!playing) return
    // `timer`, not `t`: t() is the translator
    const timer = setTimeout(() => advanceLive(), tickMs)
    return () => clearTimeout(timer)
  }, [cursor, playing, speedIdx, events.length, tension])

  const cls = (e: MatchEvent) =>
    e.type === 'TRY' || e.type === 'FT' || e.type === 'DG' ? 'big'
      : e.type === 'YC' ? 'card-y'
      : e.type === 'RC' ? 'card-r'
      : e.type === 'INJ' ? 'inj' : ''

  const icon = (e: MatchEvent) => ({
    TRY: '🏉', CON: '🎯', PEN: '🥅', DG: '🎯', YC: '🟨', RC: '🟥', INJ: '🩹', HT: '⏸', FT: '🏁', KO: '⏱', SUB: '·', BRK: '💧',
  }[e.type] ?? '·')

  const homeC = game.clubs[fixture.homeId]?.colors ?? ['var(--gold-fill)', 'var(--ramp-g9)']
  const awayC = game.clubs[fixture.awayId]?.colors ?? ['var(--gold-fill)', 'var(--ramp-g9)']
  // Half-time and the 60' break are the two states where the match is stopped
  // waiting for the manager rather than paused. The control row treats them as
  // one thing: Play means "get back out there".
  const atInterval = atHalfTime || atBreak
  const intervalLabel = t(atHalfTime ? 'matchday.secondHalf' : 'matchday.finalQuarter')
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
          {/* A FRIENDLY HAS NO COMPETITION, and this line used to print the
              separator anyway: "57' ·  · 💨 Wind", with a hole where the name
              would be. The dot belongs to the thing after it. */}
          {done ? t('matchday.fullTime') : atHalfTime ? t('matchday.halfTime') : atBreak ? t('matchday.breakSixty') : `${Math.min(80, min)}'`}
          {game.comps[fixture.compId]?.short ? ` · ${game.comps[fixture.compId]?.short}${fixture.stage ? ` ${stageName(fixture.stage)}` : ''}` : ''}
          {fixture.weather && fixture.weather !== 'Dry' ? ` · ${WEATHER_ICON[fixture.weather]} ${weatherWord(fixture.weather)}` : ''}
          {fixture.att ? ` · 👥 ${fixture.att.toLocaleString()}` : ''}
          {/* say so, or a ticker that skips the quiet minutes looks broken (F5) */}
          {live.mode === 'highlights' && !done ? t('matchday.highlightsTag') : ''}
        </div>
        {!done && (() => {
          const win = (ctx.momoHist ?? []).slice(-3)
          // no history yet means no measurement: a half-filled bar at 0' reads
          // as "possession is even" when nothing has happened at all
          const live = win.length > 0
          const share = live ? win.reduce((s, x) => s + x, 0) / win.length : 0.5
          const ref = refFor(fixture.id)
          const binAt = ref.style === 'strict' ? 4 : ref.style === 'lenient' ? 7 : 5
          // THE -fill FORMS, because these numbers sit on the hero gradient.
          // The sc-score comment above tells this exact story: --gold goes
          // deep brown in day mode and measured 1:1 up here - the sin-bin
          // warning count, invisible to anybody who taps the sun icon - and
          // --danger has the same disease in both modes (1.0-1.8:1). Found
          // by nightcontrast the first run after it learned to name names.
          const penC = (n: number) => n >= binAt ? 'var(--danger-fill)' : n === binAt - 1 ? 'var(--gold-fill)' : undefined
          return (
            <div className="last10">
              <span className="l10-pens" title={t('matchday.pensTitle')}>
                ⚠ <b style={{ color: penC(ctx.home.consPens) }}>{ctx.home.consPens}</b>
              </span>
              {/* the flanking numbers are penalties conceded, and a phone cannot
                  hover a tooltip to find that out - so the label says it */}
              <span className="l10-label">{t(live ? 'matchday.penPossLabel' : 'matchday.penAwaiting')}</span>
              <div className="l10-bar" title={t('matchday.ballTitle')} style={live ? undefined : { opacity: .35 }}>
                <div className="l10-home" style={{ width: `${Math.round(share * 100)}%`, background: homeC[0] }} />
                <div className="l10-away" style={{ background: awayC[0] }} />
                <div className="momo-needle" style={{ left: `${50 + ctx.momo * 44}%` }} />
              </div>
              <span className="l10-pens" title={t('matchday.pensTitle')}>
                <b style={{ color: penC(ctx.away.consPens) }}>{ctx.away.consPens}</b> ⚠
              </span>
            </div>
          )
        })()}
        {/* THE SCREEN SAYS SO. Above 0.45 the game names what this now is: a
            one-score match inside the closing quarter. Static, not a pulse -
            prefers-reduced-motion collapses every duration in this codebase
            (motionprobe holds that line), so anything that lives only in
            movement is information some players never get. */}
        {/* WHAT SKIP JUST DECIDED FOR YOU. The owner: "ive played 4 games now
            with no decision making coming like kick for goal etc? is that
            feature still included?" It was - 2.5 kickable penalties a match,
            measured over forty of them - but Skip answers every one of them at
            the posts and had never once said so. A feature that only ever
            happens silently, on your behalf, is a feature nobody has. */}
        {!!live.skipTook && (
          <div className="skip-took">{t('matchday.skipTook', { n: live.skipTook })}</div>
        )}
        {!done && tension > 0.45 && (
          <div className="tense-band">
            {t(Math.abs(hs - as) === 0 ? 'matchday.tenseLevel'
              : Math.abs(hs - as) <= 3 ? 'matchday.tenseKick'
                : 'matchday.tenseScore', { n: Math.max(1, 80 - min) })}
          </div>
        )}
      </div>

      {done && ctx.userSideId && (() => {
        const isHome = ctx.userSideId === fixture.homeId
        const us = isHome ? hs : as
        const them = isHome ? as : hs
        const kind = us > them ? 'w' : us < them ? 'l' : 'd'
        return (
          <div className={`ft-stamp ${kind}`} key={`stamp-${fixture.id}`}>
            <b>{t(us > them ? 'matchday.victory' : us < them ? 'matchday.defeat' : 'matchday.drawn')}</b>
            <span>{hs} - {as}</span>
          </div>
        )
      })()}

      {!panelActive && (
        <PitchViz ctx={ctx} game={game} last={last} ballLeft={ballLeft}
          fxKey={cursor} showFx={showFx} showBig={playing} lastTeamC={lastTeamC}
          tickMs={tickMs} />
      )}
      {!panelActive && (
        <div className="now-strip">
          {last && (
            <div key={cursor} className={`now-line ${cls(last)}`}>
              <span className="min">{Math.min(80, last.min)}'</span>
              <span className="txt">{icon(last)} {eventText(last)}</span>
            </div>
          )}
        </div>
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
            title={atInterval ? intervalLabel : atDecision ? t('matchday.callFirst') : t(playing ? 'matchday.pause' : 'matchday.resume')}
            aria-label={atInterval ? intervalLabel : t(playing ? 'matchday.pause' : 'matchday.resume')}
            onClick={() => {
              if (atInterval) { leaveInterval(); return }
              matchCursor(cursor, !playing)
            }}>
            {playing ? '❚❚' : '▶'} <span className="ctrl-cap">{atInterval ? intervalLabel : t(playing ? 'matchday.pause' : 'matchday.play')}</span>
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
            }}>{t('matchday.skip')}</button>
        )}
        {/* Squad, not "Touchline" (user: "rather than touchline ... have it as
            squad selection so you click it and can make changes"). The panel it
            used to open was a tactics drawer with a substitution list buried in
            it; this goes straight to the match-day squad, which is what anyone
            pressing it wants. Tactics still live behind the same panel via the
            drawer button on the squad sheet. */}
        {!done && ctx.seg < 3 && (
          <button className={`btn ${sheet ? 'gold' : 'ghost'}`} style={{ flex: 1.2 }}
            title={t('matchday.squadTitle')}
            aria-label={t('matchday.squadTitle')}
            onClick={() => {
              matchCursor(cursor, false)
              setSettings(false)
              setDrawer(false)
              setSheet(true)
            }}>👥 <span className="ctrl-cap">{t('matchday.squadBtn')}</span></button>
        )}
        <button className={`btn ${settings ? 'gold' : 'ghost'}`} style={{ flex: '0 0 46px' }}
          title={t('matchday.settingsTitle')} aria-label={t('matchday.settingsTitle')}
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
          title={t('matchday.injOff', { player: injury.hurt })}
          hurtName={injury.hurt}
          hurtDesc={t('matchday.injDesc', { desc: injury.desc, n: injury.weeks })}
          note={t('matchday.injNote')}
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
            <h3 style={{ fontSize: 16, margin: '2px 0 8px' }}>{t('matchday.matchSettings')}</h3>
            <div className="set-label">{t('matchday.commentarySpeed')}</div>
            <div className="btn-row">
              {SPEEDS.map((s, i) => (
                <button key={i} className={`btn ${i === speedIdx ? 'gold' : 'ghost'}`} style={{ flex: 1 }}
                  title={t(s.name)} onClick={() => setSpeedIdx(i)}>{t(s.label)}</button>
              ))}
            </div>
            <div className="set-label">{t('matchday.tickerStops')}</div>
            <div className="btn-row">
              <button className={`btn ${live.mode === 'full' ? 'gold' : 'ghost'}`} style={{ flex: 1 }}
                onClick={() => matchMode('full')}>{t('matchday.everyMinute')}</button>
              <button className={`btn ${live.mode === 'highlights' ? 'gold' : 'ghost'}`} style={{ flex: 1 }}
                onClick={() => matchMode('highlights')}>{t('matchday.highlightsBtn')}</button>
            </div>
            {/* One switch, and it has to name everything it turns off. The buzz
                used to survive Silent, so the label lied by omission. */}
            <div className="set-label">{t('matchday.soundAndBuzz')}</div>
            <button className="btn ghost block" onClick={() => setSound(toggleSound())}>
              {t(sound ? 'matchday.soundOn' : 'matchday.soundOff')}
            </button>
            <button className="btn gold block" style={{ marginTop: 10 }}
              onClick={() => { setSettings(false); if (!done) matchCursor(cursor, true) }}>
              {t(done ? 'matchday.close' : 'matchday.backToMatch')}
            </button>
          </div>
        </div>
      )}

      {panelActive && (
      <div className="content ticker panel-area" ref={tickerRef}>
        {atDecision && <DecisionPanel />}
        {drawer && paused && !done && !atDecision && (
          <TouchlinePanel title={t('matchday.pausedTitle')} showTalk={false} onResume={() => { setDrawer(false); matchCursor(cursor, true) }} resumeLabel={t('matchday.resumePlay')} />
        )}
        {(atHalfTime || atBreak) && (
          <TouchlinePanel
            title={t(atBreak ? 'matchday.breakTitle' : 'matchday.halfTimeTitle')}
            showTalk={atHalfTime}
            onResume={() => { setDrawer(false); useStore.getState().startSecondHalf() }}
            resumeLabel={t(atBreak ? 'matchday.playFinalQuarter' : 'matchday.startSecondHalf')}
          />
        )}
        {/* THE STORY SO FAR (audit 20E). A touchline decision or the interval
            used to leave two-thirds of the screen empty while the game stood
            still - the one moment a manager actually has time to read. So the
            stoppage tells the story: every score so far with the running
            total, and for a league afternoon the table around you as it stood
            at kick-off. All of it is read from state already on this screen -
            no rng, no engine. */}
        {(atDecision || atHalfTime || atBreak) && (() => {
          const scores = shown.filter(e => e.type === 'TRY' || e.type === 'PEN' || e.type === 'DG')
          const comp = game.comps[fixture.compId]
          const order = comp?.type === 'league' && comp.id === game.clubs[game.userClubId]?.leagueId
            ? sortTable(comp.table) : null
          const me = order ? order.findIndex(r => r.teamId === game.userClubId) : -1
          const slice = order && me >= 0 && order[me].p > 0
            ? order.slice(Math.max(0, Math.min(me - 1, order.length - 4)), Math.max(0, Math.min(me - 1, order.length - 4)) + 4)
            : null
          return (
            <>
              <div className="card" style={{ margin: '8px 14px' }}>
                <div className="fact-label">{t('matchday.storySoFar')}</div>
                {scores.length === 0 && <div className="meta muted">{t('matchday.noScores')}</div>}
                {scores.map((e, i) => (
                  <div key={i} className="meta" style={{ display: 'flex', gap: 8 }}>
                    <span className="muted" style={{ flex: '0 0 26px' }}>{Math.min(80, e.min)}'</span>
                    <span style={{ flex: 1 }}>{icon(e)} {e.playerId != null ? game.players[e.playerId]?.name ?? teamShort(game, e.teamId ?? '') : teamShort(game, e.teamId ?? '')}</span>
                    <b>{e.homeScore}-{e.awayScore}</b>
                  </div>
                ))}
              </div>
              {slice && (
                <div className="card" style={{ margin: '8px 14px' }}>
                  <div className="fact-label">{t('matchday.asItStood')}</div>
                  {slice.map(r => {
                    const p = order!.indexOf(r) + 1
                    const usRow = r.teamId === game.userClubId
                    return (
                      <div key={r.teamId} className="meta" style={{ display: 'flex', gap: 8, fontWeight: usRow ? 700 : 400 }}>
                        <span className="muted" style={{ flex: '0 0 22px' }}>{p}</span>
                        <span style={{ flex: 1 }}>{teamShort(game, r.teamId)}</span>
                        <b>{t('matchday.ptsShort', { n: r.pts })}</b>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )
        })()}
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
                {t(showRatings ? 'matchday.hideRatings' : 'matchday.showRatings')}
              </button>
              <button className="btn ghost" onClick={() => setShowLog(!showLog)}>
                {showLog ? t('matchday.hideCommentary') : t('matchday.showCommentary', { n: shown.length })}
              </button>
            </div>
            {showRatings && <RatingsPanel />}
            {showLog && shown.map((e, i) => (
              <div key={i} className={`tick-event ${cls(e)}`}>
                <span className="min">{e.min}'</span>
                <span className="txt">{icon(e)} {eventText(e)}</span>
              </div>
            ))}
            <button className="btn gold block" style={{ margin: '10px 14px 14px' }} onClick={finishMatch}>
              {t('matchday.continueToResults')}
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
      id: 'posts' as const, icon: '🥅', name: t('matchday.optPosts'),
      desc: t(diff < 0 && diff >= -3 ? 'matchday.optPostsDLead' : 'matchday.optPostsD',
        { kicker: kicker ? kicker.name : t('matchday.yourKicker') }),
    },
    {
      id: 'corner' as const, icon: '🚀', name: t('matchday.optCorner'),
      desc: t('matchday.optCornerD'),
    },
    {
      id: 'tap' as const, icon: '⚡', name: t('matchday.optTap'),
      desc: t('matchday.optTapD'),
    },
  ]

  return (
    <div className="card" style={{ margin: '12px 0', borderLeft: '4px solid var(--danger)' }}>
      <h3 style={{ fontSize: 15 }}>{t('matchday.penCall')}</h3>
      <div className="meta" style={{ marginBottom: 8 }}>
        {t('matchday.penScore', { home: teamShort(game, mine.teamId), hs: mine.score, as: opp.score, away: teamShort(game, opp.teamId) })}
        {diff < 0 ? t('matchday.penBehind', { n: -diff }) : diff > 0 ? t('matchday.penAhead', { n: diff }) : t('matchday.penLevel')}
        {t('matchday.penMin', { min: ctx.lastMin })}
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {options.map(o => (
          <button key={o.id} className="btn ghost" style={{ textAlign: 'left', padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'center' }}
            onClick={() => decide(o.id)}>
            <span style={{ fontSize: 20 }}>{o.icon}</span>
            <span>
              <b style={{ display: 'block', fontSize: 13.5 }}>{o.name}</b>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{o.desc}</span>
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
  // `possTotal`, not `t`: t() is the translator (src/game/i18n.ts), and a local
  // called t here would shadow it silently - everything still typechecks
  const possTotal = ctx.home.poss + ctx.away.poss || 1
  const myPoss = Math.round(((mine === ctx.home ? ctx.home.poss : ctx.away.poss) / possTotal) * 100)
  const feedback = t(margin > 0
    ? (myPoss < 45 ? 'matchday.vdWonNoBall'
      : margin >= 20 ? 'matchday.vdRuthless'
      : 'matchday.vdHabit')
    : margin === 0
      ? 'matchday.vdDraw'
      : (myPoss >= 55 ? 'matchday.vdWasted'
        : margin <= -20 ? 'matchday.vdBeaten'
        : 'matchday.vdMargins'))
  // The verdict used to stop at the sentence above, which names nothing (user:
  // "it should outline what the two fixes would be etc so the player can keep
  // tweaking the tactics"). game/coachfix reads the same match data and turns it
  // into two instructions that each point at a real control.
  const myClub = game.clubs[mine.teamId]
  const fixes = coachFixes(game, ctx, mine, opp, myClub?.tactic ?? null, 2)
  const units = unitBattles(ctx, mine, opp)

  // ---- MARKING LAST WEEK'S HOMEWORK (C2) ----------------------------------
  //
  // The audit's read was that the two fixes were a lecture rather than a loop:
  // the coach names two jobs, the manager does them or ignores them, and nothing
  // ever refers to it again. So the tags from the last full time are kept on the
  // save, and this compares them with what the coach can still complain about.
  //
  // Read BEFORE the effect below overwrites it, and stale records are dropped: a
  // grade against a game six weeks and a transfer window ago is not a grade, it
  // is a non sequitur. Cup runs and international weeks mean "next match" is not
  // always next week, hence four rather than one.
  const hw = game.fixHw
  const fresh = !!hw && hw.fxId !== live.fixture.id && hw.season === game.season && game.week - hw.week <= 4
  const grade = fresh && hw
    ? gradeFixes(hw.tags as FixTag[], fixes.map(f => f.tag))
    : { fixed: [], missed: [] }
  const verdictOnLast = gradeLine(grade.fixed, grade.missed)

  // and then this match's two become the homework. Written once per fixture by
  // the store, because this card re-renders on every tick.
  const noteFixes = useStore.getState().noteFixes
  const fxId = live.fixture.id
  const tags = fixes.map(f => f.tag).join(',')
  useEffect(() => { noteFixes(fxId, tags ? tags.split(',') as FixTag[] : []) }, [fxId, tags, noteFixes])
  return (
    <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
      {star && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="fact-label">{t('matchday.starPlayer')}</div>
            {/* THE CLUB CODE, both sides. It read "(yours)" for your own man and the
                opponent's full short name for theirs, so the same slot carried two
                different kinds of thing (user: "next to sleightholme (yours) should
                be team unitials so NOR"). NOR and NEW, the same codes the crest and
                the touchline use. */}
            <b>{star.name}</b>{' '}
            <span className="muted">({clubCode(teamShort(game, starMine ? mine.teamId : opp.teamId))})</span>
          </div>
          <span className="form-pill" style={{ background: 'var(--text-positive)', fontSize: 15 }}>
            {ctx.motmId != null ? (mine.ratings.get(ctx.motmId) ?? opp.ratings.get(ctx.motmId) ?? 7).toFixed(1) : ''}
          </span>
        </div>
      )}
      <div className="fact-label" style={{ marginTop: 8 }}>{t('matchday.coachsVerdict')}</div>
      <div className="meta">{feedback}</div>

      {verdictOnLast && (
        <div className={`fix-grade${grade.missed.length === 0 ? ' good' : ''}`}>
          {grade.missed.length === 0 ? '✅ ' : '📋 '}{verdictOnLast}
        </div>
      )}

      {fixes.length > 0 && (
        <>
          <div className="fact-label" style={{ marginTop: 8 }}>
            {t(fixes.length === 1 ? 'matchday.theFix' : 'matchday.theTwoFixes')} <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{t('matchday.beforeSaturday')}</span>
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

      <div className="fact-label" style={{ marginTop: 8 }}>{t('matchday.unitBattlesTitle')}</div>
      {units.map(({ key, label, pct, verdict }) => {
        const color = pct >= 52 ? 'var(--text-positive)' : pct <= 48 ? 'var(--text-negative)' : undefined
        // the verdict is a token, not a phrase: 'we edged it' and 'ils l'ont
        // emporté de peu' put the subject in different places, so each whole
        // half-sentence is its own key
        return (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: '1px solid var(--border)', fontSize: 12.5 }}>
            <span style={{ color: 'var(--text-secondary)' }}>{t(label)}</span>
            <span><b style={{ color, fontFamily: 'var(--cond)', fontSize: 14 }}>{pct}%</b>
              <span className="muted">{t(`matchday.uw${verdict[0].toUpperCase()}${verdict.slice(1)}`)}</span>
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
    <div className="card" style={{ margin: '12px 0', borderLeft: '4px solid var(--gold)' }}>
      <h3 style={{ fontSize: 14 }}>{t('matchday.highlightsTitle')}</h3>
      {picks.map((e, i) => (
        <div key={i} className="meta" style={{ padding: '3px 0' }}>
          <b style={{ fontFamily: 'var(--cond)' }}>{e.min}'</b> - {eventText(e)}
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
      <b style={{ width: 34, textAlign: 'right', fontFamily: 'var(--cond)', fontSize: 15 }}>{v[0]}{pct ? '%' : ''}</b>
      <span style={{ flex: 1, textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--cond)', textTransform: 'uppercase', letterSpacing: 1, fontSize: 12 }}>{label}</span>
      <b style={{ width: 34, fontFamily: 'var(--cond)', fontSize: 15 }}>{v[1]}{pct ? '%' : ''}</b>
    </div>
  )
  return (
    <div className="card" style={{ margin: '12px 0' }}>
      <h3 style={{ fontSize: 14, textAlign: 'center' }}>
        {t('matchday.statsTitle', { home: teamShort(game, live.fixture.homeId), away: teamShort(game, live.fixture.awayId) })}
      </h3>
      {row(t('matchday.stPossession'), st.possession, true)}
      {row(t('matchday.stTries'), st.tries)}
      {row(t('matchday.stScrums'), [st.scrumsWon[0], st.scrumsWon[1]])}
      {row(t('matchday.stLineouts'), [st.lineoutsWon[0], st.lineoutsWon[1]])}
      {row(t('matchday.stTackles'), st.tackles)}
      {row(t('matchday.stPens'), st.pens)}
      {row(t('matchday.stCards'), st.cards)}
      {row(t('matchday.stEnergy'), st.energy, true)}
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
  // THE SETTLED MARK ONCE THERE IS ONE. mine.ratings is the running in-match
  // accumulator; finalizeMatch adds the result, the margin and the spread and
  // files THAT against the season, the player's form and Player of the Month.
  // Rendering the accumulator meant the manager read 6.0 off a 75-7 win while a
  // different number went into the record. finalR is absent until full time, so
  // a half-time peek still shows the live marks.
  const rows = [...(mine.finalR ?? mine.ratings).entries()]
    .map(([id, r]) => ({ p: game.players[id], r }))
    .filter(x => x.p)
    .sort((a, b) => b.r - a.r)
  return (
    <div className="card" style={{ margin: '0 0 12px' }}>
      <h3 style={{ fontSize: 14 }}>{t('matchday.yourRatings')}</h3>
      <table className="dtable"><tbody>
        {rows.map(({ p, r }) => (
          <tr key={p!.id}>
            <td><PosBadge pos={p!.pos} /></td>
            <td className="name">{p!.name}{ctx.motmId === p!.id ? ' ⭐' : ''}</td>
            <td className="num" style={{ fontWeight: 700, color: r >= 7.5 ? 'var(--text-positive)' : r < 5.5 ? 'var(--text-negative)' : undefined }}>
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
      advice.push(cover
        ? t('matchday.adviceTiredCover', { player: p!.name, word: condWord(e), cover: cover.name, pos: posName(p!.pos) })
        : t('matchday.adviceTired', { player: p!.name, word: condWord(e) }))
    }
  }
  const min = ctx.tick * 4
  if (min >= 45) {
    const poor = [...mine.ratings.entries()]
      .map(([id, r]) => ({ p: game.players[id], r }))
      .filter(x => x.p && mine.onPitch.has(x.p.id) && x.r < 4.6)
      .sort((a, b) => a.r - b.r)[0]
    if (poor) advice.push(t('matchday.advicePoor', { player: poor.p!.name, rating: poor.r.toFixed(1) }))
  }
  for (const e of live.events.slice(0, live.cursor)) {
    if (e.type === 'YC' && e.playerId != null && mine.onPitch.has(e.playerId) && (mine.yellowUntil.get(e.playerId) ?? 0) <= min) {
      const p = game.players[e.playerId]
      if (p) advice.push(t('matchday.adviceCard', { player: p.name }))
      break
    }
  }

  const talks = [
    ['fire', 'matchday.talkFire'],
    ['calm', 'matchday.talkCalm'],
    ['demand', 'matchday.talkDemand'],
    ['praise', 'matchday.talkPraise'],
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
        <div style={{ margin: '6px 0 2px', padding: '8px 10px', background: 'color-mix(in srgb, var(--gold) 14%, var(--surface-1))', borderRadius: 8 }}>
          <div className="fact-label">{t('matchday.assistantNotes')}</div>
          {advice.slice(0, 3).map((a, i) => (
            <div key={i} className="meta" style={{ marginTop: 3 }}>{a}</div>
          ))}
        </div>
      )}
      <StatsPanel />
      {showTalk && (!ctx.talkUsed ? (
        <>
          <div className="fact-label" style={{ marginTop: 4 }}>{t('matchday.teamTalk')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
            {talks.map(([k, label]) => (
              <button key={k} className="btn ghost" style={{ fontSize: 12.5, padding: '9px 6px' }}
                onClick={() => teamTalk(k)}>{t(label)}</button>
            ))}
          </div>
        </>
      ) : live.talkMsg && (
        <div className="meta" style={{ margin: '6px 0' }}>{live.talkMsg}</div>
      ))}

      {isClubMatch && <>
      <div className="fact-label" style={{ marginTop: 12 }}>{t('matchday.quickPlans')}</div>
      <div className="preset-row">
        {PRESETS.map(p => (
          <button key={p.id} className="preset-chip" title={t(p.desc)}
            onClick={() => { applyPreset(p.values); setExplain(`${p.icon} ${t(p.name)}: ${t(p.desc)}`) }}>
            {p.icon} {t(p.name)}
          </button>
        ))}
      </div>

      <div className="fact-label" style={{ marginTop: 10 }}>{t('matchday.inMatchTactics')} <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{t('matchday.tapAName')}</span></div>
      {SLIDER_INFO.map(s => (
        <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
          <span style={{ width: 78, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--cond)', textTransform: 'uppercase', letterSpacing: .5, cursor: 'pointer' }}
            onClick={() => setExplain(`${t(s.label)}: ${sliderReadout(s.key, club.tactic[s.key])}`)}>
            {t(s.label)}
          </span>
          <input type="range" min={0} max={100} value={club.tactic[s.key]} style={{ flex: 1, accentColor: 'var(--primary)' }}
            onChange={e => { club.tactic[s.key] = Number(e.target.value); liveTactics(); touch() }} />
        </div>
      ))}
      {explain && <div className="meta" style={{ margin: '6px 0' }}>{explain}</div>}
      </>}

      {/* One button into the match-day squad, where several changes can be made
          in one visit. This used to be two dropdowns and a Make button: one sub
          per trip, no shirt numbers, no sight of who was carrying a knock. */}
      <div className="fact-label" style={{ marginTop: 12 }}>{t('matchday.replacementsLeft', { left: MAX_SUBS - ctx.subsUsed, max: MAX_SUBS })}</div>
      <button className="btn ghost block" style={{ marginTop: 6 }} disabled={ctx.subsUsed >= MAX_SUBS}
        onClick={() => setSquadOpen(true)}>
        {t(ctx.subsUsed >= MAX_SUBS ? 'matchday.allChangesUsed' : 'matchday.makeReplacements')}
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
 *  tap one then the other to make a change, and keep going until the bench is
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
  const { halfTimeSub, injuryCover, undoSub, swapPositions } = useStore.getState()
  const [offId, setOffId] = useState<number | null>(freeCoverId ?? null)
  const [freeLeft, setFreeLeft] = useState(freeCoverId != null)
  const [log, setLog] = useState<string[]>([])
  // COUNT THE CHANGES, do not count the lines about them. The Done button used to
  // read log.length, and log is a display list capped with .slice(0, 4) - so a
  // fifth change still said "4 changes made" (user: "when you make more than 4
  // substitution it says you've made 4 subs"). It was wrong in the other direction
  // too: "keeps the shirt" goes in the log and is not a change. A number the player
  // reads has to come from the thing itself, not from a list that was trimmed to
  // fit. Per visit, so it is not derivable from ctx.subsUsed - that counts the
  // whole match, and a free injury swap does not burn one at all.
  const [made, setMade] = useState(0)

  const ctx = live.ctx
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  const left = MAX_SUBS - ctx.subsUsed

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

  // Swapping the injury cover is free and does not burn one of them, so it
  // routes through injuryCover rather than a normal substitution.
  const isFreeSwap = freeLeft && offId != null && offId === freeCoverId
  const doSub = (inP: Player) => {
    if (offId == null) return
    const msg = isFreeSwap ? injuryCover(offId, inP.id) : halfTimeSub(offId, inP.id)
    if (isFreeSwap) setFreeLeft(false)
    // the display list holds the whole bench now rather than four of it, because a
    // log that quietly drops entries is what made the count wrong in the first place
    setLog(l => [msg, ...l].slice(0, MAX_SUBS))
    setMade(n => n + 1)
    setOffId(null)
  }

  // a forced stop is satisfied by any change, including keeping the assistant's
  // man - tapping him again is a decision, it is just the same decision
  const settled = !mustDecide || log.length > 0 || !freeLeft
  return (
    <div className="modal-veil" onClick={() => { if (settled) onClose() }}>
      <div className="modal squad-sheet" onClick={e => e.stopPropagation()}>
        <div className="grab" />
        {/* THE WHOLE BRIEF STICKS, not just the title.
            The title was made sticky on its own after a screenshot showed the
            sheet scrolled down to the bench with the heading off the top, so the
            manager was being asked to replace a man the screen no longer named.
            That fixed the name and left the instruction behind: reported from a
            live game, "she could see the team xv but couldnt see the text above
            it". Measured at 412x640 the hint sat 215px above the top of the
            screen once the list was scrolled far enough to reach the bench.
            The hint is the one line that CHANGES as you tap - it goes from "tap a
            man on the pitch" to "Ollie Sleightholme is coming off, now tap his
            replacement" - so it is the one line that must never be off screen.
            All three ride together in one sticky block. */}
        <div className="sheet-top">
          <div className="sheet-head">
            <h3>{title ?? t('matchday.matchDaySquad')}</h3>
            <span className="meta">{t('matchday.changesLeft', { n: left })}</span>
          </div>
          {/* who is hurt, named in his own line rather than buried in a
              paragraph of instructions */}
          {hurtName && (
            <div className="sheet-casualty">
              🏥 <b>{hurtName}</b>{t('matchday.casualty')}{hurtDesc ? t('matchday.casualtyDesc', { desc: hurtDesc }) : ''}
            </div>
          )}
          <div className="meta sheet-hint">
            {note ? <>{note}{' '}</> : null}
            {isFreeSwap && off ? t('matchday.hintFree', { player: off.name })
              : off ? t('matchday.hintArmed', { player: off.name })
              : left <= 0 ? t('matchday.hintNoneLeft')
              : t('matchday.hintTap')}
          </div>
        </div>
        <div className="sheet-cols">
          <div className="sheet-col">
            <div className="fact-label">{t('matchday.onThePitch')}</div>
            {xv.map(({ shirt, p }) => {
              const on = mine.onPitch.has(p.id)
              const e = Math.round(mine.energy.get(p.id) ?? 70)
              const r = mine.ratings.get(p.id)
              const binned = (mine.yellowUntil.get(p.id) ?? 0) > ctx.tick * 4
              // the free injury swap stays available even with the bench emptied
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
                      // no setMade here on purpose: keeping the assistant's man is a
                      // decision, which settles the forced stop, but it is not a change
                      setLog(l => [t('matchday.keepsShirt', { player: p.name }), ...l].slice(0, MAX_SUBS))
                      setOffId(null)
                      return
                    }
                    // a second on-pitch tap is a positional switch (16B, user:
                    // "swap the 12 and 13 over"): free, burns nothing
                    if (offId != null && offId !== p.id && !isFreeSwap && mine.onPitch.has(offId) && on) {
                      const msg = swapPositions(offId, p.id)
                      setLog(l => [msg, ...l].slice(0, MAX_SUBS))
                      setOffId(null)
                      return
                    }
                    setOffId(offId === p.id ? null : p.id)
                  }}>
                  <span className="sh-num">{shirt}</span>
                  {/* the position, not just the shirt (Round 27, user: "it
                      should have their positions"). The bench column has always
                      said what a man is; the pitch column made you know the
                      numbering by heart to work out who you were taking off. */}
                  <span className="sh-pos">{p.pos}</span>
                  <span className="sh-name">{p.name}</span>
                  {binned && <span className="sh-flag" title={t('matchday.inTheBin')}>🟨</span>}
                  {p.injury && <span className="sh-flag" title={t('matchday.injuredFlag')}>🏥</span>}
                  {/* A man off the pitch who is neither binned nor hurt was sent
                      off - a substituted man leaves the lineup entirely, so this
                      is the only remaining way to be gone. Without the flag his
                      row was just dead grey with no reason on it, which is how
                      subreach failed one suite run and taught the sheet to say
                      why (round 23). */}
                  {!on && !binned && !p.injury && <span className="sh-flag" title={t('matchday.sentOff')}>🟥</span>}
                  {r != null && <span className="sh-rate">{r.toFixed(1)}</span>}
                  {/* THE NUMBER, NOT THE WORD (Round 27, user: "percentage
                      rather than words"). 25D-2 put the assistant's phrasing in
                      here for the fog of war and it was wrong twice over: this
                      column is 32px, built for "43%", so "out on his feet"
                      wrapped to four lines and tore the row open; and this is
                      the screen where the substitution is actually decided, so
                      it is the one place that wants a hard number rather than a
                      feel. The words keep their home in the assistant's read
                      below, where they are commentary rather than an input. */}
                  <span className={`sh-nrg ${e < 25 ? 'red' : e < 50 ? 'amber' : ''}`}>{e}%</span>
                </button>
              )
            })}
          </div>
          <div className="sheet-col">
            <div className="fact-label">{off ? t('matchday.benchCover', { pos: posName(off.pos) }) : t('matchday.bench')}</div>
            {benchSorted.length === 0 && <div className="meta">{t('matchday.benchEmpty')}</div>}
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
                    <span className="sh-flag" title={t(BRIEF_BY_ID[brief].name)}>{BRIEF_BY_ID[brief].icon}</span>
                  )}
                  {off && covers(p) && <span className="sh-flag" title={t('matchday.naturalCover')}>✓</span>}
                  <span className="sh-rate">{p.ca}</span>
                </button>
              )
            })}
          </div>
        </div>
        {log.map((m, i) => <div key={i} className="meta sheet-log">{m}</div>)}
        {/* the wrong tap can be taken back at the same stoppage (16B, user:
            "i made a substitution but selected the wrong player, i couldnt
            undo it"). Only the LAST change, and only until play resumes. */}
        {ctx.lastSub && (
          <button className="btn ghost block" onClick={() => {
            const msg = undoSub()
            setLog(l => [msg, ...l].slice(0, MAX_SUBS))
            setMade(n => Math.max(0, n - 1))
            setOffId(null)
          }}>{t('matchday.takeBack')}</button>
        )}
        {mustDecide && !settled && (
          <div className="meta sheet-log" style={{ color: 'var(--danger)', fontWeight: 700 }}>
            {t('matchday.mustDecide')}
          </div>
        )}
        <div className="btn-row" style={{ marginTop: 8 }}>
          {onTactics && (
            <button className="btn ghost" onClick={onTactics}>{t('matchday.tacticsBtn')}</button>
          )}
          <button className="btn gold" style={{ flex: 1.6 }} disabled={!settled} onClick={onClose}>
            {made ? t('matchday.doneChanges', { n: made })
              : t(settled ? 'matchday.backToMatch' : 'matchday.nameFirst')}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * THE ASSISTANT'S EYE, NOT A TELEMETRY FEED (25D-2, from the fog-of-war idea
 * the user liked: reports instead of exact bars). A coach on the touchline
 * does not know a man is at 43% - he knows he is tiring. The exact number is
 * gone from every per-player readout: the word and a five-band gauge are what
 * the assistant can honestly tell you. Deterministic bands, no rng.
 */
export function condWord(e: number): string {
  return t(e >= 85 ? 'matchday.cwFresh' : e >= 70 ? 'matchday.cwGoingWell' : e >= 55 ? 'matchday.cwBlowing'
    : e >= 40 ? 'matchday.cwTiring' : e >= 25 ? 'matchday.cwEmpty' : 'matchday.cwSpent')
}

/** The assistant's condition report on the XV, most worrying first. */
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
      <div className="fact-label">{t('matchday.assistantsEye')}</div>
      {rows.map(({ p, e }) => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0', fontSize: 11.5 }}>
          <span style={{ width: 120, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
          <div style={{ flex: 1, height: 7, background: 'var(--border-strong)', borderRadius: 4, overflow: 'hidden' }}>
            {/* the true width, not a banded one: a gauge that rounds to fifths
                is a gauge that quietly lies, and the number sits beside it */}
            <div style={{ width: `${e}%`, height: '100%', background: e < 25 ? 'var(--text-negative)' : e < 50 ? 'var(--gold)' : 'var(--text-positive)' }} />
          </div>
          <span style={{ width: 118, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            <b>{Math.round(e)}%</b> <span style={{ opacity: .7, fontStyle: 'italic' }}>{condWord(e)}</span>
          </span>
        </div>
      ))}
    </div>
  )
}
