// The pre-match screen for a Test, when you are coaching your country.

import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../../../store'
import { teamShort, teamUnits, rosterOf, autoSelect, availablePlayers } from '../../../game/matchEngine'
import { MIDWEEK_OFF, BENCH_SLOTS, XV_SLOTS, fixtureDate } from '../../../game/model'
import { assistantFixtureThisWeek } from '../../../game/season'
import { effAt } from '../../../game/attributes'
import { posName, t, compLabel } from '../../../game/i18n'
import { CrestT, PosBadge, SectionTitle, Stars } from '../../components'
import { stageName } from '../Home'
import { nationName } from '../../../game/nations'
import { Glyph } from '../../glyphs'
import { rowNavTr } from '../../rowNav'
import { SPEECHES, type SpeechId, ViewPicker } from './prematch'
import { Veil } from '../../Veil'
import { acc } from '../../accent'

/** Test-match preview: you're coaching your COUNTRY this week. */
export function NationPreview({ fxId }: { fxId: number }) {
  const game = useStore(s => s.game)!
  useStore(s => s.tick)
  const { kickOff, instantResult, back } = useStore.getState()
  const [speech, setSpeech] = useState<SpeechId | null>(null)
  const [confirm, setConfirm] = useState(false)

  const fx = game.fixtures.find(f => f.id === fxId)!
  const comp = game.comps[fx.compId]
  const nat = (fx.homeId === game.natTeam || fx.awayId === game.natTeam) ? game.natTeam! : 'LIO'
  const opp = fx.homeId === nat ? fx.awayId : fx.homeId
  const [sel, setSel] = useState<number | null>(null)
  const [pickSlot, setPickSlot] = useState<number | null>(null)

  // the coach's Test 23: saved selection if valid, otherwise the selectors' XV.
  // NOT WRITTEN DURING RENDER (1.9.1). This assigned game.natLineup in the
  // body of the component, which React may run more than once and which never
  // marked the save: the selectors' XV is shown from a memo, and stored (and
  // saved) after the render has committed.
  const selectorsXV = useMemo(() => autoSelect(game, availablePlayers(game, rosterOf(game, nat), true)), [game, nat])
  const myLineup = game.natLineup?.team === nat ? game.natLineup.lineup : selectorsXV
  useEffect(() => {
    if (game.natLineup?.team !== nat) {
      game.natLineup = { team: nat, lineup: selectorsXV }
      useStore.getState().touch()
    }
  }, [game, nat, selectorsXV])
  const oppLineup = useMemo(() => autoSelect(game, availablePlayers(game, rosterOf(game, opp), true)), [game, opp])
  const myUnits = teamUnits(game, myLineup)
  const oppUnits = teamUnits(game, oppLineup)
  const { touch } = useStore.getState()

  // a Test week gets the same choice as a club week (F5)
  const view = game.viewPref?.[fx.compId] ?? 'full'
  const setView = (v: 'full' | 'highlights' | 'instant') => {
    game.viewPref = { ...(game.viewPref ?? {}), [fx.compId]: v }
    touch()
  }

  const tapSlot = (slot: number) => {
    if (sel == null) { setSel(slot); return }
    if (sel === slot) { setSel(null); setPickSlot(slot); return }
    const a = myLineup[sel]
    myLineup[sel] = myLineup[slot]
    myLineup[slot] = a
    setSel(null)
    touch()
  }

  const setSlot = (slot: number, pid: number | null) => {
    if (pid != null) {
      const other = myLineup.indexOf(pid)
      if (other >= 0) myLineup[other] = myLineup[slot]
    }
    myLineup[slot] = pid
    setPickSlot(null)
    setSel(null)
    touch()
  }

  const bar = (label: string, mine: number, theirs: number) => {
    const total = mine + theirs
    const pct = total ? (mine / total) * 100 : 50
    return (
      <div style={{ padding: '4px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
          <span>{mine.toFixed(1)}</span><b style={{ color: 'var(--info)' }}>{label}</b><span>{theirs.toFixed(1)}</span>
        </div>
        <div style={{ height: 8, background: 'var(--border-strong)', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
          <div style={{ width: `${pct}%`, background: 'var(--primary)' }} />
          <div style={{ flex: 1, background: 'var(--gold)', opacity: .7 }} />
        </div>
      </div>
    )
  }

  return (
    <>
      <header className="masthead">
        <div className="masthead-row">
          <button className="back-btn" onClick={back} aria-label={t('common.backLabel')}><span aria-hidden="true">‹</span></button>
          <div style={{ flex: 1 }}>
            <h1>{t('matchday.testMatch', { nat: nationName(nat) })}</h1>
            <div className="date">{compLabel(comp?.name) ?? (fx.compId === 'fr' ? t('matchday.clubFriendly') : '')}{fx.stage ? ` · ${stageName(fx.stage)}` : ''} · {fixtureDate(game.season, fx.week, fx.id, fx.midweek ? MIDWEEK_OFF : undefined)}</div>
          </div>
        </div>
      </header>
      <main className="content">
        <div className="card center">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 4 }}>
            <CrestT g={game} teamId={fx.homeId} size={40} />
            <span style={{ fontFamily: 'var(--cond)', fontWeight: 700, fontSize: '1rem', color: 'var(--text-muted)', letterSpacing: 2 }}>{t('matchday.vs')}</span>
            <CrestT g={game} teamId={fx.awayId} size={40} />
          </div>
          <h3 style={{ fontSize: '1.125rem' }}>{t('matchday.vsLine', { home: teamShort(game, fx.homeId), away: teamShort(game, fx.awayId) })}</h3>
          <div className="meta">{t('matchday.intlLine')}</div>
        </div>
        {/* THE OTHER SATURDAY, NAMED. The club fixture does not vanish because
            the manager is with his country - it is played by the assistant and
            reported on Monday. Saying so here is the whole of "clearly
            separated but work together": one match is being prepared on this
            screen, the other is somebody else's job, and neither is a
            surprise. */}
        {(() => {
          const cfx = assistantFixtureThisWeek(game)
          if (!cfx) return null
          return (
            <div className="card" style={{ ...acc('var(--border-strong)') }}>
              <div className="fact-label">{t('matchday.clubSameDay')}</div>
              <div className="meta" style={{ marginTop: 3 }}>
                {t('matchday.assistantTakes', { g: game.staffPeople?.assistant?.g ?? 'm', home: teamShort(game, cfx.homeId), away: teamShort(game, cfx.awayId) })}
              </div>
            </div>
          )
        })()}
        <SectionTitle sub={t('matchday.h2hNation')}>{t('matchday.headToHead')}</SectionTitle>
        {bar(t('matchday.h2hScrum'), myUnits.scrum, oppUnits.scrum)}
        {bar(t('matchday.h2hLineout'), myUnits.lineout, oppUnits.lineout)}
        {bar(t('matchday.h2hBreakdown'), myUnits.breakdown, oppUnits.breakdown)}
        {bar(t('matchday.h2hAttack'), myUnits.attack, oppUnits.attack)}
        {bar(t('matchday.h2hDefence'), myUnits.defence, oppUnits.defence)}

        <SectionTitle sub={sel != null
          ? t('matchday.moving', { player: game.players[myLineup[sel] ?? -1]?.name ?? t('matchday.emptySlot') })
          : undefined} help={t('matchday.tapSwapHintTest')}>{t('matchday.yourTestXV')}</SectionTitle>
        <div className="tblwrap"><table className="dtable"><tbody>
          {XV_SLOTS.map((s, i) => {
            const pid = myLineup[i]
            const p = pid != null ? game.players[pid] : null
            return (
              <tr key={i} {...rowNavTr(() => tapSlot(i))} className={sel === i ? 'held-row' : undefined}>
                <td className="num" style={{ fontFamily: 'monospace', fontWeight: 700 }}>{s.shirt}</td>
                <td><PosBadge pos={s.pos} /></td>
                <td className="name">{p?.name ?? <span className="muted">{t('matchday.tapToPick')}</span>}</td>
                <td>{p && <Stars ca={effAt(p, s.pos)} />}</td>
              </tr>
            )
          })}
        </tbody></table></div>
        <SectionTitle>{t('matchday.testBench')}</SectionTitle>
        <div className="tblwrap"><table className="dtable"><tbody>
          {BENCH_SLOTS.map((s, i) => {
            const slot = 15 + i
            const pid = myLineup[slot]
            const p = pid != null ? game.players[pid] : null
            return (
              <tr key={slot} {...rowNavTr(() => tapSlot(slot))} className={sel === slot ? 'held-row' : undefined}>
                <td className="num" style={{ fontFamily: 'monospace', fontWeight: 700 }}>{s.shirt}</td>
                <td><PosBadge pos={s.pos[0]} /></td>
                <td className="name">{p?.name ?? <span className="muted">{t('matchday.tapToPick')}</span>}</td>
                <td>{p && <Stars ca={effAt(p, s.pos[0])} />}</td>
              </tr>
            )
          })}
        </tbody></table></div>
        {pickSlot != null && (
          <Veil onClose={() => setPickSlot(null)}>
            <div className="grab" />
            <SectionTitle sub={t('matchday.testSquadSub')}>
              {t('matchday.pickerTitle', { pos: posName(pickSlot < 15 ? XV_SLOTS[pickSlot].pos : BENCH_SLOTS[pickSlot - 15].pos[0]) })}
            </SectionTitle>
            <table className="dtable"><tbody>
              {availablePlayers(game, rosterOf(game, nat), true)
                .sort((a, b) => effAt(b, pickSlot < 15 ? XV_SLOTS[pickSlot].pos : BENCH_SLOTS[pickSlot - 15].pos[0]) - effAt(a, pickSlot < 15 ? XV_SLOTS[pickSlot].pos : BENCH_SLOTS[pickSlot - 15].pos[0]))
                .map(p => (
                  <tr key={p.id} {...rowNavTr(() => setSlot(pickSlot, p.id))}
                    style={myLineup.includes(p.id) ? { opacity: .55 } : undefined}>
                    <td><PosBadge pos={p.pos} /></td>
                    <td className="name">{p.name}{myLineup.includes(p.id) ? t('matchday.selected') : ''}</td>
                    <td><Stars ca={p.ca} /></td>
                    <td className="num">{Math.round(p.cond)}%</td>
                  </tr>
                ))}
            </tbody></table>
          </Veil>
        )}

        <SectionTitle sub={t('matchday.dressingRoomSub')}>{t('matchday.dressingRoom')}</SectionTitle>
        <div className="speech-grid talk-tones">
          {SPEECHES.map(s => (
            <button key={s.id} className={`speech-tile${speech === s.id ? ' sel' : ''}`}
              onClick={() => setSpeech(speech === s.id ? null : s.id)}>
              <span className="ico"><Glyph name={s.icon} /></span>
              <b>{t(s.name)}</b>
              <span className="d">{t(s.desc)}</span>
            </button>
          ))}
        </div>
        {/* HOW YOU WATCH IT BELONGS ON THE PAGE, NOT IN THE SHEET (owner,
            v1.1.15: "ready to lead in the international bit dimension wise is
            too big for the screen"). This block - a label, three chips and a
            line explaining the one you picked - was inside the confirm sheet
            and is the tallest thing that was ever in there: measured, it took
            the sheet's content from 202px to 281px on a 412x915 phone at the
            largest text size.
            That alone did not hide the buttons at that size - scripts/
            testsheet.mjs says Take the Field was still reachable - but a sheet
            is capped at 80dvh and scrolls, so every pixel of it is pixels of
            margin against a shorter phone. The club side has never carried
            this weight: its view picker lives in the dressing-room modal and
            its confirm sheet is three lines and two buttons. This is the same
            shape - the choice sits on the page beside the team talk, where it
            can be made in advance, and the sheet asks one question. */}
        <ViewPicker view={view} onPick={setView} />
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button className="btn gold block" style={{ fontSize: '1rem', width: '100%' }} onClick={() => setConfirm(true)}>
            {t('matchday.kickOff')}
          </button>
        </div>
        <div className="spacer" />
      </main>
      {confirm && (
        <Veil onClose={() => setConfirm(false)}>
          <div className="grab" />
          {/* A GUTTER, LIKE ITS CLUB TWIN. .modal sets no horizontal padding
              of its own, so anything not wrapped runs flush to both edges of
              the phone - the heading and the anthems line were touching the
              glass at x=0, which is the other half of "dimension wise is too
              big for the screen". The club ready sheet has always had this
              wrapper and this centring; the Test one never did. */}
          <div style={{ padding: '0 18px 4px' }}>
            <h3 style={{ fontSize: '1.125rem', margin: '2px 0 8px', textAlign: 'center' }}>{t('matchday.readyNation', { nat: nationName(nat) })}</h3>
            <div className="meta" style={{ margin: '6px 0', textAlign: 'center' }}>{t('matchday.anthems')}</div>
          </div>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn ghost" onClick={() => setConfirm(false)}>{t('matchday.notYet')}</button>
            <button className="btn gold" style={{ flex: 1.5, fontSize: '1rem' }}
              onClick={() => {
                setConfirm(false)
                if (view === 'instant') instantResult(speech ?? undefined, true)
                else kickOff(speech ?? undefined, view)
              }}>
              {t(view === 'instant' ? 'matchday.letHimTakeIt' : 'matchday.takeField')}
            </button>
          </div>
        </Veil>
      )}
    </>
  )
}
