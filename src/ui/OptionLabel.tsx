/**
 * AN ANSWER ON A BUTTON (owner, round 5): the words, and under them, smaller
 * and grey, the note that used to sit in brackets after them ("Warm-weather
 * camp" over "£400k"). The board's decisions, the press room and the desk
 * all draw their choices through this, so one choice reads the same on each.
 * `say` puts the words in the reader's quote marks (the manager's own words
 * in the press room); the board's choices are decisions, not quotes.
 */
import { optionParts, speech } from '../game/quotes'

export function OptionLabel({ text, say }: { text: string; say?: boolean }) {
  const { main, detail } = optionParts(text)
  return (
    <span className="opt-label">
      <span className="opt-main">{say ? speech(main) : main}</span>
      {detail && <span className="opt-detail">{detail}</span>}
    </span>
  )
}
