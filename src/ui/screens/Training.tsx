import { useState } from 'react'
import { useStore } from '../../store'
import { STAFF_INFO, fmtMoney, fmtWage, type TrainingFocus } from '../../game/model'
import { BADGE_COL, EXAM_PASS_PCT, badgeLabel, traitLabel, appointBlock, appointStaff, courseBlock, courseFee, sendToCourse, staffCandidates, staffChemPairs, staffInterest, type StaffRole } from '../../game/staff'
import { MENTEE_MAX_AGE, MENTOR_MAX_KIDS, canBeMentored, canMentor, fitReason, fitWord, mentorCap, mentorFit } from '../../game/mentoring'
import { activePlan, planCap } from '../../game/season'
import { flagOf } from '../../game/nations'
import { SectionTitle } from '../components'
import { posName, t } from '../../game/i18n'

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
  const go = useStore(s => s.go)
  const club = game.clubs[game.userClubId]
  const [ttab, setTtab] = useState<'training' | 'staff' | 'club' | 'cond'>('training')
  const players = club.players.map(id => game.players[id]).filter(Boolean)
    .sort((a, b) => a.cond - b.cond)

  return (
    <>
      <div className="tab-bar">
        <button className={ttab === 'training' ? 'active' : ''} onClick={() => setTtab('training')}>{t('training.tabTraining')}</button>
        <button className={ttab === 'staff' ? 'active' : ''} onClick={() => setTtab('staff')}>{t('training.tabStaff')}</button>
        <button className={ttab === 'cond' ? 'active' : ''} onClick={() => setTtab('cond')}>{t('training.tabCondition')}</button>
        <button className={ttab === 'club' ? 'active' : ''} onClick={() => setTtab('club')}>{t('training.tabClub')}</button>
      </div>
      {ttab === 'training' && <>
      <SectionTitle sub={t('training.weeklyFocusSub')}>{t('training.weeklyFocus')}</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 4, padding: '0 14px' }}>
        {FOCUSES.map(f => (
          <button key={f.id} className={`club-pick${game.training === f.id ? ' sel' : ''}`} style={{ margin: 0 }}
            onClick={() => { game.training = f.id; touch() }}>
            <span style={{ fontSize: 15 }}>{game.training === f.id ? '●' : '○'}</span>
            <span className="cname">{t(f.name)}</span>
            <span className="muted" style={{ maxWidth: '52%', textAlign: 'right', fontSize: 11 }}>{t(f.desc)}</span>
          </button>
        ))}
      </div>
      <SectionTitle sub={t('training.devFocusSub')}>{t('training.devFocus')}</SectionTitle>
      <div className="chips">
        {players.filter(p => p.age <= 26).sort((a, b) => b.pa - b.ca - (a.pa - a.ca)).slice(0, 10).map(p => {
          const on = game.devFocus.includes(p.id)
          return (
            <button key={p.id} className="chip" style={on ? { borderColor: 'var(--gold)', background: 'color-mix(in srgb, var(--gold) 14%, var(--surface-1))' } : undefined}
              onClick={() => {
                game.devFocus = on
                  ? game.devFocus.filter(id => id !== p.id)
                  : [...game.devFocus, p.id].slice(-3)
                touch()
              }}>
              {/* the position sits with the name (owner, v1.1.3): a chip
                  that says who a man IS makes "who should work on what" a
                  decision instead of a memory test */}
              {on ? '● ' : '○ '}{p.name} ({posName(p.pos)}) <b>{p.age}</b>
            </button>
          )
        })}
      </div>
      {/* Personal plans (18A): individual programmes on top of the squad
          session - the one mechanic the competition had over us. The
          assistant's level is the department's bandwidth, and a planned man
          works his programme INSTEAD of the squad session, so this is a
          choice rather than a stack. Tap a name to cycle what he works on. */}
      <SectionTitle sub={t('training.personalPlansSub', { cap: planCap(game) })}>{t('training.personalPlans')}</SectionTitle>
      <div className="chips">
        {(() => {
          const KINDS = FOCUSES.filter(f => f.id !== 'balanced')
          const seniors = players.filter(p => !p.acad).sort((a, b) => b.ca - a.ca)
          const planned = new Set((game.plans ?? []).slice(-planCap(game)).map(x => x.id))
          const shown = [...seniors.slice(0, 12), ...seniors.slice(12).filter(p => planned.has(p.id))]
          return shown.map(p => {
            const cur = activePlan(game, p.id)
            const curName = cur ? t(KINDS.find(k => k.id === cur)?.name ?? '') : null
            return (
              <button key={p.id} className="chip" style={cur ? { borderColor: 'var(--gold)', background: 'color-mix(in srgb, var(--gold) 14%, var(--surface-1))' } : undefined}
                onClick={() => {
                  const idx = cur == null ? 0 : KINDS.findIndex(k => k.id === cur) + 1
                  const rest = (game.plans ?? []).filter(x => x.id !== p.id)
                  game.plans = idx >= KINDS.length
                    ? rest
                    : [...rest, { id: p.id, plan: KINDS[idx].id }].slice(-planCap(game))
                  touch()
                }}>
                {/* the position code, not the full name (owner, v1.1.5: "on
                    the personal plans just use initials") - these chips also
                    carry the plan name, and "Fly-Half" plus a programme made
                    every chip two lines. The codes are the game's own (FH,
                    HK, N8...), the same ones every team sheet prints. */}
                {cur ? '● ' : '○ '}{p.name} ({p.pos}){curName ? <b> · {curName}</b> : ''}
              </button>
            )
          })
        })()}
      </div>
      </>}
      {ttab === 'staff' && <StaffPanel />}
      {ttab === 'club' && <>
      <SectionTitle sub={t('training.mentoringSub', { age: MENTEE_MAX_AGE + 1 })}>{t('training.mentoring')}</SectionTitle>
      <MentorPanel />
      <SectionTitle sub={t('training.infrastructureSub')}>{t('training.infrastructure')}</SectionTitle>
      <button className="club-pick" onClick={() => go('infra')}>
        <span style={{ fontSize: 16 }}>🏗️</span>
        <span className="cname">{t('titles.infra')}</span>
        <span className="muted">{t('training.infraLink')}</span>
      </button>
      </>}
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
              <td className="muted">{p.injury ? t('training.statusInjured', { desc: p.injury.desc, n: Math.max(0, p.injury.until - game.week) })
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
      {/* the weather in the room (25D-3): who feeds off whom and who cannot
          stand whom. Without this the chemistry is invisible three seasons
          after the hire-day letter, and the manager has no way to know why
          his kids are or are not coming on */}
      {(() => {
        const pairs = staffChemPairs(game)
        if (!pairs.length) return null
        const net = pairs.reduce((s, r) => s + (r.kind === 'click' ? 1 : -1), 0)
        return (
          <div className="card" style={{ padding: '7px 10px', marginBottom: 6, borderLeft: `4px solid ${net > 0 ? 'var(--text-positive)' : net < 0 ? 'var(--text-negative)' : 'var(--gold)'}` }}>
            <div className="fact-label">{t('training.staffRoom')}</div>
            <div className="meta" style={{ fontSize: 11.5, marginBottom: 3 }}>
              {t(net > 0 ? 'training.roomPulling' : net < 0 ? 'training.roomDisagrees' : 'training.roomCancels')}
            </div>
            {pairs.map((r, i) => (
              <div key={i} className="meta" style={{ fontSize: 11, padding: '1px 0' }}>
                <b style={{ color: r.kind === 'click' ? 'var(--text-positive)' : 'var(--text-negative)' }}>{r.kind === 'click' ? '✓' : '✗'}</b>{' '}
                {t('training.chemPair', { a: r.a, b: r.b, note: t(r.note) })}
              </div>
            ))}
          </div>
        )
      })()}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 6 }}>
        {roles.map(role => {
          const info = STAFF_INFO[role]
          const p = game.staffPeople?.[role]
          const cands = open === role ? staffCandidates(game, role) : []
          const weeksLeft = p?.course ? Math.max(1, p.course.done - abs) : 0
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
                        {flagOf(p.nat)} {p.name} <b style={{ color: BADGE_COL[p.tier], fontSize: 11.5 }}>{badgeLabel(p.tier).toUpperCase()}</b>
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
                          {t(p.retakeAt! - abs === 1 ? 'training.failedRetakeOne' : 'training.failedRetake', { n: p.retakeAt! - abs })}
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
                  🎓 {courseNo.short}
                </div>
              )}
              {said && (
                <div className="meta" style={{ fontSize: 11.5, fontWeight: 600, marginTop: 4, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
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
                      <div style={{ fontSize: 12.5, fontWeight: 700 }}>
                        {flagOf(c.nat)} {c.name} <span style={{ color: BADGE_COL[c.tier], fontSize: 10.5 }}>{badgeLabel(c.tier).toUpperCase()}</span>
                      </div>
                      <div className="meta" style={{ fontSize: 10.5 }}>
                        {t('training.candLine', { age: c.age, trait: traitLabel(c.trait), wage: fmtWage(c.wage), fee: fmtMoney(c.fee) })}
                      </div>
                      {/* the money truth, on his row, before the tap - this is
                          the line the user went looking for and never found */}
                      {no && (
                        <div className="meta" style={{ fontSize: 10.5, color: 'var(--danger)', fontWeight: 700 }}>
                          {no.short}
                        </div>
                      )}
                    </div>
                    <span className="meta" style={{ fontSize: 10.5, color: keen === 'keen' ? 'var(--text-positive)' : keen === 'persuadable' ? 'var(--border-strong)' : 'var(--text-negative)', fontWeight: 700, flexShrink: 0 }}>
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

/** Pair the wise heads with the next generation. */
function MentorPanel() {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const [seniorId, setSeniorId] = useState<number | ''>('')
  const [kidId, setKidId] = useState<number | ''>('')
  const club = game.clubs[game.userClubId]
  const pairs = game.mentors ?? []
  const squad = club.players.map(id => game.players[id]).filter(Boolean)
  // canMentor and canBeMentored live in game/mentoring so this screen and the
  // development loop cannot drift apart about who is eligible. A senior stays
  // in the dropdown until he holds MENTOR_MAX_KIDS kids - a second one is
  // allowed, at the attention cost the row below spells out.
  const kidCount = (id: number) => pairs.filter(mp => mp.senior === id).length
  const seniors = squad.filter(p => canMentor(p) && kidCount(p.id) < MENTOR_MAX_KIDS)
    .sort((a, b) => b.a.lea - a.a.lea)
  const kids = squad.filter(p => canBeMentored(p) && !pairs.some(mp => mp.kid === p.id))
    .sort((a, b) => b.pa - a.pa)
  return (
    <div className="card" style={{ padding: '8px 10px' }}>
      {pairs.map((mp, i) => {
        const s2 = game.players[mp.senior]
        const k2 = game.players[mp.kid]
        if (!s2 || !k2) return null
        // how well the two of them actually work together, and why
        const fit = mentorFit(s2, k2)
        const col = fit >= 66 ? 'var(--text-positive)' : fit >= 36 ? 'var(--gold)' : 'var(--danger)'
        return (
          <div key={i} style={{ padding: '5px 0', borderTop: i ? '1px solid var(--border)' : undefined }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span className="meta" style={{ flex: 1, minWidth: 0 }}>
                {t('training.mentorPair', { senior: s2.name, sPos: s2.pos, sPers: s2.pers, kid: k2.name, kPos: k2.pos, kPers: k2.pers, age: k2.age })}
              </span>
              <b style={{ color: col, fontSize: 12, whiteSpace: 'nowrap' }}>{fitWord(fit)} {fit}</b>
              <button className="btn ghost" style={{ fontSize: 11, padding: '4px 10px' }}
                onClick={() => { game.mentors = pairs.filter((_, j) => j !== i); touch() }}>{t('training.end')}</button>
            </div>
            <div className="meta" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {fitReason(s2, k2)}
              {kidCount(mp.senior) >= 2 ? t('training.twoKids') : ''}
            </div>
            <div className="rt-bar" style={{ margin: '3px 0 0' }}><i style={{ width: `${fit}%`, background: col }} /></div>
          </div>
        )
      })}
      {pairs.length === 0 && <div className="meta" style={{ fontSize: 11 }}>{t('training.mentorEmpty')}</div>}
      {/* cap lives in game/mentoring (four slots, five with a Centre of
          Excellence at level 3+) so this screen and the handbook agree */}
      {pairs.length < mentorCap(game) && seniors.length > 0 && kids.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="inline-input" style={{ margin: 0, flex: 1, minWidth: 130 }} value={seniorId}
            onChange={e => setSeniorId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">{t('training.seniorPro')}</option>
            {/* position, character, age - the same three facts in the same
                order in both pickers and in the pairs above (Round 27, user:
                "on the mentoring tab it doesnt have players positions"). This
                screen used to give three different combinations: the senior
                picker said character and age, the kid picker said position and
                age, and the pairs row said the senior's character and the
                kid's age. Character is what the fit is actually built on, so
                it stays; position is what a manager thinks in. */}
            {seniors.map(p => <option key={p.id} value={p.id}>{t('training.mentorOption', { name: p.name, pos: p.pos, pers: p.pers, age: p.age })}{kidCount(p.id) > 0 ? t('training.oneKidAlready') : ''}</option>)}
          </select>
          <select className="inline-input" style={{ margin: 0, flex: 1, minWidth: 130 }} value={kidId}
            onChange={e => setKidId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">{t('training.underAge', { age: MENTEE_MAX_AGE + 1 })}</option>
            {kids.map(p => <option key={p.id} value={p.id}>{t('training.mentorOption', { name: p.name, pos: p.pos, pers: p.pers, age: p.age })}</option>)}
          </select>
          <button className="btn" disabled={!seniorId || !kidId} onClick={() => {
            if (!seniorId || !kidId) return
            const s2 = game.players[seniorId]; const k2 = game.players[kidId]
            // pers0: what he was when the pairing began, so graduation can see
            // him change (mentoring.mentorGraduations)
            game.mentors = [...pairs, { senior: seniorId, kid: kidId, pers0: k2.pers }]
            game.news.push({
              id: game.nextId++, week: game.week, season: game.season, type: 'youth', read: true,
              subject: `${s2.name} takes ${k2.name.split(' ').slice(-1)[0]} under his wing`,
              body: `The old pro and the academy kid: ${s2.name} will mentor ${k2.name} for the season - extras after training, lifts to the ground, the lot. This is how clubs pass themselves on.`,
              playerId: k2.id,
            })
            setSeniorId(''); setKidId(''); touch()
          }}>{t('training.pair')}</button>
        </div>
      )}
    </div>
  )
}
