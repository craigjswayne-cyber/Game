// The week's training: the squad session, personal plans and recovery.
// Split out of season.ts, which re-exports the public parts.
import type { Fixture, GameState, Player, TrainingFocus } from '../model'
import { genderOf, mayTakeMaternityLeave, MATERNITY_WEEKS } from '../gender'
import { telling } from '../tellings'
import { absWeek, facLevel, fixtureDayOff, fmtMoney, formGuide, unbeatenRun } from '../model'
import { pickTrainingInjury } from '../matchEngine'
import { benchDrag, playerValue, playerWage } from '../attributes'
import { IRON_REC, brittleF, formTraits } from '../formtraits'
import { isMyClub } from '../model'
import { RIFT_MORALE, RIFT_TRAINING, riftDrag } from '../staffrift'
import { clamp, type Rng } from '../rng'
import { attrOdds, attrRoll, gapGrowth, PRODIGY_PA, trainPoint, youthPace } from '../ageing'
import { confidence, devHash, heavyLoad, learning, planAffinity, weekGrowth } from '../devproject'
import { canBeMentored, mentorWeek } from '../mentoring'
import { tIn, type Vars } from '../i18n'

// ------------------------------------------------------------------
// Training & recovery
// ------------------------------------------------------------------

/** Which attributes a training focus works on - the squad session and the
 *  personal plans (18A) speak the same vocabulary. */
const FOCUS_ATTRS: Record<string, (keyof Player['a'])[]> = {
  balanced: [], scrum: ['scr', 'str'], lineout: ['lin'], attack: ['han', 'pas', 'vis'],
  defence: ['tac', 'pos'], fitness: ['sta'], kicking: ['kic', 'goa'],
}
/** Which specialist coach amplifies which training focus. */
const FOCUS_COACH: Record<string, keyof GameState['staff'] | null> = {
  balanced: null, scrum: 'scrumCoach', lineout: 'scrumCoach', attack: 'attack',
  defence: 'defence', fitness: 'assistant', kicking: 'kicking',
}

/** How many personal plans the department can run at once: the assistant's
 *  level is the bandwidth, and a manager who came up through the coaching
 *  route (18B) runs one more himself. */
export function planCap(state: GameState): number {
  return 2 + (state.staff?.assistant ?? 0) + (state.mgrOrigin === 'coach' ? 1 : 0)
}

/** The plan a man is actually on, cap enforced at read time: newest
 *  assignments win a full book, same idiom as devFocus. */
export function activePlan(state: GameState, playerId: number): TrainingFocus | null {
  return activeEntry(state, playerId)?.plan ?? null
}

/** The whole plan entry, secondary programme and tally included (1.8.2). */
export function activeEntry(state: GameState, playerId: number): NonNullable<GameState['plans']>[number] | null {
  return (state.plans ?? []).slice(-planCap(state)).find(x => x.id === playerId) ?? null
}

/** One week of a personal training programme (18A, from the Rugby Manager
 *  assessment: "advanced individual training" was the one mechanic ahead of
 *  ours). A planned man works HIS programme instead of the squad session, so
 *  the plan is a choice, not a stack: the specialist coach and the paddock
 *  set the ceiling, and older men absorb less of it. Returns true on a bump. */
