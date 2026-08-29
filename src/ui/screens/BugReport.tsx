import { useMemo, useState } from 'react'
import { useStore } from '../../store'
import { SectionTitle } from '../components'
import {
  DEV_CONTACT, buildReport, crashCount, mailtoUrl, reportFilename,
} from '../../game/bugreport'
import { t } from '../../game/i18n'

/**
 * Report a Bug. Under the Handbook in the menu, because it is the other half of
 * the same question: the Handbook is how the game explains itself, this is how
 * it listens.
 *
 * THE PLAYER SEES THE WHOLE REPORT BEFORE IT MOVES. Nothing is collected
 * silently and nothing is uploaded - see game/bugreport.ts for why the game has
 * no network call at all. The four routes out are ordered by how likely each is
 * to work on a phone: the share sheet first (it is the only one that can carry
 * a screenshot alongside the text), then mail, then clipboard, then a file.
 */
export default function BugReport() {
  const game = useStore(s => s.game)
  const saveFail = useStore(s => s.saveFail)
  const saveFailMsg = useStore(s => s.saveFailMsg)
  const [notes, setNotes] = useState('')
  const [idea, setIdea] = useState('')
  const [ideaMsg, setIdeaMsg] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [showFull, setShowFull] = useState(false)

  // rebuilt as they type, because the preview below is the report - if the two
  // could differ, the promise that they see what they send would be a lie
  const report = useMemo(
    () => buildReport({ state: game, notes, saveFail: { count: saveFail, message: saveFailMsg } }),
    [game, notes, saveFail, saveFailMsg])

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const doShare = async () => {
    try {
      await navigator.share({ title: t('legacy.bgShareTitle'), text: report })
      setMsg(t('legacy.bgShared'))
    } catch (e) {
      // a share the player cancels rejects too, and telling him it failed when
      // he chose to back out is worse than saying nothing
      if ((e as Error)?.name !== 'AbortError') setMsg(t('legacy.bgShareFailed'))
    }
  }

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(report)
      setMsg(t('legacy.bgCopied'))
    } catch {
      // clipboard access is refused outright in some in-app browsers, so open
      // the text instead: selecting it by hand still gets the report out
      setShowFull(true)
      setMsg(t('legacy.bgCopyFailed'))
    }
  }

  const doDownload = () => {
    try {
      const url = URL.createObjectURL(new Blob([report], { type: 'text/plain' }))
      const a = document.createElement('a')
      a.href = url
      a.download = reportFilename(game)
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
      setMsg(t('legacy.bgSaved'))
    } catch {
      setMsg(t('legacy.bgSaveFailed'))
    }
  }

  // an idea is sent as itself: no save, no user agent, no crash ring
  const ideaBody = `PHASE: RUGBY MANAGER - IDEA\n\n${idea.trim()}\n`
  const ideaMail = mailtoUrl(ideaBody, 'PHASE: Rugby Manager - an idea')

  const doShareIdea = async () => {
    if (!idea.trim()) { setIdeaMsg(t('legacy.bgIdeaEmpty')); return }
    try {
      await navigator.share({ title: t('legacy.bgIdeasTitle'), text: ideaBody })
      setIdeaMsg(t('legacy.bgIdeaShared'))
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') setIdeaMsg(t('legacy.bgShareFailed'))
    }
  }

  const doCopyIdea = async () => {
    if (!idea.trim()) { setIdeaMsg(t('legacy.bgIdeaEmpty')); return }
    try {
      await navigator.clipboard.writeText(ideaBody)
      setIdeaMsg(t('legacy.bgCopied'))
    } catch {
      setIdeaMsg(t('legacy.bgCopyFailed'))
    }
  }

  const errs = crashCount()

  return (
    <div className="content">
      <SectionTitle sub={t('legacy.bgSub')}>{t('legacy.bgTitle')}</SectionTitle>

      <div className="card">
        <label className="bug-label" htmlFor="bug-notes">{t('legacy.bgWhatWrong')}</label>
        <textarea
          id="bug-notes"
          className="inline-input bug-notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={6}
          placeholder={t('legacy.bgPlaceholder')}
        />
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          {t('legacy.bgAttached')}
          {errs > 0 && t(errs === 1 ? 'legacy.bgErrAttached' : 'legacy.bgErrsAttached', { n: errs })}
        </div>
      </div>

      <div className="card">
        <div className="bug-label">{t('legacy.bgSendIt')}</div>
        <div className="btn-row">
          {canShare && <button className="btn gold" onClick={() => { void doShare() }}>{t('legacy.bgShare')}</button>}
          <a className="btn" href={mailtoUrl(report)}>{t('legacy.bgEmail')}</a>
          <button className="btn" onClick={() => { void doCopy() }}>{t('legacy.bgCopy')}</button>
          <button className="btn ghost" onClick={doDownload}>{t('legacy.bgSaveFile')}</button>
        </div>
        {msg && <div className="bug-msg">{msg}</div>}
        <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          <b>{t('legacy.bgScreenshotB')}</b>{t('legacy.bgScreenshot')}
          {t('legacy.bgMailGoesTo')}<b>{DEV_CONTACT}</b>{t('legacy.bgMailRest')}
        </div>
      </div>

      {/* IDEAS, NOT ONLY FAULTS (owner, v1.1.12: "could we add
          suggestions/feedback to the bug page - explain this is a passion
          project and always open to adding new features. send ideas to improve
          the game").
          Deliberately its OWN box with its own routes out, rather than a line
          added to the bug notes: somebody with an idea is not reporting a
          fault, and asking him to file one is how an idea goes unsent. And
          nothing is attached to it - a suggestion does not need a save file, a
          user agent or a crash ring, and saying so is the difference between
          a feedback box and a data collection box. */}
      <div className="card">
        <SectionTitle sub={t('legacy.bgIdeasSub')}>{t('legacy.bgIdeasTitle')}</SectionTitle>
        <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>{t('legacy.bgIdeasBlurb')}</div>
        <label className="bug-label" htmlFor="idea-notes">{t('legacy.bgIdeaLabel')}</label>
        <textarea
          id="idea-notes"
          className="inline-input bug-notes"
          value={idea}
          onChange={e => setIdea(e.target.value)}
          rows={4}
          placeholder={t('legacy.bgIdeaPlaceholder')}
        />
        <div className="btn-row" style={{ marginTop: 8 }}>
          {canShare && (
            <button className="btn gold" onClick={() => { void doShareIdea() }}>{t('legacy.bgShare')}</button>
          )}
          <a className="btn" href={ideaMail}
            onClick={e => { if (!idea.trim()) { e.preventDefault(); setIdeaMsg(t('legacy.bgIdeaEmpty')) } }}>
            {t('legacy.bgEmail')}
          </a>
          <button className="btn" onClick={() => { void doCopyIdea() }}>{t('legacy.bgCopy')}</button>
        </div>
        {ideaMsg && <div className="bug-msg">{ideaMsg}</div>}
        <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          {t('legacy.bgIdeaGoesTo')}<b>{DEV_CONTACT}</b>{t('legacy.bgIdeaRest')}
        </div>
      </div>

      <div className="card">
        <button className="btn ghost block" onClick={() => setShowFull(v => !v)}>
          {t(showFull ? 'legacy.bgHideFull' : 'legacy.bgShowFull')}
        </button>
        {showFull && <pre className="bug-preview">{report}</pre>}
      </div>
    </div>
  )
}
