import { useStore } from '../../store'
import { fmtMoney, seasonLabel } from '../../game/model'
import { ordinal } from '../../game/gossip'
import { Crest, SectionTitle } from '../components'

/** The annual: last season on one page - the league, the cups, the
 *  stars, the money and the board's mood. */
export default function SeasonReview() {
  const game = useStore(s => s.game)!
  const { back } = useStore.getState()
  const r = game.review
  if (!r) {
    return (
      <div className="title-screen">
        <div>No season on file yet.</div>
        <button className="btn gold" style={{ marginTop: 16 }} onClick={back}>Back</button>
      </div>
    )
  }
  const club = game.clubs[game.userClubId]
  const headline = r.trophies.length
    ? `🏆 ${r.trophies.join(' · ')}`
    : r.league.pos === 1 ? '🏆 League leaders'
    : r.league.predicted && r.league.pos < r.league.predicted ? '📈 Punched above our weight'
    : r.league.predicted && r.league.pos > r.league.predicted ? '📉 A season below expectations'
    : '📋 A season in the ledger'
  const row = (label: string, value: string, strong = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--hairline)', fontSize: 13 }}>
      <span style={{ color: 'var(--ink-soft)' }}>{label}</span>
      <b style={strong ? { color: 'var(--accent-ink)' } : undefined}>{value}</b>
    </div>
  )
  return (
    <>
      <header className="masthead">
        <div className="masthead-row">
          <button className="back-btn" onClick={back}>‹</button>
          <div style={{ flex: 1 }}>
            <h1>The {seasonLabel(r.season)} Annual</h1>
            <div className="date">{r.clubName} · season review</div>
          </div>
        </div>
      </header>
      <main className="content">
        {/* THE SEASON CARD (C4).
            The review is nine sections long and reads beautifully on the sofa,
            which is not the same thing as being showable. This is the year in one
            screenshot: club, finish, record, the man who scored the most, and the
            trophy if there is one. It exists because the thing a manager actually
            wants to send somebody is a picture, and a nine-section page is not one.
            Deliberately no share button: the browser's own screenshot is a better
            share sheet than anything a PWA can offer, and a button that opens a
            half-working native dialog is worse than no button. */}
        <div className="season-card">
          <div className="sc-top">
            <Crest club={club} size={30} mr={8} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>{r.clubName}</b>
              <div className="sc-sub">{seasonLabel(r.season)}</div>
            </div>
            <div className="sc-pos">
              {r.league.pos > 0 ? ordinal(r.league.pos) : '-'}
              <span>{r.league.pos === 1 ? 'CHAMPIONS' : 'in the league'}</span>
            </div>
          </div>
          <div className="sc-row">
            <span><b>{r.overall.w}</b>W</span>
            <span><b>{r.overall.d}</b>D</span>
            <span><b>{r.overall.l}</b>L</span>
            <span className="sc-pct"><b>{r.overall.m ? Math.round((r.overall.w / r.overall.m) * 100) : 0}%</b> won</span>
          </div>
          {(r.topTries || r.topPoints) && (
            <div className="sc-star">
              {r.topTries ? `🏉 ${r.topTries.name}, ${r.topTries.val} tries` : ''}
              {r.topTries && r.topPoints ? ' · ' : ''}
              {r.topPoints ? `🎯 ${r.topPoints.name}, ${r.topPoints.val} pts` : ''}
            </div>
          )}
          {r.trophies.length > 0 && (
            <div className="sc-cup">🏆 {r.trophies.join(' · ')}</div>
          )}
        </div>

        <div className="card center" style={{ borderLeft: '4px solid var(--stripe)' }}>
          <h3 style={{ fontSize: 18 }}>{headline}</h3>
          <div className="meta">
            {r.overall.w}W {r.overall.d}D {r.overall.l}L from {r.overall.m} matches in all competitions
          </div>
        </div>

        <SectionTitle sub={r.league.name}>The League</SectionTitle>
        <div className="card">
          {row('Finished', r.league.pos > 0 ? ordinal(r.league.pos) : '-', true)}
          {r.league.predicted ? row('Pundits said', ordinal(r.league.predicted)) : null}
          {row('League record', `${r.league.w}W ${r.league.d}D ${r.league.l}L`)}
          {r.overall.bestWin ? row('Best win', r.overall.bestWin) : null}
        </div>

        {r.cups.length > 0 && (
          <>
            <SectionTitle sub="how the knockout roads ended">The Cups</SectionTitle>
            <div className="card">
              {r.cups.map((c, i) => row(c.comp, c.result, c.result.includes('CHAMPIONS')))}
            </div>
          </>
        )}

        <SectionTitle sub="the names of the season">The Stars</SectionTitle>
        <div className="card">
          {r.bestAvg ? row('Player of the season', `${r.bestAvg.name} (avg ${r.bestAvg.val.toFixed(2)})`, true) : null}
          {r.topPoints ? row('Top points', `${r.topPoints.name} - ${r.topPoints.val}`) : null}
          {r.topTries ? row('Top tries', `${r.topTries.name} - ${r.topTries.val}`) : null}
          {r.tryOfSeason ? row('Try of the season', `${r.tryOfSeason.name}, ${r.tryOfSeason.min}' v ${r.tryOfSeason.opp}`) : null}
        </div>

        <SectionTitle sub="the ledger and the boardroom">The Business</SectionTitle>
        <div className="card">
          {row('Season finances', `${r.balanceDelta >= 0 ? '+' : '−'}${fmtMoney(Math.abs(r.balanceDelta))}`, r.balanceDelta >= 0)}
          {row('Board confidence at full-time', `${Math.round(r.confidence)}%`)}
        </div>

        {(game.annals ?? []).length > 1 && (
          <>
            <SectionTitle sub="the career, season by season">The Annals</SectionTitle>
            <div className="tblwrap"><table className="dtable">
              <thead><tr><th>Season</th><th>Club</th><th className="num">Pos</th><th className="num">Record</th><th>Honours</th></tr></thead>
              <tbody>
                {[...(game.annals ?? [])].reverse().map(a => (
                  <tr key={a.season}>
                    <td>{seasonLabel(a.season)}</td>
                    <td>{a.clubName}</td>
                    <td className="num" style={a.league.pos === 1 ? { color: 'var(--accent-ink)', fontWeight: 700 } : undefined}>
                      {a.league.pos > 0 ? ordinal(a.league.pos) : '-'}
                    </td>
                    <td className="num">{a.overall.w}-{a.overall.d}-{a.overall.l}</td>
                    <td>{a.trophies.length ? `🏆 ${a.trophies.length > 1 ? `×${a.trophies.length}` : a.trophies[0]}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </>
        )}

        {(game.potyRoll ?? []).length > 0 && (
          <>
            <SectionTitle sub="World Player of the Year, season by season">Roll of Honour</SectionTitle>
            <div className="tblwrap"><table className="dtable">
              <thead><tr><th>Season</th><th>Winner</th><th>Club</th></tr></thead>
              <tbody>
                {[...(game.potyRoll ?? [])].reverse().map(w => {
                  const mine = game.players[w.playerId]?.clubId === game.userClubId
                  return (
                    <tr key={w.season}>
                      <td>{seasonLabel(w.season)}</td>
                      <td style={mine ? { color: 'var(--accent-ink)', fontWeight: 700 } : undefined}>🏅 {w.name}</td>
                      <td>{w.clubName}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table></div>
          </>
        )}

        <button className="btn gold block" style={{ marginTop: 12, fontSize: 15 }} onClick={back}>
          File it away ▸
        </button>
        <div className="spacer" />
      </main>
    </>
  )
}
