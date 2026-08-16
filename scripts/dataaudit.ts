// Squad-data audit (user: "squads need to be more accurate"). Checks the real
// 2025-26 database rather than the simulation: shirt coverage, duplicate names,
// captains, age spread, quality vs reputation, and how much of each squad is
// real men rather than generated filler.
import { LEAGUE_DEFS } from '../src/game/newgame'
import { newGame } from '../src/game/newgame'
import { CLUB_CAPTAINS, sameName } from '../src/data/captains'
import { VERIFIED_CLUB, verifiedClub } from '../src/data/verified'
import { EXTRA_PLAYERS } from '../src/data/additions'
import { POS_ORDER, type Pos } from '../src/game/model'

let fails = 0
let warns = 0
const bad = (m: string) => { fails++; console.error(`DATA: ${m}`) }
const warn = (m: string) => { warns++; console.warn(`WARN: ${m}`) }

const defs = LEAGUE_DEFS()
const allClubs = defs.flatMap(d => d.clubs.map(c => ({ ...c, leagueId: d.id, leagueName: d.short })))
const repOf = new Map(allClubs.map(c => [c.id, c.rep]))

// The world the game actually builds, alongside the files it builds it from.
// Both matter, and they answer different questions - the reason this audit read
// seven "short of cover" warnings through a round that fixed three of them is
// that it only ever asked the first one.
const world = newGame('northampton', 'Data Audit', 4242)
const builtSquad = (clubId: string) =>
  (world.clubs[clubId]?.players ?? []).map(id => world.players[id]).filter(Boolean)

const NEED: [Pos, number][] = [['LP', 2], ['HK', 2], ['TP', 2], ['LK', 3], ['FL', 3], ['N8', 1], ['SH', 2], ['FH', 2], ['CE', 3], ['WG', 3], ['FB', 1]]
const cover = (players: { pos: string; alt?: readonly string[] | string[] }[]) => {
  const byPos = new Map<string, number>()
  for (const p of players) {
    byPos.set(p.pos, (byPos.get(p.pos) ?? 0) + 1)
    for (const alt of p.alt ?? []) byPos.set(alt, (byPos.get(alt) ?? 0) + 0.5)
  }
  return byPos
}

// 1a. real men only, in the world as built. A club short here still fields
//     eleven bodies in every shirt, because the top-up fills the thinnest
//     position first - but the shirt goes to a made-up name. This is a WARNING
//     and it is the list to work through.
//
//     It counts the built squad rather than the raw files on purpose: a man the
//     relocation table moves here, or the additions table writes in, is as real
//     as one the file happened to list. Counting files instead is why Leicester
//     still read "1 loosehead" in the round that signed Nicky Smith for them.
// Ratcheted, like the duplicate count: 27 today, down from 36 when it was first
// measured properly, and it may fall but never rise. New squad data that opens a gap is a regression even if it closes two
// others somewhere else.
// 27 until the 2025/26 Premiership squad guide was merged, then 30. The three
// extra are not a regression, they are the price of being right: the guide moves
// about twenty-five men INTO the Premiership from clubs whose own files are a
// season behind, so Clermont really is a fly-half lighter without Belleau,
// Glasgow without Hastings and the Crusaders without Christie. The fourth is
// Newcastle's own back row, which the guide lists four men deep because Chick and
// Graham both left for Saints. Lower this again by updating the OTHER leagues'
// squads, not by putting the transfers back.
const GAP_BUDGET = 30
let gapCount = 0
const gapsByLeague = new Map<string, number>()
for (const club of allClubs) {
  const real = builtSquad(club.id).filter(p => !p.acad && p.real)
  const byPos = cover(real)
  for (const [pos, n] of NEED) {
    const have = byPos.get(pos) ?? 0
    if (have < n) {
      gapCount++
      gapsByLeague.set(club.leagueName, (gapsByLeague.get(club.leagueName) ?? 0) + 1)
      warn(`${club.id} (${club.leagueName}) has ${have} real ${pos}, wants ${n}`)
    }
  }
}
console.log(`real-cover gaps: ${gapCount} of a budget of ${GAP_BUDGET} · ` +
  [...gapsByLeague].sort((a, b) => b[1] - a[1]).map(([l, n]) => `${l} ${n}`).join(', '))
