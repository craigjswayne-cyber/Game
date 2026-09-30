import type { ReactNode } from 'react'
import { paragraphs } from './components'
import { useStore, type Screen } from '../store'
import { t } from '../game/i18n'
import type { NewsItem } from '../game/model'

/**
 * ---- A STORY THAT CARRIES DATA READS AS DATA (1.8.2) ----
 *
 * Owner, on a new career at Northampton: "news stories are messy and hard to
 * read. Clean them up and be concise." The assistant's read on the squad was a
 * quoted paragraph holding eight numbers, the backroom story was one sentence
 * naming eight people, and the scouts' list was a run-on of names, ages and
 * clubs. Those are tables written out as prose.
 *
 * So a story's text may now mark its structure, in any language, with two
 * line shapes the translations write as they are:
 *
 *   Label | value      a fact row: label on the left, value on the right
 *   • item             a compact list row
 *   > words            a quoted voice (the terraces, a supporter)
 *
 * Consecutive rows of one shape group into one block. Every other line is a
 * paragraph, split the way paragraphs() always split them. A story with no
 * marks renders exactly as before.
 *
 * The saved English body is untouched: this reads the rendered text only.
 */
type Block =
  | { kind: 'p'; text: string }
  | { kind: 'rows'; rows: [string, string][] }
  | { kind: 'list'; items: string[] }
  | { kind: 'quote'; items: string[] }

const ROW = /^(.+?) \| (.+)$/

export function newsBlocks(body: string): Block[] {
  const out: Block[] = []
  let prose: string[] = []
  const flush = () => {
    if (prose.length) for (const text of paragraphs(prose.join('\n'))) if (text) out.push({ kind: 'p', text })
    prose = []
  }
  for (const raw of (body ?? '').split('\n')) {
    const line = raw.trim()
    if (!line) { flush(); continue }
    const row = ROW.exec(line)
    if (row) {
      flush()
      const l2 = out[out.length - 1]
      if (l2?.kind === 'rows') l2.rows.push([row[1], row[2]])
      else out.push({ kind: 'rows', rows: [[row[1], row[2]]] })
      continue
    }
    if (line.startsWith('• ')) {
      flush()
      const l2 = out[out.length - 1]
      if (l2?.kind === 'list') l2.items.push(line.slice(2))
      else out.push({ kind: 'list', items: [line.slice(2)] })
      continue
    }
    if (line.startsWith('> ')) {
      flush()
      const l2 = out[out.length - 1]
      if (l2?.kind === 'quote') l2.items.push(line.slice(2))
      else out.push({ kind: 'quote', items: [line.slice(2)] })
      continue
    }
    prose.push(line)
  }
  flush()
  return out
}

/** The same story as one plain string, for the places that show a line of it
 *  (a list preview, a clamp): rows read "label: value", marks are dropped. */
export function plainNews(body: string): string {
  return (body ?? '').split('\n').map(l => {
    const t = l.trim()
    const row = ROW.exec(t)
    if (row) return `${row[1]}: ${row[2]}`
    if (t.startsWith('• ') || t.startsWith('> ')) return t.slice(2)
    return t
  }).join('\n')
}

/** **name** renders bold: the loan postcards mark the player names. */
const inline = (s: string): ReactNode[] =>
  s.split(/\*\*(.+?)\*\*/g).map((seg, j) => j % 2 === 1 ? <b key={j}>{seg}</b> : seg)

export function NewsBody({ body }: { body: string }) {
  return (
    <>
      {newsBlocks(body).map((b, i) => {
        if (b.kind === 'p') return <p key={i}>{inline(b.text)}</p>
        if (b.kind === 'rows') return (
          <dl key={i} className="news-facts">
            {b.rows.map(([k, v], j) => (
              <div key={j} className="news-fact"><dt>{inline(k)}</dt><dd>{inline(v)}</dd></div>
            ))}
          </dl>
        )
        if (b.kind === 'list') return (
          <ul key={i} className="news-list">{b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ul>
        )
        return (
          <div key={i} className="news-quotes">{b.items.map((it, j) => <blockquote key={j}>{inline(it)}</blockquote>)}</div>
        )
      })}
    </>
  )
}

/**
 * ---- WHERE A STORY'S BUSINESS IS DONE, AS A TAP (1.8.2) ----
 *
 * Owner: "no tips in news". The stories used to end on a sentence pointing at
 * a screen ("Respond from the Transfers screen", "Answer it on your Manager
 * Profile"). The sentence is gone; a story that asks for something done
 * elsewhere carries one quiet link there instead, named by the screen's own
 * title so it reads as a place, not an instruction.
 */
const NEWS_GO: Record<string, [Screen, string?]> = {
  bidIn: ['offers'], bidDeadline: ['offers'], biddingWar: ['offers'],
  natOffer: ['profile'], natAppointed: ['profile'],
  natSquad: ['country'],
  crisisCover: ['transfers'],
  mentFailing: ['report', 'mentoring'], mentorSpread: ['report', 'mentoring'],
  dreamRefocus: ['legacy'],
  armband: ['tactics'],
  inheritedStaff: ['training'], inheritedStaffVacant: ['training'],
  backItUp: ['saves'],
  jobOffered: ['jobs'],
}

export function NewsGo({ n }: { n: NewsItem }) {
  const go = useStore(s => s.go)
  const base = (n.k ?? '').replace(/^news\./, '').replace(/_[fw]$/, '')
  const to = NEWS_GO[base]
  if (!to) return null
  return (
    <button className="btn ghost news-go" onClick={() => go(to[0], to[1])}>
      {t(`titles.${to[0]}`)} <span aria-hidden>›</span>
    </button>
  )
}
