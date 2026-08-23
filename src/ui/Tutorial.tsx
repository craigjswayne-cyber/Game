import { useStore } from '../store'
import { t } from '../game/i18n'

/** The welcome dialog: how the game is played, in four paragraphs.
 *
 *  It used to live inside Home, which caused three problems (blocker A2). It
 *  had no maximum height and no scroll, so on a short landscape phone the last
 *  two paragraphs and the close hint were simply off the bottom of the screen.
 *  Any tap anywhere closed it, including the drag of a scroll. And dismissing
 *  it was permanent, with no way in the whole game to read it again.
 *
 *  Living above the screen stack instead, it scrolls, it has a real button, and
 *  Manager > How to play brings it back whenever you want it. */
export default function Tutorial() {
  const tut = useStore(s => s.tut)
  const close = useStore(s => s.closeTut)
  if (!tut) return null

  return (
    <div className="tut-veil" onClick={close}>
      {/* the box swallows its own taps: with a scrolling panel, closing on any
          touch inside would fire the moment you tried to read past the fold */}
      <div className="tut-box" onClick={e => e.stopPropagation()}>
        {/* ---- plain words, short sentences, one idea each ----
            The old version explained four systems at once in sentences with
            three clauses and five bold phrases, and used shorthand the game had
            not taught yet: "Match Preparation on the Tactics screen", "at any
            stoppage (📋)". Somebody opening this on their first minute does not
            know what any of that means. Rewritten as five plain steps in the
            order they happen, with the one button named first (user: "check the
            language on how to play, should be fairly idiot proof"). */}
        {/* The bold phrases inside these steps name real buttons, so they are
            interpolated rather than written into the sentence: a translator has
            to be able to move "Continue" to wherever French puts it, and it has
            to read the same as the button it points at. */}
        <h3>{t('report.tutTitle')}</h3>
        <b>{t('report.tut1b')}</b>{t('report.tut1', { continue: t('report.tutContinue'), matchday: t('report.tutMatchday') })}
        <br /><br />
        <b>{t('report.tut2b')}</b>{t('report.tut2', { team: t('report.tutTeam'), bestXV: t('report.tutBestXV') })}
        <br /><br />
        <b>{t('report.tut3b')}</b>{t('report.tut3', { kickOff: t('report.tutKickOff') })}
        <br /><br />
        <b>{t('report.tut4b')}</b>{t('report.tut4', { handbook: t('report.tutHandbook') })}
        <br /><br />
        <b>{t('report.tut5b')}</b>{t('report.tut5')}
        <div className="muted">{t('report.tutAlwaysHere', { manager: t('report.tutManager'), howToPlay: t('report.tutHowToPlay') })}</div>
        <div className="tut-close">
          <button className="btn gold" onClick={close}>{t('report.tutGotIt')}</button>
        </div>
      </div>
    </div>
  )
}
