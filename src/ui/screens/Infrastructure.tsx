import { useState } from 'react'
import { useStore } from '../../store'
import {
  FACILITY_INFO, MAX_FACILITY, demandCeiling, estateGrade, facilityCost, fmtMoney,
  type Club, type FacilityId,
} from '../../game/model'
import { expansionPlan, requestExpansion, requestFacility } from '../../game/season'
import { SectionTitle } from '../components'
import { ord as ordUI, t } from '../../game/i18n'

/** What each level actually buys, in the manager's language. */
const EFFECT: Record<FacilityId, (lvl: number) => string> = {
  pitch: l => t('world.fxPitch', { pct: (l * 3.5).toFixed(1) }),
  gym: l => t('world.fxGym', { n: (l * 0.9).toFixed(1) }),
  recovery: l => t('world.fxRecovery', { pct: l * 3 }),
  paddock: l => t('world.fxPaddock', { pct: l * 20 }),
  kicking: l => t('world.fxKicking', { pct: (l * 0.5).toFixed(1) }),
  briefing: l => t('world.fxBriefing', { pct: l * 15 }),
  academy: l => t('world.fxAcademy', { pct: (l * 1.2).toFixed(1) }),
  shop: l => t('world.fxShop', { amount: fmtMoney(Math.round(l * 9_000 * 1.2)) }),
  hospitality: l => t('world.fxHospitality', { pct: l * 4 }),
}

const pips = (lvl: number) => '●'.repeat(lvl) + '○'.repeat(MAX_FACILITY - lvl)

/**
 * The Club Infrastructure page (user request): the ground and every facility
 * on one screen, with the boardroom request for each sitting right next to it.
 */
export default function Infrastructure() {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  // KEYED TO THE CARD THAT ASKED, for the reason spelled out in Training.tsx:
  // a single banner at the top of the page is where a board's answer goes to
  // die on a phone. The estate header is always the first thing on screen so
  // the expansion reply is fine there; a facility five cards down is not, and
  // its "the reserves will not carry a build this size" was rendering out of
  // sight while the button under the thumb did nothing visible.
  const [msg, setMsg] = useState<{ key: string; text: string } | null>(null)
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
  // ordUI, because ordinals are a language rather than a suffix (i18n.ts)
  const ord = ordUI(rank)

  return (
    <>
      <div className="tab-bar">
        <button className={itab === 'ours' ? 'active' : ''} onClick={() => setItab('ours')}>{t('world.infOurEstate')}</button>
        <button className={itab === 'league' ? 'active' : ''} onClick={() => setItab('league')}>{t('world.infTheLeague')}</button>
      </div>
      <div className="card" style={{ borderLeft: '4px solid var(--gold)', padding: '8px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ fontSize: 15, margin: 0 }}>🏟️ {club.stadium}</h3>
            <div className="meta">
              {t('world.infSeats', { n: club.capacity.toLocaleString() })}
              {plan.played >= 1 && t('world.infAvgGate', { avg: plan.avg.toLocaleString(), pct: Math.round(plan.fill * 100) })}
            </div>
            {/* the board will not build seats it cannot sell, so say out loud
                how many this club could shift on its name alone */}
            <div className="meta" style={{ fontSize: 11 }}>
              {t('world.infCatchment', {
                n: demandCeiling(club).toLocaleString(),
                rest: club.capacity >= demandCeiling(club) * 0.95
                  ? t('world.infHoldsAll')
                  : t('world.infMoreThanHolds', { n: (demandCeiling(club) - club.capacity).toLocaleString() }),
              })}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="fact-label">{t('world.infEstate')}</div>
            <div style={{ fontWeight: 700, color: 'var(--gold)' }}>{t(grade.label)}</div>
            <div className="meta" style={{ fontSize: 11 }}>{t('world.infRankLine', { sum: grade.sum, max: grade.max, ord, n: peers.length })}</div>
          </div>
          <button className="btn gold" style={{ padding: '5px 10px', fontSize: 11.5, lineHeight: 1.25 }}
            disabled={club.capacity >= 82_000 || club.capacity >= demandCeiling(club) * 0.95 || game.facilityBuild != null}
            onClick={() => { setMsg({ key: 'expand', text: requestExpansion(game) }); touch() }}>
            {t('world.infAskExpand')}<br />
            <span style={{ fontSize: 10, fontWeight: 600 }}>{t('world.infSeatsCost', { seats: plan.seats.toLocaleString(), cost: fmtMoney(plan.cost) })}</span>
          </button>
        </div>
        {msg?.key === 'expand' && (
          <div className="meta" style={{ fontSize: 11.5, fontWeight: 600, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
            {msg.text}
          </div>
        )}
      </div>

      {itab === 'ours' && <>
      <SectionTitle sub={t('world.infFacilitiesSub')}>{t('world.infFacilities')}</SectionTitle>
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
                    {info.icon} {t(info.name)} <span style={{ color: 'var(--gold)', letterSpacing: 1 }}>{pips(lvl)}</span>
                  </h3>
                  <div className="meta" style={{ fontSize: 11 }}>{t(info.desc)}</div>
                  <div className="meta" style={{ fontSize: 11, fontWeight: 700 }}>
                    {lvl === 0 ? t('world.infNothing') : t('world.infLevelIs', { n: lvl, effect: EFFECT[fid](lvl) })}
                  </div>
                  {building && <div className="meta" style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700 }}>{t(weeksLeft === 1 ? 'world.infBuildersOne' : 'world.infBuilders', { n: weeksLeft })}</div>}
                </div>
                {!building && lvl < MAX_FACILITY && (
                  <button className="btn gold" style={{ padding: '5px 9px', fontSize: 11, lineHeight: 1.25, flexShrink: 0 }}
                    disabled={game.facilityBuild != null}
                    onClick={() => { setMsg({ key: fid, text: requestFacility(game, fid) }); touch() }}>
                    {t('world.infAskBoard')}<br />
                    <span style={{ fontSize: 10, fontWeight: 600 }}>{t('world.infLevelCost', { n: lvl + 1, cost: fmtMoney(cost) })}</span>
                  </button>
                )}
                {lvl >= MAX_FACILITY && <span className="meta" style={{ flexShrink: 0, color: 'var(--gold)', fontWeight: 700 }}>{t('world.infWorldClass')}</span>}
              </div>
              {msg?.key === fid && (
                <div className="meta" style={{ fontSize: 11.5, fontWeight: 600, marginTop: 4, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
                  {msg.text}
                </div>
              )}
            </div>
          )
        })}
      </div>

      </>}
      {itab === 'league' && <>
      <SectionTitle sub={t('world.infLeagueEstatesSub')}>{t('world.infLeagueEstates')}</SectionTitle>
      <div className="tblwrap"><table className="dtable">
        <thead><tr><th>{t('world.infColClub')}</th><th className="num">{t('world.infColEstate')}</th><th>{t('world.infColVerdict')}</th><th className="num">{t('world.infColGround')}</th></tr></thead>
        <tbody>
          {ranked.map(c => {
            const g2 = estateGrade(c)
            return (
              <tr key={c.id} style={c.id === club.id ? { background: 'color-mix(in srgb, var(--gold) 12%, transparent)' } : undefined}>
                <td className="name">{c.short}</td>
                <td className="num">{g2.sum}/{g2.max}</td>
                <td className="muted">{t(g2.label)}</td>
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
