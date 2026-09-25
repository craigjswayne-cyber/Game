import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import { fmtMoney, fmtWage, inRedZone, type Player } from '../../game/model'
import { SPECIALIST_FEE, cottonWool, specialistConsult } from '../../game/medical'
import { jokerCandidates, jokerFor, jokerOpen, jokerWage, signMedicalJoker, weeksOut } from '../../game/joker'
import { fuzzedCa } from '../../game/scout'
import { HEAD_INJURIES, canPlayThrough, flareChance, playThrough, restKnock, weeksLeft } from '../../game/knock'
import { canPhysioFavour } from '../../game/rewarded'
import { rewardedAvailable } from '../../game/monetise'
import { badgeLabel } from '../../game/staff'
import { PosBadge, SectionTitle, RewardedButton, Stars } from '../components'
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
  /** the injured man a medical joker is being chosen for (joker.ts) */
  const [jokerHurt, setJokerHurt] = useState<Player | null>(null)
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
  /** playing through a knock (knock.ts) */
  const knocks = squad.filter(p => !!p.knock)

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
  const allClear = !injured.length && !rusty.length && !banned.length && !tired.length && !loaded.length && !away.length && !knocks.length

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

      {section(t('medical.treatmentRoom'), t('medical.treatmentSub', { fee: fmtMoney(SPECIALIST_FEE) }), injured, p => {
        /* ---- TWO DOORS, AND ONLY EVER ONE OF THEM IS A DECISION ----
           Owner, 1.5.8: the paid consult sat next to the free watch-an-ad
           button doing the same job. It nearly did. specialistConsult takes a
           fifth off the remaining lay-off with no ceiling; physioFavour takes
           the same fifth capped at two weeks - so below thirteen weeks out
           they are IDENTICAL, and the game was charging fifty thousand pounds
           for the version with an emoji on it.
           The arithmetic is now on the buttons, and the fee only appears where
           it actually buys something the favour cannot. Where no provider
           exists - the web build, an offline phone - the fee is the only door
           and shows at every length, which is why the gate reads the favour's
           availability rather than the weeks alone. */
        const left = Math.max(1, p.injury!.until - game.week)
        const feeCut = Math.max(1, Math.round(left * 0.2))
        const favourCut = Math.min(2, feeCut)
        const favourOn = rewardedAvailable('medical') && canPhysioFavour(game, p.id)
        const feeOn = !p.specialist && p.injury!.until - game.week >= 3 && (!favourOn || feeCut > favourCut)
        return (
        // the controls wrap under the line: with the knock and the joker there
        // can be three of them, and a row wider than the phone hides the last
        <span style={{ color: 'var(--text-negative)', fontWeight: 700, fontSize: 12, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, whiteSpace: 'normal' }}>
          <span>{p.injury!.desc} · {t('common.weeksOut', { n: left })}</span>
          {/* the sponsor's consultant (v1.1.0): the same door with the fee
              replaced by a watched spot - only where a provider exists, and
              only while the week's ledger allows it (rewarded.ts). It is
              listed FIRST now: free before paid is the honest order, and the
              owner's note was that the two read as interchangeable. */}
          {favourOn && (
            <RewardedButton place="medical" label={t('till.physioCut', { n: favourCut })}
              className="btn ghost" style={{ padding: '2px 8px', fontSize: 11 }}
              onDone={out => {
                if (out === 'completed') setMsg({ id: p.id, text: rewardPhysio(p.id) ?? t('till.favourGone') })
                else setMsg({ id: p.id, text: t(out === 'skipped' ? 'till.spotSkipped' : 'till.spotUnavailable') })
              }} />
          )}
          {feeOn && (
            <button className="btn gold" style={{ padding: '2px 8px', fontSize: 11 }}
              onClick={e => { e.stopPropagation(); setMsg({ id: p.id, text: specialistConsult(game, p.id) }); touch() }}>
              {t('medical.specialistCut', { n: feeCut })}
            </button>
          )}
          {/* PLAY THROUGH IT (knock.ts): the last weeks of a lay-off can be
              played on, at a risk the button states. Never a head injury, and
              the room says so rather than leaving the button to go missing. */}
          {canPlayThrough(game, p) && (
            <button className="btn ghost" style={{ padding: '2px 8px', fontSize: 11 }}
              onClick={e => {
                e.stopPropagation()
                const r = playThrough(game, p.id)
                setMsg({ id: p.id, text: t(r.k, r.v) })
                touch()
              }}>
              {t('medical.knockBtn', { pct: Math.round(flareChance(weeksLeft(game, p)) * 100) })}
            </button>
          )}
          {HEAD_INJURIES.has(p.injury!.dk ?? '') && weeksLeft(game, p) <= 3 && (
            <div className="meta" style={{ fontWeight: 600 }}>{t('medical.knockHead')}</div>
          )}
          {/* THE MEDICAL JOKER (joker.ts): a long lay-off can be covered by one
              short-term signing whose wage sits outside the cap */}
          {(() => {
            const cover = jokerFor(game, p.id)
            if (cover) return <div className="meta" style={{ color: 'var(--gold)', fontWeight: 700 }}>{t('medical.jokerCovered', { name: cover.name })}</div>
            if (!jokerOpen(game, p)) return null
            return (
              <button className="btn ghost" style={{ padding: '2px 8px', fontSize: 11 }}
                onClick={e => { e.stopPropagation(); setJokerHurt(p) }}>
                {t('medical.jokerBtn')}
              </button>
            )
          })()}
        </span>
        )
      })}

      {section(t('medical.knockTitle'), t('medical.knockSub'), knocks, p => (
        <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 12, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, whiteSpace: 'normal' }}>
          <span>{t('medical.knockRow', { n: Math.max(0, p.knock!.until - game.week), pct: Math.round(flareChance(p.knock!.early) * 100) })}</span>
          <button className="btn ghost" style={{ padding: '2px 8px', fontSize: 11 }}
            onClick={e => {
              e.stopPropagation()
              const r = restKnock(game, p.id)
              setMsg({ id: p.id, text: t(r.k, r.v) })
              touch()
            }}>
            {t('medical.knockRest')}
          </button>
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
      {jokerHurt && (
        <div className="modal-veil" onClick={() => setJokerHurt(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="grab" />
            <div style={{ padding: '0 16px' }}>
            <h3 style={{ fontSize: 16, margin: '2px 0 6px' }}>{t('medical.jokerTitle', { hurt: jokerHurt.name })}</h3>
            <div className="meta" style={{ marginBottom: 8 }}>
              {t('medical.jokerExplain', { n: weeksOut(game, jokerHurt), hurt: jokerHurt.name })}
            </div>
            {(() => {
              const pool = jokerCandidates(game, jokerHurt)
              if (!pool.length) return <div className="meta">{t('medical.jokerNone')}</div>
              return (
                <div className="tblwrap">
                  <table className="dtable"><tbody>
                    {pool.map(c => (
                      <tr key={c.id}>
                        <td><PosBadge pos={c.pos} /></td>
                        <td className="name">{c.name} <span className="muted">{c.age}</span></td>
                        <td><Stars ca={fuzzedCa(game, c)} /></td>
                        <td>
                          <button className="btn gold" style={{ padding: '2px 8px', fontSize: 11 }}
                            onClick={() => {
                              const r = signMedicalJoker(game, jokerHurt.id, c.id)
                              setMsg({ id: jokerHurt.id, text: r.msg })
                              setJokerHurt(null)
                              touch()
                            }}>
                            {t('medical.jokerSign', { wage: fmtWage(jokerWage(c)) })}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody></table>
                </div>
              )
            })()}
            <button className="btn ghost block" style={{ marginTop: 10 }} onClick={() => setJokerHurt(null)}>
              {t('medical.jokerClose')}
            </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
