/**
 * IDENTITY PROBE - a club becomes what it is run as (identity.ts).
 *
 * Owner's brief: identity should EMERGE from how the club is run and then
 * nudge recruitment, the academy, the terraces, the board, sponsors and the
 * Wire. This holds that to account on seeded careers:
 *
 *   1. two contrasting managers diverge the way their management says: an
 *      academy-minded side that runs the ball against a chequebook side that
 *      kicks it
 *   2. slowly: no axis moves more than ALPHA of the full range in a step, and
 *      labels do not flicker
 *   3. each effect fires, and stays inside its stated bound
 *   4. nothing reaches AI-vs-AI rugby: the same fixture on the same seed
 *      scores the same with any identity at all
 *   5. an old save with no identity reads one from its current state
 *
 * Run: npx vite-node scripts/identityprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { rebuildSeason, rollIntakeClass } from '../src/game/rollover'
import { autoSelect, simMatch } from '../src/game/matchEngine'
import { executeTransfer } from '../src/game/ai'
import { transferInterest, INTEREST_GAP } from '../src/game/interest'
import { offersFor } from '../src/game/commercial'
import {
  ALPHA, AXES, BIG_FEE, IDENTITY_GAP, INTAKE_BONUS, SPONSOR_MAX,
  identityFit, identityOf, identitySeasonEnd, rawIdentity, type ClubIdentity, type IdLabel,
} from '../src/game/identity'
import { mulberry32 } from '../src/game/rng'
import { flushMemoryNews, recall } from '../src/game/memory'
import { tIn } from '../src/game/i18n'
import type { GameState, Player } from '../src/game/model'

let fails = 0
const ok = (c: boolean, msg: string) => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${msg}`); if (!c) fails++ }
const say = (s: string) => console.log(s)

const seniors = (g: GameState) => g.clubs[g.userClubId].players.map(id => g.players[id]).filter(p => p && !p.acad)

type Style = 'academy-running' | 'chequebook-kicking'

/** Run a career for `seasons` seasons under one management style, stepping a
 *  week at a time so the smoothing can be watched. */
