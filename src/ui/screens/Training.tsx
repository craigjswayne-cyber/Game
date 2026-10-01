import { useState } from 'react'
import { useStore } from '../../store'
import { STAFF_INFO, fmtMoney, fmtWage, injuryDesc, type TrainingFocus, weeksBetween100 } from '../../game/model'
import { BADGE_COL, EXAM_PASS_PCT, badgeLabel, traitLabel, appointBlock, appointStaff, backroomFund, courseBlock, courseFee, sackCost, sackStaff, sendToCourse, staffCandidates, staffInterest, type StaffRole } from '../../game/staff'
import DevelopmentPanel from './DevelopmentPanel'
import { Flag } from '../flags'
import { SectionTitle, TwoStep } from '../components'
import { t } from '../../game/i18n'
import { Glyph } from '../glyphs'

/* keys, not words - see docs/i18n.md */
const FOCUSES: { id: TrainingFocus; name: string; desc: string }[] = [
  { id: 'balanced', name: 'training.focusBalanced', desc: 'training.focusBalancedDesc' },
  { id: 'scrum', name: 'training.focusScrum', desc: 'training.focusScrumDesc' },
  { id: 'lineout', name: 'training.focusLineout', desc: 'training.focusLineoutDesc' },
  { id: 'attack', name: 'training.focusAttack', desc: 'training.focusAttackDesc' },
  { id: 'defence', name: 'training.focusDefence', desc: 'training.focusDefenceDesc' },
  { id: 'fitness', name: 'training.focusFitness', desc: 'training.focusFitnessDesc' },
  { id: 'kicking', name: 'training.focusKicking', desc: 'training.focusKickingDesc' },
]

