// ---- THE WEEK BASIS, AND THE PROBE THAT WAS NAMED BUT NEVER WRITTEN --------
//
// Until v1.5.1 an absolute-week stamp was `season * 45 + week`. A season is 48
// weeks now, so every save written before that change has to be converted once
// on load, and `rebase` in save.ts is the only place that does it.
//
// That function's comment cited "scripts/basisprobe.ts" as the guard holding
// it: "it builds a save on the old basis, migrates it, and checks that every
// stamp still sits the same number of weeks from today as it did before."
// The file did not exist. Nothing in the repository mentioned that name except
// the sentence claiming it. One hundred and eighty-four probes, and not one of
// them converted a date, for four minor versions.
//
// What the missing probe would have caught, found by external audit against
// d7c4ec7 on 13 Sep 2026: weeks are 1-BASED, so the last week of an old season
// is a clean multiple of 45, and `floor(v / 45)` read it as the first week of
// the NEXT one. Season 0 week 45 migrated to 48. Season 1 week 45 migrated to
// 96 instead of 93. Always exactly three weeks out, and only ever on week 45 -
// the other forty-four weeks converted correctly, which is precisely why it
// read as right for so long.
//
// So this probe does not check that a migrated save still loads. savefuzz and
// cloneprobe do that, and they passed throughout the whole time this was
// broken. It checks the ARITHMETIC: every valid old date, in every field that
// is rebased, against the one definition of the answer the game itself uses.
import { readFileSync } from 'node:fs'
import { newGame } from '../src/game/newgame'
import { migrate } from '../src/game/save'
import { WEEK_BASIS, absWeek } from '../src/game/model'
import type { GameState } from '../src/game/model'

const OLD_BASIS = 45

let fails = 0
const ok = (cond: boolean, what: string) => {
  console.log(`${cond ? '  ok' : 'FAIL'} ${what}`)
  if (!cond) fails++
}

// The fields save.ts rebases, split the way rebaseStamps walks them.
const PLAYER_FIELDS = ['joinedAt', 'loanSince', 'loanUntil', 'lastChatWk', 'retakeAt']
const CLUB_FIELDS = ['debtSince']
const STATE_FIELDS = ['groundsAt', 'lawWatchAt', 'challengeAt', 'chatWk', 'natAskAt',
                      'natCoachAskAt', 'courtedAt', 'natCall']

const oldAbs = (season: number, week: number) => season * OLD_BASIS + week

/**
 * A save on the old basis carrying the same stamp in every rebased field.
 *
 * Deliberately a bare object rather than a newGame() world: this runs on 270
 * dates and a real world per date would put the probe into the slow list,
 * where it would be run about as often as the probe that never existed. A real
 * career goes through end to end further down.
 *
 * It also has no `basis` field at all, which is the shape a genuine pre-1.5.1
 * save actually has.
 */
function oldSave(v: number): GameState {
  const s: Record<string, unknown> = {
    // ids because migrate() backfills facilities off club.id on its way past
    players: { p1: { id: 'p1', ...Object.fromEntries(PLAYER_FIELDS.map(f => [f, v])) } },
    clubs: { c1: { id: 'c1', ...Object.fromEntries(CLUB_FIELDS.map(f => [f, v])) } },
  }
  for (const f of STATE_FIELDS) s[f] = v
  return s as unknown as GameState
}

/** Every rebased stamp in a migrated save, by name. */
function stamps(s: GameState): Array<[string, unknown]> {
  const g = s as unknown as Record<string, any>
  const out: Array<[string, unknown]> = []
  for (const f of PLAYER_FIELDS) out.push([`player.${f}`, g.players.p1[f]])
  for (const f of CLUB_FIELDS) out.push([`club.${f}`, g.clubs.c1[f]])
  for (const f of STATE_FIELDS) out.push([`state.${f}`, g[f]])
  return out
}

