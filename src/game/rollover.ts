import type { Club, GameState, Player, Pos } from './model'
import { aiBoardsReinvest } from './aiecon'
import { applyAdminPenalties } from './season'
import { settleInsolvency } from './insolvency'
import { ageManager } from './career'
import { rivalVerdict } from './boss'
import { boardObjective, boardPatience, closeNatTenure, demandCeiling, emptyStats, facLevel, facilityCost, FACILITY_INFO, fmtMoney, isWorldCupSeason, logDecision, MAX_FACILITY, SEASON_WEEKS, seasonLabel, XV_SLOTS, type FacilityId } from './model'
import { assignPersonality } from './attributes'
import { buildChampionsCup, buildInternationals, buildLeague, schedulePreseason, sortTable } from './schedule'
import { punditPredictions } from './gossip'
import { CHALLENGES, LEAGUE_DEFS } from './newgame'
import { SLOTS, expireDeals, offersFor } from './commercial'
import { OFFICE_OUTLET } from './media'
import { autoSelect } from './matchEngine'
import { ensureCaptains } from './analysis'
import { dreamState } from './dream'
import { objectiveById, pickObjectives } from './objectives'
import { deriveAttrs, isLateBloomer, nextPid, playerValue, playerWage } from './attributes'
import { nationByCode, regenName, worldNames } from './nations'
import { clamp, mulberry32, pick, type Rng } from './rng'
import { resetFamiliarity } from './playbook'
import { closeAcademySeason, ensureAcademyLeague, topUpAcademy } from './academy'
import { mentorBoost } from './mentoring'
import { staffChem } from './staff'
import { tIn, type Vars } from './i18n'

const ordinal = (n: number) =>
  n <= 0 ? '-' : `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`

/**
 * A board does not sit on cash. Over the summer, anything well beyond a
 * healthy reserve gets spent on the club: one build on the estate, and the
 * rest into the debt, the academy and the community programme.
 *
 * Written after a 20-season soak finished with the manager's club on £179M
 * against an AI median of £15M, which makes the transfer market meaningless
 * from about season eight. The money is not confiscated - it is spent, the
 * news item says on what, and the terraces notice.
 *
 * Deliberately deterministic: no draw from the shared season rng, so adding
 * this cannot shift any match or transfer that follows it.
 */
function boardReinvests(state: GameState) {
  const club = state.clubs[state.userClubId]
  if (!club || state.unemployed) return
  const weekly = club.players.reduce((s, id) => s + (state.players[id]?.wage ?? 0), 0)
  // a full season of wages plus a float is a prudent reserve, and the manager
  // keeps it: a first pass swept 55% above 0.6 of a season and left him poorer
  // than the AI median, which is its own kind of wrong
  const reserve = Math.round(weekly * SEASON_WEEKS + 4_000_000)
  if (club.balance <= reserve * 1.5) return
  const spend = Math.round((club.balance - reserve) * 0.4)
  if (spend < 500_000) return
  club.balance -= spend

  // the board funds one build itself: whatever is weakest on the estate
  const weakest = (Object.keys(FACILITY_INFO) as FacilityId[])
    .filter(fid => (club.facilities?.[fid] ?? 0) < MAX_FACILITY)
    .sort((a, b) => (club.facilities?.[a] ?? 0) - (club.facilities?.[b] ?? 0))[0]
  let built: string | null = null
  if (weakest) {
    const lvl = club.facilities?.[weakest] ?? 0
    if (spend >= facilityCost(FACILITY_INFO[weakest], lvl)) {
      club.facilities = { ...(club.facilities ?? {}), [weakest]: lvl + 1 }
      built = tIn('en', 'news.reinvestBuilt', { name_k: FACILITY_INFO[weakest].name, lvl: lvl + 1 })
    }
  }
  state.fanMood = clamp((state.fanMood ?? 60) + 2, 0, 100)
  state.news.push({
    id: state.nextId++, week: 1, season: state.season + 1, type: 'board', read: false,
    subject: `💼 The board reinvests ${fmtMoney(spend)}`,
    body: `The accounts closed in rude health, and the board has no intention of letting the money sit in a deposit account while the club stands still. ${fmtMoney(spend)} goes back into ${club.name} over the summer: ${built ? `${built}, ` : ''}the last of the ground debt cleared, the academy funded for another cycle, and the community programme kept in the schools that feed this place. Your reserve stands at ${fmtMoney(club.balance)}, which is a season of wages and change. Spend the transfer budget on players, not on interest.`,
    k: built ? 'news.reinvestBuild' : 'news.reinvest',
    v: {
      spend: fmtMoney(spend), club: club.name, reserve: fmtMoney(club.balance),
      name_k: weakest ? FACILITY_INFO[weakest].name : 'common.nothing',
      lvl: weakest ? (club.facilities?.[weakest] ?? 0) : 0,
    },
  })
  logDecision(state, `Board reinvested ${fmtMoney(spend)} in the club`, true)
}

function seasonAwards(state: GameState) {
  const userLeague = state.clubs[state.userClubId].leagueId
  const leaguePlayers = Object.values(state.players).filter(p =>
    p.clubId && state.clubs[p.clubId]?.leagueId === userLeague && p.stats.apps >= 8)
  if (!leaguePlayers.length) return
  const topPoints = [...leaguePlayers].sort((a, b) => b.stats.points - a.stats.points)[0]
  const topTries = [...leaguePlayers].sort((a, b) => b.stats.tries - a.stats.tries)[0]
  const potm = [...leaguePlayers].sort((a, b) =>
    b.stats.ratingSum / Math.max(1, b.stats.apps) - a.stats.ratingSum / Math.max(1, a.stats.apps))[0]
  const leagueName = state.comps[userLeague]?.name ?? 'the league'

  // Team of the Season: best average rating per position slot
  const used = new Set<number>()
  const tots: string[] = []
  for (const slot of XV_SLOTS) {
    const cands = leaguePlayers
      .filter(p => !used.has(p.id) && (p.pos === slot.pos || p.alt.includes(slot.pos)))
      .sort((a, b) => b.stats.ratingSum / Math.max(1, b.stats.apps) - a.stats.ratingSum / Math.max(1, a.stats.apps))
    if (cands[0]) { used.add(cands[0].id); tots.push(`${slot.shirt}. ${cands[0].name} (${state.clubs[cands[0].clubId!]?.short})`) }
  }

  // record-book lines
  const leagueFx = state.fixtures.filter(f => f.compId === userLeague && f.played && !f.stage)
  const biggest = leagueFx.sort((a, b) =>
    Math.abs(b.homeScore - b.awayScore) - Math.abs(a.homeScore - a.awayScore))[0]
  const bestAtt = leagueFx.sort((a, b) => (b.att ?? 0) - (a.att ?? 0))[0]

  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
    subject: `📖 The ${seasonLabel(state.season)} Annual - awards & records`,
    body: [
      `Player of the Season: ${potm.name} (${state.clubs[potm.clubId!]?.short}) - avg rating ${(potm.stats.ratingSum / Math.max(1, potm.stats.apps)).toFixed(2)}`,
      `Top Points Scorer: ${topPoints.name} - ${topPoints.stats.points} points`,
      `Top Try Scorer: ${topTries.name} - ${topTries.stats.tries} tries`,
      biggest ? `Biggest win: ${state.clubs[biggest.homeId]?.short} ${biggest.homeScore}-${biggest.awayScore} ${state.clubs[biggest.awayId]?.short}` : '',
      bestAtt?.att ? `Best attendance: ${bestAtt.att.toLocaleString()} at ${state.clubs[bestAtt.homeId]?.stadium}` : '',
      '',
      // two packed lines instead of fifteen numbered ones (brevity pass 19A):
      // the phone-screen version of a back-page graphic
      `Team of the Season - Pack: ${tots.slice(0, 8).map(t => t.replace(/^\d+\. /, '')).join(', ')}.`,
      `Backs: ${tots.slice(8).map(t => t.replace(/^\d+\. /, '')).join(', ')}.`,
    ].filter(Boolean).join('\n'),
    k: 'news.annual',
    v: {
      season: seasonLabel(state.season),
      rows_ll: JSON.stringify([
        { k: 'news.annPotm', name: potm.name, club: state.clubs[potm.clubId!]?.short ?? '', avg: (potm.stats.ratingSum / Math.max(1, potm.stats.apps)).toFixed(2) },
        { k: 'news.annPoints', name: topPoints.name, n: topPoints.stats.points },
        { k: 'news.annTries', name: topTries.name, n: topTries.stats.tries },
        ...(biggest ? [{ k: 'news.annBiggest', home: state.clubs[biggest.homeId]?.short ?? '', hs: biggest.homeScore, as: biggest.awayScore, away: state.clubs[biggest.awayId]?.short ?? '' }] : []),
        ...(bestAtt?.att ? [{ k: 'news.annAtt', n: bestAtt.att, stadium: state.clubs[bestAtt.homeId]?.stadium ?? '' }] : []),
      ]),
      pack: tots.slice(0, 8).map(t => t.replace(/^\d+\. /, '')).join(', '),
      backs: tots.slice(8).map(t => t.replace(/^\d+\. /, '')).join(', '),
    },
  })
}

/** The game's biggest individual prize: judged on the whole world's season,
 *  not one league - form first, with a nudge for tries and silverware. */
