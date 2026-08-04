import { useStore } from '../../store'
import { CHEM_SLOTS, chemKey, chemTier, fmtMoney, POS_ORDER } from '../../game/model'
import { Crest, FormPill, Jersey, Nat, PosBadge, SectionTitle, Stars } from '../components'
import { nationByCode } from '../../game/nations'
import { squadValue, starPlayerIds } from '../../game/analysis'

export default function ClubScreen({ clubId }: { clubId: string }) {
  const game = useStore(s => s.game)!
  const go = useStore(s => s.go)
  const club = game.clubs[clubId]
  if (!club) return null
  const league = game.comps[club.leagueId]
  const players = club.players.map(id => game.players[id]).filter(Boolean)
    .sort((a, b) => POS_ORDER.indexOf(a.pos) - POS_ORDER.indexOf(b.pos) || b.ca - a.ca)
  const honours = game.history.filter(h => h.champion === clubId)

  return (
    <>
      <div className="card" style={{ position: 'relative', overflow: 'hidden', paddingTop: 18 }}>
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
            return <span className="chip" style={{ color: m >= 62 ? '#2f7d4f' : m <= 30 ? '#9b2c2c' : undefined }}>Fans <b>{word}</b></span>
          })()}
          <span className="chip">Squad <b>{players.length}</b></span>
          <span className="chip">Squad value <b>{fmtMoney(squadValue(game, club.id))}</b></span>
          {club.id !== game.userClubId && (() => {
            const rec = game.vsBook?.[club.id]
            if (!rec || rec.w + rec.d + rec.l === 0) return null
            return <span className="chip">Your record <b style={{ color: rec.w > rec.l ? '#2f7d4f' : rec.w < rec.l ? '#9b2c2c' : undefined }}>{rec.w}W {rec.d}D {rec.l}L</b></span>
          })()}
          {players[0] && (() => {
            const stars = starPlayerIds(game, club.id)
            const star = players.find(p => stars.has(p.id))
            return star ? <span className="chip">⭐ Star <b>{star.name}</b></span> : null
          })()}
        </div>
      </div>
      {(() => {
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
      {honours.length > 0 && (
        <>
          <SectionTitle>Honours (your era)</SectionTitle>
          <div className="chips">
            {honours.map((h, i) => (
              <span key={i} className="chip">🏆 {game.comps[h.compId]?.name ?? h.compId} {2025 + h.season}-{String((2026 + h.season) % 100).padStart(2, '0')}</span>
            ))}
          </div>
        </>
      )}
      {club.id === game.userClubId && (() => {
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
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderTop: '1px solid var(--hairline)', cursor: 'pointer' }}>
                  <span style={{ fontWeight: 700, minWidth: 0, flex: 1 }}>
                    {p.name} <span className="muted" style={{ fontWeight: 400 }}>({p.pos})</span>
                  </span>
                  <span className="muted" style={{ fontSize: 12, textAlign: 'right' }}>{why.join(' · ')}</span>
                  <b style={{ color: p.morale <= 4 ? '#9b2c2c' : p.morale <= 6 ? 'var(--ink-soft)' : '#2f7d4f' }}>
                    {p.morale.toFixed(0)}
                  </b>
                </div>
              ))}
              {!rows.length && <div className="muted" style={{ fontSize: 12.5 }}>Nobody is agitating. Enjoy it - it never lasts.</div>}
            </div>
          </>
        )
      })()}
      {(() => {
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
        if (!feuds.length && !duos.length) return null
        const surname = (n: string) => n.split(' ').slice(-1)[0]
        return (
          <>
            <SectionTitle sub="who they hate, who clicks">Feuds & Partnerships</SectionTitle>
            <div className="card">
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
      <SectionTitle sub="tap to scout">Squad</SectionTitle>
      <div className="tblwrap"><table className="dtable">
        <thead><tr><th>Pos</th><th>Name</th><th>Age</th><th>Nat</th><th>Ability</th><th>Form</th><th className="num">Value</th></tr></thead>
        <tbody>
          {players.map(p => (
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
      <div className="spacer" />
    </>
  )
}
