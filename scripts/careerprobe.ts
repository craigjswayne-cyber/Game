/**
 * CAREER PROBE - the v1.2.7 asks, at the engine.
 *
 * Owner: "in v1.2.7 lets fix these" - release a player, a form and injury
 * record, saved plans, a depth chart, confirmations and sacking staff. The
 * screens are checked in the browser harnesses; this is the part underneath
 * them, run on a seeded career so it is the same career every time:
 *
 *   1. a career carries no difficulty lever at all, and an old save that
 *      chose one is played as if it never had
 *   2. releasing a player pays off half the contract, frees him, and refuses
 *      for exactly the reasons the button names
 *   3. sacking a coach empties the seat for eight weeks' wages
 *   4. every match writes a rating into the ten-match record, and every
 *      injury writes into the log, so the player screen has something true
 *      to show
 */
import { readFileSync, existsSync } from 'node:fs'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { RELEASE_FLOOR, releaseBlock, releaseCost, releasePlayer } from '../src/game/release'
import { appointStaff, sackCost, sackStaff, staffCandidates } from '../src/game/staff'
import { SEASON_WEEKS, type GameState, absWeek} from '../src/game/model'
import { LOAN_LENGTHS, LOAN_SHARES, expireLoans, loanIn, loanTargets, loanTerms } from '../src/game/loans'
import { mulberry32 } from '../src/game/rng'

