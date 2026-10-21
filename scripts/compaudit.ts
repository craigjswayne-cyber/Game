/**
 * ---- THE COMPETITIONS AND THE BOOKS, SEASON AFTER SEASON (1.9.4 audit) ----
 *
 * Several full seasons in both worlds, on several seeds, with the manager's
 * own match played the way the app's assistant plays it (lib/savegen
 * playWeek). Checked on the last week of every season, before the rollover
 * wipes it, and again on the first week of the next:
 *
 *   LEAGUES  every regular fixture played; each pair met the number of times
 *            the format says (twice, home and away, in a double round robin;
 *            the UPC's shield mates twice and everybody else once); no club
 *            more than one home game off even; the table is the fixtures
 *            replayed through the points rules, bonus points and an
 *            administration penalty included
 *   PLAY-OFFS the right clubs in the first round for the format, each later
 *            round made of the previous round's winners, one final, the
 *            champion is the final's winner and the roll of honour has it
 *            once; a league with no play-off crowns the top of its table
 *   CUPS     pool games inside the pool, a double round robin, the quarter or
 *            semi-final draw made of pool winners and runners-up with no pool
 *            rematch, the champion the final's winner (Continental Cup,
 *            Shield, the MRC Cup, the women's continental cup)
 *   SLOTS    no club twice on one day of one week
 *   SUMMER   promotion and relegation read off the final tables (and the
 *            English relegation play-off where it was played); every league
 *            of the new season holds exactly the clubs whose leagueId names
 *            it, the same number as before; the new fixture list is unplayed
 *   BOOKS    last season's closing balance is this season's opening; the
 *            prize line is what the final table pays; the manager's balance
 *            moves only by what the sheet explains
 *
 *   npx vite-node scripts/compaudit.ts            (PROBE_QUICK=1: fewer seasons)
 */
import { newGame, LEAGUE_DEFS } from '../src/game/newgame'
import { RELEGATES, SEASON_WEEKS, tieWinner, type Competition, type Fixture, type GameState } from '../src/game/model'
import { applyToTable } from '../src/game/season/tables'
import { emptyRow, sortTable, MRC_CUP } from '../src/game/schedule'
import { adminPenalty } from '../src/game/insolvency'
import { sheetOf } from '../src/game/books'
import { genderOf } from '../src/game/gender'
import { ok, check, done } from './lib/probe'

process.env.SAVEGEN_LIB = '1'
process.env.KEEPJOB = '1'
const { playWeek } = await import('./lib/savegen')

const QUICK = !!process.env.PROBE_QUICK

type Run = { label: string; club: string; gender: 'm' | 'w'; seed: number; seasons: number }
const W1 = LEAGUE_DEFS('w')[0].clubs[0].id
const W2 = LEAGUE_DEFS('w').find(d => d.id.endsWith('champ'))!.clubs[0].id
const CH = LEAGUE_DEFS('m').find(d => d.id === 'champ')!.clubs[0].id
const RUNS: Run[] = QUICK
  ? [
    { label: 'men, Leicester', club: 'leicester', gender: 'm', seed: 1101, seasons: 2 },
    { label: 'women, top flight', club: W1, gender: 'w', seed: 2202, seasons: 2 },
  ]
  : [
    { label: 'men, Leicester', club: 'leicester', gender: 'm', seed: 1101, seasons: 3 },
    { label: 'men, Championship', club: CH, gender: 'm', seed: 3303, seasons: 3 },
    { label: 'women, top flight', club: W1, gender: 'w', seed: 2202, seasons: 3 },
    { label: 'women, second tier', club: W2, gender: 'w', seed: 4404, seasons: 3 },
  ]

const KO = new Set(['QF', 'SF', 'F', 'BAR'])
const isKo = (f: Fixture) => !!f.stage && KO.has(f.stage)
const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

let problems = 0
function bad(tag: string, msg: string) {
  problems++
  if (problems <= 60) console.log(`FAIL  ${tag}: ${msg}`)
}

