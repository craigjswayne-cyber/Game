// World-state invariant audit: run seasons and validate consistency weekly.
// Complements simtest (stats/perf) with hard correctness checks.
import { newGame } from '../src/game/newgame'
import { arrangeFriendly, processWeekAndAdvance, requestFacility, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { answerPress } from '../src/game/media'
import { cottonWool, specialistConsult } from '../src/game/medical'
import { ROLE_BY_ID, rolesForSlot } from '../src/game/roles'
import { FACILITY_INFO, SEASON_WEEKS, oldBoyApps, type FacilityId, type GameState } from '../src/game/model'
import { appointStaff, sendToCourse, type StaffRole } from '../src/game/staff'

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
  for (const [code, pts] of Object.entries(g.natRank ?? {})) {
    if (!(pts >= 40 && pts <= 100)) bad(`${tag} nation rating out of range: ${code}=${pts}`)
  }
  if (g.natConfidence != null && !(g.natConfidence >= 0 && g.natConfidence <= 100)) bad(`${tag} natConfidence out of range: ${g.natConfidence}`)
  if (g.natConfidence != null && !g.natTeam) bad(`${tag} union confidence without a national job`)
  if (g.tenureStart != null && g.tenureStart > g.season) bad(`${tag} tenureStart in the future: ${g.tenureStart} > ${g.season}`)
  for (const cid of g.legendOf ?? []) if (!g.clubs[cid]) bad(`${tag} legend of missing club ${cid}`)
  for (const [cid, rec] of Object.entries(g.derbyBook ?? {})) {
    if (!g.clubs[cid]) bad(`${tag} derby ledger vs missing club ${cid}`)
    if (rec.w < 0 || rec.d < 0 || rec.l < 0) bad(`${tag} negative derby record vs ${cid}`)
  }
  for (const [cid, rec] of Object.entries(g.vsBook ?? {})) {
    if (!g.clubs[cid]) bad(`${tag} manager's book vs missing club ${cid}`)
    if (rec.w < 0 || rec.d < 0 || rec.l < 0) bad(`${tag} negative record vs ${cid}`)
    const run = rec.run ?? 0
    if (run > rec.w) bad(`${tag} win streak ${run} exceeds total wins ${rec.w} vs ${cid}`)
    if (-run > rec.l) bad(`${tag} losing streak ${-run} exceeds total losses ${rec.l} vs ${cid}`)
  }
  for (const p of Object.values(g.players)) {
    if (p.retiring && p.age < 37) bad(`${tag} retiring flag on ${p.name}, only ${p.age}`)
    if ((p.lions ?? 0) < 0 || (p.lions ?? 0) > 8) bad(`${tag} ${p.name} has ${p.lions} Lions tours`)
    if ((p.wcWins ?? 0) < 0 || (p.wcWins ?? 0) > 5) bad(`${tag} ${p.name} has ${p.wcWins} World Cup wins`)
  }
  if ((g.courtedAt ?? 0) > g.season * 100 + g.week) bad(`${tag} courtedAt in the future`)
  for (const id of [g.challenge, ...(g.challengesDone ?? [])]) {
    if (id && !CHALLENGES.some(c => c.id === id)) bad(`${tag} unknown challenge id ${id}`)
  }
  if (g.challenge && (g.challengesDone ?? []).includes(g.challenge)) bad(`${tag} challenge both live and done: ${g.challenge}`)
  if (g.tryOfSeason) {
    if (g.tryOfSeason.season !== g.season) bad(`${tag} tryOfSeason from season ${g.tryOfSeason.season}, not cleared at rollover`)
    if (!(g.tryOfSeason.min >= 1 && g.tryOfSeason.min <= 85)) bad(`${tag} tryOfSeason minute ${g.tryOfSeason.min}`)
    if (!g.tryOfSeason.name || !g.tryOfSeason.text) bad(`${tag} tryOfSeason missing name/text`)
  }
  {
    let prevSeason = -1
    for (const w of g.potyRoll ?? []) {
      if (w.season > g.season) bad(`${tag} POTY roll entry from future season ${w.season}`)
      if (w.season <= prevSeason) bad(`${tag} POTY roll out of order or duplicated at season ${w.season}`)
      prevSeason = w.season
      if (!w.name) bad(`${tag} POTY roll entry with no name (season ${w.season})`)
    }
  }
  if (g.gateRecord) {
    if (!(g.gateRecord.att > 0)) bad(`${tag} gate record with non-positive attendance`)
    if (!g.clubs[g.gateRecord.oppId]) bad(`${tag} gate record vs missing club ${g.gateRecord.oppId}`)
  }
  if (g.facilityBuild) {
    const b = g.facilityBuild
    if (!FACILITY_INFO[b.id]) bad(`${tag} facility build with unknown id ${b.id}`)
    if (!(b.level >= 1 && b.level <= 3)) bad(`${tag} facility build to level ${b.level}`)
    if (b.done > g.season * 100 + g.week + 6) bad(`${tag} facility build finishes too far out (${b.done})`)
  }
  for (const [role, p] of Object.entries(g.staffPeople ?? {})) {
    if (!p) continue
    if (!(p.tier >= 1 && p.tier <= 3)) bad(`${tag} ${p.name} holds tier ${p.tier}`)
    if (g.staff[role as keyof typeof g.staff] !== p.tier) bad(`${tag} ${role} level ${g.staff[role as keyof typeof g.staff]} but ${p.name} is tier ${p.tier}`)
    if (!(p.wage > 0)) bad(`${tag} ${p.name} works for ${p.wage}`)
    if (!p.name || !p.trait) bad(`${tag} staff member with no name or trait in ${role}`)
    if (p.course) {
      if (p.course.done > g.season * 100 + g.week + 6) bad(`${tag} ${p.name} on a course finishing ${p.course.done}`)
      if (p.course.toTier !== p.tier + 1) bad(`${tag} ${p.name} sitting a badge that is not his next one`)
    }
  }
  for (const [fid, lvl] of Object.entries(g.facilities ?? {})) {
    if (!FACILITY_INFO[fid as FacilityId]) bad(`${tag} unknown facility ${fid}`)
    if (!(lvl >= 0 && lvl <= 3)) bad(`${tag} facility ${fid} at level ${lvl}`)
  }
  // 11. prose quality: rendered game text never leaks internals or breaks
  // house style. En dashes are legal only in the scoreline convention (24–18,
  // 52%–48%); em dashes are banned outright; a stray "undefined", NaN or
  // [object Object] means a template rendered against a missing entity.
  const prose = (where: string, text: string | undefined | null) => {
    if (!text) return
    const clip = text.replace(/\n/g, ' ').slice(0, 80)
    if (/\bundefined\b/.test(text)) bad(`${tag} "undefined" leaked into ${where}: ${clip}`)
    if (/\bNaN\b/.test(text)) bad(`${tag} NaN leaked into ${where}: ${clip}`)
    if (text.includes('[object Object]')) bad(`${tag} raw object leaked into ${where}: ${clip}`)
    if (text.includes('${')) bad(`${tag} unrendered template in ${where}: ${clip}`)
    if (text.includes('—')) bad(`${tag} em dash in ${where}: ${clip}`)
    if (/–/.test(text.replace(/[\d%]\s?–\s?\d/g, ''))) bad(`${tag} en dash outside a scoreline in ${where}: ${clip}`)
    if (/ {2}/.test(text)) bad(`${tag} double space in ${where}: ${clip}`)
  }
  for (const n of g.news) { prose('news subject', n.subject); prose(`news body ("${n.subject.slice(0, 36)}")`, n.body) }
  for (const pi of g.press) {
    prose('press question', pi.question)
    for (const o of pi.options) prose('press option', o.label)
    prose('press reaction', pi.reaction)
    prose('press answer label', pi.answerLabel)
  }
  for (const f of g.fixtures) for (const e of f.events ?? []) prose('match event', e.text)
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

// every scripted challenge must boot at its club with its intro news
import { CHALLENGES } from '../src/game/newgame'
for (const ch of CHALLENGES) {
  const cg = newGame(ch.clubId, 'Boot Check', 4242, ch.id)
  if (cg.userClubId !== ch.clubId) bad(`challenge ${ch.id} booted at ${cg.userClubId}`)
  if (cg.challenge !== ch.id) bad(`challenge ${ch.id} not stamped on the save (got ${cg.challenge})`)
  if (!cg.news.some(n => n.subject.includes('THE CHALLENGE'))) bad(`challenge ${ch.id} missing intro`)
  audit(cg, `challenge:${ch.id}`)
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
    // pester the board for facilities like a manager with a vision
    if (g.week % 5 === 0) {
      const fids: FacilityId[] = ['gym', 'kicking', 'paddock', 'briefing', 'academy']
      requestFacility(g, fids[(g.week / 5) % 5 | 0])
    }
    // churn the coaching department: courses and appointments every few weeks
    const roles: StaffRole[] = ['assistant', 'physio', 'scout', 'attack', 'defence', 'scrumCoach', 'kicking', 'academyCoach']
    const role = roles[g.week % roles.length]
    if (g.week % 3 === 0) sendToCourse(g, role)
    if (g.week % 7 === 0) appointStaff(g, role, g.week % 3)
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
