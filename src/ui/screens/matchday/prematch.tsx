// The pieces both previews share: the team-talk tones and the how-to-watch picker.

import { t } from '../../../game/i18n'
import type { PreTone } from '../../../game/teamtalk'
import { Glyph } from '../../glyphs'

// ------------------------------------------------------------------
// Pre-match
// ------------------------------------------------------------------

// the tables hold KEYS, the tiles call t() - the speech id is what reaches the
// engine and the save, so only the words on the tile change with the language
// Four tones, one emotion each (owner, round 6), and "say nothing" under them:
// settle them, believe in them, demand of them, set them alight.
export const SPEECHES = [
  { id: 'calm', icon: 'calm', name: 'matchday.spCalm', desc: 'matchday.spCalmD' },
  { id: 'faith', icon: 'heart', name: 'matchday.spFaith', desc: 'matchday.spFaithD' },
  { id: 'expect', icon: 'crown', name: 'matchday.spExpect', desc: 'matchday.spExpectD' },
  { id: 'fire', icon: 'derby', name: 'matchday.spFire', desc: 'matchday.spFireD' },
] as const satisfies readonly { id: PreTone; icon: string; name: string; desc: string }[]
export type SpeechId = typeof SPEECHES[number]['id']

/** Three ways to spend a match (F5).
 *
 *  A season is forty-odd fixtures and a phone is not a sofa. Watching every ruck
 *  of a pre-season friendly is not immersion, it is a chore, and the game already
 *  had the two extremes (full commentary, or Instant Result buried under the
 *  team sheet). The middle one is the useful one, and putting all three in a row
 *  makes the choice a decision rather than a button nobody finds. */
const VIEW_MODES = [
  { id: 'full', icon: 'tv', name: 'matchday.vmFull', desc: 'matchday.vmFullD' },
  { id: 'highlights', icon: 'film', name: 'matchday.vmHighlights', desc: 'matchday.vmHighlightsD' },
  { id: 'instant', icon: 'ffwd', name: 'matchday.vmInstant', desc: 'matchday.vmInstantD' },
] as const

/** Chips on one line with a readout underneath, the same shape as the exit
 *  strategy and penalty instruction on the Tactics page.
 *
 *  It started as three explanatory cards, which is clearer in isolation and cost
 *  95px in a modal that already filled a 390px-tall screen: the "say nothing"
 *  button fell off the bottom. One line plus a sentence about the choice you
 *  have actually made says the same thing in half the room. */
export function ViewPicker({ view, onPick }: {
  view: 'full' | 'highlights' | 'instant'
  onPick: (v: 'full' | 'highlights' | 'instant') => void
}) {
  return (
    <>
      <div className="set-label">{t('matchday.howWatch')}</div>
      <div className="preset-row">
        {VIEW_MODES.map(v => (
          <button key={v.id} className={`preset-chip${view === v.id ? ' on' : ''}`} title={t(v.desc)}
            onClick={() => onPick(v.id)}><Glyph name={v.icon} /> {t(v.name)}</button>
        ))}
      </div>
      <div className="meta" style={{ marginTop: 4 }}>
        {t(VIEW_MODES.find(v => v.id === view)?.desc ?? '')}
      </div>
    </>
  )
}
