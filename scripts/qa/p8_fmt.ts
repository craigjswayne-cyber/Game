import { fmtMoney, fmtWage } from '../../src/game/model'
const vals = [0, -0, 0.5, 999.5, 999.4, -999.6, 1234.56, 999_600, 999_400, -999_600, 1_000_000, 9_999_999, 10_000_000, 999_600_000, 999_400_000, 1e9, 1e12, 1e15, NaN, Infinity, -Infinity, -1, -50, 49_999, 50_000, 149_500, 1_500, 99_950, 99_949]
for (const v of vals) console.log(String(v).padStart(14), ' fmtMoney:', fmtMoney(v).padEnd(14), ' fmtWage:', fmtWage(v))
