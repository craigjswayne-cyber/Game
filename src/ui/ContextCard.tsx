import { useStore } from '../store'
import type { NewsItem } from '../game/model'
import { posName, t } from '../game/i18n'
import { CrestT } from './components'

/**
 * ---- WHAT THE STORY IS ABOUT, BESIDE THE STORY (1.8.0) ----
 *
 * The classic manager game reads a message with its subject beside it: the
 * club's crest, where it stands and who it plays next, or the player the story
 * is about. Our readers had the story and a row of name chips, so every "who is
 * this and does it matter?" was a trip to another screen (owner, 26 Sep 2026,
 * with FM26 mobile screenshots). A story about one player gets that player; any
 * other story gets the manager's own club, which is what almost all of them are
 * about.
 *
 * Owner, 27 Sep 2026: the cards "make the game feel a bit cluttered. Leave the
 * name where players can click through but remove the bottom section". So it
 * is one line now: crest, name, a word of who they are, and a tap through.
 */
export function ContextCard({ n }: { n: NewsItem }) {
  const game = useStore(s => s.game)!
  const go = useStore(s => s.go)
  const p = n.playerId != null ? game.players[n.playerId] : undefined
  if (p) {
    const club = p.clubId ? game.clubs[p.clubId] : null
    return (
      <button className="ctx-card ctx-link" onClick={() => go('player', p.id)}>
        {club ? <CrestT g={game} teamId={club.id} size={28} /> : null}
        <span className="ctx-name">
          <b>{p.name}</b>
          <span>{posName(p.pos)} · {club ? club.short : t('inbox.freeAgent')}</span>
        </span>
        <span className="ctx-go" aria-hidden>›</span>
      </button>
    )
  }
  const club = game.clubs[game.userClubId]
  if (!club) return null
  return (
    <button className="ctx-card ctx-link" onClick={() => go('club', club.id)}>
      <CrestT g={game} teamId={club.id} size={28} />
      <span className="ctx-name"><b>{club.name}</b><span>{club.stadium}</span></span>
      <span className="ctx-go" aria-hidden>›</span>
    </button>
  )
}

/** Press questions waiting on the manager: the classic "response needed". */
export function ResponseNeeded() {
  const game = useStore(s => s.game)!
  const go = useStore(s => s.go)
  const waiting = game.press.filter(q => !q.answered).length
  if (!waiting) return null
  return (
    <button className="btn gold tiny resp-needed" onClick={() => go('press')}>
      {t('ctx.responseNeeded', { n: waiting })}
    </button>
  )
}
