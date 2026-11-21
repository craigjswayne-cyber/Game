// Money as the reader sees it: one ladder for fees and balances, one for
// wages, and the number a printed figure stands for.
import { getLang } from '../i18n'

/**
 * ---- EVERY LANGUAGE WRITES MONEY ITS OWN WAY (1.9.16) ----
 *
 * Owner, 21 Nov 2026, asked whether money was a problem in the other
 * languages, was shown that every figure printed the English way in all six
 * ("£1.5m" to a French reader who writes "1,5 M£"), and said yes to each
 * language's own style, with pounds kept as the game's currency. One table,
 * read by fmtMoney and fmtWage, so no screen formats a figure for itself:
 *
 *   en  £1.5m   £250k   £1.2bn   £8.6k      the game as it always was
 *   af  £1,5m   £250k   £1,2mjd  £8,6k      decimal comma; mjd is miljard
 *   fr  1,5 M£  250 k£  1,2 Md£  8,6 k£     unit then sign, as fr.json's own
 *   it  1,5 M£  250 k£  1,2 Mld£ 8,6 k£     board line already wrote "130 M£"
 *   es  1,5 M£  250 k£  1.200 M£ 8,6 k£     no word for a billion: thousands of millions
 *   ja  £150万  £25万   £12億    £8,600     counted in 万 (ten thousand) and 億
 *
 * The spaces are no-break spaces, so a figure never splits across two lines
 * of a table cell. The NUMBER printed is the same in every language: each is
 * the English rounding re-dressed, so "£12m ... £7.5m, so £4.3m over"
 * (shownMoney) holds in all six.
 */
type MoneyStyle = { dec: string; before: boolean; k: string; m: string; bn: string | null }
const NB = '\u00a0'
const STYLE: Record<string, MoneyStyle> = {
  en: { dec: '.', before: true, k: 'k', m: 'm', bn: 'bn' },
  af: { dec: ',', before: true, k: 'k', m: 'm', bn: 'mjd' },
  fr: { dec: ',', before: false, k: `${NB}k£`, m: `${NB}M£`, bn: `${NB}Md£` },
  it: { dec: ',', before: false, k: `${NB}k£`, m: `${NB}M£`, bn: `${NB}Mld£` },
  es: { dec: ',', before: false, k: `${NB}k£`, m: `${NB}M£`, bn: null },
}
const group = (n: number, sep: string) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, sep)

/** One figure in the reader's style. `num` is the digits as English prints
 *  them ("1.5", "250"), `tier` is which unit they are counted in. */
function dress(sign: string, num: string, tier: '' | 'k' | 'm' | 'bn', raw: number): string {
  const lang = getLang()
  if (lang === 'ja') {
    // 万 = 10,000 and 億 = 100,000,000; under ten thousand it is written out
    const v = tier === 'bn' ? Number(num) * 1e9 : tier === 'm' ? Number(num) * 1e6 : tier === 'k' ? Number(num) * 1e3 : raw
    const trim = (x: number) => String(Number(x.toFixed(2)))
    if (v >= 1e8) return `${sign}£${trim(v / 1e8)}億`
    if (v >= 1e4) return `${sign}£${trim(v / 1e4)}万`
    return `${sign}£${group(v, ',')}`
  }
  const st = STYLE[lang] ?? STYLE.en
  if (tier === 'bn' && st.bn == null) {
    // Spanish: a billion is a thousand million, and is written so
    return `${sign}${group(Number(num) * 1000, '.')}${st.m}`
  }
  const n = num.replace('.', st.dec)
  const unit = tier === '' ? (st.before ? '' : `${NB}£`) : tier === 'bn' ? st.bn! : st[tier]
  return st.before ? `${sign}£${n}${unit}` : `${sign}${n}${unit}`
}

