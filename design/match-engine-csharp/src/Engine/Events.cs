using System.Collections.Generic;

namespace Rugby.Engine
{
    /// <summary>The phase the match is in. Each state has exactly one handler in MatchEngine.</summary>
    public enum MatchState
    {
        // set pieces
        KickOff, Scrum, Lineout,
        // open play
        AttackingPhase, KickingInPlay, LineBreak,
        // breakdown
        Ruck, Maul, Turnover,
        // stoppages
        Penalty, TryScored, Conversion,
        // clock
        HalfTime, FullTime,
    }

    public enum MatchEventType
    {
        KickOff, ScrumWon, ScrumPenalty, LineoutWon, LineoutStolen,
        Carry, Tackle, MissedTackle, Offload, LineBreak,
        RuckSecured, Turnover, MaulDrive, MaulCollapsed,
        KickInPlay, KickToTouch, KickCaught,
        PenaltyConceded, PenaltyKickAtGoal, PenaltyGoalMissed, PenaltyToCorner,
        TryScored, ConversionScored, ConversionMissed,
        HalfTime, FullTime,
    }

    /// <summary>
    /// What happened, as data. The engine never writes prose: the presentation layer
    /// turns these into commentary, animation and stats, in any language, at any speed.
    /// Immutable once emitted, so a UI thread can read the queue while the engine runs.
    /// </summary>
    public sealed class MatchEvent
    {
        public int Sequence { get; }          // strictly increasing, for ordering and replays
        public int Tick { get; }              // engine tick the event happened on
        public double MatchSeconds { get; }   // game clock
        public MatchEventType Type { get; }
        public MatchState StateBefore { get; }
        public MatchState StateAfter { get; }
        public TeamSide? Team { get; }        // the team the event is credited to
        public int? PrimaryPlayerId { get; }  // carrier, kicker, scorer, penalty offender
        public int? SecondaryPlayerId { get; }// tackler, receiver of an offload, jackal
        public Vec2 Ball { get; }
        public int HomeScore { get; }
        public int AwayScore { get; }
        /// <summary>
        /// Numbers the UI may show and designers need for tuning: metres gained, the
        /// probability of each outcome at the dice roll, the roll itself.
        /// </summary>
        public IReadOnlyDictionary<string, double> Data { get; }

        public int Minute => (int)(MatchSeconds / 60.0) + 1;

        public MatchEvent(int sequence, int tick, double matchSeconds, MatchEventType type,
            MatchState before, MatchState after, TeamSide? team, int? primary, int? secondary,
            Vec2 ball, int homeScore, int awayScore, IReadOnlyDictionary<string, double> data)
        {
            Sequence = sequence; Tick = tick; MatchSeconds = matchSeconds; Type = type;
            StateBefore = before; StateAfter = after; Team = team;
            PrimaryPlayerId = primary; SecondaryPlayerId = secondary; Ball = ball;
            HomeScore = homeScore; AwayScore = awayScore;
            Data = data ?? new Dictionary<string, double>();
        }
    }

    /// <summary>Single-producer queue the engine writes and the presentation layer drains.</summary>
    public sealed class MatchEventQueue
    {
        private readonly Queue<MatchEvent> _queue = new Queue<MatchEvent>();
        private readonly object _lock = new object();

        public void Enqueue(MatchEvent e) { lock (_lock) _queue.Enqueue(e); }

        public bool TryDequeue(out MatchEvent e)
        {
            lock (_lock)
            {
                if (_queue.Count > 0) { e = _queue.Dequeue(); return true; }
                e = null; return false;
            }
        }

        public int Count { get { lock (_lock) return _queue.Count; } }
    }
}