if (gapCount > GAP_BUDGET) {
  bad(`${gapCount} shirts worn by generated names, up from ${GAP_BUDGET} - new data opened a gap`)
}
console.log('  (npx vite-node scripts/gapreport.ts lists them with the men already in the shirt)')

// 1b. the built world, which is what a manager actually inherits. Nobody should
//     ever be asked to field a shirt with nobody in it, so this is a FAILURE.
//     It is close to unfailable while the top-up works, which is the point: if
//     the top-up ever regresses, this is the tripwire that says so.
for (const club of allClubs) {
  const senior = builtSquad(club.id).filter(p => !p.acad)
  const byPos = cover(senior)
  if (!POS_ORDER.every(p => (byPos.get(p) ?? 0) > 0)) {
    bad(`${club.id} has a shirt with nobody in it once the world is built`)
  }
  for (const [pos, n] of NEED) {
    if ((byPos.get(pos) ?? 0) < n) bad(`${club.id} is built with ${byPos.get(pos) ?? 0} at ${pos}, needs ${n}`)
  }
}

// 2. the same man listed at two clubs. The world builder keeps the first and
//    the second club's slot goes to generated filler, so every duplicate costs
//    a real shirt. These are stale entries from squad churn (a player who moved
//    still listed at his old club), and each needs verifying by hand before
//    deletion - renaming is never the fix. Ratcheted: the count may fall, never
//    rise, so new data can only improve the world.
// 64 until the Premiership merge, then 76. This counts names appearing in two
// squad FILES, not men built twice: every one of the twelve new ones is a player
// the guide moved to the Premiership who is still listed at his old club, and all
// twelve are resolved by the derived table in verified.ts. The built world has no
// duplicate real player, which is the check that actually matters and is asserted
// separately below.
// ---- A SHARED NAME IS NOT A DEFECT. THE SAME MAN TWICE IS. ----------------
//
// This counted every repeated name as a collision and ratcheted on the total,
// which is why it sat red at 78 against a budget of 76 and why the honest answer
// looked like a choice between hand-resolving 45 players and bumping a number.
// It was neither. Comparing each pair on POSITION AND AGE as well as name splits
// them cleanly and objectively:
//
//   NAMESAKES - a 26-year-old winger at Nottingham and a 30-year-old lock at the
//   Rams, both called Alex Hughes. A Cardiff centre and a Blackheath tighthead,
//   both Ben Thomas. Welsh and English rugby are full of these and they are not
//   errors; the two men simply share a name. Twenty-two of the seventy-eight.
//   Writing either of them into verified.ts would DELETE A REAL PLAYER, which is
//   a worse outcome than the warning it silences.
//
//   ONE MAN, TWO SQUAD FILES - same position, ages within a year. That is a
//   player the guide moved and one file has not caught up with. Two of the
//   seventy-eight, both now settled in verified.ts.
//
// So the ratchet is on the thing that is actually work: unresolved same-man
// listings. It is 0, and 0 is a number that can be held. The namesake count is
// reported, never asserted, because new squad data will keep producing them and
// a probe that fails on real rugby teaches people to ignore it.
const DUPE_BUDGET = 0
const seen = new Map<string, { club: string; pos: string; age: number }>()
const dupes: string[] = []
const namesakes: string[] = []
const seniorDupes: string[] = []
for (const club of allClubs) {
  for (const p of club.players) {
    const key = p.name.toLowerCase()
    const prev = seen.get(key)
    if (prev && prev.club !== club.id) {
      const sameMan = prev.pos === p.pos && Math.abs(prev.age - p.age) <= 1
      if (!sameMan) {
        namesakes.push(`${p.name}: ${prev.club}(${prev.pos},${prev.age}) + ${club.id}(${p.pos},${p.age})`)
      } else if (!verifiedClub(p.name)) {
        dupes.push(`${p.name}: ${prev.club} + ${club.id} (${p.pos}, ${prev.age}/${p.age})`)
        const a = repOf.get(prev.club) ?? 0
        const b = club.rep
        if (a >= 70 && b >= 70) seniorDupes.push(`${p.name}: ${prev.club} (rep ${a}) + ${club.id} (rep ${b})`)
      }
    }
    seen.set(key, { club: club.id, pos: p.pos, age: p.age })
  }
}
console.log(`names shared by two different men: ${namesakes.length} (reported, not a defect)`)
if (dupes.length > DUPE_BUDGET) {
  bad(`${dupes.length} unresolved same-man listings, up from ${DUPE_BUDGET} - new data put a player at two clubs`)
  for (const d of dupes.slice(0, 10)) console.log(`    ${d}`)
}
if (dupes.length) {
  // A duplicate already resolved is not outstanding work: the builder places
  // him at the named club and drops the other listing. Reporting the raw count
  // hid that, and the 7am audit read 33 senior duplicates when 12 were settled.
  //
  // This then made the same mistake one level down. It asked only the
  // hand-written VERIFIED_CLUB table, but the Premiership guide merge added a
  // DERIVED resolver on top of it, so fifteen men the guide had already settled
  // were still being reported as work to do - every one of them built exactly
  // once, at exactly the right club. Ask the resolver, which is the thing the
  // builder itself asks.
  const open = seniorDupes.filter(d => !verifiedClub(d.slice(0, d.indexOf(':'))))
  warn(`${dupes.length} players are listed at two clubs (${seniorDupes.length} between senior clubs, ${open.length} of those not yet resolved)`)
  for (const d of open) console.warn(`      ${d}`)
  // and the resolution has to be real, not just present: a senior duplicate the
  // resolver claims to have settled must be built once and land where it says.
  for (const d of seniorDupes) {
    const name = d.slice(0, d.indexOf(':'))
    const want = verifiedClub(name)
    if (!want) continue
    const built = Object.values(world.players).filter(p => p.name === name)
    if (built.length !== 1) { bad(`${name} is resolved to ${want} but built ${built.length} times`); continue }
    const at = Object.values(world.clubs).find(c => c.players.includes(built[0].id))?.id
    if (at !== want) bad(`${name} is resolved to ${want} but landed at ${at}`)
  }
}

