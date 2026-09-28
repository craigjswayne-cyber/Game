// Writes discord/data/teams.json from the game's own league tables, so the
// club tags on the server are always the clubs in the game. Run from the repo
// root after a change to the leagues: `cd discord && npm run teams`.
import { writeFileSync } from 'node:fs'
import { LEAGUE_DEFS } from '../../src/game/newgame'
import { NATIONS, NAT_TIERS } from '../../src/game/nations'

type Club = { id: string; name: string; colors?: string[] }
const hex = (c?: string) => (c && /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : null)

const world = (g: 'm' | 'w') => LEAGUE_DEFS(g).map(d => ({
  id: d.id,
  name: d.name,
  clubs: (d.clubs as Club[]).map(c => ({
    id: c.id,
    // a women's side shares its name with the men's in 33 cases, and a role
    // name has to say which one you manage
    role: g === 'w' && !/women|ladies|femin/i.test(c.name) ? `${c.name} Women` : c.name,
    name: c.name,
    colour: hex(c.colors?.[0]),
  })).sort((a, b) => a.name.localeCompare(b.name)),
}))

// the Test sides a manager can actually be offered in the game, strongest first
const nations = NAT_TIERS.map(([code]) => NATIONS.find(n => n.code === code)!)
  .filter(Boolean)
  .sort((a, b) => b.rep - a.rep)
  .map(n => ({ id: n.code, name: n.name, role: `${n.name} (national team)` }))

const out = { generatedFrom: 'src/game/newgame.ts LEAGUE_DEFS and src/game/nations.ts NAT_TIERS', men: world('m'), women: world('w'), nations }
writeFileSync(new URL('../data/teams.json', import.meta.url), JSON.stringify(out, null, 2) + '\n')
const clubs = [...out.men, ...out.women].reduce((n, l) => n + l.clubs.length, 0)
console.log(`teams.json: ${out.men.length} men's leagues, ${out.women.length} women's leagues, ${clubs} clubs, ${nations.length} national teams`)
