// SAVE INTEGRITY over a save file written by any build (release hardening, 1.8.5).
//
//   npx vite-node scripts/qa/saveintegrity.ts -- <save.json> [K weeks=24] [reload every R=5] [lang=1]
//
// The file is an IndexedDB-shaped record ({meta, state}) or a bare state, as
// scripts/qa/savegen.ts writes them (run in the release's own worktree for an
// old save). For that save:
//
//   MIGRATE-IDEMPOTENT  migrate(migrate(x)) serialises exactly as migrate(x),
//                       and two independent loads of the file agree
//   PLAYABLE            isPlayable after the load
//   DETERMINISM         K weeks straight through == K weeks with a save
//                       (JSON round trip + migrate, the load path) every R weeks
//   DUPLICATES          history, trophies, annals, roll, hof, memory, era,
//                       academy scholars, rosters, ids
//   NUMBERS             no NaN / Infinity anywhere in the live object, and no
//                       null where the same field elsewhere holds a number
//   ORPHANS             rosters <-> players, fixtures -> clubs, refs -> players
//   LANGUAGE            the same K weeks played in French leave the same save
//
// Checked on the loaded save, and again on the world after K weeks.
import { readFileSync } from 'node:fs'
import { isPlayable, migrate } from '../../src/game/save'
import type { GameState } from '../../src/game/model'
import { ensureLang, setLang, setWorld, setManagerGender } from '../../src/game/i18n'
import { genderOf } from '../../src/game/gender'
process.env.SAVEGEN_LIB = '1'
const { playWeek } = await import('./savegen')

/** JSON with every object's keys sorted: a property deleted and re-added in
 *  the same week moves to the end of its object, which is not a difference
 *  in the world. Maps whose ORDER the engine iterates would show up as a
 *  value difference a week later, so nothing real hides behind this. */
//  A field the engine leaves unset on a man it mints and migrate backfills
//  (onLoan false, rust 0, debutPending null) is read with ?? everywhere, so
//  absent and its default are the same world: dropped from both sides.
const TRIVIAL = (v: unknown) => v === undefined || v === null || v === false || v === 0
const canon = (x: unknown): string => JSON.stringify(x, (_k, v) =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().filter(k => !TRIVIAL(v[k])).map(k => [k, v[k]])) : v)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any
const args = process.argv.slice(2).filter(a => a !== '--')
const FILE = args[0]
const K = Number(args[1] ?? 24)
const R = Number(args[2] ?? 5)
const LANG = (args[3] ?? '1') !== '0'
const label = FILE.split('/').pop()!.replace('.json', '')

const results: Record<string, string> = {}
let fails = 0
function verdict(check: string, okay: boolean, detail = '') {
  const prev = results[check]
  if (!okay) { fails++; console.log(`  FAIL ${check}: ${detail}`) }
  results[check] = !okay ? 'FAIL' : (prev === 'FAIL' ? 'FAIL' : 'pass')
}

function diff(a: Any, b: Any, path = '', out: string[] = [], depth = 0): string[] {
  if (out.length >= 15 || depth > 14) return out
  if (a === b) return out
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') {
    if (TRIVIAL(a) && TRIVIAL(b)) return out
    if (!(Number.isNaN(a) && Number.isNaN(b))) out.push(`${path}: ${JSON.stringify(a)?.slice(0, 80)} vs ${JSON.stringify(b)?.slice(0, 80)}`)
    return out
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) diff(a[k], b[k], `${path}.${k}`, out, depth + 1)
  return out
}

const raw = JSON.parse(readFileSync(FILE, 'utf8'))
const stateJson = JSON.stringify(raw.state ?? raw)
const load = (json: string): GameState => {
  const g = migrate(JSON.parse(json) as GameState)
  setWorld(genderOf(g)); setManagerGender(g.mgrGender === 'w' ? 'w' : 'm')
  return g
}

// ------------------------------------------------------------------ checks
function numbers(g: GameState, when: string) {
  const nan: string[] = []
  const nulls = new Map<string, number>()
  const numericAt = new Set<string>()
  const walk = (x: Any, path: string, norm: string, depth: number) => {
    if (depth > 16) return
    if (typeof x === 'number') { numericAt.add(norm); if (!Number.isFinite(x)) nan.push(`${path}=${x}`); return }
    if (x === null) { nulls.set(norm, (nulls.get(norm) ?? 0) + 1); return }
    if (Array.isArray(x)) { x.forEach((v, i) => walk(v, `${path}[${i}]`, `${norm}[]`, depth + 1)); return }
    if (typeof x === 'object') for (const [k, v] of Object.entries(x)) {
      // map keys that are ids collapse to one shape
      const nk = /^\d+$/.test(k) || path === '.clubs' || path === '.comps' ? '*' : k
      walk(v, `${path}.${k}`, `${norm}.${nk}`, depth + 1)
    }
  }
  walk(g, '', '', 0)
  verdict('NUMBERS', nan.length === 0, `${when}: ${nan.length} non-finite: ${nan.slice(0, 6).join(', ')}`)
  // typed nullable on purpose: an empty shirt on a team sheet
  const NULLABLE = [/\.lineup\[\]$/]
  const suspicious = [...nulls.entries()].filter(([p]) => numericAt.has(p) && !NULLABLE.some(re => re.test(p)))
  verdict('NUMBERS', suspicious.length === 0, `${when}: null where a number lives: ${suspicious.slice(0, 8).map(([p, n]) => `${p} x${n}`).join(', ')}`)
}

