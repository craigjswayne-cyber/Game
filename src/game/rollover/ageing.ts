// A year older: the development multiplier, the annual growth and decline,
// retirement and testimonials, and a one-club man's farewell season.
import { ageAttributes, gapGrowth, PRODIGY_PA, softCeilings, youthPace } from '../ageing'
import { aiPayRate, aiWageRooms } from '../aiecon'
import { assignPersonality, benchDrag, deriveAttrs, EARLY_FADE, isLateBloomer, LATE_PEAK, nextPid, playerValue, playerWage } from '../attributes'
import { COE_MEAN, learning, tempoF } from '../devproject'
import { genderOf } from '../gender'
import { rememberDeparture } from '../memory'
import { mentorBond, mentorBoost, pairWeeks } from '../mentoring'
import { BASE_YEAR, careerRows, emptyStats, fmtMoney, type GameState, type Player } from '../model'
import { regenName, worldNames } from '../nations'
import { clamp, mulberry32, type Rng } from '../rng'
import { activePlan } from '../season/training'
import { RIFT_DEV, riftDrag } from '../staffrift'
import { forget } from './registry'

/**
 * How fast this player develops, as a multiplier on the annual growth roll.
 *
 * The user's ask, verbatim: "whether they get better or not is down to the
 * facilities, coaching, mentorship and work ethics." The weekly layer already
 * had three of those for the user's club (assistant and specialist coaches,
 * mentor fit, the paddock) - but the ANNUAL roll in agePlayers, which is the
 * dominant term at roughly two thirds of a young player's growth, was pure age
 * and dice. A wonderkid in a tin shack with a mercenary's attitude grew exactly
 * as fast as one at a level-5 academy under a Leader's wing.
 *
 * MEAN-NEUTRAL BY MEASUREMENT, not by hope. Each term is centred so the world's
 * average u23 grows at the same rate as before:
 *   facilities - paddock+gym (academy kids add the Centre of Excellence),
 *     centred on the measured world mean level of 1.9;
 *   work ethic - Professional and Leader up, Mercenary and Temperamental down,
 *     centred with -0.009, measured rather than derived: the base weights say
 *     -0.017 but assignPersonality boosts Temperamental for aggressive players
 *     and Leader for born leaders, and the pa clamp eats a little growth at the
 *     top, so the constant was tuned until two-seed world means matched;
 *   mentoring - an active pair helps the kid, scaled by how well the two men
 *     fit (game/mentoring.ts), user club only;
 *   coaching - the assistant's level, user club only.
 * The user-club terms are one club in 101, so they cannot move the world mean.
 * Verified by scripts/growthprobe.ts and a before/after world-mean run.
 */
