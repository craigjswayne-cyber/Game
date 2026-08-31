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
import { kitHoops, kitPattern, kitQuarters, kitTrim } from '../src/game/kits'
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

// ---- four quarters, four colours, and the sleeve edged rather than cut ----
{
  // Owner, v1.1.15: "Quins kit seems to be wrong. Blue lines should be on the
  // sleeves. 4 quarters should be brown, light blue, red, grey."
  //
  // Both halves were real. The quarters were painted out of the club's two
  // colours, so a shirt whose entire identity is four colours at once came out
  // a two-colour chequerboard. And the trim that was meant to be the sleeve's
  // edge was a flat horizontal band laid across a sleeve that runs diagonally -
  // it cut the sleeve in half instead of edging it.
  const g = newGame('northampton', 'Quarters', 904)
  const hex = (c: string): [number, number, number] => {
    const h = c.replace('#', '')
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
  }
  const apart = (a: string, b: string) => {
    const [r1, g1, b1] = hex(a), [r2, g2, b2] = hex(b)
    return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2)
  }
  const q = kitQuarters('harlequins')
  ok(!!q && q.length === 4, `the quartered club names four colours (${q?.join(' ') ?? 'none'})`)
  if (q) {
    // FOUR COLOURS MEANS FOUR. Any pair the eye cannot separate is a
    // two-colour shirt wearing four names.
    const same: string[] = []
    for (let i = 0; i < q.length; i++) {
      for (let j = i + 1; j < q.length; j++) if (apart(q[i], q[j]) < 60) same.push(`${q[i]}/${q[j]}`)
    }
    ok(same.length === 0, `and no two of them are the same colour twice (${same.join(', ') || 'four distinct'})`)
  }
  // and nobody has a palette who is not wearing quarters to put it in
  const misplaced = Object.values(g.clubs).filter(c => kitQuarters(c.id) && kitPattern(c.id) !== 'quarters')
  ok(misplaced.length === 0,
    `every four-colour palette is on a quartered club (${misplaced.map(c => c.id).join(', ') || 'none stranded'})`)

  // THE SLEEVE IS EDGED, NOT CUT. The old draw was a <rect> - an axis-aligned
  // band - over a diagonal sleeve. The fix strokes the sleeve's own outline,
  // so the test is that the sleeve path is what carries the trim.
  const ui = readFileSync('src/ui/components.tsx', 'utf8')
  const sleeveBlock = ui.slice(ui.indexOf('const SLEEVE_L'))
  ok(/stroke=\{trim\}/.test(sleeveBlock), 'the sleeve trim is a stroke along the sleeve outline')
  ok(!/<rect[^>]*y="13"[^>]*fill=\{trim\}/.test(ui),
    'and the flat band that used to lie across the sleeve is gone')
}

// ---- how heavy the hoops are, and who is allowed to differ ----
{
  // Owner, v1.1.17: "Bath should be blue black and white and smaller stripes."
  //
  // The colours were already right - blue ground, white hoops, black edging.
  // What was wrong is the WEIGHT: every hooped club drew three broad bands,
  // which suits Leicester and Northampton and does not suit a navy shirt with
  // fine hoops closely spaced.
  const def = kitHoops('leicester')
  ok(def.n === 3 && def.h === 4,
    `a club that names no weight still draws three broad bands (${def.n} x ${def.h})`)

  const bath = kitHoops('bath')
  ok(bath.n > def.n && bath.h < def.h,
    `Bath wears more hoops and thinner ones (${bath.n} x ${bath.h} against ${def.n} x ${def.h})`)

  // NOBODY ELSE MOVED. The first attempt derived the band positions for every
  // club from the weight, which shifted Leicester, Northampton and Bristol up
  // the shirt to fix Bath - a change nobody asked for. The default is the three
  // positions those shirts have always used, written out rather than computed.
  const ui = readFileSync('src/ui/components.tsx', 'utf8')
  ok(/\[12, 20, 28\]/.test(ui),
    'and the default band positions are still 12, 20 and 28, spelled out')

  // A HAIRLINE IS A HAIRLINE AT EVERY WEIGHT. The trim was a flat 0.7 above and
  // below, which is 1.4 of black against a 4-wide band and 1.4 against a
  // 2-wide one - so fine hoops came out as a WHITE shirt with navy lines on it,
  // the ground swallowed by its own edging. Rendered and looked at; this holds
  // the arithmetic that fixed it.
  ok(/Math\.min\(0\.7, hoops\.h \/ [\d.]+\)/.test(ui),
    'and the trim hairline scales with the band it edges')
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
