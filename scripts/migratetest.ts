// Simulate an old save missing natl1/jl1 and verify migrate injects them
// and restores the pid counter.
import { newGame } from '../src/game/newgame'
import { migrate } from '../src/game/save'
import { resetIds, nextPid } from '../src/game/attributes'
import { processWeekAndAdvance } from '../src/game/season'
import { playbookOf } from '../src/game/playbook'
import { RETIRED_NAMES_KEPT, worldNames } from '../src/game/nations'
import { CAREER_ROWS, archiveSeason, careerRows } from '../src/game/model'

const g = newGame('leicester', 'Test', 4242)
// strip natl1 + jl1 as if the save predates them
for (const c of Object.values(g.clubs)) {
  if (c.leagueId === 'natl1' || c.leagueId === 'jl1') {
    for (const id of c.players) delete g.players[id]
    delete g.clubs[c.id]
  }
}
delete g.comps['natl1']; delete g.comps['jl1']
g.fixtures = g.fixtures.filter(f => f.compId !== 'natl1' && f.compId !== 'jl1')
const before = Object.keys(g.clubs).length

// simulate a cold session: id counter back to 1 (the latent bug)
resetIds(1)
const old = JSON.parse(JSON.stringify(g))
const m = migrate(old)

const after = Object.keys(m.clubs).length
console.log(`clubs ${before} -> ${after} (expect +24)`) 
if (after - before !== 24) { console.error('BUG: injection count wrong'); process.exit(1) }
const ross = m.clubs['rosslyn']
console.log(`rosslyn squad: ${ross.players.length}, XV set: ${ross.tactic.lineup.slice(0,15).every(x => x != null)}`)
// A club the migration invents needs an academy too (feedback 10G): the first cut
// stamped the academy top-up per SAVE, so the 24 clubs injected here came into the
// world with no scholars at all and no way to field an A League side.
const rossAcad = ross.players.filter(id => m.players[id]?.acad).length
console.log(`rosslyn academy: ${rossAcad} scholars`)
if (rossAcad < 27) { console.error('BUG: an injected club got no academy'); process.exit(1) }
if (!m.academy?.fixtures.length) { console.error('BUG: no A League after migration'); process.exit(1) }
console.log(`A League after migration: ${m.academy.name}, ${m.academy.fixtures.length} fixtures`)
// pid counter must be above every existing id
const maxId = Object.keys(m.players).reduce((x, k) => Math.max(x, Number(k)), 0)
const fresh = nextPid()
console.log(`max pid ${maxId}, next pid ${fresh}`)
if (fresh <= maxId) { console.error('BUG: pid counter collision'); process.exit(1) }
// no player id collisions: every club's roster maps to a live player of that club
let orphans = 0
for (const c of Object.values(m.clubs)) for (const id of c.players) {
  const p = m.players[id]
  if (!p || p.clubId !== c.id) orphans++
}
console.log(`roster integrity: ${orphans} orphans`)
if (orphans) process.exit(1)
// the match evidence (1.8.3) is optional: a loop from before it loads with
// none, and is read as none; a mangled list is dropped, not loaded
{
  const pre = JSON.parse(JSON.stringify(m))
  pre.tacLoop = { findings: [] }
  const a = migrate(pre)
  console.log(`evidence on a pre-1.8.3 loop: ${JSON.stringify(a.tacLoop?.evidence)}`)
  if (a.tacLoop?.evidence !== undefined) { console.error('BUG: an absent evidence list was invented'); process.exit(1) }
  const bad = JSON.parse(JSON.stringify(m))
  bad.tacLoop = { findings: [], evidence: { not: 'a list' } }
  if (migrate(bad).tacLoop?.evidence !== undefined) { console.error('BUG: a mangled evidence list was kept'); process.exit(1) }
}
// THE LAST MEETING WITH EACH SIDE (1.8.4): an older save's lists, six or
// fewer, keep every record; homework from before it was set on every match
// loads as it was, and homework that cannot be read is dropped
{
  const pre = JSON.parse(JSON.stringify(m))
  const rec = (i: number) => ({ fxId: i, season: m.season, week: i, oppId: `o${i}`, us: 1, them: 0, items: [] })
  pre.tacLoop = { findings: [1, 2, 3, 4, 5, 6].map(rec) }
  pre.fixHw = { fxId: 6, season: m.season, week: 6, tags: ['discipline'] }
  const a = migrate(pre)
  console.log(`a six-record loop after migration: ${a.tacLoop?.findings.map(f => f.fxId).join(',')}; homework ${JSON.stringify(a.fixHw?.tags)}`)
  if (a.tacLoop?.findings.length !== 6 || a.fixHw?.tags[0] !== 'discipline') { console.error('BUG: an older loop or its homework was changed'); process.exit(1) }
  const bad = JSON.parse(JSON.stringify(m))
  bad.fixHw = { fxId: 'x', tags: 'none' }
  if (migrate(bad).fixHw !== undefined) { console.error('BUG: unreadable homework was kept'); process.exit(1) }
}
// THE NAME REGISTRY'S MEMORY (1.8.3): a save that kept every departed name
// keeps the newest RETIRED_NAMES_KEPT, each once, in the order written; a
// list inside the cap is left exactly as it was
{
  const pre = JSON.parse(JSON.stringify(m))
  pre.retiredNames = Array.from({ length: RETIRED_NAMES_KEPT + 2500 }, (_, i) => `retired man ${i}`)
  pre.retiredNames.push('retired man 7000', 42)
  const was = pre.retiredNames.length
  const a = migrate(pre)
  const r = a.retiredNames ?? []
  console.log(`retiredNames: ${was} -> ${r.length}, newest ${r[r.length - 1]}`)
  if (r.length !== RETIRED_NAMES_KEPT || new Set(r).size !== r.length || r[r.length - 1] !== 'retired man 7000' || r.some(n => typeof n !== 'string')) {
    console.error('BUG: an old retiredNames list was not trimmed to the newest, each once'); process.exit(1)
  }
  if (r.includes('retired man 0') || !r.includes(`retired man ${RETIRED_NAMES_KEPT + 2499}`)) { console.error('BUG: the trim kept the oldest names'); process.exit(1) }
  const small = JSON.parse(JSON.stringify(m))
  small.retiredNames = ['a b', 'c d']
  if (JSON.stringify(migrate(small).retiredNames) !== '["a b","c d"]') { console.error('BUG: a list inside the cap was changed'); process.exit(1) }
  // and a migrated save rebuilds the registry from the trimmed list: an old
  // name is free again, a recent one is still taken
  const taken = worldNames(a)
  if (!taken.has('retired man 7000') || taken.has('retired man 0')) { console.error('BUG: the registry does not match the trimmed list'); process.exit(1) }
}
// THE FOLDED SEASONS (1.8.3): careerOld is optional and absent on an old
// save; a mangled one is dropped or filtered, a career longer than the table
// is folded into it, and no appearance is lost on the way
{
  const pre = JSON.parse(JSON.stringify(m))
  const ids = Object.keys(pre.players)
  const long = pre.players[ids[0]]
  long.career = Array.from({ length: 24 }, (_, i) => ({ season: i - 30, clubId: i < 6 ? 'bath' : 'leicester', apps: 20, tries: 2, points: 10 }))
  long.careerOld = undefined
  const bad = pre.players[ids[1]]
  bad.careerOld = [{ season: 0, clubId: 'bath', apps: 'x', tries: 0, points: 0 }, null, { season: -40, clubId: 'bath', apps: 5, tries: 1, points: 5 }]
  const worse = pre.players[ids[2]]
  worse.careerOld = { not: 'a list' }
  const a = migrate(pre)
  const L = a.players[Number(ids[0])], B = a.players[Number(ids[1])], W = a.players[Number(ids[2])]
  const apps = careerRows(L).reduce((n, c) => n + c.apps, 0)
  console.log(`long career: ${L.career.length} rows + ${L.careerOld?.length ?? 0} folded, ${apps} apps`)
  if (L.career.length !== CAREER_ROWS || apps !== 24 * 20 || L.careerOld?.length !== 1 || L.careerOld[0].apps !== 4 * 20 || L.careerOld[0].clubId !== 'bath') {
    console.error('BUG: a long career lost seasons in the fold'); process.exit(1)
  }
  if (B.careerOld?.length !== 1 || B.careerOld[0].apps !== 5) { console.error('BUG: a damaged folded row was kept'); process.exit(1) }
  if (W.careerOld !== undefined) { console.error('BUG: a careerOld that is not a list was kept'); process.exit(1) }
  if (Object.values(a.players).some(p => p.careerOld !== undefined && !Array.isArray(p.careerOld))) { console.error('BUG: careerOld invented'); process.exit(1) }
  // the summer folds the same way: the table stays at CAREER_ROWS, the totals do not shrink
  const p = { career: [...L.career], careerOld: L.careerOld?.map(r => ({ ...r })) }
  archiveSeason(p, { season: 1, clubId: 'leicester', apps: 7, tries: 1, points: 5 })
  const after = careerRows(p).reduce((n, c) => n + c.apps, 0)
  if (p.career.length !== CAREER_ROWS || after !== apps + 7) { console.error('BUG: the summer fold lost appearances'); process.exit(1) }
}
// a 1.8.2 playbook's wear (whole counts that only the summer cleared) carries
// on under 1.8.3's, which fades a call left out (armsrace.ts THE WEAR)
const pb = playbookOf(m.clubs[m.userClubId])
pb.used = { ...pb.used, mv_loop: 9, mv_switch: 6 }
m.clubs[m.userClubId].tactic.moveMain = 'mv_loop'
// season still simulates
for (let i = 0; i < 3; i++) processWeekAndAdvance(m)
console.log('3 weeks simulated post-migration OK')
const wear = playbookOf(m.clubs[m.userClubId]).used
console.log(`old wear after 3 weeks: loop ${wear.mv_loop?.toFixed(2)}, switch (shelved) ${wear.mv_switch?.toFixed(2)}`)
if (!(wear.mv_loop >= 9 && wear.mv_switch < 6 && Object.values(wear).every(v => Number.isFinite(v) && v >= 0))) { console.error('BUG: an old playbook\'s wear does not carry on'); process.exit(1) }
console.log('MIGRATE TEST PASSED')
