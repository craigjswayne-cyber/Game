// The whistles and the final whistle: half time, full time, finalizeMatch,
// forfeits and knockout records. Split out of matchEngine.ts, which
// re-exports the public parts.
import type { Fixture, GameState, MatchEvent, Player } from '../model'
import { addGrudge, fmtMoney, oldBoyApps } from '../model'
import { updateNatRank } from '../natrank'
import { talkMorale } from '../teamtalk'
import { nationNameIn, nationVars } from '../nations'
import { isDerby } from '../rivalries'
import { tIn } from '../i18n'
import { clamp, gauss } from '../rng'
import { rememberDebut } from '../memory'
import { buildEvidence } from '../evidence'
import { availablePlayers, teamShort } from './selection'
import { minutesPlayed } from './field'
import type { SideCtx } from './side'
import type { SimResult } from './lines'
import { type LiveCtx, pushLine, userDials } from './live'
import { FW_POS, teamRatingTerm } from './energy'

/**
 * Simulate the next 4-minute tick. Returns what the clock hit:
 * 'play' (normal), 'HT' (40'), 'BRK' (60'), 'FT' (80', match finalised).
 * At HT/BRK the context waits (`awaiting`) until resumed.
 */
/**
 * Blow half time: the whistle line, the interval numbers, and the break.
 *
 * Split out of stepTick so it can fire LATER than the tick that reached 40'.
 * A penalty awarded in the closing minutes is still the manager's to answer,
 * and the answer cannot arrive before stepTick returns - so when a call is
 * outstanding the clock reaches the whistle and the whistle waits.
 */
export function blowHalfTime(state: GameState, ctx: LiveCtx) {
  ctx.heldWhistle = null
  ctx.awaiting = 'HT'
  halfTimeRecovery(ctx)
  pushLine(state, ctx, 40, 'HT', null, 'comm.halfTime', {
    home: teamShort(state, ctx.fx.homeId), away: teamShort(state, ctx.fx.awayId),
    hs: ctx.home.score, ascore: ctx.away.score,
  })
  const possTotal = ctx.home.poss + ctx.away.poss || 1
  pushLine(state, ctx, 40, 'SUB', null, 'comm.halfTimeNumbers', {
    hposs: Math.round((ctx.home.poss / possTotal) * 100), aposs: Math.round((ctx.away.poss / possTotal) * 100),
    htries: ctx.home.tries, atries: ctx.away.tries, hpens: ctx.home.pens, apens: ctx.away.pens,
  })
  if (ctx.userSideId) {
    const ev = buildEvidence(state, ctx)
    if (ev) ctx.htEv = ev
    ctx.htDials = userDials(state, ctx)
  }
}

/** TEN MINUTES IN THE SHED (owner, 18 Oct 2026: "do players recover 10% at
 *  half-time?" - they did not; energy only ever drained). Everyone on the
 *  pitch gets HT_RECOVERY points of energy back at the interval. The drain is
 *  steeper to pay for it (energy.ts DRAIN_HT_K), so a man's average energy
 *  over the eighty minutes, and his tank at the final whistle, are where they
 *  were: the balance holds and the second half starts fresher than the first
 *  ended. */
export const HT_RECOVERY = 10
function halfTimeRecovery(ctx: LiveCtx) {
  for (const side of [ctx.home, ctx.away]) {
    for (const id of side.onPitch) {
      const e = side.energy.get(id)
      if (e != null) side.energy.set(id, Math.min(100, e + HT_RECOVERY))
    }
  }
}

/** Blow full time. Same deal: seg only reaches 3 - which is what every caller
 *  reads as "the match is over" - once the last call of the match is in. */
export function blowFullTime(state: GameState, ctx: LiveCtx) {
  ctx.heldWhistle = null
  // a man hurt in the last minutes needs nobody to come on for him now
  ctx.injWait = undefined
  ctx.seg = 3
  ctx.awaiting = null
  finalizeMatch(state, ctx)
}

