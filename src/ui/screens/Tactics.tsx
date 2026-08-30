import { useState } from 'react'
import { useStore } from '../../store'
import { XV_SLOTS, type Player } from '../../game/model'
import { DEF_SLIDER_INFO, PRESETS, SLIDER_INFO, defSliderReadout, sliderReadout } from '../../game/tactics'
import { ROLE_BY_ID, rolesForSlot } from '../../game/roles'
import { PosBadge, SectionTitle } from '../components'
import { analystClaim, analystForm, analystRead, prepLabel, unitLabel } from '../../game/analyst'
import { assistantAdvice } from '../../game/analysis'
import { userFixtureThisWeek } from '../../game/season'
import { counterTo, dialLine, philosophyOf } from '../../game/philosophy'
import { repetitionFatigue } from '../../game/oppcoach'
import { ROUTINES, DEFAULT_LINEOUT, DEFAULT_SCRUM, routineEffect } from '../../game/playbook'
import { BRIEFS, SPLITS, actualSplit, benchFrontRow, benchSeats, briefForSeat, refillBench, splitFor, type BenchSplit, type Brief } from '../../game/bench'
import { t } from '../../game/i18n'

/** The Tactics screen: HOW the side plays. Roles on a pitch, the set-piece
 *  playbook, the bench shape, the week's preparation and the game plan.
 *
 *  WHO plays moved out (user: "Selection should be the team section and
 *  replace overview... The other tab should be called tactics"): the team
 *  sheet is the Team screen's opening tab now (screens/Selection.tsx), and
 *  this screen dropped both the Selection tab and the "& Tactics" half of its
 *  old name. */
