// ONE COUNTER, ONE VERDICT (1.9.2): the codemod that moved the probes onto
// scripts/lib/probe.
//
// About 360 probes each defined their own `let fails = 0` and `const ok = ...`
// and printed their own verdict. This rewrites the ones whose helper is the
// standard shape, so the printed lines and the exit code stay exactly what
// they were:
//
//   - `let fails = 0` and an `ok` that prints `${c ? '  ok  ' : 'FAIL  '}${what}`
//     (through console.log, or a `say` that is console.log or writeSync(1, ..))
//     and counts nothing else are replaced by an import of ok from lib/probe;
//   - a verdict that is the last thing in the file, of the form
//       console.log(fails ? `\nNAME FAILED (${fails})` : '\nNAME PASSED: what')
//       process.exit(fails ? 1 : 0)        (or `if (fails) process.exit(1)`,
//                                           or a browser harness's done(fails))
//     becomes done('NAME', 'what'), with { exit: true } where it exited at once;
//   - any other read of `fails` becomes failures().
//
// A probe that counts failures anywhere else (a second helper, a `bad()`,
// `fails += n`), prints its assertions differently, or shadows the names is
// left alone and listed, because converting it would change what it says.
//
//   node scripts/tools/probemod.mjs             # list what would change
//   node scripts/tools/probemod.mjs --write     # rewrite the files
//   node scripts/tools/probemod.mjs --list-left # the ones left alone, and why
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import ts from 'typescript'

const ROOT = new URL('../..', import.meta.url).pathname
const WRITE = process.argv.includes('--write')
const LIST_LEFT = process.argv.includes('--list-left')

function walk(dir) {
  const out = []
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e.startsWith('.') || e === 'lib' || e === 'tools') continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.(ts|mjs)$/.test(e)) out.push(p)
  }
  return out
}

const ID = String.raw`[A-Za-z_]\w*`
const TYPE = String.raw`(?:\s*:\s*(?:boolean|string|unknown|any))?`
// the one printed shape probe.ok prints
const okHelper = (printer) => {
  const P = printer === 'console.log' ? String.raw`console\.log` : printer
  const heads = [
    String.raw`const ok = \((?<a>${ID})${TYPE}, (?<b>${ID})${TYPE}\)(?:\s*:\s*void)? => `,
    String.raw`function ok\((?<a>${ID})${TYPE}, (?<b>${ID})${TYPE}\)(?:\s*:\s*void)? `,
  ]
  const print = String.raw`${P}\(\`\$\{(?<pc>\w+) \? '  ok  ' : 'FAIL  '\}\$\{(?<pw>\w+)\}\`\);?`
  const count = String.raw`if \(!(?<cc>\w+)\) fails\+\+;?`
  return heads.flatMap(head => [
    new RegExp(String.raw`^${head}\{\s*${print}\s*${count}\s*\}$`),
    new RegExp(String.raw`^${head}\{\s*${count}\s*${print}\s*\}$`),
  ])
}

