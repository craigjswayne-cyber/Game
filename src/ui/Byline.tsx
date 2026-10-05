import { newsByline, type NewsItem } from '../game/model'

/** The source's name over a story, when it has one (1.8.7).
 *
 *  Ruck is the named source for the news about the rest of the league (owner:
 *  text only, "RUCK", in the game's own type, no logo). Stories about the
 *  manager's own club have no byline and render nothing here, so every list
 *  and reader can drop this in front of the date or the headline and stay
 *  exactly as it was for them. `sep` puts the middle dot after it, for the
 *  date lines: "RUCK · 22 AUG 2026". */
export function Byline({ n, sep }: { n: NewsItem; sep?: boolean }) {
  const by = newsByline(n)
  if (!by) return null
  return <><span className="byline">{by}</span>{sep ? ' · ' : ' '}</>
}
