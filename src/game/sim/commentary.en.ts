// THE COMMENTARY IN ENGLISH (2.0.0, docs/match-sim-spec.md sections 2 and 7).
//
// Every line commentary.ts writes is a key and its values. Since round 8 the
// words live in the game's dictionary, src/locales/en.json, in its `sim`
// group, one key per wording: 'sim.' + the base + the wording's number, in the
// style of the game's 'comm.pen1' lines ('sim.kickTouch2'). This file only
// reads them back into one list per line for commentary.ts. The other five
// languages are not translated yet (scripts/langparity.ts and i18nprobe.ts
// hold the one marked exemption for the `sim` group).
//
// A new wording goes into en.json as the next number of its base; a new line
// as a new base (a base never ends in a digit).
//
// Owner, 22 November 2026: "the games shouldn't feel repetitive". So a line
// seen often has six or more wordings and a key moment five or more, and
// commentary.ts uses every wording of a line before it repeats one, and
// never says the same sentence twice within twelve lines. The wordings vary
// the shape too: some lead with the man, some with the place, some with
// what it means.
//
// Placeholders:
//   {team} the side the line is about, {opp} the other side
//   {player} {player2} men of {team}; {oppPlayer} a man of {opp}
//   {home} {away} {hs} {as} the score, home first, as the record has it
//   {m} metres, {d} metres from the line, {phase}, {pct}, {men}, {count},
//   {made}, {taken}, {mins}, {margin}, {deficit}, {a}, {b}
//   {cause_k} what a penalty was for ('sim.causeSealingOff1': "sealing off"), from Play.cause
//   {nth_k} 'sim.nth2' "second" and so on; {kick_k} the kind of kick; {type_k} the kind of try;
//   {need_k} what a trailing side needs; {zone_k} where on the field
//   a placeholder ending in _k holds another key, which is put into words first.
// No pronouns for the players: the game has women's sides, and "he" or "she"
// would need a second key for each line ('_f' in the game's other files).
// A wording is only used when every man it names is named in the record, so
// each line has at least one wording with no player in it.

import en from '../../locales/en.json'

/** the club's called moves, by the playbook's own words ('mv_loop' -> "miss-and-loop"), as the manager sees them */
export const MOVE_EN: Record<string, string> = (en as unknown as { moves: { say: Record<string, string> } }).moves.say

/** every line's wordings, in order: sim.kickTouch1, sim.kickTouch2 ... read back into lists */
const SIM_FLAT = (en as unknown as { sim: Record<string, string> }).sim
export const SIM_EN: Record<string, string[]> = {}
for (const [k, v] of Object.entries(SIM_FLAT)) {
  const m = /^(.*?)(\d+)$/.exec(k)
  if (!m) throw new Error(`sim.${k}: a wording's key ends in its number`)
  ;(SIM_EN[m[1]] ??= [])[Number(m[2]) - 1] = v
}
for (const [b, list] of Object.entries(SIM_EN)) if (list.some(x => x === undefined)) throw new Error(`sim.${b}: a wording number is missing`)

/** the flat dictionary as the game's locale files hold it: 'sim.kickTouch2' -> words */
export const EN_FLAT: Record<string, string> = Object.fromEntries(Object.entries(SIM_FLAT).map(([k, v]) => [`sim.${k}`, v]))
