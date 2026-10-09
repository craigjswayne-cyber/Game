// Voice pass tooling for src/locales/en.json (1.8.16 voice pass).
//
//   node scripts/tools/voicepatch.mjs dump <out.json>      every English string, flat: { "ns.key": value }
//   node scripts/tools/voicepatch.mjs protected <out.json> keys whose English is matched as text by a harness
//   node scripts/tools/voicepatch.mjs apply <patch.json> [--dry]
//
// A patch is { "ns.key": "new English" }, or "ns.key.one" / "ns.key.other" for
// a plural. It rewrites the value in place, line by line, so the file keeps its
// layout and the diff shows only the words that changed. It refuses an entry
// whose key does not exist, whose placeholders differ from the old text (every
// other language would then disagree with the English), or that carries an em
// dash or an emoji. The other languages are not touched: a rewrite here is a
// change of voice, not of meaning, and the translations still say the same thing.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const FILE = 'src/locales/en.json'
const [, , cmd, arg, flag] = process.argv

function flat() {
  const out = {}
  const walk = (o, p) => {
    for (const [k, v] of Object.entries(o)) {
      const path = p ? `${p}.${k}` : k
      if (typeof v === 'string') out[path] = v
      else if (v && typeof v === 'object') walk(v, path)
    }
  }
  walk(JSON.parse(readFileSync(FILE, 'utf8')), '')
  delete out['_meta.//']
  return out
}

const holes = (s) => [...s.matchAll(/\{[a-zA-Z0-9_]+\}/g)].map(m => m[0]).sort().join(' ')

if (cmd === 'dump') {
  writeFileSync(arg, JSON.stringify(flat(), null, 1))
  console.log(`dumped ${Object.keys(flat()).length} strings to ${arg}`)
} else if (cmd === 'protected') {
  writeFileSync(arg, JSON.stringify(protectedKeys(), null, 1))
  console.log(`${Object.keys(protectedKeys()).length} protected strings written to ${arg}`)
} else if (cmd === 'apply') {
  // the scan reads all of scripts/ and is slow; it is cached until --rescan
  const CACHE = 'node_modules/.cache/voicepatch-protected.json'
  let guard
  try { if (process.argv.includes('--rescan')) throw 0; guard = JSON.parse(readFileSync(CACHE, 'utf8')) }
  catch { guard = protectedKeys(); try { writeFileSync(CACHE, JSON.stringify(guard)) } catch { /* no cache dir */ } }
  const patch = JSON.parse(readFileSync(arg, 'utf8'))
  for (const k of Object.keys(patch)) if (k in guard && !process.argv.includes('--allow-protected')) { console.log(`REFUSED ${k}: a harness selects this text (pass --allow-protected after updating it)`); delete patch[k] }
  applyPatch(patch)
} else {
  console.log('usage: dump <out> | protected <out> | apply <patch> [--dry] [--allow-protected]')
}

function protectedKeys() {
  // the browser harnesses and probes select by visible text: any English value
  // that appears verbatim as a quoted literal under scripts/ is a selector
  const src = []
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n)
      if (statSync(p).isDirectory()) { if (n !== 'tools') walk(p) }
      else if (/\.(ts|mjs|js|cjs)$/.test(n)) src.push(readFileSync(p, 'utf8'))
    }
  }
  walk('scripts')
  const all = src.join('\n')
  const out = {}
  for (const [k, v] of Object.entries(flat())) {
    const bare = v.replace(/\{[a-zA-Z0-9_]+\}/g, '').trim()
    if (bare.length < 3) continue
    // literal quoted, or a regex/substring of a fixed head of the string
    const head = v.split('{')[0].trim()
    if (all.includes(`'${v}'`) || all.includes(`"${v}"`) || all.includes(`\`${v}\``) ||
        (head.length >= 6 && (all.includes(`'${head}`) || all.includes(`"${head}`) || all.includes(`/${head}`) || all.includes(`text=${head}`))))
      out[k] = v
  }
  return out
}

function applyPatch(patch) {
  const cur = flat()
  const lines = readFileSync(FILE, 'utf8').split('\n')
  // map each line to its key path
  const stack = []
  const where = {}
  lines.forEach((l, i) => {
    const open = l.match(/^\s*"((?:[^"\\]|\\.)*)": \{\s*$/)
    if (open) { stack.push(open[1]); return }
    if (/^\s*\},?\s*$/.test(l)) { stack.pop(); return }
    const inl = l.match(/^\s*"((?:[^"\\]|\\.)*)": (\{".*\})(,?)\s*$/)
    if (inl) { for (const sub of Object.keys(JSON.parse(inl[2]))) where[[...stack, inl[1], sub].join('.')] = i; return }
    const kv = l.match(/^(\s*)"((?:[^"\\]|\\.)*)": (".*")(,?)\s*$/)
    if (kv) where[[...stack, kv[2]].join('.')] = i
  })
  let applied = 0, refused = 0, same = 0
  for (const [k, v] of Object.entries(patch)) {
    const why = (s) => { refused++; console.log(`REFUSED ${k}: ${s}`) }
    if (typeof v !== 'string') { why('value is not a string'); continue }
    if (!(k in cur) || where[k] === undefined) { why('no such key'); continue }
    if (cur[k] === v) { same++; continue }
    if (holes(cur[k]) !== holes(v)) { why(`placeholders differ: [${holes(cur[k])}] -> [${holes(v)}]`); continue }
    if (/[—―]/.test(v)) { why('em dash'); continue }
    if (/\p{Extended_Pictographic}/u.test(v) && !/\p{Extended_Pictographic}/u.test(cur[k])) { why('emoji'); continue }
    if (/\s{2,}|^\s|\s$/.test(v) && !/\s{2,}|^\s|\s$/.test(cur[k])) { why('stray whitespace'); continue }
    const i = where[k]
    const im = lines[i].match(/^(\s*"(?:[^"\\]|\\.)*": )(\{".*\})(,?)\s*$/)
    if (im) {
      const o = JSON.parse(im[2]); o[k.split('.').pop()] = v
      lines[i] = im[1] + '{' + Object.entries(o).map(([a, b]) => `${JSON.stringify(a)}: ${JSON.stringify(b)}`).join(', ') + '}' + im[3]
    } else {
      const m = lines[i].match(/^(\s*"(?:[^"\\]|\\.)*": )(".*")(,?)\s*$/)
      lines[i] = m[1] + JSON.stringify(v) + m[3]
    }
    applied++
  }
  if (flag !== '--dry') writeFileSync(FILE, lines.join('\n'))
  // the file must still parse and say what the patch said
  if (flag !== '--dry') {
    const after = flat()
    for (const [k, v] of Object.entries(patch)) if (typeof v === 'string' && k in cur && after[k] !== v && holes(cur[k]) === holes(v)) console.log(`MISMATCH ${k}`)
  }
  console.log(`applied ${applied}, unchanged ${same}, refused ${refused}${flag === '--dry' ? ' (dry run)' : ''}`)
}
