import type { Attrs, Club, GameState } from '../game/model'
import {
  ATK_STYLES, DEF_STYLES, MATCHUP, STYLE_MOVES, STYLE_NEEDS, applyAtkStyle, applyDefStyle, atkBeats, atkName, defBeats, defName,
  styleFit, stylesOf, type AtkStyle, type DefStyle,
} from '../game/styles'
import { MOVE_BY_ID } from '../game/moves'
import { userFixtureThisWeek } from '../game/season'
import { t } from '../game/i18n'
import { SectionTitle } from './components'
import { StyleDiagram } from './tacticsArt'

/**
 * THE ATTACK AND DEFENCE STYLES (1.8.2, owner: "5 attack and 5 defence
 * styles in Tactics, shown visually"), the Game Plan tab's opening view.
 *
 * Two pickers, each five drawn tiles and one card under them for the style
 * that is picked: what it is, what it beats and what beats it (straight off
 * the matchup table), what it needs from the men in the shirts and whether
 * this XV has it, how it sits against this week's opposition, and for an
 * attack which of the called moves belong to it. A tap sets the style and
 * its levers (styles.ts ATK_PRESET / DEF_PRESET); the dials themselves stay
 * on the Fine Tune view and move freely afterwards.
 */
export default function StylesSection({ game, club, touch }: { game: GameState; club: Club; touch: () => void }) {
  const tac = club.tactic
  const mine = stylesOf(game, club)!
  const fx = userFixtureThisWeek(game)
  const oppId = fx ? (fx.homeId === club.id ? fx.awayId : fx.homeId) : null
  const opp = oppId ? game.clubs[oppId] : undefined
  const theirs = opp ? stylesOf(game, opp) : null
  const at = (shirt: number, a: keyof Attrs) => {
    const id = tac.lineup[shirt - 1]
    const p = id != null ? game.players[id] : undefined
    return p ? p.a[a] : null
  }
  const needs = (id: AtkStyle | DefStyle) => STYLE_NEEDS[id].map(n => t('moves.needPart', {
    shirts: n.shirts.join('/'),
    attrs: n.attrs.map(a => t(`attrs.${a}`)).join(', '),
  })).join(' · ')
  const fitLine = (fit: number) => (
    <span className={`d${fit < -0.15 ? ' mv-warn' : ''}`}>
      {t(fit > 0.15 ? 'styles.fitGood' : fit < -0.15 ? 'styles.fitPoor' : 'styles.fitOk')}
    </span>
  )
  const vsLine = (m: number, style: string) => opp && (
    <span className={`d${m < 0 ? ' mv-warn' : ''}`} data-style-vs={m > 0 ? 'good' : m < 0 ? 'bad' : 'even'}>
      {t(m > 0 ? 'styles.vsGood' : m < 0 ? 'styles.vsBad' : 'styles.vsEven', { team: opp.short, style })}
    </span>
  )

  const atk = mine.atk, def = mine.def
  const ab = atkBeats(atk), db = defBeats(def)
  const atkFit = styleFit(atk, at), defFit = styleFit(def, at)
  const moves = STYLE_MOVES[atk].map(id => MOVE_BY_ID[id]).filter(Boolean).map(m => t(m.name))

  return <>
    <SectionTitle sub={t('styles.atkSub')}>{t('styles.atkHeading')}</SectionTitle>
    <div className="routine-grid st-grid" role="radiogroup" aria-label={t('styles.atkHeading')}>
      {ATK_STYLES.map(id => (
        <button key={id} className={`speech-tile st-tile${atk === id ? ' sel' : ''}`} role="radio" aria-checked={atk === id}
          data-style={id} onClick={() => { applyAtkStyle(tac, id); touch() }}>
          <StyleDiagram id={id} />
          <b>{t(atkName(id))}</b>
        </button>
      ))}
    </div>
    <div className="card st-body" data-style-card={atk}>
      <StyleDiagram id={atk} />
      <div className="sp-txt">
        <b>{t(atkName(atk))}</b>
        <span className="st-tag">{t(`styles.atk_${atk}Tag`)}</span>
        <span className="d">{t(`styles.atk_${atk}Desc`)}</span>
        <span className="d">
          {t('styles.beats', { list: ab.beats.map(d => t(defName(d))).join(', ') })}
          {' · '}
          {t('styles.weak', { list: ab.weak.map(d => t(defName(d))).join(', ') })}
        </span>
        <span className="d">{t('styles.needs', { list: needs(atk) })}</span>
        {fitLine(atkFit)}
        {theirs && vsLine(MATCHUP[atk][theirs.def], t(defName(theirs.def)))}
        <span className="d">{moves.length ? t('styles.movesFit', { moves: moves.join(', ') }) : t('styles.movesKick')}</span>
      </div>
    </div>

    <SectionTitle sub={t('styles.defSub')}>{t('styles.defHeading')}</SectionTitle>
    <div className="routine-grid st-grid" role="radiogroup" aria-label={t('styles.defHeading')}>
      {DEF_STYLES.map(id => (
        <button key={id} className={`speech-tile st-tile${def === id ? ' sel' : ''}`} role="radio" aria-checked={def === id}
          data-style={id} onClick={() => { applyDefStyle(tac, id); touch() }}>
          <StyleDiagram id={id} />
          <b>{t(defName(id))}</b>
        </button>
      ))}
    </div>
    <div className="card st-body" data-style-card={def}>
      <StyleDiagram id={def} />
      <div className="sp-txt">
        <b>{t(defName(def))}</b>
        <span className="st-tag">{t(`styles.def_${def}Tag`)}</span>
        <span className="d">{t(`styles.def_${def}Desc`)}</span>
        <span className="d">
          {t('styles.beats', { list: db.beats.map(a => t(atkName(a))).join(', ') })}
          {' · '}
          {t('styles.weak', { list: db.weak.map(a => t(atkName(a))).join(', ') })}
        </span>
        <span className="d">{t('styles.needs', { list: needs(def) })}</span>
        {fitLine(defFit)}
        {/* the matchup read from their side: their attack into this defence */}
        {theirs && vsLine(-MATCHUP[theirs.atk][def], t(atkName(theirs.atk)))}
      </div>
    </div>
    <div className="meta" style={{ padding: '2px 16px 0' }}>{t('styles.presetNote')}</div>
  </>
}
