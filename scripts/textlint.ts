// House-style lint over the source tree: game text must never carry an em
// dash (standing rule) or mojibake from a bad encoding round-trip. En dashes
// are allowed here because the score convention (24–18) is deliberate; the
// runtime sweep in invariants.ts checks that en dashes only ever appear in
// that digit-to-digit context once the text is actually rendered.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

let fails = 0
const flag = (file: string, line: number, why: string, text: string) => {
  fails++
  console.error(`${file}:${line} ${why}: ${text.trim().slice(0, 100)}`)
}

const scan = (file: string) => {
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (line.includes('—')) flag(file, i + 1, 'em dash', line)
    if (line.includes('―')) flag(file, i + 1, 'horizontal bar', line)
    if (line.includes('â€') || line.includes('�')) flag(file, i + 1, 'mojibake', line)
    // A club's possessive built with a bare apostrophe-s. Rugby club names are
    // overwhelmingly plural in form - Saracens, Harlequins, Crusaders, Ospreys,
    // Brumbies - so this produces "Crusaders's media team" for a large slice of
    // the league. Found live in the wire probe's sample output. model.poss()
    // handles both cases; .short is always a club, so it is safe to demand it.
    if (/\.short *(\?\?[^}]*)?\}'s/.test(line)) flag(file, i + 1, 'club possessive - use poss()', line)
    // NO EMOJI IN THE COPY, and this is a ratchet: 2,890 strings across six
    // languages and 149 news subjects in the engine have just had theirs
    // taken out, and the only thing that stops them coming back one commit at
    // a time is a rule.
    //
    // WHY THEY WENT. Emoji are the one part of a interface drawn by the
    // reader's operating system rather than by the app, so the same story wore
    // a different face on Android, iOS and the web build - and 25 of them were
    // flags, which Windows does not draw at all. They also cannot be styled,
    // sized, coloured or themed, which meant the game's identity was being
    // carried by 137 pictures it did not own.
    //
    // WHAT IS STILL ALLOWED. Geometric marks are typography, not pictures:
    // the triangles that mark a forward action, the pips that draw a level,
    // the arrows that show a table move. They render in the text face, take
    // its colour, and are listed in MARKS below.
    if (EMOJI.test(line)) {
      // HARD ONLY OVER THE DICTIONARY. src/locales is copy and nothing else,
      // so an emoji there is always the fault this rule is about. Everywhere
      // else the same character might be a deliberate icon slot waiting for
      // its screen's turn - a specialism badge, a weather glyph, the 25
      // national flags - and failing the build on those would mean ripping
      // them out with nothing drawn to put in their place. They are counted
      // instead, and the count is the work left.
      if (file.includes('/locales/')) flag(file, i + 1, 'emoji in copy - use an icon', line)
      else pending++
    }
  })
}
let pending = 0

/** Geometric and arrow marks the house style keeps: these are set in the text
 *  face and take its colour, which is the whole difference. */
const MARKS = '\u2713\u2717\u2715\u25B8\u25C2\u25B4\u25BE\u25B2\u25BC\u25B6\u25C0\u25BA\u25C4\u25CB\u25CF\u25CD\u25C9'
/** Pictographs: the emoji planes, the dingbats, and the selectors and joiners
 *  that dress a base character up as one. */
const EMOJI = new RegExp(
  `(?![${MARKS}])`
  + '[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}'
  + '\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{20E3}]', 'u')

const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.(ts|tsx|html|css)$/.test(name)) scan(p)
  }
}

walk('src')
scan('index.html')

if (pending) console.log(`  emoji still in components and stylesheets: ${pending} lines`
  + ' (icon slots, per screen, as each phase reaches them)')
if (fails === 0) console.log('TEXT LINT PASSED (src + index.html clean, no emoji in the dictionary)')
else { console.error(`TEXT LINT: ${fails} violations`); process.exit(1) }
