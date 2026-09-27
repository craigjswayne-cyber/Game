using System;
using System.Collections.Generic;
using Rugby.Engine;

namespace Rugby.Presentation
{
    /// <summary>
    /// PRESENTATION LAYER: turns MatchEvents into text. It reads the engine's teams to
    /// look up names, and never writes to the engine. A 2D pitch renderer would be a
    /// second consumer of the same queue, tweening dots to each event's Ball position.
    ///
    /// Line choice uses its OWN random stream, so picking a different phrasing can never
    /// change the match.
    /// </summary>
    public sealed class CommentaryRenderer
    {
        private readonly MatchEngine _engine;
        private readonly Dictionary<int, RugbyPlayer> _players = new Dictionary<int, RugbyPlayer>();
        private readonly DeterministicRng _flavour;

        public CommentaryRenderer(MatchEngine engine, ulong flavourSeed = 1)
        {
            _engine = engine;
            foreach (var p in engine.Home.Players) _players[p.Id] = p;
            foreach (var p in engine.Away.Players) _players[p.Id] = p;
            _flavour = new DeterministicRng(flavourSeed);
        }

        private string Name(int? id) => id.HasValue && _players.TryGetValue(id.Value, out var p) ? p.Name : "someone";
        private string TeamName(TeamSide? s) => s.HasValue ? _engine.TeamOf(s.Value).Name : "";
        private string Pick(params string[] options) => options[_flavour.Range(0, options.Length)];

        private static string Where(MatchEvent e, TeamSide side)
        {
            double up = side == TeamSide.Home ? e.Ball.X : Vec2.PitchLength - e.Ball.X;
            return up < 22 ? "inside their own 22" : up < 50 ? "in their own half" : up < 78 ? "in the opposition half" : "inside the opposition 22";
        }

        private static double D(MatchEvent e, string key) => e.Data.TryGetValue(key, out var v) ? v : 0;

