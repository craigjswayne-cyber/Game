/**
 * ---- THE CAREER ARC (the owner's "mastery" brief) ----
 *
 * What this holds, for arcbook.ts, rivalcoach.ts, repute.ts, chairman.ts,
 * ambitions.ts, erastory.ts and the hooks in arc.ts:
 *
 *   1. RIVALS EMERGE AND ARE TRACKED. A coach met often enough, closely enough,
 *      in a final, becomes the rival; the billing gives the record; a sacked
 *      coach joins the pool and returns at a club whose new idea of rugby is
 *      his; the players he takes from you are counted. Over a real multi-season
 *      sim the book fills by itself and every meeting is on it.
 *   2. TRAITS FOLLOW BEHAVIOUR. Seasons of academy minutes read as a youth
 *      developer, big fees as a spender, a mean defence as a defensive coach,
 *      clubs turned round as a turnaround specialist; no seasons, no traits.
 *      A club offering work cites the strongest.
 *   3. JOB PROFILES DIFFER: the world's clubs read as several kinds of job,
 *      and the board's aim moves with the kind.
 *   4. CHAIRMAN TYPES CHANGE BOARD REACTIONS IN THE RIGHT DIRECTION: the same
 *      result moves an ambitious chairman's board further than a stability
 *      chairman's, the Boardroom's asks lean his way, his wish is judged in May
 *      and the memo carries his line. Two clubs of equal stature have different
 *      men in the chair.
 *   5. AMBITIONS PROGRESS: one to three named, milestones logged and told once.
 *   6. THE ERA SUMMARY IS CORRECT: the record matches the matches played, the
 *      sentence reads the story, a fifth season is told, and leaving tells it.
 *   7. IDENTITY BECOMES REPUTATION, and a player who fits hears it.
 *   8. SAVE MIGRATION: an old save grows an arc; a damaged one is made whole.
 *   9. THE AI NEVER NOTICED: the same world with every arc hook off plays
 *      identical fixtures, ids and scores week by week, a season boundary
 *      included. The returning coaches swap a NAME only, onto a club whose new
 *      philosophy is already his, so the world is unchanged by them too.
 *
 * Run: npx vite-node scripts/careerarcprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { SEASON_WEEKS, boardObjective, type Fixture, type GameState } from '../src/game/model'
import { migrate } from '../src/game/save'
import { resignJob } from '../src/game/jobs'
import { tIn } from '../src/game/i18n'
import { ARC_OFF, arcOf, flushArcNews, migrateArc, type Conduct } from '../src/game/arcbook'
import { coachAfterMatch, coachAppoint, coachAt, coachSacked, coachStakes, coachWeek, coachYearEnd, rivalCoach, RIVAL_AT } from '../src/game/rivalcoach'
import { mgrTraits, reputeYearEnd, traitLine } from '../src/game/repute'
import { offerCite } from '../src/game/jobs'
import { boardSummer, chairAskTilt, chairMemoRow, chairSwing, chairWish, chairmanOf, CHAIR_TYPES, demandedFinish, jobProfile, type ChairType } from '../src/game/chairman'
import { ambitionsOf, ambitionsWeek, setAmbitions } from '../src/game/ambitions'
import { buildEra, eraYearEnd, openEra } from '../src/game/erastory'
import { identityInterestLift } from '../src/game/identity'
import { proteges } from '../src/game/records'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}
const queued = (g: GameState, k: string) => [...g.news, ...(g.arc?.queue ?? [])].filter(n => n.k === k)
const fx = (g: GameState, oppId: string, us: number, them: number, stage?: string): Fixture => ({
  id: 9_000_000 + Math.floor(Math.random() * 1e6), compId: g.clubs[g.userClubId].leagueId, week: g.week,
  homeId: g.userClubId, awayId: oppId, homeScore: us, awayScore: them, played: true, stage,
} as unknown as Fixture)
const keepBoard = (g: GameState) => {
  const c = g.clubs[g.userClubId]
  if (!g.unemployed && c) c.boardConfidence = Math.max(c.boardConfidence, 70)
}

// ---- 1. rivals emerge and are tracked ----
{
  const g = newGame('northampton', 'Rival', 1821)
  const opp = 'exeter'
  const name = g.clubs[opp].coach!
  coachAfterMatch(g, fx(g, opp, 20, 17))
  coachAfterMatch(g, fx(g, opp, 10, 15))
  const c = coachAt(g, opp)!
  ok(!!c && c.n === name && c.w === 1 && c.l === 1 && c.cl === 2, `a coach met is written down, with the record (${c?.n} ${c?.w}-${c?.d}-${c?.l})`)
  ok(!rivalCoach(g), 'two meetings are not a rivalry')
  const st = coachStakes(g, { homeId: g.userClubId, awayId: opp } as Fixture)
  ok(st.some(s => s.text.includes(name) && s.text.includes('won 1, lost 1')), `the billing gives the record (${st[0]?.text})`)
  coachAfterMatch(g, fx(g, opp, 18, 19, 'SF'))
  coachAfterMatch(g, fx(g, opp, 24, 22, 'F'))
  const r = rivalCoach(g)
  ok(!!r && r.id === c.id && c.heat >= RIVAL_AT, `close meetings and a final make him the rival (heat ${c.heat.toFixed(1)})`)
  ok(queued(g, 'arc.rivalBorn').length === 1, 'and the manager is told, once')
  const st2 = coachStakes(g, { homeId: g.userClubId, awayId: opp } as Fixture)
  ok(st2.some(s => s.text.startsWith('Your rival') && s.weight >= 77), `the billing calls him your rival (${st2[0]?.text})`)
  // the players he takes
  const mine = g.clubs[g.userClubId].players.map(id => g.players[id]).find(p => p && !p.acad)!
  ;(g.preContracts ??= []).push({ playerId: mine.id, toClubId: opp, week: g.week })
  coachWeek(g)
  ok(c.po === 1 && queued(g, 'arc.poach').length === 1, `a pre-contract with his club is a player he took from you (${tIn('en', 'arc.poach', queued(g, 'arc.poach')[0]?.v)})`)
  coachWeek(g)
  ok(c.po === 1, 'counted once, not every week')
  // sacked, out of work, back at a club whose new idea is his
  coachSacked(g, g.clubs[opp])
  g.clubs[opp].coach = undefined
  ok(!c.at && c.st[c.st.length - 1].x === 's' && queued(g, 'arc.rivalSacked').length === 1, 'a sacking closes his stint and is told')
  const target = Object.values(g.clubs).find(x => x.id !== g.userClubId && x.id !== opp && x.leagueId !== g.clubs[g.userClubId].leagueId && x.coach)!
  target.philosophy = c.ph
  target.coachGender = c.g ?? 'm'
  const stranger = target.coach
  let back = false
  for (let wk = g.week + 5; wk < g.week + 40 && !back; wk++) {
    const save = g.week
    g.week = wk
    target.coach = stranger
    coachAppoint(g, target)
    back = target.coach === c.n
    if (!back) g.week = save
  }
  ok(back && c.at === target.id, `he returns, at ${target.short}, in place of the stranger (${stranger} -> ${target.coach})`)
  ok(queued(g, 'arc.coachBack').length === 1, 'and the return is news')
  const phBefore = target.philosophy
  ok(phBefore === c.ph, 'with the idea of rugby the club had already chosen: only the name changed')
  // the summer cools it
  const heat0 = c.heat
  coachYearEnd(g)
  ok(c.heat < heat0, `the summer cools the heat (${heat0.toFixed(1)} -> ${c.heat.toFixed(1)})`)
}

// ---- 1b. the book fills by itself over real seasons ----
{
  const g = newGame('bath', 'Seasons', 1822)
  for (let i = 0; i < SEASON_WEEKS * 3; i++) { keepBoard(g); processWeekAndAdvance(g) }
  const a = g.arc!
  const met = a.coaches.reduce((s, c) => s + c.w + c.d + c.l, 0)
  const cur = a.cur!
  ok(a.coaches.length >= 8, `three seasons wrote down ${a.coaches.length} coaches`)
  ok(met > 0 && met <= (cur?.m ?? 0) + 1, `every meeting is on the book (${met} meetings, ${cur?.m} competitive matches in the job)`)
  const top = [...a.coaches].sort((x, y) => (y.w + y.d + y.l) - (x.w + x.d + x.l))[0]
  console.log(`        most met: ${top.n} (${top.w}-${top.d}-${top.l}, heat ${top.heat.toFixed(1)}); rival: ${rivalCoach(g)?.n ?? 'none yet'}; eras told: ${a.eras.length}`)
  ok(a.conduct.length === 3, `a conduct row a season (${a.conduct.length})`)
  ok(JSON.stringify(a).length < 40_000, `and the arc stays small (${JSON.stringify(a).length} bytes after three seasons)`)
  ok(!(a.queue ?? []).length, 'no story left waiting at the end of a week')
  // the men you made are yours: every club's graduates carry homegrown
  const worldHg = Object.values(g.players).filter(p => p.homegrown && p.clubId && p.clubId !== g.userClubId && p.stats.apps > 0).length
  const mine = proteges(g)
  ok(mine.every(p => p.gradClub === g.userClubId) && mine.length < Math.max(1, worldHg),
    `the Legacy graduates line counts only this manager's academy (${mine.length} of ${worldHg} homegrown men elsewhere)`)
}

// ---- 2. traits follow behaviour ----
{
  const g = newGame('leicester', 'Traits', 1823)
  ok(mgrTraits(g).length === 0, 'no seasons, no traits')
  const row = (o: Partial<Conduct>): Conduct => ({
    s: 0, c: g.userClubId, tier: 1, pos: 6, n: 10, m: 24, w: 12, d: 0, l: 12, pf: 24, pa: 24, lg: 24,
    deb: 0, hg: 10, buy: 0, wages: 5_000_000, hard: 0, kind: 0, broke: 0, mor: 6, pats: 1, ...o,
  })
  const a = arcOf(g)
  a.conduct = [0, 1, 2].map(s => row({ s, deb: 3, hg: 35 }))
  ok(mgrTraits(g).some(tr => tr.id.startsWith('youth')), `academy debuts and minutes read as a youth developer (${mgrTraits(g).map(x => x.id)})`)
  a.conduct = [0, 1, 2].map(s => row({ s, buy: 4_000_000 }))
  ok(mgrTraits(g).some(tr => tr.id === 'spender') && !mgrTraits(g).some(tr => tr.id.startsWith('youth')), 'big fees read as a spender, and the youth trait goes with the behaviour')
  a.conduct = [0, 1, 2].map(s => row({ s, pa: 16, lg: 24 }))
  ok(mgrTraits(g).some(tr => tr.id === 'defence'), 'a mean defence reads as a defensive coach')
  a.conduct = [0, 1, 2].map(s => row({ s, pf: 32, lg: 24 }))
  ok(mgrTraits(g).some(tr => tr.id === 'attack'), 'a side that scores reads as an attacking coach')
  a.conduct = [0, 1, 2].map(s => row({ s, hard: 5, kind: 1 }))
  ok(mgrTraits(g).some(tr => tr.id === 'hard'), 'hard calls read as a disciplinarian')
  a.conduct = [0, 1, 2].map(s => row({ s, kind: 4, mor: 7.5 }))
  ok(mgrTraits(g).some(tr => tr.id === 'players'), "kept promises and a happy room read as a players' manager")
  a.conduct = [0, 1, 2].map(s => row({ s, pats: 4, w: 16, l: 8 }))
  ok(mgrTraits(g).some(tr => tr.id === 'innovator'), 'many ideas of rugby, and winning, reads as an innovator')
  a.conduct = []
  a.turned = ['bedford', 'coventry']
  const tr = mgrTraits(g)
  ok(tr[0]?.id === 'turnaround' && tr[0].n === 2, 'two clubs turned round, before any seasons are read')
  const cite = offerCite(g)
  ok(!!cite && tIn('en', cite.k, cite.v) === 'Turned round 2 clubs in trouble.', `a club offering work cites it: "${cite ? tIn('en', cite.k, cite.v) : ''}"`)
  ok(!mgrTraits(g).some(x => /\d/.test(tIn('en', traitLine(x).k, { n: 0 })) && x.id !== 'turnaround' && x.id !== 'youthIntl'), 'no numbers in a trait')
}

// ---- 3. job profiles differ ----
{
  const g = newGame('leicester', 'Jobs', 1824)
  const prof: Record<string, number> = {}
  for (const c of Object.values(g.clubs)) if (c.players.length) prof[jobProfile(g, c.id)] = (prof[jobProfile(g, c.id)] ?? 0) + 1
  console.log(`        profiles in a new world: ${JSON.stringify(prof)}`)
  ok(Object.keys(prof).length >= 5, `the world reads as ${Object.keys(prof).length} kinds of job`)
  ok(jobProfile(g, 'toulouse') === 'giant', `Toulouse is a giant (${jobProfile(g, 'toulouse')})`)
  ok(jobProfile(g, 'newcastle') === 'newcomer', `Newcastle's money is new (${jobProfile(g, 'newcastle')})`)
  ok(jobProfile(g, 'darlington') === 'fallen', `Darlington's great empty ground makes a fallen giant (${jobProfile(g, 'darlington')})`)
  g.clubs.bedford.balance = -50_000
  ok(jobProfile(g, 'bedford') === 'troubled', 'a club in the red is a club in trouble')
  const nc = g.clubs.newcastle
  const base = boardObjective(nc.rep, 10).pos, asked = demandedFinish(g, 'newcastle', 10).pos
  ok(asked < base, `a newcomer's board asks for more than its stature would (${base} -> ${asked})`)
  const dar = g.clubs.darlington
  ok(demandedFinish(g, 'darlington', 12).pos < boardObjective(dar.rep, 12).pos, 'and so does a fallen giant\'s')
  const acad = Object.values(g.clubs).find(c => c.players.length && jobProfile(g, c.id) === 'academy')
  ok(!!acad && demandedFinish(g, acad.id, 12).pos >= boardObjective(acad.rep, 12).pos, `an academy club's board is more patient (${acad?.short})`)
}

// ---- 4. chairman types, felt in the right direction ----
{
  const g0 = newGame('gloucester', 'Chair', 1825)
  const kinds = new Set(Object.values(g0.clubs).filter(c => c.players.length).map(c => chairmanOf(g0, c.id)))
  ok(kinds.size === 4, 'all four kinds of chairman sit somewhere in the world')
  const same = Object.values(g0.clubs).filter(c => c.rep === 78 && c.players.length)
  ok(new Set(same.map(c => chairmanOf(g0, c.id))).size >= 2, `clubs of equal stature have different men in the chair (${same.map(c => `${c.short}:${chairmanOf(g0, c.id)}`).join(' ')})`)
  // the salt that seats each kind at the manager's club
  const seat = (g: GameState, want: ChairType) => {
    const a = arcOf(g)
    for (let s = 0; s < 64; s++) { a.chairSalt[g.userClubId] = s; if (chairmanOf(g, g.userClubId) === want) return }
    throw new Error('no salt for ' + want)
  }
  seat(g0, 'ambition'); const amb = chairSwing(g0)
  const ambFunds = chairAskTilt(g0, 'funds'), ambTime = chairAskTilt(g0, 'time')
  seat(g0, 'stability'); const stab = chairSwing(g0)
  const stabFunds = chairAskTilt(g0, 'funds'), stabTime = chairAskTilt(g0, 'time')
  ok(amb > 1 && stab < 1, `an ambitious chairman's board swings more, a stability chairman's less (${amb} / ${stab})`)
  ok(ambFunds > stabFunds && stabTime > ambTime, 'the ambitious one opens the purse sooner, the stable one gives time sooner')
  seat(g0, 'youth')
  ok(['debuts', 'homegrown'].includes(chairWish(g0) ?? ''), `a youth chairman wishes for the academy (${chairWish(g0)})`)
  ok(chairMemoRow(g0)?.k === `arc.memo.youth${g0.clubs[g0.userClubId].boardConfidence >= 55 ? 'Good' : 'Poor'}`, 'and his line is in the memo')
  const c0 = g0.clubs[g0.userClubId].boardConfidence
  boardSummer(g0, { pos: 5, deb: chairWish(g0) === 'debuts' ? 4 : 0 })
  const c1 = g0.clubs[g0.userClubId].boardConfidence
  ok(chairWish(g0) === 'debuts' ? c1 > c0 : c1 < c0, `his wish is judged in May (${c0} -> ${c1})`)
  // the same week, played twice: only the man in the chair differs
  const base = JSON.stringify(g0)
  const play = (want: ChairType) => {
    const g = migrate(JSON.parse(base) as GameState)
    seat(g, want)
    const c = g.clubs[g.userClubId]
    let delta = 0, score = ''
    for (let i = 0; i < 12; i++) {
      const f = g.fixtures.find(x => x.week === g.week && !x.played && x.compId !== 'fr' && (x.homeId === c.id || x.awayId === c.id))
      c.boardConfidence = 60
      processWeekAndAdvance(g)
      if (f?.played && f.homeScore !== f.awayScore) { delta = c.boardConfidence - 60; score = `${f.homeScore}-${f.awayScore}`; break }
    }
    return { delta, score }
  }
  const A = play('ambition'), S = play('stability')
  ok(A.score !== '' && A.score === S.score, `the same match either way (${A.score})`)
  ok(Math.sign(A.delta) === Math.sign(S.delta) && Math.abs(A.delta) > Math.abs(S.delta),
    `and the ambitious board took it harder than the stable one (${A.delta.toFixed(2)} against ${S.delta.toFixed(2)})`)
}

// ---- 5. ambitions ----
{
  const g = newGame('bedford', 'Ambition', 1826)
  setAmbitions(g, ['league', 'academy', 'legend', 'intl'])
  const list = ambitionsOf(g)
  ok(list.length === 3 && g.dream?.id === 'league', `three at most, the first is the dream (${list.map(a => a.id)})`)
  ambitionsWeek(g)
  ok(!queued(g, 'arc.ambStep').length && !queued(g, 'arc.ambDone').length, 'nothing is news on day one')
  g.mgr.trophies.push({ compId: g.clubs[g.userClubId].leagueId, season: g.season, clubId: g.userClubId })
  ambitionsWeek(g)
  const done = queued(g, 'arc.ambDone')
  ok(done.length === 1 && g.ambitions![0].log?.[0]?.p === 100, `a league title realises the first, logged and told (${done[0] ? tIn('en', done[0].k!, done[0].v) : 'none'})`)
  const club = g.clubs[g.userClubId]
  let made = 0
  for (const id of club.players) {
    const p = g.players[id]
    if (!p || p.acad || made >= 4) continue
    p.homegrown = true; p.stats.apps = 3; made++
  }
  ambitionsWeek(g)
  const step = queued(g, 'arc.ambStep')
  ok(step.length === 1 && step[0].v?.pct === 50, `four graduates are half an academy: a milestone (${step[0] ? tIn('en', step[0].k!, step[0].v) : 'none'})`)
  ambitionsWeek(g)
  ok(queued(g, 'arc.ambStep').length === 1, 'and told once')
  const old = newGame('bath', 'Old', 1827)
  old.dream = { id: 'dynasty', clubId: old.userClubId, season: 0 }
  delete old.ambitions
  ambitionsWeek(old)
  ok(old.ambitions?.length === 1 && old.ambitions[0].id === 'dynasty', 'a save with only a dream has it as its first ambition')
}

// ---- 6. the era summary ----
{
  const g = newGame('saracens', 'Era', 1828)
  let played = 0
  for (let i = 0; i < 20; i++) {
    keepBoard(g)
    processWeekAndAdvance(g)
  }
  played = g.fixtures.filter(f => f.played && f.compId !== 'fr' && (f.homeId === g.userClubId || f.awayId === g.userClubId)).length
  const cur = g.arc!.cur!
  ok(cur.m === played && cur.w + cur.d + cur.l === cur.m, `the job's record is every competitive match (${cur.w}-${cur.d}-${cur.l} of ${played})`)
  const e = buildEra(g, '5')!
  ok(!!e.gw && e.gw.us > e.gw.them && !!e.wd && e.wd.us < e.wd.them, 'the greatest win is a win and the worst defeat a defeat')
  // the sentence reads the story
  cur.pos0 = 9
  g.mgr.trophies.push({ compId: 'cc', season: g.season, clubId: g.userClubId })
  const told = buildEra(g, '5')!
  const line = tIn('en', told.sk, told.sv)
  ok(told.sk === 'arc.storyEurope' && line.includes('from 9th') && line.includes('Continental Cup'), `"${line}"`)
  g.mgr.trophies.pop()
  cur.f = g.season - 4
  ok(eraYearEnd(g), 'a fifth season is a season to tell')
  cur.f = g.season
  resignJob(g)
  const era = g.arc!.eras[g.arc!.eras.length - 1]
  ok(!!era && era.why === 'w' && era.m === played && !g.arc!.cur, `walking out tells the era and closes it (${era?.w}-${era?.d}-${era?.l}, "${era ? tIn('en', era.sk, era.sv) : ''}")`)
  ok(g.news.some(n => n.k === 'arc.eraEnd'), 'and it is a news moment the same day')
}

// ---- 7. identity becomes reputation ----
{
  const g = newGame('exeter', 'Repute', 1829)
  g.identity = { clubId: g.userClubId, v: { play: 0, pack: 0, recruit: 60, purse: 0 }, labels: ['academy'] }
  const kid = Object.values(g.players).find(p => p.clubId !== g.userClubId && p.age <= 20 && !p.acad)!
  const before = identityInterestLift(g, kid)
  for (let i = 0; i < 3; i++) reputeYearEnd(g)
  ok(!g.arc!.repute, 'three seasons of a label is not yet a reputation')
  reputeYearEnd(g)
  ok(g.arc!.repute?.l === 'academy' && queued(g, 'arc.reputeForms').length === 1, `the fourth makes it stick: "${tIn('en', 'arc.reputeForms', queued(g, 'arc.reputeForms')[0]?.v)}"`)
  ok(identityInterestLift(g, kid) === before + 2, `and a young player hears a little more of it (${before} -> ${identityInterestLift(g, kid)})`)
  g.identity = { ...g.identity, labels: [] }
  for (let i = 0; i < 3; i++) reputeYearEnd(g)
  ok(!g.arc!.repute && queued(g, 'arc.reputeFades').length === 1, 'three seasons without it and the reputation fades')
}

// ---- 8. save migration ----
{
  const g = newGame('bristol', 'Migrate', 1830)
  for (let i = 0; i < 3; i++) processWeekAndAdvance(g)
  const raw = JSON.parse(JSON.stringify(g)) as GameState
  delete raw.arc; delete raw.ambitions
  const m = migrate(raw)
  ok(!m.arc, 'an old save loads without an arc invented for it')
  processWeekAndAdvance(m)
  ok(!!m.arc && !!m.arc.cur, 'and grows one the first week it is played')
  const bad = JSON.parse(JSON.stringify(m)) as GameState
  ;(bad.arc as unknown as Record<string, unknown>).coaches = [{ id: 'x' }, null, { id: 3, n: 'Kept', st: 'no' }]
  ;(bad.arc as unknown as Record<string, unknown>).conduct = 'junk'
  ;(bad.arc as unknown as Record<string, unknown>).cur = { c: 7 }
  ;(bad as unknown as Record<string, unknown>).ambitions = 'junk'
  const fixed = migrate(bad)
  ok(fixed.arc!.coaches.length === 1 && Array.isArray(fixed.arc!.coaches[0].st) && Array.isArray(fixed.arc!.conduct) && !fixed.arc!.cur && !fixed.ambitions,
    'a damaged arc is made whole: bad rows go, good ones stay')
  processWeekAndAdvance(fixed)
  ok(!!fixed.arc!.cur, 'and plays on')
  const junk = { arc: 5 } as unknown as GameState
  migrateArc(junk)
  ok(junk.arc === undefined, 'an arc that is not an object is dropped')
}

// ---- 9. the AI never noticed ----
{
  const WEEKS = SEASON_WEEKS + 10
  const sig = (g: GameState) => g.fixtures
    .map(f => `${f.id}:${f.compId}:${f.homeId}${f.played ? `${f.homeScore}-${f.awayScore}` : '_'}${f.awayId}`).join('|')
  const run = () => {
    const g = newGame('harlequins', 'Twin', 1831)
    const weeks: string[] = [], ids: number[] = []
    for (let i = 0; i < WEEKS; i++) {
      const c = g.clubs[g.userClubId]
      if (!g.unemployed && c) c.boardConfidence = 80
      processWeekAndAdvance(g)
      weeks.push(sig(g)); ids.push(g.nextId)
    }
    return { g, weeks, ids }
  }
  const on = run()
  ARC_OFF.on = true
  const off = run()
  ARC_OFF.on = false
  const drift = Math.max(...on.ids.map((x, i) => Math.abs(x - off.ids[i])))
  ok(drift === 0, `the arc moved the shared id counter by ${drift} in ${WEEKS} weeks`)
  const first = on.weeks.findIndex((w, i) => w !== off.weeks[i])
  ok(first === -1, first === -1
    ? `every fixture id and every score identical with the arc on and off, week by week, for ${WEEKS} weeks`
    : `fixtures first differ after week ${first + 1}`)
  const returns = on.g.news.filter(n => n.k === 'arc.coachBack' || n.k === 'arc.coachBackHome').length
  const renamed = Object.values(on.g.clubs).filter(c => c.coach && off.g.clubs[c.id]?.coach !== c.coach).length
  console.log(`        coaches back in work under their own name: ${renamed} dugouts (${returns} told); arc stories: ${on.g.news.filter(n => n.k?.startsWith('arc.')).length}`)
  ok(!!on.g.arc && !off.g.arc, 'and the switch really did switch it')
  const ids = on.g.news.map(n => n.id)
  ok(new Set(ids).size === ids.length, 'no two stories share an id')
  flushArcNews(on.g)
}

console.log(fails ? `CAREER ARC PROBE FAILED (${fails})` : 'CAREER ARC PROBE PASSED: the world knows who you are, and the AI never noticed')
process.exit(fails ? 1 : 0)
