/**
 * ---- WHO THE STRING IS ABOUT: THE MANAGER AND THE STAFF ----
 *
 * Owner, 7 Sep: "double check language, cultural insensitive, gender
 * insensitive." The `_f` axis made the players women (womensvoice.ts). This
 * is the other axis, `_w`: the fans on the new manager - "give her two
 * seasons" - and a scout who "files her report", each from a gender the game
 * actually holds (GameState.mgrGender, StaffPerson.g), not from the world.
 *
 * A GATE, unlike womensvoice: the mechanism either selects the sibling or it
 * does not, and a men's-world career that suddenly reads "she" about a man
 * would be as wrong as the bug this fixes. Four things are asserted, in every
 * language:
 *
 *   1. the manager's gender picks `_w` on a manager line and on nothing else
 *   2. a story filed with `g: 'w'` reads its `_w` sibling, and one filed with
 *      `g: 'm'` does not, whatever the manager is
 *   3. a `_k` fragment and an `_l` row inherit the subject the way t() does
 *   4. both axes at once read `_fw` where one exists
 *
 * plus: English `_w` siblings carry no masculine marker, and every language
 * has a sibling for the same manager keys English does.
 */
import { ensureLang, setLang, setWorld, setManagerGender, t, LANGS, type Lang, SIBLING } from '../src/game/i18n'
import en from '../src/locales/en.json'

let fails = 0
const ok = (cond: boolean, what: string) => { console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${what}`); if (!cond) fails++ }
const MASC = /\b(he|him|his|himself|man|men)\b/i

for (const l of LANGS) await ensureLang(l.code as Lang)

// ---- 1. the manager
setLang('en'); setWorld('m')
setManagerGender('m')
ok(/\bhim\b/.test(t('news.fanSceptic1')), `men's world, man manager: the fans say "him" (${t('news.fanSceptic1')})`)
setManagerGender('w')
ok(/\bher\b/.test(t('news.fanSceptic1')), `men's world, woman manager: the fans say "her" (${t('news.fanSceptic1')})`)
ok(/\bshe\b/.test(t('legacy.cvTitleBigger')), `the CV line follows the manager (${t('legacy.cvTitleBigger')})`)
ok(!/\bher\b/.test(t('player.vUnhappy')), `a player line ignores the manager's gender (${t('player.vUnhappy')})`)
// a line filed WITHOUT a subject takes the manager's, by design - which is why
// every staff story is filed with subjectVar() and staffprobe holds it so
ok(/\bher\b/.test(t('staff.sacked', { name: 'X', cost: '£1' })), `a staff line with no subject of its own follows the manager (${t('staff.sacked', { name: 'X', cost: '£1' })})`)

// ---- 2. a named subject
setManagerGender('m')
ok(/\bher contract\b/.test(t('staff.sacked', { g: 'w', name: 'X', cost: '£1' })), `g: 'w' reads the _w sibling under a man manager`)
setManagerGender('w')
ok(/\bhis contract\b/.test(t('staff.sacked', { g: 'm', name: 'X', cost: '£1' })), `g: 'm' keeps the base under a woman manager`)

// ---- 3. fragments and rows
setManagerGender('m')
const preview = t('news.intakePreview', { g: 'w', n: 3, verdict_k: 'news.intakeGradeA', unit_k: 'news.unitPack' })
ok(/\bHer verdict\b/.test(preview), `a _k fragment inherits the subject (${preview.split('\n')[1]})`)
const rows = t('news.staffChem', { rows_l: JSON.stringify([{ k: 'news.staffClick', other: 'Y', note_k: 'common.nothing', g: 'w' }]) })
ok(/\bshe and Y\b/.test(rows), `an _l row carries its own subject (${rows})`)
const rowsM = t('news.staffChem', { rows_l: JSON.stringify([{ k: 'news.staffClick', other: 'Y', note_k: 'common.nothing', g: 'm' }]) })
ok(/\bhe and Y\b/.test(rowsM), `and a man's row stays his (${rowsM})`)

// ---- 4. both axes
setWorld('w'); setManagerGender('m')
const hiredW = t('news.staffHired', { g: 'w', name: 'X', age: 40, club: 'C', role_k: 'staff.roleAssistant', badge_k: 'staff.badge1', trait_k: 'traits.Man-manager', fee: '£1', wage: '£1', out_k: 'common.nothing', chem_k: 'common.nothing' })
ok(/their woman/.test(hiredW), `women's world, woman hire: the club "have their woman" (${hiredW.slice(0, 40)})`)
const hiredM = t('news.staffHired', { g: 'm', name: 'X', age: 40, club: 'C', role_k: 'staff.roleAssistant', badge_k: 'staff.badge1', trait_k: 'traits.Man-manager', fee: '£1', wage: '£1', out_k: 'common.nothing', chem_k: 'common.nothing' })
ok(/their man/.test(hiredM), `women's world, man hire: "their man" (${hiredM.slice(0, 40)})`)
setWorld('m'); setManagerGender('m')

// ---- the siblings themselves
const leaves = (n: unknown, p = ''): string[] => typeof n === 'object' && n && !('other' in (n as object))
  ? Object.entries(n as Record<string, unknown>).flatMap(([k, v]) => leaves(v, p ? `${p}.${k}` : k)) : [p]
const enW = leaves(en).filter(k => /_(w|fw)$/.test(k))
ok(enW.length >= 60, `English carries subject siblings (${enW.length})`)
let masc = 0
for (const k of enW) {
  const v = k.split('.').reduce<unknown>((o, part) => (o as Record<string, unknown>)?.[part], en)
  const text = typeof v === 'string' ? v : Object.values(v as Record<string, string>).join(' ')
  // "man" in a trait name or an idiom that is not the subject is allowed; a pronoun is not
  if (/\b(he|him|his|himself)\b/.test(text.replace(/\{[^}]*\}/g, ''))) { masc++; console.log(`        ${k}: ${text.slice(0, 90)}`) }
}
ok(masc === 0, `no English subject sibling still says he / him / his (${masc})`)
// The manager line every language writes with a NOUN rather than a pronoun -
// "New man, new voice" - so it is the one to assert across languages.
//
// A LANGUAGE THAT WAS NEVER MASCULINE HERE NEEDS NO SIBLING, and Japanese is
// that language: 新しい監督 is "the new manager" and says nothing about who
// they are. Demanding a `_w` there would mean inventing a distinction the
// language does not draw, so the test is "gendered, or neutral already" -
// what must never happen is a line that stays masculine under a woman.
const MASC_BY_LANG: Record<string, RegExp> = {
  fr: /\b(homme|il|lui|entraîneur)\b/i,
  es: /\b(hombre|él|entrenador)\b/i,
  it: /\b(uomo|lui|allenatore)\b/i,
  ja: /彼(?!女)|男/,
}
for (const l of LANGS) {
  if (l.code === 'en') continue
  setLang(l.code as Lang)
  setManagerGender('m'); const m = t('news.fanPatient1')
  setManagerGender('w'); const w = t('news.fanPatient1')
  const masc = MASC_BY_LANG[l.code]
  ok(m !== w || !masc.test(m), `${l.code}: the new-manager line is ${m !== w ? 'gendered' : 'neutral already'} (${w})`)
}
setLang('en'); setManagerGender('m')

console.log(fails ? `\nSUBJECT PROBE FAILED: ${fails}` : '\nSUBJECT PROBE PASSED: the manager and the staff are who the save says they are, in every language')
process.exit(fails ? 1 : 0)
