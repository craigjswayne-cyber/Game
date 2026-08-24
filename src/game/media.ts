import type { GameState, OfficeTopic, Player, PressItem } from './model'
import { SEASON_WEEKS, fmtMoney, formGuide, logDecision, poss } from './model'
import { loanOut } from './loans'
import { offersFor, signOffer, type SlotId } from './commercial'
import { derbyName, isDerby } from './rivalries'
import { nationByCode } from './nations'
import { applyResponse } from './authority'
import { clamp, pick, type Rng } from './rng'
import { tIn } from './i18n'

const OUTLETS = [
  'The Rugby Chronicle', 'Oval Times', 'The Breakdown Podcast', 'Rugby World Weekly',
  'The Sunday Scrum', 'Lineout Live', 'The Egg Chasers Gazette', 'Front Row Daily',
]

/** Not an outlet at all: player conversations behind a closed door. */
export const OFFICE_OUTLET = "The Manager's Office"

/**
 * How long the office remembers a conversation.
 *
 * A live report: a prospect asked to go out on loan, the manager agreed, and
 * the same lad knocked again with the same speech seven days later. The office
 * was generating from squad state alone, so any player who still matched the
 * filter could be picked again the very next week - and agreeing to something
 * never changed the filter, because agreeing did nothing.
 *
 * Fourteen weeks is a third of a season: long enough that the repeat reads as
 * a man whose patience has run out rather than a bug, and short enough that
 * he does get to come back if you left him in the stand all year.
 */
export const OFFICE_COOLDOWN = 14

const absWeek = (season: number, week: number) => season * SEASON_WEEKS + week

/** Has this player raised this subject recently enough that raising it again
 *  would read as the game forgetting the last conversation? */
export function askedRecently(state: GameState, pid: number, topic: OfficeTopic): boolean {
  const now = absWeek(state.season, state.week)
  return (state.officeMemo ?? []).some(m =>
    m.pid === pid && m.topic === topic && now - absWeek(m.season, m.week) < OFFICE_COOLDOWN)
}

/** Record that he came in about it. Written when the conversation is raised,
 *  not when it is answered: ignoring a player is also an answer, and it does
 *  not entitle him to ask again next week. */
function rememberAsk(state: GameState, pid: number, topic: OfficeTopic) {
  ;(state.officeMemo ??= []).push({ pid, topic, season: state.season, week: state.week })
  // two seasons of memos is far more than the cooldown needs, and keeps the
  // save from carrying a list that only ever grows
  const cutoff = absWeek(state.season - 2, state.week)
  state.officeMemo = state.officeMemo.filter(m => absWeek(m.season, m.week) >= cutoff).slice(-200)
}

function mk(state: GameState, question: string, playerId: number | undefined, options: PressItem['options'], rng: Rng): PressItem {
  return {
    id: state.nextId++,
    week: state.week,
    season: state.season,
    outlet: pick(rng, OUTLETS),
    question,
    playerId,
    options,
    answered: false,
  }
}

