import { useState } from 'react'
import { useStore } from '../../store'
import { RewardedButton, SectionTitle } from '../components'
import { rewardedAvailable } from '../../game/monetise'
import { canTeamNight } from '../../game/rewarded'
import { teamNightOn } from '../../game/room'
import {absWeek, SEASON_WEEKS, pressAnswer, pressLabel, pressQuestion, pressReaction, weekDate } from '../../game/model'
import { OFFICE_OUTLET, PRESS_KEEP_WEEKS, isBoardroom } from '../../game/media'
import { bandOf, currentMood, effectLines, moodRoom, pressWhy, type Baro } from '../../game/pressmood'
import type { GameState, PressItem } from '../../game/model'
import { t } from '../../game/i18n'
import { OptionLabel } from '../OptionLabel'
import { prose, speech } from '../../game/quotes'

/* THE QUESTIONS AND THE ANSWERS STAY AS THEY WERE ASKED. A press item is written
   into the save the week it is put to you, and the reaction is filed beside the
   answer you gave - a career's paperwork keeps the language it was written in
   (docs/i18n.md). Everything the screen says around them follows the reader. */

/** The coverage line under a question: what you said, then how it landed.
 *  An item can reach the list with no answer on it (an old save, a question
 *  settled without a button being pressed), and "You: “” -" is a bug on the
 *  page, so an empty answer says so in words instead. */
function youSaid(item: PressItem): string {
  const answer = speech(pressAnswer(item))
  const reaction = prose(pressReaction(item))
  if (!answer) return reaction ? `${t('world.prNoAnswer')} ${reaction}` : t('world.prNoAnswer')
  // no reaction filed: the line ends on the answer, not on a dangling dash
  return t('world.prYouSaid', { answer, reaction }).replace(/\s+-\s*$/, '')
}

