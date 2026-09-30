/**
 * ---- THE DESK IS A READING OF THE SAVE, NOTHING MORE (1.8.2) ----
 *
 * game/desk.ts builds Home's "Today" desk: what holds the week, the match
 * and the analyst's line on it, one line each on development, money, tactics,
 * the dressing room and the season, and at most one question still to be
 * answered. This probe builds it on several seeds, clubs and weeks, with the
 * desk deliberately loaded (a bid, a press question, office and dressing-room
 * knocks, an academy call, a board decision, a promise, a man sold to this
 * week's opponent), and holds five things:
 *
 *   1. Every row resolves in all six languages: no key left showing, no
 *      {placeholder} left in the text, nothing the dictionary had to fall
 *      back to English for.
 *   2. The decision row is exactly the set that stands between the manager
 *      and the week turning (the offers gate, the press and the board, the
 *      national squad, the mail), counted here from the raw save rather than
 *      through desk.ts, and it agrees with what Continue says it will stop on.
 *   3. Nothing hidden leaks: no trait or personality label in any language,
 *      no culture figure, no trust figure, no rating in a young man's line.
 *   4. It draws nothing and writes nothing: the save is byte-identical after
 *      a build, Math.random is never called, and a career that builds the desk
 *      every week ends exactly where one that never looks does.
 *   5. The "still to be answered" line comes from the memory and the promise
 *      ledger that exist, and there is never more than one.
 *
 * Run: npx vite-node scripts/deskprobe.ts
 */
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek } from '../src/game/season'
import { buildDesk, continueHold, deskDecisions, deskText, type Desk } from '../src/game/desk'
import { isBoardroom, OFFICE_OUTLET } from '../src/game/media'
import { natSquadHold } from '../src/game/country'
import { inInbox } from '../src/game/days'
import { opponentIn } from '../src/game/oppreport'
import { remember } from '../src/game/memory'
import { ensureLang, missing, setLang, t, type Lang } from '../src/game/i18n'
import type { GameState, Player } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => { if (!c) { console.log(`FAIL  ${what}`); fails++ } }
const note = (s: string) => console.log(s)

const LANGS: Lang[] = ['en', 'fr', 'es', 'it', 'ja', 'af']
for (const l of LANGS) await ensureLang(l)

// ------------------------------------------------------------ the fixtures

/** Load the desk: one of everything that can hold the week, and the threads. */
function load(g: GameState) {
  const club = g.clubs[g.userClubId]
  const men = club.players.map(id => g.players[id]).filter((p): p is Player => !!p && !p.acad)
  const bidder = Object.values(g.clubs).find(c => c.id !== club.id)!
  g.offers.push({ id: g.nextId++, playerId: men[2].id, fromClubId: bidder.id, toClubId: club.id, fee: 1_250_000, week: g.week, forUser: true, status: 'pending' })
  const base = { week: g.week, season: g.season, answered: false as const }
  g.press.push({ ...base, id: g.nextId++, outlet: 'The Chronicle', question: 'Is the pack good enough?', options: [{ label: 'Yes', morale: 0, board: 0 }, { label: 'We will see', morale: 0, board: 0 }] })
  g.press.push({ ...base, id: g.nextId++, outlet: OFFICE_OUTLET, question: 'Can we talk?', playerId: men[4].id, options: [{ label: 'Of course', morale: 0, board: 0 }] })
  g.press.push({ ...base, id: g.nextId++, outlet: OFFICE_OUTLET, question: 'The room is split', playerId: men[5].id, options: [{ label: 'Stand', morale: 0, board: 0, room: 'stand' }, { label: 'Reverse', morale: 0, board: 0, room: 'reverse' }] })
  g.press.push({ ...base, id: g.nextId++, outlet: OFFICE_OUTLET, question: 'A new deal?', playerId: men[6].id, options: [{ label: 'Now', morale: 0, board: 0, room: 'renew' }, { label: 'Wait', morale: 0, board: 0, room: 'wait' }] })
  g.press.push({ ...base, id: g.nextId++, outlet: OFFICE_OUTLET, question: 'Where do I stand?', playerId: men[7].id, options: [{ label: 'Promise', morale: 0, board: 0, room: 'promise' }, { label: 'Refuse', morale: 0, board: 0, room: 'refuse' }] })
  g.press.push({ ...base, id: g.nextId++, outlet: OFFICE_OUTLET, question: 'Rest him?', playerId: men[8].id, options: [{ label: 'Rest', morale: 0, board: 0, room: 'rest' }, { label: 'Early', morale: 0, board: 0, room: 'early' }] })
  g.press.push({ ...base, id: g.nextId++, outlet: OFFICE_OUTLET, question: 'Academy', playerId: men[9].id, options: [{ label: 'Sign', morale: 0, board: 0, acad: 'sign' }, { label: 'Release', morale: 0, board: 0, acad: 'release' }] })
  g.press.push({ ...base, id: g.nextId++, outlet: OFFICE_OUTLET, question: 'Camp', options: [{ label: 'Heat', morale: 0, board: 0, camp: 'heat' }] })
  // an answered one and one with no options: neither may appear
  g.press.push({ ...base, id: g.nextId++, outlet: 'The Chronicle', question: 'Old', answered: true as never, options: [{ label: 'x', morale: 0, board: 0 }] })
  g.press.push({ ...base, id: g.nextId++, outlet: 'The Chronicle', question: 'Unanswerable', options: [] })
  // a promise, a rushed-back man, a man sold to this week's opponent
  ;(g.pledges ??= []).push({ playerId: men[10].id, kind: 'minutes', week: g.week, season: g.season, due: g.week + 3, baseApps: 0 })
  remember(g, { kind: 'rushed-back', playerId: men[11].id, payload: { name: men[11].name, early: 1 }, sal: 1 })
  const fx = userFixtureThisWeek(g)
  const opp = fx ? opponentIn(g, fx) : null
  if (opp && g.clubs[opp]) {
    const oppMan = g.clubs[opp].players.map(id => g.players[id]).find(p => p && !p.acad)
    if (oppMan) remember(g, { kind: 'sold', playerId: oppMan.id, clubId: opp, payload: { name: oppMan.name }, sal: 2 })
  }
  // unread mail
  for (const n of g.news.slice(-3)) { n.read = false; n.cleared = false }
}