function finalizeMatch(state: GameState, ctx: LiveCtx) {
  const { fx, home, away, rng, detail, derby, isUser } = ctx
  fx.played = true
  fx.homeScore = home.score
  fx.awayScore = away.score
  fx.homeTries = home.tries
  fx.awayTries = away.tries
  pushLine(state, ctx, 80, 'FT', null, 'comm.fullTime', {
    home: teamShort(state, fx.homeId), away: teamShort(state, fx.awayId),
    hs: home.score, ascore: away.score,
  })
  if (detail) fx.events = ctx.events

  // Test rugby keeps score beyond the scoreboard: the world rankings move
  if (!state.clubs[fx.homeId] && !state.clubs[fx.awayId]) updateNatRank(state, fx)

  // an ill-tempered afternoon starts a feud of its own
  const totalCards = home.yellowUntil.size + home.sent + away.yellowUntil.size + away.sent
  if (totalCards >= 5 && state.clubs[fx.homeId] && state.clubs[fx.awayId] && !isDerby(fx.homeId, fx.awayId)) {
    addGrudge(state, fx.homeId, fx.awayId, 'news.grudgeBoiledOver', { cards: totalCards }, 1)
  }

  // the testimonial's morning after: the gate goes to the club, the day
  // goes into club folklore
  if (fx.testimonial != null && fx.homeId === state.userClubId) {
    const hero = state.players[fx.testimonial]
    const club = state.clubs[fx.homeId]
    if (hero && club && fx.att) {
      const gate = fx.att * 30
      club.balance += gate
      for (const id of club.players) {
        const tm = state.players[id]
        if (tm) tm.morale = clamp(tm.morale + 0.4, 1, 10)
      }
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
        subject: `${hero.name}'s testimonial: ${fx.att.toLocaleString()} say thank you`,
        body: `${club.stadium} was full for ${hero.name}'s testimonial${hero.name && ctx.events.some(e => e.type === 'TRY' && e.playerId === hero.id) ? ' - and he scored, because of course he did' : ''}. The gate receipts (${fmtMoney(gate)}) go to the club at his insistence. One season left in the shirt: make it a good one.`,
        k: 'news.testimonialDay',
        v: {
          player: hero.name, att: fx.att ?? 0, stadium: club.stadium, gate: fmtMoney(gate),
          scored_k: ctx.events.some(e => e.type === 'TRY' && e.playerId === hero.id)
            ? 'news.testimonialScored' : 'common.nothing',
        },
        playerId: hero.id,
        fixtureId: fx.id,
      })
    }
  }

  // an old boy coming back to haunt the user's club makes the back page
  if ((fx.homeId === state.userClubId || fx.awayId === state.userClubId) && fx.compId !== 'fr') {
    const oppSide = fx.homeId === state.userClubId ? away : home
    const oppClub = state.clubs[oppSide.teamId]
    const ev = ctx.events.find(e => e.type === 'TRY' && e.teamId === oppSide.teamId &&
      e.playerId != null && oppSide.exIds.has(e.playerId))
    const haunter = ev?.playerId != null ? state.players[ev.playerId] : null
    if (haunter && oppClub) {
      const weWon = (fx.homeId === state.userClubId ? home.score > away.score : away.score > home.score)
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'gossip', read: false,
        subject: `Old boy ${haunter.name} crosses against his former club`,
        body: weWon
          ? `${haunter.name}, once of this parish, went over for ${oppClub.short} - no celebration, just a nod to the away end. Your side had the last word on the scoreboard, which is all that matters.`
          : `Of course it was him. ${haunter.name} - ${oldBoyApps(haunter, state.userClubId)} appearances in your colours before he left - crossed against his old club and the ground knew it was coming.`,
        k: weWon ? 'news.oldBoyWeWon' : 'news.oldBoyWeLost',
        v: { player: haunter.name, opp: oppClub.short, apps: oldBoyApps(haunter, state.userClubId) },
        playerId: haunter.id,
        fixtureId: fx.id,
      })
    }
  }

  let motmId: number | null = null
  let motmR = -1
  const debutants: { p: Player; r: number; kind: 'signing' | 'academy' }[] = []
  // see teamRatingTerm below for what the eighty minutes are worth
  for (const side of [home, away]) {
    const other = side === home ? away : home
    const won = side.score > other.score
    const isNation = !state.clubs[side.teamId]
    // what the eighty minutes were worth to everyone who played them
    const team = teamRatingTerm(side, other)
    // ---- AND WHAT THE SET PIECE WAS WORTH TO THE EIGHT WHO CONTESTED IT ----
    //
    // The other half of the forwards' missing credit. A pack that owned the
    // scrum and the lineout for eighty minutes changed the game and the mark
    // never said so.
    //
    // ZERO-SUM BETWEEN THE TWO PACKS, which is what stops it being farmed. The
    // handbook worry about this fix was that the scrum and lineout figures
    // carry the tactical dials, so a manager could slide his way to better
    // ratings. He cannot: this is measured as the DIFFERENCE between the two
    // packs, so whatever one side gains the other loses, and a dial that lifts
    // both sides of the contest moves nobody's mark. The league-wide mean is
    // untouched by construction rather than by calibration.
    const myPack = side.units.scrum + side.units.lineout
    const theirPack = other.units.scrum + other.units.lineout
    const packEdge = myPack + theirPack > 0
      ? clamp((myPack - theirPack) / (myPack + theirPack) * 3.2, -0.42, 0.42)
      : 0
    for (const [pid, r0] of side.ratings) {
      const p = state.players[pid]
      if (!p) continue
      // TWO QUANTITIES, NOT TWO OPINIONS OF ONE. `r` is the MARK - a verdict on
      // the afternoon, which is why the scoreboard belongs in it. `own` is the
      // same afternoon with the team's result taken back out, and it is what
      // feeds FORM, because form models this player's own sharpness and a
      // hammering does not make a prop individually sharper.
      //
      // This split was not a design instinct, it was a measurement.
      // scripts/autopilotprobe.ts went red the moment the team term reached
      // form: picking your best side was worth 21.0 league points a season
      // before, and 10.3 after. Form drives the auto-picked XV, so pouring a
      // team-wide number into it made every man in a winning side look sharp
      // and halved the value of the manager's biggest lever. The mark on the
      // screen can carry the result; the signal the squad is selected on
      // cannot.
      const spread = gauss(rng) * 0.8
      // the set-piece verdict lands on the eight who contested it, and on the
      // replacements who came into that contest, but never on a back
      const pack = FW_POS.has(p.pos) ? packEdge : 0
      const r = clamp(r0 + team + pack + spread, 1, 10)
      // NOT IN `own`, for the same reason the team term is not: `own` feeds
      // FORM, form drives the auto-picked XV, and the set-piece verdict is a
      // collective one. The first cut of this did put it in form and the effect
      // was immediate - selection shifted, results shifted with it, and the
      // forwards-versus-backs comparison this change exists to fix became
      // unmeasurable because the two runs were no longer playing the same
      // season. The mark on the screen can carry a collective verdict; the
      // signal the squad is picked on cannot.
      const own = clamp(r0 + spread, 1, 10)
      // THE SCREEN SHOWS THE NUMBER THE GAME REMEMBERS - one computation, read
      // by both, rather than the screen doing its own (the class of bug behind
      // the coach market and the bench tank as well). See SideCtx.finalR.
      ;(side.finalR ??= new Map()).set(pid, r)
      const friendly = ctx.fx.compId === 'fr'
      if (isNation) {
        // a Test match: another cap, and the milestones are forever
        p.caps = (p.caps ?? 0) + 1
        // (not while he is out of work: userClubId still names the club that
        // sacked him, and its players' caps are not his news - exileprobe)
        if (!state.unemployed && p.clubId === state.userClubId && (p.caps === 1 || p.caps === 50 || p.caps === 100)) {
          state.news.push({
            id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
            subject: p.caps === 1 ? `First cap: ${p.name}`
              : `${p.name}: ${p.caps} Test caps`,
            body: p.caps === 1
              ? `${p.name} won his first Test cap for ${nationNameIn('en', side.teamId)} this week. The shirt gets framed; the club that made him gets the reflected glow.`
              : `${p.name} brought up his ${p.caps}th cap for ${nationNameIn('en', side.teamId)} this week - a special jersey, a guard of honour, and a proud week around the club.`,
            k: p.caps === 1 ? 'news.firstCap' : 'news.capMilestone',
            v: { player: p.name, ...nationVars(side.teamId), n: p.caps, n_o: p.caps },
            playerId: p.id,
          })
        }
      }
      if (!isNation && friendly) {
        // friendlies bank rhythm, not records: no apps, minutes or ratings -
        // but the legs and the sharpness are real. REAL, NOT RUINED: this used
        // to run the league-match drain, so a manager who watched his opening
        // friendly without making a sub had fifteen men on ~22%, one +22 week
        // of recovery put them on exactly 44%, and the second matchday of a
        // brand-new career was a wall of flagged names (owner, 29 Aug, with
        // the screenshot). No coach lets a pre-season run-out empty the tank -
        // minutes are managed even when the sim plays all eighty - so a
        // friendly's legs bottom out at 48%: one ordinary +22 recovery week
        // puts the same XV at 70, clear of the 62% rotation flag, so the wall
        // cannot recur - while a manager who never rests anybody still rolls
        // into the league opener a long way short of the rotated sides. (A
        // first cut floored at 64 and autopilotprobe caught what that really
        // was: most of the sleepwalk penalty gone - board-misery gaps
        // collapsed, a sacking-parity flip, and a title stolen on autopilot.
        // 48 keeps the owner's fix and the game's teeth.) The rng draw on the
        // no-energy path is kept exactly as it was: this branch may not
        // change the stream (fingerprint).
        p.lastWk = state.week
        const left = side.energy.get(pid)
        p.cond = left != null
          ? clamp(Math.max(Math.min(p.cond, left + 8) - 6, 48), 12, 100)
          : clamp(Math.max(p.cond - (14 + Math.floor(rng() * 10)), 48), 20, 100)
        p.sharp = clamp(p.sharp + 12, 0, 100)
      } else if (!isNation) {
        if (p.debutPending) { debutants.push({ p, r, kind: p.debutPending }); p.debutPending = null }
        p.stats.apps += 1
        // WHO STARTED AND HOW LONG HE PLAYED, as it happened. This read the
        // lineup at full time and credited a flat 75 or 25, and the lineup is
        // rewritten by every substitution: the replacement who finished in
        // the shirt was given the start and 75 minutes, and the man who
        // played the first hour got 25 and no start. The minutes feed the
        // 1,300-minute red zone, so the wrong men were being rested. Now the
        // start is the XV of the first tick and the minutes are the stints
        // fieldChanged timed, the bin excluded, closed at the final whistle.
        // A man who got on at all has played at least a minute of it.
        const started = (side.starters ?? new Set(side.lineup.slice(0, 15))).has(pid)
        if (started) p.stats.starts += 1
        p.stats.mins += Math.max(1, Math.round(minutesPlayed(side, pid, 80)))
        p.stats.ratingSum += r
        // and the same rating against the award window, which is cleared every
        // time a Player of the Month is named (see SeasonStats.mSum)
        p.stats.mSum = (p.stats.mSum ?? 0) + r
        p.stats.mApps = (p.stats.mApps ?? 0) + 1
        p.lastR = r
        p.ratings = [...(p.ratings ?? []), Math.round(r * 10) / 10].slice(-10)
        p.lastWk = state.week
        p.form = clamp(p.form * 0.65 + own * 0.35, 1, 10)
        const swing = (p.pers === 'Temperamental' ? 2 : 1) * (derby ? 1.6 : 1)
        p.morale = clamp(p.morale + (won ? 0.4 : -0.5) * swing, 1, 10)
        // and what he took from the manager's talks, a little either way
        const tr = side.talkR?.get(pid)
        if (tr) p.morale = clamp(p.morale + talkMorale(tr, won), 1, 10)
        // post-match condition reflects how much petrol was actually burned
        const left = side.energy.get(pid)
        p.cond = left != null
          ? clamp(Math.min(p.cond, left + 8) - 6, 12, 100)
          : clamp(p.cond - (14 + Math.floor(rng() * 10)), 20, 100)
        p.sharp = clamp(p.sharp + 12, 0, 100)
        // suspensions news + totting-up for the user's squad
        if (p.clubId === state.userClubId) {
          if (p.bans > 0 && side.yellowUntil.has(pid) === false && p.stats.rc > 0 && ctx.events.some(e => e.type === 'RC' && e.playerId === pid)) {
            state.news.push({
              id: state.nextId++, week: state.week, season: state.season, type: 'injury', read: false,
              subject: `${p.name} suspended ${p.bans} matches`,
              body: `The disciplinary panel has banned ${p.name} for ${p.bans} matches following his red card. He will be unavailable until the ban is served.`,
              k: 'news.suspended', v: { player: p.name, n: p.bans },
              playerId: p.id,
            })
          }
          if (p.stats.yc > 0 && p.stats.yc % 4 === 0 && ctx.events.some(e => e.type === 'YC' && e.playerId === pid)) {
            p.bans += 1
            state.news.push({
              id: state.nextId++, week: state.week, season: state.season, type: 'injury', read: false,
              subject: `${p.name} banned - totting up`,
              body: `${p.stats.yc} yellow cards this season have earned ${p.name} a one-match suspension from the citing commissioner.`,
              k: 'news.tottingUp', v: { player: p.name, n: p.stats.yc },
              playerId: p.id,
            })
          }
        }
      }
      if (r > motmR) { motmR = r; motmId = pid }
    }
  }
  if (motmId != null && isUser) {
    const p = state.players[motmId]
    if (p) p.stats.motm += 1
    fx.motm = motmId
  }
  ctx.motmId = motmId

  // a debut worth the back page: a new face who scored, took MOTM or
  // simply played out of his skin gets his moment in print
  for (const { p, r, kind } of debutants) {
    if (p.clubId !== state.userClubId) continue
    if (kind === 'academy') rememberDebut(state, p) // memory.ts: you gave him his debut
    const scored = ctx.events.some(e => e.type === 'TRY' && e.playerId === p.id)
    const isMotm = p.id === motmId
    if (!scored && !isMotm && r < 7.8) continue
    const homegrown = kind === 'academy'
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
      subject: homegrown ? `A debut to tell his grandkids about: ${p.name}` : `Dream debut for ${p.name}`,
      body: [
        homegrown
          ? `${p.name} (${p.age}, ${p.pos}) made his first-team debut today - the academy's own, first competitive rugby of his life.`
          : `First competitive appearance in the shirt for ${p.name} (${p.pos}), and he made it count.`,
        scored ? `He scored, because new signings who cost the coaching staff sleep always do.` : '',
        isMotm ? `The sponsors gave him the match award before he had learned everyone's names.` : '',
        `Rated ${r.toFixed(1)} by the press box. The supporters have a new song by Tuesday.`,
      ].filter(Boolean).join(' '),
      k: homegrown ? 'news.debutAcademy' : 'news.debutSigning',
      v: {
        player: p.name, age: p.age, pos: p.pos, rating: r.toFixed(1),
        scored_k: scored ? 'news.debutScored' : 'common.nothing',
        motm_k: isMotm ? 'news.debutMotm' : 'common.nothing',
      },
      playerId: p.id,
      fixtureId: fx.id,
    })
  }

  // PLAYOFF RECORDS (1.8.16, item 47): a hat-trick in a knockout tie, and
  // the fastest knockout try anybody has scored, are news wherever they come
  koRecords(state, ctx)

  // the morning paper: a proper match report for every game you took charge of
  if (detail && isUser) {
    const usHome = ctx.userSideId === fx.homeId
    const us = usHome ? home : away
    const them = usHome ? away : home
    const margin = us.score - them.score
    const oppName = teamShort(state, them.teamId)
    const scorers = (side: SideCtx) => {
      const byName = new Map<string, number[]>()
      for (const e of ctx.events) {
        if (e.type !== 'TRY' || e.teamId !== side.teamId || !e.playerName) continue
        const mins = byName.get(e.playerName) ?? []
        mins.push(e.min)
        byName.set(e.playerName, mins)
      }
      return [...byName.entries()].map(([n, mins]) => `${n} (${mins.map(m => `${m}'`).join(', ')})`).join(', ')
    }
    const motm = motmId != null ? state.players[motmId] : null
    // the one line the gaffer reads after every match: rotate the phrasing
    // so twenty seasons of Monday papers do not all start the same way.
    //
    // The variants are keys rather than sentences, and say() draws exactly as
    // it did when they were sentences - one draw, same index, same variant -
    // so a world generated before this change and one generated after it are
    // the same world. Every opener is handed both team names whether its own
    // wording uses them or not, because which one a translation reaches for is
    // the translation's business.
    const say = (opts: string[]) => opts[Math.floor(rng() * opts.length)]
    const openerK = margin >= 20 ? say(['news.mrRout1', 'news.mrRout2', 'news.mrRout3'])
      : margin > 7 ? say(['news.mrComfort1', 'news.mrComfort2', 'news.mrComfort3'])
      : margin > 0 ? say(['news.mrNarrow1', 'news.mrNarrow2', 'news.mrNarrow3'])
      : margin === 0 ? say(['news.mrDraw1', 'news.mrDraw2', 'news.mrDraw3'])
      : margin >= -7 ? say(['news.mrNearMiss1', 'news.mrNearMiss2', 'news.mrNearMiss3'])
      : say(['news.mrBeaten1', 'news.mrBeaten2', 'news.mrBeaten3'])

    // The report is a column, so it is filed as a _ll list of fragment keys.
    // Where a slot can hold either a name or a word - the ground with no name,
    // the fixture with no competition - the WORD gets its own key rather than
    // being passed in as a variable, because a variable holding "the ground"
    // is English hiding inside a French sentence, which is the entire bug this
    // mechanism exists to remove. A club's name and a stadium's name are not
    // translated and travel as variables, which is what variables are for.
    const usName = teamShort(state, us.teamId)
    const ourTries = scorers(us), theirTries = scorers(them)
    const lines: { k: string; [x: string]: string | number }[] = [
      { k: openerK, us: usName, opp: oppName },
      ourTries ? { k: 'news.mrTries', tries: ourTries } : { k: 'news.mrNoTries', us: usName },
    ]
    if (theirTries) lines.push({ k: 'news.mrOppTries', opp: oppName, tries: theirTries })
    if (motm) lines.push({ k: 'news.mrMotm', motm: motm.name, rating: motmR.toFixed(1) })
    if (fx.att) {
      const stadium = state.clubs[fx.homeId]?.stadium
      const compName = state.comps[fx.compId]?.name
      const comp_k = compName ? 'news.mrCompNamed' : fx.compId === 'fr' ? 'news.mrFriendly' : ''
      const weather_k = fx.weather && fx.weather !== 'Dry' ? `matchday.wx${fx.weather}` : ''
      lines.push({
        k: comp_k && weather_k ? 'news.mrGateCompWx'
          : comp_k ? 'news.mrGateComp'
          : weather_k ? 'news.mrGateWx'
          : 'news.mrGate',
        att: fx.att,
        venue_k: stadium ? 'news.mrVenueNamed' : 'news.mrTheGround',
        venue: stadium ?? '',
        comp_k, comp: compName ?? '',
        weather_k,
      })
    }
    // The headline is the scoreline, so it goes through the key as well. A body
    // key implies a subject key - newsSubject() puts Subj on the end of it -
    // and leaving the subject as a template would have quietly replaced the
    // score with whatever that key happened to say.
    const v = {
      lines_ll: JSON.stringify(lines),
      home: teamShort(state, fx.homeId), away: teamShort(state, fx.awayId),
      hs: home.score, ascore: away.score,
    }
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'general', read: true,
      subject: tIn('en', 'news.matchReportSubj', v),
      body: tIn('en', 'news.matchReport', v),
      k: 'news.matchReport', v,
      playerId: motm?.id,
    })

    // the season's best try: judged for drama the moment the whistle goes.
    // Pure bookkeeping over the finished event list - zero draws on the rng
    if (fx.compId !== 'fr' && us.teamId === state.userClubId) {
      for (const e of ctx.events) {
        if (e.type !== 'TRY' || e.teamId !== us.teamId || e.playerId == null) continue
        const scorer = state.players[e.playerId]
        if (!scorer) continue
        const drama =
          (e.min >= 78 ? 3 : e.min >= 70 ? 2 : e.min >= 60 ? 1 : 0) +
          (ctx.derby ? 2 : 0) +
          (margin > 0 && margin <= 5 ? 2 : Math.abs(margin) <= 12 ? 1 : 0) +
          (scorer.pos === 'WG' || scorer.pos === 'FB' ? 1 : 0) +
          (fx.stage === 'F' ? 3 : fx.stage ? 1 : 0)
        const best = state.tryOfSeason
        if (!best || best.season !== state.season || drama > best.drama) {
          state.tryOfSeason = {
            playerId: e.playerId, name: e.playerName ?? scorer.name, min: e.min,
            opp: oppName, text: e.text, drama, season: state.season,
            ...(e.k ? { tj: JSON.stringify({ ...(e.v ?? {}), k: e.k }) } : {}),
          }
        }
      }
    }
  }
}

