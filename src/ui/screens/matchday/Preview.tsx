// The pre-match screen for a club fixture.

import { useMemo, useState } from 'react'
import { useStore } from '../../../store'
import { analystArmed } from '../../../game/rewarded'
import { rewardedAvailable } from '../../../game/monetise'
import {
  teamShort, teamUnits, paperOverall, rosterOf, assistantJudgement, autoSelect, availablePlayers, refFor, refNotes, homeCrowdLean, frontRowCover,
  repairSheet,
} from '../../../game/matchEngine'
import { MIDWEEK_OFF, CHEM_SLOTS, XV_SLOTS, careerRows, chemKey, chemTier, fixtureDate, fixtureDayOff, grudgeBetween, inRedZone, oldBoyApps, type Player, type Pos } from '../../../game/model'
import { BRIEF_BY_ID, SPLIT_BY_ID, benchSeats, briefForSeat, splitFor } from '../../../game/bench'
import { matchConditions, surfKey, surfaceNote, surfaceOf, wxEffectKey } from '../../../game/conditions'
import { effAt } from '../../../game/attributes'
import { fuzzedCa } from '../../../game/scout'
import type { SliderKey } from '../../../game/tactics'
import { ord, posName, t, compLabel } from '../../../game/i18n'
import { subjectVar } from '../../../game/gender'
import { formerFacing, formersAlso } from '../../../game/memory'
import { CrestT, Jersey, PosBadge, SectionTitle, Stars, RewardedButton, availabilityTag } from '../../components'
import { stageName } from '../Home'
import { MoodTable } from '../../MoodTable'
import { talkSetting } from '../../../game/teamtalk'
import { isDerby } from '../../../game/rivalries'
import { derbyName } from '../../../game/rivalries'
import { matchStakes } from '../../../game/stakes'
import { dialLine, philosophyOf } from '../../../game/philosophy'
import { venueEffect } from '../../../game/venue'
import { sortTable } from '../../../game/schedule'
import { Glyph } from '../../glyphs'
import { rowNavTr } from '../../rowNav'
import { SPEECHES, type SpeechId, ViewPicker } from './prematch'
import { WEATHER_ICON, weatherWord } from './weather'

