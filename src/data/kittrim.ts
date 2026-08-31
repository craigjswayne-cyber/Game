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
  harlequins: '#7fd0f0',  // the light blue among the quarters
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
  harlequins: ['#6b4423', '#7fd0f0', '#c8102e', '#98a0a6'], // brown, light blue, red, grey
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
  bath: { n: 5, h: 2.1 },
}
