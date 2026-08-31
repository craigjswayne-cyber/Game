/**
 * ---- EVERY LANGUAGE IS THE WHOLE GAME ----
 *
 * v1.2.0 took the dictionary from two languages to five. The French had years
 * of probes holding it to the English key for key; the new three get the same
 * law from day one, in one place:
 *
 *   1. every key the English has, every language has - no branch missing, no
 *      key extra, because t() falling back to English mid-sentence is how a
 *      player finds out the translation is a veneer;
 *   2. every {placeholder} survives translation, exactly as many times - a
 *      dropped {n} renders "signed for {n}m" as a lie;
 *   3. plural entries keep their shape (Japanese may answer both forms with
 *      the same string - the language has no grammatical plural - but the
 *      shape stays so render() never meets a hole).
 *
 * Run: npx vite-node scripts/langparity.ts
 */
import { readFileSync } from 'node:fs'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : ' FAIL '} ${what}`)
  if (!c) fails++
}

const load = (l: string) => JSON.parse(readFileSync(`src/locales/${l}.json`, 'utf8')) as Record<string, unknown>
const EN = load('en')
const PH = /\{(\w+)\}/g
const phs = (s: string) => [...s.matchAll(PH)].map(m => m[1]).sort().join(',')
const isPlural = (v: unknown): v is Record<string, string> =>
  !!v && typeof v === 'object' && 'other' in (v as object) && Object.values(v as object).every(x => typeof x === 'string')

for (const lang of ['fr', 'es', 'it', 'ja']) {
  const D = load(lang)
  const errs: string[] = []
  const walk = (e: unknown, o: unknown, path: string) => {
    if (errs.length > 25) return
    if (isPlural(e)) {
      if (!isPlural(o)) { errs.push(`${path}: plural shape lost`); return }
      for (const form of Object.keys(e)) {
        const tgt = o[form] ?? o.other
        // the 'one' form may drop {n} - "une semaine" needs no figure, and the
        // French has always written it so - but nothing else may go missing
        const want = form === 'one' ? phs(e[form].replace('{n}', '')) : phs(e[form])
        const got = form === 'one' ? phs(tgt.replace('{n}', '')) : phs(tgt)
        const lenient = form === 'one' && phs(tgt) === phs(e[form])
        if (want !== got && !lenient) errs.push(`${path}.${form}: placeholders drifted`)
      }
    } else if (typeof e === 'string') {
      if (typeof o !== 'string') errs.push(`${path}: not a string`)
      else if (phs(e) !== phs(o)) errs.push(`${path}: placeholders drifted (${phs(e)} vs ${phs(o)})`)
    } else if (e && typeof e === 'object') {
      if (!o || typeof o !== 'object') { errs.push(`${path}: branch missing`); return }
      for (const k of Object.keys(e)) {
        if (!(k in (o as object))) { errs.push(`${path}.${k}: missing`); continue }
        walk((e as Record<string, unknown>)[k], (o as Record<string, unknown>)[k], path ? `${path}.${k}` : k)
      }
      for (const k of Object.keys(o as object)) {
        if (!(k in (e as object))) errs.push(`${path}.${k}: extra key the English does not have`)
      }
    }
  }
  walk(EN, D, '')
  ok(errs.length === 0, `${lang}: mirrors the English key for key, placeholder for placeholder${errs.length ? ` - ${errs.length}+ problems, first: ${errs[0]}` : ''}`)
  if (errs.length) for (const e of errs.slice(0, 8)) console.log(`        ${e}`)
}

console.log(fails === 0
  ? '\nLANG PARITY PASSED: five languages, one game'
  : `\nLANG PARITY FAILED: ${fails}`)
process.exit(fails ? 1 : 0)