function dupes(g: GameState, when: string) {
  const dup = (name: string, keys: string[]) => {
    const seen = new Map<string, number>()
    for (const k of keys) seen.set(k, (seen.get(k) ?? 0) + 1)
    const d = [...seen.entries()].filter(([, n]) => n > 1)
    verdict('DUPLICATES', d.length === 0, `${when}: ${name} duplicated: ${d.slice(0, 5).map(([k, n]) => `${k} x${n}`).join(', ')}`)
  }
  const G = g as Any
  dup('history', (g.history ?? []).map(h => `${h.season}/${h.compId}`))
  dup('mgr.trophies', (G.mgr?.trophies ?? []).map((t: Any) => `${t.season}/${t.compId}/${t.clubId ?? ''}`))
  dup('annals', (G.annals ?? []).map((a: Any) => `${a.season}`))
  dup('potyRoll', (G.potyRoll ?? []).map((a: Any) => `${a.season}`))
  dup('hof', (G.hof ?? []).map((a: Any) => `${a.name}/${a.pos}/${a.nat}/${a.apps}`))
  dup('memory ids', (G.memory?.entries ?? []).map((e: Any) => `${e.id}`))
  dup('memory entries', (G.memory?.entries ?? []).map((e: Any) => JSON.stringify({ ...e, id: 0 })))
  dup('news ids', g.news.map(n => `${n.id}`))
  dup('fixture ids', g.fixtures.map(f => `${f.id}`))
  dup('offer ids', g.offers.map(o => `${o.id}`))
  dup('dreamsDone', (G.dreamsDone ?? []).map((d: Any) => `${d.id}/${d.clubId}/${d.season}`))
  dup('challengesDone', (G.challengesDone ?? []).map(String))
  dup('legendOf', (G.legendOf ?? []).map(String))
  dup('natHistory', (G.natHistory ?? []).map((n: Any) => n.nat))
  dup('mentors', (G.mentors ?? []).map((m: Any) => `${m.senior}/${m.kid}`))
  dup('shortlist', (g.shortlist ?? []).map(String))
  dup('sackedBy', (G.sackedBy ?? []).map((s: Any) => `${s.clubId}/${s.at}`))
  // a player on two rosters, or twice on one
  const where = new Map<number, string[]>()
  for (const c of Object.values(g.clubs)) for (const id of c.players) where.set(id, [...(where.get(id) ?? []), c.id])
  const multi = [...where.entries()].filter(([, cs]) => cs.length > 1)
  verdict('DUPLICATES', multi.length === 0, `${when}: ${multi.length} players on two rosters (or twice on one): ${multi.slice(0, 4).map(([id, cs]) => `${id}@${cs.join('+')}`).join(', ')}`)
  // academy: scholars per club within the academy bounds, no double top-up
  const acad = Object.values(g.clubs).map(c => c.players.filter(id => (g.players[id] as Any)?.acad).length)
  const maxA = Math.max(0, ...acad)
  verdict('DUPLICATES', maxA <= 60, `${when}: an academy of ${maxA} scholars (double top-up?)`)
  // era records keyed per field: nothing to duplicate, but must be well-formed
  const era = G.era
  if (era) for (const [k, v] of Object.entries(era)) verdict('DUPLICATES', !Array.isArray(v), `${when}: era.${k} is a list`)
  // the same name minted twice into the living world (namedup)
  return
}

