/**
 * starveprobe on 140 worlds (1,120 paired matches), with the one line that
 * needs that many judged: the Starve plan leaves the other side the fewest
 * tries of the plans. Owner's call, 1.9.15: the claim stays, measured on a
 * sample big enough to hold it. Release check only (suite.sh SLOW).
 *
 * Run: npx vite-node scripts/starvewide.ts
 */
process.env.STARVE_WORLDS ??= '140'
process.env.STARVE_FULL = '1'
await import('./starveprobe')