export function rollPlan(state: GameState, p: Player, rng: Rng): boolean {
  const entry = activeEntry(state, p.id)
  const plan = entry?.plan
  if (!entry || !plan) return false
  const rate = (focus: TrainingFocus) => {
    const coach = FOCUS_COACH[focus]
    const coachLvl = coach ? (state.staff[coach] ?? 0) : 0
    const ageF = p.age <= 23 ? 1.3 : p.age <= 28 ? 1 : 0.6
    // 0.011 a week at the base, was 0.055: a season on a plan was 26 attribute
    // points (12 rating points' worth) against two to four of natural growth.
    // Now a gold coach and a real paddock buy four to six points a season, each
    // paid for elsewhere the same week (ageing.ts trainPoint).
    // THE DEVELOPMENT PLAN (1.8.2, devproject.ts): a programme on what he
    // learns quickly lands more often and one on what he is slow at less,
    // and the week itself is uneven: minutes, confidence, the right shirt,
    // the side's style, and the month's spell (weekGrowth, mean one)
    return 0.011 * (1 + coachLvl * 0.5 + facLevel(state, 'paddock') * 0.2) * ageF
      * planAffinity(state.seed, p, focus) * weekGrowth(state, p)
  }
  // a second programme splits the week, seven parts to three: wider, not more
  const plan2 = entry.plan2 && entry.plan2 !== plan && entry.plan2 !== 'balanced' ? entry.plan2 : null
  const abs = absWeek(state.season, state.week)
  let moved = false
  // the primary's draw is the one rng draw this always spent, so the stream
  // is unchanged; the secondary's is by hash
  if (rng() < rate(plan) * (plan2 ? 0.7 : 1)) {
    for (const k of FOCUS_ATTRS[plan]) moved = trainPoint(p, k, FOCUS_ATTRS[plan], attrRoll(state.seed, p.id, abs, k)) || moved
  }
  if (plan2 && devHash(state.seed, p.id, 40, abs) < rate(plan2) * 0.3) {
    for (const k of FOCUS_ATTRS[plan2]) moved = trainPoint(p, k, FOCUS_ATTRS[plan2], attrRoll(state.seed, p.id, abs + 7, k)) || moved
  }
  if (moved) entry.pts = (entry.pts ?? 0) + 1
  return moved
}

