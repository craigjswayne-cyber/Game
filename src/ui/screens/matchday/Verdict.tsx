// The full-time verdict and the follow-up lines it is built from.

import { useStore } from '../../../store'
import { teamShort } from '../../../game/matchEngine'
import { clubCode } from '../../../game/model'
import {
  LEVERS, buildEvidence, readTold, toldCalls, halfFollow, leverMoved, matchFollow, prevEvidence, rankWhy, whyLeads, type Follow,
} from '../../../game/evidence'
import { SLIDER_INFO } from '../../../game/tactics'
import { t } from '../../../game/i18n'
import { coachFixes, gradeHomework, gradeLine, homeworkFor, unitBattles, type FixTag } from '../../../game/coachfix'
import { formerDecided } from '../../../game/memory'
import { ADAPT_WORTH } from '../../../game/armsrace'
import { Glyph } from '../../glyphs'
import { acc, accLine } from '../../accent'

/** ONE FOLLOW-UP LINE (1.8.4): a count before and after, which way it went,
 *  and for the half-time one whether the answering dial moved at the break;
 *  for the match-to-match one, the new problem when another hurt more. */
function FollowLine({ f, label, pair, moved }: { f: Follow; label: string; pair: string; moved?: 'right' | 'wrong' | 'none' | null }) {
  const good = f.trend === 'improved' || f.trend === 'partly'
  const dial = LEVERS[f.cause] ? SLIDER_INFO.find(s => s.key === LEVERS[f.cause]!.dial) : undefined
  return (
    <div className="meta" data-follow={label.slice(-2) === 'Ht' ? 'half' : 'match'} data-trend={f.trend}
      style={{ ...accLine(good ? 'var(--text-positive)' : f.trend === 'worse' ? 'var(--text-negative)' : 'var(--border)'), paddingLeft: 6, marginTop: 3 }}>
      <b>{t(label)} </b>
      {t(pair, { what_k: `matchday.fuM_${f.cause}`, a: f.a, b: f.b })}{' '}
      {t(`matchday.fuTrend_${f.trend}`)}
      {moved && dial && <>{' '}{t(`matchday.fuLever_${moved}`, { dial_k: dial.label })}</>}
      {f.now && <>{' '}{t('matchday.fuNow', { what_k: `matchday.fuM_${f.now}` })}</>}
    </div>
  )
}

