using System;

namespace Rugby.Engine
{
    public enum DefensiveSystem { Drift, Standard, RushDefence }
    public enum KickingStrategy { KeepInHand, Balanced, KickForTerritory }
    public enum AttackShape { TightForwards, Balanced, PlayWide }
    public enum BreakdownIntent { SafePossession, Balanced, FastBall }

    /// <summary>What the manager sets. Pure data: the engine reads it through TacticalModifiers.</summary>
    public sealed class TeamTactics
    {
        public DefensiveSystem Defence = DefensiveSystem.Standard;
        public KickingStrategy Kicking = KickingStrategy.Balanced;
        public AttackShape Attack = AttackShape.Balanced;
        public BreakdownIntent Breakdown = BreakdownIntent.Balanced;

        /// <summary>0..1: how many bodies go into the team's own rucks (0.5 = two or three).</summary>
        public double RuckCommitment = 0.5;
    }

    /// <summary>
    /// Every number a tactic changes, in one place, so balance is tuned here and
    /// nowhere else. All multipliers are 1.0 at the Balanced/Standard setting, which
    /// is what makes "no tactic chosen" exactly the base engine.
    /// </summary>
    public readonly struct TacticalModifiers
    {
        // ---- when this team is ATTACKING ----
        public readonly double OffloadRate;        // offload attempts in the tackle
        public readonly double RuckSpeed;          // speed of ball from the ruck (higher = quicker)
        public readonly double TurnoverExposure;   // how exposed the ball is at our ruck
        public readonly double CarryGain;          // metres per carry
        public readonly double KickChance;         // chance a phase ends in a kick
        public readonly double LineBreakChance;    // chance a strong carry becomes a clean break
        public readonly double AttackWidthSpread;  // how wide the attacking line stands (x the base spacing)

        // ---- when this team is DEFENDING ----
        public readonly double TackleDominance;    // added to the tackler's contest score
        public readonly double JackalThreat;       // pressure on the opposition's ruck
        public readonly double PenaltyRisk;        // offside / not rolling away
        public readonly double LineBreakConceded;  // chance a strong carry beats the line
        public readonly double DefenceLineDepth;   // metres off the gain line (smaller = further up)
        public readonly double DefenceWidthSpread; // how wide the defensive line stands

        private TacticalModifiers(
            double offloadRate, double ruckSpeed, double turnoverExposure, double carryGain, double kickChance,
            double lineBreakChance, double attackWidthSpread, double tackleDominance, double jackalThreat,
            double penaltyRisk, double lineBreakConceded, double defenceLineDepth, double defenceWidthSpread)
        {
            OffloadRate = offloadRate; RuckSpeed = ruckSpeed; TurnoverExposure = turnoverExposure;
            CarryGain = carryGain; KickChance = kickChance; LineBreakChance = lineBreakChance;
            AttackWidthSpread = attackWidthSpread; TackleDominance = tackleDominance; JackalThreat = jackalThreat;
            PenaltyRisk = penaltyRisk; LineBreakConceded = lineBreakConceded; DefenceLineDepth = defenceLineDepth;
            DefenceWidthSpread = defenceWidthSpread;
        }

        public static TacticalModifiers From(TeamTactics t)
        {
            double offload = 1, ruckSpeed = 1, exposure = 1, gain = 1, kick = 1, lineBreak = 1, attWidth = 1;
            double dominance = 0, jackal = 1, penalty = 1, breakConceded = 1, depth = 7.0, defWidth = 1;

            switch (t.Attack)
            {
                case AttackShape.PlayWide:
                    // more offloads and breaks out wide; each carry is a lighter body, so less go-forward
                    offload *= 1.30; lineBreak *= 1.25; gain *= 0.92; attWidth = 1.35; exposure *= 1.10; break;
                case AttackShape.TightForwards:
                    offload *= 0.70; lineBreak *= 0.80; gain *= 1.12; attWidth = 0.70; exposure *= 0.90; break;
            }
            switch (t.Kicking)
            {
                case KickingStrategy.KickForTerritory: kick *= 2.2; break;
                case KickingStrategy.KeepInHand: kick *= 0.35; break;
            }
            switch (t.Breakdown)
            {
                case BreakdownIntent.FastBall:
                    // fewer bodies over the ball: quicker ball, a line break more likely, easier to steal
                    ruckSpeed *= 1.35; exposure *= 1.25; offload *= 1.15; lineBreak *= 1.10; break;
                case BreakdownIntent.SafePossession:
                    ruckSpeed *= 0.75; exposure *= 0.65; offload *= 0.70; lineBreak *= 0.90; break;
            }
            // extra ruck commitment on top of the intent: +-20% exposure across the 0..1 dial
            exposure *= 1.20 - 0.40 * MathX.Clamp(t.RuckCommitment, 0, 1);

            switch (t.Defence)
            {
                case DefensiveSystem.RushDefence:
                    // more dominant hits and pressure on the ball, more offside penalties, and a
                    // line break conceded is a clean one because nobody is behind the line
                    dominance = 0.35; jackal *= 1.15; penalty *= 1.40; breakConceded *= 1.30; depth = 3.0; defWidth = 0.90; break;
                case DefensiveSystem.Drift:
                    dominance = -0.20; jackal *= 0.90; penalty *= 0.75; breakConceded *= 0.85; depth = 9.0; defWidth = 1.20; break;
            }

            return new TacticalModifiers(offload, ruckSpeed, exposure, gain, kick, lineBreak, attWidth,
                dominance, jackal, penalty, breakConceded, depth, defWidth);
        }
    }

