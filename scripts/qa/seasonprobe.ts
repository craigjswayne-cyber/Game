// 12-season season/competition invariant probe. argv: gender seed seasons
import { newGame, LEAGUE_DEFS } from '../../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng, activeWindows, rebuildTable, KO_STAGES } from '../../src/game/season'
import { simMatch } from '../../src/game/matchEngine'
import { answerPress } from '../../src/game/media'
import { SEASON_WEEKS, RELEGATES, isWorldCupSeason, type GameState, type Competition } from '../../src/game/model'
import { LEAGUE_WEEKS, sortTable, isLionsSeason, isWomensTourSeason } from '../../src/game/schedule'
import { adminPenalty } from '../../src/game/insolvency'

const gender = (process.argv[2] ?? 'm') as 'm' | 'w'
const seed = Number(process.argv[3] ?? 101)
const SEASONS = Number(process.argv[4] ?? 12)
const defs = LEAGUE_DEFS(gender)
const clubId = gender === 'w' ? defs[0].clubs[2].id : (seed % 2 ? 'leicester' : 'bath')
const g = newGame(clubId, 'QA Gaffer', seed, undefined, 'coach', gender, gender)
let fails = 0
const seenMsg = new Map<string, number>()
function bad(msg: string) {
  fails++
  const key = msg.replace(/\d+/g, '#')
  const n = (seenMsg.get(key) ?? 0) + 1
  seenMsg.set(key, n)
  if (n <= 3) console.error(`INVARIANT: ${msg}`)
}
const tag = () => `[${gender} seed${seed} s${g.season} w${g.week}]`
const isNation = (id: string) => /^[A-Z]{3}$/.test(id)