export default function Training() {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const club = game.clubs[game.userClubId]
  const [ttab, setTtab] = useState<'training' | 'staff' | 'cond'>('training')
  const players = club.players.map(id => game.players[id]).filter(Boolean)
    .sort((a, b) => a.cond - b.cond)

  return (
    <>
      <div className="tab-bar">
        <button className={ttab === 'training' ? 'active' : ''} onClick={() => setTtab('training')}>{t('training.tabTraining')}</button>
        <button className={ttab === 'staff' ? 'active' : ''} onClick={() => setTtab('staff')}>{t('training.tabStaff')}</button>
        <button className={ttab === 'cond' ? 'active' : ''} onClick={() => setTtab('cond')}>{t('training.tabCondition')}</button>
      </div>
      {ttab === 'training' && <>
      <SectionTitle sub={t('training.weeklyFocusSub')}>{t('training.weeklyFocus')}</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 4, padding: '0 14px' }}>
        {FOCUSES.map(f => (
          <button key={f.id} className={`club-pick${game.training === f.id ? ' sel' : ''}`} style={{ margin: 0 }}
            onClick={() => { game.training = f.id; touch() }}>
            <span style={{ fontSize: 16 }}>{game.training === f.id ? '●' : '○'}</span>
            <span className="cname">{t(f.name)}</span>
            <span className="muted" style={{ maxWidth: '52%', textAlign: 'right', fontSize: 11 }}>{t(f.desc)}</span>
          </button>
        ))}
      </div>
      {/* every player who qualifies, not the ten or twelve the chips used to
          show (owner, 1.8.0); the rules live in game/development.ts */}
      <DevelopmentPanel />
      </>}
      {ttab === 'staff' && <StaffPanel />}
      {ttab === 'cond' && <>
      <SectionTitle sub={t('training.conditionReportSub')}>{t('training.conditionReport')}</SectionTitle>
      <div className="tblwrap"><table className="dtable">
        <thead><tr><th>{t('squad.colName')}</th><th className="num">{t('training.colFitness')}</th><th className="num">{t('training.colSharpness')}</th><th>{t('training.colStatus')}</th></tr></thead>
        <tbody>
          {players.map(p => (
            <tr key={p.id}>
              <td className="name">{p.name}</td>
              <td className="num" style={{ color: p.cond < 70 ? 'var(--text-negative)' : undefined }}>{Math.round(p.cond)}%</td>
              <td className="num">{Math.round(p.sharp)}%</td>
              <td className="muted">{p.injury ? t('training.statusInjured', { desc: injuryDesc(p.injury), n: Math.max(1, p.injury.until - game.week) })
                : p.natSquad ? t('training.statusIntl') : p.bans > 0 ? t('training.statusBanned', { n: p.bans }) : t('training.statusAvailable')}</td>
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
  // THE ANSWER BELONGS TO THE ROLE THAT WAS TAPPED, NOT TO THE PAGE.
  //
  // This was a single string rendered in a banner at the top of the panel, and
  // that one detail is the whole of the user's bug report: "ive tried to hire a
  // coach who is keen but no matter what I press when in market he won't sign
  // and no reason". There always WAS a reason - the eighth role card is simply
  // 786px below the banner that carried it (measured by hireprobe), so on a
  // phone the reply to your tap rendered off the top of the screen while the
  // market collapsed underneath your thumb. Keying it by role puts the sentence
  // on the card that produced it, where it is read.
  const [msg, setMsg] = useState<{ role: StaffRole; text: string } | null>(null)
  const abs = game.season * 100 + game.week
  const roles = Object.keys(STAFF_INFO) as StaffRole[]
  return (
    <>
      <SectionTitle sub={t('training.backroomStaffSub', { pct: EXAM_PASS_PCT })}>{t('training.backroomStaff')}</SectionTitle>
      {/* THE BOARD'S FUND, IF THERE IS ONE (boardroom.ts). It is spent before
          the club's own balance, so without a line here a manager would see
          a coach he could not afford last week become affordable and have no
          idea why. Shown only when there is something in it. */}
      {backroomFund(game) > 0 && (
        <div className="card" style={{ padding: '7px 10px', marginBottom: 6, borderLeft: '4px solid var(--gold)' }}>
          <div className="fact-label">{t('training.boardFund')}</div>
          <div style={{ fontWeight: 700, color: 'var(--gold)' }}>{fmtMoney(backroomFund(game))}</div>
        </div>
      )}
      {/* the page's 12px gutter: the cards ran edge to edge of the glass
          (UI QA, 1.8.0) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(330px, 100%), 1fr))', gap: 6, padding: '0 12px' }}>
        {roles.map(role => {
          const info = STAFF_INFO[role]
          const p = game.staffPeople?.[role]
          const cands = open === role ? staffCandidates(game, role) : []
          const weeksLeft = p?.course ? Math.max(1, weeksBetween100(p.course.done, abs)) : 0
          // why the two buttons on this card would refuse, and what the last
          // tap on it said - both belong to the card, not to the page
          const courseNo = p ? courseBlock(game, role) : null
          const said = msg?.role === role ? msg.text : null
          return (
            <div className="card" key={role} style={{ margin: 0, padding: '8px 10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div className="fact-label">{t(info.name)}</div>
                  {p ? (
                    <>
                      <h3 style={{ fontSize: 14, margin: 0 }}>
                        <Flag code={p.nat} /> {p.name} <b style={{ color: BADGE_COL[p.tier], fontSize: 12 }}>{badgeLabel(p.tier).toUpperCase()}</b>
                      </h3>
                      <div className="meta" style={{ fontSize: 11 }}>
                        {t('training.staffLine', { age: p.age, trait: traitLabel(p.trait), wage: fmtWage(p.wage) })}
                        {(p.passed ?? 0) > 0 ? t(p.passed === 1 ? 'training.badgeHere' : 'training.badgesHere', { n: p.passed ?? 0 }) : ''}
                      </div>
                      {p.course && <div className="meta" style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700 }}>
                        {t(weeksLeft === 1 ? 'training.onCourseOne' : 'training.onCourse', { badge: badgeLabel(p.course.toTier).toLowerCase(), n: weeksLeft })}
                      </div>}
                      {!p.course && (p.retakeAt ?? 0) > abs && (
                        <div className="meta" style={{ fontSize: 11, color: 'var(--danger)' }}>
                          {t(weeksBetween100(p.retakeAt!, abs) === 1 ? 'training.failedRetakeOne' : 'training.failedRetake', { g: p.g ?? 'm', n: weeksBetween100(p.retakeAt!, abs) })}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <h3 style={{ fontSize: 14, margin: 0, opacity: .75 }}>{t('training.vacant')}</h3>
                      <div className="meta" style={{ fontSize: 11 }}>{t(info.desc)}</div>
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                  {/* the seat can be emptied without a replacement lined up
                      (owner, v1.2.7): eight weeks of his wage, asked twice */}
                  {p && !p.course && (
                    <TwoStep className="btn ghost" style={{ padding: '4px 8px', fontSize: 11, lineHeight: 1.25 }}
                      label={t('training.sack')} confirm={t('training.sackConfirm', { g: p.g ?? 'm', cost: fmtMoney(sackCost(game, role)) })}
                      title={t('training.sackTitle', { g: p.g ?? 'm', cost: fmtMoney(sackCost(game, role)) })}
                      onConfirm={() => { setMsg({ role, text: sackStaff(game, role) }); touch() }} />
                  )}
                  {p && p.tier < 3 && !p.course && (p.retakeAt ?? 0) <= abs && (
                    <button className="btn gold" style={{ padding: '4px 8px', fontSize: 11, lineHeight: 1.25 }}
                      disabled={!!courseNo} title={courseNo?.long}
                      onClick={() => { setMsg({ role, text: sendToCourse(game, role) }); touch() }}>
                      {t('training.assess')}<br /><span style={{ fontSize: 10, fontWeight: 600 }}>{fmtMoney(courseFee(p.tier))}</span>
                    </button>
                  )}
                  <button className="btn ghost" style={{ padding: '4px 8px', fontSize: 11 }}
                    onClick={() => { setOpen(open === role ? null : role); setMsg(null) }}>
                    {t(open === role ? 'training.close' : p ? 'training.market' : 'training.candidates')}
                  </button>
                </div>
              </div>
              {/* THE REASON THE BUTTON IS GREY, under the button. A disabled
                  control with nothing next to it is the same bug in a new
                  costume: the manager still cannot tell whether the game is
                  broken or he is skint. */}
              {courseNo && p && p.tier < 3 && !p.course && (p.retakeAt ?? 0) <= abs && (
                <div className="meta" style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 600, marginTop: 3 }}>
                  <Glyph name="academy" /> {courseNo.short}
                </div>
              )}
              {said && (
                <div className="meta" style={{ fontSize: 12, fontWeight: 600, marginTop: 4, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
                  {said}
                </div>
              )}
              {open === role && cands.map((c, i) => {
                const keen = staffInterest(game, c)
                // one predicate, shared with appointStaff (game/staff.ts)
                const no = appointBlock(game, c)
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 5, marginTop: 5 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>
                        <Flag code={c.nat} /> {c.name} <span style={{ color: BADGE_COL[c.tier], fontSize: 11 }}>{badgeLabel(c.tier).toUpperCase()}</span>
                      </div>
                      <div className="meta" style={{ fontSize: 11 }}>
                        {t('training.candLine', { age: c.age, trait: traitLabel(c.trait), wage: fmtWage(c.wage), fee: fmtMoney(c.fee) })}
                      </div>
                      {/* the money truth, on his row, before the tap - this is
                          the line the user went looking for and never found */}
                      {no && (
                        <div className="meta" style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 700 }}>
                          {no.short}
                        </div>
                      )}
                    </div>
                    <span className="meta" style={{ fontSize: 11, color: keen === 'keen' ? 'var(--text-positive)' : keen === 'persuadable' ? 'var(--border-strong)' : 'var(--text-negative)', fontWeight: 700, flexShrink: 0 }}>
                      {t(keen === 'keen' ? 'training.keen' : keen === 'persuadable' ? 'training.listening' : 'training.notInterested')}
                    </span>
                    <button className="btn" style={{ padding: '4px 9px', fontSize: 11, flexShrink: 0 }}
                      disabled={!!no} title={no?.long}
                      onClick={() => { setMsg({ role, text: appointStaff(game, role, i) }); setOpen(null); touch() }}>{t('training.appoint')}</button>
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
