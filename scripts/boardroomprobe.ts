// Probe: THE BOARDROOM (owner, v1.8.3 - "there needs to be a board request
// section ... These should be rare to be accepted except if the club have won
// a title or something particular. If for example all facilities are done then
// this should always be denied as max reached. If you keep asking the board and
// they reject - their faith in you as a manager should be dented cause you
// arent listening. These actions should impact the game.")
//
// Four claims, one per sentence of that, measured on the real state.
import { newGame } from '../src/game/newgame'
import { askTheBoard } from '../src/game/season'
import { boardRequests, nextBuild, BOARD_ASKS } from '../src/game/boardroom'
import { appointBlock, appointStaff, backroomFund, staffCandidates } from '../src/game/staff'
import { FACILITY_INFO, MAX_FACILITY, newsSubject, stamp100, type FacilityId, type GameState } from '../src/game/model'
import { setLang, t, type Lang } from '../src/game/i18n'

let fails = 0
const bad = (m: string) => { fails++; console.error('FAIL: ' + m) }
const ok = (c: boolean, m: string) => c ? console.log('  ok  ' + m) : bad(m)
const ids = Object.keys(FACILITY_INFO) as FacilityId[]

const fresh = (seed = 606): GameState => newGame('leicester', 'Probe Gaffer', seed)
const askOf = (g: GameState, id: typeof BOARD_ASKS[number]) => boardRequests(g).find(a => a.id === id)!

// ---- 1. the room offers all four, and says something about each ----
{
  const g = fresh()
  const rs = boardRequests(g)
  ok(rs.length === 4, `the room offers four asks (${rs.map(r => r.id).join(', ')})`)
  ok(rs.every(r => r.caseFor.length > 3 && !r.caseFor.includes('board.')),
    'every ask reads its case in words rather than a dictionary key')
  ok(rs.every(r => r.odds >= 0 && r.odds <= 1), 'every case is a probability')
}

// ---- 2. a finished estate is never a refusal ----
{
  const g = fresh()
  const club = g.clubs[g.userClubId]
  for (const f of ids) club.facilities![f] = MAX_FACILITY
  ok(nextBuild(g) === null, 'a maxed estate has nothing left to build')
  const before = { conf: club.boardConfidence, news: g.news.length, ledger: JSON.stringify(g.boardAsks ?? {}) }
  const a = askOf(g, 'facilities')
  ok(!a.possible, 'and the facilities ask is closed')
  const reply = askTheBoard(g, 'facilities')
  console.log('  maxed estate says:', reply)
  ok(club.boardConfidence === before.conf, 'asking for a build that cannot exist costs no confidence')
  ok(g.news.length === before.news, 'and files no story')
  ok(JSON.stringify(g.boardAsks ?? {}) === before.ledger, 'and leaves no grudge on the ledger')
  // it must keep costing nothing, however many times it is pressed
  for (let i = 0; i < 6; i++) askTheBoard(g, 'facilities')
  ok(club.boardConfidence === before.conf && !g.unemployed,
    'pressing a maxed estate six times is still free')
}

// ---- 3. rare: an ordinary week gets nothing ----
{
  let yes = 0, tried = 0
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    for (const id of ['funds', 'facilities', 'staff'] as const) {
      const g = fresh(seed)
      tried++
      const before = g.clubs[g.userClubId].budget
      askTheBoard(g, id)
      const granted = id === 'funds' ? g.clubs[g.userClubId].budget > before
        : id === 'facilities' ? (g.boardGrant?.length ?? 0) > 0
        : (g.staffRoom ?? 0) > 0
      if (granted) yes++
    }
  }
  console.log(`  week one, no silverware: ${yes} of ${tried} asks granted`)
  ok(yes === 0, 'an ordinary manager in an ordinary week gets nothing')
}

// ---- 4. silverware is the thing that opens the door, and every yes moves something ----
{
  const check: Record<string, (g: GameState) => boolean> = {
    funds: g => g.clubs[g.userClubId].budget > 0,
    facilities: g => (g.boardGrant?.length ?? 0) > 0,
    staff: g => (g.staffRoom ?? 0) > 0,
  }
  for (const id of ['funds', 'facilities', 'staff'] as const) {
    const g = fresh()
    const club = g.clubs[g.userClubId]
    club.boardConfidence = 88
    // two titles inside two seasons: the top of what baseCase will credit, and
    // the only shape of case that clears the facilities bar (0.62), which is
    // the dearest thing in the room and deliberately the hardest to get
    g.mgr.trophies.push({ compId: 'epd', season: g.season, clubId: club.id })
    g.mgr.trophies.push({ compId: 'cup', season: g.season - 1, clubId: club.id })
    const before = { budget: club.budget, grants: g.boardGrant?.length ?? 0, room: g.staffRoom ?? 0 }
    const a = askOf(g, id)
    const reply = askTheBoard(g, id)
    const moved = id === 'funds' ? club.budget > before.budget
      : id === 'facilities' ? (g.boardGrant?.length ?? 0) > before.grants
      : (g.staffRoom ?? 0) > before.room
    ok(a.odds >= 0.62, `${id}: two titles and a board that rates you is a strong case (${a.odds.toFixed(2)})`)
    ok(moved, `${id}: and the yes moves something real`)
    ok(check[id](g), `${id}: the change is on the save, not in the sentence`)
    console.log(`  ${id.padEnd(10)} ${reply}`)
  }
}

