import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useStore } from '../../store'
import { analystArmed } from '../../game/rewarded'
import { rewardedAvailable } from '../../game/monetise'
import {
  matchStats, visitsTo22, goalKicker, teamShort, teamUnits, paperOverall, rosterOf, assistantJudgement, autoSelect, availablePlayers,
  refFor, refNotes, homeCrowdLean, frontRowCover, repairSheet, sideEnergy, MAX_SUBS, isFrontRower, needsFrontRower, type LiveCtx, type SideCtx,
  shirtNumber,
} from '../../game/matchEngine'
import { MIDWEEK_OFF, BENCH_SLOTS, CHEM_SLOTS, XV_SLOTS, careerRows, chemKey, clubCode, chemTier, eventText, injuryDesc, fixtureDate, fixtureDayOff, grudgeBetween, inRedZone, oldBoyApps, tieWinner, weekDate, type MatchEvent, type Player, type Pos } from '../../game/model'
import { BRIEF_BY_ID, SPLIT_BY_ID, benchSeats, briefForSeat, splitFor } from '../../game/bench'
import { BriefIcon } from '../tacticsArt'
import { assistantFixtureThisWeek, isKnockoutTie, userMatchThisWeek } from '../../game/season'
import { halfTimeHints, matchConditions, surfKey, surfaceNote, surfaceOf, wxEffectKey } from '../../game/conditions'
import {
  LEVERS, buildEvidence, readTold, toldCalls, halfFollow, halfSides, htEvidence, leverMoved, matchFollow, prevEvidence, rankWhy, whyLeads,
  type Follow, type WhyCause,
} from '../../game/evidence'
import { effAt } from '../../game/attributes'
import { fuzzedCa } from '../../game/scout'
import { PRESETS, SLIDER_INFO, sliderReadout, type SliderKey } from '../../game/tactics'
import { ord, posName, t, localeTag, compLabel } from '../../game/i18n'
import { subjectVar } from '../../game/gender'
import { coachFixes, gradeHomework, gradeLine, homeworkFor, unitBattles, type FixTag } from '../../game/coachfix'
import { formerDecided, formerFacing, formersAlso } from '../../game/memory'
import { MatchFindings } from '../OppReport'
import { currentPlan, planFollowed } from '../../game/oppreport'
import { ADAPT_WORTH } from '../../game/armsrace'
import { CrestT, Jersey, PosBadge, SectionTitle, Stars, RewardedButton, Toggle, availabilityTag } from '../components'
import { stageName } from './Home'
import { matchSfx, soundOn, toggleSound } from '../audio'
import { MoodTable } from '../MoodTable'
import { TalkReactions } from '../TalkReactions'
import { talkSetting, type HtTone, type PreTone } from '../../game/teamtalk'
import { isDerby } from '../../game/rivalries'
import { MatchPanels, Visits, Zones } from '../MatchPanels'
import { useTablet } from '../tablet'
import { readMatchPrefs, writeMatchPrefs, type MatchPrefs } from '../matchPrefs'
import { AdSlot } from '../AdSlot'
import { HighlightClip, buildClip, nextMoment, tokenColor, type ClipSpec } from '../HighlightClip'
import { derbyName } from '../../game/rivalries'
import { matchStakes } from '../../game/stakes'
import { dialLine, philosophyOf } from '../../game/philosophy'
import { venueEffect } from '../../game/venue'
import { sortTable } from '../../game/schedule'
import { nationName } from '../../game/nations'
import { kitColours, luma, pageSpares } from '../kit'
import { IcoFastForward, IcoPause, IcoPeople, IcoPlay } from '../icons'
import { Glyph } from '../glyphs'

const WEATHER_ICON: Record<string, string> = { Dry: 'sun', Damp: 'rain', Rain: 'rain', Wind: 'wind', Snow: 'snow' }

/** The forecast in words. The VALUE stays English everywhere it is stored or
 *  compared - the engine reads fixture.weather - and only the label moves. */
const weatherWord = (w: string): string => t(`matchday.wx${w}`)

/** How many lines the phone's commentary feed keeps in the DOM: the current
 *  one and enough older ones to fill the fixed box under its top fade. */
const FEED_ROWS = 5
/** The glide: about a third of the Normal beat (640ms), so a line has landed
 *  and been read for most of its beat before the next one moves it. */
const GLIDE_MS = 220

/** Motion is on for people (main.tsx sets data-motion) and off when the OS
 *  asks for less of it. */
function glideOn(): boolean {
  try {
    return document.documentElement.dataset.motion === 'on'
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch { return false }
}

/** The list's vertical offset from its transform, mid-glide included. */
function liveTy(el: HTMLElement): number {
  const m = getComputedStyle(el).transform
  if (!m || m === 'none') return 0
  const v = m.match(/matrix(3d)?\(([^)]+)\)/)
  if (!v) return 0
  const n = v[2].split(',').map(Number)
  return (v[1] ? n[13] : n[5]) || 0
}

/**
 * THE GLIDE (round 5). A FLIP on the commentary list: when lines are added,
 * every row that was already there is drawn where it WAS and then eased to
 * where it now is, so the stack slides by the new line's height instead of
 * jumping. Transform only (motionprobe's rule), one property on one element,
 * and it starts from wherever a glide still in flight has got to, so lines
 * arriving faster than the glide (Fast, a highlight's build-up) never snap.
 *
 * Rows carry data-k, the event's index in the match: stable for the life of
 * the line, so React keeps the same node and its colour can transition as it
 * goes from current to old.
 */
function useFeedGlide(listRef: React.RefObject<HTMLDivElement>, count: number) {
  const where = useRef<Map<string, number> | null>(null)
  useLayoutEffect(() => {
    const list = listRef.current
    const feed = list?.parentElement
    if (!list || !feed) { where.current = null; return }
    // every row's resting place in the feed box: where it is drawn, less
    // whatever a glide still in flight is adding
    const ty = liveTy(list)
    const top = feed.getBoundingClientRect().top
    const now = new Map<string, number>()
    for (const el of Array.from(list.children) as HTMLElement[]) {
      const k = el.dataset.k
      if (k != null) now.set(k, el.getBoundingClientRect().top - top - ty)
    }
    const before = where.current
    where.current = now
    if (!before || !glideOn()) return
    let dy: number | null = null
    for (const [k, y] of now) {
      const was = before.get(k)
      if (was != null) { dy = was - y; break }
    }
    // a burst bigger than the box (Key Moments, a skip) is not a glide: the
    // rows are new, and they simply arrive
    if (dy == null || Math.abs(dy + ty) > feed.clientHeight * 1.5) {
      list.style.transition = 'none'
      list.style.transform = ''
      return
    }
    if (Math.abs(dy) < 0.5) return
    list.style.transition = 'none'
    list.style.transform = `translateY(${dy + ty}px)`
    void list.offsetHeight
    list.style.transition = `transform ${GLIDE_MS}ms cubic-bezier(.25, .1, .25, 1)`
    list.style.transform = ''
  }, [count])
}

