// Engine fuzz v2: hostile inputs against every hook added since the last pass
import { newGame } from '../src/game/newgame'
import { simMatch } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'

const g = newGame('leicester', 'Fuzz Gaffer', 1337)
const rng = mulberry32(0xf00d)
const clubs = Object.values(g.clubs)
let bad = 0
const check = (label: string, cond: boolean) => { if (!cond) { bad++; console.log(`FUZZ FAIL: ${label}`) } }

for (let i = 0; i < 400; i++) {
  const home = clubs[Math.floor(rng() * clubs.length)]
  const away = clubs[Math.floor(rng() * clubs.length)]
  if (home.id === away.id) continue
  // mutilate lineups in various ways
  const mode = i % 5
  if (mode === 1) home.tactic.lineup = home.tactic.lineup.map((id, k) => (k % 3 === 0 ? null : id))
  if (mode === 2) home.tactic.lineup = home.tactic.lineup.slice(0, 15).concat(new Array(8).fill(null))
  if (mode === 3) away.tactic.lineup = new Array(23).fill(null).map((_, k) => away.tactic.lineup[k] ?? null)
  if (mode === 4) {
    // extreme abilities
    for (const id of home.players.slice(0, 10)) { const p = g.players[id]; if (p) p.ca = 99 }
    for (const id of away.players.slice(0, 10)) { const p = g.players[id]; if (p) p.ca = 30 }
  }
  const fx = {
    id: g.nextId++, compId: i % 7 === 0 ? 'fr' : 'prem', round: 0, week: g.week,
    homeId: home.id, awayId: away.id, played: false,
    homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0,
    stage: i % 11 === 0 ? 'F' as const : undefined,
    testimonial: i % 13 === 0 ? (g.players[home.players[0]]?.id) : undefined,
  }
  try {
    simMatch(g, fx as any, rng, i % 3 === 0)
  } catch (e) {
    bad++
    console.log(`FUZZ EXCEPTION at i=${i} mode=${mode}: ${(e as Error).message}`)
    continue
  }
  check(`score NaN i=${i}`, Number.isFinite(fx.homeScore) && Number.isFinite(fx.awayScore))
  check(`score negative i=${i}`, fx.homeScore >= 0 && fx.awayScore >= 0)
  check(`score absurd i=${i}`, fx.homeScore <= 200 && fx.awayScore <= 200)
  check(`tries absurd i=${i}`, fx.homeTries <= 30 && fx.awayTries <= 30)
  check(`played flag i=${i}`, (fx as any).played === true)
}
// natrank bounds after nation fuzz
import { updateNatRank, seedNatRank } from '../src/game/natrank'
seedNatRank(g)
for (let i = 0; i < 300; i++) {
  const codes = Object.keys(g.natRank!)
  const a = codes[Math.floor(rng() * codes.length)]
  const b = codes[Math.floor(rng() * codes.length)]
  if (a === b) continue
  updateNatRank(g, { id: 0, compId: i % 2 ? 'wc' : 'sn', round: 0, week: 1, homeId: a, awayId: b, played: true, homeScore: Math.floor(rng() * 80), awayScore: Math.floor(rng() * 80), homeTries: 0, awayTries: 0, stage: i % 3 === 0 ? 'F' : undefined } as any)
}
for (const [c, v] of Object.entries(g.natRank!)) check(`natrank bounds ${c}=${v}`, v >= 40 && v <= 100)

// v3: the newest hooks - the award ledger after the hostile matches above,
// and the press room fed garbage answers
import { generatePress, answerPress } from '../src/game/media'

if (g.tryOfSeason) {
  const t = g.tryOfSeason
  check('tryOfSeason minute bounds', t.min >= 1 && t.min <= 85)
  check('tryOfSeason has name and text', !!t.name && !!t.text)
  check('tryOfSeason season is current', t.season === g.season)
  check('tryOfSeason drama finite', Number.isFinite(t.drama))
}
let answered = 0
for (let i = 0; i < 60; i++) {
  g.week = 4 + (i % 40)
  generatePress(g, mulberry32(i * 77 + 5))
  for (const pi of g.press.filter(p => !p.answered)) {
    try {
      answerPress(g, pi.id, -1) // out of range low: must be inert
      answerPress(g, pi.id, 99) // out of range high: must be inert
      check(`press #${pi.id} unanswered after bad indices`, !pi.answered)
      answerPress(g, pi.id, 0) // legit
      const before = g.clubs[g.userClubId].boardConfidence
      answerPress(g, pi.id, 1) // double answer: must be inert
      check(`press #${pi.id} double answer inert`, g.clubs[g.userClubId].boardConfidence === before)
      answered++
    } catch (e) { bad++; console.log(`FUZZ EXCEPTION press #${pi.id}: ${(e as Error).message}`) }
  }
}
try { answerPress(g, 999999999, 0) } catch { bad++; console.log('FUZZ EXCEPTION: bogus press id throws') }
check('board confidence bounded after press abuse', g.clubs[g.userClubId].boardConfidence >= 0 && g.clubs[g.userClubId].boardConfidence <= 100)
for (const id of g.clubs[g.userClubId].players) {
  const p = g.players[id]
  if (p) check(`morale bounds ${p.name}`, p.morale >= 1 && p.morale <= 10)
}


