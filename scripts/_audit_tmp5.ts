import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
const g: any = newGame('leicester', 'T', 1234)
for (let s = 0; s < 3; s++) for (let w = 0; w < 46; w++) processWeekAndAdvance(g)
console.log('done', g.season)
