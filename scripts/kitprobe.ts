/**
 * ---- CLUB COLOURS, AND NOTHING THAT BELONGS TO ANYBODY ----
 *
 * Owner, with photographs of this season's Bath, Leicester, Harlequins,
 * Saracens, Northampton and Bristol shirts: "adding a few prem team kits for
 * this season to replicate but not use anything official".
 *
 * The second half of that sentence is the important half, and it is the reason
 * this probe exists rather than a note in a commit message. There is a bright
 * line between a game that prints a club's colours - which every newspaper
 * league table has always done - and one that ships a badge, a sponsor's
 * wordmark or a manufacturer's mark it has no right to. This holds that line
 * mechanically: NO IMAGE FILE OF ANY KIND is referenced by the kit or crest
 * code, so there is nowhere for licensed artwork to arrive later without
 * somebody having to delete this test first.
 *
 * The rest is craft: a hooped club has to actually show hoops (Bath's second
 * colour was the same black it is edged in, so it drew navy on navy), and a
 * trim colour has to contrast with what it sits against or it is invisible
 * work.
 *
 * Run: npx vite-node scripts/kitprobe.ts
 */
import { readFileSync } from 'node:fs'
import { kitPattern, kitTrim } from '../src/game/kits'
import { newGame } from '../src/game/newgame'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : ' FAIL '} ${what}`)
  if (!c) fails++
}

// ---- nothing official, held mechanically ----
{
  for (const f of ['src/game/kits.ts', 'src/data/kittrim.ts', 'src/ui/components.tsx']) {
    const src = readFileSync(f, 'utf8')
    const art = [...src.matchAll(/["'`][^"'`\n]*\.(png|jpg|jpeg|svg|webp|gif|avif)["'`]/gi)].map(m => m[0])
    ok(art.length === 0, `${f} references no image file at all (${art.join(', ') || 'none'})`)
  }
  const kits = readFileSync('src/game/kits.ts', 'utf8') + readFileSync('src/data/kittrim.ts', 'utf8')
  // a sponsor or manufacturer name would be the other way this goes wrong
  const brands = ['macron', 'castore', "o'neills", 'oneills', 'canterbury', 'umbro', 'kukri', 'gilbert', 'dpd', 'gallagher']
  const found = brands.filter(b => kits.toLowerCase().includes(b))
  ok(found.length === 0, `and names no manufacturer or sponsor (${found.join(', ') || 'none'})`)
}

// ---- the six the owner photographed ----
{
  const want: [string, string, boolean][] = [
    // club, what it should be wearing, does it need a third colour
    ['bath', 'hoops', true],
    ['bristol', 'hoops', true],
    ['leicester', 'hoops', true],
    ['harlequins', 'quarters', true],
    ['northampton', 'hoops', true],
    ['saracens', 'solid', false],
  ]
  for (const [id, pattern, needsTrim] of want) {
    ok(kitPattern(id) === pattern, `${id} wears ${pattern} (draws ${kitPattern(id)})`)
    if (needsTrim) ok(!!kitTrim(id), `${id} carries the third colour that makes it recognisable`)
  }
}

// ---- a pattern nobody can see is not a pattern ----
{
  const g = newGame('northampton', 'Kits', 902)
  const hex = (c: string): [number, number, number] => {
    const h = c.replace('#', '')
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
  }
  // plain channel distance: enough to say "these are different colours" without
  // pretending to be a contrast standard (nightcontrast owns that job)
  const apart = (a: string, b: string) => {
    const [r1, g1, b1] = hex(a), [r2, g2, b2] = hex(b)
    return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2)
  }
  const flat: string[] = []
  const invisibleTrim: string[] = []
  for (const club of Object.values(g.clubs)) {
    const [c1, c2] = club.colors
    if (kitPattern(club.id) !== 'solid' && apart(c1, c2) < 60) flat.push(`${club.id} (${c1}/${c2})`)
    const trim = kitTrim(club.id)
    // the trim sits against BOTH colours, so it has to be told apart from both
    if (trim && (apart(trim, c1) < 60 || apart(trim, c2) < 60)) invisibleTrim.push(`${club.id} (${trim})`)
  }
  ok(flat.length === 0, `every patterned club has two colours you can tell apart (${flat.join(', ') || 'none flat'})`)
  ok(invisibleTrim.length === 0, `and every trim stands out from both of them (${invisibleTrim.join(', ') || 'none lost'})`)
}

// ---- and every trim belongs to a club that exists ----
{
  const g = newGame('northampton', 'Kits', 903)
  const kits = readFileSync('src/data/kittrim.ts', 'utf8')
  const trimmed = [...kits.matchAll(/^ {2}(\w+): '#[0-9a-fA-F]{6}',/gm)].map(m => m[1])
  const ghosts = trimmed.filter(id => !g.clubs[id])
  ok(ghosts.length === 0, `${trimmed.length} trims, all of them on a club in the game (${ghosts.join(', ') || 'no ghosts'})`)
}

console.log(fails === 0
  ? '\nKIT PROBE PASSED: colours and how they are worn, and not one thing that belongs to anybody else'
  : `\nKIT PROBE FAILED: ${fails}`)
process.exit(fails === 0 ? 0 : 1)
