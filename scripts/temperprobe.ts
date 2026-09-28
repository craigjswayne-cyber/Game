/**
 * ---- HIS NERVE AND HIS MINUTES, IN WORDS (1.8.0, E7 + E8) ----
 *
 * E8. Hidden consistency and big-match temperament (attributes.ts) have moved
 * every match since 25D-2 and were never shown. game/temperament.ts now lets
 * scouting hint at them, as sure as the club's knowledge of the man:
 *   another club's man: nothing below a detailed report, hedged at stage 2,
 *   plain at the full file; your own: a one-line "too early" until FAIR_APPS
 *   matches for you, hedged until KNOWN_APPS, plain after, and a good analyst
 *   counts for matches of his own.
 * And what the words say must be what the numbers are: the steady band has
 * the narrowest wobble, the erratic band the widest, the big-stage band the
 * highest temperament.
 *
 * E7. The summer growth roll docks a young senior with two starts or fewer
 * (rollover.ts devFactor, -0.10), and the weekly morale drift docks a man
 * frozen out of the side. A professional (attributes.ts professionalism: the
 * Professional character, half for a Leader, plus the top of his work rate)
 * now loses up to half as much of both, and his player page says so.
 *
 * Run: npx vite-node scripts/temperprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { benchDrag, bigMatchTemper, consistency, professionalism } from '../src/game/attributes'
import { devFactor } from '../src/game/rollover'
import { benchNote, bigBand, consBand, FAIR_APPS, KNOWN_APPS, readLevel, temperRead } from '../src/game/temperament'
import { tIn } from '../src/game/i18n'
import type { Player } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const g = newGame('northampton', 'Temper', 9)

console.log('--- E8: the words match the numbers')
{
  const all = Object.values(g.players)
  const share = (f: (p: Player) => boolean) => all.filter(f).length / all.length
  const st = share(p => consBand(g.seed, p.id) === 'steady'), er = share(p => consBand(g.seed, p.id) === 'erratic')
  const th = share(p => bigBand(g.seed, p.id) === 'thrive'), fr = share(p => bigBand(g.seed, p.id) === 'freeze')
  console.log(`  consistency: ${(st * 100).toFixed(0)}% reliable, ${(er * 100).toFixed(0)}% hot and cold; big games: ${(th * 100).toFixed(0)}% thrive, ${(fr * 100).toFixed(0)}% can freeze`)
  ok([st, er, th, fr].every(x => x > 0.25 && x < 0.35), 'each end is about three in ten, so neither word is everyone')
  const wob = (b: string) => { const xs = all.filter(p => consBand(g.seed, p.id) === b).map(p => consistency(g.seed, p.id)); return Math.max(...xs) }
  const wobMin = (b: string) => Math.min(...all.filter(p => consBand(g.seed, p.id) === b).map(p => consistency(g.seed, p.id)))
  ok(wob('steady') < wobMin('mid') && wob('mid') < wobMin('erratic'), `"reliable" has the narrowest match-day wobble (up to ${wob('steady').toFixed(3)}), "hot and cold" the widest (from ${wobMin('erratic').toFixed(3)})`)
  const temper = (b: string) => all.filter(p => bigBand(g.seed, p.id) === b).map(p => bigMatchTemper(g.seed, p.id))
  ok(Math.min(...temper('thrive')) > Math.max(...temper('mid')) && Math.min(...temper('mid')) > Math.max(...temper('freeze')), '"thrives on the big stage" is the top of the temperament scale, "can freeze" the bottom')
}

console.log('--- E8: another club\'s man, by scouting')
{
  const p = Object.values(g.players).find(q => q.clubId && q.clubId !== g.userClubId && !q.acad)!
  const at = (sc: number) => { p.sc = sc; return temperRead(g, p) }
  ok(at(20).lines.length === 0 && readLevel(g, p) === 'none', 'unscouted (20%): nothing at all')
  ok(at(45).lines.length === 0, 'a weekend of tape (45%): still nothing')
  const v = at(60)
  ok(v.level === 'vague' && v.lines.length === 2 && v.lines.every(l => l.k.endsWith('V')), `a detailed report (60%): two hedged lines (${v.lines.map(l => l.k).join(', ')})`)
  const f = at(95)
  ok(f.level === 'full' && f.lines.every(l => !l.k.endsWith('V')), `the full file (95%): the plain words (${f.lines.map(l => tIn('en', l.k)).join(' ')})`)
}

console.log('--- E8: your own man, by matches or the analyst')
{
  const p = g.clubs[g.userClubId].players.map(id => g.players[id]).find(q => q && !q.acad && q.career.every(r => r.clubId !== g.userClubId))!
  p.stats.apps = 0
  g.staff.assistant = 0
  g.clubs[g.userClubId].facilities = { ...(g.clubs[g.userClubId].facilities ?? {}), briefing: 0 }
  const pend = temperRead(g, p)
  ok(pend.level === 'pending' && pend.lines[0].k === 'player.tempPending', `a new signing: "${tIn('en', pend.lines[0].k, pend.lines[0].v)}"`)
  p.stats.apps = FAIR_APPS
  ok(readLevel(g, p) === 'vague', `${FAIR_APPS} matches for the club: a hedged read`)
  p.stats.apps = KNOWN_APPS
  ok(readLevel(g, p) === 'full', `${KNOWN_APPS} matches: the plain words`)
  p.stats.apps = 0
  g.clubs[g.userClubId].facilities!.briefing = 3; g.staff.assistant = 3
  ok(readLevel(g, p) === 'full', 'no matches, but a briefing suite at 3 and a level-3 assistant: the analyst has done the homework')
}

console.log('--- E7: a professional loses less for sitting out')
{
  const base = Object.values(g.players).find(q => q.clubId && q.clubId !== g.userClubId && !q.acad && q.age >= 19 && q.age <= 21)!
  const man = (pers: Player['pers'], wor: number, lastStarts: number) =>
    ({ ...base, pers, a: { ...base.a, wor }, lastStarts, age: base.age + 1 } as Player)
  ok(professionalism(man('Professional', 20, 0)) === 1 && professionalism(man('Mercenary', 8, 0)) === 0,
    'professionalism: a Professional with a work rate of 20 is 1, a Mercenary with 8 is 0')
  const drag = (pers: Player['pers'], wor: number) => devFactor(g, man(pers, wor, 5)) - devFactor(g, man(pers, wor, 0))
  const loyal = drag('Loyal', 8), pro = drag('Professional', 18), leader = drag('Leader', 12)
  // the old code docked every man 0.10 for two starts or fewer, less the -0.012 middle band
  console.log(`  growth lost to a season of 0 starts (v 5): Loyal, work rate 8: ${loyal.toFixed(3)}; Leader, 12: ${leader.toFixed(3)}; Professional, 18: ${pro.toFixed(3)} (every man 0.088 before)`)
  ok(Math.abs(loyal - 0.088) < 1e-9, 'a man with no professionalism pays exactly what he always did')
  ok(pro < loyal * 0.65 && leader < loyal && leader > pro, 'a professional pays well under two thirds of it, a leader in between')
  ok(benchDrag(man('Professional', 20, 0)) === 0.5, 'and never less than half: minutes still matter')

  // the weekly morale drift for a man frozen out: 0.2 a week, softened the same way
  console.log(`  a week frozen out costs morale 0.200 (Loyal, 8), ${(0.2 * benchDrag(man('Leader', 12, 0))).toFixed(3)} (Leader, 12), ${(0.2 * benchDrag(man('Professional', 18, 0))).toFixed(3)} (Professional, 18); Mercenary and Ambitious 0.35 as before`)

  // and the player page says so
  const kid = g.clubs[g.userClubId].players.map(id => g.players[id]).find(q => q && !q.acad && q.age <= 22)!
  kid.stats.starts = 1
  g.week = 20
  kid.pers = 'Loyal'; kid.a.wor = 9
  const n1 = benchNote(g, kid)
  kid.pers = 'Professional'; kid.a.wor = 16
  const n2 = benchNote(g, kid)
  ok(n1?.k === 'player.benchNote' && n2?.k === 'player.benchNotePro', `his page explains it: "${n1 && tIn('en', n1.k, n1.v)}" / "${n2 && tIn('en', n2.k, n2.v)}"`)
  kid.stats.starts = 3
  ok(benchNote(g, kid) === null, 'three starts: nothing to say')
}

console.log(fails ? `\n${fails} FAILURES` : '\nTEMPER PROBE PASSED: the scouts name his nerve, and a pro keeps working')
process.exit(fails ? 1 : 0)
