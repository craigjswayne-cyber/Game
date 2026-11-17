// ---- THE TEST DAY (1.9.14) ----
//
// Owner, after the international review: the national job "should be an
// honour" and a Test "more fun to play"; on the walk-out, "they should stand
// for the anthems". A Test preview had the team sheet and a team talk, and
// nothing a club league match does not also have. These are the parts that
// make it a Test: the union analysts' read of the opponent, the national game
// plan and the captain (natcamp.ts natPlan), and the walk-out itself.
import { useState } from 'react'
import { useStore } from '../../../store'
import { posName, t } from '../../../game/i18n'
import { nationName } from '../../../game/nations'
import { natRankOrder } from '../../../game/natrank'
import { NAT_DIALS, natPlanOf } from '../../../game/natcamp'
import { natAnthem, natChallenge, natKit } from '../../../game/natcolours'
import { SLIDER_INFO, sliderReadout } from '../../../game/tactics'
import { effAt } from '../../../game/attributes'
import { XV_SLOTS, type Fixture } from '../../../game/model'
import { Flag } from '../../flags'

type Units = { scrum: number; lineout: number; breakdown: number; attack: number; defence: number }
const UNIT_KEYS: (keyof Units)[] = ['scrum', 'lineout', 'breakdown', 'attack', 'defence']
const unitName = (k: keyof Units) => t(`matchday.h2h${k[0].toUpperCase()}${k.slice(1)}`)

/** The union analysts' read: where they are stronger, where we are, and the
 *  man to watch. Read off the same units the head-to-head bars draw. */
export function AnalystReport({ nat, opp, mine, theirs, oppLineup }: {
  nat: string; opp: string; mine: Units; theirs: Units; oppLineup: (number | null)[]
}) {
  const game = useStore(s => s.game)!
  const order = natRankOrder(game)
  const gap = (k: keyof Units) => (theirs[k] - mine[k]) / Math.max(1e-6, (theirs[k] + mine[k]) / 2)
  const theirBest = [...UNIT_KEYS].sort((a, b) => gap(b) - gap(a))[0]
  const ourBest = [...UNIT_KEYS].sort((a, b) => gap(a) - gap(b))[0]
  const danger = oppLineup.slice(0, 15)
    .map((id, i) => (id != null ? { p: game.players[id], pos: XV_SLOTS[i].pos } : null))
    .filter((x): x is { p: NonNullable<typeof x>['p']; pos: (typeof XV_SLOTS)[number]['pos'] } => !!x?.p)
    .sort((a, b) => effAt(b.p, b.pos) - effAt(a.p, a.pos))[0]
  const rk = (c: string) => order.indexOf(c) + 1
  return (
    <div className="card test-analyst" data-test-analyst>
      <div className="fact-label">{t('testday.analysts')}</div>
      <div className="meta" style={{ marginTop: 3 }}>
        {t('testday.ranks', { nat: nationName(nat), n: rk(nat) || '-', opp: nationName(opp), m: rk(opp) || '-' })}
      </div>
      <ul className="test-reads">
        {gap(theirBest) > 0.02 && <li>{t('testday.theirEdge', { opp: nationName(opp), unit: unitName(theirBest) })}</li>}
        {gap(ourBest) < -0.02 && <li>{t('testday.ourEdge', { unit: unitName(ourBest) })}</li>}
        {danger && <li>{t('testday.danger', { name: danger.p.name, pos: posName(danger.pos) })}</li>}
      </ul>
    </div>
  )
}

