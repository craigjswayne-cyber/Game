import { useState } from 'react'
import { useStore } from '../store'
import { t } from '../game/i18n'
import { acc } from './accent'
import { NAT_SQUAD_FLOOR, natWindow } from '../game/country'
import { TOUR_ROLES, natPlanOf, tourCoachPct, type TourRole } from '../game/natcamp'
import { announceTourCaptain, announceTourParty, announceTourStaff, canAnnounceParty, partyCount, setTourCoach, tourCoaches } from '../game/isles'

/**
 * THE TOUR OFFICE (1.9.16). Owner, 21 Nov 2026: "Every announcement is a big
 * thing. This is the pinnacle of the game - make features that feel like it
 * is the only place you get this."
 *
 * The three things an Isles coach does and nobody else in the game does: he
 * borrows his assistants from the head coaches of other clubs, he names the
 * tour party from an empty sheet, and he names the tour captain. Each is
 * announced once, and each announcement takes the screen.
 */
export function TourOffice() {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const go = useStore(s => s.go)
  const { persist } = useStore.getState()
  useStore(s => s.tick)
  const [open, setOpen] = useState<TourRole | null>(null)
  const i = game.isles
  if (!i || i.season !== game.season || i.answer !== 'yes') return null
  const save = () => { void persist(); touch() }
  const st = i.staff ?? {}
  const coaches = tourCoaches(game)
  const party = game.natSquads['LIO']
  const named = party?.length ?? 0
  const size = natWindow(game)?.size ?? 32
  const count = partyCount(game)
  const plan = i.partyOut && named > 0 ? natPlanOf(game) : null
  const men = (party ?? []).map(id => game.players[id]).filter((p): p is NonNullable<typeof p> => !!p)
  const cap = plan?.captain != null ? men.find(p => p.id === plan.captain) ?? null : null
  const leaders = [...men].sort((a, b) => b.a.lea - a.a.lea || a.id - b.id).slice(0, 6)
  const staffFull = TOUR_ROLES.every(r => st[r])
  return (
    <div className="card tour-office" data-tour-office style={{ ...acc('var(--gold)') }}>
      <h3 style={{ fontSize: '1rem' }}>{t('isles.office')}</h3>
      <div className="meta" style={{ marginTop: 2 }}>{t('isles.allFiles')}</div>

      {/* 1. the coaching team */}
      <div className="fact-label" style={{ marginTop: 12 }}>{t('isles.staffTitle')}</div>
      <div className="meta" style={{ margin: '3px 0 4px' }}>{i.staffOut ? t('isles.staffDone') : t('isles.staffSub')}</div>
      {TOUR_ROLES.map(role => {
        const club = st[role] ? game.clubs[st[role]!] : null
        return (
          <div key={role} data-tour-role={role}>
            <div className="to-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="to-role">{t(`isles.role_${role}`)}</div>
                {club
                  ? <div className="to-who"><b>{club.coach}</b> <span className="muted">· {club.short} · {t(`isles.roleFx_${role}`, { pct: tourCoachPct(game, club.id, role) })}</span></div>
                  : <div className="to-who muted">-</div>}
              </div>
              {!i.staffOut && (
                <button className="btn ghost to-btn" aria-expanded={open === role} onClick={() => setOpen(open === role ? null : role)}>
                  {t(club ? 'isles.change' : 'isles.choose')}
                </button>
              )}
            </div>
            {open === role && !i.staffOut && (
              <div className="to-list">
                {coaches.map(c => (
                  <button key={c.clubId} type="button" className={`to-pick${st[role] === c.clubId ? ' sel' : ''}`} data-coach={c.clubId}
                    onClick={() => { setTourCoach(game, role, c.clubId); setOpen(null); save() }}>
                    <span className="to-pn"><b>{c.name}</b> <span className="muted">· {c.club}</span></span>
                    <span className="to-px">{t(`isles.roleFx_${role}`, { pct: tourCoachPct(game, c.clubId, role) })}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
      {!i.staffOut && (
        <button className="btn gold block" data-announce="staff" disabled={!staffFull} style={{ marginTop: 8 }}
          onClick={() => { announceTourStaff(game); save() }}>{t('isles.staffAnnounce')}</button>
      )}

      {/* 2. the tour party */}
      <div className="fact-label" style={{ marginTop: 14 }}>{t('isles.partyTitle')}</div>
      <div className="meta" style={{ margin: '3px 0 6px' }}>
        {i.partyOut
          ? t('isles.partyDone', { eng: count.ENG, ire: count.IRE, sco: count.SCO, wal: count.WAL })
          : party ? t('isles.partyCount', { n: named, size, floor: NAT_SQUAD_FLOOR }) : t('isles.partyWait')}
      </div>
      {party && !i.partyOut && (
        <div className="btn-row">
          <button className="btn ghost" data-party-pick onClick={() => go('country')}>{t('isles.partyPick')}</button>
          <button className="btn gold" style={{ flex: 1.6 }} data-announce="party" disabled={!canAnnounceParty(game)}
            onClick={() => { announceTourParty(game); save() }}>{t('isles.partyAnnounce')}</button>
        </div>
      )}

      {/* 3. the tour captain */}
      <div className="fact-label" style={{ marginTop: 14 }}>{t('isles.tourCaptain')}</div>
      <div className="meta" style={{ margin: '3px 0 8px' }}>
        {i.capOut && cap ? t('isles.capDone', { player: cap.name })
          : !i.partyOut ? t('isles.capFirst')
          : cap ? t('isles.tourCaptainSet', { player: cap.name }) : t('isles.tourCaptainNone')}
      </div>
      {plan && !i.capOut && (
        <>
          <div className="cap-chips" data-tour-captain>
            {leaders.map(p => (
              <button key={p.id} type="button" className={`chip cap-chip${cap?.id === p.id ? ' sel' : ''}`} aria-pressed={cap?.id === p.id} data-cap={p.id}
                onClick={() => { plan.captain = cap?.id === p.id ? null : p.id; save() }}>
                {p.name} <span className="muted">{t('testday.lea', { n: Math.round(p.a.lea) })}</span>
              </button>
            ))}
          </div>
          <button className="btn gold block" data-announce="captain" disabled={!cap} style={{ marginTop: 8 }}
            onClick={() => { announceTourCaptain(game); save() }}>{t('isles.capAnnounce')}</button>
        </>
      )}
    </div>
  )
}
