import type { GameState, Player } from '../game/model'
import { persName, t } from '../game/i18n'
import { persKnown } from '../game/scout'

/**
 * ---- HOW THE ROOM FEELS, BEFORE YOU SPEAK TO IT (PRM27) ----
 *
 * The classic manager game puts the whole matchday squad in front of you
 * before the team talk: every name, what kind of person they are and how they
 * feel about the game. The talk used to open straight onto the tones with no
 * idea who was sitting in the room (owner, 26 Sep 2026, with FM26 mobile
 * screenshots: "integrate all the above so it has the depth").
 *
 * The mood is read from what the game already tracks - morale, form and
 * condition - so it is honest: a man who reads "nervous" really is low on
 * morale, and the tone you pick lands on exactly these numbers.
 */
export type Mood = { k: string; tone: 'good' | 'ok' | 'low' }

export function moodOf(p: Player, starting: boolean): Mood {
  if (p.cond < 72) return { k: 'mood.leggy', tone: 'low' }
  if (p.morale >= 8.5) return { k: 'mood.believes', tone: 'good' }
  if (p.morale >= 7.5 && p.form >= 6.5) return { k: 'mood.lookingForward', tone: 'good' }
  if (!starting && p.morale >= 6) return { k: 'mood.happySquad', tone: 'good' }
  if (p.morale >= 6.8) return { k: 'mood.eager', tone: 'good' }
  if (p.morale >= 5.2) return { k: 'mood.balanced', tone: 'ok' }
  if (p.morale >= 3.8) return { k: 'mood.nervous', tone: 'low' }
  return { k: 'mood.lowConfidence', tone: 'low' }
}

export function MoodTable({ game, lineup }: { game: GameState; lineup: (number | null)[] }) {
  const rows = lineup.slice(0, 23)
    .map((id, i) => ({ id, i, p: id != null ? game.players[id] : undefined }))
    .filter((r): r is { id: number; i: number; p: Player } => r.id != null && !!r.p)
  if (!rows.length) return null
  const counts = { good: 0, ok: 0, low: 0 }
  for (const r of rows) counts[moodOf(r.p, r.i < 15).tone]++
  return (
    <div className="mood-wrap">
      <div className="mood-sum">
        {t('mood.summary', { good: counts.good, ok: counts.ok, low: counts.low })}
      </div>
      <div className="tblwrap">
        <table className="dtable mood-table">
          <thead><tr><th>#</th><th>{t('mood.name')}</th><th>{t('mood.personality')}</th><th>{t('mood.mood')}</th></tr></thead>
          <tbody>
            {rows.map(({ id, i, p }) => {
              const m = moodOf(p, i < 15)
              return (
                <tr key={id} className={i >= 15 ? 'bench' : ''}>
                  <td className="num">{i + 1}</td>
                  <td className="nm">{p.name}</td>
                  <td className="muted">{persKnown(game, p) ? persName(p.pers) : '?'}</td>
                  <td><span className={`mood-chip ${m.tone}`}>{t(m.k)}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