export function weeklyTraining(state: GameState, rng: Rng) {
  const focusMap = FOCUS_ATTRS
  const coachFor = FOCUS_COACH
  // a winning run carries a dressing room; a losing one drags it under
  {
    const uid = state.userClubId
    // formGuide sorts by week; a raw slice reads appended cup rounds out of
    // calendar order (the Home pips bug)
    const last3 = formGuide(state, uid, 3)
    if (last3.length === 3 && (last3.every(r => r === 'W') || last3.every(r => r === 'L'))) {
      const up = last3[0] === 'W'
      for (const id of state.clubs[uid].players) {
        const p = state.players[id]
        if (p) p.morale = clamp(p.morale + (up ? 0.25 : -0.3), 1, 10)
      }
    }
  }

  // mentor pairs dissolve when either man leaves the building
  if (state.mentors?.length) {
    state.mentors = state.mentors.filter(mp => {
      const s2 = state.players[mp.senior]
      const k2 = state.players[mp.kid]
      const ok = s2 && k2 && s2.clubId === state.userClubId && k2.clubId === state.userClubId
      if (!ok && k2 && k2.clubId === state.userClubId) {
        k2.morale = clamp(k2.morale - 0.5, 1, 10)
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'youth', read: false,
          subject: `${k2.name.split(' ').slice(-1)[0]} loses his mentor`,
          body: `With ${s2 ? s2.name : 'his mentor'} gone, ${k2.name} is training alone again. The academy coach will keep an eye on him - but it isn't the same.`,
          k: 'news.mentorLost',
          v: { kid: k2.name, last: k2.name.split(' ').slice(-1)[0], mentor: s2 ? s2.name : tIn('en', 'news.hisMentor') },
          playerId: k2.id,
        })
      }
      return !!ok
    })
  }

  // turnaround: a Sunday game followed by a Friday game leaves 5 days'
  // recovery, not 7 - the whole squad freshens up slower that week
  const lastFx = state.fixtures.find(f =>
    f.week === state.week - 1 && f.played && (f.homeId === state.userClubId || f.awayId === state.userClubId))
  const nextFx = state.fixtures.find(f =>
    f.week === state.week && !f.played && (f.homeId === state.userClubId || f.awayId === state.userClubId))
  const gapDays = lastFx && nextFx ? 7 + fixtureDayOff(nextFx.id) - fixtureDayOff(lastFx.id) : 7
  const turnF = gapDays / 7 // 5-day turnaround = 71% recovery; 9 days = 128%

  // the skipper's mood is contagious: a happy leader settles the room,
  // a miserable one drags it down with him
  if (!state.unemployed) {
    const capId = state.clubs[state.userClubId].captain
    const cap = capId != null ? state.players[capId] : null
    if (cap && cap.a.lea >= 13) {
      const pull = cap.morale >= 7 ? 0.04 : cap.morale <= 4 ? -0.05 : 0
      if (pull) {
        for (const id of state.clubs[state.userClubId].players) {
          const p = state.players[id]
          if (p && p.id !== cap.id) p.morale = clamp(p.morale + pull, 1, 10)
        }
      }
    }
  }

  // an agent smells a payday: an underpaid performer demands new terms.
  // Two doors in (17A, user: "players request pay rises" as part of "there
  // needs to be more going on"): the star playing the house down on small
  // money, and the honest regular whose wage has drifted far under the market
  // for what he now is. The rate rises with the second pool, so a season
  // brings a handful of these conversations rather than one or two.
  if (!state.unemployed && rng() < 0.2) {
    const squad = state.clubs[state.userClubId].players.map(id => state.players[id]).filter(Boolean)
    const cands = squad.filter(p =>
      !p.acad && !p.loanFrom &&
      !(p.wantsDeal ?? 0) && p.contractEnds > state.season && p.age <= 32 &&
      ((p.stats.apps >= 8 && p.stats.ratingSum / Math.max(1, p.stats.apps) >= 7.15 && p.wage < playerWage(p.ca, p.age) * 0.85) ||
        (p.stats.apps >= 10 && p.stats.ratingSum / Math.max(1, p.stats.apps) >= 6.6 && p.wage < playerWage(p.ca, p.age) * 0.7)))
    if (cands.length) {
      const p = cands[Math.floor(rng() * cands.length)]
      p.wantsDeal = state.week
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'contract', read: false,
        subject: `${p.name} wants improved terms`,
        body: `${p.name}'s agent has been on the phone: his client is playing the house down (avg ${(p.stats.ratingSum / Math.max(1, p.stats.apps)).toFixed(2)}) on ${fmtMoney(p.wage)}/week, and the market rate is well north of that. He has ${p.contractEnds - state.season} year${p.contractEnds - state.season > 1 ? 's' : ''} left, but leave it unresolved and his head will drop - and other clubs will smell it.`,
        k: 'news.wantsTerms',
        v: {
          player: p.name, avg: (p.stats.ratingSum / Math.max(1, p.stats.apps)).toFixed(2),
          wage: fmtMoney(p.wage), n: p.contractEnds - state.season,
        },
        playerId: p.id,
      })
    }
  }

  // the physio's clean bill of health, one note for the week. Three separate
  // "back in training" letters in one midwinter inbox told the manager the same
  // thing three times over, and he still had to open each one to learn who.
  const returned: Player[] = []
  // every other club's turnaround, the same sum as the manager's above
  const aiTurn = new Map<string, number>()
  {
    const last = new Map<string, Fixture>(), next = new Map<string, Fixture>()
    for (const f of state.fixtures) {
      if (f.week === state.week - 1 && f.played) { last.set(f.homeId, f); last.set(f.awayId, f) }
      else if (f.week === state.week && !f.played) { next.set(f.homeId, f); next.set(f.awayId, f) }
    }
    for (const [id, nf] of next) {
      const lf = last.get(id)
      if (lf) aiTurn.set(id, (7 + fixtureDayOff(nf.id) - fixtureDayOff(lf.id)) / 7)
    }
  }
  // two coaches at odds this week (staffrift.ts): 1 or 0, the manager's club only
  const rift = riftDrag(state)
  for (const club of Object.values(state.clubs)) {
    // NOT state.userClubId directly: that still names the club after a
    // sacking, and this flag is what decides whose gym, physio, coaching staff
    // and training plans are applied, and whose injuries make the inbox
    // (model.ts isMyClub).
    const isUser = isMyClub(state, club.id)
    for (const id of club.players) {
      const p = state.players[id]
      if (!p) continue
      // recovery - rusty players take longer to freshen up
      const gym = isUser ? facLevel(state, 'gym') * 0.9 : 0
      // an iron constitution (formtraits.ts) gets more back, and a short
      // turnaround does not cut into it
      const iron = formTraits(state.seed, p.id).iron
      // THE SAME CLOCK FOR EVERYBODY (1.8.14): a short turnaround slows every
      // club's recovery, not only the manager's - the AI used to get a full
      // week back whatever the gap between its fixtures
      const tf = isUser ? turnF : (aiTurn.get(club.id) ?? 1)
      p.cond = clamp(p.cond + Math.round((((p.rust ?? 0) > 0 ? 16 : 22) + gym + (iron ? IRON_REC : 0)) * (iron ? Math.max(1, tf) : tf)), 20, 100)
      p.sharp = clamp(p.sharp - 4, 0, 100)
      if ((p.rust ?? 0) > 0) p.rust = (p.rust ?? 1) - 1
      // ---- MATERNITY LEAVE: the grant, and the road back ----
      //
      // Fenced by mayTakeMaternityLeave, which is where the owner's rule that
      // this may only touch GENERATED players lives. The rate is deliberately
      // low: this should be a thing that happens to a handful of squads across
      // a league in a season, the way it does, not a mechanic the manager is
      // managing every week.
      // AN ABSOLUTE WEEK, NOT THIS SEASON'S. This shipped comparing a
      // within-season week against a within-season week, and a leave of 28 to 40
      // weeks granted after about week 5 gave an `until` beyond the end of the
      // season - a number state.week resets past every August and can never
      // reach again. The player never came back. The maternity probe reported
      // 106 grants and 30 returns and that gap WAS the bug, not women still away.
      if (p.maternity && absWeek(state.season, state.week) >= p.maternity.until) {
        p.maternity = undefined
        p.cond = 62
        p.sharp = 30
        // a long way back: the conditioning track is longer than any injury's
        p.rust = 4
      } else if (!p.maternity && mayTakeMaternityLeave(p, genderOf(state)) && rng() < 0.00035) {
        const wk = MATERNITY_WEEKS[0] + Math.floor(rng() * (MATERNITY_WEEKS[1] - MATERNITY_WEEKS[0] + 1))
        const nowAbs = absWeek(state.season, state.week)
        p.maternity = { until: nowAbs + wk, from: nowAbs }
        // She keeps her place on the roster and her deal; what she does not do
        // is occupy a shirt while she is away. See autoSelect's filter.
        if (p.clubId === state.userClubId) {
          const v = { player: p.name, n: wk }
          state.news.push({
            id: state.nextId++, week: state.week, season: state.season, type: 'injury', read: false,
            subject: tIn('en', 'news.maternitySubj', v),
            body: tIn('en', 'news.maternity', v),
            k: 'news.maternity', v,
          })
        }
      }
      /**
       * ---- THE TUESDAY SESSION (design review, v1.6.7) ----
       *
       * Rugby does a quarter to a third of its damage on the training ground,
       * and until now this game did none of it: every injury in a save came
       * out of a Saturday, so a manager who rested his best men kept them for
       * ever. A hamstring goes in a running drill and a shoulder goes in
       * contact whether or not there is a fixture that week.
       *
       * The rate is per available man per week and it is small on purpose.
       * Measured at this setting: about nine a club a season against the
       * twenty-odd the matches produce, so roughly three in ten of a squad's
       * injuries are done in training - which is what the professional game's
       * own surveillance reports. Heavy legs and a man just back from a
       * lay-off carry the real risk, exactly as they do in the match roll.
       *
       * It runs for every club in the world, because an injury table only the
       * user's squad can land on is not a rule, it is a tax.
       */
      if (!p.injury && !p.maternity && p.bans === 0) {
        const rustF = (p.rust ?? 0) > 0 ? 2.6 : 1
        // TOO MUCH RUGBY TOO YOUNG (1.8.2, devproject.heavyLoad): minutes grow
        // a young senior, and a young body starting nearly every week breaks
        // more often on the training ground
        const loadF = heavyLoad(p) ? 1.35 : 1
        const tiredF = (p.cond < 55 ? 1.7 : 1) * brittleF(state.seed, p, p.cond < 55)
        const ageF = p.age >= 32 ? 1.3 : 1
        // THE SURFACE YOU TRAIN ON (v1.8.1). This term used to sit in the
        // match engine, shaving the user's injury roll at home off the old
        // Playing Surface. A match is played at the ground; the pitch
        // facility is where the squad WORKS, so a rutted one is what turns
        // an ankle on a Tuesday. Every club's own, not just the manager's.
        const surf = 1 - (club.facilities?.pitch ?? 0) * 0.05
        if (rng() < 0.0026 * rustF * tiredF * ageF * surf * loadF) {
          let [dk, weeks] = pickTrainingInjury(rng, genderOf(state), p.real)
          if (isUser) {
            // the same care that shortens a match lay-off shortens this one
            const care = state.staff.physio * 0.12 + facLevel(state, 'recovery') * 0.03
            if (care > 0) weeks = Math.max(1, Math.round(weeks * (1 - care)))
          }
          p.injury = { desc: tIn('en', dk), dk, until: state.week + weeks, weeks }
          p.injLog = [...(p.injLog ?? []), { s: state.season, w: state.week, dk, weeks }].slice(-20)
          // NO TICKER TO CARRY IT. A match injury is narrated as it happens;
          // this one has nowhere to be seen, so the manager is written to or
          // he finds out by opening the team sheet and wondering.
          if (isUser && !p.acad) {
            const v = { player: p.name, injury_k: dk, n: weeks }
            state.news.push({
              id: state.nextId++, week: state.week, season: state.season, type: 'injury', read: false,
              subject: tIn('en', 'news.trainInjurySubj', v),
              // ONE KEY, TWO FORMS. This used to file the one-week story under
              // news.trainInjuryOne, and newsSubject (model.ts) builds an
              // inbox headline as `k + 'Subj'` - so every one-week training
              // injury put the literal text "news.trainInjuryOneSubj" at the
              // top of the manager's inbox, in all six languages. i18nprobe
              // could not see it because that key is assembled at runtime
              // rather than written down. news.trainInjury carries {one,
              // other} now and the dictionary picks the form off `n`.
              body: tIn('en', 'news.trainInjury', v),
              k: 'news.trainInjury',
              v, playerId: p.id,
            })
          }
        }
      }
      if (p.injury && state.week >= p.injury.until) {
        const weeksOut = p.injury.weeks ?? 2
        p.injury = null
        p.specialist = false
        p.cond = 70
        p.sharp = 40
        // a spell of match rust: playable, but rushing him back risks re-injury
        p.rust = weeksOut >= 8 ? 3 : weeksOut >= 3 ? 2 : 1
        // academy returns are the academy coach's business - the first-team
        // inbox only hears about players the gaffer might actually pick
        if (isUser && !p.acad) returned.push(p)
      }
      // gentle in-season growth for youngsters, drift for user's training
      // focus. Damped near the top: without it the whole world's best 23
      // converge on 99 by season 12 and elite means nothing
      // GOOD PITCH, GOOD PREP (owner, v1.8.1). A squad that can actually
      // train properly develops faster, and one working on a bog does not.
      // Centred on level three like its match effect, so a bad pitch is a
      // real cost rather than an absent bonus, and read off every club's own
      // estate rather than only the manager's.
      const surfBoost = 0.88 + (club.facilities?.pitch ?? 0) * 0.048
      // (1.8.14: the assistant's lift halved, 12% a level from 25%. With every
      // user-only lever stacked a mid-table squad out-grew the whole league -
      // seventh best to best by five points inside seven seasons)
      const growBoost = (isUser ? (1 + state.staff.assistant * 0.12) * (1 - RIFT_TRAINING * rift) : 1) * surfBoost
      const eliteF = p.ca >= 94 ? 0.15 : p.ca >= 88 ? 0.5 : p.ca >= 83 ? 0.7 : 1
      // and the gap to his potential is the pace (E5, ageing.ts gapGrowth)
      // ...and the week itself (1.8.2, devproject.ts weekGrowth): his minutes,
      // confidence, shirt, the side's style, the Centre of Excellence, his
      // tempo and the month's spell, bounded and centred on the world's mean.
      // Every club's youngsters, the same rules. The short-circuit keeps the
      // rng draw exactly where it was.
      if (p.age <= 24 && p.ca < p.pa && rng() < 0.06 * growBoost * eliteF * gapGrowth(p.ca, p.pa) * weekGrowth(state, p) * youthPace(p.age, p.age <= 21 && p.pa >= PRODIGY_PA && learning(state.seed, p).tempo === 'early')) p.ca += 1
      // CONFIDENCE FEEDS FORM, a little (1.8.2): a man flying carries it into
      // the next week, one in a hole carries that. Read off his last three
      // ratings (devproject.confidence), mean zero across the world
      if (p.lastWk != null) p.form = clamp(p.form + 0.04 * confidence(state, p), 1, 10)
      // a man on a personal plan works his own programme this week (18A);
      // everyone else takes the squad session
      if (isUser && activePlan(state, p.id)) {
        rollPlan(state, p, rng)
      } else if (isUser && state.training !== 'balanced') {
        const coach = coachFor[state.training]
        const coachLvl = coach ? (state.staff[coach] ?? 0) : 0
        // 0.008, was 0.03, for the same reason as rollPlan's rate: the whole
        // squad took ten attribute points a season from the session
        if (rng() < 0.008 * (1 - RIFT_TRAINING * rift) * (1 + state.staff.assistant * 0.5 + coachLvl * 0.45 + facLevel(state, 'paddock') * 0.2)) {
          const abs = absWeek(state.season, state.week)
          for (const k of focusMap[state.training]) trainPoint(p, k, focusMap[state.training], attrRoll(state.seed, p.id, abs, k))
        }
      }
      // Morale drift, made conditional (v1.1.4, owner: "make morale genuinely
      // tricky - manager choices must matter"). It used to pull every man
      // toward 6.5 at 6% a week regardless of anything, which meant every
      // grievance self-healed in a month with the manager doing nothing.
      // Two changes, both deterministic:
      //   - the target depends on his rugby: a man getting his game drifts
      //     toward Good (6.5); a man who is not settles toward Okay (5.5),
      //     so a big squad's fringe no longer sits contentedly at Good;
      //   - the pull is asymmetric: morale falls to its target at the old 6%
      //     but RECOVERS at barely half that, so a soured man needs an actual
      //     intervention - minutes, a word in the office, a new deal, a sale -
      //     rather than a fortnight of being ignored.
      if (isUser) {
        const played = (p.lastWk ?? -9) >= state.week - 1
        // two coaches at odds take the edge off the whole room (staffrift.ts)
        const target = (played || p.injury || p.natSquad ? 6.5 : 5.5) - RIFT_MORALE * rift
        p.morale += (target - p.morale) * (p.morale < target ? 0.035 : 0.06)
        const frozen = !played && (p.lastWk ?? -9) < state.week - 3 && !p.injury && !p.acad && !p.natSquad && p.stats.apps + 3 < state.week
        if (played) p.morale = clamp(p.morale + 0.1, 1, 10)
        // a professional takes being left out better (E7, attributes.ts benchDrag)
        else if (frozen) p.morale = clamp(p.morale - (p.pers === 'Mercenary' || p.pers === 'Ambitious' ? 0.35 : 0.2 * benchDrag(p)), 1, 10)
      }
      // an unresolved contract demand sours by the week
      if (isUser && (p.wantsDeal ?? 0) > 0) {
        p.morale = clamp(p.morale - 0.12, 1, 10)
        if (state.week - (p.wantsDeal ?? 0) === 8 && (p.pers === 'Mercenary' || p.pers === 'Ambitious')) {
          state.news.push({
            id: state.nextId++, week: state.week, season: state.season, type: 'contract', read: false,
            subject: `${p.name}'s agent goes public`,
            body: `Two months of silence from the club, so the agent has taken it to the papers: "${p.name} is one of the best-performing players in the league and the club knows our position." Rival clubs will have noticed. Sort a new deal, or brace for bids.`,
            k: 'news.agentPublic',
            v: { player: p.name },
            playerId: p.id,
          })
        }
      }
      // A good mentor is worth an extra coach - and a bad one is worth almost
      // nothing. How much a pairing gives scales with how well the two men
      // work together, how close their jobs are and how much the senior has
      // seen, and what he teaches is what he is good at (mentoring.mentorWeek,
      // 1.8.0; it used to be a random attribute printed on top of the rating).
      // canBeMentored rather than p.acad (user: "all players under 21 can have a
      // mentor"). This gate and the Team Report's picker are the same rule
      // and read the same function: widening one without the other would
      // produce a pairing the game shows, reports on, and does nothing for.
      if (isUser && canBeMentored(p) && (state.mentors ?? []).some(mp => mp.kid === p.id)) {
        mentorWeek(state, p, rng)
      }
      // the academy coach quietly builds tomorrow's team
      if (isUser && p.acad && rng() < 0.025 + state.staff.academyCoach * 0.025) {
        const keys = Object.keys(p.a) as (keyof Player['a'])[]
        const k = keys[Math.floor(rng() * keys.length)]
        // the last points are the hardest (E6, ageing.ts attrOdds)
        if (attrRoll(state.seed, p.id, absWeek(state.season, state.week), k) < attrOdds(p.a[k])) p.a[k] = clamp(p.a[k] + 1, 1, 20)
      }
      if (isUser && state.staff.physio > 0) p.cond = clamp(p.cond + state.staff.physio * 3, 20, 100)
      // the medical room earns its money: injured men can come back early
      if (isUser && p.injury && p.injury.until - state.week >= 2 && rng() < 0.06 + state.staff.physio * 0.02) {
        p.injury.until -= 1
        if (p.injury.until - state.week <= 0) {
          state.news.push({
            id: state.nextId++, week: state.week, season: state.season, type: 'injury', read: false,
            subject: `${p.name} ahead of schedule`,
            body: `Good news from the treatment table: ${p.name} (${p.injury.desc}) has smashed his rehab targets and is available again this week - earlier than anyone dared hope.`,
            k: 'news.aheadOfSchedule',
            v: { player: p.name, injury_k: p.injury.dk ?? 'common.nothing' },
            playerId: p.id,
          })
        }
      }
      // a recovery week puts petrol back in every tank
      if (isUser && state.matchPrep === 'recovery') p.cond = clamp(p.cond + 3.5, 20, 100)
      // the live market price, refreshed weekly: position curve, form
      // momentum and how much contract the buyer would be getting
      p.value = playerValue(p.ca, p.age, p.pa, p.pos, p.form, p.contractEnds - state.season, p.caps)
    }
  }
  if (returned.length) {
    const one = returned.length === 1
    // sixteen of these a season, so it is told three ways in turn (tellings.ts)
    const k = telling(state, 'news.backInTraining')
    const v = {
      n: returned.length, who: one ? returned[0].name : String(returned.length),
      men_l: JSON.stringify(returned.map(pl => ({ k: 'news.rustyMan', name: pl.name, pos: pl.pos, n: pl.rust ?? 1 }))),
    }
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'injury', read: false,
      subject: tIn('en', `${k}Subj`, v),
      body: tIn('en', k, v),
      k, v,
      playerId: returned[0].id,
    })
  }
}

