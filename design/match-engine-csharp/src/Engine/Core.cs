using System;

namespace Rugby.Engine
{
    /// <summary>
    /// Deterministic PRNG (xoshiro128**, seeded through SplitMix64).
    /// System.Random is not used: its algorithm is not guaranteed to be the same
    /// across .NET runtimes or Unity's Mono, and a match must replay bit for bit
    /// from (seed, inputs) on every device, for saves, replays and multiplayer.
    /// </summary>
    public sealed class DeterministicRng
    {
        private uint _s0, _s1, _s2, _s3;

        public DeterministicRng(ulong seed)
        {
            ulong x = seed;
            _s0 = (uint)SplitMix(ref x); _s1 = (uint)SplitMix(ref x);
            _s2 = (uint)SplitMix(ref x); _s3 = (uint)SplitMix(ref x);
            if ((_s0 | _s1 | _s2 | _s3) == 0) _s0 = 1;
        }

        private static ulong SplitMix(ref ulong x)
        {
            ulong z = x += 0x9E3779B97F4A7C15UL;
            z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9UL;
            z = (z ^ (z >> 27)) * 0x94D049BB133111EBUL;
            return z ^ (z >> 31);
        }

        private static uint Rotl(uint v, int k) => (v << k) | (v >> (32 - k));

        public uint NextUInt()
        {
            uint result = Rotl(_s1 * 5, 7) * 9;
            uint t = _s1 << 9;
            _s2 ^= _s0; _s3 ^= _s1; _s1 ^= _s2; _s0 ^= _s3;
            _s2 ^= t;
            _s3 = Rotl(_s3, 11);
            return result;
        }

        /// <summary>Uniform double in [0, 1), 32 bits of resolution.</summary>
        public double NextDouble() => NextUInt() * (1.0 / 4294967296.0);

        public double Range(double min, double max) => min + (max - min) * NextDouble();

        public int Range(int minInclusive, int maxExclusive) =>
            minInclusive + (int)(NextDouble() * (maxExclusive - minInclusive));

        /// <summary>Approximately normal noise (Irwin-Hall, 4 draws): cheap, bounded to +-2 sd, deterministic.</summary>
        public double Gaussian(double mean, double sd)
        {
            double sum = NextDouble() + NextDouble() + NextDouble() + NextDouble();
            return mean + (sum - 2.0) * 1.7320508 * sd; // variance of the sum is 4/12
        }

        /// <summary>Picks an index from non-negative weights. Returns -1 if every weight is zero.</summary>
        public int PickWeighted(double[] weights)
        {
            double total = 0;
            for (int i = 0; i < weights.Length; i++) total += Math.Max(0, weights[i]);
            if (total <= 0) return -1;
            double roll = NextDouble() * total;
            for (int i = 0; i < weights.Length; i++)
            {
                roll -= Math.Max(0, weights[i]);
                if (roll < 0) return i;
            }
            return weights.Length - 1;
        }
    }

    /// <summary>
    /// A point on the pitch in normalised metres: X runs 0..100 from the HOME try line
    /// to the AWAY try line, Y runs 0..70 from one touchline to the other. The in-goal
    /// areas are outside this box (X below 0 or above 100) and are never occupied in play.
    /// </summary>
    public struct Vec2
    {
        public const double PitchLength = 100.0;
        public const double PitchWidth = 70.0;

        public double X;
        public double Y;

        public Vec2(double x, double y) { X = x; Y = y; }

        public static Vec2 operator +(Vec2 a, Vec2 b) => new Vec2(a.X + b.X, a.Y + b.Y);
        public static Vec2 operator -(Vec2 a, Vec2 b) => new Vec2(a.X - b.X, a.Y - b.Y);
        public static Vec2 operator *(Vec2 a, double k) => new Vec2(a.X * k, a.Y * k);

        public double Length => Math.Sqrt(X * X + Y * Y);

        public Vec2 ClampToField() =>
            new Vec2(Math.Max(0, Math.Min(PitchLength, X)), Math.Max(0, Math.Min(PitchWidth, Y)));

        public override string ToString() => $"({X:0.0}, {Y:0.0})";
    }

    public static class MathX
    {
        public static double Clamp(double v, double lo, double hi) => v < lo ? lo : v > hi ? hi : v;

        /// <summary>Standard logistic: 0.5 at x = 0, steepness k.</summary>
        public static double Logistic(double x, double k = 1.0) => 1.0 / (1.0 + Math.Exp(-k * x));

        /// <summary>Maps a 1..20 attribute to 0..1.</summary>
        public static double Norm20(int attribute) => Clamp((attribute - 1) / 19.0, 0, 1);
    }
}