// ---- 5. time is for a manager under pressure, and it holds the sack off ----
{
  const g = fresh()
  const club = g.clubs[g.userClubId]
  ok(!askOf(g, 'time').possible, 'a manager who is not under pressure cannot ask for time')
  club.boardConfidence = 25
  g.mgr.trophies.push({ compId: 'epd', season: g.season, clubId: club.id })
  ok(askOf(g, 'time').possible, 'a manager who is can')
  const reply = askTheBoard(g, 'time')
  ok((g.boardGrace ?? 0) > stamp100(g), `time granted runs past today: ${reply}`)
  ok(!askOf(g, 'time').possible, 'and he cannot come straight back for more of it')
}

// ---- 6. the staff fund buys a coach the club could not afford ----
{
  const g = fresh()
  const club = g.clubs[g.userClubId]
  const cand = staffCandidates(g, 'attack')[0]
  // broke, but not so broke that the board's fund cannot cover the man
  club.balance = Math.round(cand.fee * 0.4)
  ok(!!appointBlock(g, cand), `skint: ${cand.name} at ${cand.fee} is out of reach on ${club.balance}`)
  club.boardConfidence = 88
  g.mgr.trophies.push({ compId: 'epd', season: g.season, clubId: club.id })
  g.mgr.trophies.push({ compId: 'cup', season: g.season - 1, clubId: club.id })
  askTheBoard(g, 'staff')
  const fund = backroomFund(g)
  ok(fund > 0, `the board ring-fences a fund (${fund})`)
  ok(!appointBlock(g, cand), 'and the coach the club could not afford is now affordable')
  const bal = club.balance
  appointStaff(g, 'attack', 0)
  ok(g.staffPeople?.attack?.name === cand.name, 'he signs')
  ok(club.balance === bal, "and the club's own balance never moved")
  ok(backroomFund(g) === fund - cand.fee, `the fee came out of the fund (${fund} -> ${backroomFund(g)})`)
}

// ---- 7. keep asking after a no and it costs ----
{
  const g = fresh()
  const club = g.clubs[g.userClubId]
  club.boardConfidence = 40
  const first = askTheBoard(g, 'staff')
  ok(!!g.boardAsks?.staff, `a refusal stamps the ledger: ${first}`)
  ok(askOf(g, 'staff').odds === 0, 'and the room says the door is shut')
  const conf0 = club.boardConfidence
  askTheBoard(g, 'staff')                       // strike one: the warning
  ok(club.boardConfidence < conf0, `pressing it dents the board's faith (${conf0} -> ${club.boardConfidence})`)
  ok(!g.unemployed, 'but does not cost the job on its own')
  askTheBoard(g, 'staff')                       // strike two
  ok(g.unemployed, 'pressing it again after the warning does')
}

// ---- 8. every story the room files reads as words, in every language ----
//
// newsSubject builds an inbox headline as `k + 'Subj'`, and this file's eight
// story keys are assembled at runtime from the ask's id - so no probe that
// reads source as TEXT can see them. newsprobe checks the keys it can find and
// found nothing wrong; a real inbox then showed the headline
// "news.boardNo_facilitiesSubj". The only way to catch that is to file the
// story and read the headline back, which is what this does - both answers,
// all four asks, and the body too.
{
  const langs: Lang[] = ['en', 'fr', 'es', 'it', 'ja', 'af']
  const filed: { k: string; item: GameState['news'][number] }[] = []
  for (const id of BOARD_ASKS) {
    for (const grant of [false, true]) {
      const g = fresh()
      const club = g.clubs[g.userClubId]
      if (grant) {
        club.boardConfidence = 88
        g.mgr.trophies.push({ compId: 'epd', season: g.season, clubId: club.id })
        g.mgr.trophies.push({ compId: 'cup', season: g.season - 1, clubId: club.id })
      } else {
        club.boardConfidence = 40
      }
      if (id === 'time') club.boardConfidence = grant ? 25 : 44
      const before = g.news.length
      askTheBoard(g, id)
      for (const item of g.news.slice(before)) filed.push({ k: item.k ?? '(none)', item })
    }
  }
  ok(filed.length >= 8, `the room files a story for every answer it gives (${filed.length})`)
  const bad: string[] = []
  for (const lang of langs) {
    setLang(lang)
    for (const { k, item } of filed) {
      const subj = newsSubject(item)
      const body = item.k ? t(item.k, item.v) : item.body
      if (!subj || subj.startsWith('news.') || /\{\w+\}/.test(subj)) bad.push(`${lang} subject of ${k}: "${subj}"`)
      if (!body || body.startsWith('news.') || /\{\w+\}/.test(body)) bad.push(`${lang} body of ${k}: "${body.slice(0, 40)}"`)
    }
  }
  setLang('en')
  ok(bad.length === 0, `every headline and body reads as words in all six languages${bad.length ? ` - ${bad[0]}` : ''}`)
  bad.slice(1, 4).forEach(b => console.log(`        ${b}`))
}

if (fails) { console.error(`BOARDROOM PROBE: ${fails} failures`); process.exit(1) }
console.log('BOARDROOM PROBE PASSED')