function checkFixturesAtSeasonStart() {
  const t = tag()
  const ids = new Set<number>()
  const byWeek = new Map<string, Set<string>>()
  for (const f of g.fixtures) {
    if (ids.has(f.id)) bad(`${t} duplicate fixture id ${f.id}`)
    ids.add(f.id)
    if (f.homeId === f.awayId) bad(`${t} ${f.compId} team plays itself ${f.homeId}`)
    if (!(f.week >= 1 && f.week <= SEASON_WEEKS)) bad(`${t} ${f.compId} fixture week ${f.week} outside 1..${SEASON_WEEKS}`)
    for (const id of [f.homeId, f.awayId]) {
      if (!g.clubs[id] && !isNation(id)) bad(`${t} ${f.compId} unknown team ${id}`)
    }
    if (f.played) bad(`${t} ${f.compId} fixture already played at season start`)
    const k = `${f.week}${f.midweek ? 'w' : ''}`
    const set = byWeek.get(k) ?? new Set()
    for (const id of [f.homeId, f.awayId]) {
      if (set.has(id)) bad(`${t} ${id} double-booked week ${f.week} (${f.compId})`)
      set.add(id)
    }
    byWeek.set(k, set)
    const comp = g.comps[f.compId]
    if (!comp && f.compId !== 'fr') bad(`${t} fixture for unknown comp ${f.compId}`)
    if (comp && !f.stage && comp.weeksByRound.length) {
      const exp = comp.weeksByRound[f.round]
      if (exp !== f.week) bad(`${t} ${f.compId} round ${f.round} week ${f.week} != weeksByRound ${exp}`)
    }
    if (comp?.type === 'league' && !LEAGUE_WEEKS.includes(f.week)) bad(`${t} ${f.compId} league fixture in non-league week ${f.week}`)
  }
  // league membership and pairings
  for (const def of defs) {
    const comp = g.comps[def.id]
    if (!comp) { bad(`${t} league ${def.id} missing`); continue }
    const members = Object.values(g.clubs).filter(c => c.leagueId === def.id).map(c => c.id).sort()
    const tids = [...comp.teamIds].sort()
    if (members.join() !== tids.join()) bad(`${t} ${def.id} teamIds != clubs with leagueId (${tids.length} vs ${members.length})`)
    if (members.length !== def.clubs.length) bad(`${t} ${def.id} has ${members.length} clubs, defined ${def.clubs.length}`)
    if (comp.table.length !== comp.teamIds.length) bad(`${t} ${def.id} table rows ${comp.table.length} != teams ${comp.teamIds.length}`)
    if (comp.weeksByRound.length !== comp.rounds) bad(`${t} ${def.id} rounds ${comp.rounds} != weeksByRound ${comp.weeksByRound.length}`)
    if (new Set(comp.weeksByRound).size !== comp.weeksByRound.length) bad(`${t} ${def.id} weeksByRound has duplicates`)
    const pair = new Map<string, number>()
    const home = new Map<string, number>()
    for (const f of g.fixtures) {
      if (f.compId !== def.id || f.stage) continue
      pair.set(f.homeId + '>' + f.awayId, (pair.get(f.homeId + '>' + f.awayId) ?? 0) + 1)
      home.set(f.homeId, (home.get(f.homeId) ?? 0) + 1)
      if (!comp.teamIds.includes(f.homeId) || !comp.teamIds.includes(f.awayId)) bad(`${t} ${def.id} fixture with non-member ${f.homeId}/${f.awayId}`)
    }
    for (const a of comp.teamIds) for (const b of comp.teamIds) {
      if (a === b) continue
      const ab = pair.get(a + '>' + b) ?? 0, ba = pair.get(b + '>' + a) ?? 0
      if (def.double ? (ab !== 1 || ba !== 1) : ab + ba !== 1) bad(`${t} ${def.id} pairing ${a}-${b} home ${ab} away ${ba} (double=${def.double})`)
    }
    const hs = comp.teamIds.map(id => home.get(id) ?? 0)
    if (def.double && Math.max(...hs) !== Math.min(...hs)) bad(`${t} ${def.id} home/away imbalance ${Math.min(...hs)}..${Math.max(...hs)}`)
    if (!def.double && Math.max(...hs) - Math.min(...hs) > 1) bad(`${t} ${def.id} single RR home imbalance ${Math.min(...hs)}..${Math.max(...hs)}`)
  }
  // cups
  for (const cid of ['cc', 'chc']) {
    const comp = g.comps[cid]
    if (!comp) continue
    if (comp.teamIds.length !== 16) bad(`${t} ${cid} has ${comp.teamIds.length} teams`)
    if (new Set(comp.teamIds).size !== comp.teamIds.length) bad(`${t} ${cid} duplicate entrant`)
    if (!comp.pools || comp.pools.length !== 4 || comp.pools.some(p => p.length !== 4)) bad(`${t} ${cid} pools malformed`)
    const n = g.fixtures.filter(f => f.compId === cid).length
    if (n !== 24) bad(`${t} ${cid} has ${n} pool fixtures, expected 24`)
    for (const id of comp.teamIds) if (!g.clubs[id]) bad(`${t} ${cid} entrant ${id} not a club`)
    const byLeague: Record<string, number> = {}
    for (const id of comp.teamIds) { const l = g.clubs[id]?.leagueId ?? '?'; byLeague[l] = (byLeague[l] ?? 0) + 1 }
    if (g.week === 1 && g.season <= 2) console.log(`${t} ${cid} entrants by league ${JSON.stringify(byLeague)}`)
    if (cid === 'cc' && gender === 'm' && g.season > 0) {
      const exp: Record<string, number> = { prem: 5, top14: 6, urc: 5 }
      for (const [l, n] of Object.entries(exp)) if (byLeague[l] !== n) bad(`${t} cc has ${byLeague[l] ?? 0} from ${l}, expected ${n}`)
    }
  }
  if (g.comps.cc && g.comps.chc) {
    const both = g.comps.cc.teamIds.filter(id => g.comps.chc.teamIds.includes(id))
    if (both.length) bad(`${t} clubs in both cc and chc: ${both.join(',')}`)
  }
  // internationals present as expected
  if (gender === 'm') {
    const wc = isWorldCupSeason(g.season)
    for (const id of wc ? ['wc', 'sn'] : ['sn', 'trc', 'pnc', 'aut', 'tour']) if (!g.comps[id]) bad(`${t} missing intl comp ${id}`)
    if (wc && (g.comps.trc || g.comps.aut || g.comps.tour)) bad(`${t} WC year still has trc/aut/tour`)
    if (isLionsSeason(g.season) !== !!g.comps.lions) bad(`${t} lions comp presence ${!!g.comps.lions} != isLionsSeason`)
  } else {
    for (const id of ['w:sn', 'w:p4', 'w:aut', 'w:sum', 'cc']) if (!g.comps[id]) bad(`${t} missing women's comp ${id}`)
    if (isWomensTourSeason(g.season) !== !!g.comps['w:lions']) bad(`${t} w:lions presence mismatch`)
  }
  if (g.week === 1) console.log(`${t} comps: ${Object.keys(g.comps).join(' ')} fixtures=${g.fixtures.length}`)
}