/** Simulate a full match in one go (AI fixtures, tests, quick sims). */
/**
 * ---- THE WALKOVER (1.6.4) ----
 *
 * A club that cannot put ten fit players on the field forfeits: the match is
 * awarded 28-0 with four tries, the losing side gets nothing. The engine used
 * to play on with three men and lose 0-82 (scripts/qa/edge.ts), which no
 * competition on earth would let happen. Ten is the owner's line. Test sides
 * never forfeit - a nation always finds fifteen - and if both clubs are short
 * the fixture is scratched as a 0-0 draw with no bonus points.
 */
export const FORFEIT_MIN = 10
export const FORFEIT_SCORE = 28
export const FORFEIT_TRIES = 4

export function forfeitSide(state: GameState, fx: Fixture): 'home' | 'away' | 'both' | null {
  const short = (teamId: string) => {
    const club = state.clubs[teamId]
    if (!club) return false
    // academy men count: a club short of seniors drafts them, as the team
    // sheet already does
    return availablePlayers(state, club.players).length < FORFEIT_MIN
  }
  const h = short(fx.homeId), a = short(fx.awayId)
  return h && a ? 'both' : h ? 'home' : a ? 'away' : null
}

export function settleForfeit(state: GameState, fx: Fixture, side: 'home' | 'away' | 'both'): SimResult {
  const winner = side === 'home' ? fx.awayId : side === 'away' ? fx.homeId : null
  const loser = side === 'home' ? fx.homeId : side === 'away' ? fx.awayId : null
  fx.played = true
  fx.homeScore = winner === fx.homeId ? FORFEIT_SCORE : 0
  fx.awayScore = winner === fx.awayId ? FORFEIT_SCORE : 0
  fx.homeTries = winner === fx.homeId ? FORFEIT_TRIES : 0
  fx.awayTries = winner === fx.awayId ? FORFEIT_TRIES : 0
  const v = {
    loser: loser ? teamShort(state, loser) : teamShort(state, fx.homeId),
    winner: winner ? teamShort(state, winner) : teamShort(state, fx.awayId),
  }
  const events: MatchEvent[] = [{
    min: 0, type: 'FT', teamId: winner ?? fx.homeId, text: tIn('en', 'comm.forfeit', v), k: 'comm.forfeit', v,
    homeScore: fx.homeScore, awayScore: fx.awayScore,
  } as MatchEvent]
  const mine = fx.homeId === state.userClubId || fx.awayId === state.userClubId
  if (mine) {
    fx.events = events
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
      subject: tIn('en', 'news.forfeitSubj', v), body: tIn('en', 'news.forfeit', v),
      k: 'news.forfeit', v,
    })
  }
  return { events, motmId: null }
}