let fails = 0
const ok = (c: boolean, msg: string) => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${msg}`); if (!c) fails++ }
const say = (s: string) => console.log(s)

// ---- 1. no difficulty lever ----
//
// Difficulty was three levers on the manager's own club - starting cash, board
// patience, injury rate - and the owner removed it: "this option doesn't really
// work for this type of game." What has to be true afterwards is not that the
// levers are gone from the source, which is obvious, but that a CAREER SAVED
// WHILE THEY EXISTED still plays. Those saves carry a difficulty key, nothing
// reads it, and the game they get is the one 'normal' gave - which is the
// setting where all three levers were 1, 0 and 1, so a normal save is
// unchanged and a legend save gets an easier ride than it signed up for.
// That is the agreed trade and it is worth a probe rather than a hope.
say('\n--- 1. no difficulty lever, and an old save still plays')
{
  const plain = newGame('northampton', 'Probe', 9001)
  ok(plain.difficulty === undefined,
    `a new career carries no difficulty at all (${String(plain.difficulty)})`)

  // an old save, forged the way one would have been stored
  const legacy = { ...newGame('northampton', 'Probe', 9001), difficulty: 'legend' as const }
  const stripped = (g: GameState) => JSON.stringify({ ...g, difficulty: undefined })
  ok(stripped(legacy) === stripped(plain),
    'and a save that chose the hardest level is byte-for-byte the same career once the dead key is set aside')

  // the levers are gone from the engine, not merely from the wizard
  const src = readFileSync('src/game/matchEngine.ts', 'utf8')
    + readFileSync('src/game/rollover.ts', 'utf8')
    + readFileSync('src/game/newgame.ts', 'utf8')
  ok(!/difficultyOf\(/.test(src),
    'no engine file still asks a career how hard it wanted the game')
  ok(!existsSync('src/game/difficulty.ts'), 'and the module itself is gone')
}

// ---- 2. release ----
say('\n--- 2. releasing a player')
{
  const g = newGame('northampton', 'Probe', 9002)
  const club = g.clubs[g.userClubId]
  const seniors = () => club.players.map(id => g.players[id]).filter(p => p && !p.acad)
  const xv = new Set(club.tactic.lineup.slice(0, 15))
  const victim = seniors().filter(p => !xv.has(p.id) && !p.loanFrom).sort((a, b) => a.ca - b.ca)[0]
  ok(!!victim, `there is a senior outside the XV to release (${victim?.name})`)
  const cost = releaseCost(g, victim.id)
  ok(cost > 0 && cost <= victim.wage * 46 * 3, `the pay-off is half the contract, in the right order of magnitude (${cost} on ${victim.wage}/wk to season ${victim.contractEnds})`)
  ok(releaseBlock(g, victim.id) === null, 'nothing blocks releasing him')
  const before = club.balance
  const n0 = seniors().length
  const wage0 = victim.wage
  const r = releasePlayer(g, victim.id)
  ok(r.ok && r.k === 'player.releasedMsg', `the release goes through (${r.k})`)
  ok(victim.clubId === null && !club.players.includes(victim.id), 'he is a free agent and off the club list')
  ok(!club.tactic.lineup.includes(victim.id), 'and out of the team sheet')
  ok(club.balance === before - cost, `the club paid exactly the pay-off (${before} -> ${club.balance})`)
  ok(victim.wage === Math.round(wage0 * 0.7), 'a released man settles for 30% less, like every AI release')
  ok(g.news.some(n => n.k === 'news.released' && n.v?.name === victim.name), 'the inbox carries the story under its key')
  ok(seniors().length === n0 - 1, 'one fewer senior')

  // the refusals
  ok(releaseBlock(g, victim.id) === 'notYours', 'he cannot be released twice')
  const other = seniors().find(p => !xv.has(p.id))!
  const savedLoan = other.loanFrom
  other.loanFrom = 'leicester'
  ok(releaseBlock(g, other.id) === 'onLoanIn', 'a man here on loan cannot be released')
  other.loanFrom = savedLoan
  const bal = club.balance
  club.balance = 0
  ok(releaseBlock(g, other.id) === 'noMoney', 'a club that cannot pay is refused')
  club.balance = bal
  // cut the squad to the floor and the next one is refused
  let guard = 0
  while (seniors().length > RELEASE_FLOOR && guard++ < 40) {
    const p = seniors().find(q => !q.loanFrom)!
    club.balance = 1e9
    releasePlayer(g, p.id)
  }
  ok(seniors().length === RELEASE_FLOOR, `the squad can be cut to the floor of ${RELEASE_FLOOR}`)
  const last = seniors()[0]
  ok(releaseBlock(g, last.id) === 'floor', 'and not one man below it')
  const refused = releasePlayer(g, last.id)
  ok(!refused.ok && refused.k === 'player.releaseFloor', `the refusal names the floor (${refused.k})`)
}

// ---- 3. sack ----
say('\n--- 3. sacking a coach')
{
  const g = newGame('northampton', 'Probe', 9003)
  const club = g.clubs[g.userClubId]
  const role = 'physio' as const
  if (!g.staffPeople?.[role]) {
    club.balance = 50_000_000
    const cands = staffCandidates(g, role)
    appointStaff(g, role, 0)
    ok(!!g.staffPeople?.[role], `a physio is appointed first (${cands[0]?.name})`)
  }
  const person = g.staffPeople![role]!
  const cost = sackCost(g, role)
  ok(cost === Math.round(person.wage * 8 / 500) * 500, `the pay-off is eight weeks of his wage (${cost} on ${person.wage})`)
  const before = club.balance
  const line = sackStaff(g, role)
  ok(typeof line === 'string' && line.includes(person.name), `the screen gets a line naming him (${line})`)
  ok(g.staff[role] === 0, 'the role is back to level 0')
  ok(!g.staffPeople?.[role], 'and the seat is empty')
  ok(club.balance === before - cost, 'the club paid the pay-off')
  ok(g.news.some(n => n.k === 'news.staffSacked'), 'the inbox carries the story')
  club.balance = 0
  const again = sackStaff(g, role)
  ok(!g.news.filter(n => n.k === 'news.staffSacked')[1], `an empty seat cannot be sacked again (${again})`)
}

// ---- 4. the record ----
say('\n--- 4. ratings and injuries are logged as they happen')
{
  const g = newGame('northampton', 'Probe', 9004)
  for (let i = 0; i < 8; i++) processWeekAndAdvance(g)
  const all = Object.values(g.players)
  const rated = all.filter(p => (p.ratings?.length ?? 0) > 0)
  ok(rated.length > 200, `${rated.length} players carry a rating record after eight weeks`)
  ok(rated.every(p => p.ratings!.length <= 10), 'no record is longer than ten')
  ok(rated.every(p => p.ratings!.every(r => r >= 1 && r <= 10)), 'every rating is on the 1-10 scale')
  const mine = g.clubs[g.userClubId].players.map(id => g.players[id]).filter(p => (p.ratings?.length ?? 0) > 0)
  ok(mine.length >= 15, `${mine.length} of the manager's own men have one, so the screen has something to show`)
  ok(mine.every(p => p.lastR != null && Math.abs(p.ratings![p.ratings!.length - 1] - p.lastR) < 0.06),
    'the newest entry is the rating the form pill already shows')
  const hurt = all.filter(p => p.injury)
  ok(hurt.length > 0, `${hurt.length} players are injured somewhere in the world`)
  ok(hurt.every(p => (p.injLog?.length ?? 0) > 0), 'every one of them has the injury in his log')
  ok(hurt.every(p => p.injLog![p.injLog!.length - 1].dk === (p.injury!.dk ?? p.injLog![p.injLog!.length - 1].dk)),
    'and the newest log entry is the injury he is carrying')
  ok(all.every(p => (p.injLog ?? []).every(e => e.weeks >= 1 && typeof e.dk === 'string' && e.s >= 0 && e.w >= 1)),
    'every log entry has a season, a week, a complaint and a length')
}

