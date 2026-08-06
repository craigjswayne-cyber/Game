// The Manager's Handbook: every system in the game, explained in plain
// language, with the real numbers where a number helps.
//
// This exists because the only explanation the game offered was a single
// welcome veil that closes on the first tap, in front of facilities, coaching
// badges, exams, analyst reads, commissioned scouting, match preparation,
// player roles, partnership chemistry, mentoring, traits, pledges, grudges and
// a decisions ledger. A player who cannot find out what a thing does will not
// use it, and a system nobody uses may as well not be there.
//
// Every figure below was read out of the code, not remembered. If a coefficient
// changes, the entry changes with it.

export type HandbookCat = 'match' | 'squad' | 'market' | 'club' | 'career'

export interface HandbookEntry {
  cat: HandbookCat
  q: string
  a: string
}

export const HANDBOOK_CATS: { id: HandbookCat; label: string; sub: string }[] = [
  { id: 'match', label: 'Match Day', sub: 'the eighty minutes and the hour before it' },
  { id: 'squad', label: 'Squad', sub: 'picking them, training them, keeping them fit' },
  { id: 'market', label: 'Market', sub: 'signing, selling, scouting and contracts' },
  { id: 'club', label: 'The Club', sub: 'the board, the money, the ground, the estate' },
  { id: 'career', label: 'Career', sub: 'your name, your record, the next job' },
]