const KO_STAGE = new Set(['QF', 'SF', 'F', 'BAR'])
function koRecords(state: GameState, ctx: LiveCtx) {
  const fx = ctx.fx
  if (!fx.stage || !KO_STAGE.has(fx.stage)) return
  const stage_k = `news.koStage_${fx.stage}`
  const comp = state.comps[fx.compId]?.name ?? ''
  // A MANAGER OUT OF WORK DOES NOT READ ABOUT THE CLUB THAT SACKED HIM
  // (exileprobe, 1.9.4): userClubId still names that club until he takes
  // another job. The record itself is kept; only his inbox is spared the story.
  const exiled = (teamId: string) => state.unemployed && teamId === state.userClubId
  for (const side of [ctx.home, ctx.away]) {
    if (exiled(side.teamId)) continue
    for (const [pid, n] of side.matchTries ?? []) {
      const p = state.players[pid]
      if (!p || n < 3) continue
      const v = { player: p.name, team: teamShort(state, side.teamId), n, comp, stage_k }
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
        subject: tIn('en', 'news.koHatTrickSubj', v), body: tIn('en', 'news.koHatTrick', v),
        k: 'news.koHatTrick', v, playerId: p.id, fixtureId: fx.id,
      })
    }
  }
  const first = [ctx.home, ctx.away].filter(s => s.firstTryMin != null && s.firstTryBy != null)
    .sort((a, b) => (a.firstTryMin ?? 99) - (b.firstTryMin ?? 99))[0]
  if (!first || first.firstTryMin == null || first.firstTryBy == null) return
  const rec = state.koFastest
  if (rec && rec.min <= first.firstTryMin) return
  const p = state.players[first.firstTryBy]
  if (!p) return
  state.koFastest = { min: first.firstTryMin, name: p.name, team: teamShort(state, first.teamId), season: state.season }
  // the first one set is not news: a record needs something to beat
  // nor one that names the old record, when his old club held it
  if (!rec || exiled(first.teamId) || (state.unemployed && rec.team === teamShort(state, state.userClubId))) return
  const v = { player: p.name, team: teamShort(state, first.teamId), min: first.firstTryMin, old: rec.name, oldMin: rec.min, comp, stage_k }
  // "after 1 minutes": a minute is the one count the old record can never be
  // (the record it beats is longer), so only {min} needs a singular line
  const k = first.firstTryMin === 1 ? 'news.koFastest1' : 'news.koFastest'
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
    subject: tIn('en', k + 'Subj', v), body: tIn('en', k, v),
    k, v, playerId: p.id, fixtureId: fx.id,
  })
}
