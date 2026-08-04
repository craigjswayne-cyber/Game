import { useState } from 'react'
import { useStore } from '../../store'
import { FACILITY_INFO, STAFF_INFO, facilityCost, fmtMoney, type FacilityId, type StaffLevels, type TrainingFocus } from '../../game/model'
import { requestFacility } from '../../game/season'
import { SectionTitle } from '../components'

const FOCUSES: { id: TrainingFocus; name: string; desc: string }[] = [
  { id: 'balanced', name: 'Balanced', desc: 'A steady all-round programme.' },
  { id: 'scrum', name: 'Scrummaging', desc: 'Live scrums and strength work for the tight five.' },
  { id: 'lineout', name: 'Lineout', desc: 'Throwing accuracy, lifting pods, calling.' },
  { id: 'attack', name: 'Attack', desc: 'Handling, shape and support lines.' },
  { id: 'defence', name: 'Defence', desc: 'Tackle technique and line speed.' },
  { id: 'fitness', name: 'Conditioning', desc: 'Engine building - improves stamina.' },
  { id: 'kicking', name: 'Kicking', desc: 'Tactical and goal kicking practice.' },
]

export default function Training() {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const club = game.clubs[game.userClubId]
  const [ttab, setTtab] = useState<'training' | 'staff' | 'club'>('training')
  const [facMsg, setFacMsg] = useState('')
  const players = club.players.map(id => game.players[id]).filter(Boolean)
    .sort((a, b) => a.cond - b.cond)

  return (
    <>
      <div className="tab-bar">
        <button className={ttab === 'training' ? 'active' : ''} onClick={() => setTtab('training')}>Training</button>
        <button className={ttab === 'staff' ? 'active' : ''} onClick={() => setTtab('staff')}>Staff</button>
        <button className={ttab === 'club' ? 'active' : ''} onClick={() => setTtab('club')}>Club</button>
      </div>
      {ttab === 'training' && <>
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
      </>}
      {ttab === 'staff' && <>
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
      </>}
      {ttab === 'club' && <>
      <SectionTitle sub="a senior pro brings a kid through (max 3)">Mentoring</SectionTitle>
      <MentorPanel />
      <SectionTitle sub="board approval needed">Training Facilities</SectionTitle>
      {facMsg && <div className="card" style={{ borderLeft: '4px solid #c9a227', padding: '7px 10px', marginBottom: 6 }}>{facMsg}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 6 }}>
        {(Object.keys(FACILITY_INFO) as FacilityId[]).map(fid => {
          const info = FACILITY_INFO[fid]
          const lvl = game.facilities?.[fid] ?? 0
          const cost = facilityCost(info, lvl)
          const building = game.facilityBuild?.id === fid ? game.facilityBuild : null
          const weeksLeft = building ? Math.max(1, building.done - (game.season * 100 + game.week)) : 0
          return (
            <div className="card" key={fid} style={{ margin: 0, padding: '8px 10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontSize: 13.5, margin: 0 }}>{info.icon} {info.name} <span style={{ color: '#a8841a' }}>{'●'.repeat(lvl)}{'○'.repeat(3 - lvl)}</span></h3>
                  <div className="meta" style={{ fontSize: 11 }}>{info.desc}</div>
                  {building && <div className="meta" style={{ fontSize: 11, color: '#a8841a', fontWeight: 700 }}>🏗 Builders on site - opens in about {weeksLeft} week{weeksLeft === 1 ? '' : 's'}</div>}
                </div>
                {!building && lvl < 3 && (
                  <button className="btn gold" style={{ padding: '5px 9px', fontSize: 11, lineHeight: 1.25, flexShrink: 0 }}
                    disabled={game.facilityBuild != null}
                    onClick={() => { setFacMsg(requestFacility(game, fid)); touch() }}>
                    🏛 Ask board<br />
                    <span style={{ fontSize: 10, fontWeight: 600 }}>{fmtMoney(cost)}</span>
                  </button>
                )}
                {lvl >= 3 && <span className="meta" style={{ flexShrink: 0, color: '#a8841a', fontWeight: 700 }}>World class</span>}
              </div>
            </div>
          )
        })}
      </div>
      </>}
      {ttab === 'training' && <>
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
      </>}
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
    <div className="card" style={{ padding: '8px 10px' }}>
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
      {pairs.length === 0 && <div className="meta" style={{ fontSize: 11 }}>A Leader or Professional rubs off on a kid - faster growth, and his character sticks.</div>}
      {pairs.length < 3 && seniors.length > 0 && kids.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
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
              body: `The old pro and the academy kid: ${s2.name} will mentor ${k2.name} for the season - extras after training, lifts to the ground, the lot. This is how clubs pass themselves on.`,
              playerId: k2.id,
            })
            setSeniorId(''); setKidId(''); touch()
          }}>Pair</button>
        </div>
      )}
    </div>
  )
}
