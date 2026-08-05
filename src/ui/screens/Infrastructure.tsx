import { useState } from 'react'
import { useStore } from '../../store'
import {
  FACILITY_INFO, MAX_FACILITY, demandCeiling, estateGrade, facilityCost, fmtMoney,
  type Club, type FacilityId,
} from '../../game/model'
import { expansionPlan, requestExpansion, requestFacility } from '../../game/season'
import { SectionTitle } from '../components'

/** What each level actually buys, in the manager's language. */
const EFFECT: Record<FacilityId, (lvl: number) => string> = {
  pitch: l => `${(l * 3.5).toFixed(1)}% fewer breakdowns at home`,
  gym: l => `+${(l * 0.9).toFixed(1)} condition recovered a week`,
  recovery: l => `injuries ${l * 3}% shorter`,
  paddock: l => `training bites ${l * 20}% more often`,
  kicking: l => `+${(l * 0.5).toFixed(1)}% off the tee`,
  briefing: l => `match prep ${l * 15}% stronger`,
  academy: l => `better intakes, ${(l * 1.2).toFixed(1)}% more wonderkids`,
  shop: l => `about ${fmtMoney(Math.round(l * 9_000 * 1.2))} a week`,
}

const pips = (lvl: number) => '●'.repeat(lvl) + '○'.repeat(MAX_FACILITY - lvl)

/**
 * The Club Infrastructure page (user request): the ground and every facility
 * on one screen, with the boardroom request for each sitting right next to it.
 */
export default function Infrastructure() {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const [msg, setMsg] = useState('')
  const [itab, setItab] = useState<'ours' | 'league'>('ours')
  const club = game.clubs[game.userClubId]
  const abs = game.season * 100 + game.week
  const grade = estateGrade(club)
  const plan = expansionPlan(game)
  const ids = Object.keys(FACILITY_INFO) as FacilityId[]

  // where the estate ranks in your own league - the only comparison that stings
  const peers: Club[] = Object.values(game.clubs).filter(c => c.leagueId === club.leagueId)
  const ranked = [...peers].sort((a, b) => estateGrade(b).sum - estateGrade(a).sum)
  const rank = ranked.findIndex(c => c.id === club.id) + 1
  const ord = rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`

  return (
    <>
      <div className="tab-bar">
        <button className={itab === 'ours' ? 'active' : ''} onClick={() => setItab('ours')}>Our Estate</button>
        <button className={itab === 'league' ? 'active' : ''} onClick={() => setItab('league')}>The League</button>
      </div>
      <div className="card" style={{ borderLeft: '4px solid var(--gold)', padding: '8px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ fontSize: 15, margin: 0 }}>🏟️ {club.stadium}</h3>
            <div className="meta">
              {club.capacity.toLocaleString()} seats
              {plan.played >= 1 && ` · ${plan.avg.toLocaleString()} average gate (${Math.round(plan.fill * 100)}% full)`}
            </div>
            {/* the board will not build seats it cannot sell, so say out loud
                how many this club could shift on its name alone */}
            <div className="meta" style={{ fontSize: 11 }}>
              Catchment: about {demandCeiling(club).toLocaleString()} for a good game
              {club.capacity >= demandCeiling(club) * 0.95
                ? ' - the ground already holds everyone who would come'
                : ` - ${(demandCeiling(club) - club.capacity).toLocaleString()} more than the ground holds`}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="fact-label">Estate</div>
            <div style={{ fontWeight: 700, color: '#a8841a' }}>{grade.label}</div>
            <div className="meta" style={{ fontSize: 11 }}>{grade.sum}/{grade.max} · {ord} of {peers.length} in the league</div>
          </div>
          <button className="btn gold" style={{ padding: '5px 10px', fontSize: 11.5, lineHeight: 1.25 }}
            disabled={club.capacity >= 82_000 || club.capacity >= demandCeiling(club) * 0.95 || game.facilityBuild != null}
            onClick={() => { setMsg(requestExpansion(game)); touch() }}>
            🏛 Ask to expand<br />
            <span style={{ fontSize: 10, fontWeight: 600 }}>+{plan.seats.toLocaleString()} seats · {fmtMoney(plan.cost)}</span>
          </button>
        </div>
      </div>

      {msg && <div className="card" style={{ borderLeft: '4px solid #c9a227', padding: '7px 10px' }}>{msg}</div>}

      {itab === 'ours' && <>
      <SectionTitle sub="every upgrade goes through the boardroom">Facilities</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 6 }}>
        {ids.map(fid => {
          const info = FACILITY_INFO[fid]
          const lvl = club.facilities?.[fid] ?? 0
          const cost = facilityCost(info, lvl)
          const building = game.facilityBuild?.id === fid ? game.facilityBuild : null
          const weeksLeft = building ? Math.max(1, building.done - abs) : 0
          return (
            <div className="card" key={fid} style={{ margin: 0, padding: '8px 10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontSize: 13.5, margin: 0 }}>
                    {info.icon} {info.name} <span style={{ color: '#a8841a', letterSpacing: 1 }}>{pips(lvl)}</span>
                  </h3>
                  <div className="meta" style={{ fontSize: 11 }}>{info.desc}</div>
                  <div className="meta" style={{ fontSize: 11, fontWeight: 700 }}>
                    {lvl === 0 ? 'Nothing to speak of' : `Level ${lvl}: ${EFFECT[fid](lvl)}`}
                  </div>
                  {building && <div className="meta" style={{ fontSize: 11, color: '#a8841a', fontWeight: 700 }}>🏗 Builders on site - opens in about {weeksLeft} week{weeksLeft === 1 ? '' : 's'}</div>}
                </div>
                {!building && lvl < MAX_FACILITY && (
                  <button className="btn gold" style={{ padding: '5px 9px', fontSize: 11, lineHeight: 1.25, flexShrink: 0 }}
                    disabled={game.facilityBuild != null}
                    onClick={() => { setMsg(requestFacility(game, fid)); touch() }}>
                    🏛 Ask board<br />
                    <span style={{ fontSize: 10, fontWeight: 600 }}>L{lvl + 1} · {fmtMoney(cost)}</span>
                  </button>
                )}
                {lvl >= MAX_FACILITY && <span className="meta" style={{ flexShrink: 0, color: '#a8841a', fontWeight: 700 }}>World class</span>}
              </div>
            </div>
          )
        })}
      </div>

      </>}
      {itab === 'league' && <>
      <SectionTitle sub="what the rest of the league has built">League Estates</SectionTitle>
      <div className="tblwrap"><table className="dtable">
        <thead><tr><th>Club</th><th className="num">Estate</th><th>Verdict</th><th className="num">Ground</th></tr></thead>
        <tbody>
          {ranked.map(c => {
            const g2 = estateGrade(c)
            return (
              <tr key={c.id} style={c.id === club.id ? { background: 'color-mix(in srgb, var(--gold) 12%, transparent)' } : undefined}>
                <td className="name">{c.short}</td>
                <td className="num">{g2.sum}/{g2.max}</td>
                <td className="muted">{g2.label}</td>
                <td className="num">{c.capacity.toLocaleString()}</td>
              </tr>
            )
          })}
        </tbody>
      </table></div>
      </>}
      <div className="spacer" />
    </>
  )
}