/** Weekly press generation for the user's club. */
export function generatePress(state: GameState, rng: Rng) {
  const club = state.clubs[state.userClubId]
  const squad = club.players.map(id => state.players[id]).filter(Boolean)
  const open = state.press.filter(p => !p.answered).length
  // deterministic voicing: the same question wears different words from week
  // to week without ever drawing on the shared rng (zero stream footprint)
  const voice = (salt: number, opts: string[]) =>
    opts[(state.season * 5 + state.week * 3 + salt) % opts.length]

  // the pre-season decision fires every season regardless of the spam gate:
  // an internal staff call, and week 1 must never lose it to a leftover
  // question from the final round of last season
  if (state.week === 1 && !state.press.some(p => p.season === state.season && p.options.some(o => o.camp))) {
    const item = mk(state,
      voice(20, [
        `Pre-season, and the performance staff want a decision. The budget stretches to one special week: a warm-weather camp abroad, a community week at home, or the sponsor's exhibition tour. Which is it?`,
        `Three options are circled on the staff-room whiteboard for the spare pre-season week: the heat camp, the town, or the sponsor's roadshow. The department heads are waiting on you.`,
      ]),
      undefined, [
        { label: 'Warm-weather camp (£400k)', morale: 0, board: 0, camp: 'heat', reaction: `Flights booked. A week of double sessions in the sun - the squad comes home lean, sharp, and united in their hatred of the hill runs.` },
        { label: 'Community week at home', morale: 0, board: 0, camp: 'home', reaction: `Schools, junior clubs, open training. Costs nothing, and the town will remember it all season.` },
        { label: `Sponsor's exhibition tour (+£600k)`, morale: 0, board: 0, camp: 'tour', reaction: `Three airports, two black-tie functions, one glossy cheque. The accountants beam. The players' legs file a formal complaint.` },
      ], rng)
    item.outlet = OFFICE_OUTLET
    state.press.push(item)
    return
  }

  // THE EXPECTATIONS DECISION (25C, user: "at the start of the season the
  // manager should set the expectations for the club" - the FM Mobile beat).
  // Week 2, after the camp call and before the league starts: the pundits'
  // predicted finish is on the table and the manager decides how to pitch the
  // year. The answer sets state.stance, which boardReaction reads all season -
  // aim high and every result swings the boardroom harder, keep heads down
  // and the needle is muted both ways. An internal staff call like the camp,
  // so it fires past the spam gate and survives the press-expiry sweep.
  if (state.week === 2 && !state.press.some(p => p.season === state.season && p.options.some(o => o.stance))) {
    const pred = state.preds?.[state.userClubId]
    const predWord = pred ? `The pundits have you ${pred}${pred === 1 ? 'st' : pred === 2 ? 'nd' : pred === 3 ? 'rd' : 'th'}.` : 'The pundits are split on you.'
    // Stature: 1 = title favourite, 0 = wooden-spoon pick. The squad's read on
    // each answer scales with it (user: "if a manager picks a top team and
    // selects fight bravely against relegation then... the squad should be
    // more doubtful of their manager"). No prediction reads as mid-table.
    const leagueN = state.comps[club.leagueId]?.teamIds.length ?? 10
    const stature = pred != null && leagueN > 1 ? clamp((leagueN - pred) / (leagueN - 1), 0, 1) : 0.5
    // The war chest (user: "they get a bit more money but they best win or the
    // board will be nervous about their budget"). Released the moment the
    // manager aims high; the rollover claws it back with interest if the side
    // finishes no better than the pundits said - see rebuildSeason.
    const fund = Math.min(400_000, Math.max(100_000, Math.round((club.budget * 0.12) / 50_000) * 50_000))
    const round1 = (x: number) => Math.round(x * 10) / 10
    const item = mk(state,
      voice(21, [
        `Season launch day, and the room wants a number. ${predWord} Where are you telling this club it is going?`,
        `The chairman, the sponsors and the season-ticket renewal letter all want the same sentence from you. ${predWord} How do you pitch the year?`,
      ]),
      undefined, [
        {
          label: `'Judge us in May - aim high' (+${fmtMoney(fund)} war chest)`,
          morale: round1(0.2 + 0.4 * (1 - stature)), board: 0.3, stance: 'high', fund,
          reaction: `The headline writes itself and the board puts ${fmtMoney(fund)} behind it - beat the pundits' number or that money comes back out of next summer's budget, with interest. ${stature < 0.45
            ? 'Nobody rated this squad, and the dressing room walks a foot taller for hearing a manager who does.'
            : 'The dressing room nods along - a club this size expects the talk.'} From here every win is proof and every defeat is a broken promise: the boardroom needle will swing hard, both ways, all season.`,
        },
        {
          label: `'The board's targets are fair'`, morale: 0.1, board: 0.2, stance: 'board',
          reaction: `Steady. You and the board are reading from the same page, and results will be judged the way they always were.`,
        },
        {
          label: `'Quiet season - heads down'`, morale: round1(-0.7 * stature), board: 0, stance: 'safe',
          reaction: `You talk the year down to take the heat off the group. The boardroom needle is muted both ways: defeats cost less, but so does winning - credit is thin for a man who promised nothing.${stature > 0.55
            ? ` And at a club the pundits fancy, the squad hears something else in it: a manager who does not believe in them.`
            : ''}`,
        },
      ], rng)
    item.outlet = OFFICE_OUTLET
    state.press.push(item)
    return
  }

  // THE MORNING AFTER SILVERWARE, THE ROOM ASKS ABOUT THE SILVERWARE (user:
  // "day after winning both prem final and champs cup - no press questions
  // about success. feels a bit odd"). A won final is the biggest day the
  // club has, and the press generator had no beat for it - the Monday after
  // a double the room was asking about a winger's form. Fires past the spam
  // gate like the other can't-miss moments; the stamp (absolute week of the
  // newest final toasted) keeps it to one toast per trophy, and a weekend
  // that lands two finals gets asked about as a double.
  {
    const absNow = state.season * SEASON_WEEKS + state.week
    const toasted = state.silverwareAsk ?? -1
    const won = state.fixtures.filter(f => {
      if (f.stage !== 'F' || !f.played) return false
      if (f.homeId !== state.userClubId && f.awayId !== state.userClubId) return false
      const abs = state.season * SEASON_WEEKS + f.week
      if (abs <= toasted || absNow - abs > 2) return false
      return f.homeId === state.userClubId ? f.homeScore > f.awayScore : f.awayScore > f.homeScore
    })
    if (won.length) {
      state.silverwareAsk = Math.max(...won.map(f => state.season * SEASON_WEEKS + f.week))
      const names = won.map(f => state.comps[f.compId]?.name ?? 'the cup')
      const what = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0]
      const double = names.length > 1
      state.press.push(mk(state,
        voice(23, [
          double
            ? `The table in front of you has ${names.length} trophies on it. ${what}, in one weekend. The room is on its feet before the first question: how does a season like this happen?`
            : `The ${what} is on the table in front of you, still wearing its ribbons. The room wants the story: what wins a final?`,
          double
            ? `Nobody in this room has covered a weekend like it: ${what}, back to back. When does it sink in?`
            : `The champagne is barely dry on the ${what}. Where does this one rank in your career?`,
        ]),
        undefined, [
          { label: `'This group earned every inch'`, morale: 0.5, board: 0.4, reaction: `The quote runs under every photo of the celebrations. The squad walks into pre-season believing, and the chairman has the front page framed.` },
          { label: `'The supporters deserve this'`, morale: 0.3, board: 0.3, reaction: `The town takes it personally, in the best way. Season-ticket renewals do not need a letter this year.` },
          { label: `'We go again - this is a beginning'`, morale: 0.2, board: 0.5, reaction: `Half the room writes "dynasty". The board hears ambition and likes the sound of it; the squad hears the bar going up.` },
        ], rng))
      return
    }
  }

  if (open >= 2) return // don't spam

  // the morning after a bigger club's interest breaks, the first question
  // writes itself - and it goes straight to the top of the pile
  if (state.courtedAt === state.season * 100 + state.week - 1 && state.courtedBy) {
    const suitor = state.clubs[state.courtedBy]
    if (suitor) {
      state.press.push(mk(state,
        voice(1, [
          `Every outlet leads with the same story: ${suitor.name} have you on their shortlist. The room goes quiet. Are you staying?`,
          `The first hand up does not bother with the rugby. "${suitor.name} want you, and everyone in this room knows it. Are you staying?"`,
          `${poss(suitor.name)} interest in you is on every back page this morning. The room leans forward as one. What is your answer?`,
        ]),
        undefined, [
          { label: `'I am going nowhere'`, morale: 0.5, board: 0.8, vow: true, reaction: `The clip runs on every channel by teatime. The chairman texts a thumbs up; the squad trains like a weight came off. ${suitor.short} move down their list.` },
          { label: `'We have work to do here'`, morale: 0.2, board: 0.3, reaction: `Measured, professional, just short of a promise. The story cools without quite dying.` },
          { label: `'I never discuss speculation'`, morale: -0.3, board: -0.6, reaction: `A stonewall the whole room hears as a maybe. The chairman's silence is loud, and the dressing room wonders if the gaffer is half out the door.` },
        ], rng))
      return
    }
  }

  // the hearing: one of yours saw red this week and the ban is confirmed.
  // Time-sensitive, so it jumps the candidate queue like the courtship does
  {
    const f = state.fixtures.find(f =>
      f.played && f.week === state.week && (f.homeId === club.id || f.awayId === club.id))
    const rcs = f?.events?.filter(e => e.type === 'RC' && e.teamId === club.id && e.playerId != null) ?? []
    const banned = rcs.length ? state.players[rcs[rcs.length - 1].playerId!] : null
    if (banned && (banned.bans ?? 0) >= 1 && !state.press.some(p => p.options.some(o => o.appeal) && p.season === state.season && state.week - p.week <= 2)) {
      const n = banned.bans
      state.press.push(mk(state,
        voice(19, [
          `The citing commissioner has upheld ${banned.name}'s red card: a ${n}-match ban. The club has 48 hours to appeal. Do you?`,
          `${banned.name}'s suspension is confirmed this morning - ${n} match${n === 1 ? '' : 'es'}. Half your inbox is lawyers who fancy the footage. Appeal it?`,
          `The panel was not moved: ${n} match${n === 1 ? '' : 'es'} for ${banned.name}. The supporters call it a stitch-up. Fight it, or take it?`,
        ]),
        banned.id, [
          { label: 'Lodge the appeal', morale: 0.6, board: 0, appeal: true, reaction: `The paperwork goes in overnight and the hearing is fast-tracked. The verdict lands in your inbox the same day.` },
          { label: 'Accept the ban with dignity', morale: -0.2, board: 0.4, reaction: `No circus, no lawyers. The panel notes the club's professionalism, and the player serves his time quietly.` },
          { label: 'Blast the officiating', morale: 0.8, board: -0.5, reaction: `The dressing room loves it. The league office adds a note to your file, and the next fifty-fifty call may remember this.` },
        ], rng))
      return
    }
  }

  // finals week: the biggest press room of the season is not a lottery
  // entry - if the final is this week, this question is asked
  {
    const fin = state.fixtures.find(f => !f.played && f.week === state.week && f.stage === 'F' &&
      f.compId !== 'fr' && (f.homeId === club.id || f.awayId === club.id))
    if (fin && state.clubs[fin.homeId] && state.clubs[fin.awayId]) {
      const oppId = fin.homeId === club.id ? fin.awayId : fin.homeId
      const opp = state.clubs[oppId]
      const compName = state.comps[fin.compId]?.name ?? 'the cup'
      const where = fin.venue ? fin.venue.name : state.clubs[fin.homeId].stadium
      state.press.push(mk(state,
        voice(26, [
          `Finals week. The room is three deep, half of them faces you have never seen. ${compName}, ${where}, ${opp.short} on the other side. The first question is the only one they all came for: can you win it?`,
          `The camera count has tripled and there is a national broadcaster's anchor in the front row. One game, at ${where}, against ${opp.short}, for the ${compName}. How do you handle a week like this?`,
          `Every seat taken, standing at the back - finals week does this. ${opp.short} at ${where} for the ${compName}. They want a headline. What do you give them?`,
        ]),
        undefined, [
          { label: `'We are ready. We will win it'`, morale: 0.8, board: -0.3, reaction: `The back pages have their headline and the dressing room walks taller all week. If Saturday goes wrong, that sentence will be read back to you for years.` },
          { label: 'Respect them, back ourselves', morale: 0.3, board: 0.4, reaction: `Measured and confident. The board approves, the players nod along, and nobody has been handed a team-talk quote.` },
          { label: `'The occasion is the trap - it is just rugby'`, morale: -0.2, board: 0.2, reaction: `You talk the week down to protect the group. Sensible - though one or two of the younger lads wanted to hear the fire.` },
        ], rng))
      return
    }
  }

  const candidates: PressItem[] = []

  // hot streak player
  const hot = squad.filter(p => p.form >= 8 && p.stats.apps >= 3)
  if (hot.length && rng() < 0.6) {
    const p = pick(rng, hot)
    candidates.push(mk(state,
      voice(2 + p.id, [
        `${p.name} has been in scintillating form - some are calling him the best ${posNoun(p)} in the competition. Do you agree?`,
        `The whole league is purring about ${p.name}. Best ${posNoun(p)} in the competition right now: yes or no?`,
        `${p.name} again at the weekend. The pundits have run out of superlatives - have you?`,
      ]),
      p.id, [
        { label: 'Heap on the praise', morale: 1.2, board: 0, reaction: `${p.name} is reportedly delighted with your public backing.` },
        { label: 'Keep his feet on the ground', morale: -0.3, board: 0.5, reaction: `A measured response. ${p.name} knows there is more to do.` },
        // a fourth way to play it (user: "a bit more variety in press replies")
        { label: 'Credit the men around him', morale: 0.6, board: 0.2, reaction: `You spread the praise across the whole side. ${p.name} nods along, and the pack notes the mention of the men who win him his ball.` },
        { label: 'No comment', morale: 0, board: -0.2, reaction: 'The press pack grumbles and moves on.' },
      ], rng))
  }

  // struggling player
  const cold = squad.filter(p => p.form <= 4.5 && p.stats.apps >= 3)
  if (cold.length && rng() < 0.5) {
    const p = pick(rng, cold)
    candidates.push(mk(state,
      voice(3 + p.id, [
        `${p.name} has looked well short of his best in recent weeks. Is his place under threat?`,
        `Be honest about ${p.name} - the supporters on the message boards already are. What is going wrong for him?`,
        `${p.name} would struggle to make most sides in this league on current form. Does he keep the shirt?`,
      ]),
      p.id, [
        { label: 'Back him publicly', morale: 1.4, board: -0.3, reaction: `${p.name} appreciates the show of faith and vows to repay it.` },
        { label: 'Admit he must improve', morale: -1.2, board: 0.6, reaction: `Honest, but ${p.name} is stung by the criticism.` },
        { label: 'Take the blame yourself', morale: 0.9, board: -0.5, reaction: `"If he is short of form, look at how I am using him." The room did not expect that. ${p.name} did not either - and he trains like a man with a debt to repay.` },
        { label: 'Refuse to single anyone out', morale: 0.2, board: 0, reaction: 'You deflect the question with a straight bat.' },
      ], rng))
  }

  // transfer rumour about star player
  const stars = squad.filter(p => p.ca >= 84)
  if (stars.length && rng() < 0.3) {
    const p = pick(rng, stars)
    const bigClubs = Object.values(state.clubs).filter(c => c.id !== club.id && c.rep >= club.rep)
    const suitor = bigClubs.length ? pick(rng, bigClubs) : null
    if (suitor) {
      candidates.push(mk(state,
        voice(4 + p.id, [
          `We're hearing strong links between ${p.name} and ${suitor.name}. What's your message to worried supporters?`,
          `${suitor.name} scouts were in the stand again, and everyone knows who they came to watch. Is ${p.name} for sale?`,
          `${p.name} to ${suitor.name} is the story that will not die. Kill it now, if you can.`,
        ]),
        p.id, [
          { label: `He's untouchable`, morale: 0.8, board: 0.3, reaction: `A firm line. ${p.name} feels wanted; ${suitor.short} are said to be undeterred.` },
          { label: 'Everyone has a price', morale: -1.5, board: 0, unsettle: true, reaction: `${p.name}'s agent has taken note. Expect the phone to ring.` },
          { label: `'Ask him - he is happy here'`, morale: 0.4, board: 0.1, reaction: `You hand the question to the player, publicly and warmly. ${p.name} obliges with a straight answer about loving the club, which buries the story better than any denial of yours could.` },
          { label: 'Rumours are rumours', morale: 0, board: 0, reaction: 'You wave the question away.' },
        ], rng))
    }
  }

  // derby build-up: poke the fire or play it down
  const nextFx = state.fixtures.find(f =>
    !f.played && f.week === state.week &&
    (f.homeId === club.id || f.awayId === club.id) && isDerby(f.homeId, f.awayId))
  if (nextFx && rng() < 0.65) {
    const oppId = nextFx.homeId === club.id ? nextFx.awayId : nextFx.homeId
    const opp = state.clubs[oppId]
    candidates.push(mk(state,
      voice(5, [
        `${derbyName(nextFx.homeId, nextFx.awayId)} this weekend. ${opp?.short ?? 'They'} say the pressure is all on you. Your response?`,
        `It is ${derbyName(nextFx.homeId, nextFx.awayId)} week and the town talks of nothing else. ${opp?.short ?? 'They'} reckon the pressure sits with you. Does it?`,
        `${opp?.short ?? 'Their'} players have been talking in the papers all week ahead of ${derbyName(nextFx.homeId, nextFx.awayId)}. Rise to it, or rise above it?`,
      ]),
      undefined, [
        { label: 'Fan the flames', morale: 0, board: 0.4, reaction: 'The back pages love it. The town is at boiling point - your players will feel ten feet tall, or feel the heat.' },
        { label: 'Just another game', morale: 0, board: -0.2, reaction: 'Nobody believes you, least of all your own supporters.' },
        { label: 'Praise the rivalry', morale: 0, board: 0.2, reaction: 'A statesmanlike answer. Both sets of fans nod approvingly, then go back to hating each other.' },
      ], rng))
  }

  // wonderkid hype
  const kids = squad.filter(p => p.age <= 21 && p.form >= 7 && p.stats.apps >= 2)
  if (kids.length && rng() < 0.4) {
    const p = pick(rng, kids)
    candidates.push(mk(state,
      voice(6 + p.id, [
        `Everyone is talking about ${p.name} - ${p.age} years old and lighting up the league. Is he the future of the club?`,
        `${p.name}, ${p.age}, and already the first name the supporters sing. How good can he actually be?`,
        `Scouts, agents, pundits: all of them asking about ${p.name}. Is the club ready for what comes next?`,
      ]),
      p.id, [
        { label: 'Crown him now', morale: 1.5, board: 0.2, unsettle: true, reaction: `${p.name} floats out of the press room - and every scout in the hemisphere just circled his name.` },
        { label: 'Protect the kid', morale: 0.3, board: 0.3, reaction: 'Measured. He keeps developing away from the circus.' },
        { label: 'He plays when he earns it', morale: -0.6, board: 0.4, reaction: `Old school. ${p.name} bristles, but the senior players approve.` },
      ], rng))
  }

  // title-race mind games: late season, neck and neck with one rival
  const raceComp = state.comps[club.leagueId]
  if (raceComp && state.week >= 31 && rng() < 0.5) {
    const order = [...raceComp.table].sort((a, b) => b.pts - a.pts)
    const myIdx = order.findIndex(r => r.teamId === club.id)
    const rivalRow = myIdx >= 0 && myIdx <= 2
      ? (order[myIdx === 0 ? 1 : myIdx - 1] ?? null)
      : null
    const rivalClub = rivalRow && Math.abs(rivalRow.pts - order[myIdx].pts) <= 6 ? state.clubs[rivalRow.teamId] : null
    if (rivalClub) {
      candidates.push(mk(state,
        voice(7, [
          `The title race is down to you and ${rivalClub.name}. ${rivalClub.coach ?? 'Their coach'} says his side "handles the big moments better". Care to respond?`,
          `${rivalClub.coach ?? 'Their coach'} lit the fuse this morning: his ${rivalClub.short} side "handles the big moments better", apparently. Your reply?`,
          `Two horses left in this race, and the other one is ${rivalClub.name}. They are talking a big game across town. Anything to send back?`,
        ]),
        undefined, [
          { label: 'Put the pressure on them', morale: 0.6, board: 0, reaction: `"${rivalClub.short} have everything to lose - we're loving this." The squad walks taller; the run-in just got personal.` },
          { label: 'Focus on ourselves', morale: 0.2, board: 0.4, reaction: 'Calm, professional, forgettable. The dressing room stays level.' },
          { label: 'Flatter them into sleep', morale: 0, board: 0.2, reaction: `You call ${rivalClub.short} "the best side in the league". Pundits call it mind games. Maybe it is.` },
        ], rng))
    }
  }

  // unveiling: a new signing arrived this week - set his expectations
  const unveiling = state.news.find(n =>
    n.type === 'transfer' && n.season === state.season && state.week - n.week <= 1 &&
    n.playerId != null && state.players[n.playerId]?.clubId === club.id &&
    n.subject.includes(`joins ${club.name}`))
  const signing = unveiling?.playerId != null ? state.players[unveiling.playerId] : null
  if (signing && rng() < 0.7) {
    candidates.push(mk(state,
      voice(8 + signing.id, [
        `${signing.name} is in the room for his unveiling, shirt in hand. What are you expecting from your new ${posNoun(signing)}?`,
        `New shirt, new number, cameras everywhere: ${signing.name} is officially yours. What did you sign him to do?`,
        `${signing.name} has just finished posing for the photographers. Tell the supporters what their new ${posNoun(signing)} brings.`,
      ]),
      signing.id, [
        { label: 'A marquee moment', morale: 1.2, board: 0.3, reaction: `"He changes everything for us." ${signing.name} beams - and every match report this season will measure him against that sentence.` },
        { label: 'Time to settle', morale: 0.4, board: 0, reaction: 'Sensible. The pressure valve stays closed while he learns the calls.' },
        { label: 'He fights for his place', morale: -0.5, board: 0.4, reaction: `A cold shower at his own unveiling. The squad notes that nobody gets given a shirt here.` },
      ], rng))
  }

  // results pressure. formGuide sorts by week; a raw slice of the fixtures
  // array reads appended cup rounds out of calendar order (the Home pips bug).
  const recent = formGuide(state, club.id, 4)
  const losses = recent.filter(r => r === 'L').length
  if (losses >= 3) {
    candidates.push(mk(state,
      voice(9, [
        `${losses} defeats in the last ${recent.length}. Supporters are restless. How do you respond to talk of a crisis?`,
        `${losses} losses from ${recent.length}. The word "crisis" was said on the radio this morning. Is it one?`,
        `The table does not lie: beaten ${losses} times in your last ${recent.length}. What do you say to supporters who have stopped believing?`,
      ]),
      undefined, [
        { label: 'Take full responsibility', morale: 0.4, board: 0.6, reaction: 'The dressing room respects your honesty.' },
        { label: 'Blame fine margins', morale: 0, board: -0.6, reaction: 'The board is unimpressed with excuses.' },
        { label: 'Attack the question', morale: -0.2, board: -0.3, reaction: 'The clip goes viral for the wrong reasons.' },
      ], rng))
  }

  // discipline row: cards in the last match
  const lastFx = [...state.fixtures].reverse().find(f =>
    f.played && (f.homeId === club.id || f.awayId === club.id))
  const carded = lastFx?.events?.filter(e =>
    (e.type === 'YC' || e.type === 'RC') && e.teamId === club.id && e.playerId != null) ?? []
  if (carded.length >= 2 && rng() < 0.6) {
    const ev = carded[carded.length - 1]
    candidates.push(mk(state,
      voice(10, [
        `${carded.length} cards at the weekend, ${ev.playerName ?? 'your man'} among them. Is there a discipline problem in your squad?`,
        `${ev.playerName ?? 'Your man'} in the book again - ${carded.length} cards in one afternoon. When does passion become a problem?`,
        `The disciplinary summary makes grim reading: ${carded.length} cards. Whose fault is that - the players' or the coaching?`,
      ]),
      ev.playerId, [
        { label: 'Defend your players', morale: 0.8, board: -0.4, reaction: 'The squad appreciates the shield. The disciplinary panel does not.' },
        { label: 'Promise it will be addressed', morale: -0.6, board: 0.6, reaction: 'Sternly said. Extra tackling-technique sessions are already booked.' },
        { label: 'Blame the officiating', morale: 0.4, board: -0.5, reaction: 'The players love it; the league office sends a warning letter.' },
      ], rng))
  }

  // the new owner has landed: the room wants your first words on him
  if (state.newOwnerUntil != null && state.newOwnerUntil - state.week >= 6 && rng() < 0.7) {
    candidates.push(mk(state,
      voice(11, [
        `The takeover is done and the new owner is in the building. Every manager in your position is one bad month from a "restructure". What is your message to him?`,
        `New owner, first week. History says managers rarely survive a regime change. Why will you be different?`,
        `The new owner watched training from the balcony this morning, arms folded. What does he need to hear from you?`,
      ]),
      undefined, [
        { label: 'Judge me on the rugby', morale: 0.4, board: 0.3, reaction: 'Confident, direct - owners like a man who volunteers for the scoreboard.' },
        { label: 'We are aligned on the vision', morale: 0, board: 0.4, reaction: 'Fluent boardroom-speak. The suits nod; the terraces roll their eyes.' },
        { label: 'Owners come and go', morale: 0.5, board: -0.6, reaction: 'The dressing room loves the defiance. Upstairs, a note is made.' },
      ], rng))
  }

  // the vultures: job speculation when the board is restless
  if (club.boardConfidence <= 42 && rng() < 0.5) {
    candidates.push(mk(state,
      voice(12, [
        `There are reports this morning that the board has sounded out potential replacements. Are you fighting for your job?`,
        `Names are circulating for your job - real names, with real agents. Do you still have the board's backing?`,
        `A bookmaker suspended betting on the next manager here this morning. How safe are you, honestly?`,
      ]),
      undefined, [
        { label: `I'll be judged on trophies`, morale: 0.3, board: 0.3, reaction: 'Defiant. The players walk a little taller - now you have to deliver.' },
        { label: 'That is a question for the board', morale: -0.4, board: -0.3, reaction: 'The vacuum fills with more speculation.' },
        { label: 'Laugh it off', morale: 0.5, board: -0.1, reaction: 'The room chuckles. The chairman, watching the stream, does not.' },
      ], rng))
  }

  // title run-in nerves
  const myComp = state.comps[club.leagueId]
  if (myComp && state.week >= 30 && rng() < 0.45) {
    const pos = [...myComp.table].sort((a, b) => b.pts - a.pts).findIndex(r => r.teamId === club.id) + 1
    if (pos > 0 && pos <= 2) {
      candidates.push(mk(state,
        voice(13, [
          `Top ${pos === 1 ? 'of the table' : 'two'} with the season on the line. Can this group handle the pressure of a run-in?`,
          `${pos === 1 ? 'Top of the pile' : 'Second, and breathing down their necks'} with the business end here. Do your players sleep at night?`,
          `Every week from now is a final. ${pos === 1 ? 'Leaders' : 'The chasers'} always claim to enjoy it - do you, actually?`,
        ]),
        undefined, [
          { label: 'We want the target on our backs', morale: 0.6, board: 0.3, reaction: 'Bold. The bookies shorten your odds; the players feed off it.' },
          { label: 'One game at a time', morale: 0, board: 0.2, reaction: `The oldest line in the book, delivered with a straight face.` },
          { label: 'Pressure is a privilege', morale: 0.3, board: 0.2, reaction: 'Instant back-page headline. The town believes.' },
        ], rng))
    }
  }

  // Test-window exodus. THE ANSWERS ROTATE AND THE QUESTION COOLS DOWN
  // (user: "we keep getting the international have taken 6 of players. need
  // to change up the options for response"). Three voicings already rotated,
  // but the three ANSWERS were frozen, and with no playerId the office memo
  // never cooled it - a long window could ask twice in a fortnight with the
  // same three buttons. The option set now rotates on the same deterministic
  // clock as the wording, and a stamp keeps the subject off the desk for
  // eight weeks once raised.
  const away = squad.filter(p => p.natSquad).length
  const absNow2 = state.season * SEASON_WEEKS + state.week
  if (away >= 4 && rng() < 0.5 && (state.natAskAt == null || absNow2 - state.natAskAt >= 8)) {
    state.natAskAt = absNow2
    const optionSets = [
      [
        { label: 'Proud to produce Test players', morale: 0.4, board: 0.3, reaction: 'Gracious - and the academy parents noticed.' },
        { label: 'The calendar is broken', morale: 0, board: 0.1, reaction: 'Half the league\'s coaches text you in agreement.' },
        { label: 'We cope. Next question', morale: 0.2, board: 0, reaction: 'Brisk. The fringe players hear the message: their chance is coming.' },
      ],
      [
        { label: 'The fringe get their shot now', morale: 0.5, board: 0.1, reaction: 'Ten men who train all week and watch all weekend just sat up straighter.' },
        { label: 'We want compensation money', morale: 0, board: 0.4, reaction: 'The chairman applauds from upstairs. The unions send a lawyer\'s letter.' },
        { label: 'Their families should be proud', morale: 0.3, board: 0.1, reaction: 'A warm line that costs nothing and travels. Two mums frame the clipping.' },
      ],
      [
        { label: 'Judge my squad depth in May', morale: 0.2, board: 0.3, reaction: 'Confident. The pundits write it down for later, which is how promises work.' },
        { label: 'I pick clubs over country, always', morale: 0.1, board: 0.2, reaction: 'The terraces love it. Three national coaches stop returning your calls.' },
        { label: 'Honestly? It hurts us', morale: -0.1, board: 0, reaction: 'Candid, and the room respects it - but the headline writes itself: COACH ADMITS CRISIS.' },
      ],
    ]
    const opts = optionSets[(state.season * 5 + state.week * 3 + 14) % optionSets.length]
    candidates.push(mk(state,
      voice(14, [
        `${away} of your players are away on international duty. Should clubs be compensated when the Test windows strip their squads?`,
        `${away} first-teamers gone to the Test window and half your dressing room is empty. Proud, or fed up?`,
        `The internationals have taken ${away} of yours this window. Is the club-versus-country tug of war broken?`,
      ]),
      undefined, opts, rng))
  }

  // THE OTHER HAT. When the manager also coaches a nation and his squad is in
  // camp, the country's press want him too - a Test window should feel like
  // the biggest week of his year, not a line in the fixture list (user: "its
  // meant to be the pinnacle but is hidden away"). What he says here moves
  // the UNION's confidence, not the club board's - saying the country comes
  // second is heard in the federation offices, and saying it comes first is
  // heard in his own dressing room.
  if (state.natTeam && (state.natSquads[state.natTeam]?.length ?? 0) > 0 &&
      (state.natCoachAskAt == null || absNow2 - state.natCoachAskAt >= 6) && rng() < 0.6) {
    state.natCoachAskAt = absNow2
    const natName = nationByCode(state.natTeam)?.name ?? state.natTeam
    candidates.push(mk(state,
      voice(37, [
        `Your ${natName} squad is in camp and the country is watching. What does this window need to deliver?`,
        `Two jobs, one weekend: the nation's press want to know where ${natName} sits on your list. Well?`,
        `The ${natName} squad you named has the phone-ins arguing already. Talk us through your thinking.`,
      ]),
      undefined, [
        { label: `'${natName} can win the lot'`, morale: 0, board: 0, natConf: 3, reaction: 'The union loves it - and has written it down. Deliver, or this window becomes the stick they beat you with.' },
        { label: `'Judge us Test by Test'`, morale: 0, board: 0.2, natConf: 0.5, reaction: 'Measured. The federation nods; the phone-ins move on to the referees.' },
        { label: `'My club pays my wages'`, morale: 0.3, board: 0.4, natConf: -3, reaction: 'Your dressing room walks taller. In the federation offices, someone underlines a clause.' },
      ], rng))
  }

  // THE RUN GETS ASKED ABOUT (user: "no questions on how we are unbeaten this
  // season"). Five league wins from five is the only story in town; a press
  // room that ignores it while asking about the Test calendar reads as deaf.
  {
    const lg = state.fixtures.filter(f => f.compId === club.leagueId && f.played &&
      (f.homeId === club.id || f.awayId === club.id))
    const allWon = lg.length >= 5 && lg.every(f =>
      f.homeId === club.id ? f.homeScore > f.awayScore : f.awayScore > f.homeScore)
    if (allWon && rng() < 0.55) {
      candidates.push(mk(state,
        voice(31, [
          `${lg.length} league games, ${lg.length} wins. Nobody has laid a glove on you. Go on - say the word.`,
          `Still unbeaten in the league. What is the secret, and when does the weight of the run start to tell?`,
          `An unbeaten season is quietly becoming a real conversation. Is it on?`,
        ]),
        undefined, [
          { label: 'We have won nothing yet', morale: 0.2, board: 0.3, reaction: 'Straight bat. The senior players nod along.' },
          { label: 'Say it: the title', morale: 0.5, board: -0.1, reaction: 'The town roars. The board swallows hard - that quote will follow you into every ground.' },
          { label: 'The run will end. The standard will not', morale: 0.3, board: 0.3, reaction: 'Composed and quotable. Both rooms are happy.' },
        ], rng))
    }
  }

  // the manager's office: players knock on your door - but a man who has
  // already signed a pre-contract elsewhere has nothing left to ask you
  const OFFICE = OFFICE_OUTLET
  const committed = new Set((state.preContracts ?? []).map(pc => pc.playerId))

  // a frozen-out senior wants to know where he stands
  const frozen = squad.filter(p => !p.acad && p.age >= 24 && p.ca >= 68 &&
    p.morale <= 5.5 && p.stats.apps <= 2 && !p.injury && !p.onLoan && !committed.has(p.id) &&
    !askedRecently(state, p.id, 'plans') && state.week >= 10 && state.week <= 40)
  if (frozen.length && rng() < 0.35) {
    const p = pick(rng, frozen)
    const item = mk(state,
      pick(rng, [
        `${p.name} knocks and closes the door behind him. "Boss, I have barely played all season. Tell me straight - am I in your plans or not?"`,
        `${p.name} has been waiting outside since the end of training. "I watch every session from the sidelines, boss. I need to know if there is a future for me here."`,
        `${p.name} does not sit down. "I am not here to argue. One question: do you see me in this team? Because right now I cannot."`,
      ]),
      p.id, [
        { label: 'You are in my plans - stay ready', morale: 1.1, board: 0, pledge: 'plans', reaction: pick(rng, [
          `${p.name} leaves with his head up. He will hold you to it - pick him soon or this conversation happens again, louder.`,
          `The tension goes out of his shoulders. A promise in this office is a promise on the team sheet - he will be counting the weeks.`,
        ]) },
        { label: 'Honestly? He can find a new club', morale: -0.9, board: 0.3, unsettle: true, reaction: pick(rng, [
          `A hard truth, kindly delivered. ${p.name} thanks you for being straight - and his agent is making calls within the hour.`,
          `He goes quiet, then nods. "Appreciate the honesty, boss." The listing will not shock anyone in the dressing room.`,
        ]) },
        { label: 'Nobody is owed a shirt here', morale: -0.4, board: 0.2, reaction: pick(rng, [
          `He nods, jaw tight, and heads back to training. The squad hears about it - the honest ones respect it.`,
          `"Fine. Then I will take one." He trains like a man possessed all week. That answer either made him or lost him.`,
        ]) },
      ], rng)
    item.outlet = OFFICE
    item.topic = 'plans'
    candidates.push(item)
  }

  // an academy prospect wants a loan
  const restless = squad.filter(p => p.acad && p.age <= 21 && p.pa >= 74 &&
    p.stats.apps <= 3 && !p.injury && !p.onLoan && !committed.has(p.id) &&
    !askedRecently(state, p.id, 'loan') && state.week >= 8 && state.week <= 34)
  if (restless.length && rng() < 0.3) {
    const p = pick(rng, restless)
    const item = mk(state,
      pick(rng, [
        `${p.name}, ${p.age}, is waiting by your office after training. "I am not learning anything carrying tackle bags, boss. Send me on loan - I need real minutes."`,
        `${p.name} catches you in the corridor, all nerves and rehearsed lines. "Boss, my mates from the age-groups are playing senior rugby every week. I am standing still here. Let me go and prove it somewhere."`,
        `The academy coach sends ${p.name} up to see you. The lad gets it out in one breath: "Loan me out, boss. I will come back better - or I will come back and you can tell me I was wrong."`,
      ]),
      p.id, [
        { label: 'Promise him minutes here', morale: 0.9, board: 0, pledge: 'minutes', reaction: pick(rng, [
          `${p.name} lights up. Play him in the next few weeks or the shine wears off fast.`,
          `He floats out of the office. A first-team promise at his age is rocket fuel - but it burns fast if the team sheet never shows it.`,
        ]) },
        { label: 'Agree - a loan makes sense', morale: 0.5, board: 0.2, loan: true, reaction: pick(rng, [
          `A smart development call. The loan is agreed the same afternoon, and the reports will come back to you every few weeks.`,
          `He grins and shakes your hand twice, and the academy coach makes the calls before you have changed your mind: minutes make players, benches make excuses.`,
        ]) },
        { label: 'He is not ready to leave', morale: -0.7, board: 0, reaction: pick(rng, [
          `He trudges out without a word. The academy coach thinks you have just cooled your hottest prospect.`,
          `"Right." One word, and the door does not slam, which is somehow worse. Keep an eye on his training reports.`,
        ]) },
      ], rng)
    item.outlet = OFFICE
    item.topic = 'loan'
    candidates.push(item)
  }

  // a veteran on an expiring deal wants to know what happens next
  const fading = squad.filter(p => p.age >= 32 && p.contractEnds <= state.season &&
    p.stats.apps >= 4 && !p.onLoan && !committed.has(p.id) &&
    !askedRecently(state, p.id, 'deal') && state.week >= 20 && state.week <= 38)
  if (fading.length && rng() < 0.35) {
    const p = pick(rng, fading)
    const item = mk(state,
      pick(rng, [
        `${p.name}, ${p.age} now, sits down across from you. "My deal is up this summer. I am not asking for promises, boss - I just need to know if I should be planning a life after this place."`,
        `${p.name} waits until the room is empty. "Twelve years a professional, boss, and this is the conversation you never get used to. My contract is up. Where do I stand?"`,
        `${p.name} brings two coffees in and sets one down in front of you. "No agents, no lawyers, just us. My deal ends this summer. Tell me what you are thinking."`,
      ]),
      p.id, [
        { label: 'There is another year in you', morale: 1.2, board: -0.2, pledge: 'deal', reaction: pick(rng, [
          `${p.name} shakes your hand hard. Offer the terms from his player page before someone else does.`,
          `Relief, then a grin you have not seen since pre-season. Get the paperwork moving before his agent hears anything else.`,
        ]) },
        { label: 'This season is his last here', morale: -1.0, board: 0.4, reaction: pick(rng, [
          `He takes it with dignity. He will finish the job properly - and the young players just saw how endings are handled here.`,
          `A long exhale, a nod, a handshake. "Then let us win something on the way out." Class to the end.`,
        ]) },
        { label: 'Decide in the run-in', morale: -0.3, board: 0, reaction: pick(rng, [
          `Honest, but the uncertainty follows him around. His agent quietly starts taking other calls.`,
          `He expected better than a maybe. The performances will tell you his answer before you give him yours.`,
        ]) },
      ], rng)
    item.outlet = OFFICE
    item.topic = 'deal'
    candidates.push(item)
  }

  // post-match reaction: the result you just walked off the pitch with
  const justPlayed = state.fixtures.find(f =>
    f.played && f.week === state.week && (f.homeId === club.id || f.awayId === club.id))
  if (justPlayed && rng() < 0.6) {
    const us = justPlayed.homeId === club.id ? justPlayed.homeScore : justPlayed.awayScore
    const them = justPlayed.homeId === club.id ? justPlayed.awayScore : justPlayed.homeScore
    const oppId = justPlayed.homeId === club.id ? justPlayed.awayId : justPlayed.homeId
    const oppName = state.clubs[oppId]?.short ?? oppId
    const margin = us - them
    const derby = isDerby(justPlayed.homeId, justPlayed.awayId)
    let reaction: PressItem | null = null
    if (margin >= 25) {
      reaction = mk(state,
        voice(15, [
          `${us}-${them}. A statement performance - the best this team can play, or is there more?`,
          `${us}-${them}, and it barely flattered you. Where does that rank among performances in your time here?`,
          `${oppName} had no answers out there. ${us}-${them} - is this side at its ceiling, or still climbing?`,
        ]),
        undefined, [
          { label: 'There is more to come', morale: 0.6, board: 0.3, reaction: 'Ominous for the rest of the league. The players believe it too.' },
          { label: `Credit ${oppName} - they made it hard`, morale: 0.2, board: 0.2, reaction: 'Gracious in victory. Neutrals approve.' },
          { label: 'We move on immediately', morale: 0, board: 0.2, reaction: 'All business. The standard is the standard.' },
        ], rng)
    } else if (margin <= -25) {
      reaction = mk(state,
        voice(16, [
          `${us}-${them} to ${oppName}. Supporters deserve an explanation. What went wrong out there?`,
          `${us}-${them}. Some of your supporters left twenty minutes early. What do you owe them?`,
          `A ${them - us}-point beating. Talk us through it, because nobody in the stands could.`,
        ]),
        undefined, [
          { label: 'That was on me, not the players', morale: 0.7, board: -0.2, reaction: 'The dressing room notices who took the bullets.' },
          { label: 'Some of that was unacceptable', morale: -0.9, board: 0.4, reaction: 'Hard words, publicly delivered. Training will be spiky this week.' },
          { label: 'One bad day. No drama', morale: 0.1, board: -0.3, reaction: 'Calm - but the phone-ins want blood, not calm.' },
        ], rng)
    } else if (derby && margin > 0) {
      reaction = mk(state,
        voice(17, [
          `Derby day belongs to you. The fans are singing your name outside - a message for them?`,
          `You could hear your end from the tunnel. A derby won: who does it mean more to, you or them?`,
          `Bragging rights are yours until the return fixture. Any words for the neighbours?`,
        ]),
        undefined, [
          { label: 'Enjoy every minute of it', morale: 0.5, board: 0.3, reaction: 'The clip of your grin does big numbers. Bragging rights secured.' },
          { label: 'It is only worth four points', morale: -0.2, board: 0.3, reaction: 'True, technically. Nobody outside the building agrees.' },
          { label: 'This club owns this city', morale: 0.8, board: -0.1, unsettle: false, reaction: 'Front page. Their fans will keep the receipt - mind the return fixture.' },
        ], rng)
    } else if (derby && margin < 0) {
      reaction = mk(state,
        voice(18, [
          `A derby defeat, and their supporters are letting you know about it. How do you face your own fans this week?`,
          `They will paint the town their colours tonight. A derby lost - how long does this one hurt?`,
          `Your supporters filed out in silence; theirs did not. What happens now?`,
        ]),
        undefined, [
          { label: 'We will not hide from this', morale: 0.4, board: 0.3, reaction: 'Straight talk. The fans respect honesty more than excuses.' },
          { label: 'The performance was actually good', morale: 0, board: -0.4, reaction: 'The stats might back you up. Derby crowds do not deal in stats.' },
          { label: 'Wait for the return fixture', morale: 0.3, board: 0, reaction: 'A promise. It will be remembered - deliver or else.' },
        ], rng)
    }
    if (reaction && state.press.filter(p => !p.answered).length < 2) state.press.push(reaction)
  }

  if (candidates.length && rng() < 0.75) {
    const chosen = candidates[Math.floor(rng() * candidates.length)]
    state.press.push(chosen)
    // the office writes its memo when the man knocks, so that whatever the
    // manager says - or does not say - he is not back next week with the
    // same speech
    if (chosen.topic && chosen.playerId != null) rememberAsk(state, chosen.playerId, chosen.topic)
    // keep press list bounded
    if (state.press.length > 40) state.press = state.press.slice(-40)
  }

  // ONE ROOM, ONE QUESTION. A live screenshot showed two outlets asking the
  // word-for-word same question in the same week. Whatever pushed it twice,
  // the room must never print it twice: the first unanswered copy of any
  // wording survives, the rest are dropped. Answered questions are history
  // and stay untouched.
  {
    const seen = new Set<string>()
    state.press = state.press.filter(q =>
      q.answered || (seen.has(q.question) ? false : (seen.add(q.question), true)))
  }
}

