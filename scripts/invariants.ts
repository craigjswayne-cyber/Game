// World-state invariant audit: run seasons and validate consistency weekly.
// Complements simtest (stats/perf) with hard correctness checks.
import { newGame } from '../src/game/newgame'
import { arrangeFriendly, processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { answerPress } from '../src/game/media'
import { cottonWool, specialistConsult } from '../src/game/medical'
import { ROLE_BY_ID, rolesForSlot } from '../src/game/roles'
import { SEASON_WEEKS, oldBoyApps, type GameState } from '../src/game/model'

let fails = 0
function bad(msg: string) {
  fails++
  if (fails <= 40) console.error(`INVARIANT: ${msg}`)
}

function audit(g: GameState, tag: string) {
  // 1. roster integrity: every player in exactly one club roster, and that club is his clubId
  const seen = new Map<number, string>()
  for (const club of Object.values(g.clubs)) {
    for (const id of club.players) {
      const p = g.players[id]
      if (!p) { bad(`${tag} ${club.id} lists missing player ${id}`); continue }
      if (p.clubId !== club.id) bad(`${tag} ${p.name} in ${club.id} roster but clubId=${p.clubId}`)
      if (seen.has(id)) bad(`${tag} player ${p.name} in two rosters: ${seen.get(id)} + ${club.id}`)
      seen.set(id, club.id)
    }
  }
  // 2. lineups: no duplicate picks; every pick belongs to the club
  for (const club of Object.values(g.clubs)) {
    const picks = club.tactic.lineup.filter((x): x is number => x != null)
    if (new Set(picks).size !== picks.length) bad(`${tag} ${club.id} lineup has duplicate players`)
    for (const id of picks) {
      const p = g.players[id]
      if (!p) bad(`${tag} ${club.id} lineup names missing player ${id}`)
      else if (p.clubId !== club.id) bad(`${tag} ${club.id} lineup names ${p.name} of ${p.clubId}`)
    }
  }
  // 3. no team double-booked in a week
  const wkTeams = new Map<string, Set<string>>()
  for (const f of g.fixtures) {
    const k = String(f.week)
    const set = wkTeams.get(k) ?? new Set()
    for (const t of [f.homeId, f.awayId]) {
      if (set.has(t)) bad(`${tag} ${t} double-booked in week ${f.week}`)
      set.add(t)
    }
    wkTeams.set(k, set)
  }
  // 4. player fields in bounds
  for (const p of Object.values(g.players)) {
    if (!(p.morale >= 1 && p.morale <= 10)) bad(`${tag} ${p.name} morale ${p.morale}`)
    if (!(p.form >= 1 && p.form <= 10)) bad(`${tag} ${p.name} form ${p.form}`)
    if (!(p.cond >= 0 && p.cond <= 100)) bad(`${tag} ${p.name} cond ${p.cond}`)
    if (p.bans < 0) bad(`${tag} ${p.name} bans ${p.bans}`)
    if (p.injury && p.injury.weeks < 0) bad(`${tag} ${p.name} injury weeks ${p.injury.weeks}`)
    if (p.stats.mins < 0) bad(`${tag} ${p.name} negative minutes`)
    if (Number.isNaN(p.ca) || Number.isNaN(p.morale) || Number.isNaN(p.cond) || Number.isNaN(p.form)) bad(`${tag} ${p.name} NaN field`)
  }
  // 5. played fixtures have sane scores; table pts non-negative
  for (const f of g.fixtures) {
    if (f.played && (f.homeScore < 0 || f.awayScore < 0 || f.homeScore > 150 || f.awayScore > 150)) {
      bad(`${tag} weird score ${f.homeId} ${f.homeScore}-${f.awayScore} ${f.awayId}`)
    }
  }
  for (const c of Object.values(g.comps)) {
    for (const r of c.table) {
      if (r.pts < 0 || Number.isNaN(r.pts)) bad(`${tag} ${c.id} table pts ${r.pts} for ${r.teamId}`)
      if (r.p > 60) bad(`${tag} ${c.id} ${r.teamId} played ${r.p} games`)
    }
  }
  // 6. id counter above any live id
  const maxPid = Object.keys(g.players).reduce((m, k) => Math.max(m, Number(k)), 0)
  if (g.nextId <= maxPid) bad(`${tag} nextId ${g.nextId} <= max player id ${maxPid}`)
  // 7. offers reference real players; chem values positive
  for (const o of g.offers) {
    if (o.status === 'pending' && !g.players[o.playerId]) bad(`${tag} pending offer for missing player ${o.playerId}`)
  }
  for (const [k, v] of Object.entries(g.chem ?? {})) {
    if (!(v > 0) || Number.isNaN(v)) bad(`${tag} chem ${k} = ${v}`)
  }
  // 8. grudges reference real clubs and future expiry sanity
  for (const gr of g.grudges ?? []) {
    if (!g.clubs[gr.a] || !g.clubs[gr.b]) bad(`${tag} grudge names missing club ${gr.a}/${gr.b}`)
  }
  // 9. newest systems: fan mood bounds, leadership sanity, agent flags
  if (g.fanMood != null && !(g.fanMood >= 5 && g.fanMood <= 98)) bad(`${tag} fanMood ${g.fanMood}`)
  for (const c of Object.values(g.clubs)) {
    if (c.captain != null && c.vice != null && c.captain === c.vice) bad(`${tag} ${c.id} captain === vice`)
    if (c.vice != null && g.players[c.vice] && g.players[c.vice].clubId !== c.id) bad(`${tag} ${c.id} vice plays elsewhere`)
  }
  for (const p of Object.values(g.players)) {
    if (p.specialist && !p.injury) bad(`${tag} ${p.name} specialist flag with no injury`)
    if ((p.wantsDeal ?? 0) > 0 && p.clubId !== g.userClubId) bad(`${tag} ${p.name} wantsDeal but not user's player`)
  }
  for (const h of g.hof ?? []) {
    if (!(h.apps > 0) || Number.isNaN(h.points)) bad(`${tag} hof entry broken: ${h.name}`)
  }
  // 10. roles reference valid ids; agency lists reference live players
  for (const c of Object.values(g.clubs)) {
    for (const r of c.tactic.roles ?? []) {
      if (r != null && !ROLE_BY_ID[r]) bad(`${tag} ${c.id} has unknown role ${r}`)
    }
  }
  for (const pid of [...(g.agency?.seniors ?? []), ...(g.agency?.kids ?? [])]) {
    if (!g.players[pid]) bad(`${tag} agency lists retired/missing player ${pid}`)
  }
  for (const p of Object.values(g.players)) {
    if (p.exClub && !g.clubs[p.exClub]) bad(`${tag} ${p.name} ex-club ${p.exClub} does not exist`)
    if (p.exClub && p.exClub === p.clubId && (p.exApps ?? 0) > 0 && oldBoyApps(p, p.exClub) > 0) bad(`${tag} ${p.name} counts old-boy apps at his own club`)
  }
  for (const pl of g.pledges ?? []) {
    if (!g.players[pl.playerId]) bad(`${tag} pledge for missing player ${pl.playerId}`)
    if (pl.season === g.season && g.week > pl.due + 1) bad(`${tag} pledge overdue and unsettled (due w${pl.due}, now w${g.week})`)
  }
  if (g.intakeClass?.length && g.week < 30) bad(`${tag} intake class exists before the week-30 preview`)
  if (g.takeover) {
    if (!g.clubs[g.takeover.clubId]) bad(`${tag} takeover at missing club ${g.takeover.clubId}`)
    if (g.takeover.stage !== 0 && g.takeover.stage !== 1) bad(`${tag} takeover in unknown stage ${g.takeover.stage}`)
    if (g.takeover.week > g.week) bad(`${tag} takeover from the future (w${g.takeover.week}, now w${g.week}) - not cleared at rollover`)
  }
  if (g.newOwnerUntil != null && (g.newOwnerUntil < 1 || g.newOwnerUntil > 45)) bad(`${tag} newOwnerUntil out of range: ${g.newOwnerUntil}`)
  for (const [cid, rec] of Object.entries(g.derbyBook ?? {})) {
    if (!g.clubs[cid]) bad(`${tag} derby ledger vs missing club ${cid}`)
    if (rec.w < 0 || rec.d < 0 || rec.l < 0) bad(`${tag} negative derby record vs ${cid}`)
  }
  const pcSeen = new Set<number>()
  for (const pc of g.preContracts ?? []) {
    if (!g.players[pc.playerId]) bad(`${tag} pre-contract for missing player ${pc.playerId}`)
    if (!g.clubs[pc.toClubId]) bad(`${tag} pre-contract to missing club ${pc.toClubId}`)
    if (pcSeen.has(pc.playerId)) bad(`${tag} duplicate pre-contract for player ${pc.playerId}`)
    pcSeen.add(pc.playerId)
    if (g.week < 25) bad(`${tag} pre-contract exists before week 25`)
    if (g.players[pc.playerId]?.clubId === pc.toClubId) bad(`${tag} pre-contract points at the player's own club`)
  }
}

const club = process.argv[2] ?? 'leicester'
const seed = Number(process.argv[3] ?? 777)
console.log(`auditing ${club} seed ${seed}`)
const g = newGame(club, 'Test Gaffer', seed)
audit(g, 's1w1(new)')
const SEASONS = 5
for (let season = 0; season < SEASONS; season++) {
  const target = g.season + 1
  let guard = 0
  while (g.season < target && guard++ < SEASON_WEEKS + 5) {
    // exercise the manager's levers like a hyperactive player would
    let fx = userFixtureThisWeek(g)
    if (!fx && g.week % 2 === 0) {
      const idle = Object.values(g.clubs).find(c => c.id !== g.userClubId &&
        !g.fixtures.some(f => f.week === g.week && !f.played && (f.homeId === c.id || f.awayId === c.id)))
      if (idle) { arrangeFriendly(g, idle.id); fx = userFixtureThisWeek(g) }
    }
    const squad = g.clubs[g.userClubId].players.map(id => g.players[id]).filter(Boolean)
    const hurt = squad.find(p => p.injury && !p.specialist && p.injury.until - g.week >= 3)
    if (hurt) specialistConsult(g, hurt.id)
    const rusty = squad.find(p => !p.injury && (p.rust ?? 0) > 0)
    if (rusty) cottonWool(g, rusty.id)
    g.scoutFocus = ['top14', 'urc', 'prem', null][g.week % 4]
    // rotate positional roles like a tinkering manager
    const t = g.clubs[g.userClubId].tactic
    t.roles ??= []
    const slot = g.week % 15
    const opts = rolesForSlot(slot)
    t.roles[slot] = g.week % 3 === 0 ? null : opts[g.week % opts.length].id
    if (fx) simMatch(g, fx, weekRng(g), true)
    for (const pi of g.press.filter(p => !p.answered)) answerPress(g, pi.id, 0)
    processWeekAndAdvance(g)
    audit(g, `s${g.season}w${g.week}`)
  }
  console.log(`season ${g.season} reached, fails so far: ${fails}`)
}
if (fails === 0) console.log('INVARIANT AUDIT PASSED (5 seasons, weekly checks)')
else { console.error(`INVARIANT AUDIT: ${fails} failures`); process.exit(1) }
