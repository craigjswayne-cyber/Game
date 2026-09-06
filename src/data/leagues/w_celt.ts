/**
 * ---- THE CELTIC CHALLENGE ----
 *
 * All six clubs and all 185 players, real, from the competition's own team pages.
 *
 * WHY IT MATTERS MORE THAN ITS SIZE. Before this league existed, a women's
 * world held English, French and southern-hemisphere clubs and nothing else, so
 * when the Northern Championship came round, Ireland, Scotland and Wales fielded
 * squads of GENERATED players. Six of the seven Ireland internationals that were
 * missing are in these two Irish squads - Cahill, Campbell, both McGraths,
 * Djougang and Tuite - which is the difference between half the Championship
 * being real and being invented.
 *
 * The pages give a forwards and backs split and no more, so the individual
 * shirt is assigned within that split rather than guessed per player. The
 * Scottish and Irish pages also name each player's home club or province -
 * Stirling County, Watsonians, Munster, Ulster - which is recorded in the
 * source and not modelled, because a player here has one club and the game has
 * nowhere to put a second.
 *
 * ONE PLAYER, ONE CLUB. These squads genuinely overlap with PWR and with each
 * other, because a Celtic Challenge side is a development platform whose
 * players also hold senior contracts. Anyone already contracted in another
 * league of this world keeps that club and is dropped here:
 *    Maisie Davies (already at a pwr club)
 *    Alaw Pyrs (already at a pwr club)
 *    Sian Jones (already at a pwr club)
 *    Jenny Hesketh (already at a pwr club)
 *    Aimee Bush (already at a pwr club)
 *    Amelia Tutt (already at a pwr club)
 *    Samaanther Taganekurukuru (already at glasgow)
 *
 * Club and ground names follow docs/ip-rename-map.md. Edinburgh and Glasgow are
 * the same franchises as in the men's database and keep the same renames, so
 * they read identically in both games. The other four are named for the region
 * they represent, because Brython, Gwalia, Clovers and Wolfhounds are not
 * places - and Brython's ground is Llanelli's, which the men's map already
 * renames to Stradley Park.
 */
import type { RawClub } from '../types'
import { W } from '../../game/gender'