export function Preview({ fxId }: { fxId: number }) {
  const game = useStore(s => s.game)!
  useStore(s => s.tick)
  const { kickOff, instantResult, back, touch } = useStore.getState()
  const [speech, setSpeech] = useState<SpeechId | null>(null)
  const [pickSlot, setPickSlot] = useState<number | null>(null)
  const [sel, setSel] = useState<number | null>(null)
  const [confirm, setConfirm] = useState(false)
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
  // the room as the talk will find it (teamtalk.ts): the same paper strengths
  // the engine reads at kick-off, so the moods are the ones that answer
  const room = {
    s: talkSetting(paperOverall(game, game.userClubId, tac.lineup), paperOverall(game, opp, oppLineup),
      isHome, !!fx.stage || isDerby(fx.homeId, fx.awayId)),
    fxId: fx.id,
  }

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

  // Touch interaction: tap to pick up, tap again to swap; double-tap = picker
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
    // every shirt has two, but too few different men for it (Law 3.5: six
    // front-rowers in a 23, a prop who plays both sides counted once)
    warnings.push({ level: 'bad', text: missing ? t('matchday.warnScrum', { missing }) : t('matchday.warnScrumFew', { n: frontRow.players, need: frontRow.need }) })
  }
  // milestone watch: pre-announce the numbers worth playing for today
  for (const pid of tac.lineup.slice(0, 15)) {
    const pl = pid != null ? game.players[pid] : null
    if (!pl) continue
    const cTries = careerRows(pl).reduce((s, c) => s + c.tries, 0) + pl.stats.tries + (pl.hist?.tries ?? 0)
    const cApps = careerRows(pl).reduce((s, c) => s + c.apps, 0) + pl.stats.apps + (pl.hist?.apps ?? 0)
    const cPts = careerRows(pl).reduce((s, c) => s + c.points, 0) + pl.stats.points + (pl.hist?.points ?? 0)
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
  // a start promised in the press room (handshake.ts): a competitive match
  // without him in the XV is the promise broken
  if (fx.compId !== 'fr' && !fx.devSide) {
    for (const pl of game.pledges ?? []) {
      const p = pl.kind === 'start' && pl.season === game.season ? game.players[pl.playerId] : null
      if (p && p.clubId === club.id && !problem(p) && !tac.lineup.slice(0, 15).includes(p.id)) {
        warnings.push({ level: 'warn', text: t('matchday.warnPromise', { player: p.name }) })
      }
    }
  }

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
    // A REPAIR COSTS THE BROKEN SHIRTS, NOT THE SIDE (1.8.15). This re-picked
    // the whole twenty-three through the assistant's imperfect eye, so one
    // injured flanker cost a first-time player eight starters and his captain
    // - and the dressing room then blamed HIM for dropping the captain, because
    // the sheet it wrote was his. The note promises a repair, so it repairs:
    // every fit man keeps his shirt and only the unfit ones are filled
    // (repairSheet, the same thing kick-off does). Only when that still leaves
    // the scrum short does the assistant re-pick from scratch.
    const repaired = repairSheet(game, club, tac.lineup, splitFor(club))
    // (frontRow above is this same repaired sheet's front-row read)
    const sound = repaired.every((id, i) => i >= 15 && id == null ? true : !problem(id != null ? game.players[id] ?? null : null))
    if (sound && frontRow.legal) return repaired
    // his re-pick, his eye: the tunnel fix is the assistant working, so it
    // carries assistantJudgement like every side he names
    const picked = autoSelect(game, availablePlayers(game, club.players), splitFor(club), assistantJudgement(game))
    for (let i = 0; i < 15; i++) {
      const p = picked[i] != null ? game.players[picked[i]!] : null
      if (problem(p)) return null // crisis: even the assistant cannot field 15 fit men
    }
    return picked
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
  // THE DAY ITSELF (conditions.ts): the fixture's conditions by a hash of
  // where and when it is played, so the forecast is what the match will get
  const forecast = matchConditions(game, fx)
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
  // APPLIED ONCE PER READ, AND THE SAVE REMEMBERS (1.8.1). The guard was a
  // component flag, so leaving Matchday and coming back re-armed the button
  // and each press added the same nudges again, up to the 5 to 95 clamp. The
  // fixture and how many reads were applied now live on the save: coming back
  // finds it done, and an analyst's all-nighter bought afterwards applies only
  // the reads he added, not the assistant's three a second time.
  const appliedN = game.planApplied?.fx === fx.id ? game.planApplied.n : 0
  const planApplied = appliedN >= gamePlan.length
  const applyPlan = () => {
    for (const p of gamePlan.slice(appliedN)) {
      for (const [k, dv] of Object.entries(p.d) as [SliderKey, number][]) {
        tac[k] = Math.max(5, Math.min(95, tac[k] + dv))
      }
    }
    game.planApplied = { fx: fx.id, n: gamePlan.length }
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
    if (view === 'instant') instantResult(sp ?? undefined, true)
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
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
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
      <tr key={slot} {...rowNavTr(() => tapSlot(slot))}
        className={`${prob ? 'prob-row' : ''}${sel === slot ? ' held-row' : ''}`}>
        <td className="num" style={{ fontFamily: 'monospace', fontWeight: 700, width: 26 }}>{shirt}</td>
        <td style={{ width: 38 }}><PosBadge pos={pos} /></td>
        <td className="name">
          {p ? p.name : <span className="muted">{t('matchday.tapToPick')}</span>}
          {/* the squad list's own short tags, in the player's language: the
              sheet printed the internal code ("INTL DUTY") in all six */}
          {prob && p && <span style={{ color: 'var(--text-negative)', fontSize: '0.6875rem', fontWeight: 700 }}> {prob === 'GONE' ? t('common.goneTag') : availabilityTag(p, game.week)?.txt ?? prob}</span>}
          {!prob && p && (p.rust ?? 0) > 0 && <span style={{ color: 'var(--gold)', fontSize: '0.6875rem', fontWeight: 700 }}> {t('matchday.rusty')}</span>}
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
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- tap-outside-to-close veil, and Escape closes it (a11y.ts); the sheet has its own buttons
      <div className="modal-veil" onClick={() => setPickSlot(null)}>
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- swallows taps inside the sheet so it stays open; not a control */}
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="grab" />
          <SectionTitle sub={t('matchday.pickerSub', { shirt: pickSlot < 15 ? XV_SLOTS[pickSlot].shirt : seats[pickSlot - 15].shirt })}>
            {t('matchday.pickerTitle', { pos: posName(pos) })}
          </SectionTitle>
          <table className="dtable"><tbody>
            {pool.map(p => (
              <tr key={p.id} {...rowNavTr(() => setSlot(pickSlot, p.id))}
                style={tac.lineup.includes(p.id) ? { opacity: .55 } : undefined}>
                <td><PosBadge pos={p.pos} /></td>
                <td className="name">{p.name}{tac.lineup.includes(p.id) ? t('matchday.selected') : ''}
                  {(p.rust ?? 0) > 0 && <span style={{ color: 'var(--gold)', fontSize: '0.6875rem', fontWeight: 700 }}> {t('matchday.rustyW', { n: p.rust ?? 0 })}</span>}
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
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- tap-outside-to-close veil, and Escape closes it (a11y.ts); the sheet has its own buttons
      <div className="modal-veil" onClick={() => setConfirm(false)}>
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- swallows taps inside the sheet so it stays open; not a control */}
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="grab" />
          <div style={{ padding: '0 18px 4px' }}>
            <h3 style={{ fontSize: '1.125rem', margin: '2px 0 8px', textAlign: 'center' }}>{t('matchday.readyTitle')}</h3>
            {warnings.length === 0 && (
              <div className="meta" style={{ margin: '6px 0', textAlign: 'center' }}>{t('matchday.readyOk')}</div>
            )}
            {warnings.length > 0 && (
              <div style={{ maxHeight: '34vh', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10, padding: '2px 10px' }}>
                {warnings.map((w, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 8, padding: '6px 0', fontSize: '0.8125rem', lineHeight: 1.4,
                    color: w.level === 'bad' ? 'var(--text-negative)' : w.level === 'warn' ? 'var(--gold)' : 'var(--text-secondary)',
                    borderBottom: i < warnings.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <span><Glyph name={w.level === 'bad' ? 'stop' : w.level === 'warn' ? 'warning' : 'info'} /></span>
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
              <button className="btn gold" style={{ flex: 1.5, fontSize: '1rem' }}
                onClick={() => {
                  if (hasBad && fixedLineup) { tac.lineup = fixedLineup; touch() }
                  setConfirm(false)
                  if (view === 'instant') instantResult(speech ?? undefined, true)
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
          <button className="back-btn" onClick={back} aria-label={t('common.backLabel')}><span aria-hidden="true">‹</span></button>
          <div style={{ flex: 1 }}>
            <h1>{t('matchday.mdTitle')}</h1>
            <div className="date">{compLabel(comp?.name) ?? (fx.compId === 'fr' ? t('matchday.clubFriendly') : '')}{fx.stage ? ` · ${stageName(fx.stage)}` : ''} · {fixtureDate(game.season, fx.week, fx.id, fx.midweek ? MIDWEEK_OFF : undefined)}</div>
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
            <span style={{ fontFamily: 'var(--cond)', fontWeight: 700, fontSize: '1rem', color: 'var(--text-muted)', letterSpacing: 2 }}>{t('matchday.vs')}</span>
            {game.clubs[fx.awayId] && <Jersey club={game.clubs[fx.awayId]} size={54} />}
            <CrestT g={game} teamId={fx.awayId} size={38} />
          </div>
          <div className="mday-facts">
          <h3 style={{ fontSize: '1.125rem' }}>{t('matchday.vsLine', { home: teamShort(game, fx.homeId), away: teamShort(game, fx.awayId) })}</h3>
          <div className="meta"><Glyph name="stadium" /> {fx.venue
            ? t('matchday.venueNeutral', { name: fx.venue.name, city: fx.venue.city })
            : home ? t('matchday.venueHome', { stadium: home.stadium, city: home.city }) : t('common.neutralVenue')}</div>
          {/* THE DERBY IS NOT A FOOTNOTE ON THE WEATHER. It used to be glued to
              the forecast behind a middle dot, so on a phone the two ran
              together and wrapped into a centred red blob (owner screenshot,
              25 Aug: "tidy up the text next to weather forecast"). The
              forecast is a fact; the derby is the reason you are nervous.
              Separate lines, and the derby carries its own mark. */}
          <div className="meta" style={{ marginTop: 3 }}>
            <Glyph name={WEATHER_ICON[forecast]} /> {t('matchday.forecast', { weather: weatherWord(forecast) })}
          </div>
          {derbyName(fx.homeId, fx.awayId) && (
            <div className="meta derby-line" style={{ marginTop: 4 }}>
              <Glyph name="derby" /> <b>{t('matchday.derbyTag', { derby: derbyName(fx.homeId, fx.awayId) ?? '' })}</b>
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
            .sort((a, b) => fuzzedCa(game, b!) - fuzzedCa(game, a!))[0]
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
                    {t('matchday.finalBody', { comp: compLabel(game.comps[fx.compId]?.name) ?? t('matchday.finalTrophy') })}
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
                    <div className="fact-label"><Glyph name="derby" /> {dn}</div>
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
              {/* INFORMATION HIERARCHY (1.8.6): what it is for and who can hurt
                  you, then the matchup and the plan you can apply, then the
                  day itself, then the history and the men you know. The
                  Apply button used to sit under eleven cards. */}
              {danger && (
                <div className="card" style={{ borderLeft: '4px solid var(--danger)' }}>
                  <div className="fact-label">{t('matchday.dangerMan')}</div>
                  <div className="meta">
                    <b>{danger.name}</b>{t('matchday.dangerBody', { pos: danger.pos, club: oppClub?.short ?? t('matchday.theyShort') })}
                  </div>
                </div>
              )}
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
                    <RewardedButton place="matchday" style={{ marginTop: 6, fontSize: '0.8125rem' }}
                      label={t('till.watchAnalyst', { n: allPlans.length - gamePlan.length, ...subjectVar(game.analystGender) })}
                      onDone={out => {
                        if (out === 'completed') rewardAnalyst()
                        else setSpotMsg(t(out === 'skipped' ? 'till.spotSkipped' : 'till.spotUnavailable'))
                      }} />
                  )}
                  {fullRead && <div className="meta" style={{ marginTop: 6, color: 'var(--gold)' }}>{t('till.analystDone')}</div>}
                  {spotMsg && <div className="meta sheet-log" style={{ marginTop: 6, borderLeft: '3px solid var(--gold)', paddingLeft: 8 }}>{spotMsg}</div>}
                </div>
              )}
              {(() => {
                // His actual opinions, not a bucket label. This used to read
                // "a stickler" or "firm but fair", which told you nothing you
                // could pick a back row around.
                const ref = refFor(fx.id)
                const notes = refNotes(ref)
                // the ground's, not the referee's (matchEngine.homeCrowdLean)
                if (homeCrowdLean(game, fx) >= 0.03) notes.push(t('matchday.refCrowd', { team: teamShort(game, fx.homeId) }))
                // THE CONDITIONS (1.8.2 depth): the man with the whistle, the
                // sky and the ground, on one card, each read off the fixture
                const surface = surfaceOf(game, fx)
                return (
                  <div className="card" data-conditions={`${forecast}/${surface}`}>
                    <div className="fact-label">{t('matchday.theConditions')}</div>
                    <div className="meta" style={{ marginBottom: 4 }}>
                      <b>{ref.name}</b>{t('matchday.refAppointed')}
                    </div>
                    {notes.map((n, i) => <div key={i} className="meta">· {n}</div>)}
                    {notes.length === 0 && <div className="meta">{t('matchday.refNothing')}</div>}
                    <div className="meta">· <Glyph name={WEATHER_ICON[forecast]} /> <b>{weatherWord(forecast)}.</b> {t(wxEffectKey(forecast))}</div>
                    <div className="meta">· <b>{t(surfKey(surface))}.</b> {t(surfaceNote(surface))}</div>
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
                        {/* THEY RESPECT YOU NOW (1.8.0, E9): the dials above are
                            already this week's plan for you (oppcoach.ts
                            setUpForUser); this says why, and what it goes after */}
                        {oppClub.vsUser && (
                          <div className="meta respect-line">
                            <b>{t('matchday.respectLine')}</b>
                            {oppClub.vsUser.unit && <> {t(`matchday.respectAt_${oppClub.vsUser.unit}`)}</>}
                          </div>
                        )}
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
                // THE MEN YOU LET GO (1.8.5, memory.ts formerFacing): how he
                // left and what he has done since, the boy sold before he
                // played included; the rest by their games for you
                const all = formerFacing(game, opp, oppLineup, Infinity)
                const formers = all.slice(0, 2)
                const also = formersAlso(all)
                const theirs = oppLineup
                  .map(id => id != null ? game.players[id] : null)
                  .filter((p): p is Player => !!p && oldBoyApps(p, game.userClubId) > 0 && !all.some(f => f.p.id === p.id))
                  .sort((a, b) => oldBoyApps(b, game.userClubId) - oldBoyApps(a, game.userClubId))
                const ours = tac.lineup
                  .map(id => id != null ? game.players[id] : null)
                  .filter((p): p is Player => !!p && oldBoyApps(p, opp) > 0)
                  .sort((a, b) => oldBoyApps(b, opp) - oldBoyApps(a, opp))
                if (!formers.length && !theirs.length && !ours.length) return null
                return (
                  <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
                    <div className="fact-label">{t('matchday.oldBoys')}</div>
                    {formers.map(f => (
                      <div key={f.p.id} className="meta" data-former={f.p.id}>{t(f.k, f.v)}</div>
                    ))}
                    {also && <div className="meta" data-former-also>{t(also.k, also.v)}</div>}
                    {theirs.slice(0, 3 - formers.length).map(p => (
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
                  .sort((a, b) => fuzzedCa(game, b) - fuzzedCa(game, a))[0]
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
                  const cApps = careerRows(p).reduce((s, c) => s + c.apps, 0) + p.stats.apps + (p.hist?.apps ?? 0)
                  const cTries = careerRows(p).reduce((s, c) => s + c.tries, 0) + p.stats.tries + (p.hist?.tries ?? 0)
                  const cPts = careerRows(p).reduce((s, c) => s + c.points, 0) + p.stats.points + (p.hist?.points ?? 0)
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
                        {' '}<span className="muted">({compLabel(game.comps[m.compId]?.short)})</span>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </>
          )
        })()}
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
                  <div key={r.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem' }}>
                    <span><span style={{ color: 'var(--text-muted)', fontFamily: 'var(--cond)', textTransform: 'uppercase', letterSpacing: .5, fontSize: '0.6875rem' }}>{r.key}</span> · {surname(r.a.name)} & {surname(r.b.name)}</span>
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
          <table className="dtable codefirst xvsheet"><tbody>{XV_SLOTS.slice(0, 8).map((_, i) => renderSlot(i))}</tbody></table>
          <table className="dtable codefirst xvsheet"><tbody>{XV_SLOTS.slice(8).map((_, i) => renderSlot(8 + i))}</tbody></table>
        </div>
        <SectionTitle sub={t(SPLIT_BY_ID[splitFor(club)]?.name ?? '').toLowerCase()}>{t('selection.replacements')}</SectionTitle>
        <div className="xv-split">
          <table className="dtable codefirst xvsheet"><tbody>{seats.slice(0, 4).map((_, i) => renderSlot(15 + i))}</tbody></table>
          <table className="dtable codefirst xvsheet"><tbody>{seats.slice(4).map((_, i) => renderSlot(19 + i))}</tbody></table>
        </div>
        </>}

        {ptab === 'talk' && <>
        <SectionTitle sub={t('mood.roomSub')}>{t('mood.room')}</SectionTitle>
        <MoodTable game={game} lineup={tac.lineup} room={room} />
        <SectionTitle sub={t('matchday.dressingRoomSub')}>{t('matchday.dressingRoom')}</SectionTitle>
        <div className="speech-grid talk-tones">
          {SPEECHES.map(s => (
            <button key={s.id} className={`speech-tile${speech === s.id ? ' sel' : ''}`}
              onClick={() => setSpeech(speech === s.id ? null : s.id)}>
              <span className="ico"><Glyph name={s.icon} /></span>
              <b>{t(s.name)}</b>
              <span className="d">{t(s.desc)}</span>
            </button>
          ))}
        </div>
        </>}

        <div className="btn-row" style={{ marginTop: 10 }}>
          <button className="btn gold block" style={{ fontSize: '1rem', width: '100%' }} onClick={tryKickOff}>
            {t(view === 'instant' ? 'matchday.instantResult' : view === 'highlights' ? 'matchday.kickOffHighlights' : 'matchday.kickOff')}
          </button>
        </div>
        <div className="spacer" />
      </main>
      {picker()}
      {readyModal()}
      {talkOpen && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- tap-outside-to-close veil, and Escape closes it (a11y.ts); the sheet has its own buttons
        <div className="modal-veil" onClick={() => setTalkOpen(false)}>
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- swallows taps inside the sheet so it stays open; not a control */}
          <div className="modal talk-modal" onClick={e => e.stopPropagation()}>
            <div className="grab" />
            <div style={{ padding: '0 12px 10px' }}>
              {/* THE FIXTURE IS NOT THE POINT OF THIS LINE. It used to read
                  "{home} v {away} - one speech, choose the tone", which is two
                  club names before it gets to the thing you actually have to
                  do, and on a phone the tone clause wrapped to a second line
                  (owner: "can you get the choose your tone on one line"). The
                  scoreboard, both crests and both names are on the screen this
                  modal opened from; the one new instruction is the speech. */}
              <SectionTitle sub={t('matchday.dressingRoomSub')}>
                {t('matchday.theDressingRoom')}
              </SectionTitle>
              {/* How you watch it (F5) lives here rather than at the foot of the
                  page. Measured: below the team sheet it sat 320px under the fold
                  on a 844x390 phone, which is exactly where Instant Result was
                  buried and nobody found it. This modal is the last thing before
                  the tunnel and has nothing above it. */}
              <ViewPicker view={view} onPick={setView} />
              {/* the room before you speak to it (1.8.0) */}
              <details className="mood-fold">
                <summary>{t('mood.room')}</summary>
                <MoodTable game={game} lineup={tac.lineup} room={room} />
              </details>
              <div className="speech-grid talk-tones" style={{ marginTop: 6 }}>
                {SPEECHES.map(sp => (
                  <button key={sp.id} className={`speech-tile${speech === sp.id ? ' sel' : ''}`}
                    onClick={() => {
                      setSpeech(sp.id); setTalkDone(true); setTalkOpen(false)
                      goDownTheTunnel(sp.id)
                    }}>
                    <span className="ico"><Glyph name={sp.icon} /></span>
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
