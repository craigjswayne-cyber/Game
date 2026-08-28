import { useState } from 'react'
import { useStore } from '../../store'
import { decisionText, mgrReputation, seasonLabel, squadTrust, trustFactor, trustWord, type GameState, type Player } from '../../game/model'
import { standing, standingWord } from '../../game/authority'
import { CHALLENGES } from '../../game/newgame'
import { flagOf, nationName } from '../../game/nations'
import { SectionTitle } from '../components'
import { t } from '../../game/i18n'

/** Coaching badge tiers, earned through reputation. */
export function badgeOf(rep: number): { name: string; icon: string; color: string; next: string | null; at: number | null } {
  if (rep >= 85) return { name: t('profile.badgePlatinum'), icon: '💎', color: 'var(--info)', next: null, at: null }
  if (rep >= 70) return { name: t('profile.badgeGold'), icon: '🥇', color: 'var(--gold)', next: t('profile.nextPlatinum'), at: 85 }
  if (rep >= 55) return { name: t('profile.badgeSilver'), icon: '🥈', color: 'var(--text-secondary)', next: t('profile.nextGold'), at: 70 }
  return { name: t('profile.badgeBronze'), icon: '🥉', color: 'var(--prop-tee-edge)', next: t('profile.nextSilver'), at: 55 }
}

interface Speciality {
  id: string
  name: string
  icon: string
  desc: string
  earned: (g: GameState) => boolean
  hint: string
}

const SPECIALITIES: Speciality[] = [
  {
    id: 'youth', name: 'profile.specYouth', icon: '🌱',
    desc: 'profile.specYouthDesc',
    earned: g => Object.values(g.players).filter(p =>
      p.clubId === g.userClubId && p.youth && (p.stats.apps > 0 || p.career.some(c => c.apps > 0))).length >= 3,
    hint: 'profile.specYouthHint',
  },
  {
    id: 'dealer', name: 'profile.specDealer', icon: '🤝',
    desc: 'profile.specDealerDesc',
    earned: g => g.mgr.signings >= 8,
    hint: 'profile.specDealerHint',
  },
  {
    id: 'tactician', name: 'profile.specTactician', icon: '🧠',
    desc: 'profile.specTacticianDesc',
    earned: g => g.mgr.m >= 20 && g.mgr.w / Math.max(1, g.mgr.m) >= 0.6,
    hint: 'profile.specTacticianHint',
  },
  {
    id: 'winner', name: 'profile.specWinner', icon: '🏆',
    desc: 'profile.specWinnerDesc',
    earned: g => g.mgr.trophies.length >= 2,
    hint: 'profile.specWinnerHint',
  },
  {
    id: 'euro', name: 'profile.specEuro', icon: '👑',
    desc: 'profile.specEuroDesc',
    earned: g => g.mgr.trophies.some(t => t.compId === 'cc'),
    hint: 'profile.specEuroHint',
  },
  {
    id: 'manman', name: 'profile.specManman', icon: '🫂',
    desc: 'profile.specManmanDesc',
    earned: g => {
      const squad = g.clubs[g.userClubId]?.players.map(id => g.players[id]).filter(Boolean) ?? []
      return squad.length > 0 && squad.reduce((s, p) => s + p!.morale, 0) / squad.length >= 7.4
    },
    hint: 'profile.specManmanHint',
  },
  {
    id: 'survivor', name: 'profile.specSurvivor', icon: '🛡️',
    desc: 'profile.specSurvivorDesc',
    earned: g => g.mgr.finishes.length >= 3,
    hint: 'profile.specSurvivorHint',
  },
  {
    id: 'miracle', name: 'profile.specMiracle', icon: '✨',
    desc: 'profile.specMiracleDesc',
    earned: g => g.mgr.trophies.some(t => {
      const club = g.clubs[g.userClubId]
      return club && club.rep < 80 && t.compId === club.leagueId
    }),
    hint: 'profile.specMiracleHint',
  },
]

