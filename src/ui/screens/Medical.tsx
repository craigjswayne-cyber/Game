import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import { fmtMoney, inRedZone, type Player } from '../../game/model'
import { SPECIALIST_FEE, cottonWool, specialistConsult } from '../../game/medical'
import { canPhysioFavour } from '../../game/rewarded'
import { rewardedAvailable, showRewarded } from '../../game/monetise'
import { badgeLabel } from '../../game/staff'
import { PosBadge, SectionTitle } from '../components'
import FullFitness from '../FullFitness'
import { t } from '../../game/i18n'

/** The Medical Centre: who's out, who's rusty, who's running on fumes. */
export default function Medical() {
  const game = useStore(s => s.game)!
  const go = useStore(s => s.go)
  const touch = useStore.getState().touch
  const rewardPhysio = useStore(s => s.rewardPhysio)
  // KEYED TO THE MAN, not to the page. A specialist consult on the eighth name
  // in a long treatment room used to answer in a banner at the top of the
  // screen - the same class of bug the coach market had, where the reply to
  // your tap renders somewhere you are not looking and the button reads as
  // dead. The line now lands in his own row.
  const [msg, setMsg] = useState<{ id: number; text: string } | null>(null)
  const [query, setQuery] = useState('')
  const club = game.clubs[game.userClubId]
  const q = query.trim().toLowerCase()
  const squad = club.players.map(id => game.players[id]).filter((p): p is Player => !!p)
    .filter(p => !q || p.name.toLowerCase().includes(q) || p.pos.toLowerCase() === q)

  const injured = squad.filter(p => p.injury).sort((a, b) => (a.injury!.until) - (b.injury!.until))
  const rusty = squad.filter(p => !p.injury && (p.rust ?? 0) > 0)
  const banned = squad.filter(p => p.bans > 0)
  const tired = squad.filter(p => !p.injury && p.cond < 62).sort((a, b) => a.cond - b.cond)
  const loaded = squad.filter(p => !p.injury && inRedZone(p)).sort((a, b) => b.stats.mins - a.stats.mins)
  const away = squad.filter(p => p.natSquad || p.onLoan)

  // Standing on this page IS reading the notification (13E), so the rail badge
  // clears here rather than counting injured men forever. Not filtered by the
  // search box: the badge is about the treatment room, not about whatever is
  // currently typed into it.
  // Runs once per visit, not once per render. Written without a dependency array
  // first, which self-terminated only because the second pass found nothing fresh
  // to mark - the next person to add a condition inside it would have got an
  // infinite render loop for free. Flagged in the studio audit as my own trap.
  useEffect(() => {
    let fresh = 0
    for (const id of club.players) {
      const inj = game.players[id]?.injury
      if (inj && !inj.seen) { inj.seen = true; fresh++ }
    }
    if (fresh) touch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // empty sections say nothing at all - six headers of "nobody" was noise
  const section = (title: string, sub: string, rows: Player[], render: (p: Player) => React.ReactNode) =>
    rows.length === 0 ? null : (
      <>
        <SectionTitle sub={sub}>{title}</SectionTitle>
        <div className="tblwrap">
          <table className="dtable"><tbody>
            {rows.map(p => (
              <tr key={p.id} onClick={() => go('player', p.id)}>
                <td><PosBadge pos={p.pos} /></td>
                <td className="name">
                  {p.name}
                  {msg?.id === p.id && (
                    <div className="meta" style={{ fontSize: 11, fontWeight: 600, whiteSpace: 'normal' }}>
                      {msg.text}
                    </div>
                  )}
                </td>
                <td>{render(p)}</td>
              </tr>
            ))}
          </tbody></table>
        </div>
      </>
    )
  const allClear = !injured.length && !rusty.length && !banned.length && !tired.length && !loaded.length && !away.length

  return (
    <>
      <div className="card" style={{ borderLeft: '4px solid var(--gold)', padding: '8px 14px' }}>
        <div className="meta">
          🏥 <b>{game.staffPeople?.physio
            ? t('medical.physioNamed', { name: game.staffPeople.physio.name, badge: badgeLabel(game.staff.physio).toLowerCase() })
            : t('medical.headPhysio')}</b>
          {game.staff.physio === 0
            ? t('medical.physioVacant')
            : t('medical.physioShorter', { pct: game.staff.physio * 12 })}
        </div>
      </div>

      <div style={{ padding: '6px 14px 0' }}>
        <input className="inline-input" placeholder={t('medical.findPlayer')} value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ margin: 0, maxWidth: 240, padding: '4px 8px', fontSize: 12 }} />
      </div>

      {/* THE TREATMENT TABLE IS WHERE YOU WANT A FIT SQUAD, not two menus away
          in a shop (owner: "ok put the full fitness on the medical screen,
          country desk but also keep in store"). The card hides itself where
          there is no till and where there is nobody to heal, so a quiet room
          stays quiet. */}
      <FullFitness />

      {allClear && (
        <div className="card center" style={{ borderLeft: '4px solid var(--text-positive)' }}>
          <h3 style={{ fontSize: 15 }}>{t(q ? 'medical.nothingOnHim' : 'medical.quietRoom')}</h3>
          <div className="meta">{t(q ? 'medical.nothingOnHimSub' : 'medical.quietRoomSub')}</div>
        </div>
      )}

      {section(t('medical.treatmentRoom'), t('medical.treatmentSub', { fee: fmtMoney(SPECIALIST_FEE) }), injured, p => (
        <span style={{ color: 'var(--text-negative)', fontWeight: 700, fontSize: 12 }}>
          {p.injury!.desc} · {t('common.weeksOut', { n: Math.max(1, p.injury!.until - game.week) })}
          {!p.specialist && p.injury!.until - game.week >= 3 && (
            <button className="btn ghost" style={{ marginLeft: 8, padding: '2px 8px', fontSize: 11 }}
              onClick={e => { e.stopPropagation(); setMsg({ id: p.id, text: specialistConsult(game, p.id) }); touch() }}>
              {t('medical.specialist')}
            </button>
          )}
          {/* the sponsor's consultant (v1.1.0): the same door with the fee
              replaced by a watched spot - only where a provider exists, and
              only while the week's ledger allows it (rewarded.ts) */}
          {rewardedAvailable('medical') && canPhysioFavour(game, p.id) && (
            <button className="btn ghost" style={{ marginLeft: 8, padding: '2px 8px', fontSize: 11 }}
              onClick={e => {
                e.stopPropagation()
                void showRewarded('medical').then(out => {
                  if (out === 'completed') setMsg({ id: p.id, text: rewardPhysio(p.id) ?? t('till.favourGone') })
                  else setMsg({ id: p.id, text: t(out === 'skipped' ? 'till.spotSkipped' : 'till.spotUnavailable') })
                })
              }}>
              {t('till.watchPhysio')}
            </button>
          )}
        </span>
      ))}

      {section(t('medical.redZone'), t('medical.redZoneSub'), loaded, p => (
        <span style={{ color: 'var(--text-negative)', fontWeight: 700, fontSize: 12 }}>{t('medical.minsThisSeason', { mins: p.stats.mins })}</span>
      ))}

      {section(t('medical.returning'), t('medical.returningSub'), rusty, p => (
        <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 12 }}>
          {t('medical.rusty', { n: p.rust ?? 0 })}
          {game.cottonWk !== game.season * 100 + game.week && (
            <button className="btn ghost" style={{ marginLeft: 8, padding: '2px 8px', fontSize: 11 }}
              onClick={e => { e.stopPropagation(); setMsg({ id: p.id, text: cottonWool(game, p.id) }); touch() }}>
              {t('medical.cottonWool')}
            </button>
          )}
        </span>
      ))}

      {section(t('medical.suspended'), t('medical.suspendedSub'), banned, p => (
        <span style={{ color: 'var(--text-negative)', fontWeight: 700, fontSize: 12 }}>{t('medical.banMatches', { n: p.bans })}</span>
      ))}

      {/* The figure is honest for a STARTER and overstates the problem for a
          replacement: benchTank() floors every man who comes off the bench at
          60% however tired the training ground says he is, because he has spent
          the hour sitting down (matchEngine.ts). Saying "consider resting" flat
          out told half a squad something untrue, so the line now names who it
          is actually talking to. */}
      {section(t('medical.onFumes'), t('medical.onFumesSub'), tired, p => (
        <span style={{ fontWeight: 700, fontSize: 12 }}>{Math.round(p.cond)}%</span>
      ))}

      {section(t('medical.awayFromClub'), t('medical.awayFromClubSub'), away, p => (
        <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 12 }}>{t(p.onLoan ? 'medical.onLoan' : 'medical.intlDuty')}</span>
      ))}
      <div className="spacer" />
    </>
  )
}
