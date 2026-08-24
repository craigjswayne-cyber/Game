import { useStore } from '../../store'
import { fmtMoney, seasonLabel } from '../../game/model'
import { Crest, SectionTitle } from '../components'
import { ord, t } from '../../game/i18n'

/** The annual: last season on one page - the league, the cups, the
 *  stars, the money and the board's mood. */
export default function SeasonReview() {
  const game = useStore(s => s.game)!
  const { back } = useStore.getState()
  const r = game.review
  if (!r) {
    return (
      <div className="title-screen">
        <div>{t('legacy.srNoSeason')}</div>
        <button className="btn gold" style={{ marginTop: 16 }} onClick={back}>{t('legacy.srBack')}</button>
      </div>
    )
  }
  const club = game.clubs[game.userClubId]
  const headline = r.trophies.length
    ? t('legacy.srHeadTrophies', { list: r.trophies.join(' · ') })
    : r.league.pos === 1 ? t('legacy.srHeadLeaders')
    : r.league.predicted && r.league.pos < r.league.predicted ? t('legacy.srHeadAbove')
    : r.league.predicted && r.league.pos > r.league.predicted ? t('legacy.srHeadBelow')
    : t('legacy.srHeadLedger')
  const row = (label: string, value: string, strong = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <b style={strong ? { color: 'var(--info)' } : undefined}>{value}</b>
    </div>
  )
  return (
    <>
      <header className="masthead">
        <div className="masthead-row">
          <button className="back-btn" onClick={back}>‹</button>
          <div style={{ flex: 1 }}>
            <h1>{t('legacy.srTitle', { label: seasonLabel(r.season) })}</h1>
            <div className="date">{t('legacy.srSub', { club: r.clubName })}</div>
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
              {r.league.pos > 0 ? ord(r.league.pos) : '-'}
              <span>{t(r.league.pos === 1 ? 'legacy.srChampions' : 'legacy.srInLeague')}</span>
            </div>
          </div>
          <div className="sc-row">
            <span><b>{r.overall.w}</b>{t('common.w')}</span>
            <span><b>{r.overall.d}</b>{t('common.d')}</span>
            <span><b>{r.overall.l}</b>{t('common.l')}</span>
            <span className="sc-pct"><b>{r.overall.m ? Math.round((r.overall.w / r.overall.m) * 100) : 0}%</b>{t('legacy.srWon')}</span>
          </div>
          {(r.topTries || r.topPoints) && (
            <div className="sc-star">
              {r.topTries ? t('legacy.srTries', { name: r.topTries.name, n: r.topTries.val }) : ''}
              {r.topTries && r.topPoints ? ' · ' : ''}
              {r.topPoints ? t('legacy.srPoints', { name: r.topPoints.name, n: r.topPoints.val }) : ''}
            </div>
          )}
          {r.trophies.length > 0 && (
            <div className="sc-cup">🏆 {r.trophies.join(' · ')}</div>
          )}
        </div>

        <div className="card center" style={{ borderLeft: '4px solid var(--gold)' }}>
          <h3 style={{ fontSize: 18 }}>{headline}</h3>
          <div className="meta">
            {t('legacy.srRecordLine', { w: r.overall.w, d: r.overall.d, l: r.overall.l, m: r.overall.m })}
          </div>
        </div>

        {r.dream && (
          <>
            <SectionTitle sub={t('legacy.srDreamSub')}>{t('legacy.lgTheDream')}</SectionTitle>
            <div className="card" style={{ borderLeft: `4px solid ${r.dream.done ? 'var(--primary)' : 'var(--gold)'}` }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{r.dream.titleK ? t(r.dream.titleK, r.dream.titleV) : r.dream.title}</div>
              <div style={{ height: 7, background: 'var(--border-strong)', borderRadius: 4, overflow: 'hidden', margin: '8px 0 5px' }}>
                <div style={{ width: `${Math.min(100, Math.round((r.dream.at / Math.max(1, r.dream.goal)) * 100))}%`, height: '100%', background: r.dream.done ? 'var(--primary)' : 'var(--gold-fill)' }} />
              </div>
              <div className="meta">
                {/* The keys when the review has them, the English it was written
                    in when it does not: a review kept from an older build is
                    still a review, and a key that is not there renders its own
                    name, which is the ugliest failure on the screen. */}
                {(() => {
                  const note = r.dream.noteK ? t(r.dream.noteK, r.dream.noteV) : r.dream.note
                  return r.dream.done ? t('legacy.srDreamDone')
                    : r.dream.moved != null && r.dream.moved > 0 ? t('legacy.srDreamCloser', { note })
                    : r.dream.moved != null ? t('legacy.srDreamNoCloser', { note })
                    : note
                })()}
              </div>
            </div>
          </>
        )}

        <SectionTitle sub={r.league.name}>{t('legacy.srTheLeague')}</SectionTitle>
        <div className="card">
          {row(t('legacy.srFinished'), r.league.pos > 0 ? ord(r.league.pos) : '-', true)}
          {r.league.predicted ? row(t('legacy.srPunditsSaid'), ord(r.league.predicted)) : null}
          {row(t('legacy.srLeagueRecord'), t('legacy.srRecordVal', { w: r.league.w, d: r.league.d, l: r.league.l }))}
          {r.overall.bestWin ? row(t('legacy.srBestWin'), r.overall.bestWin) : null}
        </div>

        {r.cups.length > 0 && (
          <>
            <SectionTitle sub={t('legacy.srCupsSub')}>{t('legacy.srTheCups')}</SectionTitle>
            <div className="card">
              {r.cups.map((c, i) => row(c.comp, c.result, c.result.includes('CHAMPIONS')))}
            </div>
          </>
        )}

        <SectionTitle sub={t('legacy.srStarsSub')}>{t('legacy.srTheStars')}</SectionTitle>
        <div className="card">
          {r.bestAvg ? row(t('legacy.srPotY'), t('legacy.srPotYVal', { name: r.bestAvg.name, avg: r.bestAvg.val.toFixed(2) }), true) : null}
          {r.topPoints ? row(t('legacy.srTopPoints'), t('legacy.srNameVal', { name: r.topPoints.name, n: r.topPoints.val })) : null}
          {r.topTries ? row(t('legacy.srTopTries'), t('legacy.srNameVal', { name: r.topTries.name, n: r.topTries.val })) : null}
          {r.tryOfSeason ? row(t('legacy.srTryOfSeason'), t('legacy.srTryVal', { name: r.tryOfSeason.name, min: r.tryOfSeason.min, opp: r.tryOfSeason.opp })) : null}
        </div>

        <SectionTitle sub={t('legacy.srBusinessSub')}>{t('legacy.srTheBusiness')}</SectionTitle>
        <div className="card">
          {row(t('legacy.srSeasonFinances'), `${r.balanceDelta >= 0 ? '+' : '−'}${fmtMoney(Math.abs(r.balanceDelta))}`, r.balanceDelta >= 0)}
          {row(t('legacy.srBoardAtFullTime'), `${Math.round(r.confidence)}%`)}
        </div>

        {(game.annals ?? []).length > 1 && (
          <>
            <SectionTitle sub={t('legacy.srAnnalsSub')}>{t('legacy.srTheAnnals')}</SectionTitle>
            <div className="tblwrap"><table className="dtable">
              <thead><tr><th>{t('profile.colSeason')}</th><th>{t('player.colClub')}</th><th className="num">{t('legacy.srColPos')}</th><th className="num">{t('legacy.srColRecord')}</th><th>{t('legacy.srColHonours')}</th></tr></thead>
              <tbody>
                {[...(game.annals ?? [])].reverse().map(a => (
                  <tr key={a.season}>
                    <td>{seasonLabel(a.season)}</td>
                    <td>{a.clubName}</td>
                    <td className="num" style={a.league.pos === 1 ? { color: 'var(--info)', fontWeight: 700 } : undefined}>
                      {a.league.pos > 0 ? ord(a.league.pos) : '-'}
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
            <SectionTitle sub={t('legacy.srRollSub')}>{t('legacy.srRollTitle')}</SectionTitle>
            <div className="tblwrap"><table className="dtable">
              <thead><tr><th>{t('profile.colSeason')}</th><th>{t('legacy.srColWinner')}</th><th>{t('player.colClub')}</th></tr></thead>
              <tbody>
                {[...(game.potyRoll ?? [])].reverse().map(w => {
                  const mine = game.players[w.playerId]?.clubId === game.userClubId
                  return (
                    <tr key={w.season}>
                      <td>{seasonLabel(w.season)}</td>
                      <td style={mine ? { color: 'var(--info)', fontWeight: 700 } : undefined}>🏅 {w.name}</td>
                      <td>{w.clubName}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table></div>
          </>
        )}

        <button className="btn gold block" style={{ marginTop: 12, fontSize: 15 }} onClick={back}>
          {t('legacy.srFileAway')}
        </button>
        <div className="spacer" />
      </main>
    </>
  )
}