// ---- the field list this probe asserts against is the one save.ts uses ------
//
// The arithmetic below is worthless on a field save.ts forgets to rebase, and
// worthless on a field this probe forgets to check. Neither list can be
// imported - rebaseStamps is private and the names are string literals inside
// it - so the source is read and the two are held against each other. A field
// added to one and not the other fails here rather than drifting silently,
// which is the failure mode the save.ts comment calls the dangerous part.
{
  const src = readFileSync(new URL('../src/game/save.ts', import.meta.url), 'utf8')
  const listed = new Set<string>()
  for (const m of src.matchAll(/for \(const f of \[([^\]]+)\]\)/g)) {
    for (const q of m[1].matchAll(/'([A-Za-z]+)'/g)) listed.add(q[1])
  }
  for (const m of src.matchAll(/num\(q\.([A-Za-z]+)\)\) q\.([A-Za-z]+)/g)) listed.add(m[1])

  const mine = new Set([...PLAYER_FIELDS, ...CLUB_FIELDS, ...STATE_FIELDS])
  const missed = [...listed].filter(f => !mine.has(f))
  const extra = [...mine].filter(f => !listed.has(f))
  ok(missed.length === 0, `this probe checks every field save.ts rebases${missed.length ? ` (missing: ${missed.join(', ')})` : ''}`)
  ok(extra.length === 0, `and checks nothing save.ts does not rebase${extra.length ? ` (stale: ${extra.join(', ')})` : ''}`)
  ok(mine.size === 14, `fourteen stamps in all (${mine.size})`)
}

// ---- the whole old calendar, every field, against absWeek --------------------
//
// absWeek is the game's own definition of an absolute week. If a migrated
// stamp does not equal absWeek(oldSeason, oldWeek) then the save is reading a
// different date than it was written with, whatever the arithmetic looks like.
{
  let bad = 0
  let firstBad = ''
  for (let season = 0; season <= 5; season++) {
    for (let week = 1; week <= OLD_BASIS; week++) {
      const migrated = migrate(oldSave(oldAbs(season, week)))
      const want = absWeek(season, week)
      for (const [name, got] of stamps(migrated)) {
        if (got !== want) {
          bad++
          if (!firstBad) firstBad = `S${season} W${week} ${name}: ${String(got)}, wanted ${want}`
        }
      }
    }
  }
  ok(bad === 0, `all 270 old dates convert in all 14 fields${bad ? ` (${bad} wrong, first: ${firstBad})` : ''}`)
}

// ---- the boundaries, named, so a failure says which one -----------------------
{
  const cases: Array<[number, number, string]> = [
    [0, 1, 'the first week there has ever been'],
    [0, 2, 'the second'],
    [0, 44, 'the week before an old season ended'],
    [0, 45, 'THE LAST WEEK OF AN OLD SEASON, which is where this broke'],
    [1, 1, 'the first week of the next one'],
    [1, 44, 'season 1, the week before the end'],
    [1, 45, 'season 1 week 45'],
    [2, 1, 'season 2 week 1'],
    [2, 45, 'season 2 week 45'],
    [5, 45, 'five seasons in, still the last week'],
  ]
  for (const [season, week, what] of cases) {
    const got = (migrate(oldSave(oldAbs(season, week))) as unknown as Record<string, number>).chatWk
    ok(got === absWeek(season, week), `S${season} W${week} -> ${absWeek(season, week)}: ${what} (got ${got})`)
  }
}

// ---- the audit's own table, verbatim ------------------------------------------
//
// These five rows are the ones the external audit published on 13 Sep 2026.
// The three that were wrong are the three where the old value is a multiple of
// 45. Kept as literals rather than derived, so a change to absWeek cannot make
// this agree with itself.
{
  const table: Array<[number, number, string]> = [
    [45, 45, 'S0 W45 stays 45 (was 48)'],
    [46, 49, 'S1 W1 is 49'],
    [90, 93, 'S1 W45 is 93 (was 96)'],
    [91, 97, 'S2 W1 is 97'],
    [135, 141, 'S2 W45 is 141 (was 144)'],
  ]
  for (const [from, want, what] of table) {
    const got = (migrate(oldSave(from)) as unknown as Record<string, number>).chatWk
    ok(got === want, `${what} (got ${got})`)
  }
}

// ---- the conversion never goes backwards ---------------------------------------
//
// A weaker invariant than the table above but a much broader one: whatever the
// formula is, a later old date must migrate to a later new date.
//
// Worth being honest about what it is for: the BROKEN version passed this.
// W44 gave 44, W45 gave 48, the next W1 gave 49 - three weeks too far but
// still climbing, so ordering never noticed. It is here to catch a future
// formula that reverses or repeats, not this one. The table above is what
// catches this one, which is the argument for asserting exact dates rather
// than properties that sound stronger than they are.
{
  let last = -1
  let monotonic = true
  let where = ''
  for (let season = 0; season <= 5; season++) {
    for (let week = 1; week <= OLD_BASIS; week++) {
      const got = (migrate(oldSave(oldAbs(season, week))) as unknown as Record<string, number>).chatWk
      if (got <= last) { monotonic = false; if (!where) where = `S${season} W${week}: ${got} after ${last}` }
      last = got
    }
  }
  ok(monotonic, `every old date migrates later than the one before it${where ? ` (${where})` : ''}`)
}

