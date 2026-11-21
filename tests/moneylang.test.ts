/**
 * ---- EVERY LANGUAGE WRITES MONEY ITS OWN WAY (1.9.16, model/money.ts) ----
 * Owner said yes to each language's own number style, pounds kept.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { fmtMoney, fmtWage } from '../src/game/model'
import { ensureLang, setLang, type Lang } from '../src/game/i18n'

const LANGS: Lang[] = ['en', 'af', 'fr', 'it', 'es', 'ja']
const SAMPLES = [0, 300, 950, 5_000, 8_600, 12_500, 99_960, 254_000, 999_600, 1_540_000, 11_800_000, 999_600_000, 1.2e9, 18e9]
const NB = '\u00a0'

beforeAll(async () => { for (const l of LANGS) await ensureLang(l) })
afterAll(() => setLang('en'))

describe('money in each language', () => {
  it('English is exactly what it was', () => {
    setLang('en')
    expect([950, 5_000, 254_000, 999_600, 1_540_000, 11_800_000, 1.2e9, -3.4e6].map(fmtMoney))
      .toEqual(['£950', '£5k', '£254k', '£1.0m', '£1.5m', '£12m', '£1.2bn', '-£3.4m'])
    expect([300, 8_600, 12_500, 99_960, 5_380_000].map(fmtWage)).toEqual(['£300', '£8.6k', '£12.5k', '£100k', '£5.4m'])
  })
  it('French, Italian and Spanish put the unit then the sign, with a decimal comma', () => {
    for (const l of ['fr', 'it', 'es'] as const) {
      setLang(l)
      expect(fmtMoney(1_540_000)).toBe(`1,5${NB}M£`)
      expect(fmtMoney(254_000)).toBe(`254${NB}k£`)
      expect(fmtMoney(950)).toBe(`950${NB}£`)
      expect(fmtWage(8_600)).toBe(`8,6${NB}k£`)
      expect(fmtMoney(-3_400_000)).toBe(`-3,4${NB}M£`)
    }
  })
  it('a billion: Md in French, Mld in Italian, thousands of millions in Spanish, mjd in Afrikaans', () => {
    setLang('fr'); expect(fmtMoney(1.2e9)).toBe(`1,2${NB}Md£`)
    setLang('it'); expect(fmtMoney(1.2e9)).toBe(`1,2${NB}Mld£`)
    setLang('es'); expect(fmtMoney(1.2e9)).toBe(`1.200${NB}M£`); expect(fmtMoney(18e9)).toBe(`18.000${NB}M£`)
    setLang('af'); expect(fmtMoney(1.2e9)).toBe('£1,2mjd'); expect(fmtMoney(1_540_000)).toBe('£1,5m')
  })
  it('Japanese counts in 万 and 億, and writes small sums out', () => {
    setLang('ja')
    expect([5_000, 254_000, 1_540_000, 11_800_000, 1.2e9].map(fmtMoney)).toEqual(['£5,000', '£25.4万', '£150万', '£1200万', '£12億'])
    expect([8_600, 12_500].map(fmtWage)).toEqual(['£8,600', '£1.25万'])
  })
  it('no figure in any language can break across a line, is empty, or loses its pound sign', () => {
    for (const l of LANGS) {
      setLang(l)
      for (const v of SAMPLES) for (const f of [fmtMoney, fmtWage]) {
        const s = f(v)
        expect(s, `${l} ${v}`).toContain('£')
        expect(s, `${l} ${v}`).not.toMatch(/ /) // a plain space would let a table cell split it
        expect(s.length, `${l} ${v} "${s}"`).toBeLessThanOrEqual(10)
      }
      expect(fmtMoney(NaN)).toBe('-')
    }
  })
  it('a bigger sum never prints as a smaller one, in any language', () => {
    const val = (s: string) => {
      const n = Number(s.replace(/[^0-9.,]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.'))
      return /億/.test(s) ? n * 1e8 : /万/.test(s) ? n * 1e4 : /bn|mjd|Md|Mld/.test(s) ? n * 1e9 : /M£|m$/.test(s) ? n * 1e6 : /k/.test(s) ? n * 1e3 : n
    }
    for (const l of LANGS) {
      setLang(l)
      let prev = -1
      for (const v of [...SAMPLES].sort((a, b) => a - b)) {
        const shown = val(l === 'ja' ? fmtMoney(v).replace(/,/g, '') : fmtMoney(v))
        expect(shown, `${l} ${v} "${fmtMoney(v)}"`).toBeGreaterThanOrEqual(prev)
        prev = shown
      }
    }
  })
})
