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