function leagueChecks(g: GameState, comp: Competition, tag: string) {
  const fx = g.fixtures.filter(f => f.compId === comp.id && !f.stage)
  const unplayed = fx.filter(f => !f.played)
  if (unplayed.length) bad(tag, `${comp.id}: ${unplayed.length} regular fixtures unplayed at the season's end`)
  // meetings per pair
  const meet = new Map<string, { n: number; homes: Map<string, number> }>()
  const home = new Map<string, number>(), away = new Map<string, number>()
  for (const f of fx) {
    if (!comp.teamIds.includes(f.homeId) || !comp.teamIds.includes(f.awayId)) bad(tag, `${comp.id}: fixture ${f.homeId} v ${f.awayId} names a club outside the league`)
    if (f.homeId === f.awayId) bad(tag, `${comp.id}: ${f.homeId} plays itself`)
    const k = pairKey(f.homeId, f.awayId)
    const m = meet.get(k) ?? { n: 0, homes: new Map() }
    m.n++; m.homes.set(f.homeId, (m.homes.get(f.homeId) ?? 0) + 1)
    meet.set(k, m)
    home.set(f.homeId, (home.get(f.homeId) ?? 0) + 1)
    away.set(f.awayId, (away.get(f.awayId) ?? 0) + 1)
  }
  const def = LEAGUE_DEFS(genderOf(g)).find(d => d.id === comp.id)
  const shieldOf = new Map<string, number>()
  def?.shields?.forEach((s, i) => s.forEach(id => shieldOf.set(id, i)))
  const ids = comp.teamIds
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = ids[i], b = ids[j]
    const want = def?.shields
      ? (shieldOf.has(a) && shieldOf.get(a) === shieldOf.get(b) ? 2 : 1)
      : (def?.double ? 2 : 1)
    const m = meet.get(pairKey(a, b))
    const n = m?.n ?? 0
    if (n !== want) bad(tag, `${comp.id}: ${a} and ${b} met ${n} times, the format says ${want}`)
    if (want === 2 && m && (m.homes.get(a) !== 1 || m.homes.get(b) !== 1)) bad(tag, `${comp.id}: ${a} and ${b} did not have a home game each`)
  }
  for (const id of ids) {
    const h = home.get(id) ?? 0, a = away.get(id) ?? 0
    // an odd field size leaves a spread of two (roundRobin's own note)
    const slack = ids.length % 2 === 1 ? 2 : 1
    if (Math.abs(h - a) > slack) bad(tag, `${comp.id}: ${id} has ${h} home and ${a} away`)
  }
  // the table, replayed
  const fresh: Competition = { ...comp, table: comp.teamIds.map(emptyRow) }
  for (const f of fx) if (f.played) applyToTable(fresh, f)
  for (const r of fresh.table) r.pts -= adminPenalty(g.clubs[r.teamId], g.season)
  for (const r of fresh.table) {
    const got = comp.table.find(x => x.teamId === r.teamId)
    if (!got) { bad(tag, `${comp.id}: ${r.teamId} has no table row`); continue }
    const fields = ['p', 'w', 'd', 'l', 'pf', 'pa', 'tf', 'ta', 'bp', 'pts'] as const
    const off = fields.filter(k => got[k] !== r[k])
    if (off.length) bad(tag, `${comp.id}: ${r.teamId} table row disagrees with its results on ${off.map(k => `${k} ${got[k]} vs ${r[k]}`).join(', ')}`)
  }
  if (comp.table.length !== comp.teamIds.length) bad(tag, `${comp.id}: ${comp.table.length} rows for ${comp.teamIds.length} clubs`)

  // play-offs
  const order = sortTable(comp.table).map(r => r.teamId)
  const ko = g.fixtures.filter(f => f.compId === comp.id && isKo(f) && f.stage !== 'BAR' || (f.compId === comp.id && f.stage === 'BAR' && comp.playoffTeams === 6))
  const stage = (s: string) => ko.filter(f => f.stage === s)
  const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join()
  const teamsOf = (fs: Fixture[]) => fs.flatMap(f => [f.homeId, f.awayId])
  const winners = (fs: Fixture[]) => fs.map(f => tieWinner(f))
  for (const f of ko) if (!f.played) bad(tag, `${comp.id}: ${f.stage} ${f.homeId} v ${f.awayId} unplayed at the season's end`)
  const n = comp.playoffTeams
  if (n === 0) {
    if (ko.length) bad(tag, `${comp.id}: knockout ties in a league without a play-off`)
    check(comp.champion === order[0], `${tag} ${comp.id}: champion is the top of the table`, () => `${comp.champion} vs ${order[0]}`)
  } else {
    const F = stage('F')
    if (F.length !== 1) { bad(tag, `${comp.id}: ${F.length} finals`); return }
    if (n === 2) {
      if (!sameSet(teamsOf(F), order.slice(0, 2))) bad(tag, `${comp.id}: final ${teamsOf(F)} is not the top two ${order.slice(0, 2)}`)
    } else if (n === 4) {
      const SF = stage('SF')
      if (!sameSet(teamsOf(SF), order.slice(0, 4))) bad(tag, `${comp.id}: semi-finalists ${teamsOf(SF)} are not the top four`)
      if (!sameSet(teamsOf(F), winners(SF))) bad(tag, `${comp.id}: final is not the semi-final winners`)
    } else if (n === 6) {
      const BAR = stage('BAR'), SF = stage('SF')
      if (!sameSet(teamsOf(BAR), order.slice(2, 6))) bad(tag, `${comp.id}: barrage ${teamsOf(BAR)} is not 3rd to 6th`)
      if (!sameSet(teamsOf(SF), [order[0], order[1], ...winners(BAR)])) bad(tag, `${comp.id}: semi-finals are not the top two and the barrage winners`)
      if (!sameSet(teamsOf(F), winners(SF))) bad(tag, `${comp.id}: final is not the semi-final winners`)
    } else if (n === 8) {
      const QF = stage('QF'), SF = stage('SF')
      if (!sameSet(teamsOf(QF), order.slice(0, 8))) bad(tag, `${comp.id}: quarter-finalists are not the top eight`)
      if (!sameSet(teamsOf(SF), winners(QF))) bad(tag, `${comp.id}: semi-finals are not the quarter-final winners`)
      if (!sameSet(teamsOf(F), winners(SF))) bad(tag, `${comp.id}: final is not the semi-final winners`)
    }
    check(comp.champion === tieWinner(F[0]), `${tag} ${comp.id}: champion is the final's winner`, () => `${comp.champion} vs ${tieWinner(F[0])}`)
  }
  const roll = g.history.filter(h => h.season === g.season && h.compId === comp.id)
  if (roll.length !== 1 || roll[0].champion !== comp.champion) bad(tag, `${comp.id}: roll of honour holds ${roll.map(r => r.champion).join(',') || 'nothing'} for champion ${comp.champion}`)
}

