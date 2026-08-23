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

      <div className="card">
        <button className="btn ghost block" onClick={() => setShowFull(v => !v)}>
          {t(showFull ? 'legacy.bgHideFull' : 'legacy.bgShowFull')}
        </button>
        {showFull && <pre className="bug-preview">{report}</pre>}
      </div>
    </div>
  )
}
