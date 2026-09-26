import { useStore } from '../store'
import { fmtMoney, formGuide, seasonLabel, type NewsItem } from '../game/model'
import { leaguePos } from '../game/schedule'
import { ord, posName, t } from '../game/i18n'
import { CrestT, Stars } from './components'
import { moodOf } from './MoodTable'

/**
 * ---- WHAT THE STORY IS ABOUT, BESIDE THE STORY (PRM27) ----
 *
 * The classic manager game reads a message with its subject beside it: the
 * club's crest, where it stands and who it plays next, or the player the story
 * is about. Our readers had the story and a row of name chips, so every "who is
 * this and does it matter?" was a trip to another screen (owner, 26 Sep 2026,
 * with FM26 mobile screenshots). A story about one player gets that player; any
 * other story gets the manager's own club, which is what almost all of them are
 * about.
 */
export function ContextCard({ n }: { n: NewsItem }) {
  const game = useStore(s => s.game)!
  const go = useStore(s => s.go)
  const p = n.playerId != null ? game.players[n.playerId] : undefined
  if (p) {
    const club = p.clubId ? game.clubs[p.clubId] : null
    const mine = p.clubId === game.userClubId
    const mood = moodOf(p, true)
    return (
      <aside className="ctx-card">
        <div className="ctx-head">
          {club ? <CrestT g={game} teamId={club.id} size={34} /> : null}
          <div>
            <b>{p.name}</b>
            <span>{posName(p.pos)} · {t('ctx.age', { n: p.age })}</span>
          </div>
        </div>
        <dl className="ctx-rows">
          <dt>{t('ctx.club')}</dt><dd>{club ? club.short : t('inbox.freeAgent')}</dd>
          {mine && <><dt>{t('ctx.rating')}</dt><dd><Stars ca={p.ca} /></dd></>}
          {mine && <><dt>{t('ctx.mood')}</dt><dd><span className={`mood-chip ${mood.tone}`}>{t(mood.k)}</span></dd></>}
          <dt>{t('ctx.value')}</dt><dd>{fmtMoney(p.value)}</dd>
          <dt>{t('ctx.contract')}</dt><dd>{p.clubId ? t('ctx.until', { season: seasonLabel(p.contractEnds) }) : '-'}</dd>
        </dl>
        <button className="btn ghost block tiny" onClick={() => go('player', p.id)}>{t('ctx.viewPlayer')}</button>
      </aside>
    )
  }
  const club = game.clubs[game.userClubId]
  if (!club) return null
  const pos = leaguePos(game.comps[club.leagueId]?.table, club.id)
  const next = game.fixtures
    .filter(f => !f.played && f.week >= game.week && (f.homeId === club.id || f.awayId === club.id))
    .sort((a, b) => a.week - b.week)[0]
  const oppId = next ? (next.homeId === club.id ? next.awayId : next.homeId) : null
  const opp = oppId ? game.clubs[oppId] : null
  const form = formGuide(game, club.id, 5)
  const favourites = club.players.map(id => game.players[id]).filter(x => x && !x.acad)
    .sort((a, b) => (b.stats.apps + b.stats.tries * 2) - (a.stats.apps + a.stats.tries * 2) || b.ca - a.ca)
    .slice(0, 3)
  return (
    <aside className="ctx-card">
      <div className="ctx-head">
        <CrestT g={game} teamId={club.id} size={34} />
        <div><b>{club.name}</b><span>{club.stadium}</span></div>
      </div>
      <dl className="ctx-rows">
        <dt>{t('ctx.position')}</dt><dd>{pos ? ord(pos) : '-'}</dd>
        <dt>{t('ctx.form')}</dt><dd className="ctx-form">{form.length ? form.map((r, i) => <i key={i} className={r}>{r}</i>) : '-'}</dd>
        <dt>{t('ctx.nextMatch')}</dt><dd>{opp ? `${opp.short} (${next!.homeId === club.id ? t('ctx.home') : t('ctx.away')})` : '-'}</dd>
        <dt>{t('ctx.fanFavourites')}</dt>
        <dd className="ctx-favs">{favourites.map(f => <span key={f.id}>{f.name}</span>)}</dd>
      </dl>
    </aside>
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
