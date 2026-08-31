import { Fragment, useState } from 'react'
import { useStore } from '../../store'
import { POS_ORDER, weekDate, type Pos } from '../../game/model'
import { flagOf, nationByCode, nationName } from '../../game/nations'
import { natRankOrder } from '../../game/natrank'
import { natFixtureThisWeek } from '../../game/season'
import { NAT_SQUAD_SIZE } from '../../game/nations'
import { NAT_SQUAD_FLOOR, natCallUp, natDrop, natEligible, natWindow, weeksToSquad } from '../../game/country'
import { ClubLink, PosBadge, SectionTitle } from '../components'
import FullFitness from '../FullFitness'
import { ord, posName, t } from '../../game/i18n'

const FWD = ['LP', 'HK', 'TP', 'LK', 'FL', 'N8']

/** The country desk: club and country side by side (user: "we may need to
 *  get creative and maybe a new menu appears or something with both club and
 *  country?"). One screen holds the Test job: the ranking, the union's
 *  confidence, your Test record, the window squad you can actually shape,
 *  the calendar - and the door out of either job, in plain sight. */
export default function Country() {
  const game = useStore(s => s.game)!
  const go = useStore(s => s.go)
  const { resign, resignNat, persist } = useStore.getState()
  const bump = useStore(s => s.tick)
  void bump
  const [msg, setMsg] = useState<{ key: number | string; text: string } | null>(null)
  const [confirmClub, setConfirmClub] = useState(false)
  const [confirmNat, setConfirmNat] = useState(false)
  const [, redraw] = useState(0)
  // FM'S ONE AFFORDANCE (owner: "simplify/work on the call up/drop stage - see
  // how fm do it"): you never scroll a national pool, you filter it to the
  // shirt you are short of. England's qualified population is two thousand
  // names, so an unfiltered "next men in" list was not a shortlist, it was a
  // census.
  const [posFilter, setPosFilter] = useState<Pos | 'ALL'>('ALL')

  const natId = game.natTeam
  if (!natId) {
    // stepped down (or sacked) with the screen open - nothing to run here
    return (
      <div className="card">
        <h3 style={{ fontSize: 15 }}>{t('legacy.coNoJob')}</h3>
        <div className="meta">{t('legacy.coNoJobBody')}</div>
      </div>
    )
  }

  const nat = nationByCode(natId)
  const order = natRankOrder(game)
  const rank = order.indexOf(natId) + 1
  const conf = game.natConfidence != null ? Math.round(game.natConfidence) : null
  const rec = game.natRecord
  const club = game.unemployed ? null : game.clubs[game.userClubId]
  const w = natWindow(game)
  const squad = (game.natSquads[natId] ?? []).map(id => game.players[id]).filter(Boolean)
  // ---- THE COACHES' PICKS, AT THE TOP ----
  //
  // Owner, v1.1.17: "Showing who is available with recommended/in form at top."
  //
  // natEligible ranks on ability alone, which is the honest ranking of who is
  // BEST and not of who you would pick this month. A selection meeting looks at
  // the man in form as hard as it looks at the man on paper, so the desk sorts
  // on both: ability, plus what he has actually been doing. Form runs 1-10 and
  // sits around 5, so the lift is worth a handful of ability points either way -
  // enough to move a man up the page, never enough to put a journeyman above a
  // Lion.
  const recommend = (p: { ca: number; form: number }) => p.ca + (p.form - 5) * 2.2
  const pool = [...natEligible(game)].sort((a, b) => recommend(b) - recommend(a))
  // IN FORM is a fact about the man, not about the sort: it is called out on
  // the row so the reason he has climbed is visible rather than implied.
  const inForm = (p: { form: number }) => p.form >= 7
  const testFx = natFixtureThisWeek(game)
  const upcoming = game.fixtures
    .filter(f => !f.played && (f.homeId === natId || f.awayId === natId))
    .sort((a, b) => a.week - b.week).slice(0, 4)
  const results = game.fixtures
    .filter(f => f.played && (f.homeId === natId || f.awayId === natId) &&
      !game.clubs[f.homeId] && !game.clubs[f.awayId])
    .sort((a, b) => b.week - a.week).slice(0, 5)

  const act = (p: { id: number; name: string }, fn: (g: typeof game, id: number) => string | null) => {
    const refusal = fn(game, p.id)
    setMsg({ key: p.id, text: refusal ?? '' })
    if (!refusal) void persist()
    redraw(n => n + 1)
  }

  const row = (p: NonNullable<(typeof squad)[number]>, inSquad: boolean) => (
    <tr key={p.id} onClick={() => go('player', p.id)}>
      <td style={{ width: 34 }}><PosBadge pos={p.pos} /></td>
      <td className="name" style={p.clubId === game.userClubId ? { fontWeight: 800 } : undefined}>
        {p.name}{(p.caps ?? 0) > 0 ? <span className="muted">{t('legacy.coCaps', { n: p.caps ?? 0 })}</span> : <span className="muted">{t('legacy.coUncapped')}</span>}
        {/* the reason he is near the top, said out loud rather than implied by
            the sort order (owner: "recommended/in form at top") */}
        {!inSquad && inForm(p) && <span style={{ color: 'var(--text-positive)', fontWeight: 700 }}> {t('legacy.coInForm')}</span>}
      </td>
      <td className="muted">{p.clubId ? <ClubLink g={game} clubId={p.clubId} /> : ''}</td>
      <td style={{ width: 64, textAlign: 'right' }}>
        {w && (
          <button className="btn ghost" style={{ fontSize: 12, padding: '6px 10px', color: inSquad ? 'var(--text-negative)' : 'var(--text-positive)' }}
            onClick={e => { e.stopPropagation(); act(p, inSquad ? natDrop : natCallUp) }}>
            {t(inSquad ? 'legacy.coDrop' : 'legacy.coCallUp')}
          </button>
        )}
      </td>
    </tr>
  )

  const table = (list: typeof squad, inSquad: boolean) => (
    <div className="tblwrap"><table className="dtable"><tbody>
      {list.map(p => (
        <Fragment key={p.id}>
          {row(p, inSquad)}
          {msg?.key === p.id && msg.text && (
            <tr><td colSpan={4} className="meta" style={{ color: 'var(--text-negative)', paddingTop: 0 }}>{msg.text}</td></tr>
          )}
        </Fragment>
      ))}
    </tbody></table></div>
  )

  return (
    <>
      <div className="card" style={{ borderLeft: '4px solid var(--text-positive)' }}>
        <h3 style={{ fontSize: 17 }}>{flagOf(natId)} {nationName(natId)}</h3>
        <div className="meta" style={{ marginTop: 2 }}>
          {t('legacy.coRankLine', {
            rank: rank > 0 ? t('legacy.coWorldNo', { n: rank }) : t('legacy.coUnranked'),
            pts: (game.natRank?.[natId] ?? 0).toFixed(2),
            rec: rec ? t('legacy.coTestsUnder', { w: rec.w, d: rec.d, l: rec.l }) : '',
          })}
        </div>
        {conf != null && (
          <div style={{ margin: '8px 2px 2px' }}>
            <div style={{ height: 8, background: 'var(--border-strong)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${conf}%`, height: '100%', background: conf >= 60 ? 'var(--text-positive)' : conf >= 40 ? 'var(--gold)' : 'var(--danger)' }} />
            </div>
            <div className="meta" style={{ marginTop: 4 }}>
              {t('legacy.coUnionConf', { n: conf })}
            </div>
          </div>
        )}
        {testFx && (
          <div className="muted" style={{ marginTop: 8, fontWeight: 700 }}>
            {t('legacy.coTestWeek', {
              home: nationName(testFx.homeId),
              away: nationName(testFx.awayId),
            })}
          </div>
        )}
      </div>

      {/* both hats, and the way out of either - in the open, not buried
          (user: "OR you can step down from your club role") */}
      <div className="card">
        <SectionTitle sub={t('legacy.coAppointmentsSub')}>{t('legacy.coAppointments')}</SectionTitle>
        {club && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
            <span style={{ fontSize: 20 }}>🏟️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{club.name}</div>
              <div className="meta">{t('legacy.coDirectorBoard', { n: Math.round(club.boardConfidence) })}</div>
            </div>
            {confirmClub
              ? <button className="btn danger" style={{ fontSize: 12 }} onClick={() => { resign(); setConfirmClub(false) }}>{t('legacy.coConfirm')}</button>
              : <button className="btn ghost" style={{ fontSize: 12, color: 'var(--text-negative)' }} onClick={() => { setConfirmClub(true); setConfirmNat(false) }}>{t('legacy.coStepDown')}</button>}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
          <span style={{ fontSize: 20 }}>{flagOf(natId) || '🌍'}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>{nationName(natId)}</div>
            <div className="meta">{t('legacy.coNatCoach')}{conf != null ? t('legacy.coNatUnion', { n: conf }) : ''}</div>
          </div>
          {confirmNat
            ? <button className="btn danger" style={{ fontSize: 12 }} onClick={() => { resignNat(); setConfirmNat(false); go('home') }}>{t('legacy.coConfirm')}</button>
            : <button className="btn ghost" style={{ fontSize: 12, color: 'var(--text-negative)' }} onClick={() => { setConfirmNat(true); setConfirmClub(false) }}>{t('legacy.coStepDown')}</button>}
        </div>
        {!club && <div className="meta">{t('legacy.coNoClubPost')}</div>}
      </div>

      {/* The Thursday of a Test week is the other moment a manager wants a fit
          squad and cannot get to the shop. Same card, same rules - silent
          where there is no till and where nobody is hurt. */}
      <FullFitness compact />

      {w ? (
        <>
          <SectionTitle sub={t('legacy.coSquadSub', { max: w.size, floor: NAT_SQUAD_FLOOR })}>
            {t('legacy.coTestSquad', { n: squad.length, max: w.size })}
          </SectionTitle>
          {/* ---- THE SUMMONS ----
              Owner, v1.1.17: "the game stopping and asking the international
              coach to select his squad... It needs to be more obvious."
              The sheet starts blank and Continue is held until it is legal, so
              the desk has to say what is owed and offer a way through that is
              still a decision. The suggestion fills the sheet with the coaches'
              own order - the same recommendation the pool is sorted by - and he
              is free to tear it up: naming it in one tap is a choice he makes,
              which is not the same as it being made for him. */}
          {squad.length < NAT_SQUAD_FLOOR ? (
            <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
              <b>{t('legacy.coNameIt', { n: NAT_SQUAD_FLOOR - squad.length })}</b>
              <div className="meta" style={{ marginTop: 2 }}>{t('legacy.coNameItSub', { floor: NAT_SQUAD_FLOOR, max: w.size })}</div>
              <button className="btn gold block" style={{ marginTop: 8 }}
                onClick={() => {
                  for (const p of pool) {
                    if ((game.natSquads[natId] ?? []).length >= w.size) break
                    natCallUp(game, p.id)
                  }
                  void persist()
                  redraw(n => n + 1)
                }}>
                {t('legacy.coTakeSuggestion')}
              </button>
            </div>
          ) : (
            <div className="meta" style={{ padding: '0 16px 4px' }}>
              {t('legacy.coWindowOpen')}
            </div>
          )}
          {/* THE SHAPE OF THE SQUAD, BEFORE THE NAMES.
              A coach picking a party of 32 is not reading a list, he is
              counting shirts - two hookers is a crisis and four is a waste,
              and nothing on this screen said either. Each cell is a tap that
              filters the pool below to that shirt, so seeing a hole and
              filling it is one gesture rather than a scroll through two
              thousand qualified names. */}
          <SectionTitle sub={t('legacy.coShapeSub')}>{t('legacy.coShape')}</SectionTitle>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: '0 14px 8px' }}>
            <button className="chip" onClick={() => setPosFilter('ALL')}
              style={{ fontWeight: posFilter === 'ALL' ? 800 : 600, borderColor: posFilter === 'ALL' ? 'var(--gold)' : undefined }}>
              {t('legacy.coFilterAll')}
            </button>
            {POS_ORDER.map(pos => {
              const n = squad.filter(p => p.pos === pos).length
              // two men in a shirt is one injury from a crisis: the coach
              // should see it without counting
              const thin = n < 2
              return (
                <button key={pos} className="chip" onClick={() => setPosFilter(posFilter === pos ? 'ALL' : pos)}
                  title={thin ? t('legacy.coThin', { pos: posName(pos) }) : undefined}
                  style={{
                    fontWeight: posFilter === pos ? 800 : 600,
                    borderColor: posFilter === pos ? 'var(--gold)' : thin ? 'var(--text-negative)' : undefined,
                    color: thin ? 'var(--text-negative)' : undefined,
                  }}>
                  {pos} {n}
                </button>
              )
            })}
          </div>
          <SectionTitle>{t('legacy.coForwards')}</SectionTitle>
          {table(squad.filter(p => FWD.includes(p.pos) && (posFilter === 'ALL' || p.pos === posFilter)), true)}
          <SectionTitle>{t('legacy.coBacks')}</SectionTitle>
          {table(squad.filter(p => !FWD.includes(p.pos) && (posFilter === 'ALL' || p.pos === posFilter)), true)}
          <SectionTitle sub={t('legacy.coNextMenSub')}>{t('legacy.coNextMen')}</SectionTitle>
          {(() => {
            // A SHORTLIST, NOT A CENSUS. The qualified population is every
            // player of the nation in the game - two thousand of them for
            // England - and the old screen rendered all of it. Twenty of the
            // best, in the shirt you asked for, is what a selection meeting
            // actually looks at.
            const shown = pool.filter(p => posFilter === 'ALL' || p.pos === posFilter)
            const top = shown.slice(0, 20)
            if (!top.length) return <div className="meta" style={{ padding: '0 16px' }}>{t('legacy.coNobodyLeft')}</div>
            return (
              <>
                <div className="meta" style={{ padding: '0 16px 4px' }}>
                  {posFilter === 'ALL'
                    ? t('legacy.coShowingAll', { n: top.length, total: shown.length })
                    : t('legacy.coShowing', { n: top.length, pos: posName(posFilter), total: shown.length })}
                </div>
                {table(top, false)}
              </>
            )
          })()}
        </>
      ) : (
        <>
          <SectionTitle sub={t('legacy.coBetweenSub')}>{t('legacy.coBetweenWindows')}</SectionTitle>
          {/* the countdown, in the owner's own unit ("could we have days til
              squad work") - the calendar knew and never said */}
          <div className="meta" style={{ padding: '0 16px 4px' }}>
            {(() => {
              const wks = weeksToSquad(game)
              return wks == null ? t('legacy.coNoWindowLeft') : t('legacy.coCountdown', { n: Math.max(0, wks) * 7 })
            })()}
          </div>
          {table((pool.length ? pool : squad).slice(0, NAT_SQUAD_SIZE), false)}
        </>
      )}

      <SectionTitle>{t('legacy.coTests')}</SectionTitle>
      <div className="tblwrap"><table className="dtable"><tbody>
        {upcoming.map(f => (
          <tr key={f.id}>
            <td className="muted">{weekDate(game.season, f.week).slice(0, -5)}</td>
            <td className="name">{flagOf(f.homeId)} {nationName(f.homeId)} {t('common.v')} {nationName(f.awayId)} {flagOf(f.awayId)}</td>
            <td className="num muted">-</td>
          </tr>
        ))}
        {results.map(f => {
          const us = f.homeId === natId ? f.homeScore : f.awayScore
          const them = f.homeId === natId ? f.awayScore : f.homeScore
          return (
            <tr key={f.id}>
              <td className="muted">{weekDate(game.season, f.week).slice(0, -5)}</td>
              <td className="name">{flagOf(f.homeId)} {nationName(f.homeId)} {t('common.v')} {nationName(f.awayId)} {flagOf(f.awayId)}</td>
              <td className="num" style={{ fontWeight: 700, color: us > them ? 'var(--text-positive)' : us < them ? 'var(--text-negative)' : undefined }}>
                {f.homeScore}-{f.awayScore}
              </td>
            </tr>
          )
        })}
        {!upcoming.length && !results.length && (
          <tr><td className="meta">{t('legacy.coNoTests')}</td></tr>
        )}
      </tbody></table></div>
      <div className="meta" style={{ padding: '4px 16px', fontSize: 11.5 }}>
        {t('legacy.coFullTables')}
      </div>
      <div className="spacer" />
    </>
  )
}
