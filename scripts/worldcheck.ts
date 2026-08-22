/**
 * ---- WHAT MUST BE TRUE OF THE WORLD, ALWAYS ----
 *
 * One definition of "coherent", shared by every harness that pushes the engine
 * somewhere strange. It started inside scripts/breakit.ts and moved here the
 * moment a second harness needed it: two copies of an invariant is two
 * invariants, and the weaker one wins by accident.
 *
 *   no NaN, Infinity or negative age anywhere in the world
 *   every roster entry points at a player who points back
 *   nobody is in two squads, or in the same lineup twice
 *   every league table's played counts match its fixtures
 *   no duplicate news ids, no orphaned fixture references
 *   reputation and trust stay inside their stated bounds
 *   attribute ratings stay inside 1-100
 *   money is a finite number, however stupid the manager has been
 *   the day walk still terminates
 */
import { NATIONS } from '../src/game/nations'
import { firstStepOfWeek, nextStep, stepFromDay } from '../src/game/days'
import { fineAttr } from '../src/game/attributes'
import { mentorFit } from '../src/game/mentoring'
import {
  ATTR_KEYS, mgrReputation, squadTrust, weeklyCentral, type GameState,
} from '../src/game/model'

let fails = 0
/** Suppresses reporting while a harness is deliberately breaking the world to
 *  find out whether the checker still notices. */
let quiet = false
const seen = new Set<string>()
export function bad(what: string, detail: string) {
  if (quiet) { fails++; return }
  const key = `${what}|${detail}`.slice(0, 140)
  if (seen.has(key)) return
  seen.add(key)
  console.log(` FAIL  ${what}: ${detail}`)
  fails++
}
export function ok(cond: boolean, what: string) {
  if (cond) console.log(`  ok   ${what}`)
  else { console.log(` FAIL  ${what}`); fails++ }
}

export const finite = (n: unknown) => typeof n === 'number' && Number.isFinite(n)

/**
 * ---- READING A WORLD THAT MIGHT NOT BE ONE ----
 *
 * This checker is handed damaged worlds on purpose (scripts/savefuzz.ts feeds it
 * saves with whole collections missing), so it cannot assume its own inputs. A
 * checker that throws on the damage it exists to report tells you nothing at all
 * - it just dies, and the run stops before the interesting cases.
 *
 * So every collection is read through one of these. A missing collection is a
 * finding, reported once, not an exception.
 */
function list<T>(g: GameState, what: string, v: unknown, when: string): T[] {
  if (Array.isArray(v)) return v as T[]
  if (v != null) bad('SHAPE', `${what} is ${typeof v}, not a list (${when})`)
  return []
}
function table<T>(g: GameState, what: string, v: unknown, when: string): T[] {
  if (v && typeof v === 'object' && !Array.isArray(v)) return Object.values(v as Record<string, T>)
  if (v != null) bad('SHAPE', `${what} is ${Array.isArray(v) ? 'a list' : typeof v}, not a map (${when})`)
  else bad('SHAPE', `${what} is missing (${when})`)
  return []
}

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
export function checkWorld(g: GameState, when: string, abused = false) {
  // ---- money and the manager's own numbers
  for (const c of table<GameState['clubs'][string]>(g, 'clubs', g.clubs, when)) {
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
  for (const c of table<GameState['clubs'][string]>(g, 'clubs', g.clubs, when)) {
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
  for (const p of table<GameState['players'][number]>(g, 'players', g.players, when)) {
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
  const fixtures = list<GameState['fixtures'][number]>(g, 'the fixture list', g.fixtures, when)
  for (const f of fixtures) {
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
  for (const comp of table<GameState['comps'][string]>(g, 'the competitions', g.comps, when)) {
    if (comp.type !== 'league' || !comp.table) continue
    for (const row of comp.table) {
      // NEGATIVE POINTS ARE LEGAL NOW, but only for a reason the save can name.
      // A club in administration is docked ten before a ball is kicked
      // (insolvency.ts), so a row reading P0 on minus ten is the mechanic
      // working, not a corrupt table - and this check flagged exactly that the
      // first time administration shipped. What must still be impossible is
      // negative points with no deduction to explain them.
      const docked = g.clubs[row.teamId]?.admin?.season === g.season
        ? (g.clubs[row.teamId]?.admin?.penalty ?? 0) : 0
      if (!finite(row.p) || !finite(row.pts) || row.p < 0 || row.pts < -docked) {
        bad('TABLE', `${comp.id}: ${row.teamId} has played ${row.p} for ${row.pts} points` +
          `${docked ? ` (docked ${docked})` : ''} (${when})`)
      }
      const played = fixtures.filter(f => f.compId === comp.id && f.played && !f.stage &&
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
  for (const n of list<GameState['news'][number]>(g, 'the news list', g.news, when)) {
    if (nids.has(n.id)) bad('NEWS', `two stories share id ${n.id} (${when})`)
    nids.add(n.id)
    if (!n.subject || /undefined|NaN|\[object/.test(n.subject)) bad('NEWS', `a story is headlined "${n.subject}" (${when})`)
    if (/undefined|NaN|\[object Object\]|Infinity/.test(n.body)) {
      const m = /undefined|NaN|\[object Object\]|Infinity/.exec(n.body)!
      const i = n.body.indexOf(m[0])
      bad('NEWS', `"${n.subject}" contains ${m[0]}: ...${n.body.slice(Math.max(0, i - 40), i + 40).replace(/\s+/g, ' ')}...`)
    }
  }
  for (const pr of list<GameState['press'][number]>(g, 'the press list', g.press, when)) {
    if (!pr.question || /undefined|NaN/.test(pr.question)) bad('PRESS', `a question reads "${pr.question}" (${when})`)
    for (const o of pr.options) if (!o.label) bad('PRESS', `a press option has no label (${when})`)
  }

  // ---- mentoring pairs point at real people
  for (const mp of list<NonNullable<GameState['mentors']>[number]>(g, 'the mentoring pairs', g.mentors ?? [], when)) {
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


/** How many problems have been reported so far, across every scenario. */
export function failCount(): number { return fails }

/**
 * ---- DOES THE CHECKER STILL BITE? ----
 *
 * A harness whose checker has quietly stopped checking passes everything, and a
 * clean run looks identical either way. This breaks the world on purpose, asks
 * whether checkWorld noticed, then puts it back and forgets the deliberate
 * failure - so a green run means "nothing is wrong", not "nothing is looking".
 *
 * It is the same lesson as the double-tap test that passed with its guard
 * removed: a test that cannot fail is not evidence.
 */
export function checkerBites(g: GameState, label: string, breakIt: () => void, undo: () => void): boolean {
  const before = fails
  quiet = true
  try {
    breakIt()
    checkWorld(g, `canary ${label}`, true)
  } finally {
    try { undo() } catch { /* the world is a copy in the caller's hands */ }
    quiet = false
  }
  const caught = fails > before
  // the break was ours: it is not a defect in the game
  fails = before
  return caught
}
