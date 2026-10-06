import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import { PeopleChips, RequestAnswer } from './Inbox'
import { ContextCard, ResponseNeeded } from '../ContextCard'
import { NewsBody, NewsGo } from '../NewsBody'
import { newsBody, newsSubject, weekDate } from '../../game/model'
import { markRead } from '../../game/days'
import { t } from '../../game/i18n'
import { newsGlyph } from '../glyphs'
import { Byline, RuckMark } from '../Byline'


/** This week's stories, full screen, one page at a time - the breath between
 *  matches (8H feedback).
 *
 *  This is a reading FLOW, not a destination: it is entered from Continue with a
 *  queue of ids and it ends on "On to the Week". The browsable news list is the
 *  News screen, which is now the only one - the separate Rugby Wire screen was a
 *  second browser over the same array and has been merged in (user: "merge the
 *  rugby wire and news, its the same thing"). So this no longer bills itself as
 *  The Rugby Wire either; there is one name for news in the game. */
export default function Wire() {
  const game = useStore(s => s.game)!
  const queue = useStore(s => s.wireQueue)
  const home = useStore.getState().home
  const go = useStore(s => s.go)
  const [idx, setIdx] = useState(0)

  const items = queue.map(id => game.news.find(n => n.id === id)).filter((n): n is NonNullable<typeof n> => !!n)
  const n = items[Math.min(idx, Math.max(0, items.length - 1))]

  // markRead stamps WHEN, so the inbox's five-day shelf starts from the reading
  // and marks the save: read is career state (the desk gate counts it), and a
  // story read here and lost to a reload came back as unread mail (1.8.1)
  useEffect(() => { if (n) { markRead(game, n); void useStore.getState().persist() } }, [n])

  if (!n) {
    return (
      <div className="card center" style={{ margin: '20vh 16px' }}>
        <div className="meta">{t('week.wireQuietWeek')}</div>
        <button className="btn gold block" style={{ marginTop: 10 }} onClick={home}>{t('week.wireContinue')}</button>
      </div>
    )
  }

  const last = idx >= items.length - 1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', padding: '6px 14px 12px' }}>
      <div className="news-split">
      {/* THE STORY IS ITS OWN HEIGHT (owner, 27 Sep 2026, a screenshot of a
          three-line story in a box filling the phone: "boxes around them
          dont dwarf the page"). It used to stretch to fill the screen. */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', margin: 0 }}>
        <div className="wire-date" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span><Byline n={n} sep />{t('week.wireDateNews', { date: weekDate(n.season, n.week) })}</span>
          <span>{t('week.wirePos', { i: idx + 1, n: items.length })}</span>
        </div>
        <h2 style={{ fontSize: 18, lineHeight: 1.3, margin: '8px 0 10px' }}>
          {newsGlyph(n.type)} {newsSubject(n)}
        </h2>
        {/* PARAGRAPHS, not a wall (user: "news graphics seem so messy, tidy them
            up. use paragraphs"). pre-line honours the newlines the engine writes
            but gives them no space, so a three-part story read as one block with
            odd gaps in it. Real paragraphs get real air between them, and a blank
            line in the source no longer produces an empty one on screen. */}
        <div className="wire-body">
          <NewsBody body={newsBody(n)} />
        </div>
        <RuckMark n={n} />
        {/* the same chip row the inbox reader uses, so a name looks tappable in
            the same way wherever the story is being read (10F) */}
        <RequestAnswer n={n} />
        <PeopleChips n={n} />
        <NewsGo n={n} />
      </div>
      <ContextCard n={n} />
      </div>
      {/* ONE ROW, ONE LINE EACH (the same screenshot: "Skip the rest" wrapped
          onto three lines beside two wider buttons). Response Needed went: the
          header's own button already says Press Room when one is waiting. */}
      <div className="btn-row wire-actions" style={{ marginTop: 10 }}>
        {/* a way back (owner, v1.2.8: "there is no back button to previous
            story") - the reader only ever moved forward */}
        {idx > 0 && (
          <button className="btn ghost" style={{ flex: 0.6 }} aria-label={t('week.wirePrevStory')} title={t('week.wirePrevStory')}
            onClick={() => setIdx(idx - 1)}>◀</button>
        )}
        {!last && (
          <button className="btn ghost" onClick={() => { for (const it of items) markRead(game, it); void useStore.getState().persist(); home() }}>
            {t('week.wireSkipRest')}
          </button>
        )}
        <button className="btn gold" style={{ flex: 2 }}
          onClick={() => { if (last) home(); else setIdx(idx + 1) }}>
          {t(last ? 'week.wireOnToWeek' : 'week.wireNextStory')}
        </button>
      </div>
    </div>
  )
}
