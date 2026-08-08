import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng, NEWS_KEEP } from '../src/game/season'
import { simMatch, autoSelect, availablePlayers, beginMatch } from '../src/game/matchEngine'
import { answerPress } from '../src/game/media'
import { offerRenewalAt, respondToOffer } from '../src/game/ai'
import { loanOut } from '../src/game/loans'
import { sendToCourse, type StaffRole } from '../src/game/staff'
import { commissionScout } from '../src/game/commission'
import { mentorFit } from '../src/game/mentoring'
import { NATIONS } from '../src/game/nations'
import { firstStepOfWeek, nextStep, stepFromDay, today } from '../src/game/days'
import { fineAttr } from '../src/game/attributes'
import {
  ATTR_KEYS, SEASON_WEEKS, fmtMoney, mgrReputation, squadTrust, weeklyCentral,
  type GameState, type Player,
} from '../src/game/model'

/**
 * ---- FIVE SEASONS, PLAYED BADLY ON PURPOSE ----
 *
 * The UI soak (scripts/soakui.mjs) presses the buttons a player presses. This
 * does the other half: it plays five seasons while behaving like the worst
 * possible manager, and then checks the things a screenshot cannot show you.
 *
 * The abuse is the point. Every week it does something a real player might do
 * carelessly or maliciously - clear the team sheet, loan out the whole squad,
 * offer a man a pound a week, sit every coach for a badge he cannot afford,
 * answer press questions twice, commission a scout while one is already out,
 * pick a lineup with the same man in four shirts - and after every week it
 * checks that the world is still coherent:
 *
 *   no NaN, Infinity or negative age anywhere in the world
 *   every roster entry points at a player who points back
 *   nobody is in two squads, or in the same lineup twice
 *   every league table's played counts match its fixtures
 *   no duplicate news ids, no orphaned fixture references
 *   the reputation and trust scales stay inside their stated bounds
 *   the attribute ratings stay inside 1-100
 *   the day walk still terminates
 *   money is a finite number, however stupid the manager has been
 */

let fails = 0
const seen = new Set<string>()
function bad(what: string, detail: string) {
  const key = `${what}|${detail}`.slice(0, 140)
  if (seen.has(key)) return
  seen.add(key)
  console.log(` FAIL  ${what}: ${detail}`)
  fails++
}
function ok(cond: boolean, what: string) {
  if (cond) console.log(`  ok   ${what}`)
  else { console.log(` FAIL  ${what}`); fails++ }
}

const finite = (n: unknown) => typeof n === 'number' && Number.isFinite(n)

/**
 * Everything that must be true of the world, every week, forever.
 *
 * `abused` says whether the harness has deliberately injected nonsense into the
 * team sheet this week. When it has, the team-sheet checks are skipped: the
 * question there is whether the engine SURVIVES the nonsense, not whether the
 * nonsense is present, and asserting otherwise is a harness arguing with itself.
 * Phase one plays five clean seasons with every check live, which is what proves
 * the invariant holds in play.
 */