/** The holds, counted from the raw save the way store.ts continueWeek obeys
 *  them, without going through desk.ts. */
function expectedHolds(g: GameState) {
  const offers = g.unemployed ? 0 : g.offers.filter(o => o.status === 'pending' && o.forUser).length
  const waiting = g.press.filter(p => !p.answered && (p.options?.length ?? 0) > 0)
  const press = waiting.filter(p => !isBoardroom(p)).map(p => p.id).sort((a, b) => a - b)
  const board = waiting.filter(isBoardroom).length
  const squad = natSquadHold(g)?.n ?? 0
  const mail = g.news.filter(n => !n.read && !n.cleared && inInbox(g, n)).length
  return { annual: g.annual ? 1 : 0, offers, press, board, squad, mail }
}

/** Every string the desk would put on screen, in the language set now. */
function render(d: Desk): { id: string; text: string }[] {
  const out: { id: string; text: string }[] = []
  for (const x of d.decisions) out.push({ id: `decide:${x.kind}`, text: deskText(x.line) })
  if (d.match?.analyst) out.push({ id: 'match', text: deskText(d.match.analyst) })
  for (const r of [...d.rows, ...(d.thread ? [d.thread] : [])]) {
    out.push({ id: `${r.id}:label`, text: t(r.label) })
    out.push({ id: r.id, text: r.lines.map(deskText).join(' · ') })
  }
  out.push({ id: 'head', text: `${t('desk.title')} ${t('desk.decide')} ${t('desk.clear')}` })
  return out
}

// the labels that must never appear: every trait and personality name, in
// every language
const LABELS: string[] = []
for (const l of LANGS) {
  const d = JSON.parse(readFileSync(`src/locales/${l}.json`, 'utf8')) as Record<string, Record<string, unknown>>
  for (const ns of ['traits', 'pers']) {
    for (const [k, v] of Object.entries(d[ns] ?? {})) {
      if (typeof v === 'string' && !/Info$|Desc$|_/.test(k) && v.length >= 4) LABELS.push(v)
    }
  }
}
const LABEL_SET = [...new Set(LABELS)]

const stamp = (g: GameState) => JSON.stringify(g)
const hash = (g: GameState) => createHash('sha256').update(stamp(g)).digest('hex').slice(0, 16)

// ------------------------------------------------------------ the sweep

const CASES: { club: string; seed: number }[] = [
  { club: 'northampton', seed: 11 }, { club: 'leicester', seed: 4242 }, { club: 'toulouse', seed: 777 },
]
const CHECK_WEEKS = [1, 5, 12, 22]

