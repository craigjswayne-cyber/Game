// Probe: the fresh-world Northampton is the club's own announced 2026/27
// squad (user's screenshots of the official squad-list post, round 27).
//
// The announcement is the source of truth: nine departures gone from the
// club, the new seniors present, Neculai and Els arrived by VERIFIED_CLUB
// relocation rather than duplicate entries, the Senior Academy names in the
// academy, and Hendy the resident full-back after Furbank's exit. Namesakes
// elsewhere (Cardiff's Atuanya, the Pirates' Tom James) are allowed to
// exist - the claim is about Northampton, not the whole world.
import { newGame } from '../src/game/newgame'

const g = newGame('northampton', 'SquadCheck', 61)
const club = g.clubs['northampton']
const seniors = club.players.map(id => g.players[id]).filter(p => p && !p.acad)
const acad = club.players.map(id => g.players[id]).filter(p => p && p.acad)
let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const names = new Set(seniors.map(p => p.name))
const acadNames = new Set(acad.map(p => p.name))

for (const n of ['Ion Neculai', 'Jordan Els']) ok(names.has(n), `${n} arrived via relocation`)
for (const n of ['Leftheri Zigiriadis', 'Ben Alexander', 'James Bennett', 'Josh Taylor', 'Aidan Pugh', 'Malik Faissal', 'Edoardo Todaro']) {
  ok(names.has(n), `${n} is in the senior squad`)
}
// gone from Northampton per the list - namesakes at other clubs (Cardiff's
// Atuanya, Pirates' Tom James) are allowed to exist, just not here
for (const n of ['Tom West', 'Elliot Millar Mills', 'Emeka Atuanya', 'Angus Scott-Young', 'Sam Graham', 'Fyn Brown', 'Tom James', 'George Furbank', 'James Ramm']) {
  ok(!names.has(n) && !acadNames.has(n), `${n} is gone from Northampton`)
}
const senAcad = ['Noah Buxton', 'Oliver Scola', 'Aiden Reid', "Sonny Tonga'uiha", 'Aiden Ainsworth-Cave',
  "George Tonga'uiha", 'Jack Lewis', 'Alex Mead', 'Charlie Ulcoq', 'Sonny Goode', 'Jonny Weimann',
  'Hugh Shields', 'Henry Lumley', 'Freddie St John', 'James Pater', 'Charlie Tamani', 'Thomas Rowe']
for (const n of senAcad) ok(acadNames.has(n), `${n} is in the academy`)
const fb = seniors.filter(p => p.pos === 'FB')
ok(fb.some(p => p.name === 'George Hendy'), `Hendy is the resident 15 (FBs: ${fb.map(p => p.name).join(', ') || 'NONE'})`)
console.log(`  --  ${seniors.length} seniors, ${acad.length} academy`)
const quins = g.clubs['harlequins']
ok(!quins || !quins.players.some(id => g.players[id]?.name === 'Jordan Els'), 'Els is no longer at Harlequins')
console.log(fails ? `\nSQUAD CHECK FAILED (${fails})` : '\nSQUAD CHECK PASSED')
process.exit(fails ? 1 : 0)
