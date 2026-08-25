// Probe: an old save's press room reads back in French.
//
// The whole press room used to be English sentences, saved as sentences. A
// career started before that carries them in its coverage list, and answered
// questions are HISTORY - the room never sweeps them, so they sit there until
// forty newer ones push them out. A player showed one of them on a French
// screen; this is the check that they come back.
//
// The migration matches a stored line against every English press template and
// recovers the key and the values that were poured into it. Two things have to
// be true: the right key comes back with the right values, and a line that
// matches nothing is left exactly as it was rather than guessed at.
//
// Run: npx vite-node scripts/pressmigprobe.ts
import { migratePress, recover } from '../src/game/pressmigrate'
import { pressQuestion, pressLabel, pressAnswer, pressReaction, type PressItem } from '../src/game/model'
import { setLang, tIn } from '../src/game/i18n'
import EN from '../src/locales/en.json'

const say = (s: string) => console.log(s)
let fails = 0
const ok = (c: boolean, what: string) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

// ---- 1. the line a player actually saw ------------------------------------
say('--- 1. the question on the screenshot')
const REAL = 'Three options are circled on the staff-room whiteboard for the spare pre-season week: the heat camp, the town, or the sponsor’s roadshow. The department heads are waiting on you.'
  .replace('’', "'")
const got = recover(REAL)
ok(got?.k === 'press.campQ2', `recovered as ${got?.k ?? '(nothing)'}`)

// ---- 2. every template survives a round trip ------------------------------
say('\n--- 2. every press template is recoverable from its own English')
const press = (EN as Record<string, unknown>).press as Record<string, unknown>
const SAMPLE: Record<string, string> = {
  player: 'Antoine Dupont', club: 'Stade Toulousain', short: 'Toulouse', sponsor: 'Harborne Group',
  opp: 'Bath', coach: 'Ronan O\'Gara', scout: 'Serge Blanco', what: 'the Elite 14', where: 'Sapiac',
  comp: 'the Elite 14', derby: 'Le Classico', poss: "Bath's", why: 'he is in the XV',
  weekly: '£48k', fund: '£300k', n: '3', of: '4', age: '27', us: '24', them: '12', by: '30',
  pos_k: 'posNoun.flanker', pred_k: 'press.punditsSplit', pred_o: '4', room_k: 'press.stanceHighExpected',
  tail_k: 'common.nothing', opp_k: 'press.oppThey', poss_k: 'press.oppTheir', man_k: 'press.cardsYourMan',
  Man_k: 'press.cardsYourManCap', coach_k: 'press.coachTheirs', where_k: 'press.runInTable',
  pile_k: 'press.runInPile', who_k: 'press.runInLeaders', slot_k: 'finances.slotShirt',
  nation_k: 'nation.FRA', nationThe_k: 'nationThe.FRA', nationCap_k: 'nationCap.FRA',
}
let round = 0, missed: string[] = []
for (const [k, v] of Object.entries(press)) {
  const forms = typeof v === 'string' ? [v] : Object.values(v as Record<string, string>)
  for (const form of forms) {
    if (typeof form !== 'string' || !form.trim()) continue
    // a template that is nothing but a hole - press.oppNamed is "{opp}" - is
    // deliberately not a candidate: it would match every sentence ever written
    if (!form.replace(/\{\w+\}/g, '').trim()) break
    const rendered = tIn('en', `press.${k}`, SAMPLE)
    if (rendered.includes('{')) continue          // a hole the sample does not fill
    const back = recover(rendered)
    round++
    // two keys can share one English sentence (the long and short sponsorship
    // offers print the same label). Either is right: they render the same.
    const same = back && tIn('en', back.k, SAMPLE) === rendered
    if (back?.k !== `press.${k}` && !same) missed.push(`press.${k} -> ${back?.k ?? '(nothing)'}`)
    break
  }
}
for (const m of missed.slice(0, 8)) say(`  ${m}`)
ok(missed.length === 0, `${round} templates round-trip to their own key${missed.length ? ` - ${missed.length} did not` : ''}`)

// ---- 3. an old item renders in French after migration ---------------------
say('\n--- 3. an old item reads as French once migrated')
const old: PressItem = {
  id: 1, week: 2, season: 0, outlet: "The Manager's Office",
  question: REAL,
  options: [{ label: 'Warm-weather camp (£400k)', morale: 0, board: 0, reaction: '' }],
  answered: true,
  answerLabel: 'Warm-weather camp (£400k)',
  reaction: 'Flights booked. A week of double sessions in the sun - the squad comes home lean, sharp, and united in their hatred of the hill runs.',
}
const n = migratePress([old])
setLang('fr')
say(`  recovered ${n} line(s)`)
say(`  Q: ${pressQuestion(old).slice(0, 90)}`)
say(`  A: ${pressAnswer(old)}`)
say(`  R: ${pressReaction(old).slice(0, 90)}`)
ok(/Trois options/.test(pressQuestion(old)), 'the question is French')
ok(/Stage au chaud/.test(pressAnswer(old)), 'the answer he gave is French')
ok(/Vols réservés/.test(pressReaction(old)), 'and so is what the room said back')
ok(/Stage au chaud/.test(pressLabel(old.options[0])), 'and the button on it')

// ---- 4. nothing that does not fit is guessed at ---------------------------
say('\n--- 4. a line that matches no template is left alone')
const junk: PressItem = {
  id: 2, week: 1, season: 0, outlet: 'x',
  question: 'A sentence this game has never written, about nothing in particular at all.',
  options: [], answered: false,
}
migratePress([junk])
ok(junk.qk === undefined, 'no key invented for a line the room never wrote')
ok(pressQuestion(junk) === junk.question, 'and it still renders as what it says')

setLang('en')
say(fails ? `\nPRESS MIGRATION PROBE FAILED (${fails})` : '\nPRESS MIGRATION PROBE PASSED: an old career reads its own coverage back in French')
process.exitCode = fails ? 1 : 0
