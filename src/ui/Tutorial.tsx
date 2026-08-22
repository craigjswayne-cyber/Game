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
        {/* ---- plain words, short sentences, one idea each ----
            The old version explained four systems at once in sentences with
            three clauses and five bold phrases, and used shorthand the game had
            not taught yet: "Match Preparation on the Tactics screen", "at any
            stoppage (📋)". Somebody opening this on their first minute does not
            know what any of that means. Rewritten as five plain steps in the
            order they happen, with the one button named first (user: "check the
            language on how to play, should be fairly idiot proof"). */}
        <h3>How this works</h3>
        <b>1. One button moves the game on.</b> It says <b>Continue</b> at the top of the screen. Press it and a day goes by. Press it again and again and you walk through the week - who is injured, what the press want, who is for sale - until Saturday, when the button says <b>Matchday</b>.
        <br /><br />
        <b>2. Pick your team.</b> Tap the clipboard at the bottom, then <b>Team</b> - you land on the team sheet. Tap two players to swap them, or press <b>Best XV</b> and let your assistant draft one - then fix what he got wrong. You have fifteen starters and eight replacements.
        <br /><br />
        <b>3. Play the match.</b> Press <b>Kick Off</b>. You say a few words to the players first - pick whichever one feels right, there is no wrong answer. During the game you can bring on replacements or change how you play. When you win a penalty near their line, you choose: kick at the posts for three points, or go to the corner and try for a try.
        <br /><br />
        <b>4. Nothing is hidden.</b> Every number in this game has a page explaining it, in plain English, in <b>The Manager's Handbook</b> (bottom right, Manager). It has a search box. If something confuses you, it is in there.
        <br /><br />
        <b>5. You will lose games.</b> That is the game working, not you doing it wrong. The board tells you what it expects on the Finances screen, and you have a season to deliver it.
        <div className="muted">This page is always here: <b>Manager</b> &gt; <b>How to play</b>.</div>
        <div className="tut-close">
          <button className="btn gold" onClick={close}>Got it, let me manage</button>
        </div>
      </div>
    </div>
  )
}
