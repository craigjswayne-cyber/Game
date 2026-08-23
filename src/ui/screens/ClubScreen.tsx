import { useState } from 'react'
import { useStore } from '../../store'
import { CHEM_SLOTS, chemKey, chemTier, fmtMoney, POS_ORDER } from '../../game/model'
import { Crest, FormPill, Jersey, Nat, PosBadge, SectionTitle, Stars } from '../components'
import { nationByCode } from '../../game/nations'
import { squadValue, starPlayerIds } from '../../game/analysis'
import { activeFeuds, reconcileChance, reconcileFeud } from '../../game/gossip'
import { mulberry32 } from '../../game/rng'
import { dialLine, philosophyOf } from '../../game/philosophy'
import { t } from '../../game/i18n'
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
        <button className={ctab === 'club' ? 'active' : ''} onClick={() => setCtab('club')}>{t('club.tabClub')}</button>
        <button className={ctab === 'squad' ? 'active' : ''} onClick={() => setCtab('squad')}>{t('club.tabSquad')}</button>
        <button className={ctab === 'story' ? 'active' : ''} onClick={() => setCtab('story')}>{t('club.tabHistory')}</button>
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
        <div className="meta">{t('club.cityLine', { city: club.city, country: nationByCode(club.country)?.name ?? club.country, league: league?.name ?? '' })}</div>
        <div className="meta">{t('club.stadiumLine', { stadium: club.stadium, capacity: club.capacity.toLocaleString() })}</div>
        <div className="meta">{t('club.headCoach', { name: club.id === game.userClubId ? game.managerName : club.coach ?? t('club.vacant') })}</div>
        {/* F23: how this dugout wants the game played. Yours is not listed here
            because yours is the four sliders on the tactics screen. */}
        {(() => {
          const ph = philosophyOf(club)
          if (!ph || club.id === game.userClubId) return null
          return (
            <div className="meta">
              📋 {t(ph.name)} <span className="muted">({dialLine(club.tactic)})</span>
            </div>
          )
        })()}
        {/* the dugout's character (pillar 2): countering is a system you can
            plan against, not a hidden tax - so the scouting says who reads
            whom before you pick a game plan */}
        {club.id !== game.userClubId && (() => {
          const arch = archetypeOf(club.id, club.rep)
          const word = t(arch === 'analyst' ? 'club.archAnalystDesc'
            : arch === 'reactive' ? 'club.archTinkererDesc' : 'club.archBelieverDesc')
          return (
            <div className="meta">
              🧠 <b>{t(arch === 'analyst' ? 'club.archAnalyst' : arch === 'reactive' ? 'club.archTinkerer' : 'club.archBeliever')}</b>: {word}
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
              <div className="fact-label">{t('club.honoursBoard')}</div>
              {Object.entries(byComp).map(([compId, years]) => (
                <div key={compId} className="meta">
                  {game.comps[compId]?.name ?? compId} × {years.length} <span className="muted">({years.map(y => `${y}-${String((y + 1) % 100).padStart(2, '0')}`).join(', ')})</span>
                </div>
              ))}
            </div>
          )
        })()}
        <div className="badge-row" style={{ marginTop: 6, flexWrap: 'wrap' }}>
          <span className="chip">{t('club.reputation')} <b>{club.rep}</b></span>
          {club.id === game.userClubId && (() => {
            const m = game.fanMood ?? 60
            const word = t(m >= 80 ? 'club.fanBouncing' : m >= 62 ? 'club.fanBehind' : m >= 45 ? 'club.fanWatching' : m >= 30 ? 'club.fanRestless' : 'club.fanMutinous')
            return <span className="chip" style={{ color: m >= 62 ? 'var(--text-positive)' : m <= 30 ? 'var(--text-negative)' : undefined }}>{t('club.fans')} <b>{word}</b></span>
          })()}
          <span className="chip">{t('club.squad')} <b>{players.length}</b></span>
          <span className="chip">{t('club.squadValue')} <b>{fmtMoney(squadValue(game, club.id))}</b></span>
          {club.id !== game.userClubId && (() => {
            const rec = game.vsBook?.[club.id]
            if (!rec || rec.w + rec.d + rec.l === 0) return null
            return <>
              <span className="chip">{t('club.yourRecord')} <b style={{ color: rec.w > rec.l ? 'var(--text-positive)' : rec.w < rec.l ? 'var(--text-negative)' : undefined }}>{t('club.record', { w: rec.w, d: rec.d, l: rec.l })}</b></span>
              {Math.abs(rec.run ?? 0) >= 3 && (
                <span className="chip" style={{ color: (rec.run ?? 0) > 0 ? 'var(--text-positive)' : 'var(--text-negative)' }}>
                  {(rec.run ?? 0) > 0 ? t('club.wonLast', { n: rec.run ?? 0 }) : t('club.lostLast', { n: -(rec.run ?? 0) })}
                </span>
              )}
            </>
          })()}
          {players[0] && (() => {
            const stars = starPlayerIds(game, club.id)
            const star = players.find(p => stars.has(p.id))
            return star ? <span className="chip">{t('club.star')} <b>{star.name}</b></span> : null
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
            <SectionTitle sub={t(club.id === game.userClubId ? 'club.yourEra' : 'club.recordBook')}>{t('club.storySoFar')}</SectionTitle>
            <div className="card">
              <div className="meta" style={{ padding: '2px 0' }}>
                {t('club.storyStadium', { stadium: club.stadium, city: club.city, capacity: club.capacity.toLocaleString() })}
              </div>
              <div className="meta" style={{ padding: '2px 0' }}>
                {t('club.storyLeague', { league: league?.name ?? t('club.noLeague'), rep: club.rep })}
              </div>
              {capped > 0 && (
                <div className="meta" style={{ padding: '2px 0' }}>
                  {t(capped === 1 ? 'club.cappedOne' : 'club.cappedMany', { n: capped })}
                </div>
              )}
              {rec && (
                <div className="meta" style={{ padding: '2px 0' }}>
                  {t(rec.m === 1 ? 'club.mgrRecordOne' : 'club.mgrRecord', { name: game.managerName, m: rec.m, w: rec.w, d: rec.d, l: rec.l })}
                  {rec.trophies.length ? t(rec.trophies.length === 1 ? 'club.mgrTrophyOne' : 'club.mgrTrophies', { n: rec.trophies.length }) : ''}
                </div>
              )}
              <div className="meta" style={{ padding: '2px 0' }}>
                {seasons ? t(seasons === 1 ? 'club.titleWon' : 'club.titlesWon', { n: seasons }) : t('club.noSilverware')}
              </div>
              <div className="meta" style={{ marginTop: 6, color: 'var(--text-muted)' }}>
                {t('club.legendsNote')}
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
            <SectionTitle sub={t('club.clubLegendsSub')}>{t('club.clubLegends')}</SectionTitle>
            <div className="tblwrap"><table className="dtable">
              <thead><tr><th>{t('squad.colName')}</th><th className="num">{t('club.colApps')}</th><th className="num">{t('club.colTries')}</th><th className="num">{t('squad.colPts')}</th></tr></thead>
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
          <SectionTitle>{t('club.honoursEra')}</SectionTitle>
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
        const verdict = t(avg >= 7.5 ? 'club.roomBouncing'
          : avg >= 6 ? 'club.roomSettled'
          : avg >= 4.5 ? 'club.roomUneasy'
          : 'club.roomMutinous')
        const rows = seniors.map(p => {
          const why: string[] = []
          if (committed.has(p.id)) why.push(t('club.whySignedElsewhere'))
          if ((p.wantsDeal ?? 0) > 0) why.push(t('club.whyWantsDeal'))
          if (pledged.has(p.id) && !committed.has(p.id)) why.push(t('club.whyPromise'))
          if (p.transferListed) why.push(t('club.whyListed'))
          if (p.contractEnds <= game.season) why.push(t('club.whyExpiring'))
          if (game.week >= 10 && p.stats.apps <= 2 && !p.injury) why.push(t('club.whyMinutes'))
          if (!why.length && p.morale <= 4) why.push(t('club.whyFlat'))
          // `expiring` is matched on the KEY rather than on the rendered words:
          // the filter below decides who is shown, so it cannot depend on the
          // language the screen happens to be in
          return { p, why, expiringOnly: why.length === 1 && p.contractEnds <= game.season }
        }).filter(r => r.why.length && (r.p.morale <= 6.5 || !r.expiringOnly))
          .sort((a, b) => a.p.morale - b.p.morale)
          .slice(0, 8)
        return (
          <>
            <SectionTitle sub={t('club.dressingRoomSub')}>{t('club.dressingRoom')}</SectionTitle>
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
              {!rows.length && <div className="muted" style={{ fontSize: 12.5 }}>{t('club.nobodyAgitating')}</div>}
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
            <SectionTitle sub={t('club.eraRecordsSub')}>{t('club.eraRecords')}</SectionTitle>
            <div className="card">
              {legend && (
                <div className="meta" style={{ padding: '3px 0', color: 'var(--info)', fontWeight: 700 }}>
                  {t('club.clubLegendVote')}
                </div>
              )}
              {gate && (
                <div className="meta" style={{ padding: '3px 0' }}>
                  {t('club.recordGate')} <b>{gate.att.toLocaleString()}</b>{t('club.vsClub', { club: game.clubs[gate.oppId]?.short ?? gate.oppId })}
                  {' '}<span className="muted">({2025 + gate.season}-{String((gate.season + 26) % 100).padStart(2, '0')})</span>
                </div>
              )}
              {tots && (
                <div className="meta" style={{ padding: '3px 0' }}>
                  {t('club.tryOfSeason')} <b>{tots.name}</b>, {tots.min}&apos;{t('club.vsClub', { club: tots.opp })}
                </div>
              )}
              {derbies.map(([cid, r]) => (
                <div key={cid} className="meta" style={{ padding: '3px 0' }}>
                  {t('club.derbyLine', { club: game.clubs[cid]?.short ?? cid })} <b style={{ color: r.w > r.l ? 'var(--text-positive)' : r.w < r.l ? 'var(--text-negative)' : undefined }}>{t('club.record', { w: r.w, d: r.d, l: r.l })}</b>
                  {r.w > r.l ? <span className="muted">{t('club.braggingHeld')}</span> : r.w < r.l ? <span className="muted">{t('club.whipHand')}</span> : null}
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
                  <SectionTitle sub={t('club.riftsSub')}>{t('club.rifts')}</SectionTitle>
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
                            {t('club.riftLine', { week: f.week })}
                          </div>
                          <div className="btn-row" style={{ marginTop: 5 }}>
                            <button className="btn gold tiny" disabled={asked}
                              title={t(asked ? 'club.askedAlready' : 'club.shutTheDoor')}
                              onClick={() => {
                                const rng = mulberry32(game.seed ^ (f.a * 31 + f.b * 17 + game.week * 7))
                                setRiftMsg(reconcileFeud(game, i, rng).msg)
                                touch()
                              }}>
                              {t('club.getThemInARoom')}
                            </button>
                            <span className="meta" style={{ alignSelf: 'center' }}>
                              {asked ? t('club.askedThisWeek') : t('club.shakeOnIt', { pct })}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                    {riftMsg && <div className="meta sheet-log" style={{ marginTop: 6 }}>{riftMsg}</div>}
                    <div className="meta" style={{ marginTop: 6 }}>
                      {t('club.riftNote')}
                    </div>
                  </div>
                </>
              )
            })()}
            {(feuds.length > 0 || duos.length > 0) && (
              <SectionTitle sub={t('club.feudsSub')}>{t('club.feuds')}</SectionTitle>
            )}
            <div className="card" style={feuds.length || duos.length ? undefined : { display: 'none' }}>
              {feuds.map((g, i) => {
                const opp = g.a === club.id ? g.b : g.a
                return (
                  <div key={`f${i}`} className="meta" style={{ padding: '3px 0' }}>
                    🔥 <b>{game.clubs[opp]?.short ?? opp}</b> - {g.reason} <span className="muted">{t('club.feudRuns', { years: `${2025 + g.until}-${String((g.until + 26) % 100).padStart(2, '0')}` })}</span>
                  </div>
                )
              })}
              {duos.map((d, i) => (
                <div key={`d${i}`} className="meta" style={{ padding: '3px 0' }}>
                  🤝 <b>{surname(d.a.name)} & {surname(d.b.name)}</b> - {t('club.duoLine', { n: d.g, tier: chemTier(d.g) })}
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
      <SectionTitle sub={t('club.squadSub')}>{t('club.tabSquad')}</SectionTitle>
      <div className="tab-bar">
        <button className={sqTab === 'first' ? 'active' : ''} onClick={() => setSqTab('first')}>{t('club.firstTeam', { n: firsts.length })}</button>
        <button className={sqTab === 'acad' ? 'active' : ''} onClick={() => setSqTab('acad')}>{t('club.academy', { n: acads.length })}</button>
      </div>
      {shown.length === 0 && <div className="muted" style={{ padding: '4px 16px 10px' }}>{t('club.nobodyOnBooks')}</div>}
      <div className="tblwrap"><table className="dtable">
        <thead><tr><th>{t('squad.colPos')}</th><th>{t('squad.colName')}</th><th>{t('squad.colAge')}</th><th>{t('squad.colNat')}</th><th>{t('transfers.colAbility')}</th><th>{t('transfers.colForm')}</th><th className="num">{t('squad.colValue')}</th></tr></thead>
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