function cupChecks(g: GameState, comp: Competition, tag: string) {
  const pools = comp.pools ?? []
  const poolOf = new Map<string, number>()
  pools.forEach((p, i) => p.forEach(id => poolOf.set(id, i)))
  const fx = g.fixtures.filter(f => f.compId === comp.id && !f.stage)
  for (const f of fx) {
    if (!f.played) bad(tag, `${comp.id}: pool game ${f.homeId} v ${f.awayId} unplayed`)
    if (poolOf.get(f.homeId) == null || poolOf.get(f.homeId) !== poolOf.get(f.awayId)) bad(tag, `${comp.id}: pool game across pools ${f.homeId} v ${f.awayId}`)
  }
  for (const p of pools) for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) {
    const n = fx.filter(f => pairKey(f.homeId, f.awayId) === pairKey(p[i], p[j])).length
    if (n !== 2) bad(tag, `${comp.id}: ${p[i]} and ${p[j]} met ${n} times in the pool`)
  }
  // pool standings, as the draw reads them
  const standing = pools.map(pool => {
    const mini: Competition = { ...comp, table: pool.map(emptyRow), pools: undefined }
    for (const f of fx) if (f.played && pool.includes(f.homeId)) applyToTable(mini, f)
    return sortTable(mini.table).map(r => r.teamId)
  })
  const ko = g.fixtures.filter(f => f.compId === comp.id && isKo(f))
  const stage = (s: string) => ko.filter(f => f.stage === s)
  const teamsOf = (fs: Fixture[]) => fs.flatMap(f => [f.homeId, f.awayId])
  const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join()
  for (const f of ko) if (!f.played) bad(tag, `${comp.id}: ${f.stage} unplayed at the season's end`)
  if (pools.length === 2) {
    const SF = stage('SF')
    const want = [standing[0][0], standing[0][1], standing[1][0], standing[1][1]]
    if (!sameSet(teamsOf(SF), want)) bad(tag, `${comp.id}: semi-finalists ${teamsOf(SF)} are not the pools' top two ${want}`)
    for (const f of SF) if (poolOf.get(f.homeId) === poolOf.get(f.awayId)) bad(tag, `${comp.id}: semi-final is a pool rematch`)
    const F = stage('F')
    if (F.length !== 1 || !sameSet(teamsOf(F), SF.map(tieWinner))) bad(tag, `${comp.id}: final is not the semi-final winners`)
  } else if (pools.length === 4) {
    const QF = stage('QF')
    const want = standing.flatMap(s => s.slice(0, 2))
    if (!sameSet(teamsOf(QF), want)) bad(tag, `${comp.id}: quarter-finalists are not the pools' top two`)
    for (const f of QF) if (poolOf.get(f.homeId) === poolOf.get(f.awayId)) bad(tag, `${comp.id}: quarter-final is a pool rematch ${f.homeId} v ${f.awayId}`)
    // a pool winner hosts
    for (const f of QF) if (!standing.some(s => s[0] === f.homeId)) bad(tag, `${comp.id}: quarter-final at ${f.homeId}, not a pool winner`)
    const SF = stage('SF')
    if (!sameSet(teamsOf(SF), QF.map(tieWinner))) bad(tag, `${comp.id}: semi-finals are not the quarter-final winners`)
    const F = stage('F')
    if (F.length !== 1 || !sameSet(teamsOf(F), SF.map(tieWinner))) bad(tag, `${comp.id}: final is not the semi-final winners`)
  } else return
  const F = stage('F')[0]
  if (F) check(comp.champion === tieWinner(F), `${tag} ${comp.id}: champion is the final's winner`, () => `${comp.champion} vs ${tieWinner(F)}`)
  const roll = g.history.filter(h => h.season === g.season && h.compId === comp.id)
  if (roll.length !== 1 || roll[0].champion !== comp.champion) bad(tag, `${comp.id}: roll of honour holds ${roll.map(r => r.champion).join(',') || 'nothing'} for champion ${comp.champion}`)
}