export const HANDBOOK: HandbookEntry[] = [
  // ---------------- Match Day ----------------
  {
    cat: 'match',
    q: 'How do I move the game forward?',
    a: 'Everything runs off the button in the top corner. It reads Continue on a quiet week and Matchday when you have a fixture. Press it and the world moves: the week advances, other results come in, and anything that happened lands in your inbox on the Home screen.',
  },
  {
    cat: 'match',
    q: 'What happens in the hour before kick-off?',
    a: 'Three things, in order. You confirm the XV and the bench on the Tactics screen. You pick a dressing-room talk, and the words you choose move morale for real. Then you confirm you are ready, which is the last point at which you can change anything before the whistle.',
  },
  {
    cat: 'match',
    q: 'Can I change things once the match has started?',
    a: 'Yes, at any stoppage. The clipboard button opens tactics and substitutions mid-match, so you can shut a game down, chase one, or get a tiring front row off. You have eight replacements and the game will suggest natural cover first rather than putting a winger in the second row.',
  },
  {
    cat: 'match',
    q: 'Who decides what to do with a kickable penalty?',
    a: 'You do. When your side wins a penalty in range, the game stops and asks: posts, corner, or tap and go. Your kicker\'s goal kicking and the angle both matter, and so does the scoreboard. Taking three when you need seven is how games get lost.',
  },
  {
    cat: 'match',
    q: 'What is Match Preparation?',
    a: 'The week\'s training focus, set on the Tactics screen before the game. Attack, defence, set piece, fitness or recovery. It gives a small edge in that area for the coming match, and the Analysis and Briefing Suite makes the edge bigger. Recovery buys back condition instead, which is what you want on a short turnaround.',
  },
  {
    cat: 'match',
    q: 'What does the analyst tell me?',
    a: 'Before each match he names the unit he thinks the opposition is weakest in. If he is right you get a small edge there, and you can turn his read straight into that week\'s preparation with one tap. He is not always right. His accuracy climbs with the Briefing Suite and with a better assistant, and the Prep page keeps his record so you can decide how much to trust him.',
  },
  {
    cat: 'match',
    q: 'What is the assistant\'s game plan?',
    a: 'A pre-match briefing that reads the opponent and suggests a full tactical setup, applied with one tap. A better assistant gives better advice. It is a starting point, not an instruction.',
  },
  {
    cat: 'match',
    q: 'Do cards and the referee matter?',
    a: 'A great deal. Each referee has his own tolerance, and some will reach for a card where others talk. A yellow puts you a man down for ten minutes and the scoreboard usually shows it. A red is worse: the player leaves the field, and he picks up a ban of one or more matches afterwards. Aggressive players and the Hot Head trait get carded more.',
  },
  {
    cat: 'match',
    q: 'Can I appeal a red card?',
    a: 'Yes. A hearing follows a red, and a case can be won. Roughly two in three appeals succeed, which is worth the trouble when the player is one you need next week.',
  },
  {
    cat: 'match',
    q: 'Does the weather change anything?',
    a: 'Rain and wind both make handling and kicking harder and push games towards the forwards. Snow more so. A wet afternoon is a good week to have picked a big pack and a boot.',
  },
  {
    cat: 'match',
    q: 'What is Instant Result?',
    a: 'It plays the match out immediately and shows you the full-time score and report, without the tick-by-tick. Useful for a friendly or a week you do not want to sit through. You keep every consequence: injuries, cards, ratings and all.',
  },
  {
    cat: 'match',
    q: 'How do I watch a match without sitting through every minute?',
    a: 'The dressing room asks you before kick off. Every minute is the full commentary. Highlights runs the ticker straight to the next thing that matters, so you stop for scores, cards and injuries but not for every ruck, and half-time and the hour are still yours. Assistant hands him the touchline and takes you to the report. Your answer is remembered for that competition, so you can watch the league and skip the friendlies, and the cog during a match switches between the first two at any time.',
  },
  {
    cat: 'match',
    q: 'What is the difference between a 6-2 and a 5-3 bench?',
    a: 'Five and three is the orthodox 23 and it is exactly neutral: cover everywhere, a weapon nowhere. Six and two is a bomb squad, and once three of your replacements are on it sharpens the scrum, the breakdown and the defence at the cost of attacking shape. Four and four is the reverse bargain: width and insurance, at the cost of the shove. Neither pays if you leave the bench sitting there.',
  },
  {
    cat: 'match',
    q: 'What is the risk of a thin bench?',
    a: 'Cover. Name six forwards and you have two backs behind you, so a centre limping off after both have been used leaves a flanker finishing the game at 13. That costs you real attacking shape and leaks more in defence than it loses in attack, and no amount of shove up front makes it back. It is the price of the bomb squad, not a bug.',
  },
  {
    cat: 'match',
    q: 'What are finisher briefs?',
    a: 'What you say to a replacement as he pulls his shirt on, set per bench seat on the Tactics bench page. Follow the shirt is neutral. Go through them buys carry and gives up cover. Shut the door buys defence and discipline and gives up attack. Play the corners kicks the clock away. Only the first three briefed men to come on take effect, so a bench is a decision rather than a stack of free upgrades.',
  },

  // ---------------- Squad ----------------
  {
    cat: 'squad',
    q: 'What is the Game Time page for?',
    a: 'It is the ledger of what every man at the club has been told against what the team sheets actually say. Set his understanding - key player, rotation, squad player, prospect, or not in the plans - and the page shows the appearances he was entitled to expect, what he has had, and how he feels about the gap. A man short of what he was promised gets restless and eventually wants out; telling him the truth costs nothing but the truth.',
  },
  {
    cat: 'squad',
    q: 'Does the ledger punish me for leaving players out?',
    a: 'Only for leaving out men you told otherwise, and only men who are not in the current matchday twenty-three. Nobody in this week squad has a grievance this week. A frozen-out player settles at a grudge rather than sliding to total despair, so the consequence shows up as transfer requests, office visits and contract trouble rather than as a hidden penalty on the side you field.',
  },
  {
    cat: 'squad',
    q: 'What is the leadership group?',
    a: 'Four portfolios beyond the armband: who leads the pack, who calls the defensive line, who runs the attack, and who sets the standards. A portfolio does not make the side stronger. It concentrates the leadership you already have onto one area and takes it off the rest, so naming a defensive leader sharpens the defence at the cost of attacking shape. Only men in the starting XV with real authority carry one, and one man can hold one job.',
  },

  {
    cat: 'squad',
    q: 'What are all these numbers on a player?',
    a: 'Attributes run on the classic 1 to 20 scale and describe what he can do. Current Ability is a single 1 to 100 summary of how good he is now, Potential is how good he could become, and Potential is hidden until your scouting knowledge of him is good enough. Form is a rolling 1 to 10 on recent performances, morale is how he feels, condition is how fresh he is, and sharpness is how much rugby he has played lately.',
  },
  {
    cat: 'squad',
    q: 'How do I pick the side quickly?',
    a: 'Auto-Pick Best XV on the Selection tab fills every shirt with the best natural fit available. The In-Form XV tab does the same thing on current form rather than raw ability, and picking it is one tap. Then adjust by hand: tap a player, tap another, and they swap.',
  },
  {
    cat: 'squad',
    q: 'What are player roles?',
    a: 'On the Tactics tab each shirt can be given a role that shapes how he plays: a ball-playing ten, a fetcher at seven, a sweeping full back. A role suits some players more than others, and it works best on a man whose attributes already point that way.',
  },
  {
    cat: 'squad',
    q: 'Why does the game keep mentioning partnerships?',
    a: 'Five pairings build familiarity by playing together: the two props either side of the hooker, the lock pairing, the halfbacks, and the centres. A settled pairing goes from brand new to settling in, settled, established and eventually telepathic, and each step is worth something real. Rotating those five slots every week costs you more than it looks.',
  },
  {
    cat: 'squad',
    q: 'What is mentoring?',
    a: 'Pair a young player with an experienced one on the Training screen and the older man passes something on: faster development, and personality rubbing off. A professional veteran is the one you want doing it. A mercenary is not.',
  },
  {
    cat: 'squad',
    q: 'How does training work?',
    a: 'Two layers. The whole squad has a weekly emphasis, and individual players can be given a development focus on a specific attribute. Better coaches and a better Training Paddock make the focus bite more often. Progress is slow and unglamorous, which is how it should be.',
  },
  {
    cat: 'squad',
    q: 'What do the coaching badges mean?',
    a: 'Your backroom staff are named people, each holding an Unbadged, Bronze, Silver or Gold badge. The badge is what he is worth to you. You can send a coach on a course to try for the next one: it takes six weeks, costs sixty thousand pounds per tier, and about 58 in every 100 pass. He is still doing his job while he studies, and if he fails he can retake later.',
  },
  {
    cat: 'squad',
    q: 'How do I keep players fresh?',
    a: 'Watch condition and minutes. A player who passes 1,300 minutes in a season is in the red zone and starts breaking down. Rotate, use the recovery preparation on short turnarounds, and build the gym: each level of the Strength and Conditioning Gym buys back condition every single week.',
  },
  {
    cat: 'squad',
    q: 'What can I do about injuries?',
    a: 'A better physio and a better Recovery Centre both shorten layoffs. The Medical Centre screen lists everyone out, with return dates. You can pay for a specialist consult on a bad one, and wrap a fragile player in cotton wool for a week. Head injuries follow the HIA protocol and the length of the layoff is not yours to decide.',
  },
  {
    cat: 'squad',
    q: 'What are traits?',
    a: 'A signature edge, or flaw. The Step beats defenders and scores tries, Siege Gun kicks from anywhere, Jackal wins turnovers, Big-Game Player grows in knockouts and derbies, Hot Head is one flashpoint from a card every week. They show on the player\'s profile and they change what happens on the field.',
  },
  {
    cat: 'squad',
    q: 'Who should be captain?',
    a: 'Leadership is the attribute that matters, and the Selection tab lists your squad sorted by it. A strong captain lifts attack and defence and keeps tempers in check. Name a vice-captain too: he steps up at half the effect when the skipper is missing, and one day he will take the armband for good.',
  },
  {
    cat: 'squad',
    q: 'What is the academy for?',
    a: 'A youth intake arrives every season. Your academy coach and the Centre of Excellence both raise the quality of what comes through, and the better your setup the more likely a genuine prospect appears. You get an honest preview before intake day and a graded report afterwards. Promote the ones worth promoting.',
  },

  // ---------------- Market ----------------
  {
    cat: 'market',
    q: 'How do I sign a player?',
    a: 'Two stages. First the fee: the stepper starts at the asking price and you move up or down from there, and a low bid can be refused outright. Then personal terms: weekly wage, a signing-on fee, and perks. His camp will accept, counter or walk. A promise of first-team rugby softens the wage he will take, and it is a real promise that gets remembered.',
  },
  {
    cat: 'market',
    q: 'What is the wage budget, and what is a marquee player?',
    a: 'Your wage budget is a weekly ceiling on what the squad can cost. Two players can be named marquee, and their wages sit outside that ceiling, which is how you keep one star you could not otherwise afford. Everyone else counts.',
  },
  {
    cat: 'market',
    q: 'How do I use the scouts?',
    a: 'Three ways. Set a focus league and your scout builds knowledge there over time. Watch the Scouting Agency boards for players the world is talking about. Or commission a specific search from the Shortlist tab: a three, six or nine-month brief for a named position. The longer the brief and the better the scout, the better the name that comes back, and his written report grades what he found.',
  },
  {
    cat: 'market',
    q: 'Why can I not see a player\'s potential?',
    a: 'Because you do not know him yet. Scouting knowledge runs 0 to 100 and rises as your scouts watch him. Below a certain point his potential is a range, not a number. Your own players are fully known from day one.',
  },
  {
    cat: 'market',
    q: 'What is a pre-contract?',
    a: 'A player in the final season of his deal can be signed on a free to join you next summer. He sees the season out at his club, who find out from the press release. It is the cheapest way to improve a squad and everyone else is doing it too.',
  },
  {
    cat: 'market',
    q: 'When are the transfer windows?',
    a: 'Two, and the game tells you when one is closing. Deadline week is flagged on the Home screen, bids start lapsing, and panic bargains appear late on. The Deals tab on the Transfer Centre is one screen for everything you have in flight.',
  },
  {
    cat: 'market',
    q: 'What happens when an agent wants a new deal?',
    a: 'A player who is performing above his contract will have his camp come knocking. You can meet the demand, haggle a figure of your own, or refuse. Refusing a star has consequences, and so does paying every time.',
  },
  {
    cat: 'market',
    q: 'Can I loan players out?',
    a: 'Yes, and you should for young players who are not going to get minutes. A postcard arrives from the feeder club telling you how he is doing. Loans in belong to your current project: take a new job and they go home.',
  },

  // ---------------- The Club ----------------
  {
    cat: 'club',
    q: 'What is board confidence and what moves it?',
    a: 'A 0 to 100 reading of how safe your job is. Results move it most, then the objectives you were set, then how you handle the press and whether you keep your promises. It appears on the Home dashboard, and a half-term report card spells out where you stand. Let it fall far enough and you will be sacked.',
  },
  {
    cat: 'club',
    q: 'Where does the money come from and go?',
    a: 'In: a weekly commercial and broadcast share set by the club\'s reputation, gate receipts from home matches, club shop takings, prize money at the end of the season, and transfer fees. Out: player wages, backroom wages, upkeep on the ground and the estate, and whatever you spend. The Finances screen lists every line.',
  },
  {
    cat: 'club',
    q: 'What is ground and estate upkeep?',
    a: 'What it costs to open the doors, every week of the year, match or no match. The ground has to be heated, mown, stewarded and insured, and every facility level is a building with staff inside it. It is why upgrading is a commitment rather than a free ratchet: a better gym is a bill that keeps arriving. The figure is on the Finances screen.',
  },
  {
    cat: 'club',
    q: 'How do facility upgrades work?',
    a: 'There are eight facilities and each runs from level 0 to level 5. You cannot buy them: you ask the board, on the Club Infrastructure page, and the board weighs the price against the reserves and its confidence in you. Approved work takes five weeks. Only one project runs at a time, and a refusal puts you on a cooling-off period before you can ask again.',
  },
  {
    cat: 'club',
    q: 'What does each facility actually do?',
    a: 'Playing Surface: fewer breakdowns and fewer injuries in home matches. Gym: condition recovered every week. Recovery Centre: shorter layoffs. Training Paddock: attribute training bites more often. Kicking Enclosure: sharper goal kicking. Briefing Suite: match preparation and the analyst both land harder. Centre of Excellence: better academy intakes. Club Shop: retail income every week, more when the fans are happy. Each card on the Infrastructure page states its current effect in plain numbers.',
  },
  {
    cat: 'club',
    q: 'Why will the board not extend the stadium?',
    a: 'Usually one of three reasons, and it says which. Not enough of the season played to judge demand, a ground that is not full enough as it is, or reserves that will not carry the build. There is a fourth: every club has a catchment, and once the ground holds about everyone who would come, more seats would be empty seats. The Infrastructure page states your catchment so you can see where the ceiling is.',
  },
  {
    cat: 'club',
    q: 'The board took my money. Why?',
    a: 'It did not take it, it spent it. A board will not let a large surplus sit in a deposit account while the club stands still, so over the summer anything well beyond a season of wages plus a float goes back into the club: a build on the estate, the ground debt, the academy, the community programme. The news item says what it went on, and the terraces notice.',
  },
  {
    cat: 'club',
    q: 'Does the crowd matter?',
    a: 'Yes. Fan mood runs from mutinous to bouncing and shows on the Home dashboard. A happy crowd turns up in bigger numbers, lifts the side at home, and buys more in the shop. Results move it, and so do signings, sales and the things you say in press conferences.',
  },
  {
    cat: 'club',
    q: 'What are grudges and derbies?',
    a: 'Derbies are fixed by geography and history. Grudges you earn: a bad-tempered match, a poached player, a public dig. Both make the next meeting spicier, with more cards, a hostile crowd and a form book that means nothing. The club screen keeps the ledger.',
  },
  {
    cat: 'club',
    q: 'What happens in the press room?',
    a: 'Questions arrive before and after matches and you choose the tone of your answer. Confidence lifts your squad and needles the opposition, who will remember it. Caution keeps everyone calm. Promises made here are recorded, and broken ones cost you.',
  },
  {
    cat: 'club',
    q: 'What is a takeover?',
    a: 'New owners can arrive at your club. It usually means a war chest and a honeymoon period, and it always means new expectations. Sometimes it means neither and you have simply been sold to someone with less money.',
  },

  // ---------------- Career ----------------
  {
    cat: 'career',
    q: 'How do I get a better job?',
    a: 'Build a reputation, then apply from the Job Centre when a vacancy that suits you appears. Your chances depend on your reputation against the club\'s standing. If you are doing well somewhere, bigger clubs will come to you: a tap on the shoulder arrives in your inbox, and it does not stay open long.',
  },
  {
    cat: 'career',
    q: 'Does it matter if I say I am staying and then leave?',
    a: 'It does. A public loyalty vow is recorded, and if you walk out within a few weeks of making one, every paper runs the clip. Your new board notes how cheaply the last promise was sold, and the away end has a song ready for your return.',
  },
  {
    cat: 'career',
    q: 'What do I keep when I change club?',
    a: 'Your name, your record, your trophies and your badges. Not much else. The facilities belong to the club, so you inherit whatever the new one has. The backroom staff there are the backroom staff there. Grudges, the head-to-head book, the decisions ledger and the ground record all start blank, because they belong to the old place.',
  },
  {
    cat: 'career',
    q: 'What is the decisions ledger?',
    a: 'A running list on your Profile of the choices that mattered: appointments, board requests, briefs, analyst reads you followed, expansions. Each is marked as having worked out or not. It is there so a long career has a story you can read back rather than a number.',
  },
  {
    cat: 'career',
    q: 'Can I manage a country?',
    a: 'Yes, if one asks. Do well enough at club level and a union may offer you their side alongside the job you have. You pick the squad, you take the Six Nations or the Rugby Championship, and the union keeps score. A World Cup is the biggest thing in the game.',
  },
  {
    cat: 'career',
    q: 'Where is my career recorded?',
    a: 'Three places. Manager Profile has your badges, specialities and trophy cabinet. Manager Legacy has the milestones. The Annals hold every season you have managed, one row each, and the Roll of Honour holds the world\'s: champions, Players of the Year, and the Hall of Fame.',
  },
  {
    cat: 'career',
    q: 'How does saving work?',
    a: 'The game saves itself every week, so you cannot lose a season to a closed tab. The Save and Load screen has slots for manual backups and for running parallel careers. It all lives on this device.',
  },
  {
    cat: 'career',
    q: 'What is floodlit mode?',
    a: 'The dark theme, toggled by the button next to Continue. It is meant for reading a phone at night and everything in the game is built to work in it.',
  },
]
