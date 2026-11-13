// A man's attributes as the club reads them: a figure where the file is exact,
// a dashed range where it is not, and beside it (when asked) the same figure
// for one of ours. One component, so the player page and the scout sheet can
// never show two different readings of the same man (1.9.12: the sheet had no
// attributes at all, and a tester went through "Make an offer" to find them).
import { ATTR_KEYS, type Attrs, type GameState, type Player } from '../game/model'
import { fineAttr } from '../game/attributes'
import { attrRange } from '../game/scout'
import { attrBand, attrBandIndex, attrName, t } from '../game/i18n'

export const ATTR_GROUPS: [string, (keyof Attrs)[]][] = [
  ['player.grpSetPiece', ['scr', 'lin', 'ruc', 'tac', 'str']],
  ['player.grpSkills', ['han', 'pas', 'kic', 'goa']],
  ['player.grpPhysical', ['pac', 'agi', 'sta']],
  ['player.grpMental', ['vis', 'dec', 'pos', 'wor', 'agg', 'lea']],
]

/** Your best man in the same shirt, for the comparison; null when he is yours. */
export function bestInShirt(game: GameState, p: Player): Player | null {
  if (p.clubId === game.userClubId) return null
  return game.clubs[game.userClubId]?.players
    .map(id => game.players[id])
    .filter((q): q is Player => !!q && !q.acad && (q.pos === p.pos || q.alt.includes(p.pos)))
    .sort((a, b) => b.ca - a.ca)[0] ?? null
}

export default function AttrGrid({ game, p, rival }: { game: GameState; p: Player; rival?: Player | null }) {
  return (
    <div className="fm-attrs">
      {ATTR_GROUPS.map(([title, keys]) => (
        <div className="fm-col" key={title}>
          <div className="fm-col-head">{t(title)}</div>
          {keys.map(k => {
            const [lo, hi] = attrRange(game, p, k)
            const exact = lo === hi
            const mid = Math.round((lo + hi) / 2)
            const idx = ATTR_KEYS.indexOf(k)
            // see fineAttr for why the fifth is real rather than decoration
            const v = fineAttr(p.id, idx, mid)
            const rv = rival ? fineAttr(rival.id, idx, rival.a[k]) : null
            return (
              <div className="fm-attr" key={k}>
                <span className="fm-name">{attrName(k)}</span>
                {/* THE WORD, not only the figure (owner, v1.7.0). A page of
                    bare numbers only reads to somebody who already knows
                    what the scale is. Hidden while a man is unscouted,
                    because a range has no single word for it - the dashed
                    chip is already saying "we do not know yet". */}
                {exact && <span className={`fm-word b${attrBandIndex(v)}`}>{attrBand(v)}</span>}
                {rv != null && (
                  <b className="fm-rival" style={{ color: v > rv ? 'var(--text-positive)' : v < rv ? 'var(--text-negative)' : 'var(--text-muted)' }}>{rv}</b>
                )}
                <b className={`fm-chip ${exact ? (v >= 80 ? 'hi' : v >= 55 ? 'mid' : 'lo') : 'rng'}`}>
                  {exact ? v : `${fineAttr(p.id, idx, lo)}-${fineAttr(p.id, idx, hi)}`}
                </b>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
