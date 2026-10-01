import { useState } from 'react'
import { useStore } from '../../store'
import { ATTR_KEYS, absWeek, type Attrs, type Player } from '../../game/model'
import { fineAttr } from '../../game/attributes'
import {
  MENTEE_MAX_AGE, MENTOR_MIN_AGE, canBeMentored, canMentor, fitReason, fitWord,
  STAGE_KEY, mentorCap, mentorFit, mentorStage, mentorTeaches, pairBlock, pairRevealed, pairWeeks,
  posLink, startMentoring, type PosLink,
} from '../../game/mentoring'
import { SectionTitle } from '../components'
import { attrName, t } from '../../game/i18n'

const LINK_KEY: Record<PosLink, string> = {
  same: 'training.linkSame', related: 'training.linkRelated', other: 'training.linkOther',
}
const LINK_ORDER: Record<PosLink, number> = { same: 0, related: 1, other: 2 }
const fitCol = (fit: number) => fit >= 66 ? 'var(--text-positive)' : fit >= 36 ? 'var(--gold)' : 'var(--danger)'
const leadOf = (p: Player) => fineAttr(p.id, ATTR_KEYS.indexOf('lea'), p.a.lea)

/**
 * Mentoring, on the Team Report (owner, 1.8.0: "Club/Mentoring should be moved
 * into team report. We need to rethink how we select these and the impact
 * this has").
 *
 * The kid first, then every senior who could take him, with what the manager
 * can see for himself: how close their jobs are, his leadership, his caps and
 * what he could teach.
 *
 * A GAMBLE FOR A MONTH (owner, round 4: "You shouldn't know how a mentorship
 * is going to work for at least one month ... So it's a gamble whether it
 * works"). The picker shows no fit, no reason and no forecast, and is not
 * ranked by them; a running pairing says only that it is too early to tell
 * until mentoring.pairRevealed, then how it is going in plain words. The
 * mechanics underneath are untouched.
 *
 * LESS TEXT (owner, round 4: "too much text on this page"). The rules,
 * including the ages, live in the handbook (handbook.a29); the page keeps
 * one line and short labels.
 */
