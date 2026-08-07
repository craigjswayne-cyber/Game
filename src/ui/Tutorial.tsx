import { useStore } from '../store'

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
        <h3>Welcome to the dugout</h3>
        Everything runs off <b>Continue</b> in the top corner - it advances the week, plays your match, and brings the world to your inbox.
        <br /><br />
        On match day: pick your XV, choose a <b>dressing-room speech</b>, and confirm you're ready. In play you can change tactics or make subs at <b>any stoppage</b> (📋), and when you win a kickable penalty, the call - posts, corner or tap - is yours.
        <br /><br />
        Between games: set the week's <b>Match Preparation</b> on the Tactics screen, praise or challenge players one-to-one from their <b>profile</b>, read <b>The Rugby Wire</b> for rumours, and build your coaching staff in <b>Training</b>. Impress, and a <b>national team</b> may come calling.
        <br /><br />
        Every system in the game is explained, in plain language and with the real numbers, in <b>The Manager's Handbook</b> under the Manager menu. It has a search box. Nothing here is meant to be a mystery.
        <div className="muted">You can read this again any time from <b>Manager</b> &gt; <b>How to play</b>.</div>
        <div className="tut-close">
          <button className="btn gold" onClick={close}>Got it, let me manage</button>
        </div>
      </div>
    </div>
  )
}
