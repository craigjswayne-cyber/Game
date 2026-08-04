import { useMemo, useState } from 'react'
import { useStore } from '../../store'
import { CHALLENGES, LEAGUE_DEFS } from '../../game/newgame'
import { COACHING_STYLES } from '../../game/tactics'
import type { RawClub } from '../../data/types'
import { Crest, Jersey } from '../components'
import { playerValue } from '../../game/attributes'
import { fmtMoney } from '../../game/model'

// FM Mobile-style guided setup: STEP x OF 4, breadcrumbs, tile grids,
// a club detail panel, and a persistent bottom action bar.

const STEPS = ['Competition', 'Club', 'Manager', 'Summary']

const finances = (budget: number) =>
  budget >= 4_000_000 ? ['Rich', '#2f7d4f']
    : budget >= 2_000_000 ? ['Secure', '#6f8f4f']
    : budget >= 1_000_000 ? ['Okay', '#8a7a3a']
    : ['Tight', '#a12f2f']

const mediaLabel = (rep: number) =>
  rep >= 87 ? 'Title favourites' : rep >= 80 ? 'Playoff contenders'
    : rep >= 72 ? 'Dark horses' : rep >= 66 ? 'Mid-table battlers' : 'Relegation-zone rated'

export default function NewGame() {
  const start = useStore(s => s.start)
  const back = useStore(s => s.back)
  const defs = useMemo(() => LEAGUE_DEFS(), [])
  const [step, setStep] = useState(0)
  const [leagueIdx, setLeagueIdx] = useState<number | null>(null)
  const [clubId, setClubId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [styleId, setStyleId] = useState('balanced')
  const [challengeId, setChallengeId] = useState<string | null>(null)

  const league = leagueIdx != null ? defs[leagueIdx] : null
  const club: RawClub | null = clubId
    ? defs.flatMap(d => d.clubs).find(c => c.id === clubId) ?? null
    : null
  const challenge = challengeId ? CHALLENGES.find(c => c.id === challengeId) : null

  const pickChallenge = (id: string) => {
    const ch = CHALLENGES.find(c => c.id === id)!
    const li = defs.findIndex(d => d.clubs.some(c => c.id === ch.clubId))
    setChallengeId(id)
    setLeagueIdx(li)
    setClubId(ch.clubId)
    setStep(2)
  }

  const canNext = step === 0 ? leagueIdx != null : step === 1 ? clubId != null : step === 2 ? name.trim().length > 0 : true

  const next = () => {
    if (step < 3) { setStep(step + 1); return }
    if (!club) return
    start(club.id, name.trim(), challengeId ?? undefined)
    // coaching philosophy shapes your starting game plan
    const g = useStore.getState().game
    const chosen = COACHING_STYLES.find(s => s.id === styleId)
    if (g && chosen) {
      Object.assign(g.clubs[g.userClubId].tactic, chosen.tactic)
    }
  }
  const prev = () => {
    if (step === 0) { back(); return }
    if (challengeId && step === 2) { setChallengeId(null); setClubId(null); setLeagueIdx(null); setStep(0); return }
    setStep(step - 1)
  }

  const starPlayer = club ? [...club.players].sort((a, b) => b.q - a.q)[0] : null

  return (
    <>
      <header className="masthead">
        <div className="masthead-row">
          <button className="back-btn" onClick={prev}>‹</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1>New Career</h1>
            <div className="date">Step {step + 1} of 4 · {STEPS[step]}</div>
          </div>
          <div className="step-meter"><i style={{ width: `${((step + 1) / 4) * 100}%` }} /></div>
        </div>
        <div className="crumbs">
          {STEPS.map((s, i) => (
            <span key={s} className={`crumb${i === step ? ' on' : i < step ? ' done' : ''}`}
              onClick={() => i < step && setStep(i)}>
              {i === 0 && league ? league.short : i === 1 && club ? club.short : s}
            </span>
          ))}
        </div>
      </header>

      <main className="content" style={{ paddingBottom: 96 }}>
        {step === 0 && (
          <>
            <div className="wizard-hint">Choose the competition you'll manage in.</div>
            <div className="tile-grid">
              {defs.map((d, i) => (
                <button key={d.id} className={`tile${leagueIdx === i ? ' sel' : ''}`}
                  onClick={() => { setLeagueIdx(i); setClubId(null); setStep(1) }}>
                  <span className="tile-ico">🏆</span>
                  <b>{d.name}</b>
                  <span className="muted">{d.clubs.length} clubs</span>
                </button>
              ))}
            </div>
            <div className="wizard-hint" style={{ marginTop: 14 }}>…or take on a Challenge.</div>
            {CHALLENGES.map(ch => {
              const chClub = defs.flatMap(d => d.clubs).find(c => c.id === ch.clubId)
              return (
                <button key={ch.id} className="card challenge-card" onClick={() => pickChallenge(ch.id)}>
                  {chClub && <Crest club={chClub} size={34} mr={12} />}
                  <span style={{ flex: 1, textAlign: 'left' }}>
                    <b style={{ fontFamily: 'var(--serif)', fontSize: 15, color: 'var(--title-ink, #082b20)' }}>{ch.title}</b>
                    <span className="meta" style={{ display: 'block' }}>{ch.desc}</span>
                  </span>
                </button>
              )
            })}
          </>
        )}

        {step === 1 && league && (
          <>
            <div className="wizard-hint">Choose a club to manage in the {league.name}.</div>
            <div className="tile-grid three">
              {[...league.clubs].sort((a, b) => b.rep - a.rep).map(c => (
                <button key={c.id} className={`tile${clubId === c.id ? ' sel' : ''}`} onClick={() => setClubId(c.id)}>
                  <Crest club={c} size={30} mr={0} />
                  <b style={{ fontSize: 12 }}>{c.short}</b>
                </button>
              ))}
            </div>
            {club && (
              <div className="card detail-panel">
                <div className="club-banner" style={{ background: club.colors[0], color: '#fff' }}>
                  <Crest club={club} size={22} mr={8} />
                  <span style={{ flex: 1 }}>{club.name}</span>
                  <Jersey club={club} size={46} />
                </div>
                <div className="fact-grid">
                  <div><label>Reputation</label><span style={{ color: '#a8841a' }}>{'★'.repeat(Math.max(1, Math.round(club.rep / 20)))}<span style={{ opacity: .3 }}>{'★'.repeat(5 - Math.max(1, Math.round(club.rep / 20)))}</span></span></div>
                  <div><label>Finances</label><span style={{ color: finances(club.budget)[1], fontWeight: 700 }}>{finances(club.budget)[0]}</span></div>
                  <div><label>Star Player</label><span>⭐ {starPlayer?.name}</span></div>
                  <div><label>Stadium</label><span>{club.stadium} · {club.capacity.toLocaleString()}</span></div>
                  <div><label>Media Verdict</label><span>{mediaLabel(club.rep)}</span></div>
                  <div><label>Transfer Budget</label><span>£{(club.budget / 1e6).toFixed(1)}m</span></div>
                  <div><label>Squad Value</label><span>{fmtMoney(club.players.reduce((s, p) => s + playerValue(p.q, p.age, p.q), 0))}</span></div>
                  <div><label>Squad Size</label><span>{club.players.length}</span></div>
                </div>
              </div>
            )}
          </>
        )}

        {step === 2 && club && (
          <>
            <div className="wizard-hint">Your manager profile at {club.name}.</div>
            {challenge && (
              <div className="card" style={{ borderLeft: '4px solid #c9a227' }}>
                <h3 style={{ fontSize: 15 }}>Challenge accepted: {challenge.title}</h3>
                <div className="meta">{challenge.desc}</div>
              </div>
            )}
            <div className="card">
              <label className="fact-label">Your Name</label>
              <input className="inline-input" placeholder="e.g. A. Gaffer"
                value={name} onChange={e => setName(e.target.value)}
                onFocus={e => {
                  // keep the field visible above the software keyboard
                  const el = e.target
                  setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 250)
                }} />
              <label className="fact-label" style={{ marginTop: 8, display: 'block' }}>Coaching Philosophy</label>
              <div className="speech-grid" style={{ padding: '6px 0 0' }}>
                {COACHING_STYLES.map(s => (
                  <button key={s.id} className={`speech-tile${styleId === s.id ? ' sel' : ''}`}
                    onClick={() => setStyleId(s.id)}>
                    <b>{s.name}</b>
                    <span className="d">{s.desc}</span>
                  </button>
                ))}
              </div>
              <label className="fact-label" style={{ marginTop: 10, display: 'block' }}>Reputation</label>
              <div className="meta">Unknown - you'll earn it on the touchline.</div>
            </div>
          </>
        )}

        {step === 3 && club && league && (
          <>
            <div className="wizard-hint">Everything set. One tap from the dugout.</div>
            <div className="card detail-panel">
              <div className="club-banner" style={{ background: club.colors[0], color: '#fff' }}>
                <Crest club={club} size={22} mr={8} />{club.name}
              </div>
              <div className="fact-grid">
                <div><label>Manager</label><span>{name.trim()}</span></div>
                <div><label>Competition</label><span>{league.name}</span></div>
                <div><label>Philosophy</label><span>{COACHING_STYLES.find(s => s.id === styleId)?.name}</span></div>
                <div><label>Season</label><span>2025-26</span></div>
                {challenge && <div><label>Challenge</label><span>{challenge.title}</span></div>}
                <div><label>Board Objective</label><span>{club.rep >= 87 ? 'Win the title' : club.rep >= 80 ? 'Reach the playoffs' : club.rep >= 72 ? 'Top half' : 'Avoid the bottom two'}</span></div>
              </div>
            </div>
          </>
        )}
      </main>

      <div className="action-bar">
        <button className="btn ghost" onClick={prev}>{step === 0 ? 'Main Menu' : 'Back'}</button>
        <button className="btn gold" style={{ flex: 1.6, fontSize: 15 }} disabled={!canNext} onClick={next}>
          {step === 3 ? '▸ Start Career' : 'Confirm'}
        </button>
      </div>
    </>
  )
}