// ---- 4. THE TWIN WALK, each half in a process of its own ----
//
// Two careers built from the same seed in ONE process do not stay equal
// whether or not a desk is ever built (the world keeps a little module-level
// state between careers), so the comparison is made between two processes
// that make exactly the same calls in exactly the same order, one of them
// building the desk before every week and one never building it.
if (process.argv.includes('--walk')) {
  const withDesk = process.argv.includes('--desk')
  const out: string[] = []
  for (const c of CASES) {
    const g = newGame(c.club, 'Desk Probe', c.seed)
    for (const wk of CHECK_WEEKS) {
      while (g.week < wk) {
        if (withDesk) { buildDesk(g); continueHold(g) }
        processWeekAndAdvance(g)
      }
      out.push(`${c.club}@${wk}:${hash(g)}`)
    }
  }
  console.log(`WALK ${out.join(' ')}`)
  process.exit(0)
}
{
  const walk = (flag: string[]) => {
    const txt = execFileSync('npx', ['vite-node', 'scripts/deskprobe.ts', '--', '--walk', ...flag], { encoding: 'utf8', maxBuffer: 1 << 26 })
    return (txt.split('\n').find(l => l.startsWith('WALK ')) ?? '').slice(5).split(' ')
  }
  const bare = walk([])
  const read = walk(['--desk'])
  ok(bare.length === CASES.length * CHECK_WEEKS.length, `the twin walk reported every checkpoint (${bare.length})`)
  for (let i = 0; i < bare.length; i++) {
    ok(bare[i] === read[i], `${bare[i]}: a career that reads the desk every week is the career that never did (${read[i]})`)
  }
  note(`  twin walk: ${bare.length} checkpoints identical with and without the desk`)
}

let built = 0, rendered = 0, threads = 0, analyst = 0, inline = 0