function checkWorld(g: GameState, when: string, abused = false) {
  // ---- money and the manager's own numbers
  for (const c of Object.values(g.clubs)) {
    if (!finite(c.balance)) bad('MONEY', `${c.id} balance is ${c.balance} (${when})`)
    if (!finite(c.budget) || c.budget < 0) bad('MONEY', `${c.id} budget is ${c.budget} (${when})`)
    if (!finite(c.wageBudget)) bad('MONEY', `${c.id} wage budget is ${c.wageBudget} (${when})`)
    if (!finite(c.boardConfidence) || c.boardConfidence < 0 || c.boardConfidence > 100) {
      bad('BOARD', `${c.id} confidence is ${c.boardConfidence} (${when})`)
    }
    if (!finite(c.capacity) || c.capacity <= 0) bad('GROUND', `${c.id} capacity is ${c.capacity} (${when})`)
    if (!finite(weeklyCentral(c))) bad('MONEY', `${c.id} central funding is not a number (${when})`)
  }
  const rep = mgrReputation(g)
  if (!finite(rep) || rep < 0 || rep > 100) bad('REP', `manager reputation is ${rep} (${when})`)
  const tr = squadTrust(g)
  if (!finite(tr) || tr < 0 || tr > 100) bad('TRUST', `dressing-room trust is ${tr} (${when})`)

  // ---- players
  const inSquad = new Map<number, string>()
  for (const c of Object.values(g.clubs)) {
    const dupe = new Set<number>()
    for (const id of c.players) {
      const p = g.players[id]
      if (!p) { bad('ROSTER', `${c.id} lists player ${id} who does not exist (${when})`); continue }
      if (p.clubId !== c.id) bad('ROSTER', `${p.name} is on ${c.id}'s list but his club is ${p.clubId} (${when})`)
      if (dupe.has(id)) bad('ROSTER', `${p.name} is listed twice by ${c.id} (${when})`)
      dupe.add(id)
      const other = inSquad.get(id)
      if (other && other !== c.id) bad('ROSTER', `${p.name} is at both ${other} and ${c.id} (${when})`)
      inSquad.set(id, c.id)
    }
    // the team sheet: no man in two shirts at once, and nobody else's players
    if (abused) continue
    const shirts = new Map<number, number>()
    c.tactic.lineup.forEach((pid, i) => {
      if (pid == null) return
      if (shirts.has(pid)) {
        bad('LINEUP', `${g.players[pid]?.name ?? pid} is in ${c.id}'s shirts ${shirts.get(pid)! + 1} and ${i + 1} (${when})`)
      }
      shirts.set(pid, i)
      if (!g.players[pid]) bad('LINEUP', `${c.id} has picked player ${pid} who does not exist (${when})`)
      else if (g.players[pid].clubId !== c.id) bad('LINEUP', `${c.id} has picked ${g.players[pid].name}, who plays for ${g.players[pid].clubId} (${when})`)
    })
  }
  for (const p of Object.values(g.players)) {
    if (!finite(p.ca) || p.ca < 1 || p.ca > 100) bad('PLAYER', `${p.name} has ability ${p.ca} (${when})`)
    if (!finite(p.pa) || p.pa < 1 || p.pa > 100) bad('PLAYER', `${p.name} has potential ${p.pa} (${when})`)
    if (!finite(p.age) || p.age < 15 || p.age > 45) bad('PLAYER', `${p.name} is ${p.age} years old (${when})`)
    if (!finite(p.form) || p.form < 0 || p.form > 10) bad('PLAYER', `${p.name} has form ${p.form} (${when})`)
    if (!finite(p.morale) || p.morale < 0 || p.morale > 10) bad('PLAYER', `${p.name} has morale ${p.morale} (${when})`)
    if (!finite(p.cond) || p.cond < 0 || p.cond > 100) bad('PLAYER', `${p.name} has fitness ${p.cond} (${when})`)
    if (!finite(p.wage) || p.wage < 0) bad('PLAYER', `${p.name} earns ${p.wage} (${when})`)
    if (!finite(p.value) || p.value < 0) bad('PLAYER', `${p.name} is valued at ${p.value} (${when})`)
    if (!p.name || /undefined|NaN/.test(p.name)) bad('PLAYER', `a player is called "${p.name}" (${when})`)
    if (p.bans < 0) bad('PLAYER', `${p.name} has ${p.bans} matches of ban (${when})`)
    for (const k of ATTR_KEYS) {
      const a = p.a[k]
      if (!finite(a) || a < 1 || a > 20) bad('ATTR', `${p.name} has ${k} of ${a} (${when})`)
      const shown = fineAttr(p.id, ATTR_KEYS.indexOf(k), a)
      if (!finite(shown) || shown < 1 || shown > 100) bad('ATTR', `${p.name}'s ${k} shows as ${shown} (${when})`)
    }
  }

  // ---- fixtures and tables
  const ids = new Set<number>()
  for (const f of g.fixtures) {
    if (ids.has(f.id)) bad('FIXTURE', `two fixtures share id ${f.id} (${when})`)
    ids.add(f.id)
    // a team id is either a club or a nation: internationals are played by
    // nation codes rather than by club ids, which is not a bug
    const known = (id: string) => !!g.clubs[id] || NATIONS.some(n => n.code === id)
    if (!known(f.homeId)) bad('FIXTURE', `fixture ${f.id} has unknown home side ${f.homeId} (${when})`)
    if (!known(f.awayId)) bad('FIXTURE', `fixture ${f.id} has unknown away side ${f.awayId} (${when})`)
    if (!finite(f.week) || f.week < 1) bad('FIXTURE', `fixture ${f.id} is in week ${f.week} (${when})`)
    if (f.played) {
      if (!finite(f.homeScore) || !finite(f.awayScore)) bad('FIXTURE', `fixture ${f.id} finished ${f.homeScore}-${f.awayScore} (${when})`)
      if (f.homeScore < 0 || f.awayScore < 0) bad('FIXTURE', `fixture ${f.id} has a negative score (${when})`)
      if (f.homeScore > 200 || f.awayScore > 200) bad('FIXTURE', `fixture ${f.id} finished ${f.homeScore}-${f.awayScore}, which is not rugby (${when})`)
    }
  }
  for (const comp of Object.values(g.comps)) {
    if (comp.type !== 'league' || !comp.table) continue
    for (const row of comp.table) {
      if (!finite(row.p) || !finite(row.pts) || row.p < 0 || row.pts < 0) {
        bad('TABLE', `${comp.id}: ${row.teamId} has played ${row.p} for ${row.pts} points (${when})`)
      }
      const played = g.fixtures.filter(f => f.compId === comp.id && f.played && !f.stage &&
        (f.homeId === row.teamId || f.awayId === row.teamId)).length
      if (row.p !== played) {
        bad('TABLE', `${comp.id}: ${row.teamId}'s table says ${row.p} played, the fixture list says ${played} (${when})`)
      }
      if (row.w + row.d + row.l !== row.p) {
        bad('TABLE', `${comp.id}: ${row.teamId} has ${row.w}W ${row.d}D ${row.l}L but ${row.p} played (${when})`)
      }
    }
  }

  // ---- news and press
  const nids = new Set<number>()
  for (const n of g.news) {
    if (nids.has(n.id)) bad('NEWS', `two stories share id ${n.id} (${when})`)
    nids.add(n.id)
    if (!n.subject || /undefined|NaN|\[object/.test(n.subject)) bad('NEWS', `a story is headlined "${n.subject}" (${when})`)
    if (/undefined|NaN|\[object Object\]|Infinity/.test(n.body)) {
      const m = /undefined|NaN|\[object Object\]|Infinity/.exec(n.body)!
      const i = n.body.indexOf(m[0])
      bad('NEWS', `"${n.subject}" contains ${m[0]}: ...${n.body.slice(Math.max(0, i - 40), i + 40).replace(/\s+/g, ' ')}...`)
    }
  }
  for (const pr of g.press) {
    if (!pr.question || /undefined|NaN/.test(pr.question)) bad('PRESS', `a question reads "${pr.question}" (${when})`)
    for (const o of pr.options) if (!o.label) bad('PRESS', `a press option has no label (${when})`)
  }

  // ---- mentoring pairs point at real people
  for (const mp of g.mentors ?? []) {
    const s = g.players[mp.senior]
    const k = g.players[mp.kid]
    if (!s || !k) { bad('MENTOR', `a pairing points at a player who has gone (${when})`); continue }
    const fit = mentorFit(s, k)
    if (!finite(fit) || fit < 0 || fit > 100) bad('MENTOR', `${s.name}/${k.name} fit is ${fit} (${when})`)
  }

  // ---- the day walk must still terminate
  const step = nextStep(g)
  if (!['day', 'match', 'week'].includes(step.kind)) bad('DAYS', `nextStep returned "${step.kind}" (${when})`)
  let guard = 0
  let s2 = firstStepOfWeek(g)
  while (s2.kind === 'day') {
    if (guard++ > 10) { bad('DAYS', `the day walk did not terminate (${when})`); break }
    s2 = stepFromDay(g, s2.day)
  }
}

// ------------------------------------------------------------------ the run
const ROLES: StaffRole[] = ['assistant', 'physio', 'scout', 'attack', 'defence', 'scrumCoach', 'kicking', 'academyCoach']

/** Play five seasons and check the world after every single week. */
function play(seed: number, label: string, abuse: boolean) {
  const g = newGame('northampton', abuse ? 'Wrecking Ball' : 'Straight Bat', seed)
  const club = g.clubs[g.userClubId]
  let weeks = 0
  let matches = 0
  let abuses = 0
  const attempt = (what: () => void) => {
    try { what(); abuses++ } catch (e) { bad('THREW', `${label}: ${String(e).split('\n')[0].slice(0, 120)}`) }
  }

  for (let season = 0; season < 5; season++) {
    const startYear = g.season
    let wk = 0
    let abusedThisWeek = false
    while (g.season === startYear && wk < SEASON_WEEKS + 4) {
      wk++
      weeks++
      abusedThisWeek = false
      const w = `${label} s${season + 1} wk${g.week}`

      if (abuse) {
        abusedThisWeek = true
        // ---- pick a fight with the game every single week
        switch (weeks % 12) {
          case 0: attempt(() => { club.tactic.lineup = new Array(23).fill(null) }); break
          case 1: attempt(() => {
            const pid = club.players.find(id => g.players[id] && !g.players[id].acad)
            if (pid != null) { club.tactic.lineup[0] = pid; club.tactic.lineup[5] = pid; club.tactic.lineup[9] = pid; club.tactic.lineup[14] = pid }
          }); break
          case 2: attempt(() => {
            const foreign = Object.values(g.players).find(p => p.clubId && p.clubId !== club.id)
            if (foreign) club.tactic.lineup[3] = foreign.id
          }); break
          case 3: attempt(() => {
            const best = club.players.map(id => g.players[id]).filter(Boolean).sort((a, b) => b.ca - a.ca)[0]
            if (best) offerRenewalAt(g, best.id, 1)
          }); break
          case 4: attempt(() => {
            const best = club.players.map(id => g.players[id]).filter(Boolean).sort((a, b) => b.ca - a.ca)[0]
            if (best) offerRenewalAt(g, best.id, 10_000_000)
          }); break
          case 5: attempt(() => { for (const r of ROLES) sendToCourse(g, r) }); break
          case 6: attempt(() => { commissionScout(g, 'any', 3); commissionScout(g, 'FL', 9); commissionScout(g, 'any', 6) }); break
          case 7: attempt(() => {
            for (const pr of g.press.slice(-3)) { answerPress(g, pr.id, 0); answerPress(g, pr.id, 1); answerPress(g, pr.id, 99) }
          }); break
          case 8: attempt(() => { for (const id of club.players.slice(0, 6)) loanOut(g, id) }); break
          case 9: attempt(() => {
            g.offers.filter(o => o.status === 'pending' && o.forUser)
              .forEach((o, i) => respondToOffer(g, o.id, i % 2 === 0))
          }); break
          case 10: attempt(() => { club.balance -= 5_000_000 }); break
          case 11: attempt(() => { club.tactic.lineup = autoSelect(g, availablePlayers(g, club.players), 'balanced') }); break
        }
      } else {
        // a straight bat: answer what has to be answered and pick a legal side
        attempt(() => {
          g.offers.filter(o => o.status === 'pending' && o.forUser).forEach(o => respondToOffer(g, o.id, false))
          for (const pr of g.press) if (!pr.answered) answerPress(g, pr.id, 0)
          if (weeks % 5 === 0) club.tactic.lineup = autoSelect(g, availablePlayers(g, club.players), 'balanced')
        })
      }

      const fx = userFixtureThisWeek(g)
      if (fx) {
        attempt(() => {
          // the two paths a player can take to a result, both exercised
          if (weeks % 2 === 0) {
            const ctx = beginMatch(g, fx, weekRng(g), true, g.userClubId)
            void ctx
          }
          simMatch(g, fx, weekRng(g), weeks % 3 === 0)
          matches++
        })
      }

      g.newsFrom = g.nextId
      attempt(() => processWeekAndAdvance(g))
      g.day = 0

      checkWorld(g, w, abusedThisWeek)
      if (fails > 40) { console.log('  (stopping: too many failures to be useful)'); return { g, weeks, matches, abuses } }
    }
    const c2 = g.clubs[g.userClubId]
    console.log(`  ${label} season ${season + 1}: ${g.mgr.m} career matches (${g.mgr.w}W ${g.mgr.d}D ${g.mgr.l}L), `
      + `balance ${fmtMoney(c2?.balance ?? 0)}, rep ${mgrReputation(g)}, trust ${Math.round(squadTrust(g))}, `
      + `${Object.keys(g.players).length} players, ${g.news.length} stories`)
  }
  return { g, weeks, matches, abuses }
}

console.log('--- PHASE 1: five seasons played straight, every invariant live')
const clean = play(24601, 'clean', false)
console.log(`  ${clean.weeks} weeks, ${clean.matches} matches`)

console.log('\n--- PHASE 2: five seasons played by the worst manager in the league')
const wrecked = play(1337, 'abused', true)
console.log(`  ${wrecked.weeks} weeks, ${wrecked.matches} matches, ${wrecked.abuses} deliberate abuses`)

// ---- and a final look at the things that only show up at the end
for (const [label, r] of [['clean', clean], ['abused', wrecked]] as const) {
  const g = r.g
  console.log(`\n--- the ${label} world after five seasons`)
  const players = Object.values(g.players)
  ok(players.length > 3000, `still has players in it (${players.length})`)
  ok(Object.keys(g.clubs).length >= 100, `and clubs (${Object.keys(g.clubs).length})`)
  const orphans = Object.values(g.clubs).flatMap(c => c.players.filter(id => !g.players[id]))
  ok(orphans.length === 0, `no roster entry points at a player who does not exist (${orphans.length})`)
  const homeless = players.filter(p => p.clubId && !g.clubs[p.clubId])
  ok(homeless.length === 0, `nobody plays for a club that does not exist (${homeless.length})`)
  const unclaimed = players.filter(p => p.clubId && !g.clubs[p.clubId]?.players.includes(p.id))
  ok(unclaimed.length === 0, `every player his club claims, claims him back (${unclaimed.length})`)
  ok(g.news.length <= NEWS_KEEP, `the news list is still trimmed (${g.news.length} <= ${NEWS_KEEP})`)
  ok(finite(g.clubs[g.userClubId]?.balance ?? NaN), 'the club still has a real balance')
  ok(g.season === 5, `five seasons actually elapsed (season index ${g.season})`)
  const seasonsOfHistory = new Set(g.history.map(h => h.season)).size
  ok(seasonsOfHistory >= 4, `the record books filled in along the way (${seasonsOfHistory} seasons of honours)`)
  ok(today(g) >= 0 && today(g) <= 5, `the day cursor is sane (${today(g)})`)
  ok(g.mgr.m === g.mgr.w + g.mgr.d + g.mgr.l,
    `the career record adds up (${g.mgr.m} = ${g.mgr.w}+${g.mgr.d}+${g.mgr.l})`)
}

console.log(fails ? `\nBREAK IT FOUND ${fails} PROBLEM(S)` : '\nBREAK IT PASSED: ten seasons, five of them abused, and the world held')
if (fails) process.exit(1)