/** The three moments everyone will be talking about on the drive home. */
export function MatchVerdict() {
  const game = useStore(s => s.game)!
  const live = useStore(s => s.liveMatch)!
  const ctx = live.ctx
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  const opp = mine === ctx.home ? ctx.away : ctx.home
  const star = ctx.motmId != null ? game.players[ctx.motmId] : null
  const starMine = star && mine.ratings.has(star.id)
  // WHY (1.8.3): the three causes that decided it, ranked, each with its
  // number (evidence.ts rankWhy). It replaced one sentence picked from the
  // possession share and the margin, which named nothing.
  const ev = buildEvidence(game, ctx)
  const why = ev ? rankWhy(ev, 3) : []
  // framed for the manager (1.8.4): which way each pulled, not a proof
  const leads = ev ? whyLeads(ev, why) : []
  // the call the report and the desk said they were set for, answered
  // (1.8.5, evidence.ts readTold): unlabelled, since it rarely decides much
  const told = ev && !why.some(w => w.cause === 'read') ? readTold(ev, toldCalls(ctx, ADAPT_WORTH)) : null
  // AND WHETHER IT WORKED (1.8.4, evidence.ts): what hurt at half time held
  // against the second half alone, with the dial that answers it as he left
  // it at the break; and what hurt most last match held against this one.
  // Read before the filing at the whistle puts this match on the record.
  const half = ev ? halfFollow(ev, ctx.htEv) : null
  const moved = half ? leverMoved(half.cause, ctx.htDials, ctx.shDials) : null
  const prev = ev ? prevEvidence(game, ev) : null
  const follow = ev && prev ? matchFollow(prev, ev) : null
  // the new problem goes unsaid when the line above already leads with it
  const hurtLed = why.find((_, i) => leads[i] === 'matchday.leadHurt')?.cause
  const last = follow && follow.now === hurtLed ? { ...follow, now: undefined } : follow
  // The verdict used to stop at one sentence, which named nothing (user:
  // "it should outline what the two fixes would be etc so the player can keep
  // tweaking the tactics"). game/coachfix reads the same match data and turns it
  // into two instructions that each point at a real control.
  const myClub = game.clubs[mine.teamId]
  const fixes = coachFixes(game, ctx, mine, opp, myClub?.tactic ?? null, 2)
  const units = unitBattles(ctx, mine, opp)

  // ---- MARKING LAST WEEK'S HOMEWORK (C2) ----------------------------------
  //
  // The audit's read was that the two fixes were a lecture rather than a loop:
  // the coach names two jobs, the manager does them or ignores them, and nothing
  // ever refers to it again. So the tags from the last full time are kept on the
  // save, and this compares them with what the coach can still complain about.
  //
  // Read BEFORE the effect below overwrites it, and stale records are dropped: a
  // grade against a game six weeks and a transfer window ago is not a grade, it
  // is a non sequitur. Cup runs and international weeks mean "next match" is not
  // always next week, hence four rather than one.
  const hw = homeworkFor(game, live.fixture.id, opp.teamId)
  const fresh = !!hw
  // "using the bench" is a job you DO, so it is graded on evidence rather than
  // on the complaint staying quiet - ctx.subsUsed is the only honest witness.
  // Two changes, not one (1.8.1): the bench advice itself speaks below two
  // and asks for "the two or three", so a single change had the homework
  // marked done on a match where the advice would have been given again.
  const grade = fresh && hw
    ? gradeHomework(game, ctx, mine, opp, myClub?.tactic ?? null, hw.tags as FixTag[], follow)
    : { fixed: [], missed: [] }
  const verdictOnLast = gradeLine(grade.fixed, grade.missed)

  // and then this match's two become the homework: since 1.8.4 set where the
  // match is filed (coachfix fileHomework), so a match the assistant played
  // sets it too
  return (
    <div className="card" style={{ ...acc('var(--gold)') }}>
      {star && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="fact-label">{t('matchday.starPlayer')}</div>
            {/* THE CLUB CODE, both sides. It read "(yours)" for your own man and the
                opponent's full short name for theirs, so the same slot carried two
                different kinds of thing (user: "next to sleightholme (yours) should
                be team unitials so NOR"). NOR and NEW, the same codes the crest and
                the touchline use. */}
            <b>{star.name}</b>{' '}
            <span className="muted">({clubCode(teamShort(game, starMine ? mine.teamId : opp.teamId))})</span>
          </div>
          <span className="form-pill" style={{ background: 'var(--text-positive)', color: 'var(--on-positive)', fontSize: '1rem' }}>
            {/* the published mark, as the findings and the ratings table print it (1.8.15: this read the running in-match number, so one man was "8.5" here and "10.0" two lines below) */}
            {ctx.motmId != null ? (mine.finalR?.get(ctx.motmId) ?? opp.finalR?.get(ctx.motmId) ?? mine.ratings.get(ctx.motmId) ?? opp.ratings.get(ctx.motmId) ?? 7).toFixed(1) : ''}
          </span>
        </div>
      )}
      <div className="fact-label" style={{ marginTop: 8 }}>{t('matchday.coachsVerdict')}</div>
      {why.map((w, i) => (
        <div key={w.cause} className="meta" data-why={w.cause} data-why-lead={leads[i] ?? undefined}
          style={{ ...accLine(w.sig > 0 ? 'var(--text-positive)' : 'var(--text-negative)'), paddingLeft: 6, marginTop: 3 }}>
          {leads[i] && <b>{t(leads[i]!)} </b>}
          {t(w.k, w.v)}
        </div>
      ))}
      {verdictOnLast && (
        <div className={`fix-grade${grade.missed.length === 0 ? ' good' : ''}`}>
          <Glyph name={grade.missed.length === 0 ? 'check' : 'tactics'} /> {verdictOnLast}
        </div>
      )}

      {fixes.length > 0 && (
        <>
          <div className="fact-label" style={{ marginTop: 8 }}>
            {t(fixes.length === 1 ? 'matchday.theFix' : 'matchday.theTwoFixes')} <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{t('matchday.beforeSaturday')}</span>
          </div>
          {fixes.map((f, i) => (
            <div key={i} className="fix-row">
              <span className="fix-no">{i + 1}</span>
              <span>
                <b style={{ display: 'block', fontSize: '0.8125rem' }}>{f.head}</b>
                <span className="muted" style={{ fontSize: '0.75rem' }}>{f.how}</span>
              </span>
            </div>
          ))}
        </>
      )}

      {/* INFORMATION HIERARCHY (1.8.6): the verdict, then what to change,
          then the memory: who you let go, the call he was set for, whether the
          half-time change and last week's problem moved. Everything stays;
          the order is the point. */}
      <div className="ft-context">
        {(() => {
          // A MAN YOU LET GO DECIDED IT (1.8.5, memory.ts formerDecided)
          const fs = formerDecided(game, opp.teamId, mine.score, opp.score, ctx.events, ctx.motmId ?? null)
          return fs.map(f => <div key={f.p} className="meta" data-former-ft={f.p} style={{ marginTop: 6 }}>{t(f.k, f.v)}</div>)
        })()}
        {told && (
          <div className="meta" data-why="read" data-why-told="1" style={{ ...accLine('var(--border)'), paddingLeft: 6, marginTop: 3 }}>
            {t(told.k, told.v)}
          </div>
        )}
        {half && <FollowLine f={half} label="matchday.fuSinceHt" pair="matchday.fuHalves" moved={moved} />}
        {last && <FollowLine f={last} label="matchday.fuSinceLast" pair="matchday.fuMatches" />}
      </div>
      {/* the unit percentages, and the match analysis and stats below say
          the same thing at length: folded, the way the talk sheet folds the
          room (1.8.6) */}
      <details className="mood-fold ft-units">
      <summary>{t('matchday.unitBattlesTitle')}</summary>
      {units.map(({ key, label, pct, verdict }) => {
        const color = pct >= 52 ? 'var(--text-positive)' : pct <= 48 ? 'var(--text-negative)' : undefined
        // the verdict is a token, not a phrase: 'we edged it' and 'ils l'ont
        // emporté de peu' put the subject in different places, so each whole
        // half-sentence is its own key
        return (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{t(label)}</span>
            <span><b style={{ color, fontFamily: 'var(--cond)', fontSize: '0.875rem' }}>{pct}%</b>
              <span className="muted">{t(`matchday.uw${verdict[0].toUpperCase()}${verdict.slice(1)}`)}</span>
            </span>
          </div>
        )
      })}
      </details>
    </div>
  )
}