    /// <summary>
    /// Where tactics put the fifteen players. The engine recomputes these targets every
    /// phase from the ball's position; the presentation layer tweens the dots towards
    /// them, so the engine never deals in animation.
    /// </summary>
    public static class Formation
    {
        // Attacking alignment relative to the ruck, per shirt: (metres behind the ball, lateral lane).
        // Lanes are multiples of the base spacing and are mirrored to the open side.
        private static readonly (double back, double lane)[] AttackSlots =
        {
            (0.0, -0.3), (0.5, 0.0), (0.0, 0.3),      // front row, bound over the ball
            (1.5, -0.5), (1.5, 0.5),                  // locks
            (3.0, 1.0), (3.0, 2.0), (2.0, -1.0),      // back row: pods off the ruck
            (1.0, 0.0),                               // 9 at the base
            (6.0, 1.5), (5.0, 5.5), (7.0, 2.5),       // 10, 11, 12
            (8.0, 3.5), (6.0, -3.0), (15.0, 2.0),     // 13, 14, 15
        };

        /// <summary>Target positions for an attacking team, with the ruck at `ball`.</summary>
        public static Vec2[] Attacking(Team team, Vec2 ball, in TacticalModifiers mods)
        {
            const double baseSpacing = 6.0;
            // the open side is the wider half of the field
            int open = ball.Y < Vec2.PitchWidth / 2 ? 1 : -1;
            var result = new Vec2[15];
            for (int i = 0; i < 15; i++)
            {
                var (back, lane) = AttackSlots[i];
                double x = ball.X - team.AttackDirection * back * (i >= 9 ? 1.0 : 0.6);
                double y = ball.Y + open * lane * baseSpacing * mods.AttackWidthSpread;
                result[i] = new Vec2(x, y).ClampToField();
            }
            return result;
        }

        /// <summary>
        /// Target positions for a defending team: a flat line `DefenceLineDepth` metres in
        /// front of their own side of the ruck, spread by `DefenceWidthSpread`, with the
        /// full-back and one wing held deep for the kick.
        /// </summary>
        public static Vec2[] Defending(Team team, Vec2 ball, in TacticalModifiers mods)
        {
            var result = new Vec2[15];
            // the defending team faces the opposite way: its "back" is towards its own try line
            double lineX = ball.X - team.AttackDirection * (-mods.DefenceLineDepth * 0.35 + 0.8);
            double spacing = 4.6 * mods.DefenceWidthSpread;
            // thirteen in the line, fanned out from the ruck to both touchlines
            int k = 0;
            for (int i = 0; i < 15; i++)
            {
                if (i == 14 || i == 10) continue; // full-back and a wing sweep
                int rank = (k + 1) / 2 * ((k % 2 == 0) ? 1 : -1);
                result[i] = new Vec2(lineX, ball.Y + rank * spacing).ClampToField();
                k++;
            }
            double deep = ball.X - team.AttackDirection * 22.0;
            result[14] = new Vec2(deep, Vec2.PitchWidth / 2).ClampToField();
            result[10] = new Vec2(deep + team.AttackDirection * 6.0, ball.Y < 35 ? 55 : 15).ClampToField();
            return result;
        }
    }
}