export default function Tactics() {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const [ttab, setTtab] = useState<'tactics' | 'setp' | 'bench' | 'prep' | 'plan'>('tactics')
  const [roleSlot, setRoleSlot] = useState<number | null>(null)
  /** what the last one-tap plan set, so a control whose sliders are three
   *  screenfuls away still answers the tap that pressed it */
  const [planMsg, setPlanMsg] = useState<string | null>(null)

  const club = game.clubs[game.userClubId]
  // `tac`, not `t`: t() is the translator (src/game/i18n.ts)
  const tac = club.tactic

  // the bench seats depend on the split the manager named (F4)
  const seats = benchSeats(club)

  const slider = (info: typeof SLIDER_INFO[number]) => (
    <div className="slider-row" key={info.key}>
      <div className="lbls"><span>{t(info.lo)}</span><b style={{ color: 'var(--info)' }}>{t(info.label)}</b><span>{t(info.hi)}</span></div>
      <input type="range" min={0} max={100} value={tac[info.key]}
        onChange={e => { tac[info.key] = Number(e.target.value); touch() }} />
      <div className="meta" style={{ fontSize: 11, marginTop: 2 }}>{sliderReadout(info.key, tac[info.key])}</div>
    </div>
  )

  // The without-ball dials (18D). Same row shell, but these live off the
  // preset system and default to 50 when a save predates them.
  const defSlider = (info: typeof DEF_SLIDER_INFO[number]) => (
    <div className="slider-row" key={info.key}>
      {/* t(), like its sibling above. DEF_SLIDER_INFO's strings became KEYS in
          the translation sweep and this one render site was left reading them
          raw, so the live screen showed "tactics.sliderDefLineLo" to anybody
          who scrolled to Without the Ball (owner screenshot, 25 Aug). */}
      <div className="lbls"><span>{t(info.lo)}</span><b style={{ color: 'var(--info)' }}>{t(info.label)}</b><span>{t(info.hi)}</span></div>
      <input type="range" min={0} max={100} value={tac[info.key] ?? 50}
        onChange={e => { tac[info.key] = Number(e.target.value); touch() }} />
      <div className="meta" style={{ fontSize: 11, marginTop: 2 }}>{defSliderReadout(info.key, tac[info.key] ?? 50)}</div>
    </div>
  )

  // The canonical layout is a vertical half-pitch: x across, y up the field.
  // Landscape swaps the axes in CSS (see .form-chip in theme.css) because a
  // vertical pitch on an 844x390 phone filled the entire screenful and pushed
  // every slider on the page below the fold. The numbers stay in one orientation
  // so there is only ever one formation to reason about.
  // Re-spaced because the chips overlapped on a portrait phone (user: "tactics
  // screen the formation is squashed"). A chip is a fixed 74px wide there, which
  // is 19% of the pitch, so two chips on the same line need 20% of x between
  // them and two chips in the same column need 9% of y. The old pairs that
  // failed both tests were tighthead/hooker (20% apart, and Rakete-Stones is a
  // wide name) and the two centres (14% and 7%). Every pair below clears both.
  // The back line reads as an attack shape: 10 flattest, the centres one deeper
  // each, the WINGS deeper and wider than both, fullback last. It used to put
  // the right wing at y=60 - shallower than either centre - so 14 floated above
  // 13 on the chart (user: "the right wing should be below the outside centre").
  // No real backline stands with a wing in front of his centres.
  // The hooker sat at y=7, two points above his props, and with Roles now the
  // screen's opening tab the tap probe finally measured him: the chip's top
  // third hid under the sticky tab bar and his hit area read 26px. A front row
  // stands level anyway.
  const SPOTS: [number, number][] = [
    [22, 9], [50, 9], [78, 9],
    [36, 20], [64, 20],
    [14, 32], [86, 32], [50, 33],
    [50, 46], [30, 57],
    [12, 78], [46, 64], [66, 72], [88, 80], [50, 90],
  ]
  const go = useStore.getState().go
  const roleSheet = () => {
    if (roleSlot == null) return null
    const pid = tac.lineup[roleSlot]
    const p = pid != null ? game.players[pid] : null
    const roles = rolesForSlot(roleSlot)
    const current = tac.roles?.[roleSlot] ?? null
    return (
      <div className="modal-veil" onClick={() => setRoleSlot(null)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="grab" />
          <div style={{ padding: '0 14px 10px' }}>
            <SectionTitle sub={t('tacticsScreen.roleSheetSub', { shirt: XV_SLOTS[roleSlot].shirt, n: roles.length + 1 })}>
              {p ? p.name : t('tacticsScreen.emptySlot')}
            </SectionTitle>
            <button className="club-pick" onClick={() => { (tac.roles ??= [])[roleSlot] = null; setRoleSlot(null); touch() }}>
              <span style={{ fontSize: 16 }}>{current == null ? '●' : '○'}</span>
              <span className="cname">{t('tacticsScreen.natural')}</span>
              <span className="muted" style={{ maxWidth: '55%', textAlign: 'right' }}>{t('tacticsScreen.noInstruction')}</span>
            </button>
            {roles.map(r => (
              <button key={r.id} className="club-pick" onClick={() => { (tac.roles ??= [])[roleSlot] = r.id; setRoleSlot(null); touch() }}>
                <span style={{ fontSize: 16 }}>{current === r.id ? '●' : '○'}</span>
                <span className="cname">{t(r.name)}</span>
                <span className="muted" style={{ maxWidth: '55%', textAlign: 'right' }}>{t(r.desc)}</span>
              </button>
            ))}
            {p && (
              <button className="btn ghost block" style={{ marginTop: 8 }}
                onClick={() => { setRoleSlot(null); go('player', p.id) }}>
                {t('tacticsScreen.openProfile', { name: p.name.split(' ').slice(-1)[0] })}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // YOU ARE BECOMING READABLE, said out loud, on the screen that fixes it.
  //
  // repetitionFatigue charges up to 12% extra energy drain for holding a dial
  // at an extreme five weeks running, and tendencyProfile lets an opposing
  // analyst set up against a manager who repeats himself. Neither had a word
  // anywhere in the UI: the squad tired faster every week with no cause on any
  // page, and the first news of being read was one commentary line at kick-off,
  // and only against one coach archetype. A cost the player cannot see is not a
  // trade-off, it is a bug with a spreadsheet behind it.
  const streaks = game.dialStreak ?? {}
  const worstDial = (['tempo', 'aggression', 'defLine'] as const)
    .map(k => ({ k, n: streaks[k] ?? 0 }))
    .sort((a, b) => b.n - a.n)[0]
  const repPct = Math.round((repetitionFatigue(game) - 1) * 100)

  return (
    <>
      <div className="tab-bar">
        {/* named for what is on it: role chips on a pitch (user: "change the
            tactics to roles") */}
        <button className={ttab === 'tactics' ? 'active' : ''} onClick={() => setTtab('tactics')}>{t('tacticsScreen.tabRoles')}</button>
        <button className={ttab === 'setp' ? 'active' : ''} onClick={() => setTtab('setp')}>{t('tacticsScreen.tabSetPiece')}</button>
        <button className={ttab === 'bench' ? 'active' : ''} onClick={() => setTtab('bench')}>{t('tacticsScreen.tabBench')}</button>
        <button className={ttab === 'prep' ? 'active' : ''} onClick={() => setTtab('prep')}>{t('tacticsScreen.tabPrep')}</button>
        <button className={ttab === 'plan' ? 'active' : ''} onClick={() => setTtab('plan')}>{t('tacticsScreen.tabPlan')}</button>
      </div>

      {repPct > 0 && worstDial && (
        <div className="card" style={{ borderLeft: '3px solid var(--gold)' }}>
          <div className="fact-label">{t('tacticsScreen.condCoach')}</div>
          <div style={{ fontSize: 13, lineHeight: 1.45, marginTop: 4 }}>
            {t('tacticsScreen.condLine', {
              n: worstDial.n,
              dial: t(worstDial.k === 'defLine' ? 'tacticsScreen.dialDefLine'
                : worstDial.k === 'tempo' ? 'tacticsScreen.dialTempo' : 'tacticsScreen.dialAggression'),
              pct: repPct,
            })}
          </div>
        </div>
      )}

      {ttab === 'tactics' && <>
        <div className="form-pitch">
          {SPOTS.map(([x, y], i) => {
            const pid = tac.lineup[i]
            const p = pid != null ? game.players[pid] : null
            const role = tac.roles?.[i] != null ? ROLE_BY_ID[tac.roles![i]!] : null
            return (
              <button key={i} className="form-chip"
                style={{ '--fx': `${x}%`, '--fy': `${y}%` } as React.CSSProperties}
                onClick={() => setRoleSlot(i)}>
                <span className="fc-role">{role ? t(role.short) : XV_SLOTS[i].pos}</span>
                <span className="fc-name">{p ? p.name.split(' ').slice(-1)[0] : '-'}</span>
                <span className="fc-num">{XV_SLOTS[i].shirt}</span>
              </button>
            )
          })}
        </div>
        <div className="meta" style={{ padding: '4px 16px' }}>
          {t('tacticsScreen.rolesNote')}
        </div>
      </>}

      {ttab === 'setp' && <>
        {/* ---- four questions, in the order a coach asks them ----
            This page had six blocks, two long explainer paragraphs and a stat
            line on every tile reading "62% drilled · called 4x this season ·
            worth +3%" (user: "set piece page feels too confusing - simplify").
            Three of those numbers say the same thing, so each tile now carries
            one: how well drilled the move is, and what that is worth today. The
            explainers are gone and the page states its own rule once, at the
            top. */}
        <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
          <div className="meta">
            <b>{t('tacticsScreen.setPieceRule')}</b> {t('tacticsScreen.setPieceRuleRest')}
          </div>
        </div>
        {([['lineout', 'tacticsScreen.lineoutCall', DEFAULT_LINEOUT, 'lineoutCall'],
           ['scrum', 'tacticsScreen.scrumCall', DEFAULT_SCRUM, 'scrumCall']] as const).map(([kind, heading, dflt, key]) => (
          <div key={kind}>
            <SectionTitle>{t(heading)}</SectionTitle>
            <div className="routine-grid">
              {ROUTINES.filter(r => r.kind === kind).map(r => {
                const on = (tac[key] ?? dflt) === r.id
                const e = routineEffect(club, r.id)
                return (
                  <button key={r.id} className={`speech-tile${on ? ' sel' : ''}`}
                    onClick={() => { tac[key] = r.id; touch() }}>
                    <b>{t(r.name)}</b>
                    <span className="d">{t(r.desc)}</span>
                    <span className="rt-bar"><i style={{ width: `${e.drilled}%` }} /></span>
                    <span className="d">
                      {t('tacticsScreen.drilled', { pct: Math.round(e.drilled) })}
                      {e.mult >= 1.02 ? t('tacticsScreen.worth', { pct: Math.round((e.mult - 1) * 100) })
                        : e.mult <= 0.98 ? t('tacticsScreen.costing', { pct: Math.round((1 - e.mult) * 100) }) : t('tacticsScreen.aboutLevel')}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        <SectionTitle>{t('tacticsScreen.goalKickers')}</SectionTitle>
        <div className="card">
          {[0, 1].map(slot => {
            const cur = (tac.kickers ?? [])[slot] ?? null
            const xv = tac.lineup.slice(0, 15).map(id => id != null ? game.players[id] : null).filter((p): p is Player => !!p)
            return (
              <div key={slot} className="lead-row">
                <span className="fact-label">{t(slot === 0 ? 'tacticsScreen.first' : 'tacticsScreen.second')}</span>
                <select className="inline-input" value={cur ?? ''}
                  onChange={ev => {
                    const v = ev.target.value === '' ? null : Number(ev.target.value)
                    const ks = [...(tac.kickers ?? [null, null])]
                    ks[slot] = v
                    tac.kickers = ks
                    touch()
                  }}>
                  <option value="">{t('tacticsScreen.assistantPicks')}</option>
                  {[...xv].sort((a, b) => b.a.goa - a.a.goa).map(p => (
                    <option key={p.id} value={p.id}>{t('tacticsScreen.kickerOption', { name: p.name, pos: p.pos, goa: p.a.goa })}</option>
                  ))}
                </select>
              </div>
            )
          })}
          <div className="meta" style={{ marginTop: 5 }}>{t('tacticsScreen.kickerNote')}</div>
        </div>

        <SectionTitle>{t('tacticsScreen.exiting')}</SectionTitle>
        <div className="card">
          <div className="opt-2x2">
            {([
              ['box', 'tacticsScreen.exitBox'],
              ['long', 'tacticsScreen.exitLong'],
              ['counter', 'tacticsScreen.exitCounter'],
              ['fifty22', 'tacticsScreen.exitFifty22'],
            ] as const).map(([id, label]) => (
              <button key={id} className={`preset-chip${(tac.exit ?? 'long') === id ? ' on' : ''}`}
                onClick={() => { tac.exit = id; touch() }}>{t(label)}</button>
            ))}
          </div>
          <div className="meta" style={{ marginTop: 6 }}>
            {t(({
              box: 'tacticsScreen.exitBoxDesc',
              long: 'tacticsScreen.exitLongDesc',
              counter: 'tacticsScreen.exitCounterDesc',
              fifty22: 'tacticsScreen.exitFifty22Desc',
            })[tac.exit ?? 'long'])}
          </div>
        </div>

        <SectionTitle>{t('tacticsScreen.kickablePenalty')}</SectionTitle>
        <div className="card">
          <div className="opt-2x2">
            {([
              ['ask', 'tacticsScreen.penAsk'],
              ['posts', 'tacticsScreen.penPosts'],
              ['corner', 'tacticsScreen.penCorner'],
              ['tap', 'tacticsScreen.penTap'],
            ] as const).map(([id, label]) => (
              <button key={id} className={`preset-chip${(tac.penaltyCall ?? 'ask') === id ? ' on' : ''}`}
                onClick={() => { tac.penaltyCall = id; touch() }}>{t(label)}</button>
            ))}
          </div>
          <div className="meta" style={{ marginTop: 6 }}>
            {t(({
              ask: 'tacticsScreen.penAskDesc',
              posts: 'tacticsScreen.penPostsDesc',
              corner: 'tacticsScreen.penCornerDesc',
              tap: 'tacticsScreen.penTapDesc',
            })[tac.penaltyCall ?? 'ask'])}
          </div>
        </div>
        <div className="spacer" />
      </>}


      {ttab === 'bench' && <>
        {/* The bench economy (F4). Eight replacements used to be eight fixed
            seats whose only job was replacing tired men. A modern 23 is an
            argument about the last twenty minutes, so it is a page. */}
        {(() => {
          const want = splitFor(club)
          const got = actualSplit(game, club)
          const legal = benchFrontRow(game, club)
          if (legal && want === got) return null
          return (
            <div className="card" style={{ borderLeft: `4px solid ${legal ? 'var(--gold)' : 'var(--danger)'}` }}>
              <div className="meta">
                {!legal && <b style={{ color: 'var(--danger)' }}>{t('tacticsScreen.noFrontRow')}</b>}
                {!legal
                  ? t('tacticsScreen.law3')
                  : t('tacticsScreen.splitMismatch', {
                      want: t(SPLITS.find(x => x.id === want)?.name ?? '').toLowerCase(),
                      got: t(SPLITS.find(x => x.id === got)?.name ?? '').toLowerCase(),
                    })}
              </div>
            </div>
          )
        })()}
        <SectionTitle sub={t('tacticsScreen.the23Sub')}>{t('tacticsScreen.the23')}</SectionTitle>
        <div className="routine-grid">
          {SPLITS.map(sp => {
            const on = splitFor(club) === sp.id
            const fw = sp.seats.filter(x => ['LP', 'HK', 'TP', 'LK', 'FL', 'N8'].includes(x.pos[0])).length
            return (
              <button key={sp.id} className={`speech-tile${on ? ' sel' : ''}`}
                onClick={() => {
                  tac.bench = sp.id as BenchSplit
                  // the seats changed shape, so the men in them are re-chosen
                  refillBench(game, club)
                  touch()
                }}>
                <b>{t(sp.name)}</b>
                <span className="d">{t(sp.desc)}</span>
                <span className="d">{t('tacticsScreen.splitCount', { fw, bk: 8 - fw })}</span>
              </button>
            )
          })}
        </div>
        <SectionTitle sub={t('tacticsScreen.finisherBriefsSub')}>{t('tacticsScreen.finisherBriefs')}</SectionTitle>
        <div className="brief-list">
          {seats.map((seat, i) => {
            const pid = tac.lineup[15 + i]
            const p = pid != null ? game.players[pid] : null
            const cur = briefForSeat(club, i)
            return (
              <div className="brief-row" key={i}>
                <div className="brief-who">
                  <span className="num">{seat.shirt}</span>
                  <PosBadge pos={seat.pos[0]} />
                  <span className="nm">{p ? p.name : <span className="muted">{t('tacticsScreen.emptySeat')}</span>}</span>
                </div>
                <div className="preset-row">
                  {BRIEFS.map(b => (
                    <button key={b.id} className={`preset-chip${cur === b.id ? ' on' : ''}`} title={t(b.desc)}
                      onClick={() => {
                        const arr = [...(tac.briefs ?? new Array(8).fill(null))]
                        while (arr.length < 8) arr.push(null)
                        arr[i] = b.id as Brief
                        tac.briefs = arr
                        touch()
                      }}>{b.icon} {t(b.short)}</button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        <div className="spacer" />
      </>}

      {ttab === 'prep' && <>
        <AnalystCard />
        <SectionTitle sub={t('tacticsScreen.matchPrepSub')}>{t('tacticsScreen.matchPrep')}</SectionTitle>
        <div className="preset-row" style={{ padding: '0 14px', flexWrap: 'wrap', gap: 8 }}>
          {([
            ['attack', 'analyst.prepAttack', 'tacticsScreen.prepAttackShort'],
            ['defence', 'analyst.prepDefence', 'tacticsScreen.prepDefenceShort'],
            ['setpiece', 'analyst.prepSetpiece', 'tacticsScreen.prepSetpieceShort'],
            ['fitness', 'analyst.prepFitness', 'tacticsScreen.prepFitnessShort'],
            ['recovery', 'analyst.prepRecovery', 'tacticsScreen.prepRecoveryShort'],
          ] as const).map(([k, label, desc]) => (
            <button key={k} className="preset-chip" title={t(desc)}
              style={game.matchPrep === k ? undefined : { background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
              onClick={() => { game.matchPrep = game.matchPrep === k ? undefined : k; touch() }}>
              {t(label)}
            </button>
          ))}
        </div>
        <div className="card" style={{ marginTop: 10 }}>
          <div className="meta">
            {t(game.matchPrep ? {
              attack: 'tacticsScreen.prepAttackLong',
              defence: 'tacticsScreen.prepDefenceLong',
              setpiece: 'tacticsScreen.prepSetpieceLong',
              fitness: 'tacticsScreen.prepFitnessLong',
              recovery: 'tacticsScreen.prepRecoveryLong',
            }[game.matchPrep] : 'tacticsScreen.prepNone')}
          </div>
        </div>
      </>}

      {ttab === 'plan' && <>
        <div className="card" style={{ marginTop: 4, borderLeft: '4px solid var(--gold)' }}>
          <div className="meta">{assistantAdvice(game)}</div>
        </div>
        {/* F23: the opposition dugout has a standing instruction now, so the game
            plan tab is the place to answer it. Reading how they play is free;
            what to do about it is the assistant's job, and it is advice rather
            than an answer - he cannot see whether you have the pack to back it. */}
        {(() => {
          const fx = userFixtureThisWeek(game)
          if (!fx) return null
          const oppId = fx.homeId === game.userClubId ? fx.awayId : fx.homeId
          const opp = game.clubs[oppId]
          const ph = philosophyOf(opp)
          const ctr = counterTo(opp?.philosophy)
          if (!ph || !ctr) return null
          return (
            <>
              <SectionTitle sub={t('tacticsScreen.theyPlay', { club: opp.short, style: t(ph.name).toLowerCase() })}>{t('tacticsScreen.answeringThem')}</SectionTitle>
              <div className="card">
                <div className="meta"><b>{t(ph.name)}.</b> {t(ph.blurb)}</div>
                <div className="meta muted">{dialLine(opp.tactic)}</div>
                <div className="meta" style={{ marginTop: 6 }}>
                  <b>{t('tacticsScreen.assistant')}</b> {t(ctr.line)}
                </div>
                {/* IT ALWAYS WORKED. IT NEVER SAID SO (owner, v1.1.13: "set
                    the counter plan doesnt do anything when you press it on
                    tactics").
                    The tap writes four dials onto the club's tactic - measured
                    50/50/50/50 before, 38/30/64/44 after - and then the screen
                    sat there, because the sliders it moved are three screenfuls
                    further down the same tab. A control whose whole effect is
                    off-screen and silent is a control that does nothing, which
                    is the failure this codebase has now fixed in four other
                    costumes. So it answers: the dials it just set, in the same
                    words the opposition's own read is written in. */}
                <button className="btn gold block tiny" style={{ marginTop: 6 }}
                  onClick={() => { Object.assign(tac, ctr.dials); setPlanMsg(dialLine(tac)); touch() }}>
                  {t('tacticsScreen.setCounterPlan')}
                </button>
                {planMsg && (
                  <div className="meta sheet-log" style={{ marginTop: 6, borderLeft: '3px solid var(--gold)', paddingLeft: 8 }}>
                    {t('tacticsScreen.planSet', { dials: planMsg })}
                  </div>
                )}
              </div>
            </>
          )
        })()}
        <SectionTitle sub={t('tacticsScreen.quickGamePlansSub')}>{t('tacticsScreen.quickGamePlans')}</SectionTitle>
        <div className="preset-row" style={{ padding: '0 14px' }}>
          {PRESETS.map(p => (
            <button key={p.id} className="preset-chip" title={t(p.desc)}
              onClick={() => { Object.assign(tac, p.values); setPlanMsg(dialLine(tac)); touch() }}>
              {p.icon} {t(p.name)}
            </button>
          ))}
        </div>
        {/* the quick plans move the same four dials from the same distance, so
            they get the same answer */}
        {planMsg && (
          <div className="meta sheet-log" style={{ margin: '6px 16px 0', borderLeft: '3px solid var(--gold)', paddingLeft: 8 }}>
            {t('tacticsScreen.planSet', { dials: planMsg })}
          </div>
        )}
        <SectionTitle sub={t('tacticsScreen.withTheBallSub')}>{t('tacticsScreen.withTheBall')}</SectionTitle>
        {SLIDER_INFO.map(slider)}
        <SectionTitle sub={t('tacticsScreen.withoutTheBallSub')}>{t('tacticsScreen.withoutTheBall')}</SectionTitle>
        {DEF_SLIDER_INFO.map(defSlider)}
      </>}

      {roleSheet()}
      <div className="spacer" />
    </>
  )
}

/**
 * The analyst's read on the next opponent (8-batch feedback). He names a soft
 * spot and the week's work to exploit it. Follow him and a sound read is worth
 * a few percent on the day; he is right most of the time, not every time, and
 * his record is on the card so you can judge him yourself.
 */
function AnalystCard() {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const fx = userFixtureThisWeek(game)
  if (!fx) {
    return (
      <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
        <div className="fact-label">{t('analyst.theAnalyst')}</div>
        <div className="meta">{t('analyst.noMatchToStudy')}</div>
      </div>
    )
  }
  const oppId = fx.homeId === game.userClubId ? fx.awayId : fx.homeId
  const opp = game.clubs[oppId]
  const read = analystRead(game, oppId)
  if (!read || !opp) return null
  const followed = game.matchPrep === read.prep
  return (
    <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div className="fact-label">{t('analyst.analystOn', { club: opp.short })}</div>
        <div className="meta" style={{ fontSize: 11 }}>{analystForm(game)}</div>
      </div>
      <div className="meta" style={{ marginTop: 2 }}>
        <b style={{ color: 'var(--gold)' }}>{unitLabel(read.unit)}.</b> {analystClaim(read)}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
        <button className="btn gold" style={{ padding: '5px 10px', fontSize: 11.5 }}
          disabled={followed}
          onClick={() => { game.matchPrep = read.prep; touch() }}>
          {followed ? t('analyst.preparing', { prep: prepLabel(read.prep) }) : t('analyst.workOnIt', { prep: prepLabel(read.prep) })}
        </button>
        <span className="meta" style={{ fontSize: 11 }}>
          {t(followed ? 'analyst.weekIsHis' : 'analyst.ignoreHim')}
        </span>
      </div>
    </div>
  )
}