/**
 * A WAGE, at a precision a manager can actually use.
 *
 * fmtMoney rounds to the nearest thousand, which is right for fees and balances
 * and wrong for wages: it printed £8,600 and £9,400 as the same "£9k", so two
 * players on visibly different money looked identical in a squad list, and a
 * camp asking £12,500 was quoted back as "£13k" by the row underneath. Reported
 * as "wages should be clearer on the players".
 *
 * One decimal below £100k is enough to separate anybody in this game, and it
 * stays within six characters, so no table column has to grow to carry it.
 */
export function fmtWage(v: number): string {
  if (!Number.isFinite(v)) return '-'
  const sign = v < 0 ? '-' : ''
  const a = Math.abs(v)
  if (a < 1_000) return dress(sign, String(Math.round(a)), '', Math.round(a))
  if (a < 100_000) {
    const k = a / 1_000
    // one decimal, but never a pointless ".0"
    const t = k >= 99.95 ? '100' : k.toFixed(1).replace(/\.0$/, '')
    return dress(sign, t, 'k', a)
  }
  // ONE MILLION IS WHERE THOUSANDS STOP READING. Above this the old line
  // printed a comma'd "£5,380k" - the only comma-grouped figure anywhere in
  // the game, sitting in a column of "£25k" and "£130m", and reached by any
  // club whose wage ceiling passes a million (the Board Injections lift it by
  // up to 80% each). Hand it to fmtMoney and it reads "£5.4m" like every
  // other large sum. Below a million, thousands are still the right unit for
  // a weekly wage, which is the whole reason this function exists.
  // the tier is chosen after rounding, as fmtMoney does: £999,600 is "£1.0m",
  // not "£1000k" (1.6.3)
  if (Math.round(a / 1_000) < 1000) return dress(sign, String(Math.round(a / 1_000)), 'k', a)
  return fmtMoney(v)
}

export function fmtMoney(v: number): string {
  // a figure that is not a figure prints as a dash, never "£NaN" (1.6.3)
  if (!Number.isFinite(v)) return '-'
  const sign = v < 0 ? '-' : ''
  const a = Math.abs(v)
  const K = 1_000, M = 1_000_000, B = 1_000_000_000
  // Two things, both found by walking this ladder end to end in
  // scripts/extremes.ts after running a club up to fifty billion on purpose.
  //
  // One: there is a billions tier now. The scale stopped at millions, so a very
  // rich club read "£18015m" - seven digits crammed into a phone table cell.
  //
  // Two, and this one bites at ordinary money: the tier is chosen AFTER
  // rounding, not before. £999,600 used to round up inside the thousands tier
  // and print "£1000k" rather than "£1.0m", and the same edge printed "£1000m"
  // just under a billion. Any balance can sit on that edge.
  if (a >= B || Math.round(a / M) >= 1000) return dress(sign, (a / B).toFixed(a >= 10 * B ? 0 : 1), 'bn', a)
  if (a >= M || Math.round(a / K) >= 1000) return dress(sign, (a / M).toFixed(a >= 10 * M ? 0 : 1), 'm', a)
  if (a >= K) return dress(sign, String(Math.round(a / K)), 'k', a)
  return dress(sign, String(a), '', a)
}

/**
 * The number fmtMoney prints, as a number. A difference shown next to two
 * printed figures has to be the difference of what is printed (1.8.15:
 * "£12m ... valued at £7.5m, so this is £4.3m over" was right to the pound
 * and wrong to anyone reading it, because £11.8m prints as £12m).
 */
export function shownMoney(v: number): number {
  if (!Number.isFinite(v)) return 0
  const a = Math.abs(v), sg = v < 0 ? -1 : 1
  const K = 1_000, M = 1_000_000, B = 1_000_000_000
  const at = (unit: number, dp: number) => sg * Number((a / unit).toFixed(dp)) * unit
  if (a >= B || Math.round(a / M) >= 1000) return at(B, a >= 10 * B ? 0 : 1)
  if (a >= M || Math.round(a / K) >= 1000) return at(M, a >= 10 * M ? 0 : 1)
  if (a >= K) return sg * Math.round(a / K) * K
  return v
}