function posNoun(p: Player): string {
  const map: Record<string, string> = {
    LP: 'prop', TP: 'prop', HK: 'hooker', LK: 'lock', FL: 'flanker', N8: 'number eight',
    SH: 'scrum-half', FH: 'fly-half', CE: 'centre', WG: 'winger', FB: 'full-back',
  }
  return map[p.pos] ?? 'player'
}

/** Apply the chosen answer. */
export function answerPress(state: GameState, pressId: number, optionIndex: number) {
  const item = state.press.find(p => p.id === pressId)
  if (!item || item.answered) return
  const opt = item.options[optionIndex]
  if (!opt) return
  item.answered = true
  item.answerLabel = opt.label
  item.reaction = opt.reaction
  // a public loyalty vow goes on the record - walk it back and it walks with you
  if (opt.vow) state.vowedAt = state.season * 100 + state.week
  // the national-coach question is heard in the federation offices, not the
  // club boardroom - what it moves is the union's confidence
  if (opt.natConf && state.natConfidence != null) {
    state.natConfidence = clamp(state.natConfidence + opt.natConf, 0, 100)
  }
  // a discipline conversation: the incident machine decides whether the
  // response lands, and its verdict becomes the printed reaction
  if (opt.disc && item.incidentId != null) {
    const inc = (state.incidents ?? []).find(i => i.id === item.incidentId)
    if (inc) item.reaction = applyResponse(state, inc, opt.disc)
  }
  // a lodged appeal is heard the same day: deterministic verdict, no shared
  // rng - the same save always gets the same hearing
  if (opt.appeal && item.playerId != null) {
    const p = state.players[item.playerId]
    if (p) {
      const upheld = (p.id + state.season * 7 + state.week * 3) % 3 !== 0 // the club wins 2 hearings in 3
      if (upheld && p.bans > 0) {
        p.bans -= 1
        logDecision(state, 'dec.appealUpheld', { player: p.name }, true)
        // The tail is a whole clause and it pluralises, so it travels as a key
        // with `n` on it rather than as a stitched-together string: English
        // switches at one and French at two, and only the reader's dictionary
        // knows which.
        const v = {
          player: p.name, n: p.bans,
          rest_k: p.bans > 0 ? 'news.appealStillToServe' : 'news.appealFreeToPlay',
        }
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'injury', read: false,
          subject: tIn('en', 'news.appealUpheldSubj', v),
          body: tIn('en', 'news.appealUpheld', v),
          k: 'news.appealUpheld', v,
          playerId: p.id,
        })
      } else {
        p.bans += 1
        const c = state.clubs[state.userClubId]
        c.boardConfidence = clamp(c.boardConfidence - 2, 0, 100)
        logDecision(state, 'dec.appealDismissed', { player: p.name }, false)
        const v = { player: p.name, n: p.bans }
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'injury', read: false,
          subject: tIn('en', 'news.appealDismissedSubj', v),
          body: tIn('en', 'news.appealDismissed', v),
          k: 'news.appealDismissed', v,
          playerId: p.id,
        })
      }
    }
  }
  // "Agree - a loan makes sense" now agrees to a loan. It used to be a mood
  // adjustment and a note telling the manager to go and do it himself, which is
  // how a prospect came back the following week asking for the thing his boss
  // had already said yes to.
  if (opt.loan && item.playerId != null) {
    const r = loanOut(state, item.playerId)
    if (!r.ok) {
      // he is in the XV, or too old, or already out: say so rather than print a
      // reaction describing a move that did not happen
      item.reaction = `Agreed in principle, but it stops there for now. ${r.msg}`
    } else {
      logDecision(state, 'dec.agreedLoan', { player: state.players[item.playerId]?.name ?? '' }, true)
    }
  }
  if (item.playerId != null) {
    const p = state.players[item.playerId]
    if (p) {
      const swing = p.pers === 'Temperamental' ? 1.7 : 1
      p.morale = clamp(p.morale + opt.morale * swing, 1, 10)
      if (opt.unsettle) p.morale = clamp(p.morale - 1, 1, 10) // agents circle an unsettled player
      // a promise made is a promise recorded - it falls due in a few weeks
      if (opt.pledge && !(state.pledges ?? []).some(pl => pl.playerId === p.id && pl.kind === opt.pledge)) {
        ;(state.pledges ??= []).push({
          playerId: p.id, kind: opt.pledge, week: state.week, season: state.season,
          due: Math.min(state.week + (opt.pledge === 'deal' ? 8 : 6), 44),
          baseApps: p.stats.apps,
        })
      }
    }
  }
  // the pre-season decision lands the same week: deterministic trade-offs
  if (opt.camp) {
    const c = state.clubs[state.userClubId]
    const squad = c.players.map(id => state.players[id]).filter((p): p is Player => !!p)
    if (opt.camp === 'heat') {
      c.balance -= 400_000
      for (const p of squad) { p.sharp = clamp(p.sharp + 12, 0, 100); p.morale = clamp(p.morale + 0.3, 1, 10) }
      logDecision(state, 'dec.campHeat', undefined, true)
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
        subject: tIn('en', 'news.campHeatSubj'),
        body: tIn('en', 'news.campHeat'),
        k: 'news.campHeat',
      })
    } else if (opt.camp === 'home') {
      state.fanMood = clamp((state.fanMood ?? 60) + 6, 10, 95)
      for (const p of squad) p.morale = clamp(p.morale + 0.2, 1, 10)
      logDecision(state, 'dec.campHome', undefined, true)
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
        subject: tIn('en', 'news.campHomeSubj'),
        body: tIn('en', 'news.campHome'),
        k: 'news.campHome',
      })
    } else {
      c.balance += 600_000
      state.fanMood = clamp((state.fanMood ?? 60) - 3, 10, 95)
      for (const p of squad) p.cond = clamp(p.cond - 8, 20, 100)
      logDecision(state, 'dec.campTour', undefined, false)
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
        subject: tIn('en', 'news.campTourSubj'),
        body: tIn('en', 'news.campTour'),
        k: 'news.campTour',
      })
    }
  }
  // the summer sponsorship decision (25C): the option IS the signature.
  // offersFor is deterministic on (seed, season, slot), so the deal named on
  // the button is exactly the deal that lands; 'keep' leaves the stopgap the
  // department already took, which signOffer would let you replace any time.
  if (opt.deal && opt.deal.kind !== 'keep') {
    const offers = offersFor(state, opt.deal.slot as SlotId)
    const idx = { long: 0, short: 1, clause: 2 }[opt.deal.kind]
    if (idx != null && offers[idx]) signOffer(state, offers[idx])
  }
  // the expectations decision: the stance stands for the season and
  // boardReaction reads it on every result
  if (opt.stance) {
    state.stance = opt.stance
    const c = state.clubs[state.userClubId]
    // the war chest lands the moment the words are out - and the rollover
    // remembers exactly how much the promise was worth
    if (opt.fund) {
      c.budget += opt.fund
      state.stanceFund = opt.fund
    }
    // the whole room heard the launch speech. The option's morale figure was
    // computed against the club's stature when the question was built, and
    // this item has no playerId, so the per-player branch above never fires -
    // without this loop the squad reaction is a printed number that moves
    // nobody, which is exactly what it was for two versions.
    for (const id of c.players) {
      const p = state.players[id]
      if (p) p.morale = clamp(p.morale + opt.morale, 1, 10)
    }
    logDecision(state,
      opt.stance === 'high' ? 'dec.stanceHigh' : opt.stance === 'safe' ? 'dec.stanceSafe' : 'dec.stanceBoard',
      { fund_k: opt.fund ? 'dec.warChest' : 'common.nothing', fund: opt.fund ? fmtMoney(opt.fund) : '' },
      opt.stance !== 'safe')
  }
  const club = state.clubs[state.userClubId]
  club.boardConfidence = clamp(club.boardConfidence + opt.board * 5, 0, 100)

  // tone ledger: what you say in public adds up - but words behind the
  // office door are private, and never move the public needle
  if (item.outlet === OFFICE_OUTLET) return
  const prev = state.pressTone ?? 0
  if (opt.morale >= 0.5) state.pressTone = clamp(prev + 1, -6, 6)
  else if (opt.morale <= -0.5) state.pressTone = clamp(prev - 1, -6, 6)
  const tone = state.pressTone ?? 0
  if (prev < 4 && tone >= 4) {
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'gossip', read: false,
      subject: tIn('en', 'news.toneSwaggerSubj'),
      body: tIn('en', 'news.toneSwagger'),
      k: 'news.toneSwagger',
    })
  }
  if (prev > -4 && tone <= -4) {
    for (const id of club.players) {
      const p = state.players[id]
      if (p) p.morale = clamp(p.morale - 0.5, 1, 10)
    }
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'gossip', read: false,
      subject: tIn('en', 'news.toneBruisedSubj'),
      body: tIn('en', 'news.toneBruised'),
      k: 'news.toneBruised',
    })
  }
}
