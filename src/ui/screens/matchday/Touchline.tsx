// The touchline panel: team talk, tactics and replacements.

import { useState } from 'react'
import { useStore } from '../../../store'
import { MAX_SUBS } from '../../../game/matchEngine'
import { PRESETS, SLIDER_INFO, sliderReadout } from '../../../game/tactics'
import { posName, t } from '../../../game/i18n'
import { currentPlan, planFollowed } from '../../../game/oppreport'
import { TalkReactions } from '../../TalkReactions'
import type { HtTone } from '../../../game/teamtalk'
import { Glyph } from '../../glyphs'
import { rowNav } from '../../rowNav'
import { condWord, EnergyBars, SquadSheet, usableChanges } from './SquadSheet'
import { StatsPanel } from './Stats'
import { acc } from '../../accent'

/** The touchline panel: team talk (HT only), tactics with plain-English
 *  readouts and one-tap presets, and substitutions with energy bars. */
export function TouchlinePanel({ title, showTalk, onResume, resumeLabel }: {
  title: string
  showTalk: boolean
  onResume: () => void
  resumeLabel: string
}) {
  const game = useStore(s => s.game)!
  const live = useStore(s => s.liveMatch)!
  const { teamTalk, liveTactics, touch } = useStore.getState()
  const [squadOpen, setSquadOpen] = useState(false)
  const [explain, setExplain] = useState<string | null>(null)

  const ctx = live.ctx
  const club = game.clubs[game.userClubId]
  const isClubMatch = ctx.userSideId === game.userClubId
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  const bench = mine.lineup.slice(15).map(id => id != null ? game.players[id] : null)
    .filter(p => p && !p.injury && !mine.onPitch.has(p.id) && !mine.ratings.has(p.id))

  // the assistant's whisper: who's gassed, who's struggling, who's on thin ice
  const advice: string[] = []
  if (ctx.subsUsed < 5) {
    const tired = [...mine.onPitch]
      .map(id => ({ p: game.players[id], e: mine.energy.get(id) ?? 100 }))
      .filter(x => x.p && x.e < 38)
      .sort((a, b) => a.e - b.e)
    for (const { p, e } of tired.slice(0, 2)) {
      const cover = bench.find(b => b && (b.pos === p!.pos || b.alt.includes(p!.pos)))
      advice.push(cover
        ? t('matchday.adviceTiredCover', { player: p!.name, word: condWord(e), cover: cover.name, pos: posName(p!.pos) })
        : t('matchday.adviceTired', { player: p!.name, word: condWord(e) }))
    }
  }
  const min = ctx.tick * 4
  if (min >= 45) {
    const poor = [...mine.ratings.entries()]
      .map(([id, r]) => ({ p: game.players[id], r }))
      .filter(x => x.p && mine.onPitch.has(x.p.id) && x.r < 4.6)
      .sort((a, b) => a.r - b.r)[0]
    if (poor) advice.push(t('matchday.advicePoor', { player: poor.p!.name, rating: poor.r.toFixed(1) }))
  }
  for (const e of live.events.slice(0, live.cursor)) {
    if (e.type === 'YC' && e.playerId != null && mine.onPitch.has(e.playerId) && (mine.yellowUntil.get(e.playerId) ?? 0) <= min) {
      const p = game.players[e.playerId]
      if (p) advice.push(t('matchday.adviceCard', { player: p.name }))
      break
    }
  }

  // six tones, in the order a manager reaches for them: the steadying ones,
  // the lifting ones, the stakes-raising ones (teamtalk.ts reads each man)
  const talks: readonly (readonly [HtTone, string])[] = [
    ['calm', 'matchday.talkCalm'],
    ['faith', 'matchday.talkFaith'],
    ['praise', 'matchday.talkPraise'],
    ['fire', 'matchday.talkFire'],
    ['demand', 'matchday.talkDemand'],
    ['criticise', 'matchday.talkCriticise'],
  ]

  const applyPreset = (values: { style: number; tempo: number; kicking: number; aggression: number }) => {
    club.tactic.style = values.style
    club.tactic.tempo = values.tempo
    club.tactic.kicking = values.kicking
    club.tactic.aggression = values.aggression
    liveTactics()
    touch()
  }

  return (
    <div className="card" style={{ margin: '12px 0', ...acc('var(--gold)') }}>
      <h3 style={{ fontSize: '1rem' }}>{title}</h3>
      {advice.length > 0 && (
        <div style={{ margin: '6px 0 2px', padding: '8px 10px', background: 'color-mix(in srgb, var(--gold) 14%, var(--surface-1))', borderRadius: 8 }}>
          <div className="fact-label">{t('matchday.assistantNotes')}</div>
          {advice.slice(0, 3).map((a, i) => (
            <div key={i} className="meta" style={{ marginTop: 3 }}>{a}</div>
          ))}
        </div>
      )}
      <StatsPanel />
      {showTalk && (!ctx.talkUsed ? (
        <>
          <div className="fact-label" style={{ marginTop: 4 }}>{t('matchday.teamTalk')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
            {talks.map(([k, label]) => (
              <button key={k} className="btn ghost" style={{ fontSize: '0.8125rem', padding: '9px 6px' }}
                onClick={() => teamTalk(k)}>{t(label)}</button>
            ))}
          </div>
        </>
      ) : ctx.htReads?.length ? (
        <TalkReactions game={game} reads={ctx.htReads} lineup={mine.lineup} msg={live.talkMsg} />
      ) : live.talkMsg && (
        <div className="meta" style={{ margin: '6px 0' }}>{live.talkMsg}</div>
      ))}

      {isClubMatch && <>
      <div className="fact-label" style={{ marginTop: 12 }}>{t('matchday.quickPlans')}</div>
      <div className="preset-row">
        {PRESETS.map(p => (
          <button key={p.id} className="preset-chip" title={t(p.desc)}
            onClick={() => {
              // the prep plan this sets aside, said as it happens (1.8.5):
              // full time judges it on the part of the match it was played for
              const opp = mine === ctx.home ? ctx.away : ctx.home
              const plan = currentPlan(game, opp.teamId)
              const had = !!plan && planFollowed(game, plan)
              applyPreset(p.values)
              const aside = had && !planFollowed(game, plan!) ? ` ${t(ctx.tick >= 10 ? 'matchday.planAside' : 'matchday.planAsideEarly', { plan: t(`oppreport.plan_${plan!.id}`) })}` : ''
              setExplain(`${t(p.name)}: ${t(p.desc)}${aside}`)
            }}>
            <Glyph name={p.icon} /> {t(p.name)}
          </button>
        ))}
      </div>

      <div className="fact-label" style={{ marginTop: 10 }}>{t('matchday.inMatchTactics')} <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{t('matchday.tapAName')}</span></div>
      {SLIDER_INFO.map(s => (
        <div key={s.key} data-dial={s.key} className="dial-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0', borderRadius: 6 }}>
          <span style={{ width: 78, fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--cond)', textTransform: 'uppercase', letterSpacing: .5, cursor: 'pointer' }}
            {...rowNav(() => setExplain(`${t(s.label)}: ${sliderReadout(s.key, club.tactic[s.key])}`))}>
            {t(s.label)}
          </span>
          <input type="range" min={0} max={100} value={club.tactic[s.key]} style={{ flex: 1, accentColor: 'var(--primary)' }}
            aria-label={t(s.label)} aria-valuetext={`${club.tactic[s.key]}: ${sliderReadout(s.key, club.tactic[s.key])}`}
            onChange={e => { club.tactic[s.key] = Number(e.target.value); liveTactics(); touch() }} />
        </div>
      ))}
      {explain && <div className="meta" style={{ margin: '6px 0' }}>{explain}</div>}
      </>}

      {/* One button into the match-day squad, where several changes can be made
          in one visit. This used to be two dropdowns and a Make button: one sub
          per trip, no shirt numbers, no sight of who was carrying a knock. */}
      <div className="fact-label" style={{ marginTop: 12 }}>{t('matchday.replacementsLeft', { left: usableChanges(game, mine, ctx.subsUsed), max: MAX_SUBS })}</div>
      <button className="btn ghost block" style={{ marginTop: 6 }} disabled={ctx.subsUsed >= MAX_SUBS}
        onClick={() => setSquadOpen(true)}>
        {t(ctx.subsUsed >= MAX_SUBS ? 'matchday.allChangesUsed' : 'matchday.makeReplacements')}
      </button>
      <EnergyBars mine={mine} />
      {squadOpen && <SquadSheet onClose={() => setSquadOpen(false)} />}
      <button className="btn gold block" style={{ margin: '14px 0 2px', width: '100%' }} onClick={onResume}>
        {resumeLabel}
      </button>
    </div>
  )
}
