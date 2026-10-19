// The match as it is played: the ticker, the pitch, the controls and the sheets.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../../../store'
import { teamShort, refFor, MAX_SUBS, shirtNumber } from '../../../game/matchEngine'
import { eventText, injuryDesc, tieWinner, type MatchEvent } from '../../../game/model'
import { isKnockoutTie } from '../../../game/season'
import { t, localeTag, compLabel } from '../../../game/i18n'
import { MatchFindings } from '../../OppReport'
import { CrestT, Toggle } from '../../components'
import { stageName } from '../Home'
import { matchSfx, soundOn, toggleSound } from '../../audio'
import { TalkReactions } from '../../TalkReactions'
import { MatchPanels } from '../../MatchPanels'
import { useTablet } from '../../tablet'
import { readMatchPrefs, writeMatchPrefs, type MatchPrefs } from '../../matchPrefs'
import { AdSlot } from '../../AdSlot'
import { HighlightClip, buildClip, nextMoment, tokenColor, type ClipSpec } from '../../HighlightClip'
import { sortTable } from '../../../game/schedule'
import { kitColours, kitInk, pageSpares } from '../../kit'
import { IcoFastForward, IcoPause, IcoPeople, IcoPlay } from '../../icons'
import { Glyph } from '../../glyphs'
import { MatchAnnouncer } from '../../MatchAnnouncer'
import { DecisionPanel, HalfTimeWord } from './Panels'
import { RatingsPanel } from './Ratings'
import { ScoreCard } from './ScoreCard'
import { SquadSheet, usableChanges } from './SquadSheet'
import { LiveStats, StatsPanel } from './Stats'
import { TouchlinePanel } from './Touchline'
import { MatchVerdict } from './Verdict'
import { FEED_ROWS, useFeedGlide } from './feedGlide'
import { WEATHER_ICON, weatherWord } from './weather'
import { Veil } from '../../Veil'

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

export function Live() {
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
  const [injury, setInjury] = useState<{ hurt: string; hurtId: number; desc: string; weeks: number; coverId: number | null; wait?: boolean; hia?: boolean } | null>(null)
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
  const waitSeen = useRef<number>(-1)
  useEffect(() => {
    // THE MATCH WAITS FOR HIM (1.9.1). In a match begun on this build nobody
    // has gone on yet: the engine holds the clock (injWait) until he names
    // the man. The sheet opens once the injury's own line has been read, and
    // also when the ticker has jumped past it (Key Moments, a clip), because
    // the match cannot go on without an answer.
    const pend = ctx.injWait?.find(w => (w.home ? ctx.home : ctx.away).teamId === ctx.userSideId && cursor > w.at)
    if (pend) {
      if (injury || waitSeen.current === pend.at) return
      const hurt = game.players[pend.hurtId]
      if (!hurt?.injury) return
      waitSeen.current = pend.at
      // and the line itself is answered: the sheet below must not open again
      // for it once his man is on
      injSeen.current = Math.max(injSeen.current, cursor)
      matchCursor(cursor, false)
      setDrawer(false)
      setSettings(false)
      setInjury({ hurt: hurt.name, hurtId: hurt.id, desc: injuryDesc(hurt.injury), weeks: hurt.injury.weeks ?? 0, coverId: null, wait: true })
      return
    }
    if (cursor <= 0 || cursor <= injSeen.current) return
    const e = events[cursor - 1]
    if (!e || e.type !== 'INJ' || e.teamId !== ctx.userSideId || e.playerId == null) return
    const hurt = game.players[e.playerId]
    // A HEAD ASSESSMENT STOPS THE GAME TOO (1.9.2, owner: "its auto replaced
    // him. Its confusing to people who dont know what to press"). He is not
    // injured, he is off for checks, and the assistant's stand-in is on: the
    // sheet says so and lets the manager keep him or send another man on.
    if (hurt && (e.k === 'comm.hiaLedAway' || e.k === 'comm.hiaMouthguard')) {
      const side = ctx.home.teamId === e.teamId ? ctx.home : ctx.away
      const h = side.hia && side.hia.pid === hurt.id ? side.hia : null
      injSeen.current = cursor
      matchCursor(cursor, false)
      setDrawer(false)
      setSettings(false)
      setInjury({ hurt: hurt.name, hurtId: hurt.id, desc: '', weeks: 0, coverId: h?.subId ?? null, hia: true })
      return
    }
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
        turnover: t('hl.turnover'), saved: t('hl.saved'), heldup: t('hl.heldup') },
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

  const kits = kitColours(pageSpares(tokenColor), game.clubs[fixture.homeId]?.colors, game.clubs[fixture.awayId]?.colors)
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
      background: kitInk(fill).fill, color: kitInk(fill).ink,
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
    return { '--flash-bg': kitInk(fill).ink, '--flash-fg': kitInk(fill).fill } as React.CSSProperties
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
      <MatchAnnouncer game={game} shown={shown} homeId={fixture.homeId} awayId={fixture.awayId} />
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
          title={t(injury.hia ? 'matchday.hiaOff' : 'matchday.injOff', { player: injury.hurt })}
          hurtName={injury.hurt}
          hurtDesc={injury.hia ? t('matchday.hiaDesc') : t('matchday.injDesc', { desc: injury.desc, n: injury.weeks })}
          hurtId={injury.hurtId}
          note={injury.coverId != null ? t(injury.hia ? 'matchday.hiaNote' : 'matchday.injNote') : undefined}
          freeCoverId={injury.coverId ?? undefined}
          waitId={injury.wait ? injury.hurtId : undefined}
          /* forced: the physio is on, the clock is stopped, and the only way back
             to the match is through naming somebody */
          mustDecide
          onClose={() => { setInjury(null); matchCursor(cursor, true) }}
        />
      )}

      {settings && (
        <Veil onClose={() => setSettings(false)} boxClassName="modal settings-sheet">
          <div className="grab" />
          <h3 style={{ fontSize: '1rem', margin: '2px 16px 8px' }}>{t('matchday.matchSettings')}</h3>
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
        </Veil>
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
