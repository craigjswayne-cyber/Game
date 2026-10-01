import { useMemo, useState } from 'react'
import { useStore } from '../../store'
import { SectionTitle } from '../components'
import { buildReport, mailtoUrl, reportFilename } from '../../game/bugreport'
import { t } from '../../game/i18n'
import { BUG_CHANNEL_URL, IDEAS_URL } from '../../game/community'
import { Glyph } from '../glyphs'

/**
 * Report a Bug. Under the Handbook in the menu, because it is the other half of
 * the same question: the Handbook is how the game explains itself, this is how
 * it listens.
 *
 * Nothing is collected silently and nothing is uploaded - see
 * game/bugreport.ts for why the game has no network call at all. The routes
 * out are ordered by how likely each is to work on a phone: the share sheet
 * first (it is the only one that can carry a screenshot alongside the text),
 * then mail, then clipboard, then Discord, then a file.
 *
 * A TITLE, THE FIELDS AND THE BUTTONS (owner, round 4: "too much text"). The
 * paragraphs about what is attached, where the mail goes and how to add a
 * screenshot are gone, and so is the full-report toggle; what each route
 * sends is exactly what it sent before.
 *
 * NO SECOND .content BOX. This page used to wrap itself in
 * <div className="content"> inside the app's own <main className="content">.
 * The inner box was a scroll container of its own (overflow-y auto,
 * overscroll-behavior contain) that never had anything to scroll, so on a
 * phone a finger dragged on it went nowhere and the send buttons stayed below
 * the fold (owner, round 4: "does not scroll on a phone"). A wheel still
 * worked, which is why nobody at a desk saw it. scripts/tidyshots.mjs drags it
 * by touch at 390x844 and 360x640.
 */
export default function BugReport() {
  const game = useStore(s => s.game)
  const saveFail = useStore(s => s.saveFail)
  const saveFailMsg = useStore(s => s.saveFailMsg)
  const [notes, setNotes] = useState('')
  const [idea, setIdea] = useState('')
  const [ideaMsg, setIdeaMsg] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  // only ever set when the clipboard refuses: the report is then shown so it
  // can be selected by hand
  const [showFull, setShowFull] = useState(false)

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

  // THE DISCORD ROUTE (1.8.1). The link opens the server; the tap also puts
  // the report on the clipboard, so the player lands in Discord with it ready
  // to paste into /bug. Nothing is sent: the player pastes it themselves.
  const copyFor = (text: string, done: string, set: (m: string) => void) => {
    navigator.clipboard?.writeText(text).then(() => set(t(done)), () => set(t('legacy.bgDiscordFailed')))
      ?? set(t('legacy.bgDiscordFailed'))
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

  return (
    <>
      <SectionTitle>{t('legacy.bgTitle')}</SectionTitle>

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
        <div className="btn-row bug-send" style={{ marginTop: 8 }}>
          {canShare && <button className="btn gold" onClick={() => { void doShare() }}>{t('legacy.bgShare')}</button>}
          <a className="btn" href={mailtoUrl(report)}>{t('legacy.bgEmail')}</a>
          <button className="btn" onClick={() => { void doCopy() }}>{t('legacy.bgCopy')}</button>
          <a className="btn" href={BUG_CHANNEL_URL} target="_blank" rel="noopener noreferrer"
            onClick={() => copyFor(report, 'legacy.bgDiscordDone', setMsg)}>
            {t('legacy.bgDiscord')}
          </a>
          <button className="btn ghost" onClick={doDownload}>{t('legacy.bgSaveFile')}</button>
        </div>
        {msg && <div className="bug-msg">{msg}</div>}
        {showFull && <pre className="bug-preview">{report}</pre>}
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
      <div className="card bug-ideas">
        <SectionTitle>{t('legacy.bgIdeasTitle')}</SectionTitle>
        {/* IDEAS LIVE ON DISCORD (owner, round 6): the first thing in the box
            is the way there, a plain link the player taps (game/community.ts),
            so an in-app browser and the Android shell both follow it out. An
            idea already written goes with it on the clipboard. */}
        <a className="btn gold block ideas-discord" href={IDEAS_URL} target="_blank" rel="noopener noreferrer"
          onClick={() => { if (idea.trim()) copyFor(ideaBody, 'legacy.bgIdeaDiscordDone', setIdeaMsg) }}>
          <Glyph name="gossip" /> {t('menu.ideasDiscord')}
        </a>
        <label className="bug-label" htmlFor="idea-notes">{t('legacy.bgIdeaLabel')}</label>
        <textarea
          id="idea-notes"
          className="inline-input bug-notes"
          value={idea}
          onChange={e => setIdea(e.target.value)}
          rows={4}
          placeholder={t('legacy.bgIdeaPlaceholder')}
        />
        <div className="btn-row bug-send" style={{ marginTop: 8 }}>
          {canShare && (
            <button className="btn" onClick={() => { void doShareIdea() }}>{t('legacy.bgShare')}</button>
          )}
          <a className="btn" href={ideaMail}
            onClick={e => { if (!idea.trim()) { e.preventDefault(); setIdeaMsg(t('legacy.bgIdeaEmpty')) } }}>
            {t('legacy.bgEmail')}
          </a>
          <button className="btn" onClick={() => { void doCopyIdea() }}>{t('legacy.bgCopy')}</button>
        </div>
        {ideaMsg && <div className="bug-msg">{ideaMsg}</div>}
      </div>
      <div className="spacer" />
    </>
  )
}