function slotChecks(g: GameState, tag: string) {
  const seen = new Map<string, number>()
  for (const f of g.fixtures) {
    for (const t of [f.homeId, f.awayId]) {
      const k = `${f.week}${f.midweek ? 'w' : ''}:${t}`
      if (seen.has(k)) bad(tag, `${t} twice in week ${f.week}${f.midweek ? ' midweek' : ''} (fixtures ${seen.get(k)} and ${f.id})`)
      seen.set(k, f.id)
    }
  }
  const ids = new Set<number>()
  for (const f of g.fixtures) { if (ids.has(f.id)) bad(tag, `fixture id ${f.id} twice`); ids.add(f.id) }
}

function seasonEnd(g: GameState, tag: string) {
  for (const comp of Object.values(g.comps)) {
    if (comp.type === 'league') leagueChecks(g, comp, tag)
    else if (comp.type === 'cup') cupChecks(g, comp, tag)
  }
  slotChecks(g, tag)
}

/** what settlePrizeMoney pays the manager's club off a final table */
function expectedPrize(g: GameState): number {
  const club = g.clubs[g.userClubId]
  const comp = g.comps[club.leagueId]
  if (!comp || comp.type !== 'league') return 0
  const order = sortTable(comp.table).map(r => r.teamId)
  const idx = order.indexOf(club.id)
  return Math.max(0, order.length - idx) * 120_000 + (comp.champion === club.id ? 1_500_000 : 0)
}

