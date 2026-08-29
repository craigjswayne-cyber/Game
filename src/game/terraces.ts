/**
 * ---- THE TERRACES ----
 *
 * Owner, v1.1.12: "i think the impact of fans on clubs mood/social media
 * messages etc should impact the game more. campaigns to get coaches out, press
 * campaigns. it needs more depth." And, in the same breath, the two moments a
 * support actually finds its voice:
 *
 *   "selling players - if you sell a big player, fans should complain - chat on
 *    socials how the clubs not doing enough etc."
 *   "celebrate big signings more - announcement in the news about fans on the
 *    streets, stupid updates of people naming their babies after the coach, lift
 *    the mood of the club - bad signings dent morale of the club."
 *   "other players in the squad should be affected by arrivals - positive but
 *    nervous if in same position."
 *
 * The game already had `state.fanMood` and it already MATTERED - it moves the
 * gate, the club shop, the home advantage and the pre-match atmosphere - but
 * almost nothing moved IT except results, and nothing about it was ever
 * addressed to the manager. A number that only results can change is a readout,
 * not a system.
 *
 * So this module is the two-way street:
 *
 *   TRANSFERS MOVE THE MOOD. Selling a man the terraces loved costs you, and
 *   costs you more when nobody asked you to sell him. Signing one buys you
 *   goodwill, and the goodwill is loud - which is where the babies come in.
 *
 *   THE MOOD MOVES THE BOARD. A support that has turned does not stay on the
 *   terraces: it makes banners, buys a hashtag, hires a plane, and the
 *   directors read the same phone-ins everybody else does. Sustained anger
 *   presses board confidence, which is the thing that can actually end a job -
 *   so a manager who ignores his support is now taking a real risk rather than
 *   watching a mood bar.
 *
 * Everything here is deterministic given the state and the week's rng, files
 * its stories by KEY like the rest of the game, and touches nothing the match
 * engine reads mid-match.
 */
import type { GameState, Player } from './model'
import { clamp } from './rng'
import { tIn } from './i18n'

/** A terrace story. Keyed like everything else, so it reads in French too. */
function terrace(
  state: GameState, k: string, v: Record<string, string | number>,
  type: 'gossip' | 'transfer' | 'board' = 'gossip', playerId?: number,
) {
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type, read: false,
    subject: tIn('en', `${k}Subj`, v),
    body: tIn('en', k, v),
    k, v, playerId,
  })
}

const setMood = (state: GameState, delta: number): number => {
  const before = state.fanMood ?? 60
  state.fanMood = clamp(before + delta, 5, 98)
  return state.fanMood - before
}

/**
 * HOW BIG A NAME IS THIS, TO THIS SUPPORT? 0 to 1.
 *
 * Not raw ability: a 78 at a Championship club is the best player anyone on
 * that terrace has seen, and the same man at Toulouse is a squad option. So it
 * is his standing against his club's, plus what he has actually done in the
 * shirt - appearances and tries are what a crowd remembers, and they are the
 * difference between a good signing and one of their own.
 */
export function terraceStanding(state: GameState, p: Player, clubId: string): number {
  const club = state.clubs[clubId]
  if (!club) return 0
  const quality = clamp((p.ca - (club.rep - 14)) / 26, 0, 1)
  const served = clamp((p.stats?.apps ?? 0) / 60, 0, 1)
  const capped = (p.caps ?? 0) >= 10 ? 0.15 : 0
  return clamp(quality * 0.7 + served * 0.25 + capped, 0, 1)
}

/**
 * A MAN LEAVES, AND THE PHONE-INS START.
 *
 * The bigger he was and the less he wanted to go, the worse it is. A man the
 * club had listed is a decision the support can live with; a man who was
 * playing every week and is suddenly somebody else's is "the club isn't
 * showing ambition", which is the exact sentence the owner asked for.
 */
function starSold(state: GameState, p: Player, fee: number, toName: string, wasListed: boolean) {
  const club = state.clubs[state.userClubId]
  if (!club) return
  const standing = terraceStanding(state, p, club.id)
  if (standing < 0.42) return // a squad man leaving is not a news story
  // being LISTED is the club saying out loud that he was for sale, and it
  // halves the anger: the terraces were warned
  const unwanted = wasListed ? 0.5 : 1
  const drop = -(4 + standing * 14) * unwanted
  const moved = setMood(state, drop)
  // the dressing room feels it too - a departure is a statement about where
  // the club is going, and they can all read it
  for (const id of club.players) {
    const m = state.players[id]
    if (m) m.morale = clamp(m.morale - 0.4 * standing * unwanted, 1, 10)
  }
  terrace(state, standing >= 0.75 ? 'news.fanSoldIcon' : 'news.fanSoldStar', {
    player: p.name, club: club.short, to: toName,
    fee: fee > 0 ? fee : 0, n: Math.abs(Math.round(moved)),
  }, 'gossip', p.id)
}

/**
 * A MAN ARRIVES, AND THE TOWN LOSES ITS HEAD.
 *
 * The celebration scales the same way, and it is deliberately ridiculous at
 * the top end, because that is what the owner asked for and because it is also
 * true: people really do name children after a signing.
 */
