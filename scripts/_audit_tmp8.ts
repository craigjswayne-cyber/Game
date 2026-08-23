import { newGame } from '../src/game/newgame'
import { migrate, isPlayable } from '../src/game/save'
import { processWeekAndAdvance } from '../src/game/season'
const base = JSON.parse(JSON.stringify(newGame('northampton','T',777)))
const keys = Object.keys(base)
console.log('top-level fields:', keys.length)
for (const k of keys) {
  const s = JSON.parse(JSON.stringify(base))
  delete s[k]
  let g:any=null, msg=''
  try { g = migrate(s) } catch(e){ msg='MIGRATE THREW: '+String(e).split('\n')[0].slice(0,90) }
  if (!msg) {
    if (!isPlayable(g)) msg = 'refused'
    else { try { for(let i=0;i<6;i++) processWeekAndAdvance(g) } catch(e){ msg='PLAY THREW: '+String(e).split('\n')[0].slice(0,90) } }
  }
  if (msg && msg!=='refused') console.log(`  ${k}: ${msg}`)
  else if (msg==='refused') console.log(`  ${k}: refused (ok if world-critical)`)
}