function checkWeekly() {
  const t = tag()
  // table consistency vs replay of fixtures (double application / missed application)
  for (const comp of Object.values(g.comps)) {
    if (comp.type !== 'league') continue
    const copy: Competition = JSON.parse(JSON.stringify(comp))
    rebuildTable(copy, g.fixtures, g)
    for (const r of comp.table) {
      const c = copy.table.find(x => x.teamId === r.teamId)!
      if (!c) { bad(`${t} ${comp.id} row ${r.teamId} missing from replay`); continue }
      if (r.pts !== c.pts || r.p !== c.p || r.w !== c.w || r.pf !== c.pf || r.tf !== c.tf || r.bp !== c.bp)
        bad(`${t} ${comp.id} table drift for ${r.teamId}: live pts ${r.pts} p ${r.p} bp ${r.bp} vs replay pts ${c.pts} p ${c.p} bp ${c.bp}`)
    }
  }
  for (const f of g.fixtures) {
    if (f.played && f.week > g.week) bad(`${t} ${f.compId} fixture played in the future (week ${f.week})`)
    if (!f.played && f.week < g.week && f.week > 0) bad(`${t} ${f.compId} unplayed fixture in past week ${f.week} (${f.homeId} v ${f.awayId}, stage ${f.stage ?? '-'})`)
    if (f.played && f.stage && KO_STAGES.has(f.stage) && f.homeScore === f.awayScore) bad(`${t} ${f.compId} drawn knockout ${f.stage} ${f.homeId} ${f.homeScore}-${f.awayScore} ${f.awayId}`)
    if (f.played && g.comps[f.compId] && !f.tourMatch && !f.tableApplied) bad(`${t} ${f.compId} played fixture not tableApplied (${f.stage ?? 'league'})`)
  }
  // knockouts after pools only; KO week >= all pool weeks
  for (const comp of Object.values(g.comps)) {
    const kos = g.fixtures.filter(f => f.compId === comp.id && f.stage && KO_STAGES.has(f.stage!))
    if (!kos.length) continue
    const pools = g.fixtures.filter(f => f.compId === comp.id && !f.stage)
    const lastPool = Math.max(...pools.map(f => f.week))
    for (const k of kos) if (k.week <= lastPool && comp.id !== 'prem') bad(`${t} ${comp.id} ${k.stage} in week ${k.week} not after last pool/league week ${lastPool}`)
    if (pools.some(f => !f.played)) bad(`${t} ${comp.id} knockout ties exist while regular fixtures unplayed`)
    for (const k of kos) for (const id of [k.homeId, k.awayId]) if (!id || id === 'undefined') bad(`${t} ${comp.id} ${k.stage} with undefined team`)
  }
  // national squads: exclusivity and flags
  const inSquad = new Map<number, string>()
  for (const [nat, ids] of Object.entries(g.natSquads ?? {})) {
    for (const id of ids) {
      const p = g.players[id]
      if (!p) { bad(`${t} natSquad ${nat} lists missing player ${id}`); continue }
      if (inSquad.has(id)) bad(`${t} ${p.name} in two nat squads ${inSquad.get(id)} + ${nat}`)
      inSquad.set(id, nat)
      if (!p.natSquad && nat !== g.natTeam) bad(`${t} ${p.name} listed for ${nat} but natSquad flag false`)
      if (nat !== 'LIO' && p.nat !== nat) bad(`${t} ${p.name} (${p.nat}) in ${nat} squad`)
      if (p.onLoan) bad(`${t} ${p.name} in ${nat} squad while onLoan`)
    }
  }
  for (const p of Object.values(g.players)) {
    if (p.natSquad && !inSquad.has(p.id)) bad(`${t} ${p.name} natSquad flag but in no squad`)
  }
  const wins = activeWindows(g)
  const open = wins.filter(w => g.week > w.start && g.week <= w.end + 1)
  if (!open.length && inSquad.size && !wins.some(w => g.week === w.start)) bad(`${t} ${inSquad.size} players in nat squads with no window open`)
}

const stats = { finalsMissing: [] as string[], ages: new Map<number, number>(), champs: 0 }
let prevLeague = new Map<string, string>()
const moves: string[] = []
const yoyo = new Map<string, number>()