function starSigned(state: GameState, p: Player, fee: number) {
  const club = state.clubs[state.userClubId]
  if (!club) return
  const standing = terraceStanding(state, p, club.id)
  if (standing < 0.42) return
  const moved = setMood(state, 3 + standing * 12)
  // THE SQUAD READS IT TWO WAYS (owner: "positive but nervous if in same
  // position"). A big arrival says the club is going somewhere, which lifts
  // everybody - except the men who play where he plays, who have just watched
  // their shirt get harder to keep. Both are real, and the second is bigger
  // for the men closest to the shirt.
  for (const id of club.players) {
    const m = state.players[id]
    if (!m || m.id === p.id) continue
    const rival = m.pos === p.pos || (m.alt ?? []).includes(p.pos)
    m.morale = clamp(m.morale + (rival ? -0.5 - standing * 0.8 : 0.25 + standing * 0.35), 1, 10)
  }
  const rivals = club.players
    .map(id => state.players[id])
    .filter((m): m is Player => !!m && m.id !== p.id && m.pos === p.pos)
    .sort((a, b) => b.ca - a.ca)
  terrace(state, standing >= 0.78 ? 'news.fanSignedIcon' : 'news.fanSignedStar', {
    player: p.name, club: club.short, pos: p.pos,
    n: Math.round(moved),
    rival_k: rivals.length ? 'news.fanRivalNamed' : 'news.fanRivalNone',
    rival: rivals[0]?.name ?? '',
  }, 'gossip', p.id)
}

/**
 * The one door both directions go through. Called from executeTransfer, after
 * the money has moved and the squads are settled, so everything it reads is
 * already true.
 */
export function transferReaction(
  state: GameState, p: Player, fromId: string | null, toId: string, fee: number,
  /** whether the selling club had him LISTED, read before executeTransfer
   *  clears the flag - the terraces were warned, and it halves the anger */
  wasListed: boolean,
) {
  if (state.unemployed) return
  if (fromId === state.userClubId) starSold(state, p, fee, state.clubs[toId]?.name ?? '', wasListed)
  else if (toId === state.userClubId) starSigned(state, p, fee)
}

/** As low as an angry support alone can take a board. Below this the results
 *  own the number - see terraceWeek. */
const TERRACE_FLOOR = 40

/** How angry the terraces are, 0 (content) to 3 (a plane over the ground). */
export type CampaignStage = 0 | 1 | 2 | 3

/**
 * WHERE A SUPPORT'S ANGER HAS GOT TO.
 *
 * A campaign is not one bad week: it is a mood that has stayed down while the
 * results stayed bad, which is exactly how these things build in real life.
 * Both terms have to be true - a good side with a grumpy support is a moan,
 * and a bad run with the terraces behind you is a project - so the stage reads
 * the mood AND the board, and the board is the game's own measure of whether
 * the last few months have gone wrong.
 */
export function campaignStage(state: GameState): CampaignStage {
  if (state.unemployed) return 0
  const club = state.clubs[state.userClubId]
  if (!club) return 0
  const mood = state.fanMood ?? 60
  const board = club.boardConfidence
  if (mood > 42 || board > 62) return 0
  if (mood <= 18 && board <= 32) return 3
  if (mood <= 28 && board <= 45) return 2
  return 1
}

/**
 * THE WEEKLY TEMPERATURE ON THE TERRACES.
 *
 * Two jobs. It escalates the campaign - and files the story the first week it
 * reaches each stage, never again, so a bad autumn is three stories rather than
 * fifteen - and it lets the mood press the board.
 *
 * That second half is the whole of "impact the game more". Before this, fan
 * mood changed the gate takings and the atmosphere and could not, by itself,
 * cost anybody their job. Now a support in open revolt drags board confidence
 * down with it, and a support that has fallen in love with you holds the board
 * steady through a bad run - which is what a manager means when he says the
 * fans bought him time.
 */
export function terraceWeek(state: GameState) {
  if (state.unemployed) return
  const club = state.clubs[state.userClubId]
  if (!club) return
  const stage = campaignStage(state)
  const seen = state.fanCampaign ?? 0

  if (stage > seen) {
    state.fanCampaign = stage
    const boss = state.managerName
    if (stage === 1) terrace(state, 'news.fanRumble', { club: club.short, boss }, 'gossip')
    if (stage === 2) terrace(state, 'news.fanBanners', { club: club.short, boss, stadium: club.stadium }, 'board')
    if (stage === 3) terrace(state, 'news.fanPlane', { club: club.short, boss, stadium: club.stadium }, 'board')
  } else if (stage === 0 && seen > 0) {
    // the mood has turned: say so, because a campaign that just stops without
    // a word is the game forgetting what it told you
    state.fanCampaign = 0
    terrace(state, 'news.fanForgiven', { club: club.short, boss: state.managerName }, 'gossip')
  }

  // THE BOARD READS THE SAME PHONE-INS - DOWN TO A POINT, AND NO FURTHER.
  //
  // A campaign costs confidence every week it runs, and more the louder it is.
  // But the first draft of this took it away without a floor, and
  // scripts/difficultyprobe.ts said what that meant within one run: a
  // sleepwalking minnow's board bottomed at 34 where it used to bottom at 50,
  // because forty weeks of a stage-one grumble is sixteen points of confidence
  // whatever happens on the pitch. That is not pressure, it is a second
  // sacking mechanism running in parallel with the results - and the minnow's
  // patience, which the probe exists to protect, was the first thing it ate.
  //
  // So the terraces can push a board INTO the danger zone and never through
  // it. Below the floor the board's own arithmetic owns the number outright,
  // which is the right division of labour: an angry support makes directors
  // doubt you, results are what actually end it.
  const mood = state.fanMood ?? 60
  if (stage > 0) {
    if (club.boardConfidence > TERRACE_FLOOR) {
      club.boardConfidence = Math.max(TERRACE_FLOOR, club.boardConfidence - 0.35 * stage)
    }
  } else if (mood >= 78) {
    club.boardConfidence = clamp(club.boardConfidence + 0.25, 0, 100)
  }
}
