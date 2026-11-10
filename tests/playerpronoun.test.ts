// Player report, 1.9.11 (Bristol, PWR): "App calls female players he and
// him." Three stories about players carried their women's text under `_w`,
// the sibling that follows the MANAGER, instead of `_f`, the one that follows
// the WORLD (i18n.ts). So a women's career with a manager left on "he" read
// "so he misses the next one" about an injured woman, and a men's career with
// a manager on "she" read "The women who matter" about the opposition's men.
// And eight player lines had no women's text at all. A player line follows the
// world and only the world; the manager's pronoun must not move it.
import { afterEach, describe, expect, it } from 'vitest'
import { ensureLang, setLang, setManagerGender, setWorld, t, type Lang } from '../src/game/i18n'

const MASC = /\b(he|him|his|man|men)\b/i
const FEM = /\b(she|her|woman|women)\b/i

const LINES: [string, Record<string, string | number>][] = [
  ['news.trainInjury', { player: 'X', injury_k: 'common.nothing', n: 1 }],
  ['news.trainInjury', { player: 'X', injury_k: 'common.nothing', n: 3 }],
  ['news.grounds1', { club: 'Y' }],
  ['news.grounds4', { club: 'Y' }],
  ['oppreport.keyMen', { names: 'X' }],
  ['reply.renewedThisSeason', {}],
  ['dec.requestGranted', { player: 'X' }],
  ['dec.requestRefused', { player: 'X' }],
  ['moves.mv_winginDesc', {}],
  ['moves.mv_peelDesc', {}],
  ['moves.mv_tapgoDesc', {}],
  ['moves.mv_loop9Desc', {}],
  ['recruit.u_paceFade', {}],
]

afterEach(() => { setWorld('m'); setManagerGender('m') })

describe('a player line follows the world, never the manager', () => {
  for (const [key, v] of LINES) {
    for (const mgr of ['m', 'w'] as const) {
      it(`${key}: women's world, ${mgr === 'w' ? 'woman' : 'man'} manager, reads her`, () => {
        setLang('en'); setWorld('w'); setManagerGender(mgr)
        const s = t(key, v)
        expect(s, s).toMatch(FEM)
        expect(s, s).not.toMatch(MASC)
      })
      it(`${key}: men's world, ${mgr === 'w' ? 'woman' : 'man'} manager, reads him`, () => {
        setLang('en'); setWorld('m'); setManagerGender(mgr)
        const s = t(key, v)
        expect(s, s).toMatch(MASC)
        expect(s, s).not.toMatch(FEM)
      })
    }
  }
})

describe('every language has the women\'s form where its own text is gendered', () => {
  // Afrikaans, French, Spanish and Italian: the masculine marker each uses in
  // these lines. Japanese has none to change.
  const MARK: Partial<Record<Lang, RegExp>> = {
    fr: /\b(il|lui|homme|talonneur|(le|un|bon|mauvais) pilier|avant lancé)\b/i,
    es: /\b(él|hombre|talonador|delantero|pilier (equivocado|correcto))\b/i,
    it: /\b(lui|uomo|tallonatore|il pilone|avanti lanciato)\b/i,
    af: /\b(hy|hom|man|sy (kantlyn|skouer|aangee|spoed))\b/i,
  }
  for (const [lang, re] of Object.entries(MARK) as [Lang, RegExp][]) {
    it(lang, async () => {
      await ensureLang(lang)
      setLang(lang); setWorld('w'); setManagerGender('m')
      for (const [key, v] of LINES) {
        const s = t(key, v)
        expect(s, `${key}: ${s}`).not.toMatch(re)
      }
      setLang('en')
    })
  }
})

// The recheck of every language (owner, 10 Nov 2026): 36 player lines had a
// women's form in English and none in another language, so a women's career
// in French read "il revient au joueur le plus ancien" about its captain.
describe('player lines that had no women\'s form in one language', () => {
  const CASES: [Lang, string, RegExp, Record<string, string | number>][] = [
    ['fr', 'news.armband', /à la joueuse la plus ancienne/, { player: 'X', age: 30, pos: 'N8', how_k: 'common.nothing' }],
    ['fr', 'news.loanEnds', /elle rentre/, { player: 'X', club: 'Y' }],
    ['fr', 'comm.tired1', /Elle est sur la réserve/, { player: 'X' }],
    ['fr', 'news.riftHeated', /les joueuses/, { a: 'A', b: 'B' }],
    ['es', 'news.riftHeated', /las jugadoras/, { a: 'A', b: 'B' }],
    ['es', 'player.promotedMsg', /para ella/, { name: 'X' }],
    ['it', 'news.riftHeated', /le giocatrici/, { a: 'A', b: 'B' }],
    ['it', 'player.promotedMsg', /per lei/, { name: 'X' }],
    ['af', 'news.wAdvert2Subj', /terwyl sy/, { last: 'X' }],
    ['ja', 'reply.chatWarnStung', /彼女は/, {}],
  ]
  for (const [lang, key, want, v] of CASES) {
    it(`${lang} ${key}`, async () => {
      await ensureLang(lang)
      setLang(lang); setWorld('w'); setManagerGender('m')
      expect(t(key, v)).toMatch(want)
      setWorld('m')
      expect(t(key, v)).not.toMatch(want)
      setLang('en')
    })
  }
})
