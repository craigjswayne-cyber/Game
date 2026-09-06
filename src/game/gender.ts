/**
 * ---- TWO GAMES, NEVER ONE ----
 *
 * Owner, 6 Sep 2026, in capitals and twice: "THERE IS NO CROSS WITH ANY OF THE
 * MENS TEAMS, THEY MUST STAY SEPERATE IN THE GAME... YOU CAN ONLY COACH IN MENS
 * TEAM OR A WOMENS TEAM AT ONE TIME."
 *
 * There are two ways to honour that and only one of them is safe.
 *
 * The tempting one is to put both worlds in the same save and filter. It is
 * tempting because the job market, the press and the Hall of Fame would then
 * span both for free. It is wrong because the engine reads the whole world in
 * ninety-four places - Object.values(state.clubs), state.players, state.comps,
 * across twenty-three files - and every single one of them would need a gender
 * filter that is correct today and stays correct for ever. The transfer market
 * alone would sign a woman to a men's club the first time one was missed, in a
 * save the player cannot repair. Ninety-four chances to break the one rule the
 * owner wrote in capitals is not a design, it is a bet.
 *
 * So: A SAVE HOLDS ONE WORLD AND A WORLD HAS ONE GENDER. Nothing filters,
 * because there is nothing to filter - the men's clubs are not absent from a
 * women's career, they were never built. The separation is a property of how
 * the save is made rather than a rule the code has to keep remembering, which
 * means it cannot rot. None of those ninety-four sites changes.
 *
 * The measured save cost says the same thing more quietly. A fresh men's world
 * is 5.26MB and 6,587 players; players are 93% of a save. Adding the women's
 * competitions to the SAME world would take a fresh save to roughly 6.6MB and a
 * ten-season one to about 10.5MB against perfprobe's 12MB ceiling - it would
 * fit, but with nothing left for the next league we add. Two worlds, one at a
 * time, cost nothing at all.
 *
 * WHAT ABOUT MOVING BETWEEN THEM? The owner: "YOU CAN TAKE A JOB FOR A
 * DIFFERENT GENDER BUT THE GAMES ARE SEPERATE." That is exactly what happens in
 * life. A coach who crosses over takes their name, their record and their
 * reputation, and takes nothing else: not their squad, not their staff, not
 * their fixtures. So a cross-gender move rebuilds the world at the other gender
 * and carries the manager across. See carryOver() below for precisely what
 * survives, which is the same list a real CV would carry.
 */

/** 'm' is the men's game, 'w' the women's. Stored on the save. */
export type Gender = 'm' | 'w'

export const GENDERS: Gender[] = ['m', 'w']

/**
 * The gender of a world, for saves that predate the women's game.
 *
 * Every career started before v1.5 is a men's career and has no field saying
 * so. Reading the field directly would make all of them undefined, which is
 * neither gender and would fall through every comparison below. One helper,
 * used everywhere, so the default lives in one place.
 */
export function genderOf(s: { gender?: Gender } | null | undefined): Gender {
  return s?.gender === 'w' ? 'w' : 'm'
}

/**
 * The prefix every women's club and competition id carries.
 *
 * The two worlds never meet, so ids could safely repeat: 'bristol' in a men's
 * save and 'bristol' in a women's one are in different files on different days
 * and could not collide if they tried. They are prefixed anyway, and the reason
 * is diagnosis rather than collision. If the separation is ever broken - by a
 * bad migration, a hand-edited save, a future feature that loads two worlds -
 * the damage shows up as the string 'w:bristol' somewhere it has no business
 * being, in a log or on a screen, instead of as a men's Bristol quietly playing
 * a women's fixture and nobody noticing for a version. It is a smoke alarm, not
 * a lock.
 */
export const W = 'w:'

/** True if an id belongs to the women's world. Ids are opaque to the player. */
export const isWomensId = (id: string): boolean => id.startsWith(W)

/** The gender a club or competition id implies, from the id alone. */
export const genderOfId = (id: string): Gender => (isWomensId(id) ? 'w' : 'm')

/**
 * Does this id belong in this world?
 *
 * The invariant the whole design rests on: every id in a save agrees with the
 * save's gender. scripts/genderprobe.ts asserts it across a built world and
 * after a season of play, which is what turns the comment at the top of this
 * file into something that stays true.
 */
export const idFitsWorld = (id: string, g: Gender): boolean => genderOfId(id) === g

/**
 * What a manager takes with them across the divide.
 *
 * A coach moving from the men's game to the women's - or back - keeps what a CV
 * keeps. Their name, obviously. Their record: games, wins, draws, losses, the
 * trophies they won and where they finished. Their reputation with boards, and
 * the origin story they started with, because none of that stops being true.
 *
 * They keep nothing that belongs to a club: no squad, no staff, no shortlist,
 * no scouting knowledge, no transfer budget, no half-finished stand. Those
 * belong to the club they left, and in the other game they never existed.
 *
 * Trophies keep their compId, which will be a men's id in a women's career.
 * That is correct and is the one place the two worlds legitimately touch: a
 * trophy cabinet is a history, and history does not re-sort itself when you
 * change job. Screens that print a trophy look its name up by id, and the
 * id survives, so a women's-game manager's cabinet still reads "won the
 * English Premier Division in 2029" - which is exactly what happened.
 */
export const CARRIED_ACROSS = [
  'managerName', 'mgr', 'mgrTrust', 'mgrOrigin', 'seed',
] as const

/**
 * The gender of a COACH or a member of staff, which is not the gender of the
 * game they work in.
 *
 * Men's professional rugby is coached almost entirely by men, and the game
 * models that by simply not asking. The women's game is not the mirror of that:
 * PWR head coaches are a real mix, and so are the physios, the scouts and the
 * academy staff. Making every women's club's coach a woman would be as wrong as
 * leaving them all men, and either would be noticed by anyone who follows the
 * league.
 *
 * So in the women's game it is a coin, drawn from the same seeded rng as
 * everything else about the club, and in the men's game it is not a question.
 */
export function staffGender(rng: () => number, world: Gender): Gender {
  return world === 'w' && rng() < 0.5 ? 'w' : 'm'
}
