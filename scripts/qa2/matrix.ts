/**
 * THE RUNTIME MATRIX (runtime brief, section 8): fifteen seasons on three fixed
 * seeds in each world, every invariant checked every season, checkpoints at
 * seasons 1, 3, 5, 10 and 15, and the save put through a JSON round trip at
 * each checkpoint.
 *
 *   npx vite-node scripts/qa2/matrix.ts            both worlds, 3 seeds, 15 seasons
 *   npx vite-node scripts/qa2/matrix.ts w 1 5      women, one seed, five seasons
 *
 * A gate: any failed invariant exits 1. Durations are printed per run so the
 * report can quote them.
 */
import { newGame } from '../../src/game/newgame'
import { processWeekAndAdvance } from '../../src/game/season'
import { validateCalendar, type CalWorld } from '../../src/game/calendar'
import { nationByCode } from '../../src/game/nations'
import { genderOf } from '../../src/game/gender'
import { SEASON_WEEKS, type GameState } from '../../src/game/model'

const genders = (process.argv[2] ?? 'mw').split('') as ('m' | 'w')[]
const seedCount = Number(process.argv[3] ?? 3)
const seasons = Number(process.argv[4] ?? 15)
const SEEDS = [20260916, 777, 4242].slice(0, seedCount)
const CHECKPOINTS = new Set([1, 3, 5, 10, 15])

let fails = 0
const bad = (msg: string) => { fails++; console.log(`FAIL  ${msg}`) }

function world(g: GameState): CalWorld {
  return {
    gender: genderOf(g), fixtures: g.fixtures, comps: g.comps as unknown as CalWorld['comps'],
    isClub: id => !!g.clubs[id], isNation: id => id === 'LIO' || !!nationByCode(id),
  }
}

/** Every per-season invariant the brief lists. Returns the violations. */
function seasonInvariants(g: GameState): string[] {
  const out: string[] = []
  const seen = new Map<number, string[]>()
  for (const c of Object.values(g.clubs)) {
    const seniors = c.players.filter(id => { const p = g.players[id]; return p && !p.acad })
    if (seniors.length < 23 || seniors.length > 46) out.push(`${c.id}: ${seniors.length} seniors`)
    for (const id of c.players) {
      if (!g.players[id]) { out.push(`${c.id}: lists player ${id} who does not exist`); continue }
      if (g.players[id].clubId !== c.id) out.push(`${c.id}: lists ${id} whose clubId is ${g.players[id].clubId}`)
      seen.set(id, [...(seen.get(id) ?? []), c.id])
    }
  }
  for (const [id, clubs] of seen) if (clubs.length > 1) out.push(`player ${id} is in ${clubs.join(' and ')}`)
  for (const p of Object.values(g.players)) {
    if (!(p.age >= 15 && p.age <= 45)) out.push(`${p.name}: age ${p.age}`)
    if (p.clubId) {
      if (!g.clubs[p.clubId]) out.push(`${p.name}: clubId ${p.clubId} does not exist`)
      else if (!g.clubs[p.clubId].players.includes(p.id)) out.push(`${p.name}: ${p.clubId} does not list him`)
      if (p.contractEnds < g.season) out.push(`${p.name}: contract ended season ${p.contractEnds}, it is ${g.season}`)
    }
    if (p.loanClub && !g.clubs[p.loanClub]) out.push(`${p.name}: on loan at ${p.loanClub}, which does not exist`)
    for (const [k, v] of Object.entries(p.a ?? {})) if (typeof v === 'number' && !Number.isFinite(v)) out.push(`${p.name}: attribute ${k} is ${v}`)
    if (!Number.isFinite(p.ca) || !Number.isFinite(p.wage)) out.push(`${p.name}: ca ${p.ca} wage ${p.wage}`)
  }
  // tables reconcile with the fixtures played
  for (const comp of Object.values(g.comps)) {
    if (comp.type === 'intl' && comp.id !== 'wc') continue
    for (const r of comp.table ?? []) {
      const played = g.fixtures.filter(f => f.compId === comp.id && f.played && !f.stage && (f.homeId === r.teamId || f.awayId === r.teamId)).length
      if (r.p !== played) out.push(`${comp.id}: ${r.teamId} shows ${r.p} played, fixtures say ${played}`)
      if (r.w + r.d + r.l !== r.p) out.push(`${comp.id}: ${r.teamId} w+d+l ${r.w + r.d + r.l} != p ${r.p}`)
    }
  }
  for (const v of validateCalendar(world(g))) out.push(v)
  return out
}

