/**
 * ---- THE THIRD COLOUR ----
 *
 * Owner, with four photographs of this season's shirts: "adding a few prem team
 * kits for this season to replicate but not use anything official".
 *
 * Every club here carries exactly two colours, and the thing that makes a real
 * hooped shirt recognisable at a glance is usually the third: the gold line
 * either side of Northampton's hoops, the sky-blue pinstripe between Bristol's,
 * the white that separates Leicester's green from its red. Two colours gave a
 * generic hooped jersey; the trim is what makes it that club's hooped jersey.
 *
 * NOTHING OFFICIAL IS USED OR REPRODUCED. There is no badge, no sponsor, no
 * manufacturer mark and no licensed artwork anywhere in this file or in the SVG
 * that reads it - a crest is a generated shield with a three-letter code on it
 * (components.Crest). What is here is a club's colours and how it wears them,
 * which is the same thing a newspaper league table has always printed.
 *
 * Only clubs whose identity genuinely needs a third colour appear. Everyone
 * else gets undefined and draws exactly as before.
 */
export const KIT_TRIM: Record<string, string> = {
  // Premier Division
  bath: '#000000',        // navy and white hoops, edged black
  bristol: '#29a8e0',     // sky pinstripes between the navy and white
  harlequins: '#ffffff',  // white collar and cuffs, over the four quarters
  leicester: '#ffffff',   // white between the green and the red
  northampton: '#f2c200', // the gold line at every hoop
  // Elite 14
  la_rochelle: '#ffffff',  // the white line between the yellow and the black
  toulon: '#c8102e',
  // UPC
  cardiff: '#009fdf',
  // Championship
  richmond: '#f2c200',    // old gold, red and black
}

/**
 * ---- FOUR QUARTERS, FOUR COLOURS ----
 *
 * Owner, v1.1.15: "Quins kit seems to be wrong. Blue lines should be on the
 * sleeves. 4 quarters should be brown, light blue, red, grey."
 *
 * He is right and the shape of the mistake is interesting: a quartered shirt
 * was drawn out of the same two colours every other pattern uses, so it came
 * out as a two-colour chequerboard. A club whose whole identity is that it
 * wears four different colours at once cannot be described by a pair.
 *
 * So a quartered club may name its own four, clockwise from the top left:
 * top-left, top-right, bottom-left, bottom-right. Nobody else has to - a
 * quartered club with no entry here draws from its two colours exactly as
 * before.
 *
 * The usual line applies: these are colours, not artwork. No badge, no
 * sponsor, no manufacturer's mark.
 */
export const KIT_QUARTERS: Record<string, [string, string, string, string]> = {
  // clockwise from the top left, off the photograph: light blue, maroon,
  // brown, grey. The owner listed the four colours; the picture gave the order.
  harlequins: ['#7fd0f0', '#a4193d', '#6b4423', '#98a0a6'],
}

/**
 * ---- HOW HEAVY THE HOOPS ARE ----
 *
 * Owner, v1.1.17: "Bath should be blue black and white and smaller stripes."
 *
 * The colours were already blue, white and black - what was wrong is the
 * WEIGHT. Every hooped club drew three fat bands, which suits Leicester and
 * Northampton, whose hoops really are broad, and does not suit Bath, whose
 * shirt is a navy ground with fine hoops closely spaced.
 *
 * So the weight is per club rather than one rule for all of them: how many
 * hoops, and how thick. A club with no entry keeps the three broad bands it
 * has always drawn, which is why this file lists one club rather than eleven.
 */
export const KIT_HOOPS: Record<string, { n: number; h: number }> = {
  // Four green bands with black between them of about the same width. Five at
  // h=3 filled the shirt and it read as a GREEN jersey with gold lines, which
  // is the opposite of the photograph: Northampton is black, banded green.
  northampton: { n: 4, h: 2.4 },
}

/**
 * ---- SHIRTS THAT ARE ALL HOOP ----
 *
 * Owner, v1.1.17, with four photographs: "leicester, quins, northampton, bath
 * should be like these."
 *
 * Bath's is not a ground with hoops on it. It is white, blue and black bands
 * running the whole shirt, touching, in rotation - there is no background
 * colour left showing anywhere. Every pattern in this game until now has been
 * "a shirt, with something drawn on it", which cannot describe that at all: the
 * first attempt at Bath gave it five thin white hoops on navy and it read as a
 * different club.
 *
 * So a club may name a CYCLE instead: contiguous bands, top to bottom, taking
 * these colours in turn. Nobody else has one, and a club without one draws
 * exactly as it did.
 */
export const KIT_CYCLE: Record<string, string[]> = {
  // white, blue, black, repeating - the 2025-26 shirt, read off the photograph
  bath: ['#ffffff', '#003c71', '#000000'],
}

/**
 * ---- SLEEVES THAT DISAGREE WITH EACH OTHER ----
 *
 * Quins wear one maroon sleeve and one green one, which no rule about "the
 * second colour" can produce. Named per club, left then right; everybody else
 * keeps two matching sleeves.
 */
export const KIT_SLEEVES: Record<string, [string, string]> = {
  harlequins: ['#a4193d', '#1f7a3f'],
  // an all-hoop shirt has no second colour to fall back on, and Bath's sleeves
  // are plain blue under a white cuff
  bath: ['#003c71', '#003c71'],
}
