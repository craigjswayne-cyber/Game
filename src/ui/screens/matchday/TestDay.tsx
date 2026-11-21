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
import { nationName, nationVars } from '../../../game/nations'
import { natRankOrder } from '../../../game/natrank'
import { NAT_DIALS, natPlanOf } from '../../../game/natcamp'
import { NAT_KIT_FALLBACK, NAT_KIT_FALLBACK_OPP, natAnthem, natChallenge, natKit } from '../../../data/natcolours'
import { SLIDER_INFO, sliderReadout } from '../../../game/tactics'
import { effAt } from '../../../game/attributes'
import { XV_SLOTS, type Fixture } from '../../../game/model'
import { Flag } from '../../flags'
import { isLight } from '../../highlight/draw'
import { FACING_FRONT, RITUAL_FRONT, RITUAL_WIDTH, facingLine, ritualFormation, type RitualSpot } from '../../ritual'

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
  // a provincial side on tour has no world ranking (QA, 1.9.15: "world no. -")
  const club = game.clubs[opp]
  return (
    <div className="card test-analyst" data-test-analyst>
      <div className="fact-label">{t('testday.analysts')}</div>
      {/* and the Isles XV is not ranked either: no "world no. -" */}
      {!club && rk(nat) > 0 && rk(opp) > 0 && <div className="meta" style={{ marginTop: 3 }}>
        {t('testday.ranks', { nat: nationName(nat), n: rk(nat) || '-', opp: nationName(opp), m: rk(opp) || '-' })}
      </div>}
      <ul className="test-reads">
        {gap(theirBest) > 0.02 && <li>{t('testday.theirEdge', { opp: club?.name ?? nationName(opp), unit: unitName(theirBest) })}</li>}
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

/** One player as the match draws him: a disc in the shirt colour, the edge
 *  in the second colour, the number on top, the captain ringed in white
 *  (owner, 1.9.14: "it should stay as the circles for in game"). */
function Figure({ kit, n, cap }: { kit: [string, string]; n: number; cap?: boolean }) {
  return (
    <svg className="wo-fig" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10.8" r="8.4" fill="black" fillOpacity=".28" />
      <circle cx="10" cy="10" r="8.4" fill={kit[0]} stroke={cap ? 'var(--prop-ink)' : kit[1]} strokeWidth={cap ? 2 : 1.2} />
      <text x="10" y="10.5" textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="800"
        fill={isLight(kit[0]) ? 'var(--prop-ink-dark)' : 'var(--prop-ink)'}>{n}</text>
    </svg>
  )
}

/** the line under the pitch that says what the shape is, by side */
const FORM_K: Record<string, string> = {
  NZL: 'walkout.formNZL', FIJ: 'walkout.formFIJ', SAM: 'walkout.formSAM', TGA: 'walkout.formTGA',
}
/** the matchday squad stands for it, the bench as well */
const RITUAL_MEN = 23
/** a man's disc on the challenge pitch, in metres: 2.3 across */
const RITUAL_R = 1.15

export interface RitualSide { code: string; kit: [string, string]; performs: boolean; front: number; capAt: number | null }

/**
 * THE CHALLENGE, IN ITS SHAPE (1.9.16, owner: "they should be in the
 * formations that set up in for it not just a straight line"). A strip of the
 * field either side of halfway, seen from above and drawn in metres: the side
 * laying it down in its own shape behind its ten-metre line (ui/ritual.ts),
 * the side facing it in one line arm in arm on halfway. Where both lay one
 * down they face each other in formation, the hosts up to halfway and the
 * visitors behind their ten, as the toss would have it.
 *
 * The leader of a shape is its first man. For your own side that is your
 * captain, ringed as he is everywhere else; for theirs nobody is named.
 */
export function RitualPitch({ top, bottom, label }: { top: RitualSide; bottom: RitualSide; label: string }) {
  const spots = (s: RitualSide): RitualSpot[] => s.performs ? ritualFormation(s.code, RITUAL_MEN, s.front) : facingLine(RITUAL_MEN, s.front)
  // the number on each man: along the line as they stand for the anthems, and
  // in a shape the captain's own shirt on the leader, the rest in order
  const shirts = (s: RitualSide): number[] => {
    const all = Array.from({ length: RITUAL_MEN }, (_, k) => k + 1)
    if (!s.performs || s.capAt == null) return all
    return [s.capAt + 1, ...all.filter(n => n !== s.capAt! + 1)]
  }
  const ts = spots(top), bs = spots(bottom)
  const edge = RITUAL_R + 1.1
  const half = Math.max(...ts.map(p => p.back)) + edge
  const h = half + Math.max(...bs.map(p => p.back)) + edge
  const side = (s: RitualSide, sp: RitualSpot[], dir: -1 | 1) => {
    const nums = shirts(s)
    return (
      <g className={`wo-rit-side${s.performs ? ' wo-rit-form' : ''}`} data-ritual-side={s.code} data-ritual-role={s.performs ? 'challenge' : 'facing'}
        data-ritual={s.performs ? s.code : undefined} data-ritual-facing={s.performs ? undefined : ''}
        style={{ ['--wo-adv' as string]: `${dir * 3}px` }}>
        {sp.map((p, i) => {
          const cap = s.capAt != null && (s.performs ? i === 0 : i === s.capAt)
          return (
            <g key={i} data-fig={nums[i]} data-leader={s.performs && i === 0 ? '' : undefined} transform={`translate(${p.x.toFixed(2)} ${(half + dir * p.back).toFixed(2)})`}>
              <circle cy=".12" r={RITUAL_R} fill="black" fillOpacity=".28" />
              <circle r={RITUAL_R - 0.1} fill={s.kit[0]} stroke={cap ? 'var(--prop-ink)' : s.kit[1]} strokeWidth={cap ? 0.3 : 0.18} />
              <text y=".08" textAnchor="middle" dominantBaseline="middle" fontSize="1.25" fontWeight="800"
                fill={isLight(s.kit[0]) ? 'var(--prop-ink-dark)' : 'var(--prop-ink)'}>{nums[i]}</text>
            </g>
          )
        })}
      </g>
    )
  }
  const mark = (y: number, cls: string) => y > 0.5 && y < h - 0.5
    ? <line className={`wo-rit-mark ${cls}`} x1="0" x2={RITUAL_WIDTH} y1={y} y2={y} /> : null
  return (
    <div className="wo-pitch wo-ritual" data-ritual-pitch data-ritual-both={top.performs && bottom.performs ? '' : undefined}>
      <svg viewBox={`0 0 ${RITUAL_WIDTH} ${h.toFixed(2)}`} role="img" aria-label={label}>
        {mark(half, 'wo-rit-half')}
        {mark(half - RITUAL_FRONT, 'wo-rit-ten')}
        {mark(half + RITUAL_FRONT, 'wo-rit-ten')}
        {side(top, ts, -1)}
        {side(bottom, bs, 1)}
      </svg>
    </div>
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
  // the ring on the captain's own shirt, not always on the 1 (QA, 1.9.14)
  const capAt = capId != null ? lineup.slice(0, 15).indexOf(capId) : 0
  // A TOUR'S PROVINCIAL GAME IS NOT A TEST (QA, 1.9.15): a club has no
  // anthem, no challenge and no flag, and its name is its own, not a code
  const vsClub = !!game.clubs[fx.homeId] || !!game.clubs[fx.awayId]
  const sideName = (id: string) => game.clubs[id]?.name ?? nationName(id)
  // the visitors first, as the anthems go; both, where both lay one down
  const challengers = vsClub ? [] : [fx.awayId, fx.homeId].filter(c => natChallenge(c))
  const challenger = challengers.length === 1 ? challengers[0] : challengers.find(c => c !== nat) ?? challengers[0]
  const beats: ('out' | 'anthems' | 'challenge' | 'ko')[] = ['out', ...(vsClub ? [] : ['anthems' as const]), ...(challenger ? ['challenge' as const] : []), 'ko']
  const [i, setI] = useState(0)
  const beat = beats[i]
  const myKit = natKit(nat) ?? NAT_KIT_FALLBACK
  const oppKit = natKit(opp) ?? NAT_KIT_FALLBACK_OPP
  const line = (kit: [string, string], c: boolean) => (
    <div className="wo-line" aria-hidden="true">
      {Array.from({ length: 15 }, (_, k) => <Figure key={k} kit={kit} n={k + 1} cap={c && k === capAt} />)}
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
        {!game.clubs[fx.homeId] && <Flag code={fx.homeId} size={22} />} <b>{sideName(fx.homeId)}</b> <span className="muted">{t('common.v')}</span> <b>{sideName(fx.awayId)}</b> {!game.clubs[fx.awayId] && <Flag code={fx.awayId} size={22} />}
      </div>
      <div className="wo-body" key={beat}>
        {beat === 'out' && <>
          <h2>{t('walkout.outTitle')}</h2>
          <p>{cap ? t('walkout.leadsOut', { captain: cap.name, nat: nationName(nat), ...nationVars(nat) }) : t('walkout.leadsOutNone', { nat: nationName(nat), ...nationVars(nat) })}</p>
          <p className="muted">{t('walkout.crowd')}</p>
          <div className="wo-pitch wo-walk">{line(myKit, !!cap)}</div>
        </>}
        {beat === 'anthems' && <>
          <h2>{t('walkout.anthemsTitle')}</h2>
          <p>{t('walkout.stand')}</p>
          {/* WHERE THEY STAND (owner: "Players should lineup on the pitch
              where they traditionally do"): one line each, either side of
              halfway, facing the main stand - the visitors on one half, the
              hosts on the other - not two rows facing each other */}
          <div className="wo-pitch wo-anthem-line" data-anthem-line>
            <div className="wo-mark wo-half" aria-hidden="true" />
            <div className="wo-mark wo-ten wo-ten-l" aria-hidden="true" />
            <div className="wo-mark wo-ten wo-ten-r" aria-hidden="true" />
            <div className="wo-row">
              <div className="wo-side" data-side="away">{line(fx.awayId === nat ? myKit : oppKit, fx.awayId === nat && !!cap)}</div>
              <div className="wo-side" data-side="home">{line(fx.homeId === nat ? myKit : oppKit, fx.homeId === nat && !!cap)}</div>
            </div>
            <div className="wo-stand-label">{t('walkout.mainStand')}</div>
          </div>
          <ol className="wo-anthems">
            <li>{anthemLine(fx.awayId)}</li>
            <li>{anthemLine(fx.homeId)}</li>
          </ol>
        </>}
        {beat === 'challenge' && challenger && (() => {
          const both = challengers.length > 1
          const mine = (code: string) => code === nat
          const sideOf = (code: string, performs: boolean, front: number): RitualSide => ({
            code, kit: mine(code) ? myKit : oppKit, performs, front, capAt: mine(code) && cap ? capAt : null,
          })
          const form = (code: string) => t(FORM_K[code] ?? 'walkout.formTGA')
          // one challenge: the side laying it down at the top, behind its ten,
          // and the other on halfway. Two: the visitors at the top behind
          // their ten and the hosts up to halfway, ten metres between them.
          const other = challenger === fx.homeId ? fx.awayId : fx.homeId
          const top = both ? sideOf(fx.awayId, true, RITUAL_FRONT) : sideOf(challenger, true, RITUAL_FRONT)
          const bottom = both ? sideOf(fx.homeId, true, FACING_FRONT) : sideOf(other, false, FACING_FRONT)
          const caps = both
            ? [fx.awayId, fx.homeId].map(c => t('walkout.formOf', { nat: nationName(c), form: form(c) }))
            : [form(challenger), t('walkout.facing')]
          return <>
            <h2>{t('walkout.challengeTitle')}</h2>
            <p>{both
              ? t('walkout.bothChallenge', { a: nationName(fx.awayId), challengeA: natChallenge(fx.awayId)!, b: nationName(fx.homeId), challengeB: natChallenge(fx.homeId)! })
              : challenger === nat
                ? t('walkout.ourChallenge', { nat: nationName(nat), ...nationVars(nat), challenge: natChallenge(challenger)! })
                : t('walkout.theirChallenge', { opp: nationName(challenger), challenge: natChallenge(challenger)! })}</p>
            <RitualPitch top={top} bottom={bottom} label={caps.join(' ')} />
            <div className="wo-ritual-cap" data-ritual-caption>
              {caps.map((c, k) => <p key={k} className="muted">{c}</p>)}
            </div>
          </>
        })()}
        {beat === 'ko' && <>
          <h2>{t('walkout.koTitle')}</h2>
          <p>{t('walkout.koLine', { nat: nationName(nat), ...nationVars(nat) })}</p>
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
