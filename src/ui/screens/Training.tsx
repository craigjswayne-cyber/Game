import { useState } from 'react'
import { useStore } from '../../store'
import { STAFF_INFO, fmtMoney, type TrainingFocus } from '../../game/model'
import { BADGE, BADGE_COL, EXAM_PASS_PCT, appointStaff, courseFee, sendToCourse, staffCandidates, staffInterest, type StaffRole } from '../../game/staff'
import { fitReason, fitWord, mentorFit } from '../../game/mentoring'
import { flagOf } from '../../game/nations'
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
  const go = useStore(s => s.go)
  const club = game.clubs[game.userClubId]
  const [ttab, setTtab] = useState<'training' | 'staff' | 'club' | 'cond'>('training')
  const players = club.players.map(id => game.players[id]).filter(Boolean)
    .sort((a, b) => a.cond - b.cond)

  return (
    <>
      <div className="tab-bar">
        <button className={ttab === 'training' ? 'active' : ''} onClick={() => setTtab('training')}>Training</button>
        <button className={ttab === 'staff' ? 'active' : ''} onClick={() => setTtab('staff')}>Staff</button>
        <button className={ttab === 'cond' ? 'active' : ''} onClick={() => setTtab('cond')}>Condition</button>
        <button className={ttab === 'club' ? 'active' : ''} onClick={() => setTtab('club')}>Club</button>
      </div>
      {ttab === 'training' && <>
      <SectionTitle sub="small weekly gains in the focus area">Weekly Focus</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 4, padding: '0 14px' }}>
        {FOCUSES.map(f => (
          <button key={f.id} className={`club-pick${game.training === f.id ? ' sel' : ''}`} style={{ margin: 0 }}
            onClick={() => { game.training = f.id; touch() }}>
            <span style={{ fontSize: 15 }}>{game.training === f.id ? '●' : '○'}</span>
            <span className="cname">{f.name}</span>
            <span className="muted" style={{ maxWidth: '52%', textAlign: 'right', fontSize: 11 }}>{f.desc}</span>
          </button>
        ))}
      </div>
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
      {ttab === 'staff' && <StaffPanel />}
      {ttab === 'club' && <>
      <SectionTitle sub="a senior pro brings a kid through (max 3)">Mentoring</SectionTitle>
      <MentorPanel />
      <SectionTitle sub="the ground, the pitch, the gym, the shop">Infrastructure</SectionTitle>
      <button className="club-pick" onClick={() => go('infra')}>
        <span style={{ fontSize: 16 }}>🏗️</span>
        <span className="cname">Club Infrastructure</span>
        <span className="muted">every facility and the board requests to upgrade them ›</span>
      </button>
      </>}
      {ttab === 'cond' && <>
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


/**
 * The coaching department as people: a named man with a badge in every job,
 * a market of candidates, and courses that can be failed (8-batch feedback).
 */
function StaffPanel() {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const [open, setOpen] = useState<StaffRole | null>(null)
  const [msg, setMsg] = useState('')
  const abs = game.season * 100 + game.week
  const roles = Object.keys(STAFF_INFO) as StaffRole[]
  return (
    <>
      <SectionTitle sub={`a badge is one day of assessment - ${EXAM_PASS_PCT}% pass, and a failure waits a month`}>Backroom Staff</SectionTitle>
      {msg && <div className="card" style={{ borderLeft: '4px solid #c9a227', padding: '7px 10px', marginBottom: 6 }}>{msg}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 6 }}>
        {roles.map(role => {
          const info = STAFF_INFO[role]
          const p = game.staffPeople?.[role]
          const cands = open === role ? staffCandidates(game, role) : []
          const weeksLeft = p?.course ? Math.max(1, p.course.done - abs) : 0
          return (
            <div className="card" key={role} style={{ margin: 0, padding: '8px 10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div className="fact-label">{info.name}</div>
                  {p ? (
                    <>
                      <h3 style={{ fontSize: 14, margin: 0 }}>
                        {flagOf(p.nat)} {p.name} <b style={{ color: BADGE_COL[p.tier], fontSize: 11.5 }}>{BADGE[p.tier].toUpperCase()}</b>
                      </h3>
                      <div className="meta" style={{ fontSize: 11 }}>
                        {p.age} · {p.trait} · {fmtMoney(p.wage)}/wk{(p.passed ?? 0) > 0 ? ` · ${p.passed} badge${p.passed === 1 ? '' : 's'} here` : ''}
                      </div>
                      {p.course && <div className="meta" style={{ fontSize: 11, color: '#a8841a', fontWeight: 700 }}>🎓 On the {BADGE[p.course.toTier].toLowerCase()} course - result in {weeksLeft} week{weeksLeft === 1 ? '' : 's'}</div>}
                      {!p.course && (p.retakeAt ?? 0) > abs && (
                        <div className="meta" style={{ fontSize: 11, color: 'var(--red)' }}>
                          Failed his last assessment - can sit it again in {p.retakeAt! - abs} week{p.retakeAt! - abs === 1 ? '' : 's'}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <h3 style={{ fontSize: 14, margin: 0, opacity: .75 }}>Vacant</h3>
                      <div className="meta" style={{ fontSize: 11 }}>{info.desc}</div>
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                  {p && p.tier < 3 && !p.course && (p.retakeAt ?? 0) <= abs && (
                    <button className="btn gold" style={{ padding: '4px 8px', fontSize: 11, lineHeight: 1.25 }}
                      onClick={() => { setMsg(sendToCourse(game, role)); touch() }}>
                      🎓 Assess<br /><span style={{ fontSize: 10, fontWeight: 600 }}>{fmtMoney(courseFee(p.tier))}</span>
                    </button>
                  )}
                  <button className="btn ghost" style={{ padding: '4px 8px', fontSize: 11 }}
                    onClick={() => { setOpen(open === role ? null : role); setMsg('') }}>
                    {open === role ? 'Close' : p ? 'Market' : 'Candidates'}
                  </button>
                </div>
              </div>
              {open === role && cands.map((c, i) => {
                const keen = staffInterest(game, c)
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid var(--rule, rgba(128,128,128,.25))', paddingTop: 5, marginTop: 5 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700 }}>
                        {flagOf(c.nat)} {c.name} <span style={{ color: BADGE_COL[c.tier], fontSize: 10.5 }}>{BADGE[c.tier].toUpperCase()}</span>
                      </div>
                      <div className="meta" style={{ fontSize: 10.5 }}>
                        {c.age} · {c.trait} · {fmtMoney(c.wage)}/wk · {fmtMoney(c.fee)} compensation
                      </div>
                    </div>
                    <span className="meta" style={{ fontSize: 10.5, color: keen === 'keen' ? '#2f7d4f' : keen === 'persuadable' ? '#8a7a3a' : '#9b2c2c', fontWeight: 700, flexShrink: 0 }}>
                      {keen === 'keen' ? 'Keen' : keen === 'persuadable' ? 'Listening' : 'Not interested'}
                    </span>
                    <button className="btn" style={{ padding: '4px 9px', fontSize: 11, flexShrink: 0 }}
                      onClick={() => { setMsg(appointStaff(game, role, i)); setOpen(null); touch() }}>Appoint</button>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
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
        // how well the two of them actually work together, and why
        const fit = mentorFit(s2, k2)
        const col = fit >= 66 ? 'var(--win)' : fit >= 36 ? '#a8841a' : 'var(--red)'
        return (
          <div key={i} style={{ padding: '5px 0', borderTop: i ? '1px solid var(--hairline)' : undefined }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span className="meta" style={{ flex: 1, minWidth: 0 }}>
                <b>{s2.name}</b> ({s2.pers}) → 🎓 <b>{k2.name}</b> ({k2.age})
              </span>
              <b style={{ color: col, fontSize: 12, whiteSpace: 'nowrap' }}>{fitWord(fit)} {fit}</b>
              <button className="btn ghost" style={{ fontSize: 11, padding: '4px 10px' }}
                onClick={() => { game.mentors = pairs.filter((_, j) => j !== i); touch() }}>End</button>
            </div>
            <div className="meta" style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{fitReason(s2, k2)}</div>
            <div className="rt-bar" style={{ margin: '3px 0 0' }}><i style={{ width: `${fit}%`, background: col }} /></div>
          </div>
        )
      })}
      {pairs.length === 0 && <div className="meta" style={{ fontSize: 11 }}>A Leader or Professional rubs off on a kid - faster growth, and his character sticks. Character decides how well it takes, so pick the pairing rather than the names.</div>}
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
