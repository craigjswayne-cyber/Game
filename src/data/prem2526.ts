/** The 2025/26 Gallagher Premiership senior squads, as supplied by the user's
 *  fact-checked squad guide (prepared 7 August 2026).
 *
 *  This file is the NAMES AND POSITIONS only. Ages, nationalities and ability
 *  ratings live in prem_a.ts / prem_b.ts, because the guide does not carry them:
 *  it is a squad reference, not a player database. What it is for is task #208 -
 *  a matchday XV should be fifteen real people, and before this there was about
 *  one generated name in every Premiership XV and three at the weaker clubs.
 *
 *  The guide contradicts itself in places, because its transfer audit lists
 *  end-of-season departures alongside mid-window ones and a few names appear in
 *  two clubs at once. Every conflict is resolved here, in one place, with the
 *  reason written down:
 *
 *    Dan Frost           Bath and Exeter. Audit: IN to Bath from Exeter. Bath.
 *    Stu Townsend        Exeter and Harlequins. Audit: IN to Quins. Harlequins.
 *    George McGuigan     Quins and Newcastle, each claiming to have signed him
 *                        from the other. Newcastle, whose IN line is the
 *                        specific one.
 *    Jamie Blamire       Leicester and Newcastle, same mutual claim. Leicester,
 *                        which is where the game already had him.
 *    Callum Chick        Newcastle and Northampton. Audit: IN to Saints.
 *    Sam Graham          Newcastle and Northampton. Saints, same window.
 *    Elliot Millar Mills Newcastle and Northampton. Saints.
 *    Freddie Clarke      Gloucester and Newcastle. Gloucester, his club of ten
 *                        years, and no audit line moves him.
 *    Cameron Jordan      Gloucester and Newcastle. Gloucester, as above.
 *    Pedro Rubiolo       Bristol IN from Newcastle, and Newcastle OUT. Bristol.
 *    Christian Wade      Gloucester OUT (retired) and Newcastle IN (came back
 *                        out of retirement). Newcastle.
 *    Joe Bailey          listed in Exeter's props AND locks. He is a prop.
 *    A Onyeama-Christie  listed in Saracens' locks AND back row. Back row.
 *    Theo McFarland      same. Back row.
 *    Elliot Daly         Saracens centre AND back three. Back three.
 *    Ben Earl            listed twice in Saracens' back row. Once.
 *    Robert du Preez     Sale list both "Rob du Preez" at fly-half and "Robert
 *                        du Preez" at centre. One man, one entry, fly-half.
 *    Danny Care          Harlequins scrum-half AND retired in the same audit.
 *                        Retired: he is not in the 2025/26 squad.
 *    Jonny Hill          Sale lock AND retired. Retired.
 *    Thomas du Toit      Bath prop AND out to the Sharks. The guide says
 *                        explicitly that this was an end-of-season departure
 *                        and he belongs in the season-start squad. Bath.
 *
 *  Where the squad list and the transfer audit disagree and nothing above
 *  applies, the squad list wins: it is the season-start snapshot the guide set
 *  out to produce, and the audit is its working. */

import type { Pos } from '../game/model'

/** A guide entry: the name, and the shirt the guide files him under. */
export interface GuidePlayer { name: string; pos: Pos }

/** The guide groups by unit. These are the shirts each group maps to.
 *
 *  "Props" is deliberately split by the reader rather than here: the guide does
 *  not say which side of the scrum a prop packs down, so props arrive as TP with
 *  LP as an alternative and prem_a/prem_b's researched entries keep their own
 *  side. "Back row" and "Back three" are the same kind of shorthand. */
const GROUP: Record<string, Pos> = {
  props: 'TP', hookers: 'HK', locks: 'LK', backrow: 'FL',
  sh: 'SH', fh: 'FH', centre: 'CE', backthree: 'WG',
}

function unit(group: keyof typeof GROUP, names: string): GuidePlayer[] {
  return names.split(';').map(n => n.trim()).filter(Boolean).map(name => ({ name, pos: GROUP[group] }))
}