function worldPlayerOfTheYear(state: GameState) {
  const cands = Object.values(state.players)
    .filter(p => p.clubId && state.clubs[p.clubId] && p.stats.apps >= 15)
    .map(p => {
      const avg = p.stats.ratingSum / p.stats.apps
      const cups = state.history.filter(h => h.season === state.season && h.champion === p.clubId).length
      // tries already lift match ratings, so the nudge here stays small -
      // any bigger and the podium is wingers only
      return { p, avg, score: avg + p.stats.tries * 0.004 + cups * 0.15 }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
  if (cands.length < 3) return
  const [win, second, third] = cands
  win.p.poty = (win.p.poty ?? 0) + 1
  ;(state.potyRoll ??= []).push({
    season: state.season, playerId: win.p.id, name: win.p.name,
    clubName: state.clubs[win.p.clubId!]?.name ?? 'Unknown',
  })
  const mine = (x: typeof win) => x.p.clubId === state.userClubId
  const row = (x: typeof win, rank: number) => ({
    k: 'news.potyLine', rank, name: x.p.name, pos: x.p.pos,
    club: state.clubs[x.p.clubId!]?.short ?? '', avg: x.avg.toFixed(2), n: x.p.stats.tries,
    again_k: rank === 1 && (x.p.poty ?? 0) > 1 ? 'news.potyAgain' : 'common.nothing',
    poty: x.p.poty ?? 0,
  })
  const line = (x: typeof win) =>
    `${x.p.name} (${x.p.pos}, ${state.clubs[x.p.clubId!]?.short}) - avg ${x.avg.toFixed(2)}, ${x.p.stats.tries} tries`
  state.news.push({
    id: state.nextId++, week: 1, season: state.season + 1, type: 'award', read: false,
    subject: `🏅 World Player of the Year: ${win.p.name}`,
    body: [
      `The world game names its best. The shortlist:`,
      `1. ${line(win)}${(win.p.poty ?? 0) > 1 ? ` (award number ${win.p.poty})` : ''}`,
      `2. ${line(second)}`,
      `3. ${line(third)}`,
      mine(win) ? `He is YOURS. The whole sport just watched your man collect its biggest prize - enjoy the market circling him, because it starts tomorrow.`
        : mine(second) || mine(third) ? `One of yours made the podium. The scouts noticed; so did his agent.`
        : `The bar for next season is set.`,
    ].join('\n'),
    k: 'news.poty',
    v: {
      player: win.p.name,
      rows_ll: JSON.stringify([row(win, 1), row(second, 2), row(third, 3)]),
      tail_k: mine(win) ? 'news.potyYours'
        : mine(second) || mine(third) ? 'news.potyPodium' : 'news.potyBar',
    },
    playerId: win.p.id,
  })
}

function settleRecords(state: GameState) {
  state.records ??= {}
  for (const comp of Object.values(state.comps)) {
    if (comp.type !== 'league') continue
    const teamSet = new Set(comp.teamIds)
    const pool = Object.values(state.players).filter(p => p.clubId && teamSet.has(p.clubId) && p.stats.apps >= 6)
    if (!pool.length) continue
    const topP = [...pool].sort((a, b) => b.stats.points - a.stats.points)[0]
    const topT = [...pool].sort((a, b) => b.stats.tries - a.stats.tries)[0]
    const rec = state.records[comp.id] ??= {
      pts: { name: topP.name, val: topP.stats.points, season: state.season },
      tries: { name: topT.name, val: topT.stats.tries, season: state.season },
    }
    const userLeague = state.clubs[state.userClubId]?.leagueId === comp.id
    if (topP.stats.points > rec.pts.val && rec.pts.season !== state.season) {
      if (userLeague) state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
        subject: `📖 RECORD BROKEN: most points in a ${comp.short} season`,
        body: `${topP.name} finishes with ${topP.stats.points} points - beating ${rec.pts.name}'s record of ${rec.pts.val} (${seasonLabel(rec.pts.season)}). The record book gets a new page.`,
        k: 'news.recPoints',
        v: { comp: comp.short, name: topP.name, n: topP.stats.points, old: rec.pts.name, oldN: rec.pts.val, season: seasonLabel(rec.pts.season) },
        playerId: topP.id,
      })
      state.records[comp.id].pts = { name: topP.name, val: topP.stats.points, season: state.season }
    }
    if (topT.stats.tries > rec.tries.val && rec.tries.season !== state.season) {
      if (userLeague) state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
        subject: `📖 RECORD BROKEN: most tries in a ${comp.short} season`,
        body: `${topT.name} crosses ${topT.stats.tries} times - past ${rec.tries.name}'s ${rec.tries.val} (${seasonLabel(rec.tries.season)}). Wingers everywhere take note.`,
        k: 'news.recTries',
        v: { comp: comp.short, name: topT.name, n: topT.stats.tries, old: rec.tries.name, oldN: rec.tries.val, season: seasonLabel(rec.tries.season) },
        playerId: topT.id,
      })
      state.records[comp.id].tries = { name: topT.name, val: topT.stats.tries, season: state.season }
    }
  }
}

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
  if (!p.acad && p.age <= 23 && p.lastStarts != null) {
    f += p.lastStarts >= 10 ? 0.10 : p.lastStarts <= 2 ? -0.10 : -0.012
  }
  if (p.clubId === state.userClubId) {
    const pair = (state.mentors ?? []).find(mp => mp.kid === p.id)
    const senior = pair ? state.players[pair.senior] : null
    if (senior) f += 0.06 * mentorBoost(senior, p)
    f += (state.staff?.assistant ?? 0) * 0.03
    // the weather in the staff room (25D-3): a coaching team that clicks
    // teaches better than the sum of its badges, one that feuds teaches
    // worse. Deterministic, small, and entirely the manager's own doing -
    // he hired them
    f += clamp(staffChem(state) * 0.01, -0.03, 0.03)
  }
  return clamp(f, p.acad ? 0.6 : 0.65, p.acad ? 1.65 : 1.4)
}