export function devFactor(state: GameState, p: Player): number {
  const club = p.clubId ? state.clubs[p.clubId] : null
  const fac = club
    ? ((club.facilities?.paddock ?? 0) + (club.facilities?.gym ?? 0) + (p.acad ? (club.facilities?.academy ?? 0) : 0)) / (p.acad ? 3 : 2)
    : 1.9
  // THE ACADEMY SLOPE IS STEEPER (user: "academy players should improve
  // quickly in good facilities, better facilities mean they improve faster").
  // A kid lives in the building in a way a senior does not, so each facility
  // level is worth double to him - still centred on the measured world mean
  // (re-measured at 1.901 across 2,727 academy players in a fresh world), so
  // the average kid grows exactly as before: the tin shacks now pay for what
  // the palaces buy. The clamp ceiling rises with it or a level-5 Centre of
  // Excellence would be cut off at the knees.
  // The +0.004 is measured, not derived, same as the -0.009 below it: a wider
  // spread under the pa ceiling loses a little mean (the fastest growers cap
  // out and waste roll), and two seeds drifted -0.02 the same way until the
  // constant put it back.
  let f = 1 + (fac - 1.9) * (p.acad ? 0.14 : 0.07) + (p.acad ? 0.004 : 0) - 0.009
  // THE CENTRE OF EXCELLENCE KEEPS WORKING AFTER PROMOTION (1.8.2). It used to
  // count for academy men only, so the day a lad was promoted at 19 the
  // building that made him stopped mattering. Under-21 seniors still train
  // with its staff: half the academy slope, centred on the world's mean level
  // (devproject COE_MEAN) so the world grows exactly as it did.
  if (club && !p.acad && p.age <= 21) f += ((club.facilities?.academy ?? 0) - COE_MEAN) * 0.07
  if (p.pers === 'Professional' || p.pers === 'Leader') f += 0.10
  else if (p.pers === 'Mercenary' || p.pers === 'Temperamental') f -= 0.12
  // MINUTES MATTER (25D, from the FM blueprint: "a 20-year-old sitting on
  // your bench will stop developing"). A young senior's growth now reads his
  // actual rugby: ten starts and the season taught him something, two or
  // fewer and it did not. Academy men are exempt - the A League is their
  // rugby and it books no senior starts. lastStarts is stashed at the summer
  // stats wipe; a fresh world has none, so world generation is untouched.
  // The -0.012 middle band is the measured mean-neutrality correction:
  // slightly more young pros clear ten starts than sit under three (about
  // 35% vs 33% on three seeded seasons), so the middle carries a small drag
  // to keep the u24 growth mean where it was (held by scripts/round25d.ts).
  // A PROFESSIONAL LOSES LESS OF IT (1.8.0, E7, fm-arena: the pro keeps doing
  // the extras when he is not picked). The no-minutes drag is halved for a
  // man at full professionalism and untouched for one with none
  // (attributes.ts benchDrag); the reward for ten starts is not his to earn
  // by attitude.
  if (!p.acad && p.age <= 23 && p.lastStarts != null) {
    f += p.lastStarts >= 10 ? 0.10 : p.lastStarts <= 2 ? -0.10 * benchDrag(p) : -0.012
  }
  if (p.clubId === state.userClubId) {
    const pair = (state.mentors ?? []).find(mp => mp.kid === p.id)
    const senior = pair ? state.players[pair.senior] : null
    // the summer term grows with the relationship too (1.8.2): a pairing
    // made in May has not had time to be worth its full six per cent
    if (senior && pair) f += 0.06 * mentorBoost(senior, p) * mentorBond(senior, p, pairWeeks(state, pair))
    f += (state.staff?.assistant ?? 0) * 0.03
    // two coaches at odds (staffrift.ts): a summer under a feuding staff
    // room teaches a little less. Coaches who get on cost nothing.
    f -= RIFT_DEV * riftDrag(state)
  }
  return clamp(f, p.acad ? 0.6 : 0.65, p.acad ? 1.65 : 1.4)
}