for (let s = 0; s < SEASONS; s++) {
  checkFixturesAtSeasonStart()
  const target = g.season + 1
  let guard = 0
  const leagueAtStart = new Map(Object.values(g.clubs).map(c => [c.id, c.leagueId]))
  let finalsWk43: { fx: any; clubs: string[] }[] = []
  while (g.season < target && guard++ < SEASON_WEEKS + 5) {
    const fx = userFixtureThisWeek(g)
    if (fx) simMatch(g, fx, weekRng(g), true)
    for (const pi of g.press.filter(p => !p.answered)) answerPress(g, pi.id, 0)
    const wk = g.week
    if (wk === 44) {
      const bar = g.fixtures.find(f => f.compId === 'prem' && f.stage === 'BAR' && f.week === 44)
      if (bar) for (const cid of [bar.homeId, bar.awayId]) {
        const roster = g.clubs[cid].players.map(id => g.players[id]).filter(p => p && !p.acad).sort((a, b) => b.ca - a.ca).slice(0, 23)
        const away = roster.filter(p => p.natSquad)
        if (away.length) stats.finalsMissing.push(`${tag()} relegation playoff: ${g.clubs[cid].short} has ${away.length} of best 23 away on Test duty (${away.slice(0,3).map(p => `${p.name}/${p.nat}`).join(', ')})`)
      }
    }
    if (wk === 43) {
      finalsWk43 = g.fixtures.filter(f => f.week === 43 && f.stage === 'F' && g.clubs[f.homeId]).map(f => ({ fx: f, clubs: [f.homeId, f.awayId] }))
    }
    let snapshot: any = null
    if (wk === SEASON_WEEKS) {
      // pre-rollover snapshot
      snapshot = {
        ages: new Map(Object.values(g.players).map(p => [p.id, p.age])),
        histLen: g.history.length,
        tables: Object.fromEntries(Object.values(g.comps).filter(c => c.type === 'league').map(c => [c.id, sortTable(c.table).map(r => r.teamId)])),
        champs: Object.fromEntries(Object.values(g.comps).map(c => [c.id, c.champion])),
        unplayed: g.fixtures.filter(f => !f.played).map(f => `${f.compId}:${f.stage ?? f.round}:w${f.week}`),
        bar: g.fixtures.find(f => f.compId === 'prem' && f.stage === 'BAR'),
        apps: new Map(Object.values(g.players).map(p => [p.id, p.stats.apps])),
        careerLen: new Map(Object.values(g.players).map(p => [p.id, p.career.length])),
      }
      const t = tag()
      if (snapshot.unplayed.length) bad(`${t} unplayed fixtures at season end: ${snapshot.unplayed.slice(0, 8).join(' ')}`)
      for (const comp of Object.values(g.comps)) {
        if (comp.type === 'league' && !comp.champion) bad(`${t} league ${comp.id} has no champion at week 48`)
        if (comp.type === 'cup' && !comp.champion) bad(`${t} cup ${comp.id} has no champion at week 48`)
        if (comp.type === 'intl' && comp.table.length && !comp.champion && comp.id !== 'aut') bad(`${t} intl ${comp.id} has no champion at week 48`)
      }
      // champion recorded exactly once in history per comp per season
      const cnt = new Map<string, number>()
      for (const h of g.history) if (h.season === g.season) cnt.set(h.compId, (cnt.get(h.compId) ?? 0) + 1)
      for (const [cid, n] of cnt) if (n !== 1) bad(`${t} history has ${n} entries for ${cid} in season ${g.season}`)
      for (const comp of Object.values(g.comps)) if (comp.champion && (cnt.get(comp.id) ?? 0) !== 1) bad(`${t} ${comp.id} champion ${comp.champion} but history entries ${cnt.get(comp.id) ?? 0}`)
      // finals and call-ups (week 43)
      for (const { fx, clubs } of finalsWk43) {
        for (const cid of clubs) {
          const club = g.clubs[cid]
          if (!club) continue
          const roster = club.players.map(id => g.players[id]).filter(Boolean)
          const top = [...roster].filter(p => !p.acad).sort((a, b) => b.ca - a.ca).slice(0, 23)
          // called up at week 43 and did NOT play the final
          const away = top.filter(p => p.natSquad && p.lastWk !== 43)
          if (away.length) stats.finalsMissing.push(`${t} ${fx.compId} final: ${club.short} missing ${away.length} of their best 23 to Test call-ups (${away.slice(0, 3).map(p => `${p.name}/${p.nat}/ca${p.ca}`).join(', ')})`)
        }
      }
    }
    processWeekAndAdvance(g)
    if (snapshot) {
      const t = `[${gender} seed${seed} rollover->s${g.season}]`
      if (g.week !== 1) bad(`${t} week after rollover is ${g.week}`)
      if (g.fixtures.some(f => f.played)) bad(`${t} played fixtures survive rollover`)
      for (const p of Object.values(g.players)) {
        const a0 = snapshot.ages.get(p.id)
        if (a0 != null && p.age !== a0 + 1) bad(`${t} ${p.name} age ${a0} -> ${p.age}`)
        if (p.stats.apps !== 0) bad(`${t} ${p.name} stats not wiped (${p.stats.apps} apps)`)
        const apps0 = snapshot.apps.get(p.id)
        const cl0 = snapshot.careerLen.get(p.id)
        if (p.clubId && apps0 != null && apps0 > 0 && cl0 != null && cl0 < 20 && p.career.length !== cl0 + 1) bad(`${t} ${p.name} career not appended (${cl0} -> ${p.career.length}, apps ${apps0})`)
        if (p.clubId && p.contractEnds < g.season) bad(`${t} ${p.name} contractEnds ${p.contractEnds} < season ${g.season}`)
        if (p.natSquad) bad(`${t} ${p.name} natSquad flag survives rollover`)
        if (p.clubId && !g.clubs[p.clubId]) bad(`${t} ${p.name} clubId ${p.clubId} not a club`)
        if (p.clubId && !g.clubs[p.clubId].players.includes(p.id)) bad(`${t} ${p.name} not in roster of ${p.clubId}`)
      }
      for (const comp of Object.values(g.comps)) {
        if (comp.champion) bad(`${t} ${comp.id} champion not reset`)
        if (comp.table.some(r => r.p !== 0 || r.pts !== 0)) bad(`${t} ${comp.id} table not reset`)
      }
      // promotion / relegation
      for (const [topId, lowId] of [['prem', 'champ'], ['champ', 'natl1'], ['top14', 'prod2']]) {
        const order = snapshot.tables[topId]
        if (!order) continue
        const bottom = order[order.length - 1]
        const lowOrder = snapshot.tables[lowId]
        const up = snapshot.champs[lowId] ?? lowOrder?.[0]
        const barKept = topId === 'prem' && snapshot.bar?.played && (snapshot.bar.homeScore > snapshot.bar.awayScore ? snapshot.bar.homeId : snapshot.bar.awayId) === bottom
        const bNow = g.clubs[bottom]?.leagueId, uNow = g.clubs[up]?.leagueId
        if (barKept) {
          if (bNow !== topId || uNow !== lowId) bad(`${t} ${topId} BAR kept but bottom now ${bNow}, up now ${uNow}`)
          moves.push(`${t} ${topId}: ${bottom} survived playoff v ${up} (${snapshot.bar.homeScore}-${snapshot.bar.awayScore})`)
        } else {
          if (bNow !== lowId) bad(`${t} ${topId} bottom ${bottom} not relegated (now ${bNow})`)
          if (uNow !== topId) bad(`${t} ${lowId} champion ${up} not promoted (now ${uNow})`)
          moves.push(`${t} ${topId}: ${up} up, ${bottom} down${snapshot.bar ? ` (bar ${snapshot.bar.homeId} ${snapshot.bar.homeScore}-${snapshot.bar.awayScore} ${snapshot.bar.awayId})` : ''}`)
          yoyo.set(bottom, (yoyo.get(bottom) ?? 0) + 1); yoyo.set(up, (yoyo.get(up) ?? 0) + 1)
        }
      }
      // CC entrants follow tables
      if (gender === 'm' && g.comps.cc) {
        const exp = new Set([...snapshot.tables.prem.slice(0, 5), ...snapshot.tables.top14.slice(0, 6), ...snapshot.tables.urc.slice(0, 5)])
        const miss = [...exp].filter(id => !g.comps.cc.teamIds.includes(id))
        if (miss.length) bad(`${t} cc entrants missing table qualifiers ${miss.join(',')}`)
      }
      // league membership counts preserved
      for (const def of defs) {
        const n = Object.values(g.clubs).filter(c => c.leagueId === def.id).length
        if (n !== def.clubs.length) bad(`${t} ${def.id} now has ${n} clubs`)
      }
      // clubs not in any defined league
      for (const c of Object.values(g.clubs)) if (!defs.some(d => d.id === c.leagueId)) bad(`${t} club ${c.id} in unknown league ${c.leagueId}`)
    } else {
      checkWeekly()
    }
  }
  if (g.season !== target) bad(`season did not advance (stuck at ${g.season} week ${g.week})`)
}
console.log(`--- ${gender} seed ${seed}: ${SEASONS} seasons, ${fails} invariant failures`)
for (const m of moves) console.log('MOVE', m)
console.log('yo-yo counts:', [...yoyo.entries()].filter(([, n]) => n >= 3).map(([id, n]) => `${id}:${n}`).join(' ') || 'none >=3')
console.log(`finals with call-up absentees: ${stats.finalsMissing.length}`)
for (const m of stats.finalsMissing.slice(0, 12)) console.log('FINAL', m)
for (const [k, n] of seenMsg) if (n > 3) console.log(`(suppressed ${n - 3} more: ${k})`)