function agePlayers(state: GameState, rng: Rng) {
  const retirees: Player[] = []
  for (const p of Object.values(state.players)) {
    p.age += 1
    // development / decline. The last few points are the hardest: growth
    // slows sharply near the top so the world's elite stay rare - without
    // this, every nation's best 23 converges on 99 by season 12
    const growth = (base: number) =>
      p.ca >= 94 ? (rng() < 0.4 ? 1 : 0)
      : p.ca >= 88 ? Math.max(1, Math.floor(base / 2))
      : base
    // the dev factor scales the roll; the fraction is settled by a second
    // roll so a 1.1x factor means 10% more growth on average, not rounding
    // noise (probabilistic rounding keeps the world mean exactly scaled)
    const dev = devFactor(state, p)
    const scaled = (b: number) => { const r = b * dev; const n = Math.floor(r); return n + (rng() < r - n ? 1 : 0) }
    // the late bloomer's clock runs slow (25D): his fast lane reaches 25 and
    // growth stays alive to 29 - the hidden flag is a pure function of
    // (seed, id), so it costs the save nothing and the scout finds out the
    // honest way, by watching a 27-year-old refuse to plateau
    const bloom = isLateBloomer(state.seed, p.id)
    if (p.age <= (bloom ? 25 : 23) && p.ca < p.pa) p.ca = clamp(p.ca + growth(scaled(2 + Math.floor(rng() * 3))), 1, p.pa)
    else if (p.age <= (bloom ? 29 : 27) && p.ca < p.pa) p.ca = clamp(p.ca + growth(scaled(1 + Math.floor(rng() * 2))), 1, p.pa)
    else if (p.age >= 33) p.ca = clamp(p.ca - (2 + Math.floor(rng() * 3)), 30, 99)
    else if (p.age >= 31) p.ca = clamp(p.ca - (1 + Math.floor(rng() * 2)), 30, 99)
    // attribute drift toward new ca
    const scale = p.ca / Math.max(30, p.q0)
    if (Math.abs(scale - 1) > 0.05) {
      for (const k of Object.keys(p.a) as (keyof Player['a'])[]) {
        p.a[k] = clamp(Math.round(p.a[k] * (0.85 + 0.15 * scale) + (scale > 1 ? 0.5 : -0.5)), 1, 20)
      }
    }
    // retirement
    const retireChance = p.farewell || p.retiring ? 1 // he said it was the last dance, and he meant it
      : p.age >= 38 ? 1 : p.age >= 36 ? 0.6 : p.age >= 34 ? (p.ca < 72 ? 0.45 : 0.2) : p.age >= 33 && p.ca < 60 ? 0.3 : 0
    if (rng() < retireChance) retirees.push(p)
    // the summer price: position curve and contract length, form left to
    // the season to write
    p.value = playerValue(p.ca, p.age, p.pa, p.pos, undefined, p.contractEnds - state.season)
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
    if (p.clubId === state.userClubId) {
      if (p.age >= 21) {
        const c = state.clubs[p.clubId]
        if (c) c.players = c.players.filter(id => id !== p.id)
        p.acad = false
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
      // HE SIGNS HIS FIRST PROFESSIONAL CONTRACT. He was on a development deal
      // (see playerWage), and graduating without re-pricing him would leave a
      // senior squad man on academy money for the rest of his career.
      p.wage = playerWage(p.ca, p.age)
      p.debutPending = p.stats.apps === 0 && p.career.length === 0 ? 'academy' : null
    }
  }
  if (lastYear.length) {
    lastYear.sort((a, b) => b.ca - a.ca)
    state.news.push({
      id: state.nextId++, week: 1, season: state.season + 1, type: 'youth', read: false,
      subject: lastYear.length === 1
        ? `⏳ ${lastYear[0].name}'s last academy year`
        : `⏳ Last academy year for ${lastYear.length} of your prospects`,
      body: `Development deals run out at 21, and this season is the last one for ${lastYear.map(p => `${p.name} (${p.age}, ${p.pos})`).join(', ')}. Promote ${lastYear.length === 1 ? 'him' : 'each of them'} to a professional contract from ${lastYear.length === 1 ? 'his' : 'their'} player page before next summer, or the deal expires and ${lastYear.length === 1 ? 'he walks' : 'they walk'} for nothing.`,
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
        ? `🚪 ${released[0].name}'s development deal expires - he leaves`
        : `🚪 ${released.length} academy deals expire - they leave`,
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
    for (const c of p.career) {
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
    const tApps = p.career.reduce((s, c) => s + c.apps, 0) + p.stats.apps + (p.hist?.apps ?? 0)
    const tTries = p.career.reduce((s, c) => s + c.tries, 0) + p.stats.tries + (p.hist?.tries ?? 0)
    const tPts = p.career.reduce((s, c) => s + c.points, 0) + p.stats.points + (p.hist?.points ?? 0)
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
        ? `🏛 ${inductees[0].p.name} enters the Hall of Fame`
        : `🏛 ${inductees.length} enter the Hall of Fame`,
      body: one
        ? `${line(inductees[0])} retires with numbers that close the argument. ${mine.length ? 'He finishes as one of yours - a career your club will claim for generations.' : 'The game stands to applaud one of its greats.'} His plaque goes up alongside the immortals.`
        : `The class of ${state.season + 1} is confirmed. ${inductees.map(line).join('. ')}. ${mine.length ? `${mine.length === 1 ? `${mine[0].p.name} finishes` : `${mine.length} of them finish`} as ${mine.length === 1 ? 'one of yours' : 'yours'} - careers your club will claim for generations.` : 'The game stands to applaud them all.'} The plaques go up alongside the immortals.`,
      k: one ? 'news.hofOne' : 'news.hofMany',
      v: {
        who: inductees[0].p.name, n: inductees.length, season: state.season + 1,
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
  for (const p of retirees) {
    const clubId = p.clubId
    if (clubId) {
      const c = state.clubs[clubId]
      c.players = c.players.filter(id => id !== p.id)
    }
    delete state.players[p.id]
    // FM-style rebirth: a notable retiree respawns as an academy newgen
    // of similar potential at the same club, under a new name
    const peak = Math.max(p.ca, p.q0)
    if (clubId && peak >= 78 && state.clubs[clubId]) {
      const club = state.clubs[clubId]
      const q = 42 + Math.floor(rng() * 14)
      const raw = {
        name: regenName(rng, p.nat in { ENG:1, FRA:1, IRE:1, SCO:1, WAL:1, ITA:1, NZL:1, AUS:1, RSA:1, ARG:1, FIJ:1, SAM:1, TGA:1, JPN:1, GEO:1 } ? p.nat : club.country, worldNames(state)),
        pos: p.pos, age: 17 + Math.floor(rng() * 2), nat: p.nat, q,
        gk: p.gk && rng() < 0.6,
      }
      const a = deriveAttrs(raw, state.seed + p.id * 7 + 3)
      const heir: Player = {
        id: nextPid(),
        name: raw.name, pos: p.pos, alt: [...p.alt], age: raw.age, nat: p.nat, clubId,
        a,
        ca: q, pa: clamp(peak + Math.floor(rng() * 9) - 4, q + 10, 99), q0: q,
        intl: false, gk: !!raw.gk,
        form: 6, morale: 7, cond: 100, sharp: 50,
        injury: null, bans: 0, natSquad: false,
        wage: 650, contractEnds: state.season + 3,
        value: 0, stats: emptyStats(), career: [], transferListed: false, youth: true, acad: true,
        pers: assignPersonality(rng, a),
        sc: clubId === state.userClubId ? 100 : 15,
      }
      heir.value = playerValue(heir.ca, heir.age, heir.pa, heir.pos)
      state.players[heir.id] = heir
      club.players.push(heir.id)
      if (clubId === state.userClubId) {
        state.news.push({
          id: state.nextId++, week: 1, season: state.season + 1, type: 'youth', read: false,
          subject: `Academy buzz: the next ${p.name.split(' ').slice(-1)[0]}?`,
          body: `${heir.name}, a ${heir.age}-year-old ${heir.pos}, has joined the academy - and the coaches whisper he has everything ${p.name} had at that age. Handle with care.`,
          k: 'news.academyBuzz',
          v: { last: p.name.split(' ').slice(-1)[0], heir: heir.name, age: heir.age, pos: heir.pos, player: p.name },
          playerId: heir.id,
        })
      }
    }
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
          subject: `🎗 The shirt goes up: ${legend.p.name} retires`,
          body: `The farewell tour is over. ${legend.p.name} finishes with ${legend.apps} appearances for the club, and this morning his shirt went up over the tunnel where every young player will walk under it. The game moves on; days like his are why it matters.`,
          k: 'news.shirtUp', v: { player: legend.p.name, apps: legend.apps },
        })
      } else {
        const gate = Math.round(club.capacity * 32)
        club.balance += gate
        state.news.push({
          id: state.nextId++, week: 1, season: state.season + 1, type: 'award', read: false,
          subject: `🎗 Testimonial: ${legend.p.name} - ${legend.apps} games of service`,
          body: `A full ${club.stadium} rises for ${legend.p.name}. ${legend.apps} appearances, every one of them honest. He walks the pitch with his family, the gate receipts (${fmtMoney(gate)}) go to the club at his insistence, and his shirt goes up over the tunnel. Days like this are why the game matters.`,
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
  const here = p.career.filter(c => c.clubId === clubId).reduce((s, c) => s + c.apps, 0) + p.stats.apps
  const oneClub = p.career.every(c => c.clubId === clubId)
  const pre = oneClub ? Math.max(0, (p.hist?.apps ?? 0) - (p.exApps ?? 0)) : 0
  return here + pre
}

function handleContracts(state: GameState, rng: Rng) {
  // pre-contracts go through first: the moves were agreed in the spring
  const freeMoves: { p: Player; to: Club; from: Club | null }[] = []
  for (const pc of state.preContracts ?? []) {
    const p = state.players[pc.playerId]
    const to = state.clubs[pc.toClubId]
    if (!p || !to || p.clubId === pc.toClubId) continue
    const from = p.clubId ? state.clubs[p.clubId] : null
    if (from) {
      from.players = from.players.filter(id => id !== p.id)
      from.tactic.lineup = from.tactic.lineup.map(id => (id === p.id ? null : id))
      if (from.captain === p.id) from.captain = null
      if (from.vice === p.id) from.vice = null
    }
    to.players.push(p.id)
    p.clubId = to.id
    p.wage = Math.round((playerWage(p.ca, p.age) * 1.1) / 50) * 50
    p.contractEnds = state.season + 1 + (p.age < 30 ? 2 : 1)
    p.morale = clamp(p.morale + 1, 1, 10)
    p.transferListed = false
    p.debutPending = 'signing'
    if (to.id === state.userClubId) { p.sc = 100; state.mgr.signings += 1 }
    if (to.id === state.userClubId || from?.id === state.userClubId) {
      freeMoves.push({ p, to, from })
    }
  }
  // a summer of pre-contract business arrives on one page. Three of these in a
  // single week-1 inbox were three separate letters saying the same thing.
  if (freeMoves.length) {
    const one = freeMoves.length === 1
    const line = (m: typeof freeMoves[0]) =>
      `${m.p.name} (${m.p.pos}, ${m.p.age}) to ${m.to.name} on ${fmtMoney(m.p.wage)}/week until ${2026 + m.p.contractEnds}${m.from ? `, leaving ${m.from.short} watching a ${fmtMoney(m.p.value)} asset walk out the door` : ''}`
    // the three biggest moves in full, the rest counted: a six-deal summer at
    // 130 characters a deal blew straight through the 800-character inbox
    // ceiling (19A) the first time the world dealt one - caught by
    // brevityprobe after the Bath data refresh re-dealt the stream (round 24)
    const shown = [...freeMoves].sort((a, b) => b.p.ca - a.p.ca).slice(0, 3)
    const rest = freeMoves.length - shown.length
    state.news.push({
      id: state.nextId++, week: 1, season: state.season + 1, type: 'transfer', read: false,
      subject: one
        ? `${freeMoves[0].p.name} joins ${freeMoves[0].to.name} on a free`
        : `${freeMoves.length} free transfers go through`,
      body: `${one ? 'The pre-contract agreed in the spring goes through' : 'The pre-contracts agreed in the spring go through'}: ${shown.map(line).join('. ')}.${rest > 0 ? ` And ${rest} more deal${rest === 1 ? '' : 's'} of the same kind, done quietly.` : ''} Not a penny changed hands.`,
      k: one ? 'news.freeOne' : 'news.freeMany',
      v: {
        player: freeMoves[0].p.name, to: freeMoves[0].to.name, n: freeMoves.length,
        men_l: JSON.stringify(shown.map(m => ({
          k: m.from ? 'news.freeManFrom' : 'news.freeMan',
          name: m.p.name, pos: m.p.pos, age: m.p.age, to: m.to.name,
          wage: fmtMoney(m.p.wage), until: 2026 + m.p.contractEnds,
          from: m.from?.short ?? '', value: fmtMoney(m.p.value),
        }))),
        rest_k: rest > 0 ? 'news.freeRest' : 'common.nothing', rest,
      },
      playerId: shown[0].p.id,
    })
  }
  state.preContracts = []

  const freed: Player[] = []
  for (const p of Object.values(state.players)) {
    if (p.clubId && p.contractEnds < state.season + 1) {
      const club = state.clubs[p.clubId]
      if (p.clubId !== state.userClubId && rng() < 0.5) {
        // quiet AI renewal
        p.contractEnds = state.season + 2
        p.wage = playerWage(p.ca, p.age)
        continue
      }
      // the DoR's safety net: settled squad men take the standard one-year
      // extension rather than walking - the unhappy and the listed still go
      if (p.clubId === state.userClubId && !p.transferListed && p.morale >= 4.5 && rng() < 0.7) {
        p.contractEnds = state.season + 1
        p.wage = playerWage(p.ca, p.age)
        continue
      }
      club.players = club.players.filter(id => id !== p.id)
      if (p.clubId === state.userClubId) freed.push(p)
      p.clubId = null
      p.transferListed = false
    }
  }
  if (freed.length) {
    state.news.push({
      id: state.nextId++, week: 1, season: state.season + 1, type: 'contract', read: false,
      subject: 'Contracts expired',
      body: `Departed on free transfers after their deals expired: ${freed.map(p => p.name).join(', ')}.`,
      k: 'news.contractsExpired', v: { names: freed.map(p => p.name).join(', ') },
    })
  }
}

const YOUTH_POS: Pos[] = ['LP', 'HK', 'TP', 'LK', 'LK', 'FL', 'FL', 'N8', 'SH', 'FH', 'CE', 'CE', 'WG', 'WG', 'FB']

/** Deep rugby nations produce slightly better kids: without this, national
 *  pecking order converges to who has the most domestic clubs. */
function natTalentBonus(country: string): number {
  const rep = nationByCode(country)?.rep ?? 70
  return Math.floor((rep - 70) / 6)
}

/** Roll the user's next academy class. Fixed at the week-30 preview so the
 *  coach's forecast and intake day always tell the same story. */
export function rollIntakeClass(state: GameState, rng: Rng): NonNullable<GameState['intakeClass']> {
  const club = state.clubs[state.userClubId]
  if (!club) return []
  const coe = facLevel(state, 'academy')
  const n = 2 + Math.floor(rng() * 3)
  const out: NonNullable<GameState['intakeClass']> = []
  for (let i = 0; i < n; i++) {
    const pos = pick(rng, YOUTH_POS)
    const q = 38 + Math.floor(rng() * 22) + Math.floor(club.rep / 12) + Math.round(coe * 1.2) + natTalentBonus(club.country)
    // A wonderkid every couple of seasons rather than every four (user: "there
    // should be more wonderkids in academy's"). The balance holds because the
    // flag is only a CEILING: whether he ever reaches it is now down to the
    // facilities, the coaching, a mentor and his own character (devFactor), so
    // a more generous intake makes more stories, not more free superstars.
    const wonder = rng() < 0.13 + coe * 0.02
    out.push({
      name: regenName(rng, club.country === 'NZL' && club.id === 'moana' ? 'SAM' : club.country, worldNames(state)),
      pos, age: 17 + Math.floor(rng() * 2), q,
      pa: wonder ? clamp(87 + Math.floor(rng() * 13), q + 20, 99) : clamp(q + 12 + Math.floor(rng() * rng() * 30), q, 99),
      gk: (pos === 'FH' || pos === 'FB') && rng() < 0.4,
      wonder,
    })
  }
  return out
}

const paStars = (pa: number) => pa >= 88 ? 5 : pa >= 80 ? 4 : pa >= 71 ? 3 : pa >= 62 ? 2 : 1

function youthIntake(state: GameState, rng: Rng) {
  // the user's class was fixed at the week-30 preview - deliver it verbatim,
  // with the report card the plain arrival note never was
  const userClub = state.clubs[state.userClubId]
  if (userClub) {
    const spec = state.intakeClass?.length ? state.intakeClass : rollIntakeClass(state, rng)
    const report: string[] = []
    const reportRows: { k: string; [x: string]: string | number }[] = []
    spec.forEach((s, i) => {
      const raw = { name: s.name, pos: s.pos, age: s.age, nat: userClub.country, q: s.q, gk: s.gk }
      const a = deriveAttrs(raw, state.seed + state.season * 977 + i)
      const p: Player = {
        id: nextPid(),
        name: s.name, pos: s.pos, alt: [], age: s.age, nat: userClub.country, clubId: userClub.id,
        a,
        ca: s.wonder ? clamp(s.q + 8, 1, 78) : s.q,
        pa: s.pa,
        q0: s.q,
        intl: false, gk: s.gk,
        form: 6, morale: 7, cond: 100, sharp: 50,
        injury: null, bans: 0, natSquad: false,
        wage: 600, contractEnds: state.season + 3,
        value: 0, stats: emptyStats(), career: [], transferListed: false, youth: true, acad: true,
        pers: assignPersonality(rng, a),
        sc: 100,
      }
      p.value = playerValue(p.ca, p.age, p.pa, p.pos)
      state.players[p.id] = p
      userClub.players.push(p.id)
      report.push(`${'★'.repeat(paStars(s.pa))}${'☆'.repeat(5 - paStars(s.pa))} ${p.name} - ${p.pos}, ${p.age}`)
      reportRows.push({
        k: 'news.intakeRow',
        stars: `${'★'.repeat(paStars(s.pa))}${'☆'.repeat(5 - paStars(s.pa))}`,
        name: p.name, pos: p.pos, age: p.age,
      })
      if (s.wonder) {
        state.news.push({
          id: state.nextId++, week: 1, season: state.season + 1, type: 'youth', read: false,
          subject: `🌟 WONDERKID: the academy has struck gold`,
          body: `The coaches are calling ${p.name} (${p.age}, ${p.pos}) the best prospect the academy has produced in a generation. Handle him right - game time, a development focus, patience - and he could be anything.`,
          k: 'news.wonderkid', v: { player: p.name, age: p.age, pos: p.pos },
          playerId: p.id,
        })
      }
    })
    const best = Math.max(0, ...spec.map(s => s.pa))
    const grade = best >= 96 ? 'A' : best >= 90 ? 'B' : best >= 82 ? 'C' : best >= 74 ? 'D' : 'E'
    state.news.push({
      id: state.nextId++, week: 1, season: state.season + 1, type: 'youth', read: false,
      subject: `🎓 Intake day: the class arrives - grade ${grade}`,
      body: [
        `The academy has promoted this year's crop. The coaches' potential ratings:`,
        ...report,
        grade === 'A' ? `A vintage year. Protect them from the vultures and this class will define the club.`
          : grade === 'B' ? `A strong group - at least one of these boys should make the first team his own.`
          : grade === 'C' ? `A decent, honest class. Squad players, with a chance one over-delivers.`
          : grade === 'D' ? `A thin year. The coaches are already talking about next season's group.`
          : `A year to forget. The academy coach has asked that nobody frame this list.`,
      ].join('\n'),
      k: 'news.intakeDay',
      v: { grade, rows_ll: JSON.stringify(reportRows), verdict_k: `news.intakeDay${grade}` },
    })
    state.intakeClass = null
  }

  for (const club of Object.values(state.clubs)) {
    if (club.id === state.userClubId) continue
    const n = 2 + Math.floor(rng() * 3)
    for (let i = 0; i < n; i++) {
      const pos = pick(rng, YOUTH_POS)
      const q = 38 + Math.floor(rng() * 22) + Math.floor(club.rep / 12) + natTalentBonus(club.country)
      const raw = {
        name: regenName(rng, club.country === 'NZL' && club.id === 'moana' ? 'SAM' : club.country, worldNames(state)),
        pos, age: 17 + Math.floor(rng() * 2), nat: club.country, q,
        gk: (pos === 'FH' || pos === 'FB') && rng() < 0.4,
      }
      const a = deriveAttrs(raw, state.seed + state.season * 977 + i)
      const wonder = rng() < 0.085
      const p: Player = {
        id: nextPid(),
        name: raw.name, pos, alt: [], age: raw.age, nat: raw.nat, clubId: club.id,
        a,
        ca: wonder ? clamp(q + 8, 1, 78) : q,
        pa: wonder ? clamp(87 + Math.floor(rng() * 13), q + 20, 99) : clamp(q + 12 + Math.floor(rng() * rng() * 30), q, 99),
        q0: q,
        intl: false, gk: !!raw.gk,
        form: 6, morale: 7, cond: 100, sharp: 50,
        injury: null, bans: 0, natSquad: false,
        wage: 600, contractEnds: state.season + 3,
        value: 0, stats: emptyStats(), career: [], transferListed: false, youth: true, acad: true,
        pers: assignPersonality(rng, a),
        sc: 15,
      }
      p.value = playerValue(p.ca, p.age, p.pa, p.pos)
      state.players[p.id] = p
      club.players.push(p.id)
    }
  }
  // a few unattached young gems drift into the free-agent pool each season
  for (let i = 0; i < 3; i++) {
    const nats = ['FIJ', 'GEO', 'TGA', 'SAM', 'USA', 'URU']
    const nat = pick(rng, nats)
    const pos = pick(rng, YOUTH_POS)
    const q = 54 + Math.floor(rng() * 12)
    const raw = { name: regenName(rng, nat, worldNames(state)), pos, age: 18 + Math.floor(rng() * 3), nat, q, gk: rng() < 0.15 }
    const a = deriveAttrs(raw, state.seed + state.season * 3011 + i)
    const p: Player = {
      id: nextPid(),
      name: raw.name, pos, alt: [], age: raw.age, nat, clubId: null,
      a, ca: q, pa: clamp(84 + Math.floor(rng() * 14), q + 12, 99), q0: q,
      intl: false, gk: !!raw.gk,
      form: 6, morale: 7, cond: 100, sharp: 50,
      injury: null, bans: 0, natSquad: false,
      wage: 900, contractEnds: state.season, value: 0,
      stats: emptyStats(), career: [], transferListed: false, youth: true,
      pers: assignPersonality(rng, a), sc: 10,
    }
    p.value = playerValue(p.ca, p.age, p.pa, p.pos)
    state.players[p.id] = p
  }
}

/** Any club left short of bodies signs free agents (board-driven squad fillers).
 *
 *  Counts SENIORS, not the squad list. Once the academy became 27 strong
 *  (feedback 10G) no club on earth was ever under 26 registered players again,
 *  so a whole-squad count would have quietly switched this off and let senior
 *  squads shrivel season by season while the academy stayed full. */
function replenishSquads(state: GameState, rng: Rng) {
  const freeAgents = () => Object.values(state.players)
    .filter(p => !p.clubId && p.age <= 34)
    .sort((a, b) => b.ca - a.ca)
  const seniors = (club: Club) =>
    club.players.reduce((n, id) => n + (state.players[id] && !state.players[id].acad ? 1 : 0), 0)
  for (const club of Object.values(state.clubs)) {
    let guard = 0
    while (seniors(club) < 26 && guard++ < 25) {
      // biggest positional hole
      // seniors only, for the same reason the count above is: with 27 academy men
      // registered, no position is ever under two and this would fall through to a
      // random shirt every time, filling gaps the club does not have
      const byPos: Record<string, number> = {}
      for (const id of club.players) {
        const p = state.players[id]
        if (p && !p.acad) byPos[p.pos] = (byPos[p.pos] ?? 0) + 1
      }
      const need = YOUTH_POS.find(pos => (byPos[pos] ?? 0) < 2) ?? pick(rng, YOUTH_POS)
      const fa = freeAgents().find(p => p.pos === need || p.alt.includes(need)) ?? freeAgents()[0]
      if (!fa) {
        // The market is bare - hand a young pro a senior contract instead. He
        // used to be registered as an academy scholar, which stopped being safe
        // the moment this loop started counting seniors: an academy signing does
        // not raise the senior count, so the loop would spin to its guard and
        // hand the club twenty-five schoolboys it did not need.
        const raw = {
          name: regenName(rng, club.country, worldNames(state)), pos: need,
          age: 19 + Math.floor(rng() * 2), nat: club.country,
          q: clamp(40 + Math.floor(rng() * 12) + Math.floor(club.rep / 14), 38, 62),
          gk: (need === 'FH' || need === 'FB') && rng() < 0.3,
        }
        const a2 = deriveAttrs(raw, state.seed + state.season * 131 + club.players.length * 7)
        const kid: Player = {
          id: nextPid(), name: raw.name, pos: raw.pos, alt: [], age: raw.age, nat: raw.nat,
          clubId: club.id, a: a2, ca: raw.q, pa: clamp(raw.q + 15 + Math.floor(rng() * 20), raw.q, 99),
          q0: raw.q, intl: false, gk: !!raw.gk, form: 6, morale: 7, cond: 100, sharp: 55,
          injury: null, bans: 0, natSquad: false, wage: 600, contractEnds: state.season + 3,
          value: 0, stats: emptyStats(), career: [], transferListed: false, youth: true,
          pers: assignPersonality(rng, a2), sc: club.id === state.userClubId ? 100 : 15,
        }
        kid.value = playerValue(kid.ca, kid.age, kid.pa, kid.pos)
        state.players[kid.id] = kid
        club.players.push(kid.id)
        continue
      }
      fa.clubId = club.id
      fa.wage = playerWage(fa.ca, fa.age)
      fa.contractEnds = state.season + 1
      fa.morale = 7
      club.players.push(fa.id)
      if (club.id === state.userClubId) {
        state.news.push({
          id: state.nextId++, week: 1, season: state.season, type: 'transfer', read: false,
          subject: `Board signing: ${fa.name}`,
          body: `With the squad short of numbers, the board moved to sign free agent ${fa.name} (${fa.pos}, ${fa.age}) on a one-year deal.`,
          k: 'news.boardSigning', v: { player: fa.name, pos: fa.pos, age: fa.age },
          playerId: fa.id,
        })
      }
    }
  }
}

/** The year's best moment, replayed: the try judged most dramatic at the
 *  whistle all season gets its own award night, commentary line and all. */
function tryOfTheSeason(state: GameState) {
  // note: the ledger is not cleared here - the season review captures it
  // further down rebuildSeason, and the clear happens at the very end
  const t = state.tryOfSeason
  if (!t || t.season !== state.season) return
  const scorer = state.players[t.playerId]
  const club = state.clubs[state.userClubId]
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
    subject: `🏉 Try of the Season: ${t.name}`,
    body: [
      `The supporters' vote was not close. ${t.name}'s ${ordinal(t.min)}-minute score against ${t.opp} is the ${club.name} Try of the Season.`,
      `As it sounded at the time: "${t.text}"`,
      scorer && scorer.clubId === state.userClubId
        ? `He collects the award at the end-of-season dinner to the loudest cheer of the night.`
        : `He is not at the club to collect it, which makes the ovation longer, not shorter.`,
    ].join('\n'),
    k: 'news.tryOfSeason',
    v: {
      player: t.name, min_o: t.min, opp: t.opp, club: club.name, text: t.text,
      tail_k: scorer && scorer.clubId === state.userClubId ? 'news.totsHere' : 'news.totsGone',
    },
    playerId: t.playerId,
  })
}

/** Full end-of-season rollover into a fresh campaign. */
export function rebuildSeason(state: GameState) {
  const rng = mulberry32(state.seed ^ ((state.season + 1) * 60013))

  // A new season wipes the tape: last year's analysis is last year's, so a move
  // the league had worked out is worth calling again.
  for (const club of Object.values(state.clubs)) resetFamiliarity(club)

  // the A League is decided before the season index moves on, so its champion
  // and the user's finish are stamped in the season they were earned
  // THE RIVAL'S YEAR, SETTLED (C3). Read HERE, at the top, because the leagues are
  // rebuilt empty further down and a verdict computed after that would find no
  // table, no positions and nothing to say - silently, forever.
  {
    const v = rivalVerdict(state)
    if (v) {
      state.news.push({
        id: state.nextId++, week: 1, season: state.season + 1, type: 'general', read: false,
        subject: tIn('en', `${v.k}Subj`, v.v), body: tIn('en', v.k, v.v),
        k: v.k, v: v.v,
      })
    }
  }

  closeAcademySeason(state)
  seasonAwards(state)
  tryOfTheSeason(state)
  worldPlayerOfTheYear(state)
  settleRecords(state)

  // the Lions come home: the tour ends with the season itself, so the
  // window's return week (end + 1) never exists on the calendar - the
  // homecoming is processed here, before the blanket natSquad reset
  {
    const lionsHome = (state.natSquads?.['LIO'] ?? [])
      .map(id => state.players[id])
      .filter((p): p is Player => !!p && p.clubId === state.userClubId)
    if (lionsHome.length) {
      const comp = state.comps['lions']
      const seriesWon = comp?.champion === 'LIO'
      for (const p of lionsHome) {
        p.morale = clamp(p.morale + 0.6, 1, 10)
        p.a.lea = clamp(p.a.lea + 1, 1, 20)
      }
      state.news.push({
        id: state.nextId++, week: 1, season: state.season + 1, type: 'intl', read: false,
        subject: `🦁 The Lions come home${seriesWon ? ' as series winners' : ''}`,
        body: [
          `Back in club colours after ${comp?.name ?? 'the Lions tour'}: ${lionsHome.map(p => p.name).join(', ')}.`,
          seriesWon
            ? `A series win in the luggage, and the kind of standing money cannot buy. Expect ${lionsHome.length === 1 ? 'him' : 'them'} to walk taller here too.`
            : `Win or lose, a tour changes a player - ${lionsHome.length === 1 ? 'he comes' : 'they come'} back a bigger presence in this dressing room.`,
        ].join(' '),
        playerId: lionsHome[0].id,
      })
    }
  }

  // the union's annual review: the Test job answers to somebody too
  if (state.natTeam && state.natConfidence != null) {
    const nat = state.natTeam
    const natFx = state.fixtures.filter(f => f.played && (f.homeId === nat || f.awayId === nat) &&
      !state.clubs[f.homeId] && !state.clubs[f.awayId])
    let w = 0, l = 0
    for (const f of natFx) {
      const us = f.homeId === nat ? f.homeScore : f.awayScore
      const them = f.homeId === nat ? f.awayScore : f.homeScore
      if (us > them) w++
      else if (us < them) l++
    }
    const conf = Math.round(state.natConfidence)
    if (conf < 28) {
      closeNatTenure(state) // the record moves to the profile's history, not the bin
      state.news.push({
        id: state.nextId++, week: 1, season: state.season + 1, type: 'board', read: false,
        subject: `🌍 SACKED: ${nat} relieve you of the national job`,
        body: `The union's annual review was short. ${w} Test wins against ${l} defeats was not the trajectory they hired you for, and the ${nat} job is no longer yours. The club work continues - and unions have short memories when results turn.`,
        k: 'news.natSacked', v: { nat, w, l },
      })
    } else {
      state.news.push({
        id: state.nextId++, week: 1, season: state.season + 1, type: 'board', read: false,
        subject: `🌍 Union annual review: ${conf >= 70 ? 'glowing' : conf >= 45 ? 'satisfactory' : 'concerned'}`,
        body: [
          `The ${nat} union has completed its annual review of the national programme: ${w} Test wins, ${l} defeats this season. Confidence in the head coach stands at ${conf}%.`,
          conf >= 70 ? `They are already talking about extending your tenure.`
            : conf >= 45 ? `Steady as she goes - but unions measure everything in World Championships.`
            : `The knives are not out yet, but the drawer is open. The next window matters.`,
        ].join(' '),
        k: 'news.natReview',
        v: {
          nat, w, l, conf,
          word_k: conf >= 70 ? 'news.natGlowing' : conf >= 45 ? 'news.natSatisfactory' : 'news.natConcerned',
          tail_k: conf >= 70 ? 'news.natTailGood' : conf >= 45 ? 'news.natTailOk' : 'news.natTailBad',
        },
      })
      // summers soften opinions a little, in both directions - but they do
      // not launder a losing record
      state.natConfidence = clamp(state.natConfidence * 0.9 + 55 * 0.1, 0, 100)
    }
  }

  // the manager's season in review - a proper full-time moment
  if (!state.unemployed) {
    const uid = state.userClubId
    const uf = state.fixtures.filter(f => f.played && (f.homeId === uid || f.awayId === uid))
    let w = 0, d = 0, l = 0
    let best: { diff: number; line: string } | null = null
    for (const f of uf) {
      const us = f.homeId === uid ? f.homeScore : f.awayScore
      const them = f.homeId === uid ? f.awayScore : f.homeScore
      if (us > them) w++; else if (us < them) l++; else d++
      const diff = us - them
      if (us > them && (!best || diff > best.diff)) {
        best = { diff, line: `${state.clubs[f.homeId]?.short ?? f.homeId} ${f.homeScore}-${f.awayScore} ${state.clubs[f.awayId]?.short ?? f.awayId}` }
      }
    }
    const squad = state.clubs[uid].players.map(id => state.players[id]).filter(Boolean)
    const topPts = [...squad].sort((a, b) => b.stats.points - a.stats.points)[0]
    const topTry = [...squad].sort((a, b) => b.stats.tries - a.stats.tries)[0]
    let predLine = ''
    const predicted = state.preds?.[uid]
    const myComp = state.comps[state.clubs[uid].leagueId]
    const actualPos = myComp ? sortTable(myComp.table).findIndex(r => r.teamId === uid) + 1 : 0
    if (predicted && myComp && actualPos > 0) {
      predLine = `Pundits predicted ${actualPos < predicted ? `${ordinal(predicted)} - you finished ${ordinal(actualPos)}. They owe you an apology.`
        : actualPos === predicted ? `${ordinal(predicted)} - and ${ordinal(actualPos)} it was. Read like a book.`
        : `${ordinal(predicted)} - you finished ${ordinal(actualPos)}. The phone-ins will be brutal.`}`
    }

    // structured snapshot for the one-page Season Review screen
    const leagueFx = uf.filter(f => f.compId === state.clubs[uid].leagueId && !f.stage)
    let lw = 0, ld = 0, ll = 0
    for (const f of leagueFx) {
      const us = f.homeId === uid ? f.homeScore : f.awayScore
      const them = f.homeId === uid ? f.awayScore : f.homeScore
      if (us > them) lw++; else if (us < them) ll++; else ld++
    }
    const stageRank: Record<string, number> = { BAR: 0, R16: 1, QF: 2, SF: 3, F: 4 }
    const stageWord: Record<string, string> = { BAR: 'playoff barrage', R16: 'last-16 exit', QF: 'quarter-final exit', SF: 'semi-final exit', F: 'Runners-up' }
    const cupRuns: { comp: string; result: string }[] = []
    for (const comp of Object.values(state.comps)) {
      if (comp.type === 'league') continue
      const mine = state.fixtures.filter(f => f.compId === comp.id && f.played && (f.homeId === uid || f.awayId === uid))
      if (!mine.length || !state.clubs[mine[0].homeId]) continue
      const ko = mine.filter(f => f.stage).sort((a, b) => (stageRank[a.stage!] ?? 0) - (stageRank[b.stage!] ?? 0))
      const last = ko[ko.length - 1]
      let result = 'Pool stages'
      if (last) {
        const won = last.homeId === uid ? last.homeScore > last.awayScore : last.awayScore > last.homeScore
        result = last.stage === 'F' && won ? '🏆 CHAMPIONS' : stageWord[last.stage!] ?? `${last.stage} exit`
      }
      cupRuns.push({ comp: comp.short, result })
    }
    const rated0 = squad.filter(p => p.stats.apps >= 8)
      .map(p => ({ p, avg: p.stats.ratingSum / Math.max(1, p.stats.apps) }))
      .sort((a, b) => b.avg - a.avg)[0]
    // the summer verdict from the terraces: silverware and overachievement
    // carry into next season's mood; a flop resets the goodwill
    const trophyCount = state.history.filter(h => h.season === state.season && h.champion === uid).length
    let moodShift = trophyCount * 18
    if (predicted && actualPos > 0) moodShift += (predicted - actualPos) * 3
    state.fanMood = clamp((state.fanMood ?? 60) * 0.6 + 55 * 0.4 + moodShift, 10, 95)

    const club0 = state.clubs[uid]
    state.review = {
      season: state.season,
      clubName: club0.name,
      league: { name: myComp?.name ?? '', pos: actualPos, predicted, w: lw, d: ld, l: ll },
      overall: { w, d, l, m: uf.length, bestWin: best?.line },
      cups: cupRuns,
      topPoints: topPts?.stats.points ? { name: topPts.name, val: topPts.stats.points } : undefined,
      topTries: topTry?.stats.tries ? { name: topTry.name, val: topTry.stats.tries } : undefined,
      bestAvg: rated0 ? { name: rated0.p.name, val: Math.round(rated0.avg * 100) / 100 } : undefined,
      tryOfSeason: state.tryOfSeason && state.tryOfSeason.season === state.season
        ? { name: state.tryOfSeason.name, min: state.tryOfSeason.min, opp: state.tryOfSeason.opp }
        : undefined,
      balanceDelta: club0.balance - (state.finHist?.[0]?.b ?? club0.balance),
      confidence: club0.boardConfidence,
      trophies: state.history.filter(h => h.season === state.season && h.champion === uid).map(h => state.comps[h.compId]?.name ?? h.compId),
    }
    // the annals: the career chronicle, one entry per season, oldest first
    ;(state.annals ??= []).push(state.review)
    if (state.annals.length > 30) state.annals = state.annals.slice(-30)

    // the era: anniversaries are marked, and long loyal service with
    // silverware makes you part of the club's furniture forever
    {
      const tenure = state.season - (state.tenureStart ?? state.season) + 1
      const era = (state.annals ?? []).filter(a => a.clubName === club0.name).slice(-tenure)
      const eraW = era.reduce((s, a) => s + a.overall.w, 0)
      const eraL = era.reduce((s, a) => s + a.overall.l, 0)
      const eraCups = era.reduce((s, a) => s + a.trophies.length, 0)
      if ([5, 10, 15, 20, 25].includes(tenure)) {
        state.news.push({
          id: state.nextId++, week: 1, season: state.season + 1, type: 'award', read: false,
          subject: `🎉 ${tenure} years at ${club0.name}`,
          body: `The club marks your ${tenure}th season in charge: ${eraW} wins, ${eraL} defeats and ${eraCups} ${eraCups === 1 ? 'trophy' : 'trophies'} in the era. The programme runs a retrospective; the chairman makes a speech; the fixture list, as ever, does not care. On we go.`,
          k: 'news.tenure',
          v: { n: tenure, n_o: tenure, club: club0.name, w: eraW, l: eraL, cups: eraCups,
               cup_k: eraCups === 1 ? 'news.trophyOne' : 'news.trophyMany' },
        })
      }
      state.legendOf ??= []
      if (tenure >= 8 && eraCups >= 3 && !state.legendOf.includes(club0.id)) {
        state.legendOf.push(club0.id)
        state.fanMood = clamp((state.fanMood ?? 60) + 10, 5, 98)
        state.news.push({
          id: state.nextId++, week: 1, season: state.season + 1, type: 'award', read: false,
          subject: `🗽 CLUB LEGEND: the city claims you as its own`,
          body: `${tenure} seasons. ${eraCups} trophies. The supporters' trust has voted unanimously: you are a legend of ${club0.name}, whatever happens from here. There is talk of a statue outside ${club0.stadium}, and the artist has already asked how you would like to be posed. Results can dip; this cannot be taken away.`,
          k: 'news.clubLegend',
          v: { n: tenure, cups: eraCups, club: club0.name, stadium: club0.stadium },
        })
      }
    }
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
      subject: `📋 Your ${seasonLabel(state.season)} season in review`,
      body: [
        `Record: ${w}W ${d}D ${l}L from ${uf.length} matches.`,
        best ? `Best win: ${best.line}` : '',
        topPts?.stats.points ? `Top points: ${topPts.name} (${topPts.stats.points})` : '',
        topTry?.stats.tries ? `Top tries: ${topTry.name} (${topTry.stats.tries})` : '',
        predLine,
      ].filter(Boolean).join('\n'),
      k: 'news.seasonReview',
      v: {
        season: seasonLabel(state.season),
        rows_ll: JSON.stringify([
          { k: 'news.srRecord', w, d, l, m: uf.length },
          ...(best ? [{ k: 'news.srBest', line: best.line }] : []),
          ...(topPts?.stats.points ? [{ k: 'news.srPoints', name: topPts.name, n: topPts.stats.points }] : []),
          ...(topTry?.stats.tries ? [{ k: 'news.srTries', name: topTry.name, n: topTry.stats.tries }] : []),
        ]),
        pred: predLine,
      },
    })

    // the end-of-season awards dinner - black tie, white wine, in-jokes
    const rated = squad.filter(p => p.stats.apps >= 8)
    if (rated.length >= 3) {
      const avgR = (p: Player) => p.stats.ratingSum / Math.max(1, p.stats.apps)
      const poty = [...rated].sort((a, b) => avgR(b) - avgR(a))[0]
      const young = [...rated].filter(p => p.age <= 22).sort((a, b) => avgR(b) - avgR(a))[0]
      const tryKing = [...rated].sort((a, b) => b.stats.tries - a.stats.tries)[0]
      for (const w of [poty, young, tryKing]) {
        if (w) w.morale = clamp(w.morale + 0.8, 1, 10)
      }
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
        subject: `🥂 Club awards night: ${poty.name} sweeps the room`,
        body: [
          `The season ends the way it should - the whole squad in one room, telling lies about each other.`,
          ``,
          `Player of the Season: ${poty.name} (avg ${avgR(poty).toFixed(2)})`,
          young ? `Young Player of the Season: ${young.name} (${young.age})` : '',
          tryKing.stats.tries > 0 ? `Top Try Scorer: ${tryKing.name} (${tryKing.stats.tries})` : '',
        ].filter(Boolean).join('\n'),
        k: 'news.awardsNight',
        v: {
          player: poty.name,
          rows_ll: JSON.stringify([
            { k: 'news.anPoty', name: poty.name, avg: avgR(poty).toFixed(2) },
            ...(young ? [{ k: 'news.anYoung', name: young.name, age: young.age }] : []),
            ...(tryKing.stats.tries > 0 ? [{ k: 'news.anTries', name: tryKing.name, n: tryKing.stats.tries }] : []),
          ]),
        },
        playerId: poty.id,
      })
    }
  }

  // board verdict on the season vs their stated objective. The final league
  // position, the title and the objective money are CAPTURED here and settled
  // after the budget refresh below: club.budget is assigned from scratch down
  // there, so any money added to it at this point in the function is silently
  // wiped. The "+£250k budget" this verdict prints fell into exactly that
  // hole for two versions - the favour (boardOwed) was the only part of the
  // reward that ever arrived.
  let userFinishPos = 0
  let userWonLeague = false
  let objBonus = 0
  if (!state.unemployed) {
    const club = state.clubs[state.userClubId]
    const comp = state.comps[club.leagueId]
    if (comp) {
      const pos = sortTable(comp.table).findIndex(r => r.teamId === club.id) + 1
      state.mgr.finishes.push({ season: state.season, leagueId: club.leagueId, pos, clubId: club.id })
      const obj = boardObjective(club.rep)
      const wonLeague = comp.champion === club.id
      userFinishPos = pos
      userWonLeague = wonLeague
      const met = wonLeague || (pos > 0 && pos <= obj.pos)
      // PATIENCE SCALES WITH STATURE (wave 2, same curve boardReaction and the
      // half-term check use). The trophy itself still lands the same flat +25
      // everywhere - winning the whole league is exceptional at any club, so it
      // is not rescaled - but missing the target now costs a giant roughly 60%
      // MORE than the old flat -14 (rep 93: -23) and a minnow roughly 40% LESS
      // (rep 38: -8), because the same shortfall means something different at
      // each end. Clearing the target without winning outright runs the other
      // way: a modest target cleared buys a small club noticeably more than
      // the old flat +12 (rep 38: +16), and a demanding target barely cleared
      // buys a giant noticeably less (rep 93: +7) - it was only ever the floor.
      const patienceF = boardPatience(club.rep)
      const delta = wonLeague ? 25 : met ? Math.round(12 * (1.65 - patienceF * 0.65)) : -Math.round(14 * patienceF)
      club.boardConfidence = clamp(club.boardConfidence + delta, 5, 100)
      // THE DREAM'S MAY VERDICT. Stamped here rather than where state.review is
      // built, because the review is assembled BEFORE this season's finish and
      // trophies are on the record - snapshot it up there and a title-winning
      // season would report no progress towards a dream about titles.
      if (state.review) {
        const d = dreamState(state)
        if (d) {
          const prev = state.annals && state.annals.length > 1
            ? state.annals[state.annals.length - 2]?.dream?.at ?? null : null
          state.review.dream = {
            title: d.title,
            note: d.progress.note,
            at: d.progress.at,
            goal: d.progress.goal,
            done: d.progress.done,
            moved: prev != null ? d.progress.at - prev : null,
          }
        }
      }
      // secondary objectives: side quests with real consequences
      const sideLines: string[] = []
      for (const id of state.objectives ?? []) {
        const def = objectiveById(id)
        if (!def || !def.applies(state)) continue
        const ok = def.met(state)
        club.boardConfidence = clamp(club.boardConfidence + (ok ? 5 : -4), 5, 100)
        if (ok) { objBonus += 250_000; state.boardOwed = true }
        sideLines.push(`${ok ? '✅' : '❌'} ${tIn('en', def.text(state))}${ok ? ' - met (+£250k budget)' : ' - missed'}`)
      }
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
        subject: met ? 'Board delighted with the season' : 'Board verdict: not good enough',
        body: `The objective was to ${tIn('en', obj.text)}. You finished ${ordinal(pos)}${wonLeague ? ' and won the title' : ''}. ${met
          ? 'The chairman shakes your hand warmly - keep building.'
          : 'The chairman expects markedly better next season.'}${sideLines.length ? '\n\n' + sideLines.join('\n') : ''}`,
      })
    }
  }

  // prize money & budget refresh (uses final tables before wipe)
  // Also records where every club finished, as a 0 (top) to 1 (bottom) share of
  // its league, because the boardroom reset near the end of this function needs
  // it and the leagues are rebuilt empty before then.
  const finishFrac = new Map<string, number>()
  for (const comp of Object.values(state.comps)) {
    if (comp.type !== 'league') continue
    const order = sortTable(comp.table).map(r => r.teamId)
    order.forEach((teamId, idx) => {
      const club = state.clubs[teamId]
      if (!club) return
      if (order.length > 1) finishFrac.set(teamId, idx / (order.length - 1))
      const prize = Math.max(0, (order.length - idx)) * 120_000 + (comp.champion === teamId ? 1_500_000 : 0)
      club.balance += prize
    })
  }

  // bums on seats: clubs that keep selling out build bigger stands
  for (const club of Object.values(state.clubs)) {
    const home = state.fixtures.filter(f => f.played && f.homeId === club.id && f.att)
    if (home.length < 5 || club.capacity >= 82_000) continue
    const avg = home.reduce((sum, f) => sum + (f.att ?? 0), 0) / home.length
    if (avg / club.capacity < 0.93 || rng() > 0.4) continue // boards dither
    // a board will not build seats it cannot sell: the catchment is the ceiling
    if (club.capacity >= demandCeiling(club) * 0.95) continue
    const add = Math.round((club.capacity * (0.04 + rng() * 0.06)) / 100) * 100
    // same per-seat curve the manager is quoted in expansionPlan: a big ground
    // costs more per seat than a small one, which is what a flat 1,400 missed
    const cost = add * Math.round(1_400 * (1 + club.capacity / 45_000))
    if (add < 100 || club.balance < cost * 2) continue
    club.balance -= cost
    club.capacity += add
    if (club.id === state.userClubId) {
      state.news.push({
        id: state.nextId++, week: 1, season: state.season + 1, type: 'board', read: false,
        subject: `🏗 ${club.stadium} to grow - ${add.toLocaleString()} new seats`,
        body: `Full houses all season have convinced the board. Diggers arrive this summer: capacity rises to ${club.capacity.toLocaleString()} at a cost of ${fmtMoney(cost)}. Keep winning and we'll fill that too.`,
        k: 'news.groundGrows',
        v: { stadium: club.stadium, add, cap: club.capacity, cost: fmtMoney(cost) },
      })
    }
  }

  // archive player season -> career
  for (const p of Object.values(state.players)) {
    if (p.stats.apps > 0 && p.clubId) {
      p.career.push({ season: state.season, clubId: p.clubId, apps: p.stats.apps, tries: p.stats.tries, points: p.stats.points })
      if (p.career.length > 20) p.career = p.career.slice(-20)
    }
    // remembered across the wipe so devFactor can ask how much rugby the
    // season actually held (25D: minutes-gated growth)
    p.lastStarts = p.stats.starts
    p.stats = emptyStats()
    p.avail = 0
    p.form = 6
    p.morale = clamp(p.morale, 5, 10)
    p.cond = 100
    p.sharp = 60
    p.injury = null
    p.specialist = false
    p.bans = 0
    p.rust = 0
    p.natSquad = false
    if (p.onLoan) {
      // back from a season of first-team rugby elsewhere
      p.onLoan = false
      p.loanClub = undefined
      if (p.ca < p.pa) p.ca = clamp(p.ca + 2 + Math.floor(mulberry32(state.seed + p.id)() * 3), 1, p.pa)
      if (p.clubId === state.userClubId) {
        state.news.push({
          id: state.nextId++, week: 1, season: state.season + 1, type: 'youth', read: false,
          subject: `${p.name} returns from loan`,
          body: `A season of regular rugby has done ${p.name} the world of good. He reports back noticeably sharper.`,
          k: 'news.loanBack', v: { player: p.name },
          playerId: p.id,
        })
      }
    }
    p.ca0 = p.ca
  }
  state.natSquads = {}
  state.natLineup = null

  agePlayers(state, rng)
  handleContracts(state, rng)
  youthIntake(state, rng)
  replenishSquads(state, rng)
  // every academy in the world recruits its next scholarship year, back up to
  // 27 in shape - see topUpAcademy for why this is not optional (feedback 10G)
  for (const club of Object.values(state.clubs)) {
    topUpAcademy(state, club, rng, state.seed + state.season * 977)
  }

  // AI squads shed their surplus every summer: intake adds more bodies
  // than retirement removes, and without a clear-out the median squad
  // drifts from 33 to 43+ over a decade. Weakest seniors are released
  // into the free-agent pool (which is pruned just below).
  //
  // Counts SENIORS on both ends. It used to count the whole registered squad,
  // which the 27-man academy (feedback 10G) turned into a wrecking ball: every
  // club in the world sat over 46 registered on day one, and since only seniors
  // are releasable it would have stripped all 101 of them down to seventeen
  // senior players while the academy sat there untouched.
  const seniorCount = (club: Club) =>
    club.players.reduce((n, id) => n + (state.players[id] && !state.players[id].acad ? 1 : 0), 0)
  for (const club of Object.values(state.clubs)) {
    if (club.id === state.userClubId || seniorCount(club) <= 46) continue
    const releasable = club.players
      .map(id => state.players[id])
      .filter((p): p is Player => !!p && !p.acad && p.age >= 21 && !p.onLoan && !p.loanFrom)
      .sort((a, b) => a.ca - b.ca)
    for (const p of releasable) {
      if (seniorCount(club) <= 44) break
      club.players = club.players.filter(id => id !== p.id)
      club.tactic.lineup = club.tactic.lineup.map(id => (id === p.id ? null : id))
      if (club.captain === p.id) club.captain = null
      if (club.vice === p.id) club.vice = null
      p.clubId = null
      p.transferListed = false
    }
  }

  // keep the free-agent pool from growing without bound over long careers
  const fas = Object.values(state.players)
    .filter(p => !p.clubId)
    .sort((a, b) => b.ca - a.ca)
  for (const p of fas.slice(120)) delete state.players[p.id]
  for (const p of fas.slice(0, 120)) if (p.age >= 35) delete state.players[p.id]

  // Promotion & relegation between each top flight and its second tier
  const PYRAMID: [string, string, string][] = [
    ['prem', 'champ', 'the Premier Division'],
    ['champ', 'natl1', 'the Championship'],
    ['top14', 'prod2', 'the Elite 14'],
  ]
  // your own promotion or relegation is the story of the season and keeps its
  // own headline. The other divisions' movements are one round-up: three
  // near-identical "X up, Y down" items were three of the fourteen in the
  // final week of the year.
  const swaps: string[] = []
  const swapRows: Vars[] = []
  for (const [topId, lowId, topName] of PYRAMID) {
    const topComp = state.comps[topId]
    const lowComp = state.comps[lowId]
    if (!topComp || !lowComp) continue
    const topOrder = sortTable(topComp.table).map(r => r.teamId)
    const down = topOrder[topOrder.length - 1]
    const up = lowComp.champion ?? sortTable(lowComp.table)[0]?.teamId
    if (!down || !up || down === up || !state.clubs[down] || !state.clubs[up]) continue
    // THE ENGLISH TRAPDOOR IS A GAME NOW (21A). Week 44's playoff decided
    // this pair on the pitch: the swap only happens if the Championship
    // winner actually won it. A save that rolled over without the fixture
    // (or a playoff that somehow never played) falls back to the automatic
    // swap, which is what the game always did.
    if (topId === 'prem') {
      const bar = state.fixtures.find(f => f.compId === 'prem' && f.stage === 'BAR' && f.played)
      if (bar) {
        const winner = bar.homeScore > bar.awayScore ? bar.homeId : bar.awayId
        if (winner === down) {
          const lineV = {
            k: 'news.barKept', kept: state.clubs[down].name, stay: state.clubs[up].name,
            hi: Math.max(bar.homeScore, bar.awayScore), lo: Math.min(bar.homeScore, bar.awayScore),
          }
          const line = tIn('en', lineV.k, lineV)
          if (down === state.userClubId || up === state.userClubId) {
            state.news.push({
              id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
              subject: down === state.userClubId
                ? `😅 SURVIVED: ${state.clubs[down].short} win the playoff`
                : `💔 SO CLOSE: ${state.clubs[up].short} lose the playoff`,
              body: `${line}.${down === state.userClubId ? ' The great escape, done on your own patch. The board exhales - now never come this close again.' : ' Champions of the second tier, beaten in one game for everything. The board keeps faith: win the league again and finish the job.'}`,
              k: down === state.userClubId ? 'news.barSurvived' : 'news.barSoClose',
              v: { ...lineV, line_k: lineV.k, short: state.clubs[down === state.userClubId ? down : up].short },
            })
          } else {
            swaps.push(line)
            swapRows.push(lineV)
          }
          continue
        }
      }
    }
    state.clubs[down].leagueId = lowId
    state.clubs[down].rep = Math.max(44, state.clubs[down].rep - 4)
    state.clubs[up].leagueId = topId
    state.clubs[up].rep = Math.min(88, state.clubs[up].rep + 5)
    if (up === state.userClubId) {
      state.celebration = {
        headline: `PROMOTED - ${state.clubs[up].short.toUpperCase()} ARE GOING UP`,
        sub: `Welcome to ${topName} · ${state.managerName}`,
        icon: '🎉',
      }
    }
    const userInvolved = down === state.userClubId || up === state.userClubId
    if (!userInvolved) {
      swaps.push(`${topName}: ${state.clubs[up].name} up, ${state.clubs[down].name} down`)
      swapRows.push({ k: 'news.swapRow', comp: topName, up: state.clubs[up].name, down: state.clubs[down].name })
      continue
    }
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
      subject: down === state.userClubId
        ? `💔 RELEGATED: ${state.clubs[down].name} go down`
        : `🎉 PROMOTED: ${state.clubs[up].name} are going up!`,
      body: (() => {
        const bar = topId === 'prem' ? state.fixtures.find(f => f.compId === 'prem' && f.stage === 'BAR' && f.played) : null
        const how = bar
          ? `${state.clubs[up].name} win the relegation playoff ${Math.max(bar.homeScore, bar.awayScore)}-${Math.min(bar.homeScore, bar.awayScore)} away from home and take the Premier Division place. ${state.clubs[down].name} lose it on their own ground and drop into the second tier.`
          : `${state.clubs[up].name} have won promotion to ${topName}. ${state.clubs[down].name} finished bottom and drop into the second tier.`
        return `${how}${down === state.userClubId ? ' The board is wounded and the budget will feel it - win the league and bounce straight back.' : ''}${up === state.userClubId ? ' The big time. The board urges cool heads: survival is the first objective.' : ''}`
      })(),
      k: down === state.userClubId ? 'news.relegated' : 'news.promoted',
      v: (() => {
        const bar = topId === 'prem' ? state.fixtures.find(f => f.compId === 'prem' && f.stage === 'BAR' && f.played) : null
        return {
          up: state.clubs[up].name, down: state.clubs[down].name, comp: topName,
          how_k: bar ? 'news.upDownBar' : 'news.upDownAuto',
          hi: bar ? Math.max(bar.homeScore, bar.awayScore) : 0,
          lo: bar ? Math.min(bar.homeScore, bar.awayScore) : 0,
        }
      })(),
    })
  }
  if (swaps.length) {
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
      subject: `Up and down: the trapdoors swing across the leagues`,
      body: `${swaps.join('. ')}. Fortunes made and unmade in a single afternoon, and next season's fixture lists are redrawn accordingly.`,
      k: 'news.upAndDown', v: { rows_l: JSON.stringify(swapRows) },
    })
  }

  // Continental Cup qualification for next season from final league standings
  const euroSlots: string[] = []
  const slotMap: Record<string, number> = { prem: 5, top14: 6, urc: 5 }
  for (const [leagueId, slots] of Object.entries(slotMap)) {
    const comp = state.comps[leagueId]
    if (comp) euroSlots.push(...sortTable(comp.table).map(r => r.teamId).slice(0, slots))
  }
  // Continental Shield slots come from the same final standings - this must run
  // BEFORE the season wipe (it once read the rebuilt, zeroed tables, handing
  // out places at random and double-booking Continental Cup clubs)
  const chcSlots: string[] = []
  const euroSet = new Set(euroSlots.slice(0, 16))
  const chcMap: Record<string, [number, number]> = { champ: [0, 2], prem: [5, 9], top14: [6, 11], urc: [5, 10] }
  for (const [leagueId, [from, to]] of Object.entries(chcMap)) {
    const comp = state.comps[leagueId]
    if (comp) chcSlots.push(...sortTable(comp.table).map(t => t.teamId).slice(from, to).filter(id => !euroSet.has(id)))
  }
  // a filtered slot leaves the draw short: top up with the best of the rest
  if (chcSlots.length < 16) {
    const taken = new Set([...euroSet, ...chcSlots])
    const rest = Object.values(state.clubs)
      .filter(c => ['prem', 'top14', 'urc', 'champ'].includes(c.leagueId) && !taken.has(c.id))
      .sort((a, b) => b.rep - a.rep)
    while (chcSlots.length < 16 && rest.length) chcSlots.push(rest.shift()!.id)
  }

  // THE INVINCIBLES (16C): a whole competitive season without defeat is the
  // rarest thing in the sport, and the moment it deserves has to be claimed
  // here, while the season's fixtures still exist to prove it.
  invinciblesCheck(state)

  // THE RECKONING (release audit 2.4): a club that spent the season unable to
  // pay for itself goes into administration now, while state.season is still
  // the season it failed in - settleInsolvency stamps the penalty onto the year
  // about to start. It has to run before the bump for that reason, and before
  // the tables are rebuilt below so the deduction is in them from round one.
  settleInsolvency(state)

  // and the manager gets a year older with everybody else (career.ts). Before
  // the season bump, so the age and the season it belongs to stay in step.
  ageManager(state)

  // wipe season structures & rebuild
  state.season += 1
  // F30: a deal whose term ran out with the old season is gone, and the manager
  // is told, because an empty commercial slot pays nothing and that has to be a
  // decision he knows he is making rather than a quiet hole in the accounts.
  // AFTER the season bump, so `until >= state.season` reads the new season.
  expireDeals(state)
  state.week = 1
  state.finHist = []
  state.fixtures = []
  state.offers = []
  state.vacancies = []
  state.devFocus = state.devFocus.filter(id => state.players[id]?.clubId === state.userClubId)
  state.press = state.press.filter(p => !p.answered).slice(-5)

  // ---- THE SPONSORSHIP DECISION (25C) ----
  // expireDeals just installed a below-market caretaker in any slot whose
  // contract ran out (user: "You should be able to choose between deals...
  // short term for lower amounts or bigger deals for longer"). The market
  // already offers exactly that choice on the Finances screen; what was
  // missing was the moment - so the summer a deal lapses, the commercial
  // director walks into the office with the three offers and asks. Choosing
  // one signs it (media.answerPress, opt.deal); staying with the stopgap is a
  // real answer too. Internal decision, so the press-expiry sweep leaves it.
  if (!state.unemployed) {
    for (const slot of SLOTS) {
      const d = state.deals?.[slot.id]
      if (!d || !d.auto || d.from !== state.season) continue
      const offers = offersFor(state, slot.id)
      if (offers.length < 3) continue
      const [lng, sht, cls] = offers
      state.press.push({
        id: state.nextId++, week: 1, season: state.season, outlet: OFFICE_OUTLET,
        question: `The ${tIn('en', slot.name).toLowerCase()} is on a stopgap arrangement at ${fmtMoney(d.weekly)} a week - under the going rate. The commercial director has three offers on the desk. Which way do we go?`,
        options: [
          {
            label: `${lng.sponsor}: ${fmtMoney(lng.weekly)}/wk, ${lng.years} years`, morale: 0, board: 0,
            deal: { slot: slot.id, kind: 'long' },
            reaction: `Signed. Safe money for ${lng.years} years - a touch under market, because the sponsor is buying certainty off you.`,
          },
          {
            label: `${sht.sponsor}: ${fmtMoney(sht.weekly)}/wk, ${sht.years} ${sht.years === 1 ? 'year' : 'years'}`, morale: 0, board: 0,
            deal: { slot: slot.id, kind: 'short' },
            reaction: `Signed. Over the market rate, and you are back at this desk in ${sht.years === 1 ? 'a year' : 'two years'} - which is the bet: your reputation will have grown by then.`,
          },
          {
            label: `${cls.sponsor}: ${fmtMoney(cls.weekly)}/wk + clause, ${cls.years} yrs`, morale: 0, board: 0,
            deal: { slot: slot.id, kind: 'clause' },
            reaction: `Signed, with the clause. Deliver on the pitch and it is the best deal in the building; fall short and you sold cheap.`,
          },
          {
            label: 'Stay with the stopgap for now', morale: 0, board: 0,
            deal: { slot: slot.id, kind: 'keep' },
            reaction: `The stopgap rolls on at a discount. The offers stay on the Finances screen whenever you want them.`,
          },
        ],
        answered: false,
      })
    }
  }
  state.comps = {}

  for (const def of LEAGUE_DEFS()) {
    const teamIds = Object.values(state.clubs).filter(c => c.leagueId === def.id).map(c => c.id)
    state.comps[def.id] = buildLeague(
      { id: def.id, name: def.name, short: def.short, teams: teamIds, double: def.double, playoffTeams: def.playoffTeams },
      rng, state,
    )
  }
  // minus ten before a ball is kicked, for anyone who went under in the summer
  for (const comp of Object.values(state.comps)) applyAdminPenalties(comp, state)
  state.comps['cc'] = buildChampionsCup(euroSlots.slice(0, 16), rng, state)
  state.comps['chc'] = buildChampionsCup(chcSlots.slice(0, 16), rng, state, { id: 'chc', name: 'Continental Shield', short: 'Continental Shield' })
  const wcYear = isWorldCupSeason(state.season)
  buildInternationals(rng, state, wcYear)
  schedulePreseason(state, rng)
  // and a fresh A League for whichever league the manager is in NOW - a summer
  // move to the Elite 14 gets him the Espoirs rather than last year's Premier Division
  state.academy = undefined
  ensureAcademyLeague(state)

  // the farewell season: a one-club servant announces his last dance, and
  // his home pre-season friendly becomes the testimonial he plays in
  {
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
          subject: `🎗 The last dance: ${cand.p.name} announces his farewell season`,
          body: `${cand.p.name} (${cand.p.age}, ${cand.p.pos}) has told the squad this season will be his last. ${cand.apps} appearances in the shirt, and one year left to add to them. His testimonial is set for the pre-season fixture at ${club.stadium} in week ${home.week} - pick him, and give the ground its goodbye.`,
          playerId: cand.p.id,
        })
      }
    }
  }
  if (wcYear) {
    state.news.push({
      id: state.nextId++, week: 1, season: state.season, type: 'intl', read: false,
      subject: `🏆 A WORLD CHAMPIONSHIP season`,
      body: `The ${2025 + state.season} World Championship kicks off in the opening weeks of the season. Twenty nations, four pools, one trophy - and your internationals will be away with their countries until it's decided. Plan your early rounds carefully.`,
    })
  }

  // old wounds heal: expired grudges drop off the fixture list, and
  // contract stand-offs reset with the new season
  state.grudges = (state.grudges ?? []).filter(g => g.until >= state.season)
  for (const p of Object.values(state.players)) { if ((p.wantsDeal ?? 0) > 0) p.wantsDeal = 0 }
  state.slAlerted = []
  state.pledges = [] // a new season wipes the promise ledger clean
  state.takeover = null // deals not done by summer quietly collapse
  state.newOwnerUntil = null // the honeymoon does not survive the summer
  state.crisisAt = {} // week numbers reset with the calendar

  // partnership chemistry only lives while the pair share a dressing room -
  // prune split/retired pairs so the ledger stays small
  if (state.chem) {
    for (const k of Object.keys(state.chem)) {
      const [a, b] = k.split('_').map(Number)
      const pa = state.players[a], pb = state.players[b]
      if (!pa || !pb || pa.clubId !== pb.clubId) delete state.chem[k]
    }
  }

  // the Scouting Agency's boards refresh monthly, but retirees must drop off
  // now - a chart pointing at a deleted player is a broken chart
  if (state.agency) {
    state.agency.seniors = state.agency.seniors.filter(pid => state.players[pid])
    state.agency.kids = state.agency.kids.filter(pid => state.players[pid])
    for (const k of Object.keys(state.agency.best)) {
      if (!state.players[Number(k)]) delete state.agency.best[Number(k)]
    }
  }
  // The scout's filed report holds player ids too, and it was never pruned -
  // commissioned scouting arrived after this block was written. Found by the
  // release audit: "s4w1 scout report names a missing player 1385", a ghost
  // left behind when the free-agent pool was trimmed. Same treatment as the
  // agency boards: a report pointing at a deleted player is a broken report.
  if (state.scoutFinds?.length) {
    state.scoutFinds = state.scoutFinds.filter(f => state.players[f.playerId])
    if (!state.scoutFinds.length) state.scoutFinds = null
  }
  // the shortlist has the same shape of problem
  if (state.shortlist?.length) {
    state.shortlist = state.shortlist.filter(pid => state.players[pid])
  }

  boardReinvests(state)
  // and the other hundred boards, for the same reason his does it: money sitting
  // in a deposit account while the club stands still is money the board would
  // rather see in the academy and the training ground (aiecon.ts).
  aiBoardsReinvest(state)

  // budgets: base by rep + carryover health
  for (const club of Object.values(state.clubs)) {
    club.budget = Math.max(200_000, Math.round((club.rep * 45_000 + Math.max(0, club.balance) * 0.15) / 50_000) * 50_000)
    // The old reset was confidence * 0.6 + 30, whose fixed point is 75 - so
    // every board in the game drifted back to comfortable each summer no matter
    // how the season had gone, and a side that finished 8th of 10 was dragged
    // back up to about 75%. Measured over 12 seasons with scripts/boardprobe.ts:
    // board confidence tracked league position at r = -0.23 while the crowd
    // managed -0.62, and boards in the bottom third of the table averaged 70%.
    // The attractor now depends on where the club actually finished: top of the
    // league pulls towards 86, bottom towards 32. The objective verdict above
    // stays as the expectation layer on top of it.
    //
    // Tuned by measurement, not taste. 88 down to 18 at an even split read
    // r = -0.43 but dropped the mean to 37% and left even top-quarter boards at
    // 53%, which would sack a manager who was doing well. This range and weight
    // keep the coupling while leaving a successful side comfortable.
    const frac = finishFrac.get(club.id)
    const target = frac == null ? 75 : 86 - frac * 54
    club.boardConfidence = clamp(club.boardConfidence * 0.55 + target * 0.45, 0, 100)
    const pool = club.players.map(id => state.players[id]).filter(Boolean)
    club.tactic.lineup = autoSelect(state, pool)
    // The sheet this line just wrote is the game's, not the manager's, so the
    // engine's tidy-up may look at it again. userPicked survives a season
    // otherwise, and a team sheet from last summer - men sold, men signed, men
    // retired - is exactly the case the tidy-up was built for.
    club.tactic.userPicked = false
  }

  // Money the board promised the manager is settled HERE, after the refresh
  // above has assigned every budget from scratch - earlier in this function it
  // would be wiped, which is the hole the objective bonus sat in for two
  // versions (see the verdict block).
  if (!state.unemployed) {
    const club = state.clubs[state.userClubId]
    if (objBonus > 0) club.budget += objBonus
    // THE AIM-HIGH RECKONING (user: "they get a bit more money but they best
    // win or the board will be nervous about their budget"). The war chest was
    // an advance against a promise to beat the pundits' number. Beat it, or
    // win the league outright, and the advance was earned. Miss it and next
    // season's budget gives the money back with interest: the interest is what
    // makes taking the cheque every summer a bet rather than a salary, and the
    // rate is set by measurement (scripts/stancecheck.ts), not by argument.
    if (state.stance === 'high' && state.stanceFund) {
      const pred = state.preds?.[club.id]
      const met = userWonLeague || (pred != null && userFinishPos > 0 && userFinishPos < pred)
      if (met) {
        state.news.push({
          id: state.nextId++, week: 1, season: state.season, type: 'board', read: false,
          subject: `💷 The war chest is yours to keep`,
          body: `You told the world to judge you in May, and May agreed. The ${fmtMoney(state.stanceFund)} the board put behind the promise stays spent with their blessing, and the chairman is already quoting you in the season-ticket letter.`,
        })
      } else if (pred != null) {
        // The interest rate is measured, not argued (scripts/stancecheck.ts,
        // 10 paired careers x 3 seasons): a strict beat-the-pundits promise is
        // missed 57% of the time, so 1.75x puts the expected repayment level
        // with the advance and always aiming high is a bet, not a salary. At
        // 2x the high road taxed a career 100k a season; at 1.2x it paid 173k
        // a season - both free lunches, one in each direction.
        const claw = Math.round((state.stanceFund * 1.75) / 50_000) * 50_000
        club.budget = Math.max(200_000, club.budget - claw)
        state.news.push({
          id: state.nextId++, week: 1, season: state.season, type: 'board', read: false,
          subject: `💷 The board recalls the war chest`,
          body: `Last summer you aimed high and the board paid for the privilege: a ${fmtMoney(state.stanceFund)} advance against a promise to beat the pundits. The pundits said ${ordinal(pred)}; you finished ${ordinal(userFinishPos)}. The accountants have taken ${fmtMoney(claw)} off this season's budget - the advance, plus interest for the nervousness. Your budget stands at ${fmtMoney(club.budget)}.`,
        })
      }
    }
  }
  ensureCaptains(state)

  // loan-ins go home to their parent clubs
  for (const p of Object.values(state.players)) {
    if (p.loanFrom && state.clubs[p.loanFrom]) {
      const user = state.clubs[state.userClubId]
      user.players = user.players.filter(id => id !== p.id)
      user.tactic.lineup = user.tactic.lineup.map(id => (id === p.id ? null : id))
      state.clubs[p.loanFrom].players.push(p.id)
      p.clubId = p.loanFrom
      p.loanFrom = null
      if (p.ca < p.pa) p.ca = clamp(p.ca + 1 + Math.floor(rng() * 3), 1, p.pa)
      state.news.push({
        id: state.nextId++, week: 1, season: state.season, type: 'transfer', read: false,
        subject: `${p.name} returns to ${state.clubs[p.clubId]?.short} after his loan`,
        body: `The loan is over. ${p.name} heads back to his parent club having grown from the rugby you gave him.`,
        k: 'news.loanEnds', v: { player: p.name, club: state.clubs[p.clubId]?.short ?? '' },
        playerId: p.id,
      })
    }
  }
  state.objectives = pickObjectives(state)
  // the achievement ledger belongs to the objectives it tracked
  state.objDone = []
  // last season's stance died with last season - the launch decision comes
  // round again in week 2, and the reckoning above has already settled the
  // war chest, so the advance dies with it
  state.stance = undefined
  state.stanceFund = undefined
  // THE ANNUAL (user: "a forced page that says 'ready for a new season?' with
  // records backed up"). The rollover has just filed the honours, the annals
  // and the record books; the stamp routes Continue to the Annual page, whose
  // one button starts the campaign. Engine careers never read it.
  if (!state.unemployed) state.annual = { season: state.season - 1 }

  state.news.push({
    id: state.nextId++, week: 1, season: state.season, type: 'board', read: false,
    subject: `The ${seasonLabel(state.season)} season begins`,
    body: `Pre-season is over. Your transfer budget has been set at ${fmtMoney(state.clubs[state.userClubId].budget)}. Bring us silverware.`,
    k: 'news.seasonBegins',
    v: { season: seasonLabel(state.season), budget: fmtMoney(state.clubs[state.userClubId].budget) },
  })

  // A SEASON IS WORTH BACKING UP, and the rollover is the one moment in the year
  // when a manager is between jobs rather than mid-week. The save lives in this
  // browser's storage and nowhere else: a cleared browser, a full disk or an iPhone
  // that has not seen the game for a week can all take it, and none of them ask
  // first. Once a season, in the same breath as the budget, is not nagging.
  state.news.push({
    id: state.nextId++, week: 1, season: state.season, type: 'general', read: false,
    subject: `📦 ${seasonLabel(state.season - 1)} is in the books: back it up`,
    body: `A whole season done, and every minute of it lives in this browser's storage and nowhere else. `
      + `Game Status has an Export Career button that writes the lot to a single file: keep it somewhere you trust `
      + `and you can put this career back on this phone, or carry it to another one, whatever the browser does in the meantime. `
      + `Takes one tap. Worth doing at every rollover.`,
  })

  punditPredictions(state, rng)
  state.tryOfSeason = null // the new season starts its own reel
  challengeCheck(state)
}