        /// <summary>One line of commentary, or null for events the ticker does not narrate.</summary>
        public string Render(MatchEvent e)
        {
            string clock = $"{e.Minute,2}'";
            string score = $"[{_engine.Home.Name} {e.HomeScore}-{e.AwayScore} {_engine.Away.Name}]";
            string team = TeamName(e.Team);
            string text;
            switch (e.Type)
            {
                case MatchEventType.KickOff:
                    text = D(e, "regained") > 0 ? $"{Name(e.PrimaryPlayerId)} kicks off and {team} win it back in the air!"
                                                : $"{Name(e.PrimaryPlayerId)} gets the game under way for {team}.";
                    break;
                case MatchEventType.Carry:
                    text = $"Phase {D(e, "phase"):0}: {Name(e.PrimaryPlayerId)} takes it up, {Name(e.SecondaryPlayerId)} lines up the tackle.";
                    break;
                case MatchEventType.Tackle:
                    double m = D(e, "metres");
                    text = m < 0
                        ? $"{Name(e.PrimaryPlayerId)} drives {Name(e.SecondaryPlayerId)} back {Math.Abs(m):0} metres. Big hit."
                        : $"{Name(e.PrimaryPlayerId)} brings {Name(e.SecondaryPlayerId)} down after {m:0} metres.";
                    break;
                case MatchEventType.RuckSecured:
                    double speed = D(e, "ballSpeed");
                    text = speed < 3 ? $"Quick ball. {Name(e.PrimaryPlayerId)} has it away in {speed:0.0} seconds."
                                     : $"Slow ball this time, {speed:0.0} seconds before {Name(e.PrimaryPlayerId)} can move it.";
                    break;
                case MatchEventType.Offload:
                    text = Pick($"Offload! {Name(e.PrimaryPlayerId)} frees the arms and {Name(e.SecondaryPlayerId)} is away.",
                                $"{Name(e.PrimaryPlayerId)} gets the ball out of the tackle to {Name(e.SecondaryPlayerId)}.");
                    break;
                case MatchEventType.LineBreak:
                    text = $"LINE BREAK! {Name(e.PrimaryPlayerId)} beats {Name(e.SecondaryPlayerId)} and is into space!";
                    break;
                case MatchEventType.Turnover:
                    text = D(e, "knockOn") > 0
                        ? $"Knock-on by {Name(e.PrimaryPlayerId)}. Scrum to {team}."
                        : $"Turnover! {Name(e.PrimaryPlayerId)} gets over the ball and wins it for {team}.";
                    break;
                case MatchEventType.PenaltyConceded:
                    text = $"Penalty. {Name(e.PrimaryPlayerId)} ({team}) is pinged at the breakdown.";
                    break;
                case MatchEventType.KickInPlay:
                    text = D(e, "regained") > 0 ? $"{Name(e.PrimaryPlayerId)} puts it up, {D(e, "distance"):0} metres, and {team} win it back!"
                                                : $"{Name(e.PrimaryPlayerId)} kicks {D(e, "distance"):0} metres downfield; {Name(e.SecondaryPlayerId)} gathers.";
                    break;
                case MatchEventType.KickToTouch:
                    text = $"{Name(e.PrimaryPlayerId)} finds touch with a {D(e, "distance"):0}-metre kick.";
                    break;
                case MatchEventType.LineoutWon:
                    text = $"{team} win their own lineout, {Where(e, e.Team.Value)}.";
                    break;
                case MatchEventType.LineoutStolen:
                    text = $"Stolen! {Name(e.PrimaryPlayerId)} picks off the throw for {team}.";
                    break;
                case MatchEventType.MaulDrive:
                    text = $"The {team} maul rumbles on for {D(e, "metres"):0} metres.";
                    break;
                case MatchEventType.MaulCollapsed:
                    text = $"{Name(e.PrimaryPlayerId)} pulls the maul down. Penalty.";
                    break;
                case MatchEventType.ScrumWon:
                    text = $"{team} win the scrum, {Name(e.PrimaryPlayerId)} at the base.";
                    break;
                case MatchEventType.ScrumPenalty:
                    text = $"The {team} scrum goes backwards and {Name(e.PrimaryPlayerId)} is penalised.";
                    break;
                case MatchEventType.PenaltyKickAtGoal:
                    text = $"{Name(e.PrimaryPlayerId)} kicks the penalty. Three points to {team}.";
                    break;
                case MatchEventType.PenaltyGoalMissed:
                    text = $"{Name(e.PrimaryPlayerId)} misses the penalty.";
                    break;
                case MatchEventType.PenaltyToCorner:
                    text = $"{team} kick for the corner.";
                    break;
                case MatchEventType.TryScored:
                    text = $"TRY! {Name(e.PrimaryPlayerId)} scores for {team}!";
                    break;
                case MatchEventType.ConversionScored:
                    text = $"{Name(e.PrimaryPlayerId)} adds the extras.";
                    break;
                case MatchEventType.ConversionMissed:
                    text = $"{Name(e.PrimaryPlayerId)} pushes the conversion wide.";
                    break;
                case MatchEventType.HalfTime:
                    text = "Half-time.";
                    break;
                case MatchEventType.FullTime:
                    text = "Full-time.";
                    break;
                default:
                    return null;
            }
            return $"{clock} {text,-78} {score}";
        }

        /// <summary>The numbers behind a breakdown, for a designer's debug view.</summary>
        public static string Debug(MatchEvent e)
        {
            if (!e.Data.ContainsKey("pSafe")) return null;
            return $"     d={e.Data["dominance"]:0.000}  P(safe)={e.Data["pSafe"]:0.000} P(offload)={e.Data["pOffload"]:0.000} " +
                   $"P(turnover)={e.Data["pTurnover"]:0.000} P(penalty)={e.Data["pPenalty"]:0.000}  roll={e.Data["roll"]:0.000}";
        }
    }
}
