// Extreme lineups, tactics, roles, playbook, bench splits: crash / NaN / impossible output hunt.
import { newGame } from '../../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../../src/game/season'
import { beginMatch, stepTick, resolveDecision, simMatch, lineupFor, teamUnits, matchStats } from '../../src/game/matchEngine'
import { rolesForSlot } from '../../src/game/roles'
import { ROUTINES } from '../../src/game/playbook'
import type { GameState } from '../../src/game/model'

const g0 = newGame('leicester', 'QA', 55)
for (let i = 0; i < 4; i++) processWeekAndAdvance(g0)
let fx = userFixtureThisWeek(g0)
while (!fx || fx.compId === 'fr') { processWeekAndAdvance(g0); fx = userFixtureThisWeek(g0) }
const clone = () => JSON.parse(JSON.stringify(g0)) as GameState
const results: string[] = []
function run(label: string, setup: (g: GameState) => void, both = false) {
  const g = clone()
  const club = g.clubs[g.userClubId]
  club.tactic.userPicked = true
  try {
    setup(g)
    const cfx = g.fixtures.find(f => f.id === fx!.id)!
    const opp = cfx.homeId === g.userClubId ? cfx.awayId : cfx.homeId
    if (both) { g.clubs[opp].tactic = JSON.parse(JSON.stringify(club.tactic)); g.clubs[opp].tactic.lineup = lineupFor(g, opp) }
    const ctx = beginMatch(g, cfx, weekRng(g), true, g.userClubId)
    let guard = 0
    while (ctx.seg < 3 && guard++ < 60) { if (ctx.decision) resolveDecision(g, ctx, 'corner'); const r = stepTick(g, ctx); if (ctx.decision) resolveDecision(g, ctx, 'tap'); if (r === 'FT') break }
    const st = matchStats(ctx)
    const u = ctx.home.units
    const bad: string[] = []
    for (const [k, v] of Object.entries(u)) if (k !== 'kickerId' && !Number.isFinite(v as number)) bad.push(`unit ${k}=${v}`)
    for (const s of [ctx.home, ctx.away]) {
      if (!Number.isFinite(s.score) || s.score < 0 || s.score > 150) bad.push(`score ${s.score}`)
      for (const [id, r] of s.finalR ?? []) if (!Number.isFinite(r) || r < 1 || r > 10) bad.push(`rating ${id}=${r}`)
      for (const [id, e] of s.energy) if (!Number.isFinite(e)) bad.push(`energy ${id}=${e}`)
      if (s.onPitch.size > 15) bad.push(`onPitch ${s.onPitch.size}`)
    }
    if (!Number.isFinite(st.possession[0])) bad.push(`poss ${st.possession}`)
    for (const id of Object.keys(g.players).slice(0, 2000)) { const p = g.players[+id]; if (!Number.isFinite(p.cond) || !Number.isFinite(p.form) || !Number.isFinite(p.morale)) { bad.push(`player ${p.name} cond=${p.cond} form=${p.form} morale=${p.morale}`); break } }
    if (ctx.seg !== 3) bad.push(`did not finish tick=${ctx.tick}`)
    results.push(`${bad.length ? 'BAD ' : 'ok  '} ${label.padEnd(44)} ${cfx.homeScore}-${cfx.awayScore} onPitch ${ctx.home.onPitch.size}/${ctx.away.onPitch.size} poss ${st.possession} ${bad.join('; ')}`)
  } catch (err) {
    results.push(`CRASH ${label}: ${(err as Error).message} @ ${(err as Error).stack?.split('\n')[1]?.trim()}`)
  }
}
const setLineup = (g: GameState, lu: (number | null)[]) => { g.clubs[g.userClubId].tactic.lineup = lu }
const squad = (g: GameState) => g.clubs[g.userClubId].players.map(id => g.players[id])
run('baseline', () => {})
run('lineup all null', g => setLineup(g, new Array(23).fill(null)))
run('lineup all null, whole squad injured', g => { setLineup(g, new Array(23).fill(null)); for (const p of squad(g)) p.injury = { desc: 'x', dk: 'injury.ribs', until: 99, weeks: 9 } })
run('whole squad banned', g => { for (const p of squad(g)) p.bans = 5 })
run('only 5 fit players', g => { squad(g).slice(5).forEach(p => { p.injury = { desc: 'x', dk: 'injury.ribs', until: 99, weeks: 9 } }); setLineup(g, new Array(23).fill(null)) })
run('only 14 fit players', g => { squad(g).slice(14).forEach(p => { p.injury = { desc: 'x', dk: 'injury.ribs', until: 99, weeks: 9 } }); setLineup(g, new Array(23).fill(null)) })
run('all forwards in XV, empty bench', g => { const f = squad(g).filter(p => ['LP', 'HK', 'TP', 'LK', 'FL', 'N8'].includes(p.pos)).slice(0, 15).map(p => p.id); setLineup(g, [...f, ...new Array(23 - f.length).fill(null)]) })
run('all backs in XV, empty bench', g => { const f = squad(g).filter(p => ['SH', 'FH', 'CE', 'WG', 'FB'].includes(p.pos)).slice(0, 15).map(p => p.id); setLineup(g, [...f, ...new Array(23 - f.length).fill(null)]) })
run('prop at fly-half, fly-half at prop', g => { const lu = lineupFor(g, g.userClubId).slice(); const t = lu[0]; lu[0] = lu[9]; lu[9] = t; setLineup(g, lu) })
run('no scrum-half anywhere', g => { for (const p of squad(g)) if (p.pos === 'SH' || p.alt.includes('SH')) p.injury = { desc: 'x', dk: 'injury.ribs', until: 99, weeks: 9 }; setLineup(g, new Array(23).fill(null)) })
run('no kicker (goa=1 everywhere), named kicker null', g => { for (const p of squad(g)) p.a.goa = 1; g.clubs[g.userClubId].tactic.kickers = [null as unknown as number] })
run('0 on bench (XV only)', g => { const lu = lineupFor(g, g.userClubId).slice(0, 15); setLineup(g, [...lu, ...new Array(8).fill(null)]) })
run('one front-rower only in 23', g => { for (const p of squad(g)) if (['LP', 'HK', 'TP'].includes(p.pos) || p.alt.some(a => ['LP', 'HK', 'TP'].includes(a))) p.injury = { desc: 'x', dk: 'injury.ribs', until: 99, weeks: 9 }; setLineup(g, new Array(23).fill(null)) })
run('sliders NaN', g => { const t = g.clubs[g.userClubId].tactic; t.style = NaN; t.tempo = NaN; t.kicking = NaN; t.aggression = NaN; (t as any).defLine = NaN; (t as any).defWidth = NaN }, true)
run('sliders 1e9 / -1e9', g => { const t = g.clubs[g.userClubId].tactic; t.style = 1e9; t.tempo = -1e9; t.kicking = 1e9; t.aggression = -1e9; (t as any).defLine = 1e9; (t as any).defWidth = -1e9 }, true)
run('sliders 100/100/100/100 both sides', g => { const t = g.clubs[g.userClubId].tactic; t.style = 100; t.tempo = 100; t.kicking = 100; t.aggression = 100; (t as any).defLine = 100; (t as any).defWidth = 100 }, true)
run('sliders 0/0/0/0 both sides', g => { const t = g.clubs[g.userClubId].tactic; t.style = 0; t.tempo = 0; t.kicking = 0; t.aggression = 0; (t as any).defLine = 0; (t as any).defWidth = 0 }, true)
run('strongest v weakest (all 20 v all 1)', g => { const cfx = g.fixtures.find(f => f.id === fx!.id)!; const opp = cfx.homeId === g.userClubId ? cfx.awayId : cfx.homeId
  for (const p of squad(g)) for (const k of Object.keys(p.a)) (p.a as any)[k] = 20
  for (const id of g.clubs[opp].players) for (const k of Object.keys(g.players[id].a)) (g.players[id].a as any)[k] = 1 })
