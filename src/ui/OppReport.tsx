/**
 * The tactical loop on screen (#181): the opposition report and the response
 * plan on the Tactics screen's Prep tab, under the analyst's card, and the
 * match analysis on the full-time review, under the coach's verdict.
 *
 * No new screen: both halves fold into cards the manager already reads. Both
 * are compact at phone width - the report shows four lines and folds the rest
 * away. Since 1.8.3 the plans are on the Prep tab (a stack since round 6) and the
 * report sits behind that tab's info button.
 */
import { useState } from 'react'
import { useStore } from '../store'
import { t } from '../game/i18n'
import { userMatchThisWeek } from '../game/season'
import { prepLabel } from '../game/analyst'
import { teamShort } from '../game/matchEngine'
import {
  applyPlan, buildReport, isClubFixture, isCurrent, opponentIn, planOptions,
  type FindingCat, type PlanLevers, type PlanOption,
} from '../game/oppreport'
import { buildFindings, lineText } from '../game/matchfindings'
import { rewardedAvailable } from '../game/monetise'
import { canTapeRoom } from '../game/rewarded'
import { RewardedButton } from './components'

function leverLine(L: PlanLevers): string {
  const parts: string[] = []
  if (L.prep) parts.push(t('oppreport.lvPrep', { prep: prepLabel(L.prep) }))
  for (const [k, v] of Object.entries(L.dials ?? {})) parts.push(t('oppreport.lvDial', { dial: t(`oppreport.d_${k}`), v: v as number }))
  if (L.kickStyle) parts.push(t('oppreport.lvKick', { kick: t(`oppreport.ks_${L.kickStyle}`) }))
  if (L.lineoutCall) parts.push(t('oppreport.lvCall', { call: t(`playbook.${L.lineoutCall}`) }))
  if (L.scrumCall) parts.push(t('oppreport.lvCall', { call: t(`playbook.${L.scrumCall}`) }))
  if (L.brief) parts.push(t('oppreport.lvBrief', { brief: t(`bench.brief${L.brief[0].toUpperCase()}${L.brief.slice(1)}`) }))
  return parts.join(' · ')
}

function planDesc(o: PlanOption): string {
  const unit = typeof o.target === 'string' && o.target !== 'style' && o.target !== 'late' && o.target !== 'ball'
    ? t(`oppreport.u_${o.target}`) : ''
  return t(`oppreport.planDesc_${o.id}`, { unit })
}

/** Who the Prep tab is preparing for this week, or null without a match. */
export function usePrepOpponent(): string | null {
  const game = useStore(s => s.game)!
  const fx = userMatchThisWeek(game)
  const oppId = fx ? opponentIn(game, fx) : null
  return oppId ? teamShort(game, oppId) : null
}

/** THE RESPONSE PLANS (owner, 1.8.3: "Prep page - simplify, too much text,
 *  just a few options to select"; round 6: "make these options stacked").
 *  One full-width option a plan, stacked: its name, and under it, smaller and
 *  grey, one short line on what it is for, in the look of the board's
 *  decisions (OptionLabel). The one the club is carrying says what it set,
 *  in one line under the stack. */
export function ResponsePlans() {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const fx = userMatchThisWeek(game)
  const oppId = fx ? opponentIn(game, fx) : null
  if (!fx || !oppId || !isClubFixture(game, fx)) return null
  const opts = planOptions(game, fx)
  if (!opts.length) return null
  const on = opts.find(o => isCurrent(game, oppId, o))
  return (
    <div className="prep-plans">
      <div className="plan-stack" role="radiogroup" aria-label={t('oppreport.planTitle')}>
        {opts.map(o => {
          const sel = o === on
          return (
            <button key={o.id} className={`plan-opt${sel ? ' on' : ''}`} role="radio" aria-checked={sel} data-plan={o.id}
              onClick={() => { if (!sel) { applyPlan(game, fx, o); touch() } }}>
              <span className="opt-label">
                <span className="opt-main">{t(`oppreport.plan_${o.id}`)}</span>
                <span className="opt-detail">{planDesc(o)}</span>
              </span>
            </button>
          )
        })}
      </div>
      {on && <div className="meta prep-line" data-plan-on={on.id}>{leverLine(on.levers)}</div>}
    </div>
  )
}

/** The opposition report, for the Prep tab's info panel. Renders nothing
 *  without a match. */
