import { useMemo, useState } from 'react'
import { useStore } from '../../store'
import { SectionTitle } from '../components'
import {
  DEV_CONTACT, buildReport, crashCount, mailtoUrl, reportFilename,
} from '../../game/bugreport'

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
      await navigator.share({ title: 'PHASE: Rugby Manager - bug report', text: report })
      setMsg('Handed to your share sheet. Add a screenshot there if you have one.')
    } catch (e) {
      // a share the player cancels rejects too, and telling him it failed when
      // he chose to back out is worse than saying nothing
      if ((e as Error)?.name !== 'AbortError') setMsg('Your device would not open the share sheet. Try Copy instead.')
    }
  }

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(report)
      setMsg('Report copied. Paste it into a message or an e-mail.')
    } catch {
      // clipboard access is refused outright in some in-app browsers, so open
      // the text instead: selecting it by hand still gets the report out
      setShowFull(true)
      setMsg('This browser would not let the game use the clipboard. The full report is open below - select it and copy by hand.')
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
      setMsg('Saved to your device. Attach it to a message when you are ready.')
    } catch {
      setMsg('This browser would not save the file. Try Copy instead.')
    }
  }

  const errs = crashCount()

  return (
    <div className="content">
      <SectionTitle sub="Nothing leaves this device unless you send it">Report a Bug</SectionTitle>

      <div className="card">
        <label className="bug-label" htmlFor="bug-notes">What went wrong?</label>
        <textarea
          id="bug-notes"
          className="inline-input bug-notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={6}
          placeholder={'What were you doing?\nWhat did you expect to happen?\nWhat happened instead?'}
        />
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          The build, your club, the week, the seed and the last screens you visited are attached
          automatically. Your squad, your saves and your name are not.
          {errs > 0 && <> <b>{errs} error{errs > 1 ? 's' : ''}</b> the game caught {errs > 1 ? 'are' : 'is'} attached too.</>}
        </div>
      </div>

      <div className="card">
        <div className="bug-label">Send it</div>
        <div className="btn-row">
          {canShare && <button className="btn gold" onClick={() => { void doShare() }}>Share</button>}
          <a className="btn" href={mailtoUrl(report)}>E-mail</a>
          <button className="btn" onClick={() => { void doCopy() }}>Copy</button>
          <button className="btn ghost" onClick={doDownload}>Save file</button>
        </div>
        {msg && <div className="bug-msg">{msg}</div>}
        <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          <b>A screenshot helps more than anything you can type.</b> Take one with your phone
          the usual way, then use <b>Share</b> and attach it alongside this report - the game
          cannot take one for you.
          {' '}E-mail goes to <b>{DEV_CONTACT}</b>, and the mail route trims long reports;
          Copy and Save always carry the whole thing.
        </div>
      </div>

      <div className="card">
        <button className="btn ghost block" onClick={() => setShowFull(v => !v)}>
          {showFull ? 'Hide what gets sent' : 'Show exactly what gets sent'}
        </button>
        {showFull && <pre className="bug-preview">{report}</pre>}
      </div>
    </div>
  )
}