function convert(file) {
  const src = readFileSync(file, 'utf8')
  if (!/^let fails = 0;?$/m.test(src)) return { skip: null }
  const isTs = file.endsWith('.ts')
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, isTs ? ts.ScriptKind.TS : ts.ScriptKind.JS)
  const why = (w) => ({ skip: w })
  const stmts = sf.statements
  const text = (n) => src.slice(n.getStart(sf), n.end)

  // the counter
  const decl = stmts.find(s => ts.isVariableStatement(s) && /^let fails = 0;?$/.test(text(s)))
  if (!decl) return why('`let fails = 0` is not at the top level')

  // the say helper, if the ok prints through one
  let sayOk = false
  const sayStmt = stmts.find(s => ts.isVariableStatement(s) && /^const say = /.test(text(s)))
  if (sayStmt) {
    const t = text(sayStmt)
    sayOk = /^const say = (?:\(?s(?:: string)?\)?) => (?:writeSync\(1, s \+ '\\n'\)|console\.log\(s\))$/.test(t)
  }

  // the ok helper
  const okStmt = stmts.find(s =>
    (ts.isVariableStatement(s) && s.declarationList.declarations.some(d => ts.isIdentifier(d.name) && d.name.text === 'ok')) ||
    (ts.isFunctionDeclaration(s) && s.name?.text === 'ok'))
  if (!okStmt) return why('no top-level ok helper')
  const okText = text(okStmt).replace(/\s*\n\s*/g, ' ')
  let m = null
  for (const re of [...okHelper('console.log'), ...(sayOk ? okHelper('say') : [])]) {
    m = okText.match(re)
    if (m) break
  }
  if (!m) return why(`ok prints a different shape: ${okText.slice(0, 90)}`)
  {
    // print(cond, what) and the counter's cond must be the helper's own params
    const g = m.groups
    if (g.pc !== g.a || g.cc !== g.a || g.pw !== g.b || g.a === g.b) return why('ok helper mixes its parameters')
  }

  // ok's return value: probe.ok returns the condition where the local one
  // returned nothing, so only calls whose value is thrown away are safe
  let usedAsValue = false
  const calls = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'ok') {
      const p = n.parent
      const thrownAway = ts.isExpressionStatement(p) || ts.isVoidExpression(p)
        || (ts.isArrowFunction(p) && p.body === n && ts.isCallExpression(p.parent)
          && ts.isPropertyAccessExpression(p.parent.expression) && p.parent.expression.name.text === 'forEach')
      if (!thrownAway) usedAsValue = true
    } else if (ts.isIdentifier(n) && n.text === 'ok' && !ts.isCallExpression(n.parent)
      && !(n.parent && (ts.isVariableDeclaration(n.parent) || ts.isFunctionDeclaration(n.parent)) && n.parent.name === n)
      && !(ts.isPropertyAccessExpression(n.parent) && n.parent.name === n)
      && !(ts.isPropertyAssignment(n.parent) && n.parent.name === n)) {
      usedAsValue = true   // passed around as a function: leave it
    }
    ts.forEachChild(n, calls)
  }
  calls(sf)
  if (usedAsValue) return why('uses the value of ok() or passes ok around')
  // a nested ok or fails would be shadowed by, or shadow, the import
  if ((src.match(/\b(?:const|let|var|function) ok\b|\(ok[,)]|, ok\)/g) ?? []).length !== 1) return why('declares ok more than once')

  // names the import would clash with
  const topNames = new Map()
  for (const s of stmts) {
    if (ts.isVariableStatement(s)) for (const d of s.declarationList.declarations) {
      if (ts.isIdentifier(d.name)) topNames.set(d.name.text, s)
    }
    if ((ts.isFunctionDeclaration(s) || ts.isClassDeclaration(s)) && s.name) topNames.set(s.name.text, s)
    if (ts.isImportDeclaration(s) && s.importClause) {
      const ic = s.importClause
      if (ic.name) topNames.set(ic.name.text, s)
      if (ic.namedBindings && ts.isNamedImports(ic.namedBindings)) for (const el of ic.namedBindings.elements) topNames.set(el.name.text, s)
      if (ic.namedBindings && ts.isNamespaceImport(ic.namedBindings)) topNames.set(ic.namedBindings.name.text, s)
    }
  }
  if (topNames.has('failures')) return why('already has a `failures` binding')

  // every `fails`: declared once, written only by the helper
  const refs = []
  let bad = null
  const visit = (n) => {
    if (ts.isIdentifier(n) && n.text === 'fails') {
      const p = n.parent
      if ((ts.isVariableDeclaration(p) || ts.isParameter(p) || ts.isBindingElement(p)) && p.name === n) {
        if (p.parent?.parent !== decl) bad = bad ?? 'declares a second `fails`'
      } else if (ts.isPropertyAccessExpression(p) && p.name === n) {
        // x.fails is someone else's
      } else if (ts.isPropertyAssignment(p) && p.name === n) {
        // { fails: ... } is a key
      } else {
        const inHelper = n.pos >= okStmt.pos && n.end <= okStmt.end
        const write = (ts.isPostfixUnaryExpression(p) || ts.isPrefixUnaryExpression(p)) && (p.operator === ts.SyntaxKind.PlusPlusToken || p.operator === ts.SyntaxKind.MinusMinusToken)
          || (ts.isBinaryExpression(p) && p.left === n && p.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && p.operatorToken.kind <= ts.SyntaxKind.LastAssignment)
        if (write && !inHelper) bad = bad ?? 'counts failures outside ok (a second helper or fails += n)'
        if (!inHelper) refs.push(n)
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  if (bad) return why(bad)

  // the verdict: the last two top-level statements
  const last = stmts[stmts.length - 1]
  const prev = stmts[stmts.length - 2]
  let verdict = null
  const flat = (n) => text(n).replace(/;$/, '').replace(/\s*\n\s*/g, ' ')
  const NL = String.raw`(?<nl>\\n)?`
  let shape = null   // { printer, name, quote, pass, nl, exit, viaDone }
  if (last && prev) {
    const exitT = flat(last)
    // true: it left at once, so done() must too; false: it let the process drain
    const exits = {
      'process.exit(fails ? 1 : 0)': true,
      'process.exit(fails === 0 ? 0 : 1)': true,
      'process.exit(fails > 0 ? 1 : 0)': true,
      'done(fails)': true,
      'if (fails) process.exit(1)': false,
      'if (fails > 0) process.exit(1)': false,
      'process.exitCode = fails ? 1 : 0': false,
    }
    const pT = flat(prev)
    //   print(fails ? `\nNAME FAILED (${fails})` : '\nNAME PASSED: what')
    //   <exit>
    const pm = ts.isExpressionStatement(prev) && exitT in exits && (
      pT.match(new RegExp(String.raw`^(?<printer>console\.log|say)\((?:fails|fails > 0) \? \`${NL}(?<name>.+?) FAILED \(\$\{fails\}\)\` : (?<quote>['\`])(?<nl2>\\n)?(?<pass>.+?)\k<quote>\)$`))
      ?? pT.match(new RegExp(String.raw`^(?<printer>console\.log|say)\((?:fails === 0|!fails) \? (?<quote>['\`])(?<nl2>\\n)?(?<pass>.+?)\k<quote> : \`${NL}(?<name>.+?) FAILED \(\$\{fails\}\)\`\)$`)))
    if (pm) shape = { ...pm.groups, exit: exits[exitT], viaDone: exitT === 'done(fails)' }
    //   if (fails) { console.log(`\nNAME FAILED (${fails})`); process.exit(1) }
    //   console.log('\nNAME PASSED: what')
    const fm = !pm && ts.isIfStatement(prev) && ts.isExpressionStatement(last)
      && pT.match(new RegExp(String.raw`^if \((?:fails|fails > 0)\) \{ (?<printer>console\.log|say)\(\`${NL}(?<name>.+?) FAILED \(\$\{fails\}\)\`\);? process\.exit\(1\);? \}$`))
    const lm = fm && exitT.match(new RegExp(String.raw`^(?<printer>console\.log|say)\((?<quote>['\`])(?<nl2>\\n)?(?<pass>.+?)\k<quote>\)$`))
    if (fm && lm && fm.groups.printer === lm.groups.printer) shape = { ...fm.groups, ...lm.groups, exit: false, viaDone: false }
  }
  if (shape) {
    const { printer, name, quote, pass, nl, nl2, exit, viaDone } = shape
    const printerOk = printer === 'console.log' || (printer === 'say' && sayOk)
    // done(fails) must be lib/preview's, and must go
    const previewDone = viaDone ? stmts.find(s => ts.isImportDeclaration(s) && /lib\/preview\.mjs'$/.test(s.moduleSpecifier.getText(sf)) && /\bdone\b/.test(text(s))) : null
    const pre = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pmm = pass.match(new RegExp(`^${pre} PASSED(?:: (.*))?$`, 's'))
    // the name must be a plain string; a template name with ${} is left as it is
    const clean = pmm && !/[`'\\$]/.test(name) && !(pmm[1] ?? '').includes('fails')
    // both lines start the same way: a blank line before, or none
    const sameGap = Boolean(nl) === Boolean(nl2)
    // done is free to import: no other top-level binding of that name
    const doneFree = !topNames.has('done') || (previewDone && topNames.get('done') === previewDone)
    // and preview's done is used nowhere else
    const doneUses = (src.match(/\bdone\(/g) ?? []).length
    if (printerOk && clean && sameGap && doneFree && (!viaDone || (previewDone && doneUses === 1))) {
      const passed = pmm[1] === undefined ? '' : `${quote}${pmm[1]}${quote}`
      const opts = [exit && 'exit: true', !nl && 'blank: false'].filter(Boolean)
      const args = [`'${name}'`]
      if (passed || opts.length) args.push(passed || "''")
      if (opts.length) args.push(`{ ${opts.join(', ')} }`)
      verdict = { from: prev.getStart(sf), to: last.end, code: `done(${args.join(', ')})`, previewDone }
    }
  }

  // build the edit list, end to start
  const edits = []
  const lineSpan = (n) => {
    let a = n.getStart(sf)
    while (a > 0 && src[a - 1] !== '\n') a--
    let b = n.end
    while (b < src.length && src[b] !== '\n') b++
    return [a, Math.min(b + 1, src.length)]
  }
  for (const r of refs) {
    if (verdict && r.pos >= verdict.from && r.end <= verdict.to) continue
    const s = r.getStart(sf)
    const p = r.parent
    edits.push([s, r.end, ts.isShorthandPropertyAssignment(p) ? 'fails: failures()' : 'failures()'])
  }
  if (verdict) edits.push([verdict.from, verdict.to, verdict.code])
  // the helper and the counter go; say stays if anything else uses it
  edits.push([...lineSpan(okStmt), ''])
  edits.push([...lineSpan(decl), ''])

  const names = ['ok']
  if (verdict) names.push('done')
  const leftRefs = refs.filter(r => !(verdict && r.pos >= verdict.from && r.end <= verdict.to))
  if (leftRefs.length) names.push('failures')
  const rel = relative(dirname(file), join(ROOT, 'scripts/lib/probe')) .replace(/^(?!\.)/, './')
  const spec = isTs ? rel : `${rel}.mjs`
  const importLine = `import { ${names.join(', ')} } from '${spec}'\n`

  // drop `done` from the preview import when the verdict took it over
  if (verdict?.previewDone) {
    const imp = verdict.previewDone
    const t = text(imp)
    const nt = t.replace(/,\s*done\b|\bdone\s*,\s*/, '')
    if (nt === t) return why('could not take done out of the preview import')
    edits.push([imp.getStart(sf), imp.end, nt])
  }
  const imports = stmts.filter(ts.isImportDeclaration)
  const at = imports.length ? imports[imports.length - 1].end : lineSpan(decl)[0]
  edits.push([at, at, imports.length ? `\n${importLine.trimEnd()}` : importLine])

  edits.sort((x, y) => y[0] - x[0] || y[1] - x[1])
  let out = src
  for (const [a, b, s] of edits) out = out.slice(0, a) + s + out.slice(b)
  // the say helper, if nothing else uses it now
  if (sayStmt && sayOk && (out.match(/\bsay\b/g) ?? []).length === 1) {
    out = out.replace(/^const say = [^\n]*\n/m, '')
  }
  return { out, verdict: Boolean(verdict), names }
}

const files = walk(join(ROOT, 'scripts')).sort()
const done = [], left = []
for (const f of files) {
  const r = convert(f)
  const rel = relative(ROOT, f)
  if (r.skip === null) continue
  if (r.skip) { left.push(`${rel}: ${r.skip}`); continue }
  done.push(`${rel}${r.verdict ? '' : '  (helper only: the verdict is not the standard shape)'}`)
  if (WRITE) writeFileSync(f, r.out)
}
if (LIST_LEFT) console.log(left.join('\n'))
else console.log(done.join('\n'))
console.log(`\nconverted ${done.length} (${done.filter(d => !d.includes('helper only')).length} with done()), left alone ${left.length}`)