export interface GuideClub { id: string; coach: string; captain: string; players: GuidePlayer[] }

export const PREM_2526: GuideClub[] = [
  {
    id: 'bath', coach: 'Johann van Graan', captain: 'Ben Spencer',
    players: [
      ...unit('hookers', 'Tom Dunn; Dan Frost; Jasper Spandler'),
      ...unit('props', 'Thomas du Toit; Archie Griffin; Beno Obano; Will Stuart; Mikey Summerfield; Francois van Wyk; Kieran Verden'),
      ...unit('locks', 'Charlie Ewels; Ross Molony; Quinn Roux'),
      ...unit('backrow', 'Alfie Barbeary; Josh Bayliss; Jaco Coetzee; Thompson Cowan; Ted Hill; Guy Pepper; Miles Reid; Ewan Richards; Ethan Staddon; Sam Underhill'),
      ...unit('sh', 'Tom Carr-Smith; Neil Le Roux; Ben Spencer; Bernard van der Linde'),
      ...unit('fh', 'Ciaran Donoghue; Sam Harris; Finn Russell'),
      ...unit('centre', 'Will Butt; Chris Harris; Louie Hennessey; Ollie Lawrence; Max Ojomoh; Cameron Redpath'),
      ...unit('backthree', 'Henry Arundell; Joe Cokanasiga; Will Muir; Santiago Carreras; Tom de Glanville; Austin Emens'),
    ],
  },
  {
    id: 'bristol', coach: 'Pat Lam', captain: 'Fitz Harding',
    players: [
      ...unit('props', 'Jake Woolmore; Ellis Genge; Sam Grahamslaw; Max Lahiff; George Kloska; Lovejoy Chawatama'),
      ...unit('hookers', 'Gabriel Oghre; Harry Thacker; Will Capon'),
      ...unit('locks', 'Joe Batley; James Dun; Joe Owen; Steele Barker; Pedro Rubiolo'),
      ...unit('backrow', 'Steven Luatua; Fitz Harding; Viliame Mata; Santiago Grondona; Luka Ivanishvili'),
      ...unit('sh', 'Harry Randall; Kieran Marmion; Sam Wolstenholme; Max Pepper'),
      ...unit('fh', 'AJ MacGinty; Tom Jordan'),
      ...unit('centre', 'James Williams; Benhard Janse van Rensburg; Joe Jenkins'),
      ...unit('backthree', 'Gabriel Ibitoye; Jack Bates; Kalaveti Ravouvou; Louis Rees-Zammit; Benjamin Elizalde; Rich Lane; Noah Heward'),
    ],
  },
  {
    id: 'exeter', coach: 'Rob Baxter', captain: 'Dafydd Jenkins',
    players: [
      ...unit('props', 'Joe Bailey; Kwenzo Blose; Will Goodrick-Clarke; Ehren Painter; Scott Sio; Khwezi Mona; Nika Abuladze'),
      ...unit('hookers', 'Jack Yeandle; Max Norey'),
      ...unit('locks', 'Dafydd Jenkins; Lewis Pearson; Oscar Beckerleg'),
      ...unit('backrow', 'Ethan Roots; Greg Fisilau; Ross Vintcent; Tom Hooper; Richard Capstick; Kane James; Jimmy Roots; Christ Tshiunza; Rusi Tuima'),
      ...unit('sh', 'Sam Maunder; Will Becconsall; Tom Cairns'),
      ...unit('fh', 'Harvey Skinner; Will Haydon-Wood; Iwan Jenkins'),
      ...unit('centre', 'Len Ikitau; Henry Slade; Will Rigg; Tamati Tua; Zack Wimbush'),
      ...unit('backthree', 'Immanuel Feyi-Waboso; Paul Brown-Bampoe; Ben Hammersley; Olly Woodburn; Josh Hodge; Dan John; Tommy Wyatt'),
    ],
  },
  {
    id: 'gloucester', coach: 'George Skivington', captain: 'Tomos Williams',
    players: [
      ...unit('props', 'Val Rapava-Ruskin; Jamal Ford-Robinson; Mayco Vivas; Afolabi Fasogbon; Dian Bleuler; Nepo Laulala'),
      ...unit('hookers', 'Seb Blake; Jack Singleton; Joseph Dweba'),
      ...unit('locks', 'Matias Alemanno; Arthur Clark; Freddie Clarke; Cameron Jordan; Danny Eite'),
      ...unit('backrow', 'Lewis Ludlow; Zach Mercer; Ruan Ackermann; Albert Tuisue; Jack Clement; Josh Basham'),
      ...unit('sh', 'Tomos Williams; Caolan Englefield; Charlie Chapman; Mike Austin'),
      ...unit('fh', 'Ross Byrne; Charlie Atkinson; Adam Hastings'),
      ...unit('centre', 'Seb Atkinson; Max Llewellyn; Will Butler; Will Joseph'),
      ...unit('backthree', 'Ben Loader; Josh Hathaway; Ollie Thorley; Rob Russell; Jake Morris; George Barton; Ben Redshaw'),
    ],
  },
  {
    id: 'harlequins', coach: 'Jason Gilmore', captain: 'Alex Dombrandt',
    players: [
      ...unit('props', 'Fin Baxter; Jordan Els; Boris Wenger; Simon Kerrod'),
      ...unit('hookers', 'Jack Musk; Sam Riley; Jack Walker'),
      ...unit('locks', 'Guido Petti; Kieran Treadwell; Dino Lamb; Joe Jones'),
      ...unit('backrow', 'Alex Dombrandt; Chandler Cunningham-South; Will Evans; Jack Kenningham; Archie White'),
      ...unit('sh', 'Stu Townsend; Will Porter; Max Green'),
      ...unit('fh', 'Marcus Smith; Jarrod Evans; Jamie Benson'),
      ...unit('centre', 'Oscar Beard; Bryn Bradley; Sean Kerr; Luke Northmore; Ben Waghorn'),
      ...unit('backthree', 'Rodrigo Isgro; Cadan Murley; Cassius Cleaves; Hayden Hyde; Tyrone Green; Cameron Anderson; Nick David'),
    ],
  },
  {
    id: 'leicester', coach: 'Geoff Parling', captain: 'Hanro Liebenberg',
    players: [
      ...unit('props', 'Nicky Smith; Joe Heyes; James Whitcombe; Will Hurd; Archie van der Flier; Tarek Haffar'),
      ...unit('hookers', "Julian Montoya; Charlie Clare; Jamie Blamire; Finn Theobald-Thomas"),
      ...unit('locks', 'Ollie Chessum; George Martin; Cameron Henderson; Harry Wells; Lewis Chessum; Tom Manz; James Thompson'),
      ...unit('backrow', 'Hanro Liebenberg; Tommy Reffell; Olly Cracknell; Emeka Ilione; Finn Carnduff; Joshua Manz; Joaquin Moro'),
      ...unit('sh', 'Jack van Poortvliet; Tom Whiteley; Ollie Allan'),
      ...unit('fh', "James O'Connor; Billy Searle; Charlie Titcombe; Orlando Bailey"),
      ...unit('centre', 'Solomone Kata; Izaia Perese; Joseph Woodward; Dan Kelly'),
      ...unit('backthree', 'Freddie Steward; Ollie Hassell-Collins; Adam Radwan; Gabriel Hamer-Webb'),
    ],
  },
  {
    id: 'newcastle', coach: 'Steve Diamond', captain: 'Sam Stuart',
    players: [
      ...unit('props', 'Adam Brocklebank; Murray McCallum; Pouri Rakete-Stones; James Kenny'),
      ...unit('hookers', 'George McGuigan; Ollie Fletcher; Samson Adejimi'),
      ...unit('locks', 'Jamie Hodgson; Seb de Chaves; Finn Baker'),
      ...unit('backrow', 'Tom Christie; Freddie Lockwood; Reuben Parsons; Greg Peterson'),
      ...unit('sh', 'Sam Stuart; James Elliott'),
      ...unit('fh', 'Brett Connon; Boeta Chamberlain; Ethan Grayson'),
      ...unit('centre', 'Sammy Arnold; Max Clark; Connor Doherty; Oli Spencer'),
      ...unit('backthree', 'Liam Williams; Christian Wade; Alex Hearle; Nathan Greenwood; Elliott Obatoyinbo; Joel Grayson; Sam Waugh'),
    ],
  },
  {
    id: 'northampton', coach: 'Phil Dowson', captain: 'Fraser Dingwall',
    players: [
      ...unit('props', 'Emmanuel Iyogun; Danilo Fischetti; Trevor Davison; Luke Green; Cleopas Kundiona; Elliot Millar Mills; Tom West'),
      ...unit('hookers', 'Curtis Langdon; Robbie Smith; Henry Walker; Craig Wright'),
      ...unit('locks', 'Alex Coles; Tom Lockett; JJ van der Mescht; Chunya Munga; Emeka Atuanya; Ed Prowse'),
      ...unit('backrow', 'Sam Graham; Josh Kemeny; Tom Pearson; Henry Pollock; Angus Scott-Young; Callum Chick; Archie Benson; Fyn Brown'),
      ...unit('sh', 'Alex Mitchell; Tom James; Archie McParland'),
      ...unit('fh', 'Fin Smith; Anthony Belleau'),
      ...unit('centre', 'Fraser Dingwall; Rory Hutchinson; Tom Litchfield; Toby Thame'),
      ...unit('backthree', 'Tommy Freeman; Ollie Sleightholme; George Hendy; George Furbank; James Ramm; Amena Caqusau; James Martin'),
    ],
  },
  {
    id: 'sale', coach: 'Alex Sanderson', captain: 'Ben Curry',
    players: [
      ...unit('props', 'Bevan Rodd; Si McIntyre; Asher Opoku-Fordjour; WillGriff John'),
      ...unit('hookers', 'Luke Cowan-Dickie; Ethan Caine; Tadgh McElroy'),
      ...unit('locks', 'Ernst van Rhyn; Ben Bamber; James Leavasa'),
      ...unit('backrow', 'Ben Curry; Tom Curry; Sam Dugdale; Dan du Preez; Jacques Vermeulen; Tom Ellis'),
      ...unit('sh', 'Gus Warr; Raffi Quirke; Nye Thomas'),
      ...unit('fh', 'George Ford; Rob du Preez; Tom Curtis'),
      ...unit('centre', "Sam Bedlow; Rekeiti Ma'asi-White; Joe Bedlow; Luke James; Marius Louw"),
      ...unit('backthree', "Tom Roebuck; Arron Reed; Tom O'Flaherty; Joe Carpenter; Alex Wills; Obi Ene"),
    ],
  },
  {
    id: 'saracens', coach: 'Mark McCall', captain: 'Maro Itoje',
    players: [
      ...unit('props', 'Phil Brantingham; Rhys Carre; Eroni Mawi; Marco Riccioni; Ollie Hoskins; Alec Clarey'),
      ...unit('hookers', 'Jamie George; Theo Dan; Kapeli Pifeleti; James Hadfield'),
      ...unit('locks', 'Maro Itoje; Nick Isiekwe; Hugh Tizard'),
      ...unit('backrow', 'Ben Earl; Tom Willis; Juan Martin Gonzalez; Andy Onyeama-Christie; Theo McFarland'),
      ...unit('sh', 'Ivan van Zyl; Charlie Bracken; Gareth Simpson'),
      ...unit('fh', 'Owen Farrell; Fergus Burke; Louie Johnson'),
      ...unit('centre', 'Nick Tompkins; Alex Lozowski; Olly Hartley; Sam Spink; Lucio Cinti'),
      ...unit('backthree', 'Max Malins; Rotimi Segun; Tobias Elliott; Brandon Jackson; Elliot Daly'),
    ],
  },
]
