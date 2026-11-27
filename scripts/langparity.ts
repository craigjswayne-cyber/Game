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
import { SIBLING } from '../src/game/i18n'
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

// ---- THE ONE EXEMPTION (round 8, 25 Nov): the new match engine's words are English only for now ----
// The live pitch's commentary moved into en.json (src/game/sim/commentary.en.ts reads it back) before it is
// translated, and so did the new Extended match screen's own words (round 9). Until they are, the other five
// files may leave these out; a language that has one is held to it like any other key. Delete this block
// when the five files have them.
const AWAITING = ['sim', 'sim2', 'matchday.statPossession', 'matchday.statTerritory', 'matchday.statTries', 'matchday.statTackles', 'matchday.statPensConceded', 'matchday.optScrum',
  // (the overnight run's new screen words, 26 to 27 Nov: the pre-match, the cards, the decision sheets, the stats)
  'lp.refHot_breakdown', 'lp.refHot_offside', 'lp.refHot_scrum', 'lp.refHot_cards', 'lp.refHot_flow', 'lp.stDuels', 'lp.goalKickWith', 'lp.goalKickInto', 'lp.conWith', 'lp.conInto', 'lp.preHot', 'lp.duScrum', 'lp.duBreakdown', 'lp.duSteals', 'lp.duCarrier', 'lp.duTackler', 'lp.duCulprit', 'lp.coachOf', 'lp.coach_manUp', 'lp.coach_chasing', 'lp.coach_protecting', 'lp.coach_wetBall', 'lp.coach_scrumOnTop', 'lp.koShort', 'lp.koLong', 'lp.pushover', 'lp.scrumShove', 'lp.scrumEight', 'lp.scrumMove', 'lp.loFront', 'lp.loMiddle', 'lp.loTail', 'lp.penWarning', 'lp.stTeam', 'lp.stMen', 'lp.stCarries', 'lp.stTackles', 'lp.hintPosts', 'lp.hintTap', 'lp.hintCorner', 'lp.hintScrum', 'lp.hintNoLineout', 'lp.hintNoScrum', 'lp.hintCaptain', 'lp.tkGoal', 'lp.preRound', 'lp.preRef', 'lp.preLights', 'lp.preDay', 'lp.preCaptain', 'lp.preKicker', 'lp.preBench', 'lp.preSkip', 'lp.mcScorers', 'lp.mcPotm', 'lp.mcTries', 'lp.mcTry1', 'lp.mcCarries', 'lp.mcMetres', 'lp.mcTackles', 'lp.mcBreaks', 'lp.mcKicks', 'lp.mcGoals', 'lp.mcBreaksLabel', 'lp.mcTurnLabel', 'lp.mcNone']
const at = (o: unknown, path: string) => path.split('.').reduce<unknown>((x, k) => (x && typeof x === 'object' ? (x as Record<string, unknown>)[k] : undefined), o)
const awaitingCount = (o: unknown): number => (typeof o === 'string' || isPlural(o) ? 1 : o && typeof o === 'object' ? Object.values(o).reduce((a: number, v) => a + awaitingCount(v), 0) : 0)
console.log(`  note  ${AWAITING.reduce((a, g) => a + awaitingCount(at(EN, g)), 0)} English keys awaiting translation (${AWAITING.join(', ')}; exempt in fr, es, it, ja, af)`)

for (const lang of ['fr', 'es', 'it', 'ja', 'af']) {
  const D = load(lang)
  for (const g of AWAITING) {
    const parts = g.split('.'), last = parts.pop()!
    const host = parts.reduce<Record<string, unknown>>((x, k) => (x[k] ??= {}) as Record<string, unknown>, D)
    if (!(last in host)) host[last] = at(EN, g)
  }
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
        // a feminine sibling is a language's own business (i18n.ts, setWorld):
        // English owes nobody its `_f` keys and nobody owes English theirs
        if (SIBLING.test(k)) continue
        if (!(k in (o as object))) { errs.push(`${path}.${k}: missing`); continue }
        walk((e as Record<string, unknown>)[k], (o as Record<string, unknown>)[k], path ? `${path}.${k}` : k)
      }
      for (const k of Object.keys(o as object)) {
        if (SIBLING.test(k)) {
          // ...but a sibling must have a base to fall back to, and must fill
          // the same holes as that base, or the women's game renders a
          // different set of placeholders from the men's
          const base = k.replace(SIBLING, '')
          const ob = o as Record<string, unknown>
          if (!(base in ob)) { errs.push(`${path}.${k}: feminine form with no base key`); continue }
          const fv = ob[k], bv = ob[base]
          if (typeof fv === 'string' && typeof bv === 'string' && phs(fv) !== phs(bv))
            errs.push(`${path}.${k}: placeholders differ from ${base} (${phs(fv)} vs ${phs(bv)})`)
          if (isPlural(bv) && !isPlural(fv)) errs.push(`${path}.${k}: base is plural, sibling is not`)
          continue
        }
        if (!(k in (e as object))) errs.push(`${path}.${k}: extra key the English does not have`)
      }
    }
  }
  walk(EN, D, '')
  ok(errs.length === 0, `${lang}: mirrors the English key for key, placeholder for placeholder${errs.length ? ` - ${errs.length}+ problems, first: ${errs[0]}` : ''}`)
  if (errs.length) for (const e of errs.slice(0, 8)) console.log(`        ${e}`)
}

console.log(fails === 0
  ? '\nLANG PARITY PASSED: six languages, one game'
  : `\nLANG PARITY FAILED: ${fails}`)
process.exit(fails ? 1 : 0)