export const W_CELT: RawClub[] = [
  {
    id: W + 'wolfhounds', name: 'Belfast RFC', short: 'Belfast',
    city: 'Belfast', country: 'IRE',
    stadium: 'Ravenhill', capacity: 4000,
    colors: ['#0a2240', '#c8102e'],
    rep: 74, budget: 155000,
    // 30 players, all real
    players: [
      { name: 'Alma Atagamen', pos: 'LP', age: 23, nat: 'IRE', q: 66 },
      { name: 'Kathy Baker', pos: 'HK', age: 21, nat: 'IRE', q: 75 },
      { name: 'Sophie Barrett', pos: 'TP', age: 19, nat: 'IRE', q: 72 },
      { name: 'Claire Boles', pos: 'LK', age: 33, nat: 'IRE', q: 78 },
      { name: 'Regan Casey', pos: 'FL', age: 24, nat: 'IRE', q: 66 },
      { name: 'Maebh Clenaghan', pos: 'N8', age: 23, nat: 'IRE', q: 66 },
      { name: 'India Daley', pos: 'LK', age: 33, nat: 'IRE', q: 74 },
      { name: 'Linda Djougang', pos: 'FL', age: 26, nat: 'IRE', q: 77, intl: true },
      { name: 'Poppy Garvey', pos: 'LP', age: 24, nat: 'IRE', q: 59 },
      { name: 'Christy Haney', pos: 'HK', age: 22, nat: 'IRE', q: 70 },
      { name: 'Kate Jordan', pos: 'TP', age: 33, nat: 'IRE', q: 59 },
      { name: 'Cara McLean', pos: 'FL', age: 21, nat: 'IRE', q: 74 },
      { name: 'Caoimhe Molloy', pos: 'LK', age: 19, nat: 'IRE', q: 77 },
      { name: 'Maeve Óg O’Leary', pos: 'N8', age: 21, nat: 'IRE', q: 76 },
      { name: 'Naoise Smyth', pos: 'LP', age: 29, nat: 'IRE', q: 59 },
      { name: 'Fiona Tuite', pos: 'HK', age: 33, nat: 'IRE', q: 70, intl: true },
      { name: 'Megan Burns', pos: 'SH', age: 22, nat: 'IRE', q: 65 },
      { name: 'Katie Corrigan', pos: 'FH', age: 33, nat: 'IRE', q: 61, gk: true },
      { name: 'Aoife Dalton', pos: 'CE', age: 29, nat: 'IRE', q: 68 },
      { name: 'Vicky Elmes Kinlan', pos: 'WG', age: 32, nat: 'IRE', q: 68 },
      { name: 'Stacey Flood', pos: 'FB', age: 30, nat: 'IRE', q: 78, gk: true },
      { name: 'Jade Gaffney', pos: 'CE', age: 33, nat: 'IRE', q: 73 },
      { name: 'Eve Higgins', pos: 'WG', age: 24, nat: 'IRE', q: 67 },
      { name: 'Amy Larn', pos: 'SH', age: 29, nat: 'IRE', q: 71 },
      { name: 'Niamh Marley', pos: 'FH', age: 26, nat: 'IRE', q: 77 },
      { name: 'Kate Farrell McCabe', pos: 'CE', age: 24, nat: 'IRE', q: 59 },
      { name: 'Dannah O’Brien', pos: 'WG', age: 23, nat: 'IRE', q: 69 },
      { name: 'Robyn O’Connor', pos: 'FB', age: 29, nat: 'IRE', q: 76 },
      { name: 'Aoibheann Reilly', pos: 'CE', age: 30, nat: 'IRE', q: 73 },
      { name: 'Katie Whelan', pos: 'WG', age: 23, nat: 'IRE', q: 74 },
    ],
  },
  {
    id: W + 'clovers', name: 'Dublin RFC', short: 'Dublin',
    city: 'Dublin', country: 'IRE',
    stadium: 'Donnybrook Park', capacity: 3500,
    colors: ['#0a5c36', '#ffffff'],
    rep: 72, budget: 150000,
    // 31 players, all real
    players: [
      { name: 'Jemima Adams Verling', pos: 'LP', age: 26, nat: 'IRE', q: 68 },
      { name: 'Ella Burns', pos: 'HK', age: 33, nat: 'IRE', q: 71 },
      { name: 'Beth Buttimer', pos: 'TP', age: 21, nat: 'IRE', q: 62 },
      { name: 'Eilís Cahill', pos: 'LK', age: 26, nat: 'IRE', q: 70, intl: true },
      { name: 'Ruth Campbell', pos: 'FL', age: 30, nat: 'IRE', q: 71, intl: true },
      { name: 'Jane Clohessy', pos: 'N8', age: 18, nat: 'IRE', q: 67 },
      { name: 'Saoirse Crowe', pos: 'LK', age: 31, nat: 'IRE', q: 75 },
      { name: 'Sally Kelly', pos: 'FL', age: 25, nat: 'IRE', q: 67 },
      { name: 'Ivana Kiripati', pos: 'LP', age: 22, nat: 'IRE', q: 56 },
      { name: 'Siobhán McCarthy', pos: 'HK', age: 23, nat: 'IRE', q: 65 },
      { name: 'Aoibheann McGrath', pos: 'TP', age: 26, nat: 'IRE', q: 70, intl: true },
      { name: 'Sadhbh McGrath', pos: 'FL', age: 32, nat: 'IRE', q: 70, intl: true },
      { name: 'Lily Morris', pos: 'LK', age: 27, nat: 'IRE', q: 64 },
      { name: 'Aoibhe O’Flynn', pos: 'N8', age: 31, nat: 'IRE', q: 73 },
      { name: 'Faith Oviawe', pos: 'LP', age: 28, nat: 'IRE', q: 73 },
      { name: 'Ailish Quinn', pos: 'HK', age: 21, nat: 'IRE', q: 56 },
      { name: 'Rosie Searle', pos: 'TP', age: 28, nat: 'IRE', q: 63 },
      { name: 'Enya Breen', pos: 'SH', age: 32, nat: 'IRE', q: 59 },
      { name: 'Aoife Corey', pos: 'FH', age: 32, nat: 'IRE', q: 69, gk: true },
      { name: 'Amee-Leigh Costigan', pos: 'CE', age: 21, nat: 'IRE', q: 70 },
      { name: 'Méabh Deely', pos: 'WG', age: 29, nat: 'IRE', q: 57 },
      { name: 'Caitríona Finn', pos: 'FB', age: 29, nat: 'IRE', q: 67 },
      { name: 'Kate Flannery', pos: 'CE', age: 25, nat: 'IRE', q: 70 },
      { name: 'Síofra Hession', pos: 'WG', age: 27, nat: 'IRE', q: 62 },
      { name: 'Emily Lane', pos: 'SH', age: 19, nat: 'IRE', q: 72 },
      { name: 'Lucia Linn', pos: 'FH', age: 21, nat: 'IRE', q: 62 },
      { name: 'Anna McGann', pos: 'CE', age: 23, nat: 'IRE', q: 65 },
      { name: 'Alana McInerney', pos: 'WG', age: 25, nat: 'IRE', q: 66 },
      { name: 'Niamh Murphy', pos: 'FB', age: 28, nat: 'IRE', q: 60, gk: true },
      { name: 'Béibhinn Parsons', pos: 'CE', age: 21, nat: 'IRE', q: 56 },
      { name: 'Eve Prendergast', pos: 'WG', age: 29, nat: 'IRE', q: 61 },
    ],
  },
  {
    id: W + 'edinburgh', name: 'Edinburgh RFC', short: 'Edinburgh',
    city: 'Edinburgh', country: 'SCO',
    stadium: 'Roseburn Park', capacity: 3500,
    colors: ['#0e0e0e', '#c9a227'],
    rep: 69, budget: 143000,
    // 29 players, all real
    players: [
      { name: 'Adelle Ferrie', pos: 'LP', age: 27, nat: 'SCO', q: 55 },
      { name: 'Aila Ronald', pos: 'HK', age: 23, nat: 'SCO', q: 54 },
      { name: 'Alex Stewart', pos: 'TP', age: 26, nat: 'SCO', q: 63 },
      { name: 'Alison Wilson', pos: 'LK', age: 23, nat: 'SCO', q: 65 },
      { name: 'Caroline Bullock', pos: 'FL', age: 26, nat: 'SCO', q: 56 },
      { name: 'Charlotte Russell', pos: 'N8', age: 21, nat: 'SCO', q: 68 },
      { name: 'Chloe Brown', pos: 'LK', age: 27, nat: 'SCO', q: 69 },
      { name: 'Faye Sutherland', pos: 'FL', age: 33, nat: 'SCO', q: 54 },
      { name: 'Georgia Young', pos: 'LP', age: 23, nat: 'SCO', q: 53 },
      { name: 'Hannah McMahon', pos: 'HK', age: 31, nat: 'SCO', q: 67 },
      { name: 'Karis Craig', pos: 'TP', age: 31, nat: 'SCO', q: 69 },
      { name: 'Megan Riach', pos: 'FL', age: 33, nat: 'SCO', q: 57 },
      { name: 'Merryn Gunderson', pos: 'LK', age: 22, nat: 'SCO', q: 61 },
      { name: 'Millie Capaldi', pos: 'N8', age: 30, nat: 'SCO', q: 71 },
      { name: 'Molly Poolman', pos: 'LP', age: 21, nat: 'SCO', q: 62 },
      { name: 'Natasha Logan', pos: 'HK', age: 30, nat: 'SCO', q: 54 },
      { name: 'Talei Tawake', pos: 'FL', age: 28, nat: 'SCO', q: 71 },
      { name: 'Ami Conchie', pos: 'SH', age: 19, nat: 'SCO', q: 57 },
      { name: 'April McKenzie', pos: 'FH', age: 26, nat: 'SCO', q: 59, gk: true },
      { name: 'Dawn Lawrie', pos: 'CE', age: 25, nat: 'SCO', q: 70 },
      { name: 'Emily Love', pos: 'WG', age: 30, nat: 'SCO', q: 66 },
      { name: 'Giselle Chicot', pos: 'FB', age: 31, nat: 'SCO', q: 61, gk: true },
      { name: 'Hannah Ramsay', pos: 'CE', age: 21, nat: 'SCO', q: 65 },
      { name: 'Hannah Walker', pos: 'WG', age: 29, nat: 'SCO', q: 71 },
      { name: 'Holly McIntyre', pos: 'SH', age: 24, nat: 'SCO', q: 65 },
      { name: 'Lisa Brown', pos: 'FH', age: 25, nat: 'SCO', q: 61 },
      { name: 'Lucy MacRae', pos: 'CE', age: 31, nat: 'SCO', q: 71 },
      { name: 'Pip Benson', pos: 'WG', age: 30, nat: 'SCO', q: 54 },
      { name: 'Rhea Clarke', pos: 'FB', age: 30, nat: 'SCO', q: 74 },
    ],
  },
  {
    id: W + 'gwalia', name: 'South Wales RFC', short: 'S Wales',
    city: 'Ystrad Mynach', country: 'WAL',
    stadium: 'Sporting Centre', capacity: 3000,
    colors: ['#c8102e', '#0e0e0e'],
    rep: 68, budget: 140000,
    // 29 players, all real
    players: [
      { name: 'Chloe Thomas Bradley', pos: 'HK', age: 32, nat: 'WAL', q: 76 },
      { name: 'Molly Reardon', pos: 'TP', age: 18, nat: 'WAL', q: 52 },
      { name: 'Molly Wakely', pos: 'LK', age: 29, nat: 'WAL', q: 67 },
      { name: 'Mollie Crabb', pos: 'FL', age: 19, nat: 'WAL', q: 54 },
      { name: 'Jenni Scoble', pos: 'N8', age: 21, nat: 'WAL', q: 67 },
      { name: 'Danyelle Dinapoli', pos: 'LK', age: 27, nat: 'WAL', q: 58 },
      { name: 'Evie Hill', pos: 'FL', age: 20, nat: 'WAL', q: 54 },
      { name: 'Tilly Vucaj', pos: 'HK', age: 22, nat: 'WAL', q: 56 },
      { name: 'Erin Jones', pos: 'TP', age: 27, nat: 'WAL', q: 65 },
      { name: 'Erin Williams', pos: 'FL', age: 32, nat: 'WAL', q: 58 },
      { name: 'Bryonie King', pos: 'LK', age: 22, nat: 'WAL', q: 70 },
      { name: 'Catrin Stewart', pos: 'N8', age: 18, nat: 'WAL', q: 65 },
      { name: 'Lily Terry', pos: 'LP', age: 32, nat: 'WAL', q: 59 },
      { name: 'Lottie Buffery Latham', pos: 'HK', age: 27, nat: 'WAL', q: 62 },
      { name: 'Anwen Owen', pos: 'TP', age: 29, nat: 'WAL', q: 59 },
      { name: 'Chiara Pearce', pos: 'FL', age: 27, nat: 'WAL', q: 55 },
      { name: 'Imogen Shide', pos: 'LK', age: 22, nat: 'WAL', q: 71 },
      { name: 'Katie Bevans', pos: 'FH', age: 27, nat: 'WAL', q: 65 },
      { name: 'Carys Hughes', pos: 'CE', age: 25, nat: 'WAL', q: 65 },
      { name: 'Molly Anderson Thomas', pos: 'WG', age: 21, nat: 'WAL', q: 68 },
      { name: 'Kelsie Webster', pos: 'FB', age: 31, nat: 'WAL', q: 75, gk: true },
      { name: 'Nia Fajeyisan', pos: 'CE', age: 18, nat: 'WAL', q: 70 },
      { name: 'Isla McMullen', pos: 'WG', age: 27, nat: 'WAL', q: 62 },
      { name: 'Jodi Palmer', pos: 'SH', age: 18, nat: 'WAL', q: 60 },
      { name: 'Catherine Richards', pos: 'FH', age: 27, nat: 'WAL', q: 71 },
      { name: 'Caitlin Lewis', pos: 'CE', age: 33, nat: 'WAL', q: 67 },
      { name: 'Nia Grundy', pos: 'WG', age: 26, nat: 'WAL', q: 58 },
      { name: 'Courtney Greenway', pos: 'FB', age: 26, nat: 'WAL', q: 68 },
      { name: 'Nikita Prothero', pos: 'WG', age: 22, nat: 'WAL', q: 70 },
    ],
  },
  {
    id: W + 'brython', name: 'North Wales RFC', short: 'N Wales',
    city: 'Llanelli', country: 'WAL',
    stadium: 'Stradley Park', capacity: 3000,
    colors: ['#0e5a3a', '#f5b301'],
    rep: 66, budget: 136000,
    // 33 players, all real
    players: [
      { name: 'Stella Orrin', pos: 'LP', age: 18, nat: 'WAL', q: 63 },
      { name: 'Elan Jones', pos: 'HK', age: 20, nat: 'WAL', q: 52 },
      { name: 'Shanelle Williams', pos: 'TP', age: 27, nat: 'WAL', q: 64 },
      { name: 'Amy Morgan', pos: 'LK', age: 30, nat: 'WAL', q: 63 },
      { name: 'Rhoswen James', pos: 'FL', age: 21, nat: 'WAL', q: 67 },
      { name: 'Megan Lewis', pos: 'N8', age: 30, nat: 'WAL', q: 57 },
      { name: 'Ellie Harper', pos: 'LK', age: 29, nat: 'WAL', q: 51 },
      { name: 'Ciara Taylor', pos: 'FL', age: 31, nat: 'WAL', q: 64 },
      { name: 'Gwen Crabb', pos: 'LP', age: 30, nat: 'WAL', q: 68 },
      { name: 'Robyn Davies', pos: 'HK', age: 18, nat: 'WAL', q: 63 },
      { name: 'Mia Haf Bowen', pos: 'TP', age: 32, nat: 'WAL', q: 63 },
      { name: 'Catrin Jones', pos: 'FL', age: 22, nat: 'WAL', q: 66 },
      { name: 'Danai Mugabe', pos: 'LK', age: 26, nat: 'WAL', q: 69 },
      { name: 'Robyn Kovachev', pos: 'N8', age: 28, nat: 'WAL', q: 60 },
      { name: 'Finley Jones', pos: 'LP', age: 23, nat: 'WAL', q: 59 },
      { name: 'Jess Rogers', pos: 'HK', age: 33, nat: 'WAL', q: 68 },
      { name: 'Jorja Aiona', pos: 'TP', age: 33, nat: 'WAL', q: 54 },
      { name: 'Branwen Metcalfe', pos: 'FL', age: 19, nat: 'WAL', q: 69 },
      { name: 'Lucy Isaac', pos: 'LK', age: 32, nat: 'WAL', q: 59 },
      { name: 'Seren Lockwood', pos: 'SH', age: 25, nat: 'WAL', q: 68 },
      { name: 'Ffion Lewis', pos: 'FH', age: 22, nat: 'WAL', q: 64, gk: true },
      { name: 'Hanna Marshall', pos: 'CE', age: 18, nat: 'WAL', q: 57 },
      { name: 'Ffion Williams', pos: 'WG', age: 29, nat: 'WAL', q: 59 },
      { name: 'Rhiannon Griffin', pos: 'FB', age: 18, nat: 'WAL', q: 66 },
      { name: 'Savannah Picton Powell', pos: 'WG', age: 21, nat: 'WAL', q: 67 },
      { name: 'Megan Webb', pos: 'SH', age: 29, nat: 'WAL', q: 51 },
      { name: 'Ellie Tromans', pos: 'FH', age: 30, nat: 'WAL', q: 52, gk: true },
      { name: 'Gabby Healen', pos: 'CE', age: 23, nat: 'WAL', q: 60 },
      { name: 'Hannah Bluck', pos: 'WG', age: 24, nat: 'WAL', q: 53 },
      { name: 'Seren Singleton', pos: 'CE', age: 31, nat: 'WAL', q: 54 },
      { name: 'Ffion Davies', pos: 'WG', age: 25, nat: 'WAL', q: 53 },
      { name: 'Amy Williams', pos: 'SH', age: 22, nat: 'WAL', q: 65 },
      { name: 'Mollie Wilkinson', pos: 'FH', age: 27, nat: 'WAL', q: 65 },
    ],
  },
  {
    id: W + 'glasgow', name: 'Glasgow RFC', short: 'Glasgow',
    city: 'Glasgow', country: 'SCO',
    stadium: 'Scotstoun Stadium', capacity: 4000,
    colors: ['#12295c', '#c8102e'],
    rep: 64, budget: 132000,
    // 33 players, all real
    players: [
      { name: 'Neve Finlay', pos: 'LP', age: 33, nat: 'SCO', q: 59 },
      { name: 'Poppy Fletcher', pos: 'HK', age: 30, nat: 'SCO', q: 66 },
      { name: 'Isla Gillan', pos: 'TP', age: 18, nat: 'SCO', q: 66 },
      { name: 'Katie Lindsay', pos: 'LK', age: 22, nat: 'SCO', q: 64 },
      { name: 'Imogen Spence', pos: 'FL', age: 22, nat: 'SCO', q: 59 },
      { name: 'Megan Hyland', pos: 'N8', age: 31, nat: 'SCO', q: 62 },
      { name: 'Nikki Simpson', pos: 'LK', age: 19, nat: 'SCO', q: 55 },
      { name: 'Aicha Sutcliffe', pos: 'FL', age: 23, nat: 'SCO', q: 48 },
      { name: 'Ciorstaidh Ainsworth', pos: 'LP', age: 23, nat: 'SCO', q: 67 },
      { name: 'Holland Bogan', pos: 'HK', age: 32, nat: 'SCO', q: 66 },
      { name: 'Daisy Morrison', pos: 'TP', age: 29, nat: 'SCO', q: 63 },
      { name: 'Sophie Murphy', pos: 'FL', age: 31, nat: 'SCO', q: 67 },
      { name: 'Ellie Williamson', pos: 'LK', age: 19, nat: 'SCO', q: 57 },
      { name: 'Gemma Bell', pos: 'N8', age: 25, nat: 'SCO', q: 52 },
      { name: 'Emily Coubrough', pos: 'LP', age: 19, nat: 'SCO', q: 61 },
      { name: 'Eilidh MacGilvray', pos: 'HK', age: 28, nat: 'SCO', q: 66 },
      { name: 'Shelley Main', pos: 'TP', age: 30, nat: 'SCO', q: 50 },
      { name: 'Samaanther Taganekurukuru', pos: 'FL', age: 26, nat: 'SCO', q: 49 },
      { name: 'Gemma Thomson', pos: 'LK', age: 24, nat: 'SCO', q: 48 },
      { name: 'Freya Walker', pos: 'FL', age: 28, nat: 'SCO', q: 60 },
      { name: 'Ceitidh Ainsworth', pos: 'SH', age: 25, nat: 'SCO', q: 66 },
      { name: 'Rebeka Douglas', pos: 'FH', age: 27, nat: 'SCO', q: 57, gk: true },
      { name: 'Hannah Dunnett', pos: 'CE', age: 26, nat: 'SCO', q: 53 },
      { name: 'Robyn Allan', pos: 'WG', age: 28, nat: 'SCO', q: 50 },
      { name: 'Nicole Flynn', pos: 'FB', age: 32, nat: 'SCO', q: 59 },
      { name: 'Claudia McLaren', pos: 'CE', age: 30, nat: 'SCO', q: 61 },
      { name: 'Briar McNamara', pos: 'WG', age: 23, nat: 'SCO', q: 69 },
      { name: 'Millie Warren', pos: 'SH', age: 22, nat: 'SCO', q: 49 },
      { name: 'Abi Evans', pos: 'FH', age: 31, nat: 'SCO', q: 50 },
      { name: 'Robynn Gibson', pos: 'CE', age: 24, nat: 'SCO', q: 58 },
      { name: 'Poppy Mellanby', pos: 'WG', age: 31, nat: 'SCO', q: 57 },
      { name: 'Emily Norval', pos: 'FB', age: 23, nat: 'SCO', q: 57, gk: true },
      { name: 'Sky Phimister', pos: 'CE', age: 32, nat: 'SCO', q: 65 },
    ],
  },
]