export function agePlayers(state: GameState, rng: Rng, rooms?: Map<string, number>) {
  softCeilings(state)
  const retirees: Player[] = []
  for (const p of Object.values(state.players)) {
    p.age += 1
    // development / decline. The last few points are the hardest: growth
    // slows sharply near the top so the world's elite stay rare - without
    // this, every nation's best 23 converges on 99 by season 12
    const growth = (base: number) =>
      p.ca >= 94 ? (rng() < 0.4 ? 1 : 0)
      : p.ca >= 88 ? Math.max(1, Math.floor(base / 2))
      // THE GOOD ARE SLOWER TO BECOME GREAT (1.8.14). Damping began at 88, so a
      // generated prospect ran at full pace through the 80s: ten seasons took
      // the world from 30 men rated 90+ to over 150 and the best 200 two and a
      // half points higher, younger every year. No new draw: a rounding.
      : p.ca >= 83 ? Math.max(1, Math.round(base * 0.65))
      : base
    // the dev factor scales the roll; the fraction is settled by a second
    // roll so a 1.1x factor means 10% more growth on average, not rounding
    // noise (probabilistic rounding keeps the world mean exactly scaled)
    // ...and the gap to his potential sets the pace (ageing.ts gapGrowth, E5):
    // read once, before any of this summer's growth, so a big gap is a fast
    // summer and a man a point off his ceiling barely moves
    // and his tempo (1.8.2, devproject.ts): an early developer's growth comes
    // before 21, a late bloomer's after
    const dev = devFactor(state, p) * gapGrowth(p.ca, p.pa) * tempoF(learning(state.seed, p).tempo, p.age) * youthPace(p.age, p.pa >= PRODIGY_PA && learning(state.seed, p).tempo === 'early')
    const scaled = (b: number) => { const r = b * dev; const n = Math.floor(r); return n + (rng() < r - n ? 1 : 0) }
    // the late bloomer's clock runs slow (25D): his fast lane reaches 25 and
    // growth stays alive to 29 - the hidden flag is a pure function of
    // (seed, id), so it costs the save nothing and the scout finds out the
    // honest way, by watching a 27-year-old refuse to plateau
    const bloom = isLateBloomer(state.seed, p.id)
    // ---- THE CURVE, RECALIBRATED (1.6.3) ----
    // Ten seasons of the old curve (scripts/qa/drift.ts, three seeds, both
    // worlds) took the world from 30 players rated 90+ to over 200, the
    // 30-33 band from a 63 mean to 80, and National One's best XV from 48 to
    // 78 - the pyramid flattened into one tier. Three things did it: the
    // second growth phase ran to 27 at a point or two a year, nobody
    // declined before 31, and every retiring 78+ man was reborn with his
    // own potential. So: the late phase is a coin toss for one point, the
    // slide starts at 29, and the rebirth below is rarer and lower.
    const caBefore = p.ca
    if (p.age <= (bloom ? 25 : 23) && p.ca < p.pa) p.ca = clamp(p.ca + growth(scaled(2 + Math.floor(rng() * 3))), 1, p.pa)
    // (a late bloomer keeps his old late phase - a point or two a year to 29
    // is the whole point of him, and scripts/round25d.ts holds it)
    else if (p.age <= (bloom ? 29 : 27) && p.ca < p.pa) p.ca = clamp(p.ca + growth(scaled(bloom ? 1 + Math.floor(rng() * 2) : (rng() < 0.5 ? 1 : 0))), 1, p.pa)
    else if (p.age >= 35) p.ca = clamp(p.ca - (3 + Math.floor(rng() * 3)), 30, 99)
    else if (p.age >= 33) p.ca = clamp(p.ca - (2 + Math.floor(rng() * 3)), 30, 99)
    else if (p.age >= 31) p.ca = clamp(p.ca - (1 + Math.floor(rng() * 2)), 30, 99)
    else if (p.age >= 29 && !bloom) p.ca = clamp(p.ca - (rng() < 0.5 ? 1 : 0), 30, 99)
    // THE SLIDE READS THE POSITION (1.7.3, "physical vs tactical aging"). A
    // wing's game is his legs and the legs go first; a prop, a hooker or a
    // fly-half lives on craft that holds. Between 29 and 33 a wing or full
    // back loses an extra point two summers in five, and a front-rower or
    // fly-half who slipped keeps the point one summer in four. Five of one,
    // eight of the other in a squad: the two roughly cancel. By hash, so the
    // rolls above are the same rolls.
    if (p.age >= 29 && p.age <= 33 && !bloom) {
      const u = mulberry32((state.seed ^ Math.imul(p.id, 0x3c6ef372) ^ Math.imul(state.season + 7, 0x7f4a7c15)) >>> 0)()
      if (EARLY_FADE.has(p.pos) && u < 0.4) p.ca = clamp(p.ca - 1, 30, 99)
      else if (LATE_PEAK.has(p.pos) && u < 0.25 && p.ca < caBefore) p.ca += 1
    }
    // THE PERSONAL PLAN'S GROWTH (1.8.0): training decides where a man's
    // ability goes (ageing.ts trainPoint); what a programme adds is this, one
    // rating point a summer while he is below his potential, the owner's
    // chosen "redirect + small boost". The user's club only, like the plans.
    // (1.8.14: a programme is for a man still learning his trade, 26 or under)
    if (p.clubId === state.userClubId && activePlan(state, p.id) && p.ca < p.pa && p.age <= 26) p.ca += 1
    // the attributes follow the rating, shaped by age (ageing.ts). This used
    // to scale every attribute by rating against BIRTH rating every summer,
    // which compounded without end
    ageAttributes(state, p, caBefore)
    // retirement
    const retireChance = p.farewell || p.retiring ? 1 // he said it was the last dance, and he meant it
      : p.age >= 38 ? 1 : p.age >= 36 ? 0.6 : p.age >= 34 ? (p.ca < 72 ? 0.45 : 0.2) : p.age >= 33 && p.ca < 60 ? 0.3 : 0
    if (rng() < retireChance) retirees.push(p)
    // the summer price: position curve and contract length, form left to
    // the season to write
    p.value = playerValue(p.ca, p.age, p.pa, p.pos, undefined, p.contractEnds - state.season, p.caps)
  }
  // THE DEVELOPMENT DEAL ENDS AT 21, AND IT IS THE MANAGER'S CALL (user: "we
  // also need an age where they need to either be upgraded or released... the
  // contract should expire at age 21 to allow this"). The academy used to
  // auto-graduate everyone at 22, so the manager never had to decide anything
  // - the pipeline fed the senior squad on its own. Now a lad's final academy
  // year is announced the summer he turns 20, and the summer he turns 21 he
  // either wears the pro contract the manager gave him (the Promote button on
  // his page, any time before then) or he leaves as a free agent. AI academies
  // keep their own rules - graduate at 22, early when clearly ready - because
  // their pipelines are not run by the user's judgement.
  const lastYear: Player[] = []
  const released: Player[] = []
  for (const p of Object.values(state.players)) {
    if (!p.acad) continue
    // a hand-demoted senior is not an academy prospect: the sweep below would
    // release him at 21+ for nothing, or "graduate" him onto a repriced deal
    if (p.demoted) continue
    if (p.clubId === state.userClubId) {
      if (p.age >= 21) {
        const c = state.clubs[p.clubId]
        if (c) c.players = c.players.filter(id => id !== p.id)
        p.acad = false
        rememberDeparture(state, p, 'let-go', state.userClubId) // memory.ts
        p.clubId = null
        released.push(p)
      } else if (p.age === 20) {
        lastYear.push(p)
      }
      continue
    }
    if (p.age >= 22 || p.ca >= 62) {
      p.acad = false
      // he is a graduate of this club's academy for the rest of his career,
      // wherever he ends up playing it (dream.ts counts them)
      p.homegrown = true
      p.gradClub ??= p.clubId ?? undefined
      p.gradS ??= state.season
      // HE SIGNS HIS FIRST PROFESSIONAL CONTRACT. He was on a development deal
      // (see playerWage), and graduating without re-pricing him would leave a
      // senior squad man on academy money for the rest of his career. At the
      // rate his club can pay (aiecon.ts aiPayRate, 1.8.3).
      const club = p.clubId ? state.clubs[p.clubId] : undefined
      rooms ??= aiWageRooms(state)
      const rate = club ? aiPayRate(state, club, rooms.get(club.id)) : 1
      p.wage = Math.round(playerWage(p.ca, p.age) * rate / 50) * 50
      p.debutPending = p.stats.apps === 0 && p.career.length === 0 ? 'academy' : null
    }
  }
  if (lastYear.length) {
    lastYear.sort((a, b) => b.ca - a.ca)
    state.news.push({
      id: state.nextId++, week: 1, season: state.season + 1, type: 'youth', read: false,
      subject: lastYear.length === 1
        ? `${lastYear[0].name}'s last academy year`
        : `Last academy year for ${lastYear.length} of your prospects`,
      body: `Development deals run out at 21, and this season is the last one for ${lastYear.map(p => `${p.name} (${p.age}, ${p.pos})`).join(', ')}. Promote ${lastYear.length === 1 ? 'him' : 'each of them'} to a professional contract before next summer, or the deal expires and ${lastYear.length === 1 ? 'he walks' : 'they walk'} for nothing.`,
      k: lastYear.length === 1 ? 'news.lastYearOne' : 'news.lastYearMany',
      v: {
        n: lastYear.length, who: lastYear[0].name,
        men_l: JSON.stringify(lastYear.map(x => ({ k: 'news.lastYearMan', name: x.name, age: x.age, pos: x.pos }))),
      },
      playerId: lastYear[0].id,
    })
  }
  if (released.length) {
    released.sort((a, b) => b.ca - a.ca)
    state.news.push({
      id: state.nextId++, week: 1, season: state.season + 1, type: 'youth', read: false,
      subject: released.length === 1
        ? `${released[0].name}'s development deal expires - he leaves`
        : `${released.length} academy deals expire - they leave`,
      body: `No professional terms were offered, so at 21 the academy road ends: ${released.map(p => `${p.name} (${p.pos})`).join(', ')} ${released.length === 1 ? 'leaves' : 'leave'} as ${released.length === 1 ? 'a free agent' : 'free agents'}. The academy coach clears ${released.length === 1 ? 'his locker' : 'their lockers'} and starts again with the next intake.`,
      k: released.length === 1 ? 'news.releasedOne' : 'news.releasedMany',
      v: {
        n: released.length, who: released[0].name,
        men_l: JSON.stringify(released.map(x => ({ k: 'news.releasedMan', name: x.name, pos: x.pos }))),
      },
      playerId: released[0].id,
    })
  }

  const userRetirees = retirees.filter(p => p.clubId === state.userClubId)
  // the induction class arrives together, so it is announced together: four
  // separate plaque notices were four of the fourteen items in a final week
  // that already carries the season review, the awards and the play-offs
  const inductees: { p: Player; apps: number; tries: number; pts: number }[] = []
  for (const p of retirees) {
    // the record book: 100+ appearances for a club earns a page in it
    const byClub = new Map<string, { apps: number; tries: number; pts: number }>()
    for (const c of careerRows(p)) {
      const e = byClub.get(c.clubId) ?? { apps: 0, tries: 0, pts: 0 }
      e.apps += c.apps; e.tries += c.tries; e.pts += c.points
      byClub.set(c.clubId, e)
    }
    for (const [clubId, tot] of byClub) {
      const club = state.clubs[clubId]
      if (!club || tot.apps < 100) continue
      club.legends = [...(club.legends ?? []), { name: p.name, ...tot }]
        .sort((a, b) => b.apps - a.apps).slice(0, 25)
    }

    // the Hall of Fame: a career that will be talked about forever
    const tApps = careerRows(p).reduce((s, c) => s + c.apps, 0) + p.stats.apps + (p.hist?.apps ?? 0)
    const tTries = careerRows(p).reduce((s, c) => s + c.tries, 0) + p.stats.tries + (p.hist?.tries ?? 0)
    const tPts = careerRows(p).reduce((s, c) => s + c.points, 0) + p.stats.points + (p.hist?.points ?? 0)
    const peakCa = Math.max(p.ca, p.q0, p.ca0 ?? 0)
    if ((peakCa >= 85 && (tApps >= 350 || tTries >= 150 || tPts >= 2200)) || tApps >= 470 || tTries >= 190 || tPts >= 3000) {
      const score = (h: { apps: number; tries: number; points: number }) => h.apps + h.tries * 2 + h.points / 10
      state.hof = [...(state.hof ?? []), {
        name: p.name, pos: p.pos, nat: p.nat,
        apps: tApps, tries: tTries, points: tPts,
        season: state.season, club: state.clubs[p.clubId ?? '']?.short ?? '-',
      }].sort((a, b) => score(b) - score(a)).slice(0, 50)
      inductees.push({ p, apps: tApps, tries: tTries, pts: tPts })
    }
  }
  if (inductees.length) {
    const line = (i: typeof inductees[0]) => `${i.p.name} (${i.p.pos}, ${i.apps} apps, ${i.tries} tries, ${i.pts} pts)`
    const mine = inductees.filter(i => i.p.clubId === state.userClubId)
    const one = inductees.length === 1
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
      subject: one
        ? `${inductees[0].p.name} enters the Hall of Fame`
        : `${inductees.length} enter the Hall of Fame`,
      body: one
        ? `${line(inductees[0])} retires with numbers that close the argument. ${mine.length ? 'He finishes as one of yours - a career your club will claim for generations.' : 'The game stands to applaud one of its greats.'} His plaque goes up alongside the immortals.`
        : `The class of ${BASE_YEAR + state.season + 1} is confirmed. ${inductees.map(line).join('. ')}. ${mine.length ? `${mine.length === 1 ? `${mine[0].p.name} finishes` : `${mine.length} of them finish`} as ${mine.length === 1 ? 'one of yours' : 'yours'} - careers your club will claim for generations.` : 'The game stands to applaud them all.'} The plaques go up alongside the immortals.`,
      k: one ? 'news.hofOne' : 'news.hofMany',
      v: {
        // the induction YEAR, as text: "the class of 1" was the season counter
        // (release QA after 1.8.16), and a number would print as 2,027
        who: inductees[0].p.name, n: inductees.length, season: String(BASE_YEAR + state.season + 1),
        men_l: JSON.stringify(inductees.map(i => ({
          k: 'news.hofMan', name: i.p.name, pos: i.p.pos, apps: i.apps, tries: i.tries, pts: i.pts,
        }))),
        mine_k: mine.length === 0 ? (one ? 'news.hofNotYoursOne' : 'news.hofNotYoursMany')
          : mine.length === 1 ? (one ? 'news.hofYoursOne' : 'news.hofYoursNamed')
          : 'news.hofYoursMany',
        mineName: mine[0]?.p.name ?? '', mineN: mine.length,
      },
    })
  }
  // heirs at the user's club, collected so a heavy summer files one story:
  // the 20-season soak found week 1 carrying four near-identical "Academy
  // buzz" cards when four stars retired at once (release audit, 25 Aug)
  const heirBuzz: { heir: Player; last: string; player: string }[] = []
  for (const p of retirees) {
    const clubId = p.clubId
    if (clubId) {
      const c = state.clubs[clubId]
      c.players = c.players.filter(id => id !== p.id)
      // his marquee slot retires with him (1.6.3)
      if (c.marquee) c.marquee = c.marquee.filter(id => id !== p.id)
    }
    forget(state, p)
    // FM-style rebirth: a notable retiree respawns as an academy newgen
    // of similar potential at the same club, under a new name
    const peak = Math.max(p.ca, p.q0)
    // rarer and lower than the man he replaces (1.6.3): forty heirs a summer
    // born with an 80-99 ceiling was the engine of the world's inflation
    if (clubId && peak >= 82 && state.clubs[clubId] && rng() < 0.6) {
      const club = state.clubs[clubId]
      const q = 42 + Math.floor(rng() * 14)
      const raw = {
        name: regenName(rng, p.nat in { ENG:1, FRA:1, IRE:1, SCO:1, WAL:1, ITA:1, NZL:1, AUS:1, RSA:1, ARG:1, FIJ:1, SAM:1, TGA:1, JPN:1, GEO:1, USA:1 } ? p.nat : club.country, worldNames(state), genderOf(state)),
        pos: p.pos, age: 17 + Math.floor(rng() * 2), nat: p.nat, q,
        gk: p.gk && rng() < 0.6,
      }
      const a = deriveAttrs(raw, state.seed + p.id * 7 + 3)
      const heir: Player = {
        id: nextPid(),
        name: raw.name, pos: p.pos, alt: [...p.alt], age: raw.age, nat: p.nat, clubId,
        a,
        ca: q, pa: clamp(peak - 12 + Math.floor(rng() * 12), q + 10, 94), q0: q,
        intl: false, gk: !!raw.gk,
        form: 6, morale: 7, cond: 100, sharp: 50,
        injury: null, bans: 0, natSquad: false,
        wage: 650, contractEnds: state.season + 3,
        value: 0, stats: emptyStats(), career: [], transferListed: false, youth: true, acad: true,
        pers: assignPersonality(rng, a),
        sc: clubId === state.userClubId ? 100 : 15,
      }
      heir.value = playerValue(heir.ca, heir.age, heir.pa, heir.pos, undefined, undefined, heir.caps)
      state.players[heir.id] = heir
      club.players.push(heir.id)
      if (clubId === state.userClubId) {
        heirBuzz.push({ heir, last: p.name.split(' ').slice(-1)[0], player: p.name })
      }
    }
  }
  if (heirBuzz.length <= 2) {
    // one or two heirs keep their own headlines, exactly as before
    for (const { heir, last, player } of heirBuzz) {
      state.news.push({
        id: state.nextId++, week: 1, season: state.season + 1, type: 'youth', read: false,
        subject: `Academy buzz: the next ${last}?`,
        body: `${heir.name}, a ${heir.age}-year-old ${heir.pos}, has joined the academy - and the coaches whisper he has everything ${player} had at that age. Handle with care.`,
        k: 'news.academyBuzz',
        v: { last, heir: heir.name, age: heir.age, pos: heir.pos, player },
        playerId: heir.id,
      })
    }
  } else if (heirBuzz.length) {
    // a generation retires together: one story, every name in it
    state.news.push({
      id: state.nextId++, week: 1, season: state.season + 1, type: 'youth', read: false,
      subject: `Academy buzz: ${heirBuzz.length} heirs arrive`,
      body: `The summer intake reads like a roll of honour: ${heirBuzz.map(x => `${x.heir.name} (${x.heir.age}, ${x.heir.pos}) - the next ${x.last}`).join(', ')}. The coaches ask for patience with every one of them.`,
      k: 'news.academyBuzzMany',
      v: {
        n: heirBuzz.length,
        heirs_l: JSON.stringify(heirBuzz.map(x => ({ k: 'news.buzzHeir', heir: x.heir.name, age: x.heir.age, pos_k: `pos.${x.heir.pos}`, last: x.last }))),
      },
    })
  }
  if (userRetirees.length) {
    state.news.push({
      id: state.nextId++, week: 1, season: state.season + 1, type: 'general', read: false,
      subject: 'Retirements',
      body: `Hanging up the boots: ${userRetirees.map(p => `${p.name} (${p.age})`).join(', ')}. The dressing room won't be the same.`,
      k: 'news.retirements',
      v: { men_l: JSON.stringify(userRetirees.map(x => ({ k: 'news.retireeMan', name: x.name, age: x.age }))) },
    })
    // the send-offs: a farewell-season man gets his shirt retired (his
    // testimonial already happened in pre-season); a surprise retiree
    // with the same service gets the one-off ceremony instead
    const legend = userRetirees
      .map(p => ({ p, apps: clubServiceApps(state, p) }))
      .filter(x => x.apps >= 150)
      .sort((a, b) => b.apps - a.apps)[0]
    if (legend) {
      const club = state.clubs[state.userClubId]
      for (const id of club.players) {
        const tm = state.players[id]
        if (tm) tm.morale = clamp(tm.morale + 0.4, 1, 10)
      }
      if (legend.p.farewell) {
        state.news.push({
          id: state.nextId++, week: 1, season: state.season + 1, type: 'award', read: false,
          subject: `The shirt goes up: ${legend.p.name} retires`,
          body: `The farewell tour is over. ${legend.p.name} finishes with ${legend.apps} appearances for the club, and this morning his shirt went up over the tunnel where every young player will walk under it.`,
          k: 'news.shirtUp', v: { player: legend.p.name, apps: legend.apps },
        })
      } else {
        const gate = Math.round(club.capacity * 32)
        club.balance += gate
        state.news.push({
          id: state.nextId++, week: 1, season: state.season + 1, type: 'award', read: false,
          subject: `Testimonial: ${legend.p.name} - ${legend.apps} games of service`,
          body: `A full ${club.stadium} rises for ${legend.p.name}. ${legend.apps} appearances, every one of them honest. He walks the pitch with his family, the gate receipts (${fmtMoney(gate)}) go to the club at his insistence, and his shirt goes up over the tunnel.`,
          k: 'news.testimonial',
          v: { player: legend.p.name, apps: legend.apps, stadium: club.stadium, gate: fmtMoney(gate) },
        })
      }
    }
  }
}