run('weakest v strongest (all 1 v all 20)', g => { const cfx = g.fixtures.find(f => f.id === fx!.id)!; const opp = cfx.homeId === g.userClubId ? cfx.awayId : cfx.homeId
  for (const p of squad(g)) for (const k of Object.keys(p.a)) (p.a as any)[k] = 1
  for (const id of g.clubs[opp].players) for (const k of Object.keys(g.players[id].a)) (g.players[id].a as any)[k] = 20 })
run('identical teams (opp squad = deep copy of ours)', g => { const cfx = g.fixtures.find(f => f.id === fx!.id)!; const opp = cfx.homeId === g.userClubId ? cfx.awayId : cfx.homeId
  const mine = squad(g); g.clubs[opp].players.forEach((id, i) => { const src = mine[i % mine.length]; const dst = g.players[id]; dst.a = { ...src.a }; dst.ca = src.ca; dst.cond = src.cond; dst.form = src.form; dst.pos = src.pos; dst.alt = [...src.alt] }) })
run('all 0 condition / 0 sta', g => { for (const p of squad(g)) { p.cond = 0; p.a.sta = 0 } })
run('all cond 100, sta 20, morale 10', g => { for (const p of squad(g)) { p.cond = 100; p.a.sta = 20; p.morale = 10; p.form = 10 } })
run('all players Hot Head + aggression 20', g => { for (const p of squad(g)) { p.trait = 'Hot Head'; p.a.agg = 20 } })
run('every role on every slot: option 0', g => { g.clubs[g.userClubId].tactic.roles = Array.from({ length: 15 }, (_, i) => rolesForSlot(i)[0].id) })
run('every role on every slot: last option', g => { g.clubs[g.userClubId].tactic.roles = Array.from({ length: 15 }, (_, i) => rolesForSlot(i).slice(-1)[0].id) })
run('illegal roles (jackal x15) via save edit', g => { g.clubs[g.userClubId].tactic.roles = new Array(15).fill('jackal_role') })
for (const lo of ROUTINES.filter(r => r.kind === 'lineout')) for (const sc of ROUTINES.filter(r => r.kind === 'scrum')) {
  run(`playbook ${lo.id} + ${sc.id}`, g => { g.clubs[g.userClubId].tactic.lineoutCall = lo.id; g.clubs[g.userClubId].tactic.scrumCall = sc.id })
}
for (const b of ['5-3', '6-2', '4-4'] as const) for (const brief of ['orders', 'impact', 'shore', 'manage'] as const) {
  run(`bench ${b} briefs all ${brief}`, g => { const t = g.clubs[g.userClubId].tactic; t.bench = b; t.briefs = new Array(8).fill(brief); for (const e of ['box', 'long', 'counter', 'fifty22'] as const) t.exit = e })
}
run('unknown playbook ids / bench split / brief', g => { const t = g.clubs[g.userClubId].tactic; t.lineoutCall = 'nope'; t.scrumCall = 'nah'; (t as any).bench = 'x'; t.briefs = new Array(8).fill('zzz'); (t as any).exit = 'wat'; (t as any).penaltyCall = 'huh' })
run('kickers list of garbage', g => { g.clubs[g.userClubId].tactic.kickers = [-1, 999999999, NaN as unknown as number] })
run('captain = player not in team, vice undefined', g => { g.clubs[g.userClubId].captain = 1; g.clubs[g.userClubId].vice = undefined as any })
run('lineup ids that do not exist', g => setLineup(g, new Array(23).fill(99999999)))
run('lineup ids of another club', g => { const cfx = g.fixtures.find(f => f.id === fx!.id)!; const opp = cfx.homeId === g.userClubId ? cfx.awayId : cfx.homeId; setLineup(g, g.clubs[opp].players.slice(0, 23)) })
run('lineup of 3 entries only', g => setLineup(g, lineupFor(g, g.userClubId).slice(0, 3)))
run('lineup of 40 entries', g => setLineup(g, [...lineupFor(g, g.userClubId), ...lineupFor(g, g.userClubId)]))
for (const r of results) console.log(r)
// unit sanity for a null lineup
const g = clone(); const u = teamUnits(g, new Array(23).fill(null)); console.log('teamUnits(all null):', JSON.stringify(u))
