// Probe: no real club, competition, sponsor or venue mark reaches the build.
//
// This exists because the same mistake happened twice in one afternoon. The
// v1.0.3 rename swept every real competition name out of the data - and left
// "SIX NATIONS" on the Home screen and "A RUGBY WORLD CUP season" in a rollover
// inbox subject, because the sweep was case-sensitive and those two are
// shouted. Both are among the most aggressively policed marks in the sport,
// both were rendered on screen, and nothing in a suite of 110 harnesses
// noticed. brandprobe checks the game's OWN name; nothing checked for anybody
// else's.
//
// So this greps the SHIPPED BUNDLE, not the source: comments are stripped by
// then, which means a source comment citing where squad data came from - honest
// provenance, and worth keeping - does not trip it, while a string a player can
// actually see does.
//
// PLAYER NAMES ARE NOT IN HERE. ~1,600 real athletes still ship, deliberately
// and knowingly (docs/release-readiness.md), and a tripwire that fired on every
// one of them would be turned off within a day. This guards the marks that were
// deliberately removed, so that removing them stays done.
//
// Run: node scripts/ipprobe.mjs   (needs a fresh npm run build)
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const MARKS = {
  'club names': [
    'Bath Rugby', 'Bristol Bears', 'Exeter Chiefs', 'Gloucester Rugby', 'Leicester Tigers',
    'Northampton Saints', 'Sale Sharks', 'Newcastle Falcons', 'Newcastle Red Bulls',
    'Stade Toulousain', 'Union Bordeaux', 'Stade Rochelais', 'ASM Clermont', 'Racing 92',
    'Stade Français', 'Castres Olympique', 'Aviron Bayonnais', 'Section Paloise',
    'Leinster Rugby', 'Munster Rugby', 'Ulster Rugby', 'Connacht Rugby', 'Glasgow Warriors',
    'Vodacom Bulls', 'DHL Stormers', 'Hollywoodbets', 'Emirates Lions', 'Cardiff Blues',
    'Moana Pasifika', 'Fijian Drua', 'ACT Brumbies', 'Queensland Reds', 'NSW Waratahs',
    'Western Force', 'Ealing Trailfinders', 'Cornish Pirates', 'Doncaster Knights',
    'Bedford Blues', 'Plymouth Albion', 'Rosslyn Park', 'Leeds Tykes', 'Saitama Wild Knights',
    'Brave Lupus', 'Sungoliath', 'Kubota Spears', 'Canon Eagles', 'Toyota Verblitz',
    'Kobelco', 'Blue Revs', 'Black Rams', 'Dynaboars', 'D-Rocks', 'Honda Heat',
  ],
  'competition marks': [
    'Gallagher Premiership', 'Premiership Rugby', 'Top 14', 'Pro D2',
    'United Rugby Championship', 'Super Rugby', 'Japan Rugby League One', 'Japan League One',
    'National League One', 'Champions Cup', 'Challenge Cup', 'Six Nations',
    'Rugby World Cup', 'Rugby Championship', 'Pacific Nations Cup', 'British & Irish Lions',
    'British and Irish Lions', 'Currie Cup', 'Heineken Cup',
  ],
  'sponsor and venue marks': [
    // NOT bare 'Gallagher' or 'Vodacom': those are a real PLAYER's surname
    // (Matt Gallagher, Benetton) and a club-name prefix already covered above.
    // A tripwire that fires on a man's name is a tripwire somebody turns off.
    'Mattioli Woods', 'cinch Stadium', 'StoneX', 'AJ Bell', 'Sandy Park', 'Ashton Gate',
    'Kingsholm', 'Twickenham Stoop', 'Kingston Park', 'Welford Road', 'Franklin',
    'Thomond Park', 'Kingspan Stadium', 'Aviva Stadium', 'Dexcom Stadium', 'Hive Stadium',
    'Scotstoun', 'Loftus Versfeld', 'Ellis Park', 'Suncorp', 'Allianz Stadium', 'HBF Park',
    'GIO Stadium', 'Eden Park', 'Sky Stadium', 'Forsyth Barr', 'Apollo Projects',
    'FMG Stadium', 'Stade Ernest-Wallon', 'Chaban-Delmas', 'Marcel-Michelin', 'Jean-Bouin',
    'Stade Mayol', 'Matmut', 'GGL Stadium', 'Aimé-Giral', 'Wembley Stadium', 'Murrayfield',
    'Stade de France', 'Principality Stadium', 'Croke Park', 'Stade Velodrome',
    'Heineken Cup', 'Heineken Champions',
  ],
  'governing bodies quoted': ['World Rugby', 'SANZAAR', 'the RFU', 'the IRFU', 'the WRU'],
}

let fails = 0
const bad = (m) => { fails++; console.error(`FAIL  ${m}`) }

