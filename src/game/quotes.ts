// QUOTE MARKS, ONE RULE (press room, office talks, board decisions).
//
// The press room used to wrap every question and every answer in English
// curly quotes while half the strings brought their own, so a screen could
// print “... ”I'll be ready.”” in any of six languages. The rule now:
//
//  - A string never carries the outer quotes of the manager's own words. The
//    screen adds them with speech(), in the reader's convention.
//  - A question or a reaction is reported text, printed as it is. Speech
//    inside it uses the language's primary marks, set in the dictionary.
//  - A quotation inside the manager's words drops to the secondary marks.
//
//  en, af  “ ” with ‘ ’ inside
//  fr      « » (with the non-breaking space French sets inside) with “ ” inside
//  es, it  « » with “ ” inside
//  ja      「」 with 『』 inside
//
// speech() also strips any outer marks a stored line already has, so an answer
// saved in English before the rule (a career keeps its coverage for weeks)
// cannot come out doubled.
import { getLang, type Lang } from './i18n'

const NB = ' '
type Marks = { open: string; close: string; inOpen: string; inClose: string }
const MARKS: Record<Lang, Marks> = {
  en: { open: '“', close: '”', inOpen: '‘', inClose: '’' },
  af: { open: '“', close: '”', inOpen: '‘', inClose: '’' },
  fr: { open: '«' + NB, close: NB + '»', inOpen: '“', inClose: '”' },
  es: { open: '«', close: '»', inOpen: '“', inClose: '”' },
  it: { open: '«', close: '»', inOpen: '“', inClose: '”' },
  ja: { open: '「', close: '」', inOpen: '『', inClose: '』' },
}
const PAIRS: Record<string, string> = { '"': '"', "'": "'", '“': '”', '‘': '’', '«': '»', '「': '」', '『': '』' }

/** The line without the quote marks wrapped round the whole of it. */
export function unwrap(s: string): string {
  const all = (s ?? '').trim()
  // an answer can carry a note after its words - 'Judge us in May' (+£400k
  // war chest) - and the quotes were only ever round the words
  const note = /^(.*?)(\s*[(（][^()（）]*[)）])$/.exec(all)
  const v = note ? note[1] : all
  const tail = note ? note[2] : ''
  const close = PAIRS[v[0]]
  if (!close || v.length < 2 || !v.endsWith(close)) return all
  const inner = v.slice(1, -1)
  // “a” and “b” is two quotations, not one: leave it alone. A straight single
  // quote is let through regardless, because the apostrophes inside an
  // English line ('The board's targets are fair') look exactly the same.
  if (close !== "'" && inner.includes(close === '"' ? '"' : v[0])) return all
  return inner.replace(new RegExp(`^[${NB}\\s]+|[${NB}\\s]+$`, 'g'), '') + tail
}

/** The manager's own words, in the reader's quote marks. Empty in, empty out. */
export function speech(s: string, lang: Lang = getLang()): string {
  const v = unwrap(s ?? '')
  if (!v) return ''
  const m = MARKS[lang] ?? MARKS.en
  // a quotation inside it steps down to the secondary marks
  const inner = v
    .replace(/"([^"]*)"/g, `${m.inOpen}$1${m.inClose}`)
    .replace(/“([^”]*)”/g, `${m.inOpen}$1${m.inClose}`)
    .replace(new RegExp(`«[${NB} ]?([^»]*?)[${NB} ]?»`, 'g'), `${m.inOpen}$1${m.inClose}`)
    .replace(/「([^」]*)」/g, `${m.inOpen}$1${m.inClose}`)
  return m.open + inner + m.close
}

/** Reported text (a question, a reaction) from a line saved before the rule:
 *  straight double quotes become the reader's primary marks. Dictionary lines
 *  are already set and pass through unchanged. */
export function prose(s: string, lang: Lang = getLang()): string {
  if (!s || !s.includes('"')) return s ?? ''
  const m = MARKS[lang] ?? MARKS.en
  return s.replace(/"([^"]*)"/g, `${m.open}$1${m.close}`)
}