/** A save through JSON and back: no NaN, no Infinity, no undefined, and every
 *  reference still points at something. */
function roundTrip(g: GameState): string[] {
  const out: string[] = []
  const scan = (v: unknown, path: string, depth: number) => {
    if (depth > 12) return
    if (typeof v === 'number' && !Number.isFinite(v)) out.push(`${path} is ${v}`)
    // an optional property set to undefined vanishes in JSON and comes back
    // absent, which is what optional means; an undefined INSIDE an array comes
    // back as null, which is a hole where a value should be
    else if (Array.isArray(v)) v.forEach((x, i) => (x === undefined ? out.push(`${path}[${i}] is undefined`) : scan(x, `${path}[${i}]`, depth + 1)))
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) scan(x, `${path}.${k}`, depth + 1)
  }
  scan(g, 'save', 0)
  const json = JSON.stringify(g)
  const back = JSON.parse(json) as GameState
  if (Object.keys(back.players).length !== Object.keys(g.players).length) out.push('players lost in the round trip')
  for (const f of back.fixtures) for (const id of [f.homeId, f.awayId]) if (!back.clubs[id] && !nationByCode(id) && id !== 'LIO') out.push(`fixture ${f.id}: ${id} unknown`)
  for (const [nat, ids] of Object.entries(back.natSquads ?? {})) for (const id of ids as number[]) if (!back.players[id]) out.push(`${nat} squad lists ${id}`)
  if (back.userClubId && !back.clubs[back.userClubId] && !back.unemployed) out.push(`userClubId ${back.userClubId} unknown`)
  return out.length ? out : [`ok ${(json.length / 1024 / 1024).toFixed(1)} MB`]
}

function champions(g: GameState, season: number): string[] {
  const out: string[] = []
  for (const comp of Object.values(g.comps)) {
    if (comp.type === 'intl' && comp.id !== 'wc') continue
    if (comp.id === 'fr') continue
    if (!g.history.some(h => h.season === season && h.compId === comp.id && h.champion)) out.push(`${comp.id}: no champion recorded for season ${season}`)
  }
  return out
}

for (const gender of genders) {
  for (const seed of SEEDS) {
    const club = gender === 'w' ? 'w:glosharty' : 'leicester'
    const g = gender === 'w' ? newGame(club, 'Matrix', seed, undefined, 'coach', 'w', 'w') : newGame(club, 'Matrix', seed)
    const t0 = Date.now()
    let slowestWeek = 0
    const violations = new Map<string, number>()
    const note = (v: string) => violations.set(v, (violations.get(v) ?? 0) + 1)
    for (let s = 1; s <= seasons; s++) {
      const target = g.season + 1
      let guard = 0
      const compsThisSeason = Object.keys(g.comps)
      while (g.season < target && guard++ < SEASON_WEEKS + 5) {
        const w0 = Date.now()
        processWeekAndAdvance(g)
        slowestWeek = Math.max(slowestWeek, Date.now() - w0)
        if (g.season < target) for (const v of validateCalendar(world(g))) note(`calendar: ${v}`)
      }
      for (const v of seasonInvariants(g)) note(v)
      for (const v of champions(g, target - 1)) if (compsThisSeason.includes(v.split(':')[0])) note(v)
      if (CHECKPOINTS.has(s)) {
        const rt = roundTrip(g)
        const rtBad = rt.filter(x => !x.startsWith('ok'))
        for (const v of rtBad) note(`round trip: ${v}`)
        console.log(`  ${gender} seed ${seed} season ${s}: ${Object.keys(g.players).length} players, ${g.fixtures.length} fixtures, ${g.news.length} news, save ${rt.find(x => x.startsWith('ok'))?.slice(3) ?? 'broken'}, ${(Date.now() - t0) / 1000 | 0}s so far, slowest week ${slowestWeek} ms, violations ${violations.size}`)
      }
    }
    const secs = (Date.now() - t0) / 1000
    if (violations.size) {
      bad(`${gender} seed ${seed}: ${violations.size} distinct violations over ${seasons} seasons`)
      for (const [v, n] of [...violations].slice(0, 15)) console.log(`        ${v}${n > 1 ? ` (x${n})` : ''}`)
    } else console.log(`  ok  ${gender} seed ${seed}: ${seasons} seasons clean in ${secs.toFixed(0)}s`)
  }
}
console.log(fails ? `\nMATRIX FAILED (${fails})` : `\nMATRIX PASSED: ${genders.length} world(s) x ${SEEDS.length} seed(s) x ${seasons} seasons, every invariant every season`)
process.exit(fails ? 1 : 0)