function career(style: Style, seed: number, seasons: number) {
  const g = newGame('northampton', 'Identity', seed)
  const club = g.clubs[g.userClubId]
  const running = style === 'academy-running'
  const season0 = g.season
  let maxStep = 0
  let labelChanges = 0
  const perSeason: string[] = []
  let prev: ClubIdentity | null = null
  const formed = new Set<string>()
  let subject = ''

  const manage = () => {
    Object.assign(club.tactic, running
      ? { style: 80, tempo: 70, kicking: 20, aggression: 45 }
      : { style: 25, tempo: 40, kicking: 80, aggression: 60 })
    // from week ten, so the identity is seen forming rather than seeded formed
    if (running && (g.season > season0 || g.week >= 10)) {
      // bring the academy through and play them
      const kids = club.players.map(id => g.players[id]).filter(p => p && p.acad && p.age >= 18).sort((a, b) => b.ca - a.ca)
      for (const p of kids) {
        if (seniors(g).filter(x => x.homegrown).length >= 10) break
        p.acad = false; p.homegrown = true
      }
      const pool = club.players.map(id => g.players[id]).filter(p => p && !p.injury && !p.onLoan)
      club.tactic.lineup = autoSelect(g, pool, undefined, (p: Player) => (p.homegrown ? 3 : 1))
    }
  }
  const buy = () => {
    // two big-money signings a summer
    const targets = Object.values(g.players)
      .filter(p => p.clubId && p.clubId !== club.id && !p.acad && p.ca >= 70 && p.age <= 29)
      .sort((a, b) => b.ca - a.ca).slice(0, 2)
    for (const p of targets) executeTransfer(g, p, club.id, Math.max(BIG_FEE, p.value))
  }

  // the chequebook comes with a benefactor, or the board would sack him for
  // the overdraft before the identity had a season to form
  if (!running) club.balance += 12_000_000
  for (let s = 0; s < seasons; s++) {
    for (let w = 0; w < 37; w++) {
      if (!running && w === 10) buy()
      manage()
      // a patient board: this measures what the club becomes, not whether a
      // manager playing teenagers or kicking every ball keeps his job
      club.boardConfidence = Math.max(club.boardConfidence, 60)
      processWeekAndAdvance(g)
      const cur = g.identity
      if (cur && prev) {
        for (const a of AXES) maxStep = Math.max(maxStep, Math.abs(cur.v[a] - prev.v[a]))
        const diff = cur.labels.filter(l => !prev!.labels.includes(l)).length + prev.labels.filter(l => !cur.labels.includes(l)).length
        labelChanges += diff
        if (diff > 1) say(`    two labels moved in one step: ${prev.labels} -> ${cur.labels}`)
      }
      if (cur) prev = { ...cur, v: { ...cur.v }, labels: [...cur.labels] }
      for (const n of g.news) {
        if (!n.k?.startsWith('identity.forms.')) continue
        const l = n.k.slice('identity.forms.'.length)
        if (l === 'academy') subject = n.subject
        formed.add(l)
      }
    }
    const id = identityOf(g)
    const sq = seniors(g)
    const apps = sq.reduce((t, p) => t + p.stats.apps, 0)
    const hgApps = sq.filter(p => p.homegrown).reduce((t, p) => t + p.stats.apps, 0)
    perSeason.push(`   raw ${JSON.stringify(rawIdentity(g))}, homegrown share of apps ${(hgApps / Math.max(1, apps) * 100).toFixed(0)}%, sacked ${!!g.unemployed}`)
    perSeason.push(`s${s + 1} ${AXES.map(a => `${a} ${id.v[a].toFixed(0)}`).join(', ')} [${id.labels.join(', ')}]`)
    rebuildSeason(g)
  }
  return { g, id: identityOf(g), maxStep, labelChanges, perSeason, formed: [...formed], subject }
}

// ---- 1. contrasting management diverges --------------------------------
say('\n--- 1. contrasting careers become different clubs')
const A = career('academy-running', 7101, 2)
const B = career('chequebook-kicking', 7101, 2)
for (const [n, c] of [['academy + running', A], ['chequebook + kicking', B]] as const) {
  say(`  ${n}:`)
  for (const line of c.perSeason) say(`    ${line}`)
}
ok(A.id.v.play - B.id.v.play >= 50, `the running side reads far more attacking than the kicking side (${A.id.v.play.toFixed(0)} vs ${B.id.v.play.toFixed(0)})`)
ok(A.id.labels.includes('running'), `the running side is called Running rugby (${A.id.labels})`)
ok(B.id.labels.includes('kicking'), `the kicking side is called Kicking game (${B.id.labels})`)
ok(A.id.v.recruit - B.id.v.recruit >= 40, `the academy side reads academy-first against the buyers (${A.id.v.recruit.toFixed(0)} vs ${B.id.v.recruit.toFixed(0)})`)
ok(A.id.labels.includes('academy'), `the academy side is called an Academy club (${A.id.labels})`)
ok(B.id.labels.includes('spenders'), `the buyers are called Big spenders (${B.id.labels})`)
ok(!A.id.labels.includes('spenders') && !B.id.labels.includes('academy'), 'and neither wears the other\'s label')
const mem = recall(A.g, { kind: ['identity-formed', 'identity-faded'] })
ok(mem.some(e => e.kind === 'identity-formed' && e.payload?.label === 'academy'), `and the memory log holds it (${mem.map(e => `${e.kind}:${e.payload?.label}`).join(' ')})`)
ok(A.formed.includes('academy') && B.formed.includes('spenders'), `the Wire wrote each identity up as it formed (${A.formed} / ${B.formed})`)
ok(/academy club/.test(A.subject) && !A.subject.includes('{'), `and the story reads (${A.subject})`)
ok(!A.g.unemployed && !B.g.unemployed, 'both managers kept their jobs, so the reads are of clubs being run')

