import { useState } from 'react'
import { useStore } from '../../store'
import { CHEM_SLOTS, chemKey, chemTier, fmtMoney, POS_ORDER } from '../../game/model'
import { Crest, FormPill, Jersey, Nat, PosBadge, SectionTitle, Stars } from '../components'
import { nationByCode } from '../../game/nations'
import { squadValue, starPlayerIds } from '../../game/analysis'
import { activeFeuds, reconcileChance, reconcileFeud } from '../../game/gossip'
import { mulberry32 } from '../../game/rng'
import { dialLine, philosophyOf } from '../../game/philosophy'
import { archetypeOf } from '../../game/oppcoach'

export default function ClubScreen({ clubId }: { clubId: string }) {
  const game = useStore(s => s.game)!
  const go = useStore(s => s.go)
  // three pages rather than one long scroll (user: fit it into clean screens)
  const [ctab, setCtab] = useState<'club' | 'squad' | 'story'>('club')
  const [sqTab, setSqTab] = useState<'first' | 'acad'>('first')
  const touch = useStore(s => s.touch)
  const [riftMsg, setRiftMsg] = useState<string | null>(null)
  const club = game.clubs[clubId]
  if (!club) return null
  const league = game.comps[club.leagueId]
  const players = club.players.map(id => game.players[id]).filter(Boolean)
    .sort((a, b) => POS_ORDER.indexOf(a.pos) - POS_ORDER.indexOf(b.pos) || b.ca - a.ca)
  const honours = game.history.filter(h => h.champion === clubId)

  return (
    <>
      <div className="tab-bar">
        <button className={ctab === 'club' ? 'active' : ''} onClick={() => setCtab('club')}>The Club</button>
        <button className={ctab === 'squad' ? 'active' : ''} onClick={() => setCtab('squad')}>Squad</button>
        <button className={ctab === 'story' ? 'active' : ''} onClick={() => setCtab('story')}>History</button>
      </div>
      {ctab === 'club' && <div className="card" style={{ position: 'relative', overflow: 'hidden', paddingTop: 18 }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 6,
          background: `linear-gradient(90deg, ${club.colors[0]} 0 65%, ${club.colors[1]} 65% 100%)`,
        }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Crest club={club} size={40} mr={10} />
          <h3 style={{ fontSize: 20, flex: 1 }}>{club.name}</h3>
          <Jersey club={club} size={52} />
        </div>
        <div className="meta">{club.city}, {nationByCode(club.country)?.name ?? club.country} · {league?.name}</div>
        <div className="meta">🏟️ {club.stadium} - {club.capacity.toLocaleString()} capacity</div>
        <div className="meta">🧢 Head coach: {club.id === game.userClubId ? game.managerName : club.coach ?? 'vacant'}</div>
        {/* F23: how this dugout wants the game played. Yours is not listed here
            because yours is the four sliders on the tactics screen. */}
        {(() => {
          const ph = philosophyOf(club)
          if (!ph || club.id === game.userClubId) return null
          return (
            <div className="meta">
              📋 {ph.name} <span className="muted">({dialLine(club.tactic)})</span>
            </div>
          )
        })()}
        {/* the dugout's character (pillar 2): countering is a system you can
            plan against, not a hidden tax - so the scouting says who reads
            whom before you pick a game plan */}
        {club.id !== game.userClubId && (() => {
          const arch = archetypeOf(club.id)
          const word = arch === 'analyst' ? 'studies your recent matches and sets up to counter your habits'
            : arch === 'reactive' ? 'changes the picture from the touchline when the match turns against him'
            : 'trusts his own plan, week in, week out'
          return (
            <div className="meta">
              🧠 <b>{arch === 'analyst' ? 'The Analyst' : arch === 'reactive' ? 'The Tinkerer' : 'The Believer'}</b>: {word}
            </div>
          )
        })()}
        {(() => {
          const honours = game.history.filter(h => h.champion === club.id)
          if (!honours.length) return null
          const byComp: Record<string, number[]> = {}
          for (const h of honours) (byComp[h.compId] ??= []).push(2025 + h.season)
          return (
            <div style={{ marginTop: 8 }}>
              <div className="fact-label">🏆 Honours Board</div>
              {Object.entries(byComp).map(([compId, years]) => (
                <div key={compId} className="meta">
                  {game.comps[compId]?.name ?? compId} × {years.length} <span className="muted">({years.map(y => `${y}-${String((y + 1) % 100).padStart(2, '0')}`).join(', ')})</span>
                </div>
              ))}
            </div>
          )
        })()}
        <div className="badge-row" style={{ marginTop: 6, flexWrap: 'wrap' }}>
          <span className="chip">Reputation <b>{club.rep}</b></span>
          {club.id === game.userClubId && (() => {
            const m = game.fanMood ?? 60
            const word = m >= 80 ? 'Bouncing' : m >= 62 ? 'Behind you' : m >= 45 ? 'Watching' : m >= 30 ? 'Restless' : 'Mutinous'
            return <span className="chip" style={{ color: m >= 62 ? 'var(--text-positive)' : m <= 30 ? 'var(--text-negative)' : undefined }}>Fans <b>{word}</b></span>
          })()}
          <span className="chip">Squad <b>{players.length}</b></span>
          <span className="chip">Squad value <b>{fmtMoney(squadValue(game, club.id))}</b></span>
          {club.id !== game.userClubId && (() => {
            const rec = game.vsBook?.[club.id]
            if (!rec || rec.w + rec.d + rec.l === 0) return null
            return <>
              <span className="chip">Your record <b style={{ color: rec.w > rec.l ? 'var(--text-positive)' : rec.w < rec.l ? 'var(--text-negative)' : undefined }}>{rec.w}W {rec.d}D {rec.l}L</b></span>
              {Math.abs(rec.run ?? 0) >= 3 && (
                <span className="chip" style={{ color: (rec.run ?? 0) > 0 ? 'var(--text-positive)' : 'var(--text-negative)' }}>
                  {(rec.run ?? 0) > 0 ? `Won last ${rec.run}` : `Lost last ${-(rec.run ?? 0)}`}
                </span>
              )}
            </>
          })()}
          {players[0] && (() => {
            const stars = starPlayerIds(game, club.id)
            const star = players.find(p => stars.has(p.id))
            return star ? <span className="chip">⭐ Star <b>{star.name}</b></span> : null
          })()}
        </div>
      </div>}
      {/* ---- the History tab is never blank ----
          Everything on this page was conditional on something a new career does
          not have yet: no trophies, nobody near 100 appearances, no record gate,
          no derby ledger. Three `return null`s in a row and the tab rendered
          literally nothing (user: "history page on Newcastle is blank
          currently"). This card always has something true to say, and it names
          what will fill the rest of the page in. */}
      {ctab === 'story' && (() => {
        const rec = club.id === game.userClubId ? game.mgr : null
        const seasons = game.history.filter(h => h.champion === club.id).length
        const capped = players.filter(p => (p.caps ?? 0) > 0).length
        return (
          <>
            <SectionTitle sub={club.id === game.userClubId ? 'your era at the club' : 'what the record book holds'}>The Story So Far</SectionTitle>
            <div className="card">
              <div className="meta" style={{ padding: '2px 0' }}>
                🏟️ {club.stadium}, {club.city} · {club.capacity.toLocaleString()} capacity
              </div>
              <div className="meta" style={{ padding: '2px 0' }}>
                🏉 {league?.name ?? 'no league'} · reputation {club.rep}
              </div>
              {capped > 0 && (
                <div className="meta" style={{ padding: '2px 0' }}>
                  🌍 {capped} capped {capped === 1 ? 'international' : 'internationals'} on the books
                </div>
              )}
              {rec && (
                <div className="meta" style={{ padding: '2px 0' }}>
                  🧢 {game.managerName}: {rec.m} {rec.m === 1 ? 'match' : 'matches'}, {rec.w}W {rec.d}D {rec.l}L
                  {rec.trophies.length ? ` · ${rec.trophies.length} ${rec.trophies.length === 1 ? 'trophy' : 'trophies'}` : ''}
                </div>
              )}
              <div className="meta" style={{ padding: '2px 0' }}>
                🏆 {seasons ? `${seasons} ${seasons === 1 ? 'title' : 'titles'} won since you arrived` : 'No silverware in the book yet. Champions are crowned in May.'}
              </div>
              <div className="meta" style={{ marginTop: 6, color: 'var(--text-muted)' }}>
                A man joins the Legends list at 100 appearances here, the honours board fills in every
                May, and record gates and derby ledgers appear the first time you set one.
              </div>
            </div>
          </>
        )
      })()}
      {ctab === 'story' && (() => {
        // record book: retired legends + serving players with 100+ apps here
        const serving = players
          .map(p => {
            const past = p.career.filter(c => c.clubId === club.id)
              .reduce((t, c) => ({ apps: t.apps + c.apps, tries: t.tries + c.tries, pts: t.pts + c.points }), { apps: 0, tries: 0, pts: 0 })
            return { name: `${p.name} *`, apps: past.apps + p.stats.apps, tries: past.tries + p.stats.tries, pts: past.pts + p.stats.points }
          })
          .filter(x => x.apps >= 100)
        const book = [...(club.legends ?? []), ...serving].sort((a, b) => b.apps - a.apps).slice(0, 10)
        if (!book.length) return null
        return (
          <>
            <SectionTitle sub="100+ appearances · * still playing">Club Legends</SectionTitle>
            <div className="tblwrap"><table className="dtable">
              <thead><tr><th>Name</th><th className="num">Apps</th><th className="num">Tries</th><th className="num">Pts</th></tr></thead>
              <tbody>
                {book.map((l, i) => (
                  <tr key={i}>
                    <td className="name">{l.name}</td>
                    <td className="num" style={{ fontWeight: 700 }}>{l.apps}</td>
                    <td className="num">{l.tries}</td>
                    <td className="num">{l.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </>
        )
      })()}
      {ctab === 'story' && honours.length > 0 && (
        <>
          <SectionTitle>Honours (your era)</SectionTitle>
          <div className="chips">
            {honours.map((h, i) => (
              <span key={i} className="chip">🏆 {game.comps[h.compId]?.name ?? h.compId} {2025 + h.season}-{String((2026 + h.season) % 100).padStart(2, '0')}</span>
            ))}
          </div>
        </>
      )}
      {ctab === 'club' && club.id === game.userClubId && (() => {
        // the dressing room: who needs attention, and why - a read-only
        // window over every unhappiness the game's systems can produce
        const committed = new Set((game.preContracts ?? []).map(pc => pc.playerId))
        const pledged = new Set((game.pledges ?? []).map(pl => pl.playerId))
        const seniors = players.filter(p => !p.acad)
        const avg = seniors.length ? seniors.reduce((s, p) => s + p.morale, 0) / seniors.length : 7
        const verdict = avg >= 7.5 ? '😊 The room is bouncing - keep winning and keep quiet.'
          : avg >= 6 ? '🙂 Settled enough. A few individuals need an eye kept on them.'
          : avg >= 4.5 ? '😐 Uneasy. The card schools have gone quiet and doors close faster.'
          : '😤 Mutinous. Sort the loudest voices before they sort you.'
        const rows = seniors.map(p => {
          const why: string[] = []
          if (committed.has(p.id)) why.push('🖊 signed elsewhere')
          if ((p.wantsDeal ?? 0) > 0) why.push('💷 wants a deal')
          if (pledged.has(p.id) && !committed.has(p.id)) why.push('🤝 holding you to a promise')
          if (p.transferListed) why.push('📋 transfer listed')
          if (p.contractEnds <= game.season) why.push('⏳ deal expiring')
          if (game.week >= 10 && p.stats.apps <= 2 && !p.injury) why.push('🪑 short of minutes')
          if (!why.length && p.morale <= 4) why.push('🌧 flat, no single cause')
          return { p, why }
        }).filter(r => r.why.length && (r.p.morale <= 6.5 || r.why.some(w => !w.includes('deal expiring'))))
          .sort((a, b) => a.p.morale - b.p.morale)
          .slice(0, 8)
        return (
          <>
            <SectionTitle sub="who needs attention, and why">Dressing Room</SectionTitle>
            <div className="card">
              <div className="meta" style={{ paddingBottom: rows.length ? 6 : 0 }}>{verdict}</div>
              {rows.map(({ p, why }) => (
                <div key={p.id} onClick={() => go('player', p.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderTop: '1px solid var(--border)', cursor: 'pointer' }}>
                  <span style={{ fontWeight: 700, minWidth: 0, flex: 1 }}>
                    {p.name} <span className="muted" style={{ fontWeight: 400 }}>({p.pos})</span>
                  </span>
                  <span className="muted" style={{ fontSize: 12, textAlign: 'right' }}>{why.join(' · ')}</span>
                  <b style={{ color: p.morale <= 4 ? 'var(--text-negative)' : p.morale <= 6 ? 'var(--text-secondary)' : 'var(--text-positive)' }}>
                    {p.morale.toFixed(0)}
                  </b>
                </div>
              ))}
              {!rows.length && <div className="muted" style={{ fontSize: 12.5 }}>Nobody is agitating. Enjoy it - it never lasts.</div>}
            </div>
          </>
        )
      })()}
      {ctab === 'story' && club.id === game.userClubId && (() => {
        // the era's numbers: the record gate, the derby ledgers, the statue
        const gate = game.gateRecord
        const derbies = Object.entries(game.derbyBook ?? {}).filter(([, r]) => r.w + r.d + r.l > 0)
        const legend = (game.legendOf ?? []).includes(club.id)
        const tots = game.tryOfSeason && game.tryOfSeason.season === game.season ? game.tryOfSeason : null
        if (!gate && !derbies.length && !legend && !tots) return null
        return (
          <>
            <SectionTitle sub="what this era will be remembered for">Era Records</SectionTitle>
            <div className="card">
              {legend && (
                <div className="meta" style={{ padding: '3px 0', color: 'var(--info)', fontWeight: 700 }}>
                  🗽 Club legend - voted by the supporters' trust, forever
                </div>
              )}
              {gate && (
                <div className="meta" style={{ padding: '3px 0' }}>
                  🎟 Record gate: <b>{gate.att.toLocaleString()}</b> v {game.clubs[gate.oppId]?.short ?? gate.oppId}
                  {' '}<span className="muted">({2025 + gate.season}-{String((gate.season + 26) % 100).padStart(2, '0')})</span>
                </div>
              )}
              {tots && (
                <div className="meta" style={{ padding: '3px 0' }}>
                  🏉 Try of the Season so far: <b>{tots.name}</b>, {tots.min}&apos; v {tots.opp}
                </div>
              )}
              {derbies.map(([cid, r]) => (
                <div key={cid} className="meta" style={{ padding: '3px 0' }}>
                  🔥 v {game.clubs[cid]?.short ?? cid}: <b style={{ color: r.w > r.l ? 'var(--text-positive)' : r.w < r.l ? 'var(--text-negative)' : undefined }}>{r.w}W {r.d}D {r.l}L</b>
                  {r.w > r.l ? <span className="muted"> - bragging rights held</span> : r.w < r.l ? <span className="muted"> - they hold the whip hand</span> : null}
                </div>
              ))}
            </div>
          </>
        )
      })()}
      {ctab === 'club' && (() => {
        // live feuds involving this club + its strongest partnerships
        const feuds = (game.grudges ?? []).filter(g =>
          (g.a === club.id || g.b === club.id) && g.until >= game.season)
        const duos = CHEM_SLOTS.map(([i, j]) => {
          const a = club.tactic.lineup[i] != null ? game.players[club.tactic.lineup[i]!] : null
          const b = club.tactic.lineup[j] != null ? game.players[club.tactic.lineup[j]!] : null
          if (!a || !b) return null
          const g = game.chem?.[chemKey(a.id, b.id)] ?? 0
          return g >= 25 ? { a, b, g } : null
        }).filter(Boolean) as { a: { name: string }; b: { name: string }; g: number }[]
        // the rifts card stands on its own: a club with no grudges and no settled
        // partnerships can still have two men who have stopped speaking
        const rifts = clubId === game.userClubId ? activeFeuds(game) : []
        if (!feuds.length && !duos.length && !rifts.length) return null
        const surname = (n: string) => n.split(' ').slice(-1)[0]
        return (
          <>
            {/* Dressing-room rifts, and something you can do about them (10H).
                A fallout used to exist only as a Wire story: two of your men
                stopped speaking, morale bled every week, and there was nowhere in
                the game to intervene. Now you can get them in a room - and it can
                blow up in your face, because whether they do it is about whether
                they will do it for YOU. */}
            {rifts.length > 0 && (() => {
              return (
                <>
                  <SectionTitle sub="two of yours are not speaking - and it is costing you">Dressing-Room Rifts</SectionTitle>
                  <div className="card">
                    {rifts.map((f, i) => {
                      const a = game.players[f.a]
                      const b = game.players[f.b]
                      if (!a || !b) return null
                      const pct = Math.round(reconcileChance(game, f) * 100)
                      const asked = f.tried != null && game.week - f.tried < 1
                      return (
                        <div key={`${f.a}_${f.b}`} className="rift-row">
                          <div className="meta">
                            <b>{a.name}</b> ({a.pers.toLowerCase()}) and <b>{b.name}</b> ({b.pers.toLowerCase()})
                            have not spoken since week {f.week}.
                          </div>
                          <div className="btn-row" style={{ marginTop: 5 }}>
                            <button className="btn gold tiny" disabled={asked}
                              title={asked ? 'You had them in this week already' : 'Get them in a room and shut the door'}
                              onClick={() => {
                                const rng = mulberry32(game.seed ^ (f.a * 31 + f.b * 17 + game.week * 7))
                                setRiftMsg(reconcileFeud(game, i, rng).msg)
                                touch()
                              }}>
                              🤝 Get Them In A Room
                            </button>
                            <span className="meta" style={{ alignSelf: 'center' }}>
                              {asked ? 'asked this week' : `${pct}% they shake on it`}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                    {riftMsg && <div className="meta sheet-log" style={{ marginTop: 6 }}>{riftMsg}</div>}
                    <div className="meta" style={{ marginTop: 6 }}>
                      It comes down to whether these two will do it for you: their mood, their
                      characters, how you stand at the club, and how long it has festered. Fail and
                      the squad knows you tried, which costs more than saying nothing.
                    </div>
                  </div>
                </>
              )
            })()}
            {(feuds.length > 0 || duos.length > 0) && (
              <SectionTitle sub="who they hate, who clicks">Feuds & Partnerships</SectionTitle>
            )}
            <div className="card" style={feuds.length || duos.length ? undefined : { display: 'none' }}>
              {feuds.map((g, i) => {
                const opp = g.a === club.id ? g.b : g.a
                return (
                  <div key={`f${i}`} className="meta" style={{ padding: '3px 0' }}>
                    🔥 <b>{game.clubs[opp]?.short ?? opp}</b> - {g.reason} <span className="muted">(runs to {2025 + g.until}-{String((g.until + 26) % 100).padStart(2, '0')})</span>
                  </div>
                )
              })}
              {duos.map((d, i) => (
                <div key={`d${i}`} className="meta" style={{ padding: '3px 0' }}>
                  🤝 <b>{surname(d.a.name)} & {surname(d.b.name)}</b> - {d.g} games together, {chemTier(d.g)}
                </div>
              ))}
            </div>
          </>
        )
      })()}
      {ctab === 'squad' && (() => {
      // FIRST TEAM AND ACADEMY, SEPARATED (user: "when you click on another teams
      // squad - there should be a filter for academy and first team"). The one
      // list mixed 17-year-old academy kids in with the senior squad, which made
      // another club's real strength hard to read and buried the very prospects
      // worth scouting.
      const firsts = players.filter(p => !p.acad)
      const acads = players.filter(p => p.acad)
      const shown = sqTab === 'acad' ? acads : firsts
      return <>
      <SectionTitle sub="tap to scout">Squad</SectionTitle>
      <div className="tab-bar">
        <button className={sqTab === 'first' ? 'active' : ''} onClick={() => setSqTab('first')}>First Team ({firsts.length})</button>
        <button className={sqTab === 'acad' ? 'active' : ''} onClick={() => setSqTab('acad')}>Academy ({acads.length})</button>
      </div>
      {shown.length === 0 && <div className="muted" style={{ padding: '4px 16px 10px' }}>Nobody on the books here.</div>}
      <div className="tblwrap"><table className="dtable">
        <thead><tr><th>Pos</th><th>Name</th><th>Age</th><th>Nat</th><th>Ability</th><th>Form</th><th className="num">Value</th></tr></thead>
        <tbody>
          {shown.map(p => (
            <tr key={p.id} onClick={() => go('player', p.id)}>
              <td><PosBadge pos={p.pos} /></td>
              <td className="name">{p.name}{starPlayerIds(game, club.id).has(p.id) ? ' ⭐' : ''}</td>
              <td className="num">{p.age}</td>
              <td><Nat code={p.nat} /></td>
              <td><Stars ca={p.ca} /></td>
              <td><FormPill v={p.form} /></td>
              <td className="num">{fmtMoney(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      </>
      })()}
      <div className="spacer" />
    </>
  )
}