for (const c of CASES) {
  const g = newGame(c.club, 'Desk Probe', c.seed)
  if (!g.clubs[c.club]) { ok(false, `${c.club} exists in the world`); continue }
  for (const wk of CHECK_WEEKS) {
    while (g.week < wk) {
      const before = stamp(g)
      const realRandom = Math.random
      Math.random = () => { throw new Error('the desk drew from Math.random') }
      try { buildDesk(g); continueHold(g) } catch (e) { ok(false, `${c.club} wk${g.week}: ${(e as Error).message}`) } finally { Math.random = realRandom }
      ok(stamp(g) === before, `${c.club} wk${g.week}: building the desk left the save untouched`)
      processWeekAndAdvance(g)
    }

    // a loaded copy, so the next leg of the walk is unaffected
    const L = JSON.parse(stamp(g)) as GameState
    for (const stateCase of [g, L]) {
      if (stateCase === L) load(L)
      const before = stamp(stateCase)
      const desk = buildDesk(stateCase)
      built++
      ok(stamp(stateCase) === before, `${c.club} wk${wk}: the build wrote nothing`)

      // ---- 2. the decisions are the holds
      const want = expectedHolds(stateCase)
      const got = desk.decisions
      const count = (k: string) => got.filter(d => d.kind === k).length
      ok(count('annual') === want.annual, `${c.club} wk${wk}: annual ${count('annual')} = ${want.annual}`)
      ok(count('offer') === want.offers, `${c.club} wk${wk}: offers ${count('offer')} = ${want.offers}`)
      const pressIds = got.filter(d => d.pressId != null).map(d => d.pressId!).sort((a, b) => a - b)
      ok(JSON.stringify(pressIds) === JSON.stringify(want.press), `${c.club} wk${wk}: press items [${pressIds}] = [${want.press}]`)
      const boardLine = got.find(d => d.kind === 'board')
      ok((boardLine?.line.v?.n ?? 0) === want.board, `${c.club} wk${wk}: board decisions ${boardLine?.line.v?.n ?? 0} = ${want.board}`)
      ok((got.find(d => d.kind === 'squad')?.line.v?.n ?? 0) === want.squad, `${c.club} wk${wk}: squad hold`)
      ok((got.find(d => d.kind === 'mail')?.line.v?.n ?? 0) === want.mail, `${c.club} wk${wk}: mail ${want.mail}`)
      const hold = continueHold(stateCase)
      ok(!hold || got.length > 0, `${c.club} wk${wk}: Continue holds (${hold?.kind}) only when the desk lists something`)
      const nothing = want.annual + want.offers + want.press.length + want.board + want.squad + want.mail === 0
      ok(nothing === (got.length === 0), `${c.club} wk${wk}: an empty decision row means nothing holds the week`)
      if (hold) {
        const kinds = new Set(got.map(d => d.kind))
        const map: Record<string, string[]> = {
          offers: ['offer'], press: ['press', 'office', 'split', 'renew', 'role', 'injury', 'acad'], board: ['board'], squad: ['squad'], mail: ['mail'],
        }
        ok((map[hold.kind] ?? []).some(k => kinds.has(k as never)), `${c.club} wk${wk}: what Continue stops on (${hold.kind}) is on the desk`)
      }
      if (stateCase === L) {
        ok(got.some(d => d.kind === 'office') && got.some(d => d.kind === 'split') && got.some(d => d.kind === 'renew') &&
          got.some(d => d.kind === 'role') && got.some(d => d.kind === 'injury') && got.some(d => d.kind === 'acad') && got.some(d => d.kind === 'board'),
          `${c.club} wk${wk}: every kind of knock is named for what it is`)
        ok(got.every(d => d.pressId == null || stateCase.press.some(p => p.id === d.pressId && !p.answered && p.options.length > 0)),
          `${c.club} wk${wk}: no answered or unanswerable question on the desk`)
        inline += got.filter(d => d.pressId != null).length
      }
      ok(deskDecisions(stateCase).length === got.length, `${c.club} wk${wk}: deskDecisions and buildDesk agree`)

      // ---- 5. one thread at most, and from what exists
      if (desk.thread) {
        threads++
        ok(desk.thread.lines.length === 1, `${c.club} wk${wk}: the thread is one line`)
        ok(/^desk\.t/.test(desk.thread.lines[0].k), `${c.club} wk${wk}: the thread is one of the known kinds (${desk.thread.lines[0].k})`)
      }
      if (desk.match?.analyst) analyst++
      ok(desk.rows.length >= 4, `${c.club} wk${wk}: the club rows are there (${desk.rows.map(r => r.id)})`)

      // ---- 1 and 3. every language, nothing hidden
      const trust = String(Math.round(stateCase.mgrTrust ?? 30))
      const culture = stateCase.room?.c != null ? String(Math.round(stateCase.room.c)) : null
      for (const lang of LANGS) {
        setLang(lang)
        missing.clear()
        for (const r of render(desk)) {
          rendered++
          ok(r.text.length > 0, `${lang} ${c.club} wk${wk} ${r.id}: renders`)
          ok(!/\{\w+\}/.test(r.text), `${lang} ${c.club} wk${wk} ${r.id}: no placeholder left in "${r.text}"`)
          ok(!/\b(desk|home|oppreport|profile|selection|tactics|groups|arc|objectives)\.[a-zA-Z_]/.test(r.text), `${lang} ${c.club} wk${wk} ${r.id}: no key on screen in "${r.text}"`)
          ok(!/\u2014/.test(r.text), `${lang} ${r.id}: no em dash`)
          for (const lab of LABEL_SET) {
            if (r.text.includes(lab) && !/decide:|thread|dev|money/.test(r.id)) ok(false, `${lang} ${c.club} wk${wk} ${r.id}: label "${lab}" in "${r.text}"`)
          }
          if (r.id === 'room') {
            const digits = r.text.match(/\d+/g) ?? []
            ok(!digits.includes(trust) || digits.length === 0 || desk.rows.find(x => x.id === 'room')?.lines[0].v?.n === Number(trust),
              `${lang} ${c.club} wk${wk}: the dressing room shows no trust figure ("${r.text}")`)
            if (culture) ok(!digits.includes(culture), `${lang} ${c.club} wk${wk}: the dressing room shows no culture figure`)
          }
          if (r.id === 'dev' || r.id === 'thread' || r.id === 'dev:label') {
            const who = [...(desk.rows.find(x => x.id === 'dev')?.lines ?? []), ...(desk.thread?.lines ?? [])].map(l => String(l.v?.player ?? ''))
            const stripped = who.reduce((s, n) => (n ? s.split(n).join('') : s), r.text)
            if (r.id !== 'thread' || desk.thread?.lines[0].k !== 'desk.tRival') {
              ok(!/\d/.test(stripped), `${lang} ${c.club} wk${wk} ${r.id}: a young man's line carries no number ("${r.text}")`)
            }
          }
        }
        // a player's name may legitimately contain a label word ("Loyal"
        // is not a surname, but a club or an outlet might carry one), so the
        // label check above skips the lines that print names; these are
        // checked for labels outside the name instead
        for (const r of render(desk).filter(x => /decide:|thread|^dev$|money/.test(x.id))) {
          const names = [...desk.decisions.map(d => d.line), ...desk.rows.flatMap(x => x.lines), ...(desk.thread?.lines ?? [])]
            .flatMap(l => Object.values(l.v ?? {}).filter((v): v is string => typeof v === 'string'))
          const stripped = names.reduce((s, n) => s.split(n).join(''), r.text)
          for (const lab of LABEL_SET) ok(!stripped.includes(lab), `${lang} ${c.club} wk${wk} ${r.id}: label "${lab}" in "${r.text}"`)
        }
        ok(missing.size === 0, `${lang} ${c.club} wk${wk}: nothing fell back or went missing (${[...missing].slice(0, 4)})`)
      }
      setLang('en')
    }
  }
}

