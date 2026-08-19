import { useState } from 'react'
import { useStore } from '../../store'
import { mgrReputation, seasonLabel, squadTrust, trustFactor, trustWord, type GameState, type Player } from '../../game/model'
import { CHALLENGES } from '../../game/newgame'
import { flagOf, nationByCode } from '../../game/nations'
import { SectionTitle } from '../components'

/** Coaching badge tiers, earned through reputation. */
export function badgeOf(rep: number): { name: string; icon: string; color: string; next: string | null; at: number | null } {
  if (rep >= 85) return { name: 'Platinum Badge', icon: '💎', color: '#7fb4c9', next: null, at: null }
  if (rep >= 70) return { name: 'Gold Badge', icon: '🥇', color: '#c9a227', next: 'Platinum', at: 85 }
  if (rep >= 55) return { name: 'Silver Badge', icon: '🥈', color: '#9aa5ad', next: 'Gold', at: 70 }
  return { name: 'Bronze Badge', icon: '🥉', color: '#a8763a', next: 'Silver', at: 55 }
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
    id: 'youth', name: 'Youth Developer', icon: '🌱',
    desc: 'Trusts the academy and makes kids into men.',
    earned: g => Object.values(g.players).filter(p =>
      p.clubId === g.userClubId && p.youth && (p.stats.apps > 0 || p.career.some(c => c.apps > 0))).length >= 3,
    hint: 'Give 3+ academy graduates real minutes.',
  },
  {
    id: 'dealer', name: 'Wheeler-Dealer', icon: '🤝',
    desc: 'Lives on the phone. The market bends to him.',
    earned: g => g.mgr.signings >= 8,
    hint: 'Complete 8 signings.',
  },
  {
    id: 'tactician', name: 'Tactician', icon: '🧠',
    desc: 'Wins the chess match more often than not.',
    earned: g => g.mgr.m >= 20 && g.mgr.w / Math.max(1, g.mgr.m) >= 0.6,
    hint: 'Keep a 60% win rate over 20+ matches.',
  },
  {
    id: 'winner', name: 'Serial Winner', icon: '🏆',
    desc: 'Silverware follows him around.',
    earned: g => g.mgr.trophies.length >= 2,
    hint: 'Lift 2 trophies.',
  },
  {
    id: 'euro', name: 'Continental Royalty', icon: '👑',
    desc: 'Conquered Europe\'s biggest prize.',
    earned: g => g.mgr.trophies.some(t => t.compId === 'cc'),
    hint: 'Win the Champions Cup.',
  },
  {
    id: 'manman', name: 'Man-Manager', icon: '🫂',
    desc: 'Players run through walls for him.',
    earned: g => {
      const squad = g.clubs[g.userClubId]?.players.map(id => g.players[id]).filter(Boolean) ?? []
      return squad.length > 0 && squad.reduce((s, p) => s + p!.morale, 0) / squad.length >= 7.4
    },
    hint: 'Keep average squad morale above 7.4.',
  },
  {
    id: 'survivor', name: 'The Survivor', icon: '🛡️',
    desc: 'Boards come and go; he remains.',
    earned: g => g.mgr.finishes.length >= 3,
    hint: 'Complete 3 full seasons.',
  },
  {
    id: 'miracle', name: 'Miracle Worker', icon: '✨',
    desc: 'Won it all with a club nobody backed.',
    earned: g => g.mgr.trophies.some(t => {
      const club = g.clubs[g.userClubId]
      return club && club.rep < 80 && t.compId === club.leagueId
    }),
    hint: 'Win a league title with an unfancied club.',
  },
]

