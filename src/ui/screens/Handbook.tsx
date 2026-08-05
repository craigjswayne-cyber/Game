import { useState } from 'react'
import { HANDBOOK, HANDBOOK_CATS, type HandbookCat } from '../handbook'
import { SectionTitle } from '../components'

/**
 * The Manager's Handbook. Every system in the game, in plain language.
 *
 * A search box first, because a player with a question wants the answer, not a
 * tour. Typing filters across every category at once; clearing it drops back to
 * the tabs. Answers stay collapsed until tapped, which keeps a category of
 * a dozen topics inside a screenful on a phone in landscape.
 */
export default function Handbook() {
  const [cat, setCat] = useState<HandbookCat>('match')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string | null>(null)

  const q = query.trim().toLowerCase()
  const searching = q.length >= 2
  const shown = searching
    ? HANDBOOK.filter(e => e.q.toLowerCase().includes(q) || e.a.toLowerCase().includes(q))
    : HANDBOOK.filter(e => e.cat === cat)
  const active = HANDBOOK_CATS.find(c => c.id === cat)!

  return (
    <>
      <div className="tab-bar">
        {HANDBOOK_CATS.map(c => (
          <button key={c.id} className={!searching && cat === c.id ? 'active' : ''}
            onClick={() => { setCat(c.id); setQuery(''); setOpen(null) }}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="preset-row">
        <input className="inline-input" placeholder="Search the handbook…" value={query}
          onChange={e => { setQuery(e.target.value); setOpen(null) }} />
      </div>

      <SectionTitle sub={searching
        ? `${shown.length} ${shown.length === 1 ? 'answer' : 'answers'} mentioning "${query.trim()}"`
        : active.sub}>
        {searching ? 'Search' : active.label}
      </SectionTitle>

      {shown.length === 0 && (
        <div className="muted" style={{ padding: 14 }}>
          Nothing in the handbook mentions that. Try a shorter word, or pick a tab above.
        </div>
      )}

      <div className="qa-list">
      {shown.map(e => {
        const key = `${e.cat}:${e.q}`
        const isOpen = open === key
        return (
          <button key={key} className={`news-item${isOpen ? ' open' : ''}`}
            onClick={() => setOpen(isOpen ? null : key)}>
            {searching && (
              <div className="when">
                {HANDBOOK_CATS.find(c => c.id === e.cat)?.label}
              </div>
            )}
            <div className="subj">{isOpen ? '▾ ' : '▸ '}{e.q}</div>
            <div className="body">{e.a}</div>
          </button>
        )
      })}
      </div>
      <div className="spacer" />
    </>
  )
}