/** Scripted challenges are won at a season's end, and the game says so. */
function challengeCheck(state: GameState) {
  const ch = state.challenge
  if (!ch) return
  const uid = state.userClubId
  const prev = state.season - 1 // the season just completed
  const wonEver = (compId: string) => state.history.some(h => h.champion === uid && h.compId === compId)
  const done =
    ch === 'sapiac' ? uid === 'montauban' && state.clubs[uid]?.leagueId === 'top14'
    : ch === 'redbull' ? uid === 'newcastle' && state.history.some(h => h.season === prev && h.compId === 'prem' && h.champion === uid)
    : ch === 'dynasty' ? uid === 'munster' && wonEver('urc') && wonEver('cc')
    : ch === 'pirates' ? uid === 'pirates' && state.clubs[uid]?.leagueId === 'prem'
    : false
  if (!done) return
  state.challenge = undefined
  ;(state.challengesDone ??= []).push(ch)
  const title = tIn('en', CHALLENGES.find(c => c.id === ch)?.title ?? ch)
  const line =
    ch === 'sapiac' ? 'Montauban stay in the Elite 14. Sapiac is safe, and the Tarn-et-Garonne will sing your name for a generation.'
    : ch === 'redbull' ? 'Newcastle are champions of England. From bottom-four squad to the summit - the project is complete.'
    : ch === 'dynasty' ? 'The UPC and the Continental Cup both live at Thormond Park now. The dynasty is broken, and it broke on your watch.'
    : 'Penzance to the Premier Division. Cornwall has a top-flight club at last, and it is yours.'
  state.news.push({
    id: state.nextId++, week: 1, season: state.season, type: 'award', read: false,
    subject: `🏅 CHALLENGE COMPLETE: ${title}`,
    body: `${line}\n\nThe badge goes on your profile, forever. Whatever happens next, nobody can take this one away.`,
  })
  // the full-screen moment - deliberately after promotion sets its own, so
  // the rarer achievement wins the confetti
  state.celebration = {
    headline: 'CHALLENGE COMPLETE',
    sub: `${title} · ${state.managerName}`,
    icon: '🏅',
  }
}

/** A whole competitive season unbeaten (16C). Checked at rollover while the
 *  fixtures still exist; at least 15 competitive games so a cup-only stub or
 *  a half-imported save cannot claim it. Exported for scripts/unbeatenprobe. */
export function invinciblesCheck(state: GameState) {
  const club = state.clubs[state.userClubId]
  if (!club) return
  const mine = state.fixtures.filter(f =>
    f.played && f.compId !== 'fr' && (f.homeId === club.id || f.awayId === club.id))
  if (mine.length < 15) return
  const losses = mine.filter(f =>
    (f.homeId === club.id ? f.homeScore < f.awayScore : f.awayScore < f.homeScore)).length
  if (losses > 0) return
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
    subject: `🛡️ THE INVINCIBLES: ${club.name} finish the season unbeaten`,
    body: `${mine.length} competitive matches. Zero defeats. Whatever else this club ever does, this season now lives outside the record books, in the place where the game keeps its legends. They will name teams after this side. ${state.managerName} built the team nobody could beat.`,
  })
  state.celebration = {
    headline: 'THE INVINCIBLES',
    sub: `${club.name} · a whole season unbeaten · ${state.managerName}`,
    icon: '🛡️',
  }
}