const DIST = 'dist'
if (!existsSync(DIST)) {
  console.error('FAIL  no dist/ - run npm run build first, this probe reads the shipped bundle')
  process.exit(1)
}

// everything a browser would actually download
const files = []
const walk = (dir) => {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name)
    if (name.isDirectory()) walk(p)
    else if (/\.(js|css|html|webmanifest|txt|json)$/.test(name.name)) files.push(p)
  }
}
walk(DIST)

const bundle = files.map(f => ({ f, text: readFileSync(f, 'utf8') }))
console.log(`scanning ${files.length} shipped files (${Math.round(bundle.reduce((s, b) => s + b.text.length, 0) / 1024)} KB)`)

// THE SAVE MIGRATION HAS TO NAME THE OLD STRINGS TO REWRITE THEM. save.ts
// carries a rename table so a career started before v1.0.3 stops showing
// "Gallagher Premiership" on its Annual, which means the old mark is in the
// bundle by necessity - as the KEY of a pair whose value is the new name, never
// as anything a player can see. Recognised by that adjacency rather than
// allowlisted blindly: if one of these ever appears somewhere that is not next
// to its replacement, it still fails.
// READ FROM save.ts, NOT COPIED. A second copy of the rename table drifts: the
// first version of this probe listed 'Champions Cup' while save.ts said
// 'Continental Champions Cup', and the probe then failed on its own table.
// There is one table, and it lives where the migration does.
const RENAMED_SRC = readFileSync('src/game/save.ts', 'utf8')
const MIGRATION_PAIRS = Object.fromEntries(
  [...RENAMED_SRC.matchAll(/\['([^']+)',\s*'([^']+)'\]/g)]
    .map(m => [m[1], m[2]])
    .filter(([was, now]) => was !== now && /[A-Z]/.test(was)),
)
if (Object.keys(MIGRATION_PAIRS).length < 10) {
  console.error('FAIL  could not read the rename table out of src/game/save.ts')
  process.exit(1)
}

/**
 * Blank the rename table out of a file before searching it.
 *
 * Masking rather than per-hit testing, because the pairs overlap: "Rugby
 * Championship" is a substring of "United Rugby Championship", so a hit-by-hit
 * check finds the short mark inside the long pair and cannot see that the long
 * one is accounted for. Blanking the whole pair removes both at once, and
 * anything left over is a real occurrence somewhere else in the build.
 */
const maskMigration = (text) => {
  let out = text
  let n = 0
  for (const [was, now] of Object.entries(MIGRATION_PAIRS)) {
    // the minified table renders as ["was","now"] - mask the pair, not the mark
    const pair = `"${was}","${now}"`
    while (out.includes(pair)) { out = out.replace(pair, ' '.repeat(pair.length)); n++ }
  }
  maskedPairs += n
  return out
}

let checked = 0
let maskedPairs = 0
let idSkips = 0
for (const b of bundle) b.text = maskMigration(b.text)
for (const [group, marks] of Object.entries(MARKS)) {
  const hits = []
  for (const mark of marks) {
    checked++
    // case-insensitive ON PURPOSE. The two that shipped were SIX NATIONS and
    // RUGBY WORLD CUP - the sweep that removed them was case-sensitive, and a
    // tripwire that repeats the original mistake is worth nothing.
    const re = new RegExp(mark.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    for (const { f, text } of bundle) {
      if (!re.test(text)) continue
      const at = text.search(re)
      // AN INTERNAL ID IS NOT A DISPLAY NAME. Club ids (sungoliath, dynaboars,
      // bravelupus) are lowercase object keys the player never sees, and the
      // rename map keeps them on purpose - so a lowercase match sitting in key
      // position is the id, not the mark. Anything with real capitals, or not
      // used as a key, still fails.
      const matched = text.slice(at, at + mark.length)
      const isKey = matched === matched.toLowerCase() && text[at + mark.length] === ':'
      if (isKey) { idSkips++; continue }
      hits.push(`${mark}  in ${f}: "${text.slice(Math.max(0, at - 40), at + mark.length + 40).replace(/\s+/g, ' ')}"`)
      break
    }
  }
  if (hits.length) {
    bad(`${hits.length} ${group} in the shipped build`)
    for (const h of hits.slice(0, 8)) console.error(`        ${h}`)
  } else {
    console.log(`  ok  no ${group} (${marks.length} checked)`)
  }
}

if (maskedPairs || idSkips) {
  console.log(`\naccounted for: ${maskedPairs} rename-table pairs in save.ts, ${idSkips} internal club ids`)
}
console.log(fails
  ? `\nIP PROBE FAILED (${fails}): a real mark reached the build`
  : `\nIP PROBE PASSED: ${checked} real marks checked, none of them ship`)
process.exit(fails ? 1 : 0)