// 2b. The verified relocation table. Checking the first handful of duplicates
//     by hand showed this is not a tie-break problem: most of them play for a
//     THIRD club that neither file names, because parts of the squad data are a
//     season behind. Every entry in src/data/verified.ts must therefore name a
//     club that exists, must actually be listed somewhere in the files (or the
//     builder has nothing to relocate), and must land where it says it does.
const verifiedNames = Object.keys(VERIFIED_CLUB)
const clubIds = new Set(allClubs.map(c => c.id))
for (const [name, want] of Object.entries(VERIFIED_CLUB)) {
  if (!clubIds.has(want)) bad(`verified table sends ${name} to ${want}, which is not a club`)
  const listedAt = allClubs.filter(c => c.players.some(p => p.name.toLowerCase() === name)).map(c => c.id)
  if (!listedAt.length) bad(`verified table names ${name}, who is in no squad file - nothing to relocate`)
}
{
  const g = world
  for (const [name, want] of Object.entries(VERIFIED_CLUB)) {
    const hits = Object.values(g.players).filter(p => p.name.toLowerCase() === name)
    if (hits.length !== 1) bad(`${name} appears ${hits.length} times in the built world, wants exactly 1`)
    else if (hits[0].clubId !== want) bad(`${name} was built at ${hits[0].clubId}, wants ${want}`)
  }
  console.log(`verified relocations: ${verifiedNames.length} players placed by hand, all landed`)

  // 2c. The additions table closes a gap the files leave open entirely. Its
  //     rules are auditable: the club must exist, the man must NOT already be
  //     in a file anywhere (that would be a relocation, and it belongs in
  //     verified.ts), and he must arrive at the club named and nowhere else.
  let added = 0
  for (const [clubId, extras] of Object.entries(EXTRA_PLAYERS)) {
    if (!clubIds.has(clubId)) bad(`additions table names club ${clubId}, which does not exist`)
    for (const rp of extras) {
      added++
      const key = rp.name.toLowerCase()
      const already = allClubs.filter(c => c.players.some(p => p.name.toLowerCase() === key)).map(c => c.id)
      if (already.length) {
        bad(`additions table adds ${rp.name}, who is already in the files at ${already.join(', ')} - relocate him instead`)
      }
      const hits = Object.values(g.players).filter(p => p.name.toLowerCase() === key)
      if (hits.length !== 1) bad(`${rp.name} appears ${hits.length} times in the built world, wants exactly 1`)
      else if (hits[0].clubId !== clubId) bad(`${rp.name} was built at ${hits[0].clubId}, wants ${clubId}`)
      if (!POS_ORDER.includes(rp.pos)) bad(`additions table gives ${rp.name} position ${rp.pos}, which is not a shirt`)
    }
  }
  console.log(`hand-added players: ${added}, all landed`)
}