// ---- 2. slowly --------------------------------------------------------
say('\n--- 2. it changes over seasons, not over a Saturday')
const bound = ALPHA * 200 + 0.2
ok(A.maxStep <= bound && B.maxStep <= bound, `no axis moved more than ${bound.toFixed(1)} in one step (${A.maxStep.toFixed(1)}, ${B.maxStep.toFixed(1)})`)
ok(A.labelChanges <= 6 && B.labelChanges <= 6, `labels did not flicker: ${A.labelChanges} and ${B.labelChanges} changes over two seasons`)
{
  // one season of the opposite management moves the identity, but not all the way
  const g = A.g
  const club = g.clubs[g.userClubId]
  const before = identityOf(g).v.play
  for (let w = 0; w < 12; w++) {
    Object.assign(club.tactic, { style: 20, tempo: 40, kicking: 85, aggression: 50 })
    processWeekAndAdvance(g)
  }
  const after = identityOf(g).v.play
  ok(after < before, `twelve weeks of kicking pull the running side back (${before.toFixed(0)} -> ${after.toFixed(0)})`)
  ok(after > 0, 'but do not turn it into a kicking side in one autumn')
}

// ---- 3. effects, each inside its bound -----------------------------------
say('\n--- 3. the effects fire, and stay small')
function withLabels(seed: number, labels: IdLabel[], clubId = 'bath'): GameState {
  const g = newGame(clubId, 'Effects', seed)
  g.identity = { clubId: g.userClubId, v: { play: 0, pack: 0, recruit: 0, purse: 0 }, labels }
  return g
}
// interest
{
  const g = withLabels(7201, ['academy'], 'nottingham')
  const user = g.clubs[g.userClubId]
  const young = Object.values(g.players).filter(p => {
    const c = p.clubId ? g.clubs[p.clubId] : null
    if (!c || p.acad || p.transferListed || p.morale <= 5 || p.pers === 'Mercenary' || p.age > 21) return false
    const gap = c.rep - user.rep
    return gap > INTEREST_GAP && gap <= INTEREST_GAP + IDENTITY_GAP
  })
  const far = Object.values(g.players).filter(p => {
    const c = p.clubId ? g.clubs[p.clubId] : null
    if (!c || p.acad || p.transferListed || p.morale <= 5 || p.pers === 'Mercenary' || p.age > 21) return false
    return c.rep - user.rep > INTEREST_GAP + IDENTITY_GAP
  })
  const withL = young.filter(p => transferInterest(g, p) === 'listening').length
  g.identity = { ...g.identity!, labels: [] }
  const without = young.filter(p => transferInterest(g, p) === 'listening').length
  g.identity = { ...g.identity!, labels: ['academy'] }
  ok(young.length > 0 && withL === young.length && without === 0,
    `young players just past the gap will talk to an academy club (${withL}/${young.length}) and not to a plain one (${without})`)
  ok(far.every(p => transferInterest(g, p) === 'no'), `but the reach is bounded at ${IDENTITY_GAP} points: ${far.length} further up still say no`)
  const old = Object.values(g.players).find(p => p.age >= 28 && p.clubId && !p.acad)!
  ok(identityFit(g, old) === null, 'and a 28-year-old is not an academy fit')
}
// academy intake
{
  const a = rollIntakeClass(withLabels(7301, ['academy']), mulberry32(99))
  const b = rollIntakeClass(withLabels(7301, []), mulberry32(99))
  const dq = a.map((x, i) => x.q - b[i].q)
  ok(a.length === b.length && dq.every(d => d === INTAKE_BONUS), `an academy club's intake is ${INTAKE_BONUS} quality points up, no more (${dq.join(',')})`)
  ok(a.every((x, i) => x.pos === b[i].pos && x.name === b[i].name), 'and the same class otherwise: no extra rng drawn')
}
// sponsors
{
  const g = withLabels(7401, ['running', 'academy', 'prudent'])
  const hi = offersFor(g, 'shirt')
  g.identity = { ...g.identity!, labels: ['stretched', 'kicking'] }
  const lo = offersFor(g, 'shirt')
  const r = hi.map((o, i) => o.weekly / lo[i].weekly)
  ok(r.every(x => x > 1 && x <= SPONSOR_MAX + 0.001), `a club that sells gets a little over the odds (${r.map(x => x.toFixed(3)).join(', ')}, cap ${SPONSOR_MAX})`)
  ok(hi.every((o, i) => o.sponsor === lo[i].sponsor && o.years === lo[i].years), 'and the same sponsors on the same terms otherwise')
}
// supporters: a big fee in a homegrown regular's shirt
{
  const g = withLabels(7501, ['academy'])
  const club = g.clubs[g.userClubId]
  const own = seniors(g).find(p => p.pos === 'FH')!
  own.homegrown = true; own.stats.apps = 6; own.morale = 7
  g.fanMood = 60
  const target = Object.values(g.players).find(p => p.pos === 'FH' && p.clubId && p.clubId !== club.id && !p.acad)!
  executeTransfer(g, target, club.id, 1_500_000)
  ok(g.fanMood === 57, `the terraces object: fan mood 60 -> ${g.fanMood}`)
  ok(own.morale === 6, `and the homegrown man feels it: morale 7 -> ${own.morale}`)
  const idBefore = g.nextId
  flushMemoryNews(g)
  ok(g.nextId === idBefore, 'the story is held and filed on a fractional id: the shared counter does not move')
  const n = g.news.filter(x => x.k === 'identity.fansObject')
  ok(n.length === 1 && !Number.isInteger(n[0].id) && n[0].body.includes(own.name), 'and the Wire names him')
  const second = Object.values(g.players).find(p => p.pos === 'FH' && p.clubId && p.clubId !== club.id && !p.acad)!
  executeTransfer(g, second, club.id, 1_500_000)
  ok(g.fanMood === 57, 'a second big fee in the same window is not a second story')
  const plain = withLabels(7501, [])
  const own2 = seniors(plain).find(p => p.pos === 'FH')!
  own2.homegrown = true; own2.stats.apps = 6
  plain.fanMood = 60
  const t2 = Object.values(plain.players).find(p => p.pos === 'FH' && p.clubId && p.clubId !== plain.userClubId && !p.acad)!
  executeTransfer(plain, t2, plain.userClubId, 1_500_000)
  ok(plain.fanMood === 60, 'a club with no academy identity signs whom it likes without a murmur')
}
// board and terraces at season's end
{
  const g = withLabels(7601, ['academy', 'prudent'])
  const club = g.clubs[g.userClubId]
  g.fanMood = 60
  const b0 = club.boardConfidence
  processWeekAndAdvance(g) // opens the books
  g.fanMood = 60
  g.books = { season: g.season, clubId: club.id, fromWeek: 1, opening: club.balance + 5_000_000, lines: {} }
  for (const p of seniors(g)) { p.homegrown = false }
  identitySeasonEnd(g)
  flushMemoryNews(g)
  ok(g.fanMood === 58, `an academy club that played none of its own: fans 60 -> ${g.fanMood}`)
  const db = club.boardConfidence - b0
  ok(db >= -3 && db < 0, `and the board, which also expected prudence, marks it down a little (${db})`)
  const ks = g.news.filter(n => n.k === 'identity.academyStalled' || n.k === 'identity.prudenceBroken').length
  ok(ks === 2, 'with a story for each broken expectation')
}