/** Appearances in this club's shirt: seasons played here plus current-season
 *  apps, plus pre-2025 service for men who have never played anywhere else. */
function clubServiceApps(state: GameState, p: Player): number {
  const clubId = state.userClubId
  const here = careerRows(p).filter(c => c.clubId === clubId).reduce((s, c) => s + c.apps, 0) + p.stats.apps
  const oneClub = careerRows(p).every(c => c.clubId === clubId)
  const pre = oneClub ? Math.max(0, (p.hist?.apps ?? 0) - (p.exApps ?? 0)) : 0
  return here + pre
}

/** The farewell season: a one-club servant announces his last dance, and
 *  his home pre-season friendly becomes the testimonial he plays in. */
export function announceFarewell(state: GameState) {
  const club = state.clubs[state.userClubId]
  if (club && !state.unemployed) {
    const cand = club.players
      .map(id => state.players[id])
      .filter(Boolean)
      .filter(p => p.age >= 34 && !p.farewell && !p.loanFrom)
      .map(p => ({ p, apps: clubServiceApps(state, p) }))
      .filter(x => x.apps >= 150)
      .sort((a, b) => b.apps - a.apps)[0]
    const home = cand ? state.fixtures.find(f =>
      f.compId === 'fr' && !f.played && f.week <= 3 && f.homeId === club.id) : null
    if (cand && home) {
      cand.p.farewell = true
      cand.p.morale = clamp(cand.p.morale + 1, 1, 10)
      home.testimonial = cand.p.id
      state.news.push({
        id: state.nextId++, week: 1, season: state.season, type: 'award', read: false,
        subject: `The last dance: ${cand.p.name} announces his farewell season`,
        body: `${cand.p.name} (${cand.p.age}, ${cand.p.pos}) has told the squad this season will be his last. ${cand.apps} appearances in the shirt, and one year left to add to them. His testimonial is set for the pre-season fixture at ${club.stadium} in week ${home.week} - pick him, and give the ground its goodbye.`,
        k: 'news.lastDance',
        v: { player: cand.p.name, age: cand.p.age, pos: cand.p.pos, apps: cand.apps, stadium: club.stadium, week: home.week },
        playerId: cand.p.id,
      })
    }
  }
}
