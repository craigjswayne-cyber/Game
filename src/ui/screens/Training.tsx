import { useState } from 'react'
import { useStore } from '../../store'
import { FACILITY_INFO, STAFF_INFO, facilityCost, fmtMoney, type FacilityId, type StaffLevels, type TrainingFocus } from '../../game/model'
import { SectionTitle } from '../components'

const FOCUSES: { id: TrainingFocus; name: string; desc: string }[] = [
  { id: 'balanced', name: 'Balanced', desc: 'A steady all-round programme.' },
  { id: 'scrum', name: 'Scrummaging', desc: 'Live scrums and strength work for the tight five.' },
  { id: 'lineout', name: 'Lineout', desc: 'Throwing accuracy, lifting pods, calling.' },
  { id: 'attack', name: 'Attack', desc: 'Handling, shape and support lines.' },
  { id: 'defence', name: 'Defence', desc: 'Tackle technique and line speed.' },
  { id: 'fitness', name: 'Conditioning', desc: 'Engine building — improves stamina.' },
  { id: 'kicking', name: 'Kicking', desc: 'Tactical and goal kicking practice.' },
]

export default function Training() {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const club = game.clubs[game.userClubId]
  const players = club.players.map(id => game.players[id]).filter(Boolean)
    .sort((a, b) => a.cond - b.cond)

  return (
    <>
      <SectionTitle sub="small weekly gains in the focus area">Weekly Focus</SectionTitle>
      {FOCUSES.map(f => (
        <button key={f.id} className="club-pick" onClick={() => { game.training = f.id; touch() }}>
          <span style={{ fontSize: 16 }}>{game.training === f.id ? '●' : '○'}</span>
          <span className="cname">{f.name}</span>
          <span className="muted" style={{ maxWidth: '55%', textAlign: 'right' }}>{f.desc}</span>
        </button>
      ))}
      <SectionTitle sub="up to 3 youngsters, faster growth">Development Focus</SectionTitle>
      <div className="chips">
        {players.filter(p => p.age <= 26).sort((a, b) => b.pa - b.ca - (a.pa - a.ca)).slice(0, 10).map(p => {
          const on = game.devFocus.includes(p.id)
          return (
            <button key={p.id} className="chip" style={on ? { borderColor: '#c9a227', background: 'color-mix(in srgb, var(--gold) 14%, var(--paper))' } : undefined}
              onClick={() => {
                game.devFocus = on
                  ? game.devFocus.filter(id => id !== p.id)
                  : [...game.devFocus, p.id].slice(-3)
                touch()
              }}>
              {on ? '● ' : '○ '}{p.name} <b>{p.age}</b>
            </button>
          )
        })}
      </div>
      <SectionTitle sub="wages come off the weekly balance">Backroom Staff</SectionTitle>
      {(Object.keys(STAFF_INFO) as (keyof StaffLevels)[]).map(role => {
        const info = STAFF_INFO[role]
        const lvl = game.staff[role]
        return (
          <div className="card" key={role} style={{ marginTop: 8, marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div>
                <h3 style={{ fontSize: 15 }}>{info.name} {lvl > 0 && <span style={{ color: '#a8841a' }}>{'●'.repeat(lvl)}{'○'.repeat(3 - lvl)}</span>}</h3>
                <div className="meta">{info.desc}</div>
                <div className="muted" style={{ marginTop: 2 }}>
                  {lvl > 0 ? `Level ${lvl} · ${fmtMoney(lvl * info.wage)}/wk` : 'Not appointed'}
                </div>
              </div>
              <button className="btn gold" disabled={lvl >= 3}
                onClick={() => useStore.getState().hireStaff(role)}>
                {lvl === 0 ? 'Hire' : lvl >= 3 ? 'Max' : 'Upgrade'}<br />
                <span style={{ fontSize: 10, fontWeight: 600 }}>+{fmtMoney(info.wage)}/wk</span>
              </button>
            </div>
          </div>
        )
      })}
      <SectionTitle sub="a senior pro shows an academy kid how it's done (max 3 pairs)">Mentoring</SectionTitle>
      <MentorPanel />
      <SectionTitle sub="paid from the club balance — bricks outlast squads">Facilities</SectionTitle>
      {(Object.keys(FACILITY_INFO) as FacilityId[]).map(fid => {
        const info = FACILITY_INFO[fid]
        const lvl = game.facilities?.[fid] ?? 0
        const cost = facilityCost(info, lvl)
        const club = game.clubs[game.userClubId]
        return (
          <div className="card" key={fid} style={{ marginTop: 6, marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div>
                <h3 style={{ fontSize: 14 }}>{info.icon} {info.name} {lvl > 0 && <span style={{ color: '#a8841a' }}>{'●'.repeat(lvl)}{'○'.repeat(3 - lvl)}</span>}</h3>
                <div className="meta">{info.desc}</div>
              </div>
              <button className="btn gold" disabled={lvl >= 3 || club.balance < cost}
                onClick={() => {
                  if (club.balance < cost || lvl >= 3) return
                  club.balance -= cost
                  game.facilities = { ...(game.facilities ?? {}), [fid]: lvl + 1 }
                  touch()
                }}>
                {lvl >= 3 ? 'Max' : lvl === 0 ? 'Build' : 'Upgrade'}<br />
                {lvl < 3 && <span style={{ fontSize: 10, fontWeight: 600 }}>{fmtMoney(cost)}</span>}
              </button>
            </div>
          </div>
        )
      })}
      <SectionTitle sub="worst first">Condition Report</SectionTitle>
      <div className="tblwrap"><table className="dtable">
        <thead><tr><th>Name</th><th className="num">Fitness</th><th className="num">Sharpness</th><th>Status</th></tr></thead>
        <tbody>
          {players.map(p => (
            <tr key={p.id}>
              <td className="name">{p.name}</td>
              <td className="num" style={{ color: p.cond < 70 ? '#9b2c2c' : undefined }}>{Math.round(p.cond)}%</td>
              <td className="num">{Math.round(p.sharp)}%</td>
              <td className="muted">{p.injury ? `${p.injury.desc} (~${Math.max(0, p.injury.until - game.week)}w)` : p.natSquad ? 'Intl duty' : p.bans > 0 ? `Banned ${p.bans}` : 'Available'}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      <div className="spacer" />
    </>
  )
}


/** Pair the wise heads with the next generation. */
function MentorPanel() {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const [seniorId, setSeniorId] = useState<number | ''>('')
  const [kidId, setKidId] = useState<number | ''>('')
  const club = game.clubs[game.userClubId]
  const pairs = game.mentors ?? []
  const squad = club.players.map(id => game.players[id]).filter(Boolean)
  const seniors = squad.filter(p => !p.acad && p.age >= 28 && !pairs.some(mp => mp.senior === p.id))
    .sort((a, b) => b.a.lea - a.a.lea)
  const kids = squad.filter(p => p.acad && !pairs.some(mp => mp.kid === p.id))
    .sort((a, b) => b.pa - a.pa)
  return (
    <div className="card">
      {pairs.map((mp, i) => {
        const s2 = game.players[mp.senior]
        const k2 = game.players[mp.kid]
        if (!s2 || !k2) return null
        return (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
            <span className="meta"><b>{s2.name}</b> ({s2.pers}) → 🎓 <b>{k2.name}</b> ({k2.age})</span>
            <button className="btn ghost" style={{ fontSize: 11, padding: '4px 10px' }}
              onClick={() => { game.mentors = pairs.filter((_, j) => j !== i); touch() }}>End</button>
          </div>
        )
      })}
      {pairs.length === 0 && <div className="meta">No pairs yet. A Leader or Professional rubs off on a kid — faster growth, and his character sticks.</div>}
      {pairs.length < 3 && seniors.length > 0 && kids.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="inline-input" style={{ margin: 0, flex: 1, minWidth: 130 }} value={seniorId}
            onChange={e => setSeniorId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Senior pro…</option>
            {seniors.map(p => <option key={p.id} value={p.id}>{p.name} ({p.pers}, {p.age})</option>)}
          </select>
          <select className="inline-input" style={{ margin: 0, flex: 1, minWidth: 130 }} value={kidId}
            onChange={e => setKidId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Academy kid…</option>
            {kids.map(p => <option key={p.id} value={p.id}>{p.name} ({p.pos}, {p.age})</option>)}
          </select>
          <button className="btn" disabled={!seniorId || !kidId} onClick={() => {
            if (!seniorId || !kidId) return
            game.mentors = [...pairs, { senior: seniorId, kid: kidId }]
            const s2 = game.players[seniorId]; const k2 = game.players[kidId]
            game.news.push({
              id: game.nextId++, week: game.week, season: game.season, type: 'youth', read: true,
              subject: `${s2.name} takes ${k2.name.split(' ').slice(-1)[0]} under his wing`,
              body: `The old pro and the academy kid: ${s2.name} will mentor ${k2.name} for the season — extras after training, lifts to the ground, the lot. This is how clubs pass themselves on.`,
              playerId: k2.id,
            })
            setSeniorId(''); setKidId(''); touch()
          }}>Pair</button>
        </div>
      )}
    </div>
  )
}