function play(run: Run) {
  const tag0 = run.label
  const g = run.gender === 'w'
    ? newGame(run.club, 'Audit', run.seed, undefined, 'coach', 'w', 'w')
    : newGame(run.club, 'Audit', run.seed)
  slotChecks(g, `${tag0} new career`)
  let unexplainedMax = 0, unexplainedAt = ''
  const t0 = Date.now()
  const endSeason = g.season + run.seasons
  let guard = 0
  while (g.season < endSeason && guard++ < SEASON_WEEKS * (run.seasons + 1)) {
    const tag = `${tag0} s${g.season}w${g.week}`
    if (g.week === SEASON_WEEKS) {
      seasonEnd(g, `${tag0} season ${g.season}`)
      // the summer, observed
      const leagueOf = new Map(Object.values(g.clubs).map(c => [c.id, c.leagueId]))
      const finals = new Map(Object.values(g.comps).filter(c => c.type === 'league').map(c => [c.id, sortTable(c.table).map(r => r.teamId)]))
      const champs = new Map(Object.values(g.comps).map(c => [c.id, c.champion]))
      const bar = g.fixtures.find(f => f.compId === 'prem' && f.stage === 'BAR' && f.played)
      const sizes = new Map(Object.values(g.comps).filter(c => c.type === 'league').map(c => [c.id, c.teamIds.length]))
      const prize = expectedPrize(g)
      const booksBefore = g.books ? { ...g.books, lines: { ...g.books.lines } } : undefined
      const prizeBefore = booksBefore?.lines.prize ?? 0
      const season = g.season
      playWeek(g)
      if (g.season !== season + 1) { bad(tag, 'the season did not roll over'); break }
      // books meet
      const prev = g.booksPrev
      if (g.books && prev) {
        check(prev.closing === g.books.opening, `${tag0} season ${season}: last season's closing balance is this season's opening`, () => `${prev.closing} vs ${g.books!.opening}`)
        const paid = (prev.lines.prize ?? 0) - prizeBefore
        check(paid === prize, `${tag0} season ${season}: prize money booked once, as the final table pays (${prize})`, () => `booked ${paid}`)
      }
      // promotion and relegation
      if (run.gender === 'm') {
        for (const [top, low] of [['prem', 'champ'], ['champ', 'natl1'], ['top14', 'prod2']] as const) {
          if (!RELEGATES.includes(top)) continue
          const down = finals.get(top)!.at(-1)!
          const up = champs.get(low) ?? finals.get(low)![0]
          let wantDown = down, wantUp = up
          if (top === 'prem' && bar && tieWinner(bar) === down) { wantDown = ''; wantUp = '' }
          if (wantDown) {
            check(g.clubs[wantDown].leagueId === low, `${tag0} season ${season}: ${wantDown} (bottom of ${top}) goes down`, () => `in ${g.clubs[wantDown].leagueId}`)
            check(g.clubs[wantUp].leagueId === top, `${tag0} season ${season}: ${wantUp} (${low} champion) goes up`, () => `in ${g.clubs[wantUp].leagueId}`)
          } else {
            check(g.clubs[down].leagueId === top && g.clubs[up].leagueId === low, `${tag0} season ${season}: ${down} won the relegation play-off and both stay`)
          }
          if (top === 'prem' && bar) check(new Set([bar.homeId, bar.awayId]).has(down) && new Set([bar.homeId, bar.awayId]).has(up),
            `${tag0} season ${season}: the play-off was the Premier Division's bottom club against the Championship's champion`,
            () => `${bar.homeId} v ${bar.awayId}, bottom ${down}, champion ${up}`)
        }
        const moved = Object.values(g.clubs).filter(c => leagueOf.get(c.id) !== c.leagueId)
        check(moved.length <= 6, `${tag0} season ${season}: only the swapped clubs changed league`, () => moved.map(c => `${c.id} ${leagueOf.get(c.id)}->${c.leagueId}`).join(', '))
      } else {
        const moved = Object.values(g.clubs).filter(c => leagueOf.get(c.id) !== c.leagueId)
        check(moved.length === 0, `${tag0} season ${season}: the women's leagues are ringfenced`, () => moved.map(c => c.id).join(','))
      }
      // the new season is valid
      for (const comp of Object.values(g.comps)) {
        if (comp.type !== 'league') continue
        const members = Object.values(g.clubs).filter(c => c.leagueId === comp.id).map(c => c.id)
        if (!(members.length === comp.teamIds.length && members.every(id => comp.teamIds.includes(id)))) bad(`${tag0} season ${g.season}`, `${comp.id} holds ${comp.teamIds.length} clubs, ${members.length} name it`)
        if (sizes.has(comp.id) && sizes.get(comp.id) !== comp.teamIds.length) bad(`${tag0} season ${g.season}`, `${comp.id} changed size ${sizes.get(comp.id)} -> ${comp.teamIds.length}`)
        if (comp.table.some(r => r.p !== 0)) bad(`${tag0} season ${g.season}`, `${comp.id} table not reset`)
        if (comp.champion) bad(`${tag0} season ${g.season}`, `${comp.id} starts with a champion`)
      }
      for (const club of Object.values(g.clubs)) if (!g.comps[club.leagueId]) bad(`${tag0} season ${g.season}`, `${club.id} is in ${club.leagueId}, which does not exist`)
      const early = g.fixtures.filter(f => f.played && f.compId !== 'fr' && f.week > g.week)
      if (early.length) bad(`${tag0} season ${g.season}`, `${early.length} fixtures already played in the future`)
      slotChecks(g, `${tag0} season ${g.season} built`)
      if (g.comps[MRC_CUP] == null && run.gender === 'm') bad(`${tag0} season ${g.season}`, 'no MRC Cup')
      continue
    }
    // the manager's money, week by week, against his books
    const club = g.clubs[g.userClubId]
    const balBefore = club.balance
    const named = (b = g.books) => Object.values(b?.lines ?? {}).reduce((s, v) => s + (v ?? 0), 0)
    const sameBooks = g.books?.season === g.season
    const namedBefore = sameBooks ? named() : 0
    playWeek(g)
    if (g.unemployed) { bad(tag, 'sacked although KEEPJOB holds the board'); break }
    const c2 = g.clubs[g.userClubId]
    if (c2.id === club.id && sameBooks && g.books?.season === g.season) {
      const residual = (c2.balance - balBefore) - (named() - namedBefore)
      if (Math.abs(residual) > Math.abs(unexplainedMax)) { unexplainedMax = residual; unexplainedAt = tag }
      const sheet = sheetOf(g)!
      const sum = sheet.opening + sheet.totalIn - sheet.totalOut
      if (Math.abs(sum - c2.balance) > 1) bad(tag, `the balance sheet does not add up: ${sum} vs ${c2.balance}`)
    }
  }
  console.log(`  ${tag0}: ${run.seasons} seasons in ${((Date.now() - t0) / 1000).toFixed(0)}s; largest week of money the named lines did not explain: ${Math.round(unexplainedMax).toLocaleString('en-GB')} (${unexplainedAt})`)
}

for (const run of RUNS) play(run)
ok(problems === 0, `no competition or books defect in ${RUNS.length} careers (${problems} found)`)
done('COMPETITION AUDIT', 'every season in both worlds played out true to its format, and the books meet')
