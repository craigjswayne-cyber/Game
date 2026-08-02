import { useMemo, useState } from 'react'
import { useStore } from '../../store'
import { LEAGUE_DEFS } from '../../game/newgame'
import { Crest, SectionTitle } from '../components'

export default function NewGame() {
  const start = useStore(s => s.start)
  const back = useStore(s => s.back)
  const defs = useMemo(() => LEAGUE_DEFS(), [])
  const [leagueIdx, setLeagueIdx] = useState(0)
  const [clubId, setClubId] = useState<string | null>(null)
  const [name, setName] = useState('')

  const league = defs[leagueIdx]
  const club = clubId ? league.clubs.find(c => c.id === clubId) : null

  return (
    <>
      <header className="masthead">
        <div className="masthead-row">
          <button className="back-btn" onClick={back}>‹</button>
          <div style={{ flex: 1 }}>
            <h1>Start Your Career</h1>
            <div className="date">Season 2025-26 · pick your club</div>
          </div>
        </div>
      </header>
      <main className="content">
        <div className="tab-bar">
          {defs.map((d, i) => (
            <button key={d.id} className={i === leagueIdx ? 'active' : ''}
              onClick={() => { setLeagueIdx(i); setClubId(null) }}>
              {d.short}
            </button>
          ))}
        </div>
        <SectionTitle sub={`${league.clubs.length} clubs`}>{league.name}</SectionTitle>
        {[...league.clubs].sort((a, b) => b.rep - a.rep).map(c => (
          <button key={c.id} className="club-pick" onClick={() => setClubId(c.id)}
            style={clubId === c.id ? { background: 'color-mix(in srgb, var(--gold) 16%, var(--paper))' } : undefined}>
            <Crest club={c} size={22} mr={0} />
            <span className="cname">{c.name}</span>
            <span className="muted">{c.stadium}</span>
            <span style={{ color: '#a8841a', fontSize: 11 }}>{'★'.repeat(Math.max(1, Math.round(c.rep / 20)))}</span>
          </button>
        ))}
        {club && (
          <div className="card">
            <h3>{club.name}</h3>
            <div className="meta">{club.stadium}, {club.city} · capacity {club.capacity.toLocaleString()} · budget £{(club.budget / 1e6).toFixed(1)}m</div>
            <input className="inline-input" placeholder="Your name, gaffer"
              value={name} onChange={e => setName(e.target.value)} />
            <button className="btn gold" style={{ width: '100%', fontSize: 15 }}
              disabled={!name.trim()}
              onClick={() => start(club.id, name.trim())}>
              Take the Job
            </button>
          </div>
        )}
        <div className="spacer" />
      </main>
    </>
  )
}