export default function Press() {
  const game = useStore(s => s.game)!
  const answer = useStore(s => s.answerPressOption)
  const go = useStore(s => s.go)
  const rewardTeamNight = useStore(s => s.rewardTeamNight)
  const [spotNote, setSpotNote] = useState<{ id: number; text: string } | null>(null)

  // the camp, the season's pitch and the sponsor deals are the board's
  // business and are answered on Finances (media.isBoardroom)
  const open = game.press.filter(p => !p.answered && !isBoardroom(p)).reverse()
  // RECENT MEANS RECENT. The room used to show the last twelve answers however
  // old they were, so a week-8 press room carried August (owner: "tidy the
  // press room up - remove anything older than 2 weeks"). The weekly settle
  // drops them from the save; this keeps the screen honest in the same week
  // the rule changed, and on a save loaded mid-week.
  const now = game.season * SEASON_WEEKS + game.week
  const past = game.press
    .filter(p => p.answered && !isBoardroom(p) && now - (absWeek(p.season, p.week)) <= PRESS_KEEP_WEEKS)
    .reverse()

  return (
    <>
      <Barometer game={game} />
      {open.length === 0 && (
        <div className="muted" style={{ padding: 14 }}>{t('world.prQuiet')}</div>
      )}
      {open.map(item => (
        <div key={item.id}>
          <div className="press-outlet">
            {item.outlet === OFFICE_OUTLET ? t('world.prOffice') : t('world.prAsks', { outlet: item.outlet })}
          </div>
          <div className="press-q">{prose(pressQuestion(item))}</div>
          {item.playerId != null && game.players[item.playerId] && (
            <button className="muted" style={{ padding: '0 14px 8px', fontWeight: 600, color: 'var(--info)' }}
              onClick={() => go('player', item.playerId!)}>
              {t('world.prView', { player: game.players[item.playerId].name })}
            </button>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 14px 14px' }}>
            {item.options.map((o, i) => (
              <button key={i} className="btn ghost" style={{ textAlign: 'left' }}
                onClick={() => answer(item.id, i)}>
                <OptionLabel text={pressLabel(o)} say />
              </button>
            ))}
            {/* THE SPONSOR'S TEAM NIGHT (1.8.2, rewarded.ts): stand by the
                call with half the sting for the senior men. Only on a split,
                only where a provider exists, once in four game-weeks */}
            {rewardedAvailable('teamnight') && canTeamNight(game, item.id) && (
              <RewardedButton place="teamnight" className="btn ghost" style={{ textAlign: 'left' }} label={t('till.watchTeamNight')}
                onDone={out => {
                  if (out === 'completed') { if (!rewardTeamNight(item.id)) setSpotNote({ id: item.id, text: t('till.favourGone') }) }
                  else setSpotNote({ id: item.id, text: t(out === 'skipped' ? 'till.spotSkipped' : 'till.spotUnavailable') })
                }} />
            )}
            {spotNote?.id === item.id && <div className="meta muted" style={{ fontSize: 12 }}>{spotNote.text}</div>}
          </div>
          <hr style={{ border: 'none', borderTop: '2px solid var(--border-strong)', margin: '0 14px' }} />
        </div>
      ))}
      {past.length > 0 && (
        <>
          <SectionTitle>{t('world.prRecentCoverage')}</SectionTitle>
          {past.map(item => (
            <div key={item.id} className="news-item open">
              <div className="when">{item.outlet === OFFICE_OUTLET ? t('world.prPrivate') : item.outlet} · {weekDate(item.season, item.week)}</div>
              <div className="subj" style={{ fontWeight: 400 }}>{prose(pressQuestion(item))}</div>
              <div className="body">{youSaid(item)}</div>
              {teamNightOn(game, item.id) && <div className="meta muted" style={{ fontSize: 12 }}>{t('till.teamNightDone')}</div>}
              {/* what the answer did, in words (pressmood.effectLines) */}
              {item.fx && (
                <div className="press-fx">
                  {effectLines(item, item.playerId != null ? game.players[item.playerId]?.name : undefined).map(l => (
                    <span key={l.k} className={`fx ${l.tone}`}>{t(l.k, l.v)}</span>
                  ))}
                </div>
              )}
              {/* how he took it (talkback.ts): the reply already says so in
                  words; this is the same verdict at a glance */}
              {item.fit && (
                <span className={`took ${item.fit}`}>
                  {t(item.fit === 'good' ? 'world.prTookGood' : item.fit === 'bad' ? 'world.prTookBad' : 'world.prTookMixed')}
                </span>
              )}
            </div>
          ))}
        </>
      )}
      <div className="spacer" />
    </>
  )
}

/* ---- THE BAROMETER (1.8.0, pressmood.ts) ----
   A half-dial, hostile on the left and adoring on the right, with the band the
   needle sits in drawn at full strength and the rest faded. The word says it,
   the line under it says why - from the real results - and the last line says
   what that means for the questions coming. Colours are the --baro-* tokens,
   which are role tokens underneath, so every skin repaints the dial. */
const BANDS: { b: Baro; from: number; to: number }[] = [
  { b: 'hostile', from: -100, to: -45 },
  { b: 'sceptical', from: -45, to: -15 },
  { b: 'neutral', from: -15, to: 15 },
  { b: 'warm', from: 15, to: 45 },
  { b: 'adoring', from: 45, to: 100 },
]
const WORD: Record<Baro, string> = {
  hostile: 'world.prBaroHostile', sceptical: 'world.prBaroSceptical', neutral: 'world.prBaroNeutral',
  warm: 'world.prBaroWarm', adoring: 'world.prBaroAdoring',
}
const CX = 60, CY = 60, R = 48
/** -100..100 onto the dial: 180 degrees at the left, 0 at the right */
const ang = (v: number) => Math.PI * (1 - (v + 100) / 200)
const pt = (v: number, r: number) => [CX + r * Math.cos(ang(v)), CY - r * Math.sin(ang(v))]

function Barometer({ game }: { game: GameState }) {
  const pm = currentMood(game)
  const band = bandOf(pm.v)
  const why = pressWhy(game, pm)
  const room = moodRoom(pm)
  const word = t(pm.stir ? 'world.prBaroStir' : WORD[band])
  const reason = t(why.k, why.v)
  const expect = room === 'stir' ? 'world.prBaroExpectStir' : room === 'hostile' ? 'world.prBaroExpectHostile'
    : room === 'sceptical' ? 'world.prBaroExpectSceptical' : room === 'warm' ? 'world.prBaroExpectWarm' : 'world.prBaroExpectNeutral'
  const [nx, ny] = pt(pm.v, R - 12)
  return (
    <div className={`baro ${pm.stir ? 'stir' : band}`}>
      <svg className="baro-dial" viewBox="0 0 120 68" role="img" aria-label={t('world.prBaroAria', { word, why: reason })}>
        {BANDS.map(({ b, from, to }) => {
          // a hair of air between the bands so they read as five, not a rainbow
          const [x1, y1] = pt(from + 1.5, R), [x2, y2] = pt(to - 1.5, R)
          return (
            <path key={b} className={`seg ${b}${b === band ? ' on' : ''}`}
              d={`M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`} />
          )
        })}
        <line className="needle" x1={CX} y1={CY} x2={nx.toFixed(2)} y2={ny.toFixed(2)} />
        <circle className="hub" cx={CX} cy={CY} r={4.5} />
      </svg>
      <div className="baro-text">
        <div className="baro-title">{t('world.prBaroTitle')}</div>
        <div className="baro-word">{word}</div>
        <div className="baro-why">{reason}</div>
        <div className="baro-expect">{t(expect)}</div>
      </div>
    </div>
  )
}