export default function Profile() {
  const game = useStore(s => s.game)!
  const go = useStore(s => s.go)
  const { resign, answerNatOffer, resignNat } = useStore.getState()
  const [confirmResign, setConfirmResign] = useState(false)
  const [confirmNatResign, setConfirmNatResign] = useState(false)
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
        <div className="meta">{game.unemployed ? 'Unemployed - between challenges' : `Director of Rugby · ${club.name}`}</div>
        <div style={{ marginTop: 8, fontFamily: 'var(--cond)', fontWeight: 700, letterSpacing: 1, color: badge.color, textTransform: 'uppercase' }}>
          {badge.name}
        </div>
        <div style={{ margin: '8px 30px 2px' }}>
          {/* from 20, not 30: an unproven manager now starts on 22 and the old
              floor drew him a negative bar */}
          <div style={{ height: 8, background: 'var(--cream-3)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${Math.max(0, Math.min(100, Math.round(((rep - 20) / 75) * 100)))}%`, height: '100%', background: badge.color }} />
          </div>
          <div className="meta" style={{ marginTop: 4 }}>
            Reputation {rep}{badge.next ? ` · ${badge.at! - rep} more to the ${badge.next} badge` : ' · the summit'}
          </div>
          {/* Trust has to be visible or it is just a hidden coefficient - the
              same mistake the analyst's read made before it paid out. */}
          <div style={{ height: 8, background: 'var(--cream-3)', borderRadius: 4, overflow: 'hidden', marginTop: 8 }}>
            <div style={{ width: `${Math.round(trust)}%`, height: '100%', background: trust >= 68 ? '#2f7d4f' : trust >= 40 ? 'var(--gold)' : '#a12f2f' }} />
          </div>
          <div className="meta" style={{ marginTop: 4 }}>
            Dressing room {Math.round(trust)}/100 · {trustWord(trust)}
          </div>
          <div className="meta" style={{ marginTop: 2, fontSize: 11 }}>
            A team talk is worth {Math.round(trustFactor(game) * 100)}% of its full effect while they feel like this.
            Win and it climbs; lose and it slides.
          </div>
        </div>
      </div>

      {game.natOffer && (
        <div className="card" style={{ borderLeft: '4px solid var(--stripe)' }}>
          <h3 style={{ fontSize: 15 }}>🌍 {game.natOffer.nat} want you as national head coach</h3>
          <div className="meta">
            Coach the national side alongside your club. In Test windows you take charge on match day when your
            club is free - and every championship they win goes in your trophy cabinet.
          </div>
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn ghost" onClick={() => answerNatOffer(false)}>Decline</button>
            <button className="btn gold" style={{ flex: 1.4 }} onClick={() => answerNatOffer(true)}>Accept the Job</button>
          </div>
        </div>
      )}
      {game.natTeam && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🌍</span>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 14 }}>National head coach: {game.natTeam}</h3>
            <div className="meta">
              Test weeks are yours when the club calendar allows.
              {game.natConfidence != null && (
                <> Union confidence: <b style={{ color: game.natConfidence >= 60 ? '#2f7d4f' : game.natConfidence >= 40 ? 'var(--ink-soft)' : '#9b2c2c' }}>{Math.round(game.natConfidence)}%</b></>
              )}
            </div>
          </div>
          {confirmNatResign
            ? <button className="btn danger" style={{ fontSize: 12 }} onClick={() => { resignNat(); setConfirmNatResign(false) }}>Confirm</button>
            : <button className="btn ghost" style={{ fontSize: 12, color: '#9b2c2c' }} onClick={() => setConfirmNatResign(true)}>Step down…</button>}
        </div>
      )}
      {/* the international record outlives the job (user: "your international
          record still stays on your profile") - every tenure, closed or
          current, stays on the CV for good */}
      {((game.natHistory ?? []).length > 0 || (game.natTeam && game.natRecord)) && (
        <div className="card" style={{ borderLeft: '4px solid #2f7d4f' }}>
          <h3 style={{ fontSize: 15 }}>🌍 International Record</h3>
          {(game.natHistory ?? []).map((t, i) => (
            <div key={i} className="meta" style={{ padding: '3px 0' }}>
              {flagOf(t.nat)} <b>{nationByCode(t.nat)?.name ?? t.nat}</b> · {t.m} Test{t.m === 1 ? '' : 's'} · {t.w}W {t.d}D {t.l}L
            </div>
          ))}
          {game.natTeam && game.natRecord && (
            <div className="meta" style={{ padding: '3px 0' }}>
              {flagOf(game.natTeam)} <b>{nationByCode(game.natTeam)?.name ?? game.natTeam}</b> · {game.natRecord.m} Test{game.natRecord.m === 1 ? '' : 's'} · {game.natRecord.w}W {game.natRecord.d}D {game.natRecord.l}L <span className="muted">(current)</span>
            </div>
          )}
        </div>
      )}
      {(game.challengesDone ?? []).length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid var(--stripe)' }}>
          <h3 style={{ fontSize: 15 }}>🏅 Challenges Conquered</h3>
          {(game.challengesDone ?? []).map(id => (
            <div key={id} className="meta" style={{ padding: '3px 0', fontWeight: 700 }}>
              {CHALLENGES.find(c => c.id === id)?.title ?? id}
            </div>
          ))}
        </div>
      )}
      {game.challenge && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🎯</span>
          <div>
            <h3 style={{ fontSize: 14 }}>{CHALLENGES.find(c => c.id === game.challenge)?.title ?? game.challenge}</h3>
            <div className="meta">The challenge is live. Judged at each season's end.</div>
          </div>
        </div>
      )}
      <SectionTitle>Career Record</SectionTitle>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 14px' }}>
        <span className="chip">Matches <b>{m.m}</b></span>
        <span className="chip">Won <b>{m.w}</b></span>
        <span className="chip">Drawn <b>{m.d}</b></span>
        <span className="chip">Lost <b>{m.l}</b></span>
        <span className="chip">Win rate <b>{winPct}%</b></span>
        {/* Signings is gone at the user's request: it counted a number nothing
            else in the game reads, on the row that is meant to be your record. */}
        {(m.moms ?? 0) > 0 && <span className="chip">🥇 Manager of the Month <b>×{m.moms}</b></span>}
      </div>
      {!game.unemployed && (
        <div style={{ padding: '8px 14px 0' }}>
          <div className="fact-label">Board Confidence</div>
          <div style={{ height: 9, background: 'var(--cream-3)', borderRadius: 5, overflow: 'hidden', marginTop: 4 }}>
            <div style={{
              width: `${club.boardConfidence}%`, height: '100%',
              background: club.boardConfidence > 55 ? '#2f7d4f' : club.boardConfidence > 25 ? '#c9a227' : '#9b2c2c',
            }} />
          </div>
        </div>
      )}

      <SectionTitle sub="earned through deeds, not words">Coaching Specialities</SectionTitle>
      <div className="spec-grid">
        {SPECIALITIES.map(s => {
          const has = s.earned(game)
          return (
            <div key={s.id} className={`spec-tile${has ? ' on' : ''}`}>
              <span className="ico">{s.icon}</span>
              <b>{s.name}</b>
              <span className="d">{has ? s.desc : s.hint}</span>
            </div>
          )
        })}
      </div>

      {(game.decisions?.length ?? 0) > 0 && <>
        <SectionTitle sub="what you chose, and what it did">Decisions</SectionTitle>
        <div className="card" style={{ padding: '6px 10px' }}>
          {game.decisions!.slice(0, 12).map((d, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '3px 0', borderTop: i ? '1px solid var(--hairline)' : undefined }}>
              <span className="muted" style={{ fontFamily: 'var(--cond)', fontSize: 11, minWidth: 62, flexShrink: 0 }}>
                {seasonLabel(d.season)} w{d.week}
              </span>
              <span style={{ flexShrink: 0, color: d.good === true ? '#2f7d4f' : d.good === false ? '#9b2c2c' : '#8a7a3a', fontWeight: 700 }}>
                {d.good === true ? '▲' : d.good === false ? '▼' : '•'}
              </span>
              <span className="meta" style={{ fontSize: 11.5 }}>{d.text}</span>
            </div>
          ))}
        </div>
      </>}

      <SectionTitle>Trophy Cabinet</SectionTitle>
      {m.trophies.length === 0
        ? <div className="meta" style={{ padding: '0 16px 8px' }}>Bare shelves - for now. Go and fill them.</div>
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

      <SectionTitle>Season by Season</SectionTitle>
      {m.finishes.length === 0
        ? <div className="meta" style={{ padding: '0 16px 8px' }}>Your first season is still being written.</div>
        : (
          <div className="tblwrap"><table className="dtable">
            <thead><tr><th>Season</th><th>League</th><th className="num">Finish</th></tr></thead>
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
        <button className="btn ghost" onClick={() => go('saves')}>💾 Save / Load</button>
        <button className="btn ghost" onClick={() => go('legacy')}>📜 Full Legacy</button>
        {!game.unemployed && (
          confirmResign
            ? <button className="btn danger" onClick={() => resign()}>Confirm - Walk Away</button>
            : <button className="btn ghost" style={{ color: '#9b2c2c' }} onClick={() => setConfirmResign(true)}>Resign…</button>
        )}
      </div>
      <div className="spacer" />
    </>
  )
}