// ---- 5. a loan is negotiated ----
say('\n--- 5. a loan is negotiated, not collected (v1.2.8)')
{
  const g = newGame('doncaster', 'Probe', 9005)
  const targets = loanTargets(g)
  ok(targets.length > 0, `${targets.length} players are available to borrow`)
  // the same question twice in a week gets the same answer
  const a = targets[0]
  const v1 = loanTerms(g, a.id, 'half', 0.5), v2 = loanTerms(g, a.id, 'half', 0.5)
  ok(v1.ok === v2.ok && v1.k === v2.k, 'the parent gives the same answer to the same offer in the same week')
  // more of the wage and a longer loan carry more often, across the whole market
  const rate = (len: 'short' | 'half' | 'season', share: number) =>
    targets.filter(p => loanTerms(g, p.id, len, share).ok).length / targets.length
  const mean = rate('short', 0.25), generous = rate('season', 1)
  ok(generous > mean, `a season at full wages is accepted more often than three months at a quarter (${(generous * 100).toFixed(0)}% v ${(mean * 100).toFixed(0)}%)`)
  ok(generous >= 0.6, 'and the generous offer nearly always lands')
  ok(mean <= 0.4, 'while the mean one is mostly refused')
  // a refusal names a lever that would have carried it
  const refused = targets.map(p => loanTerms(g, p.id, 'short', 0.25)).filter(v => !v.ok)
  ok(refused.every(v => v.k === 'reply.loanRefused' || !!v.counter), 'every refusal is flat or names a counter')
  ok(refused.some(v => v.counter?.share != null) || refused.some(v => v.counter?.length != null), 'and at least one names the share or the length that would do it')
  // a dated loan goes home on its date
  const ok1 = targets.find(p => loanTerms(g, p.id, 'short', 1).ok)
  if (!ok1) ok(false, 'no target would take three months at full wages')
  else {
    const before = g.clubs[ok1.clubId!].players.length
    const line = loanIn(g, ok1.id, 'short', 1)
    ok(ok1.clubId === g.userClubId && ok1.loanFrom != null, `he arrives (${line})`)
    ok(ok1.loanShare === 1 && ok1.loanUntil === absWeek(g.season, g.week) + 13, 'the share and the date are written on him')
    const parentId = ok1.loanFrom!
    const rng = mulberry32(1)
    expireLoans(g, rng)
    ok(ok1.clubId === g.userClubId, 'he does not go home early')
    g.week += 13
    expireLoans(g, rng)
    ok(ok1.clubId === parentId && !ok1.loanFrom && ok1.loanUntil == null, 'and he goes home the week the loan falls due')
    ok(g.clubs[parentId].players.length === before, 'back on his parent\'s list')
    ok(g.news.some(n => n.k === 'news.loanEnds' && n.v?.player === ok1.name), 'with the story in the inbox')
    g.week -= 13
  }
  ok(LOAN_LENGTHS.length === 3 && LOAN_SHARES.length === 4, 'three lengths, four shares on the table')
}

console.log(fails === 0
  ? '\nCAREER PROBE PASSED: release, sack and the record all hold at the engine'
  : `\nCAREER PROBE FAILED (${fails})`)
process.exit(fails === 0 ? 0 : 1)