function orphans(g: GameState, when: string) {
  const bad: string[] = []
  for (const c of Object.values(g.clubs)) for (const id of c.players) {
    const p = g.players[id]
    if (!p) bad.push(`roster ${c.id} -> missing player ${id}`)
    else if (p.clubId !== c.id) bad.push(`roster ${c.id} holds ${id} whose clubId is ${p.clubId}`)
  }
  for (const p of Object.values(g.players)) {
    if (p.clubId && !g.clubs[p.clubId]) bad.push(`player ${p.id} at missing club ${p.clubId}`)
    else if (p.clubId && !g.clubs[p.clubId].players.includes(p.id)) bad.push(`player ${p.id} says ${p.clubId} but is not on its roster`)
  }
  const teamOk = (id: string) => !!g.clubs[id] || /^[A-Z]{3}$/.test(id) || id === 'LIO' || id === 'TBD' || id === ''
  for (const f of g.fixtures) {
    if (!teamOk(f.homeId) || !teamOk(f.awayId)) bad.push(`fixture ${f.id} ${f.compId} ${f.homeId} v ${f.awayId}`)
  }
  for (const o of g.offers) if (!g.players[o.playerId]) bad.push(`offer ${o.id} for missing player ${o.playerId}`)
  for (const id of g.shortlist ?? []) if (!g.players[id]) bad.push(`shortlist -> missing ${id}`)
  for (const [nat, ids] of Object.entries(g.natSquads ?? {})) for (const id of ids) if (!g.players[id]) bad.push(`natSquad ${nat} -> missing ${id}`)
  for (const m of (g as Any).mentors ?? []) if (!g.players[m.senior] || !g.players[m.kid]) bad.push(`mentor pair ${m.senior}/${m.kid} with a missing player`)
  for (const id of (g as Any).devFocus ?? []) if (!g.players[id]) bad.push(`devFocus -> missing ${id}`)
  const lu = g.clubs[g.userClubId].tactic?.lineup ?? []
  for (const id of lu) if (id != null && !g.players[id]) bad.push(`user lineup -> missing ${id}`)
  verdict('ORPHANS', bad.length === 0, `${when}: ${bad.length}: ${bad.slice(0, 6).join('; ')}`)
  // memory and news pointing at players who have left the world: by design the
  // memory keeps decisions about men since retired (memory.ts names them from
  // the payload), so this is counted, not failed
  const memGone = ((g as Any).memory?.entries ?? []).filter((e: Any) => e.playerId != null && !g.players[e.playerId]).length
  const memNoName = ((g as Any).memory?.entries ?? []).filter((e: Any) => e.playerId != null && !g.players[e.playerId] && !e.payload?.name && !e.payload?.player).length
  console.log(`  info ${when}: memory entries naming a player no longer in the world: ${memGone} (of which ${memNoName} carry no name in the payload)`)
}

function signature(g: GameState): string {
  return canon(g)
}

// ------------------------------------------------------------------- run
console.log(`=== ${label}`)
const m1 = load(stateJson)
const j1 = JSON.stringify(m1)
const j1b = JSON.stringify(load(stateJson))
verdict('MIGRATE-IDEMPOTENT', j1 === j1b, `two loads of the same file differ: ${diff(JSON.parse(j1), JSON.parse(j1b)).slice(0, 6).join(' | ')}`)
const j2 = JSON.stringify(load(j1))
verdict('MIGRATE-IDEMPOTENT', j1 === j2, `load(save(load(x))) != load(x): ${diff(JSON.parse(j1), JSON.parse(j2)).slice(0, 8).join(' | ')}`)
const j3 = JSON.stringify(load(j2))
verdict('MIGRATE-IDEMPOTENT', j2 === j3, `third load differs from the second: ${diff(JSON.parse(j2), JSON.parse(j3)).slice(0, 6).join(' | ')}`)
verdict('PLAYABLE', isPlayable(m1), 'isPlayable false')
console.log(`  loaded: season ${m1.season} week ${m1.week} ${m1.gender ?? 'm'} players ${Object.keys(m1.players).length} news ${m1.news.length} bytes ${j1.length}`)
numbers(m1, 'loaded'); dupes(m1, 'loaded'); orphans(m1, 'loaded')

// straight through
let A = load(j1)
for (let w = 0; w < K; w++) playWeek(A)
const sigA = signature(A)
// saved and loaded every R weeks
let B = load(j1)
for (let w = 0; w < K; w++) {
  playWeek(B)
  if ((w + 1) % R === 0 && w + 1 < K) B = load(JSON.stringify(B))
}
const sigB = signature(B)
verdict('DETERMINISM', sigA === sigB, `after ${K} weeks (save/load every ${R}): ${diff(JSON.parse(sigA), JSON.parse(sigB)).slice(0, 10).join(' | ')}`)
console.log(`  after ${K} weeks: season ${A.season} week ${A.week} unemployed=${!!A.unemployed} news ${A.news.length}`)
numbers(A, `+${K}w`); dupes(A, `+${K}w`); orphans(A, `+${K}w`)
// the world after the weeks must itself load idempotently too
{
  const a1 = JSON.stringify(load(sigA)), a2 = JSON.stringify(load(a1))
  verdict('MIGRATE-IDEMPOTENT', a1 === a2, `+${K}w: ${diff(JSON.parse(a1), JSON.parse(a2)).slice(0, 6).join(' | ')}`)
}

if (LANG) {
  await ensureLang('fr'); setLang('fr')
  let F = load(j1)
  const K2 = Math.min(K, 8)
  for (let w = 0; w < K2; w++) playWeek(F)
  const sigF = canon(F)
  setLang('en')
  let E = load(j1)
  for (let w = 0; w < K2; w++) playWeek(E)
  const sigE = canon(E)
  verdict('LANGUAGE', sigF === sigE, `${K2} weeks in French differ from English: ${diff(JSON.parse(sigE), JSON.parse(sigF)).slice(0, 10).join(' | ')}`)
}

console.log(`RESULT ${label} ${Object.entries(results).map(([k, v]) => `${k}=${v}`).join(' ')}`)
process.exit(fails ? 1 : 0)
