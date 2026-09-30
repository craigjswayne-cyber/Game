/**
 * THE MANAGER'S DESK ON HOME (1.8.2, game/desk.ts).
 *
 * One card, top to bottom: what holds the week, the match, one line each on
 * the rest of the club and, when the memory has one live this week, the
 * question still to be answered. Every line is a button to the screen that
 * deals with it, and the masthead's Continue is the end of the chain. The
 * model is built by a pure function; this file only draws it.
 */
import type { ReactNode } from 'react'
import { useStore, type Screen } from '../store'
import { t } from '../game/i18n'
import { deskText, type Desk, type DeskDecision, type DeskGo, type DeskRow } from '../game/desk'
import { newsSubject, pressLabel, pressQuestion } from '../game/model'
import { prose, speech } from '../game/quotes'
import { IcoChevron } from './icons'

function useGo() {
  const go = useStore(s => s.go)
  return (to: DeskGo) => {
    if (to.inbox) { useStore.getState().openInbox(); return }
    go(to.screen as Screen, to.param)
  }
}

const Chev = () => <span className="chev"><IcoChevron /></span>

/** A decision: answered here when the press room would answer it the same
 *  way, a question with its buttons; anything else is a door. */
function Decision({ d, open }: { d: DeskDecision; open: boolean }) {
  const game = useStore(s => s.game)!
  const answer = useStore(s => s.answerPressOption)
  const to = useGo()
  const q = open && d.pressId != null ? game.press.find(p => p.id === d.pressId) : undefined
  if (q) {
    return (
      <div className="desk-q" data-kind={d.kind}>
        <button className="desk-link" onClick={() => to(d.go)}>
          <b>{deskText(d.line)}</b><Chev />
        </button>
        <div className="desk-qtext">{prose(pressQuestion(q))}</div>
        <div className="desk-opts">
          {q.options.map((o, i) => (
            <button key={i} className="chip" onClick={() => answer(q.id, i)}>{speech(pressLabel(o))}</button>
          ))}
        </div>
      </div>
    )
  }
  const story = d.newsId != null ? game.news.find(n => n.id === d.newsId) : undefined
  return (
    <button className="desk-link" data-kind={d.kind} onClick={() => to(d.go)}>
      <span>
        {deskText(d.line)}
        {/* the headline the tap opens, as the old inbox cue showed it */}
        {story && <span className="desk-headline">{newsSubject(story)}</span>}
      </span>
      <Chev />
    </button>
  )
}

function Row({ r }: { r: DeskRow }) {
  const to = useGo()
  return (
    <button className={`desk-row${r.alert ? ' alert' : ''}`} data-row={r.id} onClick={() => to(r.go)}>
      <span className="dr-l">{t(r.label)}</span>
      <span className="dr-t">{r.lines.map(deskText).join(' · ')}</span>
      <Chev />
    </button>
  )
}

export function DeskCard({ desk, match }: { desk: Desk; match: ReactNode }) {
  const list = desk.decisions
  // two on show: the one Continue stops on first, and the first question
  // that can be answered here (or simply the next one). The count in the
  // heading says how many are waiting in all.
  const answerable = list.find(d => d.pressId != null)
  const shown = list.length && answerable && answerable !== list[0] ? [list[0], answerable] : list.slice(0, 2)
  const open = shown.findIndex(d => d.pressId != null)
  const rows = desk.thread ? [...desk.rows, desk.thread] : desk.rows
  return (
    <div className="card desk-card" data-desk>
      {/* one column on a phone; beside each other from 640px, so the
          landscape phone and the tablet read the desk without scrolling.
          The heading rides in the first column so the rows start level
          with it rather than under it. */}
      <div className="desk-body">
        <div className="desk-main">
          <div className="desk-head">
            <div className="desk-sub">
              <span className="desk-today">{t('desk.title')}</span>
              <span>{t('desk.decide')}</span>
              {list.length ? <b className="desk-n">{list.length}</b> : null}
            </div>
          </div>
          {list.length === 0 && <div className="meta muted desk-clear">{t('desk.clear')}</div>}
          {shown.map((d, i) => <Decision key={`${d.kind}-${d.pressId ?? i}`} d={d} open={i === open} />)}
          {match}
        </div>
        {rows.length > 0 && (
          <div className="desk-rows">
            {rows.map(r => <Row key={r.id} r={r} />)}
          </div>
        )}
      </div>
    </div>
  )
}