export default function Profile() {
  const game = useStore(s => s.game)!
  const go = useStore(s => s.go)
  const { resign, answerNatOffer, resignNat } = useStore.getState()
  const [confirmResign, setConfirmResign] = useState(false)
  const [confirmNatResign, setConfirmNatResign] = useState(false)
  const [natAccepting, setNatAccepting] = useState(false)
  const rep = mgrReputation(game)
  const trust = squadTrust(game)
  const badge = badgeOf(rep)
  const club = game.clubs[game.userClubId]
  const m = game.mgr
  const winPct = m.m ? Math.round((m.w / m.m) * 100) : 0

  return (
    <>
      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 44, lineHeight: 1 }}>{badge.icon}</div>
        <h3 style={{ fontSize: 19, marginTop: 6 }}>{game.managerName}</h3>
        <div className="meta">{game.unemployed ? t('profile.unemployed') : t('profile.directorOfRugby', { club: club.name })}</div>
        <div style={{ marginTop: 8, fontFamily: 'var(--cond)', fontWeight: 700, letterSpacing: 1, color: badge.color, textTransform: 'uppercase' }}>
          {badge.name}
        </div>
        <div style={{ margin: '8px 30px 2px' }}>
          {/* from 20, not 30: an unproven manager now starts on 22 and the old
              floor drew him a negative bar */}
          <div style={{ height: 8, background: 'var(--border-strong)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${Math.max(0, Math.min(100, Math.round(((rep - 20) / 75) * 100)))}%`, height: '100%', background: badge.color }} />
          </div>
          <div className="meta" style={{ marginTop: 4 }}>
            {t('profile.reputationLine', { rep, next: badge.next ? t('profile.moreToBadge', { n: badge.at! - rep, badge: badge.next }) : t('profile.theSummit') })}
          </div>
          {/* Trust has to be visible or it is just a hidden coefficient - the
              same mistake the analyst's read made before it paid out. */}
          <div style={{ height: 8, background: 'var(--border-strong)', borderRadius: 4, overflow: 'hidden', marginTop: 8 }}>
            <div style={{ width: `${Math.round(trust)}%`, height: '100%', background: trust >= 68 ? 'var(--text-positive)' : trust >= 40 ? 'var(--gold)' : 'var(--danger)' }} />
          </div>
          <div className="meta" style={{ marginTop: 4 }}>
            {t('profile.dressingRoomLine', { n: Math.round(trust), word: trustWord(trust) })}
          </div>
          <div className="meta" style={{ marginTop: 2, fontSize: 11 }}>
            {t('profile.teamTalkWorth', { pct: Math.round(trustFactor(game) * standing(game).talk * 100) })}
          </div>
          {(() => {
            // THE AUTHORITY LINE (pillar 1): the room compares your name to its
            // own, and the screen says so out loud rather than taxing quietly
            const a = standing(game)
            if (game.unemployed) return null
            return (
              <div className="meta" style={{ marginTop: 6, fontSize: 11, color: a.bite > 0.35 ? 'var(--text-negative)' : undefined }}>
                {t('profile.squadStanding', { profile: a.profile, rep: a.rep, word: standingWord(a) })}
                {a.bite > 0.05 && t('profile.drillLonger', { pct: Math.round((1 - a.familiarity) * 100) })}
              </div>
            )
          })()}
        </div>
      </div>

      {game.natOffer && (
        <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
          <h3 style={{ fontSize: 15 }}>{t('profile.natOffer', { nat: game.natOffer.nat })}</h3>
          <div className="meta">{t('profile.natOfferBody')}</div>
          {/* v1.1.5 (owner): taking the national side asks about the club job
              - keep both, or clear the desk and go all-in on country. An
              unemployed manager has no desk to keep, so the question is
              skipped rather than asked emptily. */}
          {!natAccepting ? (
            <div className="btn-row" style={{ marginTop: 10 }}>
              <button className="btn ghost" onClick={() => answerNatOffer(false)}>{t('profile.decline')}</button>
              <button className="btn gold" style={{ flex: 1.4 }} onClick={() => {
                if (game.unemployed) answerNatOffer(true)
                else setNatAccepting(true)
              }}>{t('profile.acceptJob')}</button>
            </div>
          ) : (
            <>
              <div className="meta" style={{ marginTop: 8, fontWeight: 700 }}>{t('profile.natKeepClubQ', { club: club.short })}</div>
              <div className="btn-row" style={{ marginTop: 8 }}>
                <button className="btn danger" onClick={() => { setNatAccepting(false); answerNatOffer(true, false) }}>
                  {t('profile.natResignClub')}
                </button>
                <button className="btn gold" style={{ flex: 1.3 }} onClick={() => { setNatAccepting(false); answerNatOffer(true, true) }}>
                  {t('profile.natKeepBoth')}
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {game.natTeam && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🌍</span>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 14 }}>{t('profile.natHeadCoach', { nat: game.natTeam })}</h3>
            <div className="meta">
              {t('profile.testWeeksYours')}
              {game.natConfidence != null && (
                <>{t('profile.unionConfidence')}<b>{Math.round(game.natConfidence)}%</b></>
              )}
            </div>
          </div>
          {confirmNatResign
            ? <button className="btn danger" style={{ fontSize: 12 }} onClick={() => { resignNat(); setConfirmNatResign(false) }}>{t('profile.confirm')}</button>
            : <button className="btn ghost" style={{ fontSize: 12, color: 'var(--text-negative)' }} onClick={() => setConfirmNatResign(true)}>{t('profile.stepDown')}</button>}
        </div>
      )}
      {/* the international record outlives the job (user: "your international
          record still stays on your profile") - every tenure, closed or
          current, stays on the CV for good */}
      {((game.natHistory ?? []).length > 0 || (game.natTeam && game.natRecord)) && (
        <div className="card" style={{ borderLeft: '4px solid var(--text-positive)' }}>
          <h3 style={{ fontSize: 15 }}>{t('profile.intlRecord')}</h3>
          {(game.natHistory ?? []).map((ten, i) => (
            <div key={i} className="meta" style={{ padding: '3px 0' }}>
              {flagOf(ten.nat)} <b>{nationName(ten.nat)}</b> · {t(ten.m === 1 ? 'profile.testLineOne' : 'profile.testLine', { m: ten.m, w: ten.w, d: ten.d, l: ten.l })}
            </div>
          ))}
          {game.natTeam && game.natRecord && (
            <div className="meta" style={{ padding: '3px 0' }}>
              {flagOf(game.natTeam)} <b>{nationName(game.natTeam)}</b> · {t(game.natRecord.m === 1 ? 'profile.testLineOne' : 'profile.testLine', { m: game.natRecord.m, w: game.natRecord.w, d: game.natRecord.d, l: game.natRecord.l })} <span className="muted">{t('profile.current')}</span>
            </div>
          )}
        </div>
      )}
      {(game.challengesDone ?? []).length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
          <h3 style={{ fontSize: 15 }}>{t('profile.challengesConquered')}</h3>
          {(game.challengesDone ?? []).map(id => (
            <div key={id} className="meta" style={{ padding: '3px 0', fontWeight: 700 }}>
              {t(CHALLENGES.find(c => c.id === id)?.title ?? id)}
            </div>
          ))}
        </div>
      )}
      {game.challenge && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🎯</span>
          <div>
            <h3 style={{ fontSize: 14 }}>{t(CHALLENGES.find(c => c.id === game.challenge)?.title ?? game.challenge)}</h3>
            <div className="meta">{t('profile.challengeLive')}</div>
          </div>
        </div>
      )}
      <SectionTitle>{t('profile.careerRecord')}</SectionTitle>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 14px' }}>
        <span className="chip">{t('profile.matches')} <b>{m.m}</b></span>
        <span className="chip">{t('profile.won')} <b>{m.w}</b></span>
        <span className="chip">{t('profile.drawn')} <b>{m.d}</b></span>
        <span className="chip">{t('profile.lost')} <b>{m.l}</b></span>
        <span className="chip">{t('profile.winRate')} <b>{winPct}%</b></span>
        {/* Signings is gone at the user's request: it counted a number nothing
            else in the game reads, on the row that is meant to be your record. */}
        {(m.moms ?? 0) > 0 && <span className="chip">{t('profile.managerOfMonth')} <b>×{m.moms}</b></span>}
      </div>
      {!game.unemployed && (
        <div style={{ padding: '8px 14px 0' }}>
          <div className="fact-label">{t('profile.boardConfidence')}</div>
          <div style={{ height: 9, background: 'var(--border-strong)', borderRadius: 5, overflow: 'hidden', marginTop: 4 }}>
            <div style={{
              width: `${club.boardConfidence}%`, height: '100%',
              background: club.boardConfidence > 55 ? 'var(--primary)' : club.boardConfidence > 25 ? 'var(--gold-fill)' : 'var(--danger)',
            }} />
          </div>
        </div>
      )}

      <SectionTitle sub={t('profile.specialitiesSub')}>{t('profile.specialities')}</SectionTitle>
      <div className="spec-grid">
        {SPECIALITIES.map(s => {
          const has = s.earned(game)
          return (
            <div key={s.id} className={`spec-tile${has ? ' on' : ''}`}>
              <span className="ico">{s.icon}</span>
              <b>{t(s.name)}</b>
              <span className="d">{t(has ? s.desc : s.hint)}</span>
            </div>
          )
        })}
      </div>

      {(game.decisions?.length ?? 0) > 0 && <>
        <SectionTitle sub={t('profile.decisionsSub')}>{t('profile.decisions')}</SectionTitle>
        <div className="card" style={{ padding: '6px 10px' }}>
          {game.decisions!.slice(0, 12).map((d, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '3px 0', borderTop: i ? '1px solid var(--border)' : undefined }}>
              <span className="muted" style={{ fontFamily: 'var(--cond)', fontSize: 11, minWidth: 62, flexShrink: 0 }}>
                {seasonLabel(d.season)} w{d.week}
              </span>
              <span style={{ flexShrink: 0, color: d.good === true ? 'var(--text-positive)' : d.good === false ? 'var(--text-negative)' : 'var(--border-strong)', fontWeight: 700 }}>
                {d.good === true ? '▲' : d.good === false ? '▼' : '•'}
              </span>
              <span className="meta" style={{ fontSize: 11.5 }}>{decisionText(d)}</span>
            </div>
          ))}
        </div>
      </>}

      <SectionTitle>{t('profile.trophyCabinet')}</SectionTitle>
      {m.trophies.length === 0
        ? <div className="meta" style={{ padding: '0 16px 8px' }}>{t('profile.bareShelves')}</div>
        : (
          <div className="tblwrap"><table className="dtable"><tbody>
            {m.trophies.map((t, i) => (
              <tr key={i}>
                <td>🏆</td>
                <td className="name">{game.comps[t.compId]?.name ?? t.compId}</td>
                <td className="num">{seasonLabel(t.season)}</td>
              </tr>
            ))}
          </tbody></table></div>
        )}

      <SectionTitle>{t('profile.seasonBySeason')}</SectionTitle>
      {m.finishes.length === 0
        ? <div className="meta" style={{ padding: '0 16px 8px' }}>{t('profile.firstSeason')}</div>
        : (
          <div className="tblwrap"><table className="dtable">
            <thead><tr><th>{t('profile.colSeason')}</th><th>{t('profile.colLeague')}</th><th className="num">{t('profile.colFinish')}</th></tr></thead>
            <tbody>
              {[...m.finishes].reverse().map((f, i) => (
                <tr key={i}>
                  <td>{seasonLabel(f.season)}</td>
                  <td className="name">{game.comps[f.leagueId]?.name ?? f.leagueId}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{f.pos}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}

      <div className="btn-row" style={{ marginTop: 12 }}>
        <button className="btn ghost" onClick={() => go('saves')}>{t('profile.saveLoad')}</button>
        <button className="btn ghost" onClick={() => go('legacy')}>{t('profile.fullLegacy')}</button>
        {!game.unemployed && (
          confirmResign
            ? <button className="btn danger" onClick={() => resign()}>{t('profile.confirmWalkAway')}</button>
            : <button className="btn ghost" style={{ color: 'var(--text-negative)' }} onClick={() => setConfirmResign(true)}>{t('profile.resign')}</button>
        )}
      </div>
      <div className="spacer" />
    </>
  )
}