/** The national game plan: the club's four dials, for the country. */
export function NatPlanDials({ compact = false, onChange }: { compact?: boolean; onChange?: () => void }) {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const [explain, setExplain] = useState<string | null>(null)
  const plan = natPlanOf(game)
  if (!plan) return null
  return (
    <div className={compact ? '' : 'card'} data-nat-plan>
      {!compact && <div className="fact-label">{t('testday.plan')}</div>}
      {!compact && <div className="meta" style={{ margin: '3px 0 6px' }}>{t('testday.planSub')}</div>}
      {NAT_DIALS.map(k => {
        const info = SLIDER_INFO.find(s => s.key === k)!
        return (
          <div key={k} className="dial-row" data-nat-dial={k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
            <span style={{ width: 78, fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--cond)', textTransform: 'uppercase', letterSpacing: .5 }}>{t(info.label)}</span>
            <input type="range" min={0} max={100} value={plan[k]} style={{ flex: 1, accentColor: 'var(--primary)' }}
              aria-label={t(info.label)} aria-valuetext={`${plan[k]}: ${sliderReadout(k, plan[k])}`}
              onChange={e => { plan[k] = Number(e.target.value); setExplain(`${t(info.label)}: ${sliderReadout(k, plan[k])}`); onChange?.(); touch() }} />
          </div>
        )
      })}
      {explain && <div className="meta" style={{ margin: '4px 0 0' }}>{explain}</div>}
    </div>
  )
}

/** The armband: the XV's natural leaders first. Leadership 12 or more is what
 *  the engine reads (match/setup.ts), so the line says so. */
export function NatCaptain({ lineup }: { lineup: (number | null)[] }) {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const plan = natPlanOf(game)
  if (!plan) return null
  const xv = lineup.slice(0, 15).map(id => (id != null ? game.players[id] : null)).filter((p): p is NonNullable<typeof p> => !!p)
  const leaders = [...xv].sort((a, b) => b.a.lea - a.a.lea).slice(0, 6)
  const cap = plan.captain != null && xv.some(p => p.id === plan.captain) ? plan.captain : null
  return (
    <div className="card" data-nat-captain>
      <div className="fact-label">{t('testday.captain')}</div>
      <div className="meta" style={{ margin: '3px 0 8px' }}>{t(cap != null ? 'testday.captainSet' : 'testday.captainNone')}</div>
      <div className="cap-chips">
        {leaders.map(p => (
          <button key={p.id} type="button" className={`chip cap-chip${cap === p.id ? ' sel' : ''}`} aria-pressed={cap === p.id} data-cap={p.id}
            onClick={() => { plan.captain = cap === p.id ? null : p.id; touch() }}>
            {p.name} <span className="muted">{t('testday.lea', { n: Math.round(p.a.lea) })}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** One standing player, in kit, with a shirt number. */
function Figure({ kit, n, cap }: { kit: [string, string]; n: number; cap?: boolean }) {
  return (
    <svg className="wo-fig" viewBox="0 0 20 44" aria-hidden="true">
      <circle cx="10" cy="6" r="4.2" fill="var(--wo-skin, #c9a27e)" />
      <rect x="3" y="11" width="14" height="16" rx="4" fill={kit[0]} stroke={kit[1]} strokeWidth="1.2" />
      <text x="10" y="22" textAnchor="middle" fontSize="7" fontWeight="700" fill={kit[1]}>{n}</text>
      <rect x="4.5" y="27" width="11" height="6" rx="1.5" fill={kit[1]} />
      <rect x="5" y="33" width="3.6" height="10" rx="1.5" fill={kit[0]} />
      <rect x="11.4" y="33" width="3.6" height="10" rx="1.5" fill={kit[0]} />
      {cap && <rect x="2" y="13" width="3" height="5" rx="1" fill="var(--gold)" />}
    </svg>
  )
}

/**
 * THE WALK-OUT. Out of the tunnel behind the captain, then both sides stand
 * in a line for the anthems (the visitors' first, then the hosts'), then the
 * challenge where a side lays one down, then the kick-off. One tap a beat, and
 * a way straight to the kick-off for anyone who has seen it.
 */
export function WalkOut({ fx, nat, lineup, onDone, onCancel }: {
  fx: Fixture; nat: string; lineup: (number | null)[]; onDone: () => void; onCancel: () => void
}) {
  const game = useStore(s => s.game)!
  const opp = fx.homeId === nat ? fx.awayId : fx.homeId
  const plan = natPlanOf(game)
  const capId = plan?.captain != null && lineup.slice(0, 15).includes(plan.captain) ? plan.captain : null
  const cap = capId != null ? game.players[capId] : null
  const challenger = [fx.homeId, fx.awayId].find(c => natChallenge(c))
  const beats: ('out' | 'anthems' | 'challenge' | 'ko')[] = ['out', 'anthems', ...(challenger ? ['challenge' as const] : []), 'ko']
  const [i, setI] = useState(0)
  const beat = beats[i]
  const myKit = natKit(nat) ?? ['#ffffff', '#1d2a5d']
  const oppKit = natKit(opp) ?? ['#333333', '#ffffff']
  const line = (kit: [string, string], c: boolean) => (
    <div className="wo-line" aria-hidden="true">
      {Array.from({ length: 15 }, (_, k) => <Figure key={k} kit={kit} n={k + 1} cap={c && k === 0} />)}
    </div>
  )
  const anthemLine = (code: string) => {
    const a = natAnthem(code)
    return a ? t('walkout.anthemOf', { nat: nationName(code), anthem: a }) : t('walkout.noAnthem', { nat: nationName(code) })
  }
  return (
    <div className="walkout" role="dialog" aria-modal="true" aria-label={t('walkout.title')} data-walkout={beat}
      style={{ ['--wo-a' as string]: myKit[0], ['--wo-b' as string]: oppKit[0] }}>
      <div className="wo-band" aria-hidden="true" />
      <div className="wo-head">
        <Flag code={fx.homeId} size={22} /> <b>{nationName(fx.homeId)}</b> <span className="muted">{t('common.v')}</span> <b>{nationName(fx.awayId)}</b> <Flag code={fx.awayId} size={22} />
      </div>
      <div className="wo-body" key={beat}>
        {beat === 'out' && <>
          <h2>{t('walkout.outTitle')}</h2>
          <p>{cap ? t('walkout.leadsOut', { captain: cap.name, nat: nationName(nat) }) : t('walkout.leadsOutNone', { nat: nationName(nat) })}</p>
          <p className="muted">{t('walkout.crowd')}</p>
          <div className="wo-pitch wo-walk">{line(myKit, !!cap)}</div>
        </>}
        {beat === 'anthems' && <>
          <h2>{t('walkout.anthemsTitle')}</h2>
          <p>{t('walkout.stand')}</p>
          <div className="wo-pitch wo-stand">
            {line(oppKit, false)}
            <div className="wo-gap" />
            {line(myKit, !!cap)}
          </div>
          <ol className="wo-anthems">
            <li>{anthemLine(fx.awayId)}</li>
            <li>{anthemLine(fx.homeId)}</li>
          </ol>
        </>}
        {beat === 'challenge' && challenger && <>
          <h2>{t('walkout.challengeTitle')}</h2>
          <p>{challenger === nat
            ? t('walkout.ourChallenge', { nat: nationName(nat), challenge: natChallenge(challenger)! })
            : t('walkout.theirChallenge', { opp: nationName(challenger), challenge: natChallenge(challenger)! })}</p>
          <div className="wo-pitch wo-stand">
            {line(challenger === nat ? myKit : oppKit, false)}
            <div className="wo-gap" />
            {line(challenger === nat ? oppKit : myKit, challenger !== nat && !!cap)}
          </div>
        </>}
        {beat === 'ko' && <>
          <h2>{t('walkout.koTitle')}</h2>
          <p>{t('walkout.koLine', { nat: nationName(nat) })}</p>
        </>}
      </div>
      <div className="wo-actions">
        {beat === 'ko'
          ? <button type="button" className="btn gold block" data-wo-kickoff onClick={onDone}>{t('walkout.kickOff')}</button>
          : <button type="button" className="btn gold block" data-wo-next onClick={() => setI(i + 1)}>{t('walkout.next')}</button>}
        <div className="wo-links">
          <button type="button" className="btn ghost tiny" onClick={onCancel}>{t('walkout.back')}</button>
          {beat !== 'ko' && <button type="button" className="btn ghost tiny" data-wo-skip onClick={onDone}>{t('walkout.skip')}</button>}
        </div>
      </div>
    </div>
  )
}
