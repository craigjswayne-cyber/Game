import { useState } from 'react'
import { useStore } from '../../store'
import { userFixtureThisWeek } from '../../game/season'
import { teamShort } from '../../game/matchEngine'
import { CrestT, SectionTitle } from '../components'
import { weekDate } from '../../game/model'

const TYPE_ICON: Record<string, string> = {
  result: '🏉', transfer: '💰', injury: '🩹', intl: '🌍', board: '🏛️',
  award: '🏅', contract: '✍️', general: '📰', youth: '🎓',
}

export default function Home() {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const go = useStore(s => s.go)
  const [openId, setOpenId] = useState<number | null>(null)
  const [showTut, setShowTut] = useState(() => {
    try { return localStorage.getItem('rm-tut') !== '1' && game.week === 1 && game.season === 0 } catch { return false }
  })

  const club = game.clubs[game.userClubId]
  const fx = userFixtureThisWeek(game) ?? game.fixtures
    .filter(f => !f.played && f.week >= game.week && (f.homeId === club.id || f.awayId === club.id))
    .sort((a, b) => a.week - b.week)[0]
  const comp = fx ? game.comps[fx.compId] : null
  const isThisWeek = fx && fx.week === game.week
  const pressOpen = game.press.filter(p => !p.answered).length
  const news = [...game.news].reverse()

  if (game.unemployed) {
    return (
      <>
        <button className="card" style={{ display: 'block', width: 'calc(100% - 28px)', textAlign: 'left', borderLeft: '4px solid var(--gold)' }}
          onClick={() => go('jobs')}>
          <h3>📋 The Job Centre</h3>
          <div className="meta">You're between jobs. {game.vacancies.length} vacanc{game.vacancies.length === 1 ? 'y' : 'ies'} open — apply, or press Continue and wait for the right one.</div>
        </button>
        <SectionTitle sub="the rugby world keeps turning">Inbox</SectionTitle>
        {news.slice(0, 60).map(n => (
          <button key={n.id}
            className={`news-item${n.read ? '' : ' unread'}${openId === n.id ? ' open' : ''}`}
            onClick={() => { n.read = true; setOpenId(openId === n.id ? null : n.id); touch() }}>
            <div className="when">{TYPE_ICON[n.type] ?? '📰'} {weekDate(n.season, n.week)}</div>
            <div className="subj">{n.subject}</div>
            <div className="body">{n.body}</div>
          </button>
        ))}
        <div className="spacer" />
      </>
    )
  }

  return (
    <>
      {showTut && (
        <div className="tut-veil" onClick={() => { try { localStorage.setItem('rm-tut', '1') } catch { /* ok */ } setShowTut(false) }}>
          <div className="tut-box">
            <h3>Welcome to the dugout</h3>
            Everything runs off <b>Continue</b> in the top corner — it advances the week, plays your match, and brings the world to your inbox.
            <br /><br />
            Set your XV in <b>Tactics</b> before match day, answer the <b>Press</b> to manage morale, and scout the <b>Transfers</b> market — unscouted players show attribute ranges, not truths.
            <div className="muted">Tap anywhere to close.</div>
          </div>
        </div>
      )}
      {fx && (
        <div className="card" onClick={() => go('tactics')} style={{
          borderLeft: `4px solid ${game.clubs[fx.homeId === club.id ? fx.awayId : fx.homeId]?.colors[0] ?? '#c9a227'}`,
        }}>
          <div className="meta" style={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: 10.5 }}>
            Next match · {comp?.name}{fx.stage ? ` · ${stageName(fx.stage)}` : ''}
          </div>
          <h3 style={{ fontSize: 18, margin: '4px 0' }}>
            <CrestT g={game} teamId={fx.homeId} size={20} />{teamShort(game, fx.homeId)} v <CrestT g={game} teamId={fx.awayId} size={20} />{teamShort(game, fx.awayId)}
          </h3>
          <div className="meta">
            {game.clubs[fx.homeId]?.stadium ?? 'Neutral venue'} · {weekDate(game.season, fx.week)}
            {fx.homeId === club.id ? ' · Home' : ' · Away'}
          </div>
          <div className="muted" style={{ marginTop: 6, fontStyle: 'italic' }}>
            {isThisWeek
              ? 'Tap to set your team, then press Continue to play.'
              : 'No match this week — Continue advances to the next round.'}
          </div>
        </div>
      )}
      {pressOpen > 0 && (
        <button className="card" style={{ display: 'block', width: 'calc(100% - 28px)', textAlign: 'left', borderLeft: '4px solid #c9a227' }}
          onClick={() => go('press')}>
          <h3>🗞️ The press want a word</h3>
          <div className="meta">{pressOpen} question{pressOpen > 1 ? 's' : ''} awaiting your reply — your answers move morale.</div>
        </button>
      )}
      <SectionTitle sub={`board confidence ${Math.round(club.boardConfidence)}%`}>Inbox</SectionTitle>
      {news.length === 0 && <div className="muted" style={{ padding: 14 }}>Nothing yet. Press Continue to get the season moving.</div>}
      {news.slice(0, 60).map(n => (
        <button key={n.id}
          className={`news-item${n.read ? '' : ' unread'}${openId === n.id ? ' open' : ''}`}
          onClick={() => {
            n.read = true
            setOpenId(openId === n.id ? null : n.id)
            touch()
            if (n.playerId && openId === n.id) go('player', n.playerId)
          }}>
          <div className="when">{TYPE_ICON[n.type] ?? '📰'} {weekDate(n.season, n.week)}</div>
          <div className="subj">{n.subject}</div>
          <div className="body">{n.body}</div>
        </button>
      ))}
      <div className="spacer" />
    </>
  )
}

export function stageName(s: string): string {
  return { QF: 'Quarter-Final', SF: 'Semi-Final', F: 'FINAL', BAR: 'Play-off' }[s] ?? s
}
