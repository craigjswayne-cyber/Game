import { newGame } from '../src/game/newgame'
import { migrate, isPlayable } from '../src/game/save'
import { processWeekAndAdvance } from '../src/game/season'
import type { GameState } from '../src/game/model'

const pristine = () => JSON.parse(JSON.stringify(newGame('northampton', 'T', 777)))

function t(label: string, wreck: (s: any) => void) {
  const s = pristine()
  try { wreck(s) } catch (e) { console.log(`${label}: SETUP THREW`); return }
  let g: GameState | null = null
  try { g = migrate(s) } catch (e) { console.log(`  MIGRATE THREW  ${label}: ${String(e).split('\n')[0].slice(0,110)}`); return }
  if (!isPlayable(g)) { console.log(`  REFUSED        ${label}`); return }
  let thrown = ''
  try { for (let i=0;i<4;i++) processWeekAndAdvance(g) } catch(e) { thrown = String(e).split('\n')[0].slice(0,110) }
  console.log(`  ${thrown ? 'PLAY THREW     ' : 'ok             '}${label}${thrown ? ': '+thrown : ''}`)
}

const FIELDS = ['stadium','colors','short','name','city','country','leagueId','rep','capacity','budget','coach']
console.log('--- USER club missing a field')
for (const f of FIELDS) t(`user club has no ${f}`, s => { delete s.clubs[s.userClubId][f] })
console.log('--- OTHER club missing a field')
for (const f of FIELDS) t(`other club has no ${f}`, s => { const id = Object.keys(s.clubs).find(k=>k!==s.userClubId)!; delete s.clubs[id][f] })
console.log('--- empty squad / empty league')
t('user club has an empty squad', s => { for (const id of s.clubs[s.userClubId].players) delete s.players[id]; s.clubs[s.userClubId].players = [] })
t('every club in natl1 removed', s => { for (const c of Object.values<any>(s.clubs)) if (c.leagueId==='natl1') { delete s.clubs[c.id] } })
t('comp natl1 has empty teamIds+table', s => { s.comps['natl1'].teamIds = []; s.comps['natl1'].table = [] })
t('player name is a number', s => { const p = Object.values<any>(s.players)[0]; p.name = 12345 })
t('venue on an unplayed final is null', s => { for (const f of s.fixtures) f.venue = null })