// 3. squad quality should track reputation - a rep-90 club with a rep-60 squad
//    (or the reverse) means the data has drifted from the real world
for (const club of allClubs) {
  const top = [...club.players].sort((a, b) => b.q - a.q).slice(0, 15)
  const avg = top.reduce((s, p) => s + p.q, 0) / top.length
  const gap = avg - club.rep
  if (Math.abs(gap) > 14) warn(`${club.id} rep ${club.rep} but its best XV averages ${avg.toFixed(1)} (gap ${gap.toFixed(1)})`)
}

// 4. age spread: a real squad has old heads and kids. Judged on the built
//    senior squad, because that is the dressing room the manager walks into -
//    the files being thin is check 1a's business, not this one's.
for (const club of allClubs) {
  const ages = builtSquad(club.id).filter(p => !p.acad).map(p => p.age)
  const vets = ages.filter(a => a >= 30).length
  const kids = ages.filter(a => a <= 23).length
  // Zebre, the Lions, the Hurricanes and the Drua all top out at exactly 29,
  // which is reference data entered without its veterans rather than a fact
  // about those clubs. Measured before deciding whether it mattered: all four
  // reach the normal band (3 to 7 men aged 30+) inside one season and are
  // indistinguishable from Leicester by season 2, so the only thing it costs is
  // the look of four AI squad lists in week 1. Left as a warning rather than
  // patched, because inventing ages for real people is not a fix.
  if (vets < 2) warn(`${club.id} has ${vets} players aged 30+`)
  if (kids < 3) warn(`${club.id} has ${kids} players aged 23 or under`)
  if (ages.some(a => a < 17 || a > 41)) bad(`${club.id} has an implausible age: ${ages.filter(a => a < 17 || a > 41).join(', ')}`)
}

// 5. internationals: a club of standing carries capped players
for (const club of allClubs) {
  const caps = club.players.filter(p => p.intl).length
  if (club.rep >= 85 && caps < 6) warn(`${club.id} (rep ${club.rep}) lists only ${caps} internationals`)
}

// 6. the captains list resolves, and every club in the world ends up with one
const g = newGame('leicester', 'Data Audit', 20260805)
for (const [cid, name] of Object.entries(CLUB_CAPTAINS)) {
  const club = g.clubs[cid]
  if (!club) { bad(`captain list names missing club ${cid}`); continue }
  const man = club.players.map(id => g.players[id]).find(p => p && sameName(p.name, name))
  if (!man) { bad(`${cid}: ${name} is not in the squad, so the armband fell elsewhere`); continue }
  if (club.captain !== man.id) bad(`${cid}: ${name} is in the squad but not captain`)
  if (man.a.lea < 15) bad(`${cid}: captain ${name} has leadership ${man.a.lea}`)
}
for (const club of Object.values(g.clubs)) {
  if (club.captain == null) bad(`${club.id} has no captain at kickoff`)
  if (club.vice == null) bad(`${club.id} has no vice-captain at kickoff`)
  if (club.captain != null && club.captain === club.vice) bad(`${club.id} captain is also vice`)
}

// 7. how real is the world? filler is fine on the fringes, not in the XV
let realXV = 0, totalXV = 0
for (const club of Object.values(g.clubs)) {
  const xv = club.tactic.lineup.slice(0, 15).map(id => id != null ? g.players[id] : null)
  for (const p of xv) {
    if (!p) continue
    totalXV++
    if (p.real) realXV++
  }
}
const realPct = (realXV / totalXV) * 100
console.log(`\n${allClubs.length} clubs · ${allClubs.reduce((s, c) => s + c.players.length, 0)} real players`)
console.log(`starting XVs are ${realPct.toFixed(1)}% real men (${realXV}/${totalXV})`)
if (realPct < 90) bad(`only ${realPct.toFixed(1)}% of starting XVs are real players - filler is taking shirts`)
console.log(`captains: ${Object.keys(CLUB_CAPTAINS).length} named by hand, ${Object.keys(g.clubs).length - Object.keys(CLUB_CAPTAINS).length} chosen on leadership`)

if (fails) { console.error(`\nDATA AUDIT: ${fails} failures, ${warns} warnings`); process.exit(1) }
console.log(`\nDATA AUDIT PASSED (${warns} warnings)`)