export default function MatchDay() {
  const game = useStore(s => s.game)!
  const live = useStore(s => s.liveMatch)
  const { back } = useStore.getState()

  // ONE DECISION POINT, OR THE SCREEN LIES.
  //
  // This used to read the CLUB fixture first and fall back to the Test, while
  // store.kickOff and store.instantResult both read userMatchThisWeek, which
  // ranks the Test above it. So on a week holding both, this screen previewed
  // Northampton's Saturday and the button underneath played Scotland's (user:
  // "it showed my club game, I ran it and it played another international
  // game"). The preview and the kick-off now read the same function, so they
  // cannot disagree; the club game the assistant is taking is named below
  // rather than offered.
  const fx = live?.fixture ?? userMatchThisWeek(game)
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
// Four tones, one emotion each (owner, round 6), and "say nothing" under them:
// settle them, believe in them, demand of them, set them alight.
const SPEECHES = [
  { id: 'calm', icon: 'calm', name: 'matchday.spCalm', desc: 'matchday.spCalmD' },
  { id: 'faith', icon: 'heart', name: 'matchday.spFaith', desc: 'matchday.spFaithD' },
  { id: 'expect', icon: 'crown', name: 'matchday.spExpect', desc: 'matchday.spExpectD' },
  { id: 'fire', icon: 'derby', name: 'matchday.spFire', desc: 'matchday.spFireD' },
] as const satisfies readonly { id: PreTone; icon: string; name: string; desc: string }[]
type SpeechId = typeof SPEECHES[number]['id']

/** Three ways to spend a match (F5).
 *
 *  A season is forty-odd fixtures and a phone is not a sofa. Watching every ruck
 *  of a pre-season friendly is not immersion, it is a chore, and the game already
 *  had the two extremes (full commentary, or Instant Result buried under the
 *  team sheet). The middle one is the useful one, and putting all three in a row
 *  makes the choice a decision rather than a button nobody finds. */
const VIEW_MODES = [
  { id: 'full', icon: 'tv', name: 'matchday.vmFull', desc: 'matchday.vmFullD' },
  { id: 'highlights', icon: 'film', name: 'matchday.vmHighlights', desc: 'matchday.vmHighlightsD' },
  { id: 'instant', icon: 'ffwd', name: 'matchday.vmInstant', desc: 'matchday.vmInstantD' },
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
            onClick={() => onPick(v.id)}><Glyph name={v.icon} /> {t(v.name)}</button>
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
          {/* the squad list's own short tags, in the player's language: the
              sheet printed the internal code ("INTL DUTY") in all six */}
          {prob && p && <span style={{ color: 'var(--text-negative)', fontSize: 11, fontWeight: 700 }}> {prob === 'GONE' ? t('common.goneTag') : availabilityTag(p, game.week)?.txt ?? prob}</span>}
          {!prob && p && (p.rust ?? 0) > 0 && <span style={{ color: 'var(--gold)', fontSize: 11, fontWeight: 700 }}> {t('matchday.rusty')}</span>}
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
                  {(p.rust ?? 0) > 0 && <span style={{ color: 'var(--gold)', fontSize: 11, fontWeight: 700 }}> {t('matchday.rustyW', { n: p.rust ?? 0 })}</span>}
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
            <h3 style={{ fontSize: 18, margin: '2px 0 8px', textAlign: 'center' }}>{t('matchday.readyTitle')}</h3>
            {warnings.length === 0 && (
              <div className="meta" style={{ margin: '6px 0', textAlign: 'center' }}>{t('matchday.readyOk')}</div>
            )}
            {warnings.length > 0 && (
              <div style={{ maxHeight: '34vh', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10, padding: '2px 10px' }}>
                {warnings.map((w, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 8, padding: '6px 0', fontSize: 13, lineHeight: 1.4,
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
              <button className="btn gold" style={{ flex: 1.5, fontSize: 16 }}
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
          <button className="back-btn" onClick={back}>‹</button>
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
            <span style={{ fontFamily: 'var(--cond)', fontWeight: 700, fontSize: 16, color: 'var(--text-muted)', letterSpacing: 2 }}>{t('matchday.vs')}</span>
            {game.clubs[fx.awayId] && <Jersey club={game.clubs[fx.awayId]} size={54} />}
            <CrestT g={game} teamId={fx.awayId} size={38} />
          </div>
          <div className="mday-facts">
          <h3 style={{ fontSize: 18 }}>{t('matchday.vsLine', { home: teamShort(game, fx.homeId), away: teamShort(game, fx.awayId) })}</h3>
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
                    <RewardedButton place="matchday" style={{ marginTop: 6, fontSize: 13 }}
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
                  <div key={r.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
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
            <h1>{t('matchday.testMatch', { nat: nationName(nat) })}</h1>
            <div className="date">{compLabel(comp?.name) ?? (fx.compId === 'fr' ? t('matchday.clubFriendly') : '')}{fx.stage ? ` · ${stageName(fx.stage)}` : ''} · {fixtureDate(game.season, fx.week, fx.id, fx.midweek ? MIDWEEK_OFF : undefined)}</div>
          </div>
        </div>
      </header>
      <main className="content">
        <div className="card center">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 4 }}>
            <CrestT g={game} teamId={fx.homeId} size={40} />
            <span style={{ fontFamily: 'var(--cond)', fontWeight: 700, fontSize: 16, color: 'var(--text-muted)', letterSpacing: 2 }}>{t('matchday.vs')}</span>
            <CrestT g={game} teamId={fx.awayId} size={40} />
          </div>
          <h3 style={{ fontSize: 18 }}>{t('matchday.vsLine', { home: teamShort(game, fx.homeId), away: teamShort(game, fx.awayId) })}</h3>
          <div className="meta">{t('matchday.intlLine')}</div>
        </div>
        {/* THE OTHER SATURDAY, NAMED. The club fixture does not vanish because
            the manager is with his country - it is played by the assistant and
            reported on Monday. Saying so here is the whole of "clearly
            separated but work together": one match is being prepared on this
            screen, the other is somebody else's job, and neither is a
            surprise. */}
        {(() => {
          const cfx = assistantFixtureThisWeek(game)
          if (!cfx) return null
          return (
            <div className="card" style={{ borderLeft: '4px solid var(--border-strong)' }}>
              <div className="fact-label">{t('matchday.clubSameDay')}</div>
              <div className="meta" style={{ marginTop: 3 }}>
                {t('matchday.assistantTakes', { g: game.staffPeople?.assistant?.g ?? 'm', home: teamShort(game, cfx.homeId), away: teamShort(game, cfx.awayId) })}
              </div>
            </div>
          )
        })()}
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
        {/* HOW YOU WATCH IT BELONGS ON THE PAGE, NOT IN THE SHEET (owner,
            v1.1.15: "ready to lead in the international bit dimension wise is
            too big for the screen"). This block - a label, three chips and a
            line explaining the one you picked - was inside the confirm sheet
            and is the tallest thing that was ever in there: measured, it took
            the sheet's content from 202px to 281px on a 412x915 phone at the
            largest text size.
            That alone did not hide the buttons at that size - scripts/
            testsheet.mjs says Take the Field was still reachable - but a sheet
            is capped at 80dvh and scrolls, so every pixel of it is pixels of
            margin against a shorter phone. The club side has never carried
            this weight: its view picker lives in the dressing-room modal and
            its confirm sheet is three lines and two buttons. This is the same
            shape - the choice sits on the page beside the team talk, where it
            can be made in advance, and the sheet asks one question. */}
        <ViewPicker view={view} onPick={setView} />
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
            {/* A GUTTER, LIKE ITS CLUB TWIN. .modal sets no horizontal padding
                of its own, so anything not wrapped runs flush to both edges of
                the phone - the heading and the anthems line were touching the
                glass at x=0, which is the other half of "dimension wise is too
                big for the screen". The club ready sheet has always had this
                wrapper and this centring; the Test one never did. */}
            <div style={{ padding: '0 18px 4px' }}>
              <h3 style={{ fontSize: 18, margin: '2px 0 8px', textAlign: 'center' }}>{t('matchday.readyNation', { nat: nationName(nat) })}</h3>
              <div className="meta" style={{ margin: '6px 0', textAlign: 'center' }}>{t('matchday.anthems')}</div>
            </div>
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn ghost" onClick={() => setConfirm(false)}>{t('matchday.notYet')}</button>
              <button className="btn gold" style={{ flex: 1.5, fontSize: 16 }}
                onClick={() => {
                  setConfirm(false)
                  if (view === 'instant') instantResult(speech ?? undefined, true)
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
// 900ms was Slow until v1.5.5, and a long line of commentary does not fit in
// 900ms (owner: "commentary text needs to be slower if you select slower.
// Normal is as it is. Fast is as is"). 1600 is a line and a breath, and the
// tension multiplier below still stretches it at the sharp end of a match.
/**
 * ---- HOW LONG A LINE OF COMMENTARY GETS ON THE SCREEN ----
 *
 * These were 1600 / 350 / 90, and the owner's verdict was "slow is good, normal
 * is too fast and fast is ridiculous". He was right, and the arithmetic says so.
 *
 * THE MEASUREMENT. The 245 lines in comm.* average 12.2 words, median 12.
 * Brysbaert's 2019 meta-analysis - 190 studies, 18,573 participants - puts
 * adult silent reading at 238 words a minute, so a median line takes about
 * 3,025ms to read start to finish. Against that:
 *
 *     Slow    1600ms   53% of the time the line needs
 *     Normal   350ms   12%          <- "too fast"
 *     Fast      90ms    3%          <- "ridiculous"
 *
 * So SLOW AT ~50% IS THE TARGET, defined by the one setting that was called
 * good. That is not a contradiction: a ticker is skimmed rather than read, the
 * line stays on screen after the next arrives, and half the reading time is
 * enough to take a line in without stopping on it.
 *
 * THE LADDER. Each step is exactly twice the speed of the one above, which
 * makes the difference between two settings something a player can feel rather
 * than guess at - the old 4.6x cliff from Slow to Normal left no usable middle
 * at all, which is why one setting was unusable and the other was glacial.
 *
 *     Slow    1600ms   53%   unchanged, and the anchor for the other two
 *     Normal   800ms   26%   followable without stopping
 *     Fast     400ms   13%   a skim: you catch the incidents, not the phases
 *
 * AND THE GENRE AGREES. Championship Manager 01/02, the closest ancestor this
 * game has and text commentary in the same way, ran its delay across 800-2700ms
 * with 300ms as the community's deliberate fast-play setting. Every number
 * above sits inside that band: 800 is exactly its floor, 400 is slower than its
 * speed-run figure, and the tension stretch below takes Slow to 2,560ms at its
 * most dramatic, just under the 2,700 ceiling.
 *
 * If these are ever changed again, change them against the measurement rather
 * than against a feeling - scripts/tempoprobe.ts holds them to it.
 */
const SPEEDS = [
  { label: 'matchday.spdSlow', ms: 1600, name: 'matchday.spdSlowName' },
  // 640, not 800 (owner, round 2: normal "a bit" quicker, "so it's not crazy
  // fast"). A fifth off the beat; Slow and Fast keep their absolute pace.
  { label: 'matchday.spdNormal', ms: 640, name: 'matchday.spdNormalName' },
  { label: 'matchday.spdFast', ms: 400, name: 'matchday.spdFastName' },
]

/** the kicking style's own chip label (Tactics screen), for the status strip */
const KICK_STYLE_LABEL: Record<string, string> = {
  territory: 'tacticsScreen.kickTerritory', contest: 'tacticsScreen.kickContest',
  attack: 'tacticsScreen.kickAttack', balanced: 'tacticsScreen.kickBalanced',
}

function contrastText(bg: string): string {
  if (bg.replace('#', '').length < 6) return 'var(--prop-ink)'
  return luma(bg) > 140 ? 'var(--prop-ink-dark)' : 'var(--prop-ink)'
}

function Live() {
  const game = useStore(s => s.game)!
  const live = useStore(s => s.liveMatch)!
  useStore(s => s.tick)
  const { advanceLive, matchCursor, finishMatch, skipToBreak, matchMode } = useStore.getState()
  // NORMAL OUT OF THE BOX (owner, 1.5.8: "default game speed to normal with
  // fast and slow optional"). It opened on Slow, the anchor the ladder above
  // was measured from, which meant every first match of every career ran at
  // 1,600ms a line before anybody found the ⚙. Normal is the 800ms middle
  // rung (640ms since round 2) and both neighbours are one tap away.
  // and REMEMBERED (owner, 1.8.8: "I selected fast ... it doesn't remember
  // next time I play it"): the pace lives in matchPrefs with the other Match
  // Settings, declared just below, so it survives the match and a restart.
  const [sound, setSound] = useState(soundOn())
  const [drawer, setDrawer] = useState(false)
  const [settings, setSettings] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [showRatings, setShowRatings] = useState(false)
  const [injury, setInjury] = useState<{ hurt: string; hurtId: number; desc: string; weeks: number; coverId: number | null } | null>(null)
  /** the match-day squad, opened from the Squad button in the control row */
  const [sheet, setSheet] = useState(false)
  const [mpanels, setMpanels] = useState(false)
  /** the pre-match talk's reactions, shown on the stage for the opening
   *  minutes until the manager waves them away (teamtalk.ts) */
  const [preSeen, setPreSeen] = useState(false)
  const tablet = useTablet()
  const [prefs, setPrefs] = useState(readMatchPrefs)
  const setPref = (p: Partial<MatchPrefs>) => setPrefs(o => { const n = { ...o, ...p }; writeMatchPrefs(n); return n })
  const speedIdx = prefs.speed
  const setSpeedIdx = (i: number) => setPref({ speed: i === 0 || i === 2 ? i : 1 })
  const tickerRef = useRef<HTMLDivElement>(null)
  const feedRef = useRef<HTMLDivElement>(null)
  const tabRef = useRef<HTMLDivElement>(null)

  const { events, cursor, playing, fixture, ctx } = live
  const shown = events.slice(0, cursor)
  const last = shown[shown.length - 1]
  const caughtUp = cursor >= events.length
  const atHalfTime = caughtUp && ctx.awaiting === 'HT'
  const atBreak = caughtUp && ctx.awaiting === 'BRK'
  const atDecision = caughtUp && !!ctx.decision && ctx.seg < 3
  const done = caughtUp && ctx.seg === 3
  // how the room took the pre-match talk, for the opening twenty minutes
  const showPreReact = !preSeen && !!ctx.preReads?.length && (last?.min ?? 0) < 20 && !done
  const preReact = showPreReact ? (
    <TalkReactions game={game} reads={ctx.preReads!} lineup={ctx.home.teamId === ctx.userSideId ? ctx.home.lineup : ctx.away.lineup}
      msg={live.preTalkMsg} onClose={() => setPreSeen(true)} />
  ) : null

  // coming back from another app can strand the heartbeat - kick it awake
  useEffect(() => {
    const wake = () => {
      const lm = useStore.getState().liveMatch
      if (document.visibilityState === 'visible' && lm?.playing) advanceLive()
    }
    document.addEventListener('visibilitychange', wake)
    return () => document.removeEventListener('visibilitychange', wake)
  }, [])

  // whistles & haptics on key events (skip when fast-forwarding)
  useEffect(() => {
    if (last && speedIdx < 2 && playing) matchSfx(last.fx === 'NOTRY' ? 'NOTRY' : last.type)
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
    // WHOEVER THE ASSISTANT SENT ON, AS THE ENGINE SAYS (owner, round 6). This
    // used to be "the next SUB line with a player in it", and most commentary
    // lines are typed SUB: a failed head assessment, or an injury with nobody
    // left to send on, armed whichever man the next line of play happened to
    // name - sometimes an opponent - and with the bench empty that sheet could
    // not be answered at all. The engine writes the stoppage down (lastInj).
    const side = ctx.home.teamId === e.teamId ? ctx.home : ctx.away
    const li = side.lastInj && side.lastInj.hurtId === hurt.id ? side.lastInj : null
    injSeen.current = cursor
    matchCursor(cursor, false)
    setDrawer(false)
    setSettings(false)
    setInjury({ hurt: hurt.name, hurtId: hurt.id, desc: injuryDesc(hurt.injury), weeks, coverId: li?.coverId ?? null })
  }, [cursor])

  // A TRY FLASHES (owner: "when a try is scored it should flash with inverted
  // team colours for 1 second just to make it feel different - it should go
  // back to normal in the commentary after"). Only a try line the ticker has
  // just stepped onto: a skip, a scrub or a screen opened on a match already
  // under way moves the cursor further than a beat or two, and flashes
  // nothing. The class comes off after the animation, so a feed rebuilt when
  // a panel closes shows the line settled.
  const [flash, setFlash] = useState(-1)
  const flashFrom = useRef(cursor)
  useEffect(() => {
    const from = flashFrom.current
    flashFrom.current = cursor
    if (cursor <= from || cursor - from > 3) return
    for (let i = cursor - 1; i >= from; i--) if (events[i]?.type === 'TRY' && events[i].teamId) { setFlash(i); return }
  }, [cursor])
  useEffect(() => {
    if (flash < 0) return
    const timer = setTimeout(() => setFlash(-1), 1100)
    return () => clearTimeout(timer)
  }, [flash])

  useEffect(() => {
    // a panel (half-time talk, break, full-time) must open at its TOP -
    // scrolling to the bottom buried the team talk (8C feedback)
    if (atHalfTime || atBreak || done) tickerRef.current?.scrollTo({ top: 0 })
    else tickerRef.current?.scrollTo({ top: tickerRef.current.scrollHeight, behavior: 'smooth' })
  }, [cursor, atHalfTime, atBreak, done])

  const hs = last?.homeScore ?? 0
  const as = last?.awayScore ?? 0
  const min = last?.min ?? 0


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

  // THE TMO HOLDS THE CLOCK (idea 5). A review line is the wait for a verdict,
  // so at Slow and Normal it gets longer than a beat; Fast, Skip and a scrub
  // are left alone. A rout never has one to hold for longer than any other
  // review, and there are about one in six tries sent upstairs, so the pacing
  // a manager chose is still the pacing he gets.
  const tmoHold = last?.fx === 'TMO' && playing && speedIdx < 2
    ? Math.round(Math.min(2800, Math.max(1800, tickMs * 2.2))) - tickMs : 0
  // A SCRUM, A LINEOUT OR A CARD GETS A LITTLE LONGER (owner, 26 Sep 2026:
  // "the scrum pushes, the jumper is lifted", "a sin-binned player walks off").
  // The push, the lift and the walk to the touchline need about 1.2s to read;
  // at Normal a beat is 640ms. Slow is already long enough and is left alone,
  // Fast is left alone, and so is a rout's pace, since this is no longer than
  // the Slow beat the manager could have chosen anyway.
  const momentHold = !tmoHold && playing && speedIdx < 2 && last
    && (last.fx === 'SCRUM' || last.fx === 'LINEOUT' || last.type === 'YC' || last.type === 'RC')
    ? Math.max(0, Math.round(Math.min(1600, Math.max(1200, tickMs * 1.5))) - tickMs) : 0
  const hold = tmoHold + momentHold

  // ---- HIGHLIGHTS, THEN COMMENTARY (1.8.0) ----
  // Owner, 28 Sep 2026: "aiming for football manager level of animation.
  // Smooth and show tries properly, then just commentary only. So the pitch
  // isnt on screen... maybe show stats when nothing interesting happens". The
  // pitch comes on for a moment (Match Settings: Key is tries, Extended adds
  // kicks at goal and breaks into the 22) and plays it as a clip
  // (HighlightClip.tsx), revealing the build-up's commentary in step; the
  // rest of the match is the commentary line over the live stats.
  // Automated browsers time the ticker, so they get no clips unless a probe
  // asks for them with ?hl=1.
  const [clip, setClip] = useState<{ spec: ClipSpec; at: number } | null>(null)
  // the first highlight is the match moving on: the talk's reactions have had
  // their moment, and the stage goes back to the live stats after the clip
  useEffect(() => { if (clip) setPreSeen(true) }, [clip])
  const played = useRef(new Set<number>())
  const highlightsOn = (() => {
    try { return /[?&]hl=1\b/.test(location.search) || !navigator.webdriver } catch { return true }
  })()
  const shirtOf = (pid?: number) => {
    if (pid == null) return undefined
    for (const sd of [ctx.home, ctx.away]) {
      const i = sd.lineup.indexOf(pid)
      if (i >= 0 && i < 15) return i + 1
    }
    return undefined
  }
  const startMoment = (): boolean => {
    if (!highlightsOn) return false
    // caught up with the engine: play the next stretch first (without showing
    // it), or a try that opens a stretch would be on screen before we saw it
    if (cursor >= events.length) useStore.getState().simAhead()
    const skipping = live.mode === 'highlights'
    const nx = nextMoment(events, cursor, fixture.homeId, prefs.highlights, played.current, skipping ? 40 : 6)
    if (!nx) return false
    // the canvas needs real colours: a club with no kit on file gets the
    // token kit, read off the page
    const white = tokenColor('--prop-ink')
    const onGrass = kitColours(pageSpares(tokenColor), game.clubs[fixture.homeId]?.colors ?? [tokenColor('--kit-home'), white],
      game.clubs[fixture.awayId]?.colors ?? [tokenColor('--kit-away'), white], false)
    const hc = onGrass.home, ac = onGrass.away
    const spec = buildClip(events, nx.at, nx.kind, fixture.homeId, shirtOf,
      { home: [hc[0], hc[1] ?? white], away: [ac[0], ac[1] ?? white] },
      { try: t('hl.try'), review: t('hl.review'), notry: t('hl.notry'), good: t('hl.good'), wide: t('hl.wide'),
        turnover: t('hl.turnover'), saved: t('hl.saved') },
      pid => (pid != null ? game.players[pid]?.name : undefined),
      (home, shirt) => { const id = (home ? ctx.home : ctx.away).lineup[shirt - 1]; return id != null ? game.players[id]?.a.pac : undefined },
      // how each side attacks and defends, for the clip's shapes (1.8.2): the
      // styles the engine is playing this match (SideCtx.sty, an AI club's
      // from its coach's philosophy), over the club's dials
      home => {
        const sd = home ? ctx.home : ctx.away
        const tac = game.clubs[sd.teamId]?.tactic
        return sd.sty ? { ...tac, atkStyle: sd.sty.atk, defStyle: sd.sty.def, podShape: sd.sty.pod } : tac
      },
      // the number on his back is the one he walked out in (1.8.16)
      (home, shirt) => {
        const sd = home ? ctx.home : ctx.away
        const id = sd.lineup[shirt - 1]
        return id != null ? shirtNumber(sd, id) : undefined
      })
    // the clip starts with its build-up, so the commentary never jumps: the
    // ticker reads on until it reaches the first line of it (in Key Moments,
    // which skips lines anyway, it is brought straight there)
    const first = spec.beats.find(b => b.line >= 0)?.line ?? nx.at
    if (first > cursor && !skipping) return false
    if (skipping && first > cursor) matchCursor(first, true)
    played.current.add(nx.at)
    setClip({ spec, at: nx.at })
    return true
  }
  const revealTo = (line: number) => {
    const lm = useStore.getState().liveMatch
    if (lm && line + 1 > lm.cursor) matchCursor(line + 1, true)
  }

  useEffect(() => {
    if (!playing || clip) return
    // `timer`, not `t`: t() is the translator
    const timer = setTimeout(() => { if (!startMoment()) advanceLive() }, tickMs + hold)
    return () => clearTimeout(timer)
  }, [cursor, playing, speedIdx, events.length, tension, hold, clip, prefs.highlights])

  const cls = (e: MatchEvent) =>
    e.fx === 'TMO' || e.fx === 'NOTRY' ? 'tmo'
      : e.type === 'TRY' || e.type === 'FT' || e.type === 'DG' ? 'big'
      : e.type === 'YC' ? 'card-y'
      : e.type === 'RC' ? 'card-r'
      : e.type === 'INJ' ? 'inj'
      : e.type === 'PEN' || e.k === 'comm.penTouchOwnHalf' || e.k === 'comm.penKickableAsk' ? 'pen' : ''

  // CLEAN COMMENTARY (owner, 27 Sep 2026: "remove any emojis and bullet
  // points from commentary, make it super clean"). The line is the words;
  // its kind is carried by cls(): gold for a score, the card colours, the TMO.

  const kits = kitColours(pageSpares(tokenColor), game.clubs[fixture.homeId]?.colors, game.clubs[fixture.awayId]?.colors ?? ['var(--gold-fill)', 'var(--ramp-g9)'])
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
  // THE LINE WEARS THE KIT (owner, 27 Sep 2026: "The commentary lines on the
  // in game should be the colour of who is being talked about"). A line about
  // a side is filled with that side's first colour, its text in whichever of
  // ink or white reads on it, and edged in the second colour. A near-black
  // first colour (Northampton, the All Blacks' kind of kit) would look like no
  // colour at all on the dark panel, so those lines take the second colour
  // with the black as the edge. The stripe on the left keeps its meaning:
  // gold for a score, yellow and red for cards. A line about nobody
  // (kick-off, the whistles) stays plain.
  const lineStyle = (e: MatchEvent): React.CSSProperties | undefined => {
    if (!e.teamId) return undefined
    const [fill, edge] = e.teamId === fixture.awayId ? kits.away : kits.home
    const plain = !cls(e)
    return {
      background: fill, color: contrastText(fill),
      boxShadow: `inset 0 0 0 1px ${edge ?? 'var(--border-strong)'}`,
      ...(plain ? { borderLeftColor: edge ?? fill } : {}),
    }
  }
  /** the flashing try's pair, the line's own two colours the other way
   *  round: its text colour as the fill and its fill as the text (theme.css
   *  try-flash) */
  const flashStyle = (e: MatchEvent, i: number) => {
    if (i !== flash || !e.teamId) return undefined
    const fill = (e.teamId === fixture.awayId ? kits.away : kits.home)[0]
    return { '--flash-bg': contrastText(fill), '--flash-fg': fill } as React.CSSProperties
  }
  /** An old line lets go of the fill and keeps its side as the stripe, the
   *  way FM's feed keeps a team colour beside a line it has moved past. */
  const oldStyle = (e: MatchEvent): React.CSSProperties | undefined => {
    if (!e.teamId || cls(e)) return undefined
    return { borderLeftColor: (e.teamId === fixture.awayId ? kits.away : kits.home)[0] }
  }
  const panelActive = done || atHalfTime || atBreak || atDecision || (drawer && paused)
  // the phone's feed: the last few lines, by their index in the match
  const feedRows = shown.slice(-FEED_ROWS).map((e, j) => ({ e, i: Math.max(0, shown.length - FEED_ROWS) + j }))
  useFeedGlide(feedRef, panelActive ? -1 : shown.length)
  useFeedGlide(tabRef, panelActive || !tablet ? -1 : shown.length)

  return (
    <div className={`live-wrap${prefs.bigText ? ' big-text' : ''}`}>
      <div className="scoreboard" style={{ '--home-c': kits.home[0], '--away-c': kits.away[0] } as React.CSSProperties}>
        <div className="teams">
          <div className="tname"><CrestT g={game} teamId={fixture.homeId} size={26} />{teamShort(game, fixture.homeId)}<span className="clubbar" style={{ background: kits.home[0] }} /></div>
          <div className="score" key={`${hs}-${as}`}>{hs} – {as}</div>
          <div className="tname"><CrestT g={game} teamId={fixture.awayId} size={26} />{teamShort(game, fixture.awayId)}<span className="clubbar" style={{ background: kits.away[0] }} /></div>
        </div>
        <div className="minute">
          {/* A FRIENDLY HAS NO COMPETITION, and this line used to print the
              separator anyway: "57' ·  · 💨 Wind", with a hole where the name
              would be. The dot belongs to the thing after it. */}
          {done ? t('matchday.fullTime') : atHalfTime ? t('matchday.halfTime') : atBreak ? t('matchday.breakSixty') : `${Math.min(80, min)}'`}
          {compLabel(game.comps[fixture.compId]?.short) ? ` · ${compLabel(game.comps[fixture.compId]?.short)}${fixture.stage ? ` ${stageName(fixture.stage)}` : ''}` : ''}
          {fixture.weather && fixture.weather !== 'Dry' ? <> · <Glyph name={WEATHER_ICON[fixture.weather]} /> {weatherWord(fixture.weather)}</> : ''}
          {fixture.att ? <> · <Glyph name="crowd" /> {fixture.att.toLocaleString(localeTag())}</> : ''}
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
          // the engine bins at the referee's patience, not at a figure read
          // off his style label: two "fair" referees wait for six, and the
          // warning went gold one penalty early for them
          const binAt = ref.patience
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
                <Glyph name="warning" /> <b style={{ color: penC(ctx.home.consPens) }}>{ctx.home.consPens}</b>
              </span>
              {/* the flanking numbers are penalties conceded, and a phone cannot
                  hover a tooltip to find that out - so the label says it */}
              <span className="l10-label">{t(live ? 'matchday.penPossLabel' : 'matchday.penAwaiting')}</span>
              <div className="l10-bar" title={t('matchday.ballTitle')} style={live ? undefined : { opacity: .35 }}>
                {/* away is the whole bar; home is drawn over it and scaled. See
                    .l10-fills in theme.css for why this is not a flex row any
                    more - a scaled box does not push its sibling, and transform
                    is the only part of this the compositor can animate alone. */}
                <div className="l10-fills">
                  <div className="l10-away" style={{ background: kits.away[0] }} />
                  <div className="l10-home" style={{ transform: `scaleX(${share})`, background: kits.home[0] }} />
                </div>
                <div className="momo-track" style={{ transform: `translateX(${50 + ctx.momo * 44}%)` }}>
                  <div className="momo-needle" />
                </div>
              </div>
              <span className="l10-pens" title={t('matchday.pensTitle')}>
                <b style={{ color: penC(ctx.away.consPens) }}>{ctx.away.consPens}</b> <Glyph name="warning" />
              </span>
            </div>
          )
        })()}
        {/* ---- PRESSURE (owner, v1.7.0) ----
            Two bars, one a side, growing outward from the middle. The bar
            above this is POSSESSION SHARE and always sums to one, so it can
            only ever say who has more of the ball; these say how much either
            side is actually doing with it, and in a scrappy ten minutes both
            of them are short, which is the honest answer a share cannot give.
            Derived in the engine off each tick (SideCtx.pressure), so it
            costs no rng and cannot move a result. */}
        {!done && (
          <div className="press-row">
            <div className="press-bar home" title={t('matchday.pressureTitle')}>
              <div className="press-fill" style={{ width: `${Math.round(ctx.home.pressure)}%`, background: kits.home[0] }} />
            </div>
            <span className="press-label">{t('matchday.pressureLabel')}</span>
            <div className="press-bar away" title={t('matchday.pressureTitle')}>
              <div className="press-fill" style={{ width: `${Math.round(ctx.away.pressure)}%`, background: kits.away[0] }} />
            </div>
          </div>
        )}
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

      {/* THE MATCH IS STILL GOING (1.8.2, tester note 1.4). A reload, a closed
          app or a reopened save brings a kicked-off match back here, paused,
          rather than offering it again. One honest line and one way on: there
          is no button to throw it away, because throwing it away was how a
          losing match used to be played again. */}
      {live.resumed && (
        <div className="card resume-note" role="status">
          <div className="meta">
            {t(done ? 'matchday.stillOver' : 'matchday.stillGoing', {
              opp: teamShort(game, ctx.userSideId === fixture.homeId ? fixture.awayId : fixture.homeId),
            })}
          </div>
          <button className="btn gold block" style={{ marginTop: 8 }} data-ctl="resume-live"
            onClick={() => useStore.getState().ackResume()}>
            {t('matchday.resume')}
          </button>
        </div>
      )}

      {/* NOT WHILE THE TIE IS STILL LEVEL. The stamp reads the score off the
          event under the cursor, and in a knockout the engine's own full time
          lands BEFORE sudden death has been played - so a tie stamped DRAWN at
          19-19, then flipped to a 22-19 win a moment later. The owner watched
          exactly that against Loughborough and went away believing the game had
          changed a result behind his back. Level and still to be settled means
          no verdict yet; the stamp waits for the extra-time event. */}
      {done && ctx.userSideId && !(isKnockoutTie(fixture) && hs === as && !fixture.decider) && (() => {
        const isHome = ctx.userSideId === fixture.homeId
        const us = isHome ? hs : as
        const them = isHome ? as : hs
        // LEVEL AFTER EXTRA TIME (1.8.16): the score stays level and the try
        // count or the kicks decided it, so the verdict reads the decider
        const dec = us === them && fixture.decider && fixture.homeScore === fixture.awayScore ? fixture.decider : null
        const won = dec ? tieWinner(fixture) === ctx.userSideId : us > them
        const lost = dec ? !won : us < them
        const kind = won ? 'w' : lost ? 'l' : 'd'
        return (
          <div className={`ft-stamp ${kind}`} key={`stamp-${fixture.id}`}>
            <b>{t(won ? 'matchday.victory' : lost ? 'matchday.defeat' : 'matchday.drawn')}</b>
            <span>{hs} - {as}{dec ? ` ${t(dec.by === 'tries' ? 'matchday.onTries' : 'matchday.onKicks')}` : ''}</span>
          </div>
        )
      })()}

      {/* THE CONTROLS SIT UNDER THE PITCH (owner, v1.1.16: "4 buttons in match
          mode - should be directly underneath the pitch at the top").
          They used to be the last child of .live-wrap during live play, with
          the commentary strip growing above them - so on a tall phone the four
          buttons pressed most in eighty minutes sat alone at the foot of a
          mostly empty page, 734px lower than the same four buttons in the
          decision panel, which renders them right under the scoreboard. Two
          homes for one row, swapping every few seconds of play.
          One home now, and it is the high one: pitch, then the controls, then
          the match story growing underneath. The panel state already read this
          way, so the row no longer moves at all.
          The advertising box, when there is one, goes below this row. */}
      {/* One row: play/pause, fast-forward, squad, the match menu, settings.
          Icons only (owner, 27 Sep 2026), each named for screen readers. Speed and sound
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
          <button className={`btn ctl-ico ${playing ? 'ghost' : 'gold'}`} data-ctl="play" data-playing={playing ? 'true' : 'false'}
            disabled={atDecision}
            title={atInterval ? intervalLabel : atDecision ? t('matchday.callFirst') : t(playing ? 'matchday.pause' : 'matchday.resume')}
            aria-label={atInterval ? intervalLabel : t(playing ? 'matchday.pause' : 'matchday.resume')}
            onClick={() => {
              if (atInterval) { leaveInterval(); return }
              matchCursor(cursor, !playing)
            }}>
            {playing ? <IcoPause /> : <IcoPlay />}
          </button>
        )}
        {!done && (
          <button className="btn ctl-ico" disabled={atDecision} data-ctl="skip"
            title={t('matchday.skip')} aria-label={t('matchday.skip')}
            onClick={() => {
              setDrawer(false)
              setSettings(false)
              // out of the interval first, or there is nothing to skip through
              setClip(null)
              if (atInterval) leaveInterval(true)
              else skipToBreak()
            }}><IcoFastForward /></button>
        )}
        {/* Squad, not "Touchline" (user: "rather than touchline ... have it as
            squad selection so you click it and can make changes"). The panel it
            used to open was a tactics drawer with a substitution list buried in
            it; this goes straight to the match-day squad, which is what anyone
            pressing it wants. Tactics still live behind the same panel via the
            drawer button on the squad sheet. */}
        {!done && ctx.seg < 3 && (
          <button className={`btn ctl-ico ${sheet ? 'gold' : 'ghost'}`} data-ctl="squad"
            title={t('matchday.squadTitle')}
            aria-label={t('matchday.squadTitle')}
            onClick={() => {
              matchCursor(cursor, false)
              setSettings(false)
              setDrawer(false)
              setSheet(true)
            }}><IcoPeople /></button>
        )}
        {/* the match menu (1.8.0): line-ups, the room, who did what, where
            it has been played, the 22 - paused while you read it */}
        <button className="btn ghost" data-ctl="menu"
          title={t('mpanel.open')} aria-label={t('mpanel.open')}
          onClick={() => { matchCursor(cursor, false); setSettings(false); setDrawer(false); setMpanels(true) }}><Glyph name="chart" /></button>
        <button className={`btn ${settings ? 'gold' : 'ghost'}`} data-ctl="settings"
          title={t('matchday.settingsTitle')} aria-label={t('matchday.settingsTitle')}
          onClick={() => { setDrawer(false); setSettings(!settings) }}><Glyph name="settings" /></button>
      </div>

      {/* THE MATCH STORY, UNDER THE CONTROLS. It grows (theme.css gives
          .live-wrap .now-strip flex: 1) so it is this panel, not bare
          background, that takes up whatever a tall phone has spare. */}
      {!panelActive && (
        <div className="now-strip">
          {/* the touchline at a glance (1.8.0): replacements left and how you
              are kicking, the two things a manager changes mid-match */}
          <div className="match-status">
            <span>⇄ {t('mstatus.subs', { left: usableChanges(game, ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away, ctx.subsUsed), max: MAX_SUBS })}</span>
            <span>{t(KICK_STYLE_LABEL[game.clubs[ctx.userSideId ?? '']?.tactic.kickStyle ?? 'balanced'] ?? 'tacticsScreen.kickBalanced')}</span>
          </div>
          {/* THE FEED (round 5): a fixed box, newest line at the foot, the
              stack gliding up as each one arrives (useFeedGlide). The
              current line keeps the now-line class the probes read. */}
          <div className="comm-feed" aria-live="off">
            <div className="comm-list" ref={feedRef}>
              {feedRows.map(({ e, i }) => {
                const age = shown.length - 1 - i
                return (
                  <div key={i} data-k={i}
                    className={`comm-line ${cls(e)}${e.teamId ? ' kit' : ''}${age === 0 ? ` cur now-line fresh` : ` old a${Math.min(3, age)}`}${i === flash ? ' try-flash' : ''}`}
                    style={{ ...(age === 0 ? lineStyle(e) : oldStyle(e)), ...flashStyle(e, i) }}>
                    <span className="min">{Math.min(80, e.min)}'</span>
                    <span className="txt">{eventText(e)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* THE STAGE: the highlight when there is one, the live stats when
          there is not (owner: "maybe show stats when nothing interesting
          happens"). A tablet keeps its stats beside the feed below. */}
      {!panelActive && clip && (
        <HighlightClip key={clip.at} spec={clip.spec} paused={!playing}
          speed={[1.25, 0.9, 0.8][speedIdx] ?? 1}
          onReveal={revealTo}
          onDone={() => setClip(null)} />
      )}
      {!panelActive && !clip && !tablet && showPreReact && preReact}
      {!panelActive && !clip && !tablet && !showPreReact && <LiveStats shown={shown} />}

      {/* THE TABLET DECK (1.8.0). A phone reads the match a line at a time;
          a tablet has half a screen under the pitch that used to be empty, so
          it gets the running commentary, newest first and coloured like the
          now-line (gold scores, red and yellow cards, the TMO), beside the
          two panels a manager checks most: visits to the 22 and territory. */}
      {tablet && !panelActive && (
        <div className="tab-deck">
          <div className="tab-feed" aria-live="off">
            {/* newest first, so a new line pushes the rest DOWN: the same
                glide as the phone's feed, the other way up (round 5) */}
            <div className="tab-list" ref={tabRef}>
              {shown.slice(-12).reverse().map((e, k) => (
                <div key={shown.length - k} data-k={shown.length - k} className={`feed-line ${cls(e)}${e.teamId ? ' kit' : ''}${k === 0 ? ' newest' : ''}${shown.length - 1 - k === flash ? ' try-flash' : ''}`}
                  style={{ ...lineStyle(e), ...flashStyle(e, shown.length - 1 - k) }}>
                  <span className="min">{Math.min(80, e.min)}'</span>
                  <span className="txt">{eventText(e)}</span>
                </div>
              ))}
            </div>
          </div>
          {/* the room's reactions take the stats' place until Got it, never
              the commentary's: above the deck they pushed the feed off the
              bottom of the glass (owner, tablet round) */}
          <div className="tab-stats">
            {showPreReact ? preReact : <LiveStats shown={shown} />}
          </div>
        </div>
      )}

      {mpanels && <MatchPanels onClose={() => { setMpanels(false); matchCursor(cursor, true) }} />}
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
          hurtId={injury.hurtId}
          note={injury.coverId != null ? t('matchday.injNote') : undefined}
          freeCoverId={injury.coverId ?? undefined}
          /* forced: the physio is on, the clock is stopped, and the only way back
             to the match is through naming somebody */
          mustDecide
          onClose={() => { setInjury(null); matchCursor(cursor, true) }}
        />
      )}

      {settings && (
        <div className="modal-veil" onClick={() => setSettings(false)}>
          <div className="modal settings-sheet" onClick={e => e.stopPropagation()}>
            <div className="grab" />
            <h3 style={{ fontSize: 16, margin: '2px 16px 8px' }}>{t('matchday.matchSettings')}</h3>
            {/* THE FM26 LAYOUT (1.8.1, from the owner's screenshot of its match
                settings): each choice on a row with its name beside it, then
                the on/off switches in a grid. */}
            <div className="ms-rows">
              <div className="set-label">{t('matchday.commentarySpeed')}</div>
              <div className="btn-row ms-seg">
                {SPEEDS.map((s, i) => (
                  <button key={i} className={`btn ${i === speedIdx ? 'gold' : 'ghost'}`} style={{ flex: 1 }}
                    title={t(s.name)} onClick={() => setSpeedIdx(i)}>{t(s.label)}</button>
                ))}
              </div>
              <div className="set-label">{t('matchday.tickerStops')}</div>
              <div className="btn-row ms-seg">
                <button className={`btn ${live.mode === 'full' ? 'gold' : 'ghost'}`} style={{ flex: 1 }}
                  onClick={() => matchMode('full')}>{t('matchday.everyMinute')}</button>
                <button className={`btn ${live.mode === 'highlights' ? 'gold' : 'ghost'}`} style={{ flex: 1 }}
                  onClick={() => matchMode('highlights')}>{t('matchday.highlightsBtn')}</button>
              </div>
              <div className="set-label">{t('mset.highlights')}</div>
              <div className="btn-row ms-seg">
                <button className={`btn ${prefs.highlights === 'key' ? 'gold' : 'ghost'}`} style={{ flex: 1 }}
                  title={t('mset.hlKeySub')} onClick={() => setPref({ highlights: 'key' })}>{t('mset.hlKey')}</button>
                <button className={`btn ${prefs.highlights === 'extended' ? 'gold' : 'ghost'}`} style={{ flex: 1 }}
                  title={t('mset.hlExtendedSub')} onClick={() => setPref({ highlights: 'extended' })}>{t('mset.hlExtended')}</button>
              </div>
              <div className="ms-note">{t(prefs.highlights === 'key' ? 'mset.hlKeySub' : 'mset.hlExtendedSub')}</div>
            </div>
            <div className="ms-toggles">
              {/* One switch, and it has to name everything it turns off. The
                  buzz used to survive Silent, so the label lied by omission. */}
              <Toggle on={sound} onChange={() => setSound(toggleSound())}
                label={t('matchday.soundAndBuzz')} sub={t(sound ? 'matchday.soundOn' : 'matchday.soundOff')} />
              <Toggle on={prefs.bigText} onChange={v => setPref({ bigText: v })}
                label={t('mset.bigText')} sub={t('mset.bigTextSub')} />
            </div>
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
          <ScoreCard label={t(atBreak ? 'matchday.breakSixty' : 'matchday.halfTime')} story />
        )}
        {atHalfTime && <HalfTimeWord />}
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
              {/* at the intervals the broadcast card above has the scorers */}
              {atDecision && <div className="card" style={{ margin: '8px 14px' }}>
                <div className="fact-label">{t('matchday.storySoFar')}</div>
                {scores.length === 0 && <div className="meta muted">{t('matchday.noScores')}</div>}
                {scores.map((e, i) => (
                  <div key={i} className="meta" style={{ display: 'flex', gap: 8 }}>
                    <span className="muted" style={{ flex: '0 0 26px' }}>{Math.min(80, e.min)}'</span>
                    <span style={{ flex: 1 }}>{e.playerId != null ? game.players[e.playerId]?.name ?? teamShort(game, e.teamId ?? '') : teamShort(game, e.teamId ?? '')}</span>
                    <b>{e.homeScore}-{e.awayScore}</b>
                  </div>
                ))}
              </div>}
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
            <ScoreCard label={t('matchday.fullTime')} />
            {/* THE WAY ON COMES FIRST (owner, 1.8.8, iOS: "Continue button
                should always be above match stats at end of game"). It was
                the last thing on the page, under the verdict, the stats, the
                ratings and the whole commentary, and with an advert over the
                foot of the screen it could not be reached at all. */}
            <button className="btn gold block ft-continue" onClick={finishMatch}>
              {t('matchday.continueToResults')}
            </button>
            <div className="review-grid">
              <div>
                <MatchVerdict />
                <MatchFindings />
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
                <span className="txt">{eventText(e)}</span>
              </div>
            ))}
          </>
        )}
      </div>
      )}
      {/* THE MATCH BANNER: ONLY WHILE A HIGHLIGHT IS PLAYING (owner, 1.8.7,
          from the iOS simulator). It used to be up for all of open play and
          sat over the live stats - "It shouldnt be over stats or lineups" -
          while under the pitch animation "it works really well". There is no
          bottom nav here to make room for it, so it goes up only when the
          highlight is the stage and comes down the moment the stats return.

          Still never at half time, the hour break, a penalty decision or full
          time, nor while the squad sheet, the drawer, the settings or an
          injury prompt is open: each of those is the game asking the manager
          for something. Never on a tablet, where the stats sit beside the
          feed under the pitch. A supporter never sees it at all. */}
      {clip && !panelActive && !tablet && !done && !atHalfTime && !atBreak && !atDecision
        && !sheet && !drawer && !settings && !injury && <AdSlot place="match-foot" />}
    </div>
  )
}

/** THE ASSISTANT'S WORD AT HALF TIME (1.8.2 depth): one or two plain lines
 *  read off what the first forty did against the referee and the day
 *  (conditions.ts halfTimeHints), and since 1.8.3 what is working and what
 *  is hurting, off the first half's evidence (evidence.ts htEvidence).
 *
 *  AND WHAT TO DO ABOUT IT (1.8.4). Under the hurting line, the touchline
 *  dial that answers its cause (evidence.ts LEVERS), as a tap that brings
 *  that dial on the panel below into view. Only where a dial measurably
 *  moves the count, and only in a club match, where the dials are his.
 *  Nothing drawn; silent when there is nothing worth saying. */
function HalfTimeWord() {
  const game = useStore(s => s.game)!
  const live = useStore(s => s.liveMatch)!
  const ctx = live.ctx
  const ev = game ? buildEvidence(game, ctx) : null
  if (!ev || !game) return null
  const [mine, opp] = halfSides(ev)
  const lines = halfTimeHints(refFor(ctx.fx.id), ctx.weather, mine, opp, !!ctx.uncontested, htEvidence(ev))
  if (!lines.length) return null
  const club = ctx.userSideId === game.userClubId
  const hurt = lines.find(l => l.tag === 'hurt')
  const lever = club && hurt?.cause ? LEVERS[hurt.cause as WhyCause] : undefined
  const info = lever ? SLIDER_INFO.find(s => s.key === lever.dial) : undefined
  // to the dial on the panel below, and a moment's ring round it
  const showDial = () => {
    const row = document.querySelector<HTMLElement>(`[data-dial="${lever!.dial}"]`)
    if (!row) return
    row.scrollIntoView({ block: 'center', behavior: 'smooth' })
    row.querySelector('input')?.focus({ preventScroll: true })
    row.style.outline = '2px solid var(--gold)'
    window.setTimeout(() => { row.style.outline = '' }, 1600)
  }
  return (
    <div className="card" style={{ margin: '8px 14px' }} data-halftime-word={lines.length}>
      <div className="fact-label">{t('matchday.htWord')}</div>
      {lines.map(l => (
        <div key={l.k} className="meta" data-ht-tag={l.tag} data-ht-cause={l.cause}>
          {l.tag && <b style={{ color: l.tag === 'work' ? 'var(--text-positive)' : 'var(--text-negative)' }}>{t(l.tag === 'work' ? 'matchday.htWorking' : 'matchday.htHurting')} </b>}
          {t(l.k, l.v)}
        </div>
      ))}
      {lever && info && (
        <button className="preset-chip" style={{ marginTop: 6 }} data-ht-lever={lever.dial} onClick={showDial}>
          <Glyph name="tactics" /> {t(lever.dir < 0 ? 'matchday.htLeverDown' : 'matchday.htLeverUp', { dial_k: info.label, n: game.clubs[game.userClubId].tactic[lever.dial] })}
        </button>
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
  // whoever will actually take it: the first choice may be in the bin
  const kicker = goalKicker(game, mine)

  const options = [
    {
      id: 'posts' as const, icon: 'posts', name: t('matchday.optPosts'),
      desc: t(diff < 0 && diff >= -3 ? 'matchday.optPostsDLead' : 'matchday.optPostsD',
        { kicker: kicker ? kicker.name : t('matchday.yourKicker') }),
    },
    {
      id: 'corner' as const, icon: 'attack', name: t('matchday.optCorner'),
      desc: t('matchday.optCornerD'),
    },
    {
      id: 'tap' as const, icon: 'bolt', name: t('matchday.optTap'),
      desc: t('matchday.optTapD'),
    },
  ]

  return (
    <div className="card" style={{ margin: '12px 0', borderLeft: '4px solid var(--danger)' }}>
      <h3 style={{ fontSize: 16 }}>{t('matchday.penCall')}</h3>
      <div className="meta" style={{ marginBottom: 8 }}>
        {t('matchday.penScore', { home: teamShort(game, mine.teamId), hs: mine.score, as: opp.score, away: teamShort(game, opp.teamId) })}
        {diff < 0 ? t('matchday.penBehind', { n: -diff }) : diff > 0 ? t('matchday.penAhead', { n: diff }) : t('matchday.penLevel')}
        {t('matchday.penMin', { min: ctx.lastMin })}
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {options.map(o => (
          <button key={o.id} className="btn ghost" style={{ textAlign: 'left', padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'center' }}
            onClick={() => decide(o.id)}>
            <span style={{ fontSize: 20 }}><Glyph name={o.icon} /></span>
            <span>
              <b style={{ display: 'block', fontSize: 14 }}>{o.name}</b>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** ONE FOLLOW-UP LINE (1.8.4): a count before and after, which way it went,
 *  and for the half-time one whether the answering dial moved at the break;
 *  for the match-to-match one, the new problem when another hurt more. */
function FollowLine({ f, label, pair, moved }: { f: Follow; label: string; pair: string; moved?: 'right' | 'wrong' | 'none' | null }) {
  const good = f.trend === 'improved' || f.trend === 'partly'
  const dial = LEVERS[f.cause] ? SLIDER_INFO.find(s => s.key === LEVERS[f.cause]!.dial) : undefined
  return (
    <div className="meta" data-follow={label.slice(-2) === 'Ht' ? 'half' : 'match'} data-trend={f.trend}
      style={{ borderLeft: `3px solid ${good ? 'var(--text-positive)' : f.trend === 'worse' ? 'var(--text-negative)' : 'var(--border)'}`, paddingLeft: 6, marginTop: 3 }}>
      <b>{t(label)} </b>
      {t(pair, { what_k: `matchday.fuM_${f.cause}`, a: f.a, b: f.b })}{' '}
      {t(`matchday.fuTrend_${f.trend}`)}
      {moved && dial && <>{' '}{t(`matchday.fuLever_${moved}`, { dial_k: dial.label })}</>}
      {f.now && <>{' '}{t('matchday.fuNow', { what_k: `matchday.fuM_${f.now}` })}</>}
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
  // WHY (1.8.3): the three causes that decided it, ranked, each with its
  // number (evidence.ts rankWhy). It replaced one sentence picked from the
  // possession share and the margin, which named nothing.
  const ev = buildEvidence(game, ctx)
  const why = ev ? rankWhy(ev, 3) : []
  // framed for the manager (1.8.4): which way each pulled, not a proof
  const leads = ev ? whyLeads(ev, why) : []
  // the call the report and the desk said they were set for, answered
  // (1.8.5, evidence.ts readTold): unlabelled, since it rarely decides much
  const told = ev && !why.some(w => w.cause === 'read') ? readTold(ev, toldCalls(ctx, ADAPT_WORTH)) : null
  // AND WHETHER IT WORKED (1.8.4, evidence.ts): what hurt at half time held
  // against the second half alone, with the dial that answers it as he left
  // it at the break; and what hurt most last match held against this one.
  // Read before the filing at the whistle puts this match on the record.
  const half = ev ? halfFollow(ev, ctx.htEv) : null
  const moved = half ? leverMoved(half.cause, ctx.htDials, ctx.shDials) : null
  const prev = ev ? prevEvidence(game, ev) : null
  const follow = ev && prev ? matchFollow(prev, ev) : null
  // the new problem goes unsaid when the line above already leads with it
  const hurtLed = why.find((_, i) => leads[i] === 'matchday.leadHurt')?.cause
  const last = follow && follow.now === hurtLed ? { ...follow, now: undefined } : follow
  // The verdict used to stop at one sentence, which named nothing (user:
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
  const hw = homeworkFor(game, live.fixture.id, opp.teamId)
  const fresh = !!hw
  // "using the bench" is a job you DO, so it is graded on evidence rather than
  // on the complaint staying quiet - ctx.subsUsed is the only honest witness.
  // Two changes, not one (1.8.1): the bench advice itself speaks below two
  // and asks for "the two or three", so a single change had the homework
  // marked done on a match where the advice would have been given again.
  const grade = fresh && hw
    ? gradeHomework(game, ctx, mine, opp, myClub?.tactic ?? null, hw.tags as FixTag[])
    : { fixed: [], missed: [] }
  const verdictOnLast = gradeLine(grade.fixed, grade.missed)

  // and then this match's two become the homework: since 1.8.4 set where the
  // match is filed (coachfix fileHomework), so a match the assistant played
  // sets it too
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
          <span className="form-pill" style={{ background: 'var(--text-positive)', fontSize: 16 }}>
            {/* the published mark, as the findings and the ratings table print it (1.8.15: this read the running in-match number, so one man was "8.5" here and "10.0" two lines below) */}
            {ctx.motmId != null ? (mine.finalR?.get(ctx.motmId) ?? opp.finalR?.get(ctx.motmId) ?? mine.ratings.get(ctx.motmId) ?? opp.ratings.get(ctx.motmId) ?? 7).toFixed(1) : ''}
          </span>
        </div>
      )}
      <div className="fact-label" style={{ marginTop: 8 }}>{t('matchday.coachsVerdict')}</div>
      {why.map((w, i) => (
        <div key={w.cause} className="meta" data-why={w.cause} data-why-lead={leads[i] ?? undefined}
          style={{ borderLeft: `3px solid ${w.sig > 0 ? 'var(--text-positive)' : 'var(--text-negative)'}`, paddingLeft: 6, marginTop: 3 }}>
          {leads[i] && <b>{t(leads[i]!)} </b>}
          {t(w.k, w.v)}
        </div>
      ))}
      {verdictOnLast && (
        <div className={`fix-grade${grade.missed.length === 0 ? ' good' : ''}`}>
          <Glyph name={grade.missed.length === 0 ? 'check' : 'tactics'} /> {verdictOnLast}
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
                <b style={{ display: 'block', fontSize: 13 }}>{f.head}</b>
                <span className="muted" style={{ fontSize: 12 }}>{f.how}</span>
              </span>
            </div>
          ))}
        </>
      )}

      {/* INFORMATION HIERARCHY (1.8.6): the verdict, then what to change,
          then the memory: who you let go, the call he was set for, whether the
          half-time change and last week's problem moved. Everything stays;
          the order is the point. */}
      <div className="ft-context">
        {(() => {
          // A MAN YOU LET GO DECIDED IT (1.8.5, memory.ts formerDecided)
          const fs = formerDecided(game, opp.teamId, mine.score, opp.score, ctx.events, ctx.motmId ?? null)
          return fs.map(f => <div key={f.p} className="meta" data-former-ft={f.p} style={{ marginTop: 6 }}>{t(f.k, f.v)}</div>)
        })()}
        {told && (
          <div className="meta" data-why="read" data-why-told="1" style={{ borderLeft: '3px solid var(--border)', paddingLeft: 6, marginTop: 3 }}>
            {t(told.k, told.v)}
          </div>
        )}
        {half && <FollowLine f={half} label="matchday.fuSinceHt" pair="matchday.fuHalves" moved={moved} />}
        {last && <FollowLine f={last} label="matchday.fuSinceLast" pair="matchday.fuMatches" />}
      </div>
      {/* the unit percentages, and the match analysis and stats below say
          the same thing at length: folded, the way the talk sheet folds the
          room (1.8.6) */}
      <details className="mood-fold ft-units">
      <summary>{t('matchday.unitBattlesTitle')}</summary>
      {units.map(({ key, label, pct, verdict }) => {
        const color = pct >= 52 ? 'var(--text-positive)' : pct <= 48 ? 'var(--text-negative)' : undefined
        // the verdict is a token, not a phrase: 'we edged it' and 'ils l'ont
        // emporté de peu' put the subject in different places, so each whole
        // half-sentence is its own key
        return (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
            <span style={{ color: 'var(--text-secondary)' }}>{t(label)}</span>
            <span><b style={{ color, fontFamily: 'var(--cond)', fontSize: 14 }}>{pct}%</b>
              <span className="muted">{t(`matchday.uw${verdict[0].toUpperCase()}${verdict.slice(1)}`)}</span>
            </span>
          </div>
        )
      })}
      </details>
    </div>
  )
}

/**
 * THE BROADCAST CARD (owner, 25 Sep 2026, idea 5): half-time, the hour and
 * full time as a television would put them up. Both crests and the score, who
 * got the points (tries with their minutes, kicks as a row of marks). The
 * numbers are the Match Stats panel's, which sits under it and fills its bars
 * in as it opens; one list of them, not two.
 *
 * Everything on it is read from the events; nothing is computed that the
 * engine did not say.
 */
function ScoreCard({ label, story = false }: { label: string; story?: boolean }) {
  const game = useStore(s => s.game)!
  const live = useStore(s => s.liveMatch)!
  const { fixture, ctx } = live
  const shown = ctx.events.slice(0, live.cursor)
  const last = shown[shown.length - 1]
  const hs = last?.homeScore ?? 0
  const as = last?.awayScore ?? 0
  const scorers = (teamId: string) => {
    const tries = new Map<string, number[]>()
    const kicks = new Map<string, { c: number; p: number; dg: number }>()
    for (const e of shown) {
      if (e.teamId !== teamId) continue
      const full = e.playerId != null ? game.players[e.playerId]?.name : e.playerName
      if (!full) continue
      const who = full.split(' ').slice(-1)[0]
      if (e.type === 'TRY') tries.set(who, [...(tries.get(who) ?? []), Math.min(80, e.min)])
      else if (e.type === 'CON' || e.type === 'PEN' || e.type === 'DG') {
        // counted, in the scoreline's own shorthand (2c, 1p, 1dg), not a row of emoji
        const k = kicks.get(who) ?? { c: 0, p: 0, dg: 0 }
        if (e.type === 'CON') k.c++; else if (e.type === 'PEN') k.p++; else k.dg++
        kicks.set(who, k)
      }
    }
    return (
      <div className="sc-scorers">
        {[...tries].map(([who, mins]) => <div key={`t${who}`}><Glyph name="ball" /> {who} <span className="muted">{mins.map(m => `${m}'`).join(' ')}</span></div>)}
        {[...kicks].map(([who, k]) => <div key={`k${who}`}><Glyph name="posts" /> {who} <span className="muted">({[k.c && `${k.c}c`, k.p && `${k.p}p`, k.dg && `${k.dg}dg`].filter(Boolean).join(', ')})</span></div>)}
      </div>
    )
  }
  return (
    <div className="card score-card">
      <div className="sc-head">{label}</div>
      <div className="sc-teams">
        <div className="sc-team"><CrestT g={game} teamId={fixture.homeId} size={34} /><span>{teamShort(game, fixture.homeId)}</span></div>
        <div className="sc-score">{hs}<i>–</i>{as}</div>
        <div className="sc-team"><CrestT g={game} teamId={fixture.awayId} size={34} /><span>{teamShort(game, fixture.awayId)}</span></div>
      </div>
      {/* at a stoppage this IS the story so far (audit 20E), and says so */}
      {story && <div className="fact-label sc-story">{t('matchday.storySoFar')}</div>}
      <div className="sc-lists">
        {scorers(fixture.homeId)}
        {scorers(fixture.awayId)}
      </div>
    </div>
  )
}

// VISITS TO THE 22, and what each side came away with (1.8.0). Owner-led
// research: the "we were robbed" feeling comes from stats that show
// dominance without showing why it failed. Nine visits and ten points is
// the reason a side lost, and now it is on the screen. The count itself is
// the engine's (visitsTo22), shared with the Visits panel so the two can
// never disagree.
function visitStats(shown: MatchEvent[], homeId: string, home: boolean): [number, number] {
  const v = visitsTo22(shown, homeId, home)
  return [v.visits, v.pts]
}

const perVisit = (p: number, v: number) => v ? Math.round((p / v) * 10) / 10 : 0

/**
 * THE SCORING ROWS READ THE TICKER, NOT THE ENGINE (1.8.0). The engine plays a
 * tick ahead of the lines on screen (and further when a highlight looks
 * ahead), so a total read off the match sheet put a try, a kick or a card on
 * the stats before the commentary had got to it: an 18-0 scoreboard beside
 * four kicks from four. These are counted from what has been shown; kicks
 * from the engine's kick log up to the line the ticker is on.
 */
function shownStats(live: { ctx: { kickLog?: [number, 0 | 1, 0 | 1][] }; cursor: number },
  shown: MatchEvent[], homeId: string, sheet: [[number, number], [number, number]]) {
  const side = (e: MatchEvent) => (e.teamId === homeId ? 0 : 1)
  const tries: [number, number] = [0, 0], cards: [number, number] = [0, 0]
  for (const e of shown) {
    if (!e.teamId) continue
    if (e.type === 'TRY' && e.fx !== 'TMO' && e.fx !== 'NOTRY') tries[side(e)]++
    if (e.type === 'YC' || e.type === 'RC') cards[side(e)]++
  }
  let kicks = sheet
  if (live.ctx.kickLog) {
    const k: [[number, number], [number, number]] = [[0, 0], [0, 0]]
    for (const [at, who, made] of live.ctx.kickLog) {
      if (at >= live.cursor) continue
      k[who][1]++
      k[who][0] += made
    }
    kicks = k
  }
  return { tries, cards, kicks }
}

/**
 * THE LIVE STATS (1.8.0): what fills the screen between highlights, as FM's
 * match screen does. The match sheet's own numbers (matchStats) plus the two
 * read off the lines shown so far: territory, and visits to the opposition 22.
 * Two columns, a split bar per row in the clubs' colours.
 */
function LiveStats({ shown }: { shown: MatchEvent[] }) {
  const game = useStore(s => s.game)!
  const live = useStore(s => s.liveMatch)!
  const st = matchStats(live.ctx)
  const homeId = live.fixture.homeId
  const kits = kitColours(pageSpares(tokenColor), game.clubs[homeId]?.colors, game.clubs[live.fixture.awayId]?.colors)
  const col = (id: string) => {
    if (!game.clubs[id]?.colors) return 'var(--text-muted)'
    return (id === homeId ? kits.home : kits.away)[0]
  }
  // TERRITORY is where the ball has been on average: 50 is halfway, and the
  // further up the away side's end the play has lived the bigger the home
  // share. (Counting lines either side of halfway swung to 0 and 100 on a
  // handful of lines early in a match.)
  const withF = shown.filter(e => e.fld != null)
  const homeTerr = withF.length ? Math.round(withF.reduce((a, e) => a + e.fld!, 0) / withF.length) : 50
  const [hv, hp] = visitStats(shown, homeId, true), [av, ap] = visitStats(shown, homeId, false)
  const shownSt = shownStats(live, shown, homeId, st.goalKicks)
  const [gk0, gk1] = shownSt.kicks
  // a row: the label, the two numbers the bar splits, and how each side reads
  type Row = [string, [number, number], ((i: 0 | 1) => string)?]
  const pct = (v: [number, number]) => (i: 0 | 1) => `${v[i]}%`
  const rows: Row[] = [
    [t('matchday.stPossession'), st.possession, pct(st.possession)],
    [t('matchday.stTerritory'), [homeTerr, 100 - homeTerr], pct([homeTerr, 100 - homeTerr])],
    [t('matchday.stTries'), shownSt.tries],
    [t('matchday.st22'), [hv, av]],
    [t('matchday.stPerVisit'), [perVisit(hp, hv), perVisit(ap, av)], i => (i ? perVisit(ap, av) : perVisit(hp, hv)).toFixed(1)],
    // the bar is the success rate, so 4 from 4 beats 5 from 9
    [t('matchday.stGoalKicks'), [gk0[1] ? gk0[0] / gk0[1] : 0, gk1[1] ? gk1[0] / gk1[1] : 0], i => `${(i ? gk1 : gk0)[0]}/${(i ? gk1 : gk0)[1]}`],
    [t('matchday.stTackles'), st.tackles],
    [t('matchday.stScrums'), st.scrumsWon],
    [t('matchday.stLineouts'), st.lineoutsWon],
    [t('matchday.stCards'), shownSt.cards],
  ]
  return (
    <div className="live-stats" data-testid="live-stats">
      {/* the crests carry the three-letter code; a tablet shows them in
          place of the names, which ran into each other and into the title in
          its narrow panel (owner, tablet round: "can you use team logos") */}
      <div className="ls-head">
        <span><i className="ls-crest"><CrestT g={game} teamId={homeId} size={30} mr={0} /></i><i className="ls-name">{teamShort(game, homeId)}</i></span>
        <b>{t('matchday.liveStats')}</b>
        <span><i className="ls-name">{teamShort(game, live.fixture.awayId)}</i><i className="ls-crest"><CrestT g={game} teamId={live.fixture.awayId} size={30} mr={0} /></i></span>
      </div>
      {rows.map(([label, v, fmt]) => {
        const share = v[0] + v[1] > 0 ? v[0] / (v[0] + v[1]) : 0.5
        return (
          <div key={label} className="ls-row">
            <b>{fmt ? fmt(0) : v[0]}</b>
            <span className="ls-mid">
              <span className="ls-label">{label}</span>
              <span className="ls-bar">
                <i style={{ width: `${(share * 100).toFixed(1)}%`, background: col(homeId) }} />
                <i style={{ width: `${((1 - share) * 100).toFixed(1)}%`, background: col(live.fixture.awayId) }} />
              </span>
            </span>
            <b>{fmt ? fmt(1) : v[1]}</b>
          </div>
        )
      })}
    </div>
  )
}

function StatsPanel() {
  const game = useStore(s => s.game)!
  const live = useStore(s => s.liveMatch)!
  const st = matchStats(live.ctx)
  const shown = live.ctx.events.slice(0, live.cursor)
  const homeId = live.fixture.homeId
  const [hv, hp] = visitStats(shown, homeId, true), [av, ap] = visitStats(shown, homeId, false)
  const shownSt = shownStats(live, shown, homeId, st.goalKicks)
  const [gk0, gk1] = shownSt.kicks
  const kits = kitColours(pageSpares(tokenColor), game.clubs[homeId]?.colors, game.clubs[live.fixture.awayId]?.colors)
  const colour = (id: string) => (id === homeId ? kits.home : kits.away)[0]
  // Each row carries a split bar in the two clubs' colours, and the bars fill
  // in one after another as the panel opens (idea 5: "the match stats panel
  // animating"). Transform only, so the fill is compositor work.
  let n = 0
  const row = (label: string, v: [number, number], pct = false, text?: [string, string]) => {
    const share = v[0] + v[1] > 0 ? v[0] / (v[0] + v[1]) : 0.5
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
        <b style={{ width: 34, textAlign: 'right', fontFamily: 'var(--cond)', fontSize: 16 }}>{text ? text[0] : `${v[0]}${pct ? '%' : ''}`}</b>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--cond)', textTransform: 'uppercase', letterSpacing: 1, fontSize: 12 }}>{label}</span>
          <span className="stat-bar" style={{ '--d': `${150 + n++ * 110}ms` } as CSSProperties}>
            <i className="h" style={{ transform: `scaleX(${share.toFixed(3)})`, background: colour(live.fixture.homeId) }} />
            <i className="a" style={{ transform: `scaleX(${(1 - share).toFixed(3)})`, background: colour(live.fixture.awayId) }} />
          </span>
        </span>
        <b style={{ width: 34, fontFamily: 'var(--cond)', fontSize: 16 }}>{text ? text[1] : `${v[1]}${pct ? '%' : ''}`}</b>
      </div>
    )
  }
  return (
    <div className="card" style={{ margin: '12px 0' }}>
      <h3 style={{ fontSize: 14, textAlign: 'center' }}>
        {t('matchday.statsTitle', { home: teamShort(game, live.fixture.homeId), away: teamShort(game, live.fixture.awayId) })}
      </h3>
      {row(t('matchday.stPossession'), st.possession, true)}
      {row(t('matchday.stTries'), shownSt.tries)}
      {row(t('matchday.stScrums'), [st.scrumsWon[0], st.scrumsWon[1]])}
      {row(t('matchday.stLineouts'), [st.lineoutsWon[0], st.lineoutsWon[1]])}
      {row(t('matchday.stTackles'), st.tackles)}
      {row(t('matchday.st22'), [hv, av])}
      {row(t('matchday.stPerVisit'), [perVisit(hp, hv), perVisit(ap, av)], false, [perVisit(hp, hv).toFixed(1), perVisit(ap, av).toFixed(1)])}
      {row(t('matchday.stGoalKicks'), [gk0[1] ? gk0[0] / gk0[1] : 0, gk1[1] ? gk1[0] / gk1[1] : 0], false, [`${gk0[0]}/${gk0[1]}`, `${gk1[0]}/${gk1[1]}`])}
      {row(t('matchday.stCards'), shownSt.cards)}
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
            <td className="name">{p!.name}{ctx.motmId === p!.id ? <> <Glyph name="star" /></> : ''}</td>
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

  // six tones, in the order a manager reaches for them: the steadying ones,
  // the lifting ones, the stakes-raising ones (teamtalk.ts reads each man)
  const talks: readonly (readonly [HtTone, string])[] = [
    ['calm', 'matchday.talkCalm'],
    ['faith', 'matchday.talkFaith'],
    ['praise', 'matchday.talkPraise'],
    ['fire', 'matchday.talkFire'],
    ['demand', 'matchday.talkDemand'],
    ['criticise', 'matchday.talkCriticise'],
  ]

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
      <h3 style={{ fontSize: 16 }}>{title}</h3>
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
              <button key={k} className="btn ghost" style={{ fontSize: 13, padding: '9px 6px' }}
                onClick={() => teamTalk(k)}>{t(label)}</button>
            ))}
          </div>
        </>
      ) : ctx.htReads?.length ? (
        <TalkReactions game={game} reads={ctx.htReads} lineup={mine.lineup} msg={live.talkMsg} />
      ) : live.talkMsg && (
        <div className="meta" style={{ margin: '6px 0' }}>{live.talkMsg}</div>
      ))}

      {isClubMatch && <>
      <div className="fact-label" style={{ marginTop: 12 }}>{t('matchday.quickPlans')}</div>
      <div className="preset-row">
        {PRESETS.map(p => (
          <button key={p.id} className="preset-chip" title={t(p.desc)}
            onClick={() => {
              // the prep plan this sets aside, said as it happens (1.8.5):
              // full time judges it on the part of the match it was played for
              const opp = mine === ctx.home ? ctx.away : ctx.home
              const plan = currentPlan(game, opp.teamId)
              const had = !!plan && planFollowed(game, plan)
              applyPreset(p.values)
              const aside = had && !planFollowed(game, plan!) ? ` ${t(ctx.tick >= 10 ? 'matchday.planAside' : 'matchday.planAsideEarly', { plan: t(`oppreport.plan_${plan!.id}`) })}` : ''
              setExplain(`${t(p.name)}: ${t(p.desc)}${aside}`)
            }}>
            <Glyph name={p.icon} /> {t(p.name)}
          </button>
        ))}
      </div>

      <div className="fact-label" style={{ marginTop: 10 }}>{t('matchday.inMatchTactics')} <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{t('matchday.tapAName')}</span></div>
      {SLIDER_INFO.map(s => (
        <div key={s.key} data-dial={s.key} className="dial-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0', borderRadius: 6 }}>
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
      <div className="fact-label" style={{ marginTop: 12 }}>{t('matchday.replacementsLeft', { left: usableChanges(game, mine, ctx.subsUsed), max: MAX_SUBS })}</div>
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

/** Replacements the user can still make: the law's count, capped by the fit men
 *  left on the bench. The engine keeps its own count; this is what we show. */
function usableChanges(game: { players: Record<number, Player> }, side: SideCtx, subsUsed: number): number {
  const fit = side.lineup.slice(15).filter(id => {
    const p = id != null ? game.players[id] : null
    return !!p && !p.injury && !side.onPitch.has(p.id) && !side.ratings.has(p.id)
  }).length
  return Math.max(0, Math.min(MAX_SUBS - subsUsed, fit))
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
export function SquadSheet({ onClose, freeCoverId, title, note, hurtName, hurtDesc, hurtId, mustDecide, onTactics }: {
  onClose: () => void
  /** The man the assistant sent on to cover an injury. Swapping him is free. */
  freeCoverId?: number
  title?: string
  note?: string
  /** The injured man, named in the sheet body as well as the heading, because the
   *  heading scrolls out of reach on a phone once the bench is in view. */
  hurtName?: string
  hurtDesc?: string
  /** the injured man's id, so the sheet can say what his shirt needs */
  hurtId?: number
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
  // THE FREE OVERRIDE ONLY EXISTS WHILE THE ASSISTANT'S MAN IS OUT THERE TO BE
  // TAPPED. If he is not (nobody could go on, or the law took him straight back
  // off), there is nothing to override and nothing to wait for: the side plays
  // on with what it has, and the sheet can always be closed (owner, round 6:
  // "I can't continue in the game").
  const live0 = live.ctx.home.teamId === live.ctx.userSideId ? live.ctx.home : live.ctx.away
  const coverOn = freeCoverId != null && live0.onPitch.has(freeCoverId) && live0.lineup.slice(0, 15).includes(freeCoverId)
  const [offId, setOffId] = useState<number | null>(coverOn ? freeCoverId! : null)
  const [freeLeft, setFreeLeft] = useState(coverOn)
  /** a decision has been made: a change, a swap, or keeping the assistant's man.
   *  A refused tap is not one, so it does not open the door. */
  const [decided, setDecided] = useState(false)
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
  // the law allows MAX_SUBS; the bench may hold fewer fit men than that
  const lawLeft = MAX_SUBS - ctx.subsUsed

  // The XV in shirt order, because that is how a team sheet reads and how the
  // man you are looking for is found.
  // the number he walked out in: a replacement in 23 stays 23 (1.8.16)
  const xv = mine.lineup.slice(0, 15).map((id, i) => ({
    shirt: (id != null ? shirtNumber(mine, id) : undefined) ?? i + 1,
    p: id != null ? game.players[id] : null,
  })).filter((r): r is { shirt: number; p: Player } => !!r.p)

  const bench = mine.lineup.slice(15)
    .map(id => (id != null ? game.players[id] : null))
    .filter((p): p is Player => !!p && !p.injury && !mine.onPitch.has(p.id) && !mine.ratings.has(p.id))
  // CHANGES YOU CAN ACTUALLY MAKE (owner, round 2): the header said "6 changes
  // left" with four fit men on the bench after injuries. The number shown and the
  // number allowed are both the smaller of the law's count and the usable bench.
  const left = Math.min(lawLeft, bench.length)

  const off = offId != null ? game.players[offId] : null
  // THE SHIRT, NOT THE MAN WEARING IT. With the assistant's cover armed, the
  // shirt being filled is the injured man's: a back sent on for a flanker is
  // wearing 6, and the bench should be read for 6, not for wherever the back
  // usually plays.
  const offSlot = offId != null ? mine.lineup.indexOf(offId) : -1
  const shirtPos: Pos | null = off ? (offSlot >= 0 && offSlot < 15 ? XV_SLOTS[offSlot].pos : off.pos) : null
  // Natural cover first, same as the engine's own bench discipline, so the
  // like-for-like choice is the one at the top of the list. Everybody else is
  // still a choice: any fit man can take any shirt but the front row's.
  const covers = (p: Player) => !!shirtPos && (p.pos === shirtPos || p.alt.includes(shirtPos))
  const benchSorted = [...bench].sort((a, b) => Number(covers(b)) - Number(covers(a)) || b.ca - a.ca)

  // Swapping the injury cover is free and does not burn one of them, so it
  // routes through injuryCover rather than a normal substitution.
  const isFreeSwap = freeLeft && offId != null && offId === freeCoverId
  // shirts 1 to 3 want a trained front-rower while there is one (needsFrontRower);
  // when there is none, anybody may go on and the scrums go uncontested
  const frShirt = offSlot >= 0 && offSlot <= 2
  const frOnly = off ? needsFrontRower(game, mine, off.id, isFreeSwap ? off.id : undefined) : false
  const blocked = (p: Player) => frOnly && !isFrontRower(p)
  const hurtP = hurtId != null ? game.players[hurtId] : null
  const doSub = (inP: Player) => {
    if (offId == null || blocked(inP)) return
    const msg = isFreeSwap ? injuryCover(offId, inP.id) : halfTimeSub(offId, inP.id)
    // the engine has the last word: a refused change changes nothing here either
    if (!mine.onPitch.has(inP.id)) { setLog(l => [msg, ...l].slice(0, MAX_SUBS)); return }
    if (isFreeSwap) setFreeLeft(false)
    // the display list holds the whole bench now rather than four of it, because a
    // log that quietly drops entries is what made the count wrong in the first place
    setLog(l => [msg, ...l].slice(0, MAX_SUBS))
    setMade(n => n + 1)
    setDecided(true)
    setOffId(null)
  }

  // a forced stop is satisfied by any change, including keeping the assistant's
  // man - tapping him again is a decision, it is just the same decision
  const settled = !mustDecide || decided || !freeLeft
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
              <Glyph name="medical" /> <b>{hurtName}</b>{t('matchday.casualty')}{hurtDesc ? t('matchday.casualtyDesc', { desc: hurtDesc }) : ''}
            </div>
          )}
          {hurtP && ctx.uncontested && (
            <div className="meta sheet-hint" style={{ fontWeight: 700 }}>{t('matchday.injUncontested')}</div>
          )}
          <div className="meta sheet-hint">
            {note ? <>{note}{' '}</> : null}
            {hurtP && !coverOn && bench.length === 0 ? t('matchday.injNoCover')
              : isFreeSwap && off ? t('matchday.hintFree', { player: off.name })
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
                  disabled={!on || (lawLeft <= 0 && !canFree)}
                  onClick={() => {
                    // Re-tapping the man the assistant sent on means "he stays".
                    // That is a decision, so it settles a forced stop - and it has
                    // to be answerable here, because he is already on the pitch
                    // and so never appears in the bench column.
                    if (canFree && offId === p.id) {
                      setFreeLeft(false)
                      setDecided(true)
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
                      setDecided(true)
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
                  {binned && <span className="sh-flag" title={t('matchday.inTheBin')} style={{ color: 'var(--gold)' }}><Glyph name="card" /></span>}
                  {p.injury && <span className="sh-flag" title={t('matchday.injuredFlag')}><Glyph name="medical" /></span>}
                  {/* A man off the pitch who is neither binned nor hurt was sent
                      off - a substituted man leaves the lineup entirely, so this
                      is the only remaining way to be gone. Without the flag his
                      row was just dead grey with no reason on it, which is how
                      subreach failed one suite run and taught the sheet to say
                      why (round 23). */}
                  {!on && !binned && !p.injury && <span className="sh-flag" title={t('matchday.sentOff')} style={{ color: 'var(--danger)' }}><Glyph name="card" /></span>}
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
            <div className="fact-label">{shirtPos ? t('matchday.benchCover', { pos: posName(shirtPos) }) : t('matchday.bench')}</div>
            {/* the front row is the one shirt with a rule on it, said where the
                choice is made rather than discovered as a refusal */}
            {off && frShirt && benchSorted.length > 0 && (frOnly || !ctx.uncontested) && (
              <div className="meta sheet-frnote">{t(frOnly ? 'matchday.frOnlyNote' : 'matchday.frNoneNote')}</div>
            )}
            {benchSorted.length === 0 && <div className="meta">{t('matchday.benchEmpty')}</div>}
            {benchSorted.map(p => {
              // what he was told before kick-off, so the choice is informed (F4)
              const seat = mine.seatOf.get(p.id)
              const brief = seat != null ? briefForSeat(game.clubs[mine.teamId], seat) : 'orders'
              return (
                <button key={p.id} className={`sheet-row ${off && covers(p) ? 'cover' : ''}`}
                  disabled={!off || (left <= 0 && !isFreeSwap) || blocked(p)}
                  onClick={() => doSub(p)}>
                  <span className="sh-num">{p.pos}</span>
                  <span className="sh-name">{p.name}</span>
                  {brief !== 'orders' && (
                    <span className="sh-flag" title={t(BRIEF_BY_ID[brief].name)}><BriefIcon brief={brief} /></span>
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
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0', fontSize: 12 }}>
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
