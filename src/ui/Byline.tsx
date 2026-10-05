import { useState } from 'react'
import { newsByline, type NewsItem } from '../game/model'

/** The source's name over a story, when it has one (1.8.7).
 *
 *  Ruck is the named source for the news about the rest of the league, in the
 *  game's own type: "RUCK.CO.UK" since 1.8.9 (owner: "It should also be
 *  ruck.co.uk as the company name"). Stories about the
 *  manager's own club have no byline and render nothing here, so every list
 *  and reader can drop this in front of the date or the headline and stay
 *  exactly as it was for them. `sep` puts the middle dot after it, for the
 *  date lines: "RUCK.CO.UK · 22 AUG 2026". */
export function Byline({ n, sep }: { n: NewsItem; sep?: boolean }) {
  const by = newsByline(n)
  if (!by) return null
  return <><span className="byline">{by}</span>{sep ? ' · ' : ' '}</>
}

/** The partner's wordmark at the foot of a Ruck story (1.8.9, owner). The file
 *  is a white wordmark on transparent (public/ruck-logo.webp); the day theme
 *  turns it black in theme.css (.ruck-mark). Relative to Vite's base ('./'),
 *  so the same path works on the website and inside the Capacitor shells. If
 *  the file is missing or fails to decode, nothing is drawn: never a broken
 *  image in the game. Renders nothing on a story that is not Ruck's. */
export const RUCK_LOGO = `${import.meta.env.BASE_URL}ruck-logo.webp`
export function RuckMark({ n }: { n: NewsItem }) {
  const [failed, setFailed] = useState(false)
  if (n.src !== 'ruck' || failed) return null
  return (
    <div className="ruck-foot">
      <img className="ruck-mark" src={RUCK_LOGO} alt="ruck.co.uk" height={20} decoding="async" onError={() => setFailed(true)} />
    </div>
  )
}
