# Where PHASE: Rugby Manager could go

Written 4 Sep 2026 at the owner's request: "imagine a roadmap for what this
game could become. I'd like to develop the game animation but please make
suggestions to what else we could do."

The game today is complete as a text-and-tables manager: every system a
player expects is present, and nothing in the code is half-built. What follows
is not a list of gaps. It is a list of directions, each with what it would
take, what it would be worth, and what it depends on. The animation comes
first because it was asked for first, and because it is the single change a
new player sees in the first five minutes.

---

## 1. The match, as something you watch

Today: a pitch view with moving dots, a ball, a highlight flash on a try, live
commentary underneath, three speeds, a scrubber. It is honest and it works. It
does not yet look like rugby.

### 1a. Shape before graphics (two to three weeks)

The biggest gain is not prettier players; it is players who stand where rugby
players stand. Right now the dots are positioned by a simple formula. The step
is a **phase model**: for every event the engine produces (scrum, lineout,
ruck, maul, kick, open play), a template of fifteen positions per side, with
the ball carrier's position driving the rest. A scrum looks like a scrum. A
lineout has a line. A defensive line is a line. The commentary already knows
what phase it is in, so the engine has the data; the pitch just has to read it.

* Depends on: nothing. All engine.
* Worth: the moment the game stops looking like a spreadsheet with dots.
* Risk: none to saves; the match result is unchanged, only the picture.

### 1b. Motion (three to four weeks, after 1a)

Interpolate between phases instead of jumping: the ball carrier runs a curve,
the defence drifts, the ruck forms and clears. Tackles get a contact frame.
Kicks get an arc with hang time. The scrubber already exists; this makes what
it scrubs through continuous.

* Depends on: 1a.
* Worth: the highlights mode becomes worth watching on its own.
* Risk: battery and heat on a phone. Budgeted at 30 frames a second on a
  five-year-old device, with the reduced-motion setting turning it back into
  phases.

### 1c. Figures, not dots (four to six weeks, after 1b)

Replace the dots with simple drawn figures: a body, two legs, an arm carrying
the ball, in the club's kit colours the game already draws for jerseys. Not
3D, not photoreal. Think a good broadcast graphic, or a well-drawn board game.
Names above heads on the highlighted man, shirt numbers on the rest.

* Depends on: 1b. Also the kit system, which already exists.
* Worth: screenshots that sell the game in a store listing. Today's store
  screenshots are tables.
* Risk: art direction. One consistent style, decided once, or it will look
  like five games.

### 1d. The broadcast layer (two weeks, any time after 1a)

Score bug, clock, a replay of the try from the commentary's point of view,
the match stats panel animating as they change, a half-time and full-time
card. Small, cheap, and it is what makes the picture feel like a broadcast
rather than a diagram.

---

## 2. The career, deeper

### 2a. A living world of managers (three weeks)

Every other club has a manager with a name, a record and a job to lose. They
get sacked, hired, poached. You read about it. You compete with them for
jobs. When you finish above the one who was favourite, the press says so. The
job market already exists; this gives it faces.

### 2b. Player personalities that talk back (three weeks)

The character types exist and drive contracts and morale. The step is
conversations with consequences: a senior player asks for a word about
selection, a youngster asks to go on loan, a captain tells you the room is
unhappy about a signing. Three or four choices each, and the outcome depends
on who he is, not on a dice roll. The Office on the player screen is the seam
for it.

### 2c. Rivalries and derbies that grow (two weeks)

Rivalries are tracked. They should be earned as well as inherited: a
playoff defeat, a poached player, a press-room jab, and a fixture that was
nothing becomes the one the town circles. The rivalry screen shows the
history of how it got there.

### 2d. The long game (two weeks)

Ten-season milestones: a stand named after you, a statue vote, a testimonial
for a one-club player you brought through, the academy class of a given year
looked back on. The Hall of Fame exists; this gives it stories.

---

## 3. Quality of life the second season asks for

Small, each a few days, and worth a release together:

* **Rotation planner**: mark players to rest next week, and the assistant's
  side respects it.
* **Contract expiry dashboard**: everyone in the last year, in one list, with
  the renewal talks a tap away.
* **Comparison against the league**: where your squad's age, wage bill and
  ability sit against the other clubs in your division.
* **Match history against an opponent**: last five meetings on the preview.
* **Undo the last week** is not possible (the world moves), but **a
  pre-match checkpoint** you can return to once per week is, and it is what
  players who lose a captain to injury in the first minute ask for.

---

## 4. The platform

### 4a. The Capacitor shell for Android (one day)

Removes the "Chrome running in the background" notice, unifies the two
phones on one code path, and is the precondition for adverts. See
`docs/ADS-STEP-BY-STEP.md`. Costs same-day updates.

### 4b. Adverts (two weeks after the shell, plus your accounts)

Banners and rewarded, behind consent, with Remove All Ads. Only worth
switching on with volume. The game is already wired for it.

### 4c. Cloud saves (two to three weeks)

Deferred by decision so far because the game has no account and no server,
and that is a selling point. The route that keeps it: the platform's own
backup (Google Play Games saved games, iCloud key-value storage), which needs
no account of ours and no server of ours. A player who changes phone finds
their career waiting. This is the most-requested feature in every offline
game's reviews, and it is the one thing the current export-and-import file
does not do for someone who has already lost the phone.

### 4d. Tablet and desktop layouts (two weeks)

The game is portrait phone by design. A landscape layout for tablets (the
iPad claim was withdrawn to avoid screenshots, not because it cannot work)
and a resizable desktop web layout would widen who can play it without
touching the game.

---

## 5. The world

### 5a. Women's rugby (four to six weeks)

The engine is not gendered anywhere. A women's competition (the English
Premiership Women's, the French Elite 1, the international game) is data:
clubs, players, a calendar, and pronouns in five languages. It would be the
first management game to offer the women's game as a full career rather than
a mode, and the press would notice.

### 5b. More leagues (one to two weeks each)

Italy, Spain, Portugal, Georgia, the American league, the Fijian Drua's
domestic layer. Each is a data file and a calendar; the engine already runs
eight competitions. The choice is who buys the game, and the store analytics
will say.

### 5c. Historical starts (three weeks)

Begin in a chosen past season with the squads of the day. The database is the
work; the engine does not care what year it is. A strong hook for the players
who remember 2003.

---

## 6. What I would do, in order

1. **1a Shape** and **1d Broadcast layer** together: six weeks, and the match
   looks like rugby. Store screenshots change.
2. **4a Shell**, one day, to kill the Chrome notice and be ready for adverts.
3. **3 Quality of life** as one release.
4. **1b Motion**, then decide on **1c Figures** with a style test first.
5. **4c Cloud saves** via platform backup, because it is the review complaint
   that never goes away.
6. **2a Living managers** and **2b Conversations**, because they are what
   makes season five different from season two.
7. **5a Women's rugby**, because nobody else has done it properly.

Everything above keeps the three promises the game has made from the start:
offline, nothing collected, nothing official reproduced.