export function OppReportCard() {
  const game = useStore(s => s.game)!
  const rewardTapeRoom = useStore(s => s.rewardTapeRoom)
  const [more, setMore] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const fx = userMatchThisWeek(game)
  if (!fx) return null
  const oppId = opponentIn(game, fx)
  if (!oppId) return null
  const club = isClubFixture(game, fx)
  const rep = buildReport(game, oppId)
  // the analyst's card above already says the soft spot for a club fixture
  const lines = rep.lines.filter(l => !(club && l.cat === 'soft'))
  // what matters most first: the last meeting, then the rest in report order
  // (1.8.2: then what their analysts have on our own calls, the arms race)
  const ordered = [...lines.filter(l => l.cat === 'history'), ...lines.filter(l => l.cat === 'calls'), ...lines.filter(l => l.cat !== 'history' && l.cat !== 'calls')]
  const shown = more ? ordered : ordered.slice(0, 4)
  const opts = club ? planOptions(game, fx) : []
  return (
    <div className="card opp-report" style={{ borderLeft: '4px solid var(--gold)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <div className="fact-label">{t('oppreport.title', { club: teamShort(game, oppId) })}</div>
        <b className="meta" style={{ fontSize: 11 }} data-band={rep.band}>{t(`oppreport.band_${rep.band}`)}</b>
      </div>
      <div className="meta muted" style={{ fontSize: 11 }}>{t(`oppreport.bandHint_${rep.band}`)}</div>
      <div style={{ marginTop: 4 }}>
        {shown.map((l, i) => (
          <div key={i} className="meta" data-cat={l.cat} data-conf={l.conf} style={{ fontSize: 12, padding: '2px 0' }}>
            {lineText(l)}
            {/* how sure he is of it (1.8.2): the soft spot says so in its own words */}
            {l.conf && l.cat !== 'soft' && <span className="muted" style={{ fontSize: 11 }}> ({t(`oppreport.sure${l.conf === 'high' ? 'High' : l.conf === 'mid' ? 'Mid' : 'Low'}`)})</span>}
            {/* TAPE ROOM NIGHT (1.8.2, rewarded.ts): on the line it answers,
                only while the report cannot say, once a match */}
            {l.cat === 'calls' && l.k === 'armsrace.tapeUnread' && club && rewardedAvailable('taperoom') && canTapeRoom(game, oppId) && (
              <>{' '}<RewardedButton place="taperoom" className="btn ghost tiny spot" style={{ marginLeft: 2, verticalAlign: 'baseline' }} label={t('till.watchTapeRoom')}
                onDone={out => {
                  if (out === 'completed') setNote(rewardTapeRoom(oppId) ? null : t('till.favourGone'))
                  else setNote(t(out === 'skipped' ? 'till.spotSkipped' : 'till.spotUnavailable'))
                }} /></>
            )}
            {l.cat === 'calls' && note && <div className="muted" style={{ fontSize: 11 }}>{note}</div>}
          </div>
        ))}
      </div>
      {ordered.length > 4 && (
        <button className="preset-chip" style={{ marginTop: 4 }} onClick={() => setMore(!more)}>
          {t(more ? 'oppreport.showLess' : 'oppreport.showMore')}
        </button>
      )}
      {!club && <div className="meta" style={{ marginTop: 6, fontSize: 12 }}>{t('oppreport.testNote')}</div>}
      {/* what the plan chips on the page do, said once, here (1.8.3) */}
      {opts.length > 0 && (
        <>
          <div className="fact-label" style={{ marginTop: 8 }}>{t('oppreport.planTitle')}</div>
          {opts.map(o => (
            <div key={o.id} className="meta" style={{ fontSize: 12, padding: '2px 0' }}>
              <b>{t(`oppreport.plan_${o.id}`)}.</b> {planDesc(o)}
            </div>
          ))}
          <div className="meta muted" style={{ fontSize: 11 }}>{t('oppreport.planSub')}</div>
        </>
      )}
    </div>
  )
}

const CAT_ORDER: FindingCat[] = ['strategic', 'tactical', 'setpiece', 'physical', 'player']

/** The findings on the full-time review. Read from the finished match; the
 *  store files the same record on the save when the manager moves on. */
export function MatchFindings() {
  const game = useStore(s => s.game)!
  const live = useStore(s => s.liveMatch)
  if (!live || live.ctx.seg !== 3) return null
  const rec = buildFindings(game, live.ctx)
  if (!rec || !rec.items.length) return null
  const items = [...rec.items].sort((a, b) => CAT_ORDER.indexOf(a.cat) - CAT_ORDER.indexOf(b.cat))
  const colour = (tone: number) => tone > 0 ? 'var(--text-positive)' : tone < 0 ? 'var(--text-negative)' : 'var(--text-muted)'
  return (
    <div className="card match-findings" style={{ borderLeft: '4px solid var(--gold)', marginTop: 12 }}>
      <div className="fact-label">{t('oppreport.findingsTitle')}</div>
      {items.map((f, i) => (
        <div key={i} className="fix-row" data-cat={f.cat}>
          <b style={{ flex: '0 0 74px', fontSize: 11, color: colour(f.tone), fontFamily: 'var(--cond)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {t(`oppreport.cat_${f.cat}`)}
          </b>
          <span style={{ fontSize: 12, minWidth: 0 }}>{lineText(f)}</span>
        </div>
      ))}
      {game.clubs[rec.oppId] && <div className="meta muted" style={{ fontSize: 11, marginTop: 4 }}>{t('oppreport.filed')}</div>}
    </div>
  )
}