/** The spotlight follows an unbeaten run (16C). Milestone letters at 8, 12
 *  and 16 competitive games without defeat, and an honest obituary when the
 *  run dies. Deterministic - phrasing keys off the milestone, never the rng.
 *  Exported so scripts/unbeatenprobe.ts can drive it directly. */
export function runSpotlight(state: GameState, fx: Fixture, us: number, them: number) {
  const club = state.clubs[state.userClubId]
  if (!club) return
  const run = unbeatenRun(state, club.id) // includes the match just played
  // Same shape as gossip's wire(): the key is required and the English is
  // rendered from the dictionary, so a milestone letter cannot be added in one
  // language only.
  const push = (k: string, v: Vars) => state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
    subject: tIn('en', `${k}Subj`, v), body: tIn('en', k, v), k, v, fixtureId: fx.id,
  })
  if (us < them) {
    // the run that just ended is everything unbeaten BEFORE this fixture
    const before = state.fixtures
      .filter(f => f.played && f.compId !== 'fr' && f.id !== fx.id && (f.homeId === club.id || f.awayId === club.id))
      .sort((a, b) => a.week - b.week)
    let ended = 0
    for (let i = before.length - 1; i >= 0; i--) {
      const f = before[i]
      const u = f.homeId === club.id ? f.homeScore : f.awayScore
      const t = f.homeId === club.id ? f.awayScore : f.homeScore
      if (u < t) break
      ended++
    }
    if (ended >= 8) {
      push('news.runDies', { n: ended })
    }
    return
  }
  if (run === 8) {
    push('news.run8', { club: club.name })
  } else if (run === 12) {
    push('news.run12', {})
  } else if (run === 16) {
    push('news.run16', {})
  }
}
