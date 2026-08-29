// Probe: one money figure, one shape - and a per-week figure is a WAGE.
//
// Owner, after buying the Sugar Daddy (the £130m board injection): "sugar
// daddy money formatting goes weird after purchasing". The digits were never
// wrong; the SHAPES were, and buying board funding is exactly what sends a
// manager to the negotiating table where the worst of them lived.
//
// The game has two formatters and one rule that had never been written down:
//
//   fmtMoney  fees, balances, budgets, cash - "£130m", "£25k", "£4.0m"
//   fmtWage   anything per week - "£8.4k", because a wage rounded to the
//             nearest thousand loses the number the manager is negotiating
//
// Three faults, all of them visible on one card:
//
//   1. The personal-terms stepper printed the raw number - "£45,000" - one
//      row above a signing bonus reading "£25k". Comma-grouped pounds appear
//      nowhere else in the game.
//   2. Half the /wk figures went through fmtMoney, which rounds a wage to the
//      nearest thousand: the button said "£8.4k/wk" and the refusal it
//      produced said "£8k/wk" (ai.ts already carried that note about the
//      renewal path; the signing path never got the same fix).
//   3. fmtWage itself fell back to a comma'd "£5,380k" above £100k, which is
//      reachable the moment a wage ceiling passes a million - and the board
//      injections lift that ceiling by up to 80% each.
import { readFileSync } from 'node:fs'
import { readdirSync } from 'node:fs'
import { fmtMoney, fmtWage } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

console.log('--- 1. every figure either formatter can produce has one of the game\'s shapes\n')

// £-1.2m / £999 / £8.4k / £130m / £12bn - and never a comma
const SHAPE = /^-?£(\d+(\.\d)?bn|\d+(\.\d)?m|\d+(\.\d)?k|\d+)$/
const values = [
  0, 1, 499, 500, 999, 1_000, 1_500, 8_400, 45_000, 99_950, 100_000, 240_800,
  301_000, 576_000, 999_600, 1_000_000, 5_380_000, 10_000_000, 130_000_000,
  999_999_999, 1_000_000_000, 12_500_000_000, -8_400, -1_250_000,
]
const wrong: string[] = []
for (const v of values) {
  for (const [name, out] of [['fmtMoney', fmtMoney(v)], ['fmtWage', fmtWage(v)]] as const) {
    if (!SHAPE.test(out)) wrong.push(`${name}(${v}) -> ${out}`)
  }
}
ok(wrong.length === 0, `both formatters keep their shape across the whole ladder${wrong.length ? `: ${wrong.join(', ')}` : ''}`)

// the three that were actually wrong on the owner's screen
ok(fmtWage(45_000) === '£45k', `the stepper's £45,000 reads £45k (got ${fmtWage(45_000)})`)
ok(fmtWage(8_400) === '£8.4k', `a wage keeps the digit it is negotiated in (got ${fmtWage(8_400)})`)
ok(fmtWage(5_380_000) === '£5.4m', `a seven-figure ceiling reads in millions, not thousands (got ${fmtWage(5_380_000)})`)
ok(!fmtWage(5_380_000).includes(',') && !fmtMoney(5_380_000).includes(','),
  'no comma-grouped pounds anywhere')
ok(fmtWage(Infinity) === '-' , 'an uncapped ceiling is a dash, not "£Infinitybn"')

console.log('\n--- 2. no source prints money by hand\n')

// A raw `£${...}` in a template or `£{...}` in JSX is the fault above: it is
// how "£45,000" reached the card. The locale files hold prose and may quote a
// fixed sum ("£30 a head"); code may not.
const files: string[] = []
const walk = (dir: string) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue
    const full = `${dir}/${e.name}`
    if (e.isDirectory()) walk(full)
    else if (/\.tsx?$/.test(e.name)) files.push(full)
  }
}
walk('src')
const handmade: string[] = []
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  src.split('\n').forEach((line, i) => {
    if (line.trimStart().startsWith('*') || line.trimStart().startsWith('//')) return
    // model.ts IS the ladder - it is the one file allowed to build the strings
    if (f === 'src/game/model.ts') return
    // £ immediately followed by an interpolation is a hand-built figure
    if (/£\$\{|£\{/.test(line)) handmade.push(`${f}:${i + 1}  ${line.trim().slice(0, 90)}`)
  })
}
ok(handmade.length === 0,
  `no hand-built money strings in src${handmade.length ? `:\n        ${handmade.join('\n        ')}` : ''}`)

console.log('\n--- 3. a per-week figure goes through fmtWage\n')

const perWeek: string[] = []
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  src.split('\n').forEach((line, i) => {
    if (line.trimStart().startsWith('*') || line.trimStart().startsWith('//')) return
    // only a fmtMoney call that is ITSELF the per-week figure - a line may
    // carry a fee and a wage together, and the fee is money
    if (/fmtMoney\((?:[^()]|\([^()]*\))*\)\}?(?:\/wk|\{t\('common\.perWeek'\)|\$\{t\('common\.perWeek'\))/.test(line)) {
      perWeek.push(`${f}:${i + 1}  ${line.trim().slice(0, 90)}`)
    }
  })
}
ok(perWeek.length === 0,
  `every /wk figure is a wage${perWeek.length ? `:\n        ${perWeek.join('\n        ')}` : ''}`)

console.log(fails ? `\nMONEY FORMAT PROBE FAILED (${fails})` : '\nMONEY FORMAT PROBE PASSED: one ladder, two units, no commas')
process.exit(fails ? 1 : 0)