// every line the desk can say, in every language, whether or not a save
// above happened to reach it
const SAMPLE: { k: string; v?: Record<string, string | number> }[] = [
  { k: 'desk.dAnnual' }, { k: 'desk.dOffer', v: { club: 'Bath', fee_m: 900000, player: 'A. Player' } },
  { k: 'desk.dPress', v: { outlet: 'The Chronicle' } }, { k: 'desk.d_officeNone' },
  ...['office', 'split', 'renew', 'role', 'injury', 'acad'].map(k => ({ k: `desk.d_${k}`, v: { player: 'A. Player' } })),
  ...[1, 3].flatMap(n => [{ k: 'desk.dBoard', v: { n } }, { k: 'desk.dSquad', v: { n } }, { k: 'desk.dMail', v: { n } }, { k: 'desk.roomLow', v: { word_k: 'profile.trustWarming', n } }, { k: 'desk.seasonShort', v: { n } }]),
  { k: 'desk.devBreak', v: { player: 'A' } }, { k: 'desk.devStall', v: { player: 'A' } }, { k: 'desk.devFlying', v: { player: 'A' } },
  { k: 'desk.money', v: { bal_m: -250000 } }, { k: 'desk.moneyAdmin' }, { k: 'desk.moneyWagesFull' }, { k: 'desk.moneyRoom', v: { room_w: 37400 } }, { k: 'home.inTheRed' },
  { k: 'desk.tactics', v: { atk_k: 'styles.atk_width', def_k: 'styles.def_blitz' } },
  { k: 'desk.priority', v: { comp: 'English Premier Division', rot_k: 'selection.rotProtect' } },
  { k: 'desk.roomFine', v: { word_k: 'profile.trustWall' } },
  { k: 'desk.seasonAim', v: { aim_k: 'arc.aimTop4' } }, { k: 'desk.seasonPos', v: { pos_o: 3, pts: 21 } }, { k: 'desk.seasonOn' },
  { k: 'desk.tFormer', v: { player: 'A', club: 'Bath' } }, { k: 'desk.tRival', v: { coach: 'C', w: 2, d: 0, l: 3 } },
  { k: 'desk.tPromise_plans', v: { player: 'A' } }, { k: 'desk.tPromise_minutes', v: { player: 'A' } }, { k: 'desk.tPromise_deal', v: { player: 'A' } },
  { k: 'desk.tRushed', v: { player: 'A' } }, { k: 'desk.tProjUp', v: { player: 'A' } }, { k: 'desk.tProjDown', v: { player: 'A' } },
  { k: 'oppreport.soft', v: { unit_k: 'oppreport.u_scrum', sure_k: 'oppreport.sureLow' } },
]
for (const lang of LANGS) {
  setLang(lang)
  missing.clear()
  for (const s of SAMPLE) {
    const text = deskText(s)
    ok(text !== s.k && !/\{\w+\}/.test(text), `${lang} ${s.k}: "${text}"`)
    if (lang === 'fr' && /:/.test(text)) ok(/\u00a0:/.test(text), `fr ${s.k}: the colon has its non-breaking space ("${text}")`)
  }
  for (const k of ['desk.title', 'desk.decide', 'desk.clear', 'desk.dev', 'desk.room', 'desk.season', 'desk.thread', 'home.dashFinances', 'groups.tactics', 'home.nextMatch']) {
    ok(t(k) !== k, `${lang} ${k}`)
  }
  ok(missing.size === 0, `${lang}: every sample line is in the dictionary (${[...missing].slice(0, 4)})`)
}
setLang('en')

note(`\n  ${built} desks built on ${CASES.length} careers at weeks ${CHECK_WEEKS.join(', ')}, loaded and bare`)
note(`  ${rendered} lines rendered across ${LANGS.length} languages; ${inline} questions answerable in place; ${threads} threads; ${analyst} analyst lines`)
note(`  ${LABEL_SET.length} trait and personality labels checked against every line`)
ok(threads > 0, 'at least one desk carried a question still to be answered')
ok(analyst > 0, 'at least one desk carried the analyst\'s line')
note(fails ? `\nDESK PROBE FAILED (${fails})` : '\nDESK PROBE PASSED: the desk is the save, read and not touched, in every language')
process.exit(fails ? 1 : 0)
