import { useState } from 'react'
import { HANDBOOK, HANDBOOK_CATS, type HandbookCat } from '../handbook'
import { SectionTitle } from '../components'
import { t } from '../../game/i18n'

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
  // SEARCH THE TRANSLATED TEXT, not the keys. e.q and e.a are i18n keys now,
  // so matching on them would find nothing a reader could have typed.
  const shown = searching
    ? HANDBOOK.filter(e => t(e.q).toLowerCase().includes(q) || t(e.a).toLowerCase().includes(q))
    : HANDBOOK.filter(e => e.cat === cat)
  const active = HANDBOOK_CATS.find(c => c.id === cat)!

  return (
    <>
      <div className="tab-bar">
        {HANDBOOK_CATS.map(c => (
          <button key={c.id} className={!searching && cat === c.id ? 'active' : ''}
            onClick={() => { setCat(c.id); setQuery(''); setOpen(null) }}>
            {t(c.label)}
          </button>
        ))}
      </div>
      <div className="preset-row">
        <input className="inline-input" placeholder={t('handbook.searchPlaceholder')} value={query}
          onChange={e => { setQuery(e.target.value); setOpen(null) }} />
      </div>

      <SectionTitle sub={searching
        ? t(shown.length === 1 ? 'handbook.answersOne' : 'handbook.answers', { n: shown.length, q: query.trim() })
        : t(active.sub)}>
        {searching ? t('handbook.search') : t(active.label)}
      </SectionTitle>

      {shown.length === 0 && (
        <div className="muted" style={{ padding: 14 }}>
          {t('handbook.nothingFound')}
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
                {t(HANDBOOK_CATS.find(c => c.id === e.cat)?.label ?? '')}
              </div>
            )}
            <div className="subj">{isOpen ? '▾ ' : '▸ '}{t(e.q)}</div>
            <div className="body">{t(e.a)}</div>
          </button>
        )
      })}
      </div>
      <div className="spacer" />
    </>
  )
}