// ---- zero is not a date -----------------------------------------------------
//
// An unset stamp holds 0, meaning "never". The 1-based conversion sends it to
// -48 if it is allowed anywhere near the sum, so it is returned untouched. The
// audit's suggested fix did not say so and would have introduced this.
{
  const g = migrate(oldSave(0)) as unknown as Record<string, any>
  const wrong = stamps(g as unknown as GameState).filter(([, v]) => v !== 0)
  ok(wrong.length === 0, `"never" stays 0 and does not become -${WEEK_BASIS}${wrong.length ? ` (${wrong.map(([n, v]) => `${n}=${v}`).join(', ')})` : ''}`)
}

// ---- migrating twice must not rebase twice ------------------------------------
//
// A career loaded, closed and loaded again goes through migrate() each time.
// Rebasing a second time pushes every date out by a further three weeks a
// season, which the save.ts comment rightly calls worse than never rebasing.
{
  const once = migrate(oldSave(oldAbs(3, 20)))
  const want = absWeek(3, 20)
  ok((once as unknown as Record<string, number>).basis === WEEK_BASIS, 'the first migration marks the basis as done')
  const twice = migrate(once)
  const moved = stamps(twice).filter(([, v]) => v !== want)
  ok(moved.length === 0, `a second migration moves nothing${moved.length ? ` (${moved.map(([n, v]) => `${n}=${v}`).join(', ')})` : ''}`)
}

// ---- a save already on the new basis is left alone -----------------------------
{
  const s = oldSave(absWeek(4, 12)) as unknown as Record<string, unknown>
  s.basis = WEEK_BASIS
  const out = migrate(s as unknown as GameState)
  const moved = stamps(out).filter(([, v]) => v !== absWeek(4, 12))
  ok(moved.length === 0, 'a current save is not converted a second time')
}

// ---- maternity was never on either basis ---------------------------------------
//
// It shipped storing a within-season week, so a leave running past the end of a
// season could never come due. save.ts ends the leave rather than converting a
// number that cannot be converted; this holds it to that.
{
  const s = oldSave(oldAbs(1, 10)) as unknown as Record<string, any>
  s.players.p1.maternity = { until: 12, from: 4 }
  const out = migrate(s as unknown as GameState) as unknown as Record<string, any>
  ok(out.players.p1.maternity === undefined, 'a within-season maternity leave is ended rather than rebased')

  const s2 = oldSave(oldAbs(1, 10)) as unknown as Record<string, any>
  s2.players.p1.maternity = { until: absWeek(1, 10), from: absWeek(1, 2) }
  const out2 = migrate(s2 as unknown as GameState) as unknown as Record<string, any>
  ok(out2.players.p1.maternity !== undefined, 'a leave already stamped past a season length is left for the engine')
}

// ---- and a real career, end to end ---------------------------------------------
//
// The exhaustive pass above runs on bare objects. This one takes a world the
// game actually built, pushes every rebased stamp back onto the old basis,
// migrates it, and checks the dates land where a 48-week season says they
// should. It is the case a player has: a save, not a fixture.
{
  const g = newGame('northampton', 'Basis', 11)
  const season = 2, week = 45          // the week that was broken
  const v = oldAbs(season, week)
  const want = absWeek(season, week)

  const anyG = g as unknown as Record<string, any>
  delete anyG.basis
  const pid = Object.keys(g.players)[0]
  for (const f of PLAYER_FIELDS) anyG.players[pid][f] = v
  const cid = g.userClubId
  for (const f of CLUB_FIELDS) anyG.clubs[cid][f] = v
  for (const f of STATE_FIELDS) anyG[f] = v

  migrate(g)

  const bad: string[] = []
  for (const f of PLAYER_FIELDS) if (anyG.players[pid][f] !== want) bad.push(`player.${f}=${anyG.players[pid][f]}`)
  for (const f of CLUB_FIELDS) if (anyG.clubs[cid][f] !== want) bad.push(`club.${f}=${anyG.clubs[cid][f]}`)
  for (const f of STATE_FIELDS) if (anyG[f] !== want) bad.push(`state.${f}=${anyG[f]}`)
  ok(bad.length === 0, `a real career's season ${season} week ${week} lands on ${want}${bad.length ? ` (${bad.join(', ')})` : ''}`)
  ok(g.basis === WEEK_BASIS, 'and the career is marked as converted')
}

console.log(fails
  ? `\nBASIS PROBE FAILED (${fails})`
  : '\nBASIS PROBE PASSED: every old date, every rebased field, and week 45 where it belongs')
process.exit(fails ? 1 : 0)
