# Sensitivity audit, 1.5.1

Every string the game shows, in every language it ships, read for anything
that gets its effect from who a person is: ethnicity, nationality, religion,
sexuality, disability, body, gender. The brief for 1.5.1 was "a full deep dive
into sensitivities - make sure all cultures are covered". This is what was
looked at, what was found, what changed, and what now stops it coming back.

## Scope

- The six dictionaries under `src/locales/` (English, French, Spanish, Italian,
  Japanese, Afrikaans), including every women's-game and woman-subject sibling
  (`_f`, `_w`, `_fw`): about 6,000 strings each, 37,000 in all.
- The commentary banks and flavour lines in `src/game/matchEngine.ts`, which
  are keys into those dictionaries.
- The generated names, nations and club identities (`src/data/`), for the risk
  of a real person being described doing something they did not do.

## Method

1. A scan of every string against two lists per language: HARD terms with no
   possible rugby use (slurs of every kind, hard drugs, self-harm, real
   political figures, colonial-era idioms) and WATCH terms that are usually
   innocent in a stadium but worth a read (alcohol, betting, body words,
   "blind side", "hot head", "humour noir"). The scan is now a build gate,
   `scripts/sensitivityprobe.ts`, and it runs in the suite.
2. Every WATCH hit read in context, in its language.
3. The flavour banks read as sets, because a bank can carry a stereotype that
   no single line does.
4. The misconduct and rumour stories read with a real name in mind: what would
   this say about a person if the name generator produced theirs?

## Findings

**No hard hits in any language.** Every scan hit was a rugby idiom or a false
positive: "weapon" is a kicking game, "bomb" is a high kick, "kill the clock",
"bad blood", "a bidding war"; French "fou" is the wildest offload of the year;
Spanish "loca" is Cabeza loca (the Hot Head trait), "negro" is humour noir and
"números negros" (in the black), "gorda" is "hacer la vista gorda" (turn a
blind eye); Japanese ハーフ is half-time and the half-backs, ハゲタカ is the
vultures circling a manager's job, グランドスラム contains the katakana for
slum. The gate's ALLOW list carries those.

**Two idioms rewritten**, because their origins are not ones the game wants
to trade on even where the phrase is common:

| Key | Was | Now |
|---|---|---|
| `objectives.scalp`, `scalpHead` | "Take a scalp" (and Italian "Prenditi uno scalpo") | "Giant-killing" / "Fai l'impresa". French, Spanish and Japanese already said "bring down a big one". |
| `comm.flavDerby1` | "Handbags after the whistle!" | "A scuffle after the whistle!" The other languages already said scuffle (échauffourée, tangana, scaramucce, 小競り合い). |

**The Pacific flavour bank** (`comm.flavPac1-6`, drawn in Pacific Nations Cup
matches in the Isles mode) was read as a set for the "island flair" stereotype.
Verdict: kept. Every line describes a passage of play (an offload that sticks,
a carry through the first tackle, footwork, running from the goal line, a hit
you can hear, a one-handed take) and none describes a person, a body, a culture
or an origin. The bank is chosen by the competition, never by a player's name
or nation, so the same lines fall on every side in that competition.

**"Girls" in the women's game.** The feminiser turns "the lads" into "the
girls" and "old boys" into "old girls" in fan speech and in the alumni sense.
Verdict: kept. Both are how women's rugby clubs talk about themselves; a
manager's own board never calls the squad girls, and no line uses the word to
belittle.

**Personality and trait labels** ("Mercenary", "Temperamental", "Hot Head",
"Enforcer" with "the dark arts") describe a player's rugby and contract
character, are assigned by the generator without regard to nation, and are the
conventional vocabulary of the genre. Kept.

**Alcohol and betting are referred to, never played.** A beer festival rained
on, a brewery naming a beer after the back row, a pub side in a cup, a beer
tent guy-rope; bookmakers shortening a manager's odds and suspending betting on
the next appointment. There is no drinking on screen and no wager the player
can make. For the store questionnaires: no simulated gambling, no depiction of
alcohol use, mild references in text.

**Religion, politics, real people: none.** No string names a faith, a party, a
politician, or a real person. Clubs and competitions are the renamed
identities in `docs/ip-rename-map.md`; the name generator draws from per-nation
pools and never produces a current or recent professional's full name (checked
by `scripts/ipprobe.mjs`).

**Misconduct with a name attached** (rumours, the "cheat meal confession", a
tattooed fan, the manager's sacking, an appeal lost) was read for what it would
imply about a person. Every such story is about the game's own invented people
and reads as gossip about form, food, contracts and results, never about
private life, health, family or belief.

**Disability language.** "Blind side" is the rugby position and stays. No
string uses a disability as an insult or a metaphor for incompetence.

## Afrikaans

The sixth language brought its own list, because South African English and
Afrikaans carry apartheid-era terms that a translator raised elsewhere might
not recognise as slurs. The Afrikaans hard list in the gate carries the racial
and sexual slurs of that history, the demographic labels of the old
classification, and the loaded jocular terms for English and Afrikaans
speakers. The translation brief (`scripts/tools/`, and the guide the
translation was made under) said: no real clubs, players or brands, no
apartheid-era terms, nothing that leans on ethnicity, and a South African
substitute for any British cultural joke that would not land in Bloemfontein.

## The gate

`scripts/sensitivityprobe.ts` runs in the suite. It fails the build on any
hard term in any dictionary, refuses a dictionary it has no lists for (so a
seventh language cannot ship unread), and prints the watch counts so the next
audit starts from numbers rather than from scratch.