// ---- 4. AI-vs-AI rugby cannot see it -----------------------------------
say('\n--- 4. AI-vs-AI results are untouched')
{
  const scores = (id: ClubIdentity | null) => {
    const g = newGame('leicester', 'Fingerprint', 424242)
    g.identity = id
    const fx = g.fixtures.filter(f => f.week >= 4 && f.week <= 8 && f.homeId !== g.userClubId && f.awayId !== g.userClubId && g.clubs[f.homeId] && g.clubs[f.awayId]).slice(0, 6)
    return fx.map((f, i) => { simMatch(g, f, mulberry32(1000 + i), i < 3); return `${f.homeScore}-${f.awayScore}` }).join(' ')
  }
  const none = scores(null)
  const loud = scores({ clubId: 'leicester', v: { play: 100, pack: -100, recruit: 100, purse: -100 }, labels: ['running', 'flair', 'academy', 'stretched'] })
  say(`  ${none}`)
  ok(none === loud, 'six AI fixtures score identically with no identity and with the loudest one')

  // and a whole season through the real settle, week by week: the stories an
  // identity files take no ids, so every fixture keeps its id and its dice
  const season = (id: ClubIdentity | null) => {
    const g = newGame('leicester', 'Fingerprint', 424242)
    g.identity = id
    const weeks: string[] = []
    let stories = 0
    for (let w = 0; w < 37; w++) {
      const wk = g.week
      processWeekAndAdvance(g)
      stories += g.news.filter(n => n.k?.startsWith('identity.') && n.week === wk && n.season === g.season).length
      const played = g.fixtures.filter(f => f.week === wk && f.played && f.homeId !== g.userClubId && f.awayId !== g.userClubId)
      weeks.push(played.map(f => `${f.id}:${f.homeScore}-${f.awayScore}`).join(','))
    }
    return { weeks, stories, labels: identityOf(g).labels }
  }
  const plain = season(null)
  // labels held on a neutral read: each fades in turn, one Wire story and one
  // memory entry per club match, filed in the middle of the settle
  const loudS = season({ clubId: 'leicester', v: { play: 0, pack: 0, recruit: 0, purse: 0 }, labels: ['running', 'flair', 'academy', 'stretched'] })
  const firstDiff = plain.weeks.findIndex((w, i) => w !== loudS.weeks[i])
  const n = plain.weeks.reduce((t, w) => t + (w ? w.split(',').length : 0), 0)
  say(`  ${n} AI fixtures over ${plain.weeks.length} weeks; identity stories filed: ${plain.stories} plain, ${loudS.stories} loud (labels ${loudS.labels})`)
  ok(n > 300 && firstDiff === -1, `every AI fixture id and score is identical week by week, extreme identity against none${firstDiff >= 0 ? ` (first difference in week ${firstDiff + 1})` : ''}`)
  ok(loudS.stories >= 3, `and the check had identity stories in it to catch (${loudS.stories})`)
}

// ---- 5. an old save ------------------------------------------------------
say('\n--- 5. an old save reads an identity from what it is')
{
  const g = career('chequebook-kicking', 7701, 1).g
  delete g.identity
  const id = identityOf(g)
  ok(id.clubId === g.userClubId && AXES.every(a => Number.isFinite(id.v[a])), `seeded from state (${AXES.map(a => `${a} ${id.v[a]}`).join(', ')})`)
  ok(id.v.recruit < 0, 'and a club that bought its squad reads as one')
  // every label renders in every language
  const langs = ['en', 'fr', 'es', 'it', 'ja', 'af'] as const
  const labels: IdLabel[] = ['running', 'kicking', 'pack', 'flair', 'academy', 'spenders', 'prudent', 'stretched']
  const missing = langs.flatMap(l => labels.filter(x => tIn(l, `identity.label.${x}`) === `identity.label.${x}`).map(x => `${l}:${x}`))
  ok(missing.length === 0, `every label has a word in all six languages ${missing.join(' ')}`)
}

say(fails ? `\nIDENTITY PROBE FAILED (${fails})` : '\nIDENTITY PROBE PASSED: identities emerge, slowly, and their effects stay small')
process.exitCode = fails ? 1 : 0