// v4: the 8-batch hooks - the boardroom, the coaching courses, the staff
// market and the scout's brief, all fed nonsense a UI could never send but a
// corrupted save might
import { requestExpansion, requestFacility } from '../src/game/season'
import { appointStaff, sendToCourse, staffCandidates } from '../src/game/staff'
import { commissionScout, type SearchMonths } from '../src/game/commission'
import { analystRead } from '../src/game/analyst'
import { MAX_FACILITY, type FacilityId } from '../src/game/model'

const uc = g.clubs[g.userClubId]
const FIDS: FacilityId[] = ['pitch', 'gym', 'recovery', 'paddock', 'kicking', 'briefing', 'academy', 'shop']
try {
  // bogus facility ids and hostile balances
  for (const junk of ['', 'gymnasium', 'GYM', '__proto__', 'toString'] as unknown as FacilityId[]) {
    requestFacility(g, junk)
  }
  check('no build started by a bogus facility id', !g.facilityBuild || FIDS.includes(g.facilityBuild.id))
  for (const bal of [-50_000_000, 0, 1, Number.MAX_SAFE_INTEGER]) {
    uc.balance = bal
    g.facilityAskCooldown = 0
    for (const fid of FIDS) requestFacility(g, fid)
    requestExpansion(g)
    check(`balance finite after asking at ${bal}`, Number.isFinite(uc.balance))
    check('capacity sane after expansion asks', uc.capacity > 0 && uc.capacity <= 90_000)
    if (g.facilityBuild) {
      check('build level within cap', g.facilityBuild.level >= 1 && g.facilityBuild.level <= MAX_FACILITY)
      g.facilityBuild = null
    }
  }
  for (const fid of FIDS) {
    const lvl = uc.facilities?.[fid] ?? 0
    check(`facility ${fid} level in range`, lvl >= 0 && lvl <= MAX_FACILITY)
  }
} catch (e) { bad++; console.log(`FUZZ EXCEPTION boardroom: ${(e as Error).message}`) }

try {
  // the staff market with impossible indices, and courses on empty posts
  const roles = ['assistant', 'physio', 'scout', 'attack', 'defence', 'scrumCoach', 'kicking', 'academyCoach'] as const
  uc.balance = 40_000_000
  for (const role of roles) {
    for (const idx of [-1, 3, 99, 1.5, NaN]) appointStaff(g, role, idx as number)
    check(`no phantom appointment for ${role} from a bad index`,
      !g.staffPeople?.[role] || g.staffPeople[role]!.tier === g.staff[role])
    const cands = staffCandidates(g, role)
    check(`${role} market always offers three`, cands.length === 3)
    for (const c of cands) {
      check(`${role} candidate wage positive`, c.wage > 0)
      check(`${role} candidate tier 1-3`, c.tier >= 1 && c.tier <= 3)
      check(`${role} candidate fee positive`, c.fee > 0)
    }
    // a course on a vacant post, then twice on a filled one
    g.staff[role] = 0
    if (g.staffPeople) delete g.staffPeople[role]
    sendToCourse(g, role)
    check(`no course booked on a vacant ${role}`, !g.staffPeople?.[role]?.course)
    const i = cands.findIndex(c => c.tier < 3)
    if (i >= 0) {
      const rep = uc.rep
      uc.rep = 99 // make sure he says yes
      appointStaff(g, role, i)
      uc.rep = rep
      sendToCourse(g, role)
      sendToCourse(g, role)
      const person = g.staffPeople?.[role]
      if (person?.course) {
        check(`${role} course finishes within six weeks`, person.course.done <= g.season * 100 + g.week + 6)
        check(`${role} course sits the next badge only`, person.course.toTier === person.tier + 1)
      }
    }
  }
  check('staff wage bill finite', Number.isFinite(uc.balance))
} catch (e) { bad++; console.log(`FUZZ EXCEPTION staff: ${(e as Error).message}`) }

try {
  // briefs with junk positions and durations
  uc.balance = 40_000_000
  for (const months of [0, 1, 12, 3.5, -3, NaN] as unknown as SearchMonths[]) {
    commissionScout(g, 'any', months)
    if (g.commission) {
      check(`brief duration is one of the three offered`, [3, 6, 9].includes(g.commission.months))
      g.commission = null
    }
  }
  for (const pos of ['', 'PROP', 'LP', '__proto__'] as unknown as ('LP')[]) {
    g.commission = null
    commissionScout(g, pos, 3)
  }
  check('commission fee positive when one is live', !g.commission || g.commission.fee > 0)
  // the analyst on a club that does not exist, and on every real one
  check('analyst returns nothing for a missing club', analystRead(g, 'no_such_club') === null)
  let reads = 0
  for (const cid of Object.keys(g.clubs).slice(0, 40)) {
    if (cid === g.userClubId) continue
    const r = analystRead(g, cid)
    if (!r) continue
    reads++
    check(`analyst claim not empty for ${cid}`, r.claim.length > 20)
    check(`analyst prep is a real focus for ${cid}`,
      ['attack', 'defence', 'setpiece', 'fitness', 'recovery'].includes(r.prep))
  }
  check('analyst read every club asked', reads >= 30)
} catch (e) { bad++; console.log(`FUZZ EXCEPTION scouting/analyst: ${(e as Error).message}`) }

console.log(bad === 0
  ? `FUZZ v4 PASSED: 400 hostile matches + 300 rank exchanges + ${answered} abused press conferences + the boardroom, the staff market, the courses, the briefs and the analyst all fed nonsense`
  : `FUZZ v4: ${bad} failures`)
if (bad > 0) process.exit(1)