export default function MentoringPanel() {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  // a pick is a career decision: it goes to disk, not only to the screen
  const persist = useStore(s => s.persist)
  const save = () => { touch(); void persist() }
  const go = useStore(s => s.go)
  const [kidId, setKidId] = useState<number | null>(null)
  const club = game.clubs[game.userClubId]
  const squad = club.players.map(id => game.players[id]).filter((p): p is Player => !!p)
  const pairs = game.mentors ?? []
  const cap = mentorCap(game)
  const free = Math.max(0, cap - pairs.length)
  const now = absWeek(game.season, game.week)
  const kidCount = (id: number) => pairs.filter(mp => mp.senior === id).length

  // a kid already at his ceiling would graduate the same week
  // (mentorGraduations), so he is not offered
  const kids = squad.filter(p => canBeMentored(p) && !pairs.some(mp => mp.kid === p.id) && p.ca < p.pa)
    .sort((a, b) => a.age - b.age || b.ca - a.ca)
  const kid = kidId != null ? game.players[kidId] : null
  // ranked by what is on the card, never by the hidden fit
  const seniors = kid ? squad.filter(canMentor)
    .map(s => ({ s, link: posLink(s, kid), teaches: mentorTeaches(s, kid), no: pairBlock(game, s, kid) }))
    .sort((a, b) => (a.no ? 1 : 0) - (b.no ? 1 : 0) || LINK_ORDER[a.link] - LINK_ORDER[b.link] || leadOf(b.s) - leadOf(a.s)) : []
  const attrList = (ks: (keyof Attrs)[]) => ks.map(k => attrName(k)).join(', ')

  return (
    <>
      <SectionTitle sub={free > 0 ? t('training.placesFree', { n: free, cap }) : t('training.placesNone', { cap })}>
        {t('training.mentoring')}
      </SectionTitle>
      <div className="mentor-intro meta" style={{ fontSize: 12.5 }}>{t('training.mentorGamble')}</div>

      {pairs.length > 0 && <SectionTitle>{t('training.pairsNow')}</SectionTitle>}
      {pairs.map(mp => {
        const s = game.players[mp.senior]
        const k = game.players[mp.kid]
        if (!s || !k) return null
        const shown = pairRevealed(game, mp)
        const weeks = mp.since != null ? Math.max(0, now - mp.since) : null
        const fit = mentorFit(s, k)
        const stage = mentorStage(s, k, pairWeeks(game, mp))
        const taught = Object.entries(mp.taught ?? {}).filter(([, n]) => (n ?? 0) > 0)
          .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
        const changed = mp.pers0 != null && k.pers !== mp.pers0 && k.pers === s.pers
        const when = weeks == null ? null : weeks === 0 ? t('training.pairedNew') : t('training.pairedWeeks', { n: weeks })
        return (
          <div key={mp.kid} className="card" data-pair={mp.kid} data-revealed={shown ? '1' : '0'} style={{ padding: '8px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                  <span style={{ cursor: 'pointer' }} onClick={() => go('player', k.id)}>{k.name}</span>{' '}
                  <span className="muted" style={{ fontWeight: 600, fontSize: 12 }}>{k.pos} · {k.age}</span>
                </div>
                <div className="meta" style={{ fontSize: 12 }}>
                  {t('training.mentoredBy', { name: s.name, pos: s.pos, link_k: LINK_KEY[posLink(s, k)] })}
                </div>
              </div>
              <button className="btn ghost" style={{ fontSize: 12, padding: '4px 10px', flexShrink: 0 }}
                onClick={() => { game.mentors = pairs.filter(x => x.kid !== mp.kid); save() }}>{t('training.end')}</button>
            </div>
            {!shown ? (
              // THE FIRST MONTH: that it exists, and nothing about how it is going
              <div className="meta" style={{ fontSize: 12, marginTop: 4, color: 'var(--text-muted)' }}>
                {when}{' · '}{t('training.tooEarly')}
              </div>
            ) : (
              <div style={{ marginTop: 4 }}>
                <div className="meta" style={{ fontSize: 12.5 }}>
                  <b style={{ color: fitCol(fit) }}>{fitWord(fit)}</b>{' · '}
                  <span data-stage={stage}>{t(STAGE_KEY[stage])}</span>
                </div>
                <div className="meta" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fitReason(s, k)}</div>
                <div className="meta" style={{ fontSize: 12 }}>
                  {weeks == null ? t('training.noLedger') : <>
                    {when}{' · '}{t('training.ratingSince', { from: mp.ca0 ?? k.ca, to: k.ca, n: mp.grew ?? 0 })}
                    {taught.length > 0 && <>{' · '}{t('training.coachedSoFar', { list: taught.map(([key, n]) => `${attrName(key)} +${n}`).join(', ') })}</>}
                  </>}
                </div>
                {changed && <div className="meta" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-positive)' }}>{t('training.tookCharacter', { pers_k: `pers.${k.pers}` })}</div>}
              </div>
            )}
          </div>
        )
      })}

      <SectionTitle sub={free > 0 ? undefined : t('training.placesNone', { cap })}>{t('training.newPairing')}</SectionTitle>
      {free === 0 ? (
        <div className="card meta" style={{ padding: '8px 10px', fontSize: 12 }}>{t('training.mentorFullNote')}</div>
      ) : !kid ? (
        <div className="card" style={{ padding: '2px 10px' }}>
          <div className="fact-label" style={{ paddingTop: 6 }}>{t('training.pickKid', { age: MENTEE_MAX_AGE })}</div>
          {kids.length === 0 && <div className="meta" style={{ fontSize: 12, padding: '6px 0' }}>{t('training.kidsNone', { age: MENTEE_MAX_AGE })}</div>}
          {kids.map((p, i) => (
            <button key={p.id} data-kid={p.id} className="club-pick" onClick={() => setKidId(p.id)}
              style={{ margin: 0, width: '100%', borderRadius: 0, border: 0, borderTop: i ? '1px solid var(--border)' : undefined, padding: '8px 0', background: 'transparent' }}>
              <span className="cname" style={{ fontSize: 13.5 }}>{p.name}</span>
              <span className="muted" style={{ fontSize: 12 }}>{p.pos} · {p.age} · {t(`persShort.${p.pers}`)}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: '6px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="fact-label" style={{ flex: 1 }}>{t('training.pickMentor', { name: kid.name, pos: kid.pos, age: kid.age, pers_k: `pers.${kid.pers}` })}</div>
            <button className="btn ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setKidId(null)}>{t('training.changeKid')}</button>
          </div>
          {seniors.length === 0 && <div className="meta" style={{ fontSize: 12, padding: '6px 0' }}>{t('training.mentorsNone', { age: MENTOR_MIN_AGE })}</div>}
          {seniors.map(({ s, link, teaches, no }) => (
            <div key={s.id} data-mentor={s.id} style={{ borderTop: '1px solid var(--border)', padding: '8px 0', opacity: no ? 0.6 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                    {s.name} <span className="muted" style={{ fontWeight: 600, fontSize: 12 }}>{s.pos} · {s.age} · {t(`persShort.${s.pers}`)}</span>
                  </div>
                  <div className="meta" style={{ fontSize: 12 }}>
                    {t(LINK_KEY[link])}
                    {' · '}{t('training.leadershipN', { n: leadOf(s) })}
                    {' · '}{t('training.capsN', { n: s.caps ?? 0 })}
                  </div>
                </div>
                <button className="btn" style={{ fontSize: 12, padding: '5px 12px', flexShrink: 0 }} disabled={!!no}
                  onClick={() => { if (!startMentoring(game, s.id, kid.id)) { setKidId(null); save() } }}>
                  {t('training.pair')}
                </button>
              </div>
              <div className="meta" style={{ fontSize: 12 }}>
                {teaches.length ? t('training.teachesList', { list: attrList(teaches) }) : t('training.teachesNone')}
                {kidCount(s.id) === 1 && !no ? ` ${t('training.hasOneKid')}` : ''}
              </div>
              {no && <div className="meta" style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)' }}>{t(no === 'full' ? 'training.mentorHasTwo' : 'training.mentorFullNote')}</div>}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
