// Release communications, generated from ONE file per release.
//
// docs/releases/<version>.md holds the approved words in six languages. Every
// output below is derived from it and adds nothing: no claim reaches the
// website, Discord or social that is not in the release file.
//
//   node scripts/launch/release.mjs check <version>      validate; store text <= 500 chars
//   node scripts/launch/release.mjs store <version>      Play/App Store "What's new", per language
//   node scripts/launch/release.mjs discord <version>    Discord webhook JSON (stdout)
//   node scripts/launch/release.mjs social <version>     ready-to-paste post (stdout)
//   node scripts/launch/release.mjs changelog <out.html> the website changelog, every release
//
// Used by .github/workflows/release.yml (Discord) and pages.yml (changelog).
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'

const DIR = 'docs/releases'
const LANGS = ['en', 'fr', 'es', 'it', 'ja', 'af']
const PLAY = 'https://play.google.com/store/apps/details?id=com.phaserugbymanager.app'
const SITE = 'https://phaserugbymanager.com'
const LABELS = {
  en: ["What's new", 'Fixes'], fr: ['Nouveautés', 'Corrections'], es: ['Novedades', 'Correcciones'],
  it: ['Novità', 'Correzioni'], ja: ['新機能', '修正'], af: ['Nuut', 'Regstellings'],
}

export function parse(version) {
  const file = `${DIR}/${version}.md`
  if (!existsSync(file)) throw new Error(`no release file ${file}`)
  const src = readFileSync(file, 'utf8')
  const fm = src.match(/^---\n([\s\S]*?)\n---/)
  if (!fm) throw new Error(`${file}: no front matter`)
  const meta = Object.fromEntries(fm[1].split('\n').map(l => l.split(/:\s*/)).map(([k, ...v]) => [k.trim(), v.join(': ').trim()]))
  if (meta.version !== version) throw new Error(`${file}: front matter says ${meta.version}`)
  const body = src.slice(fm[0].length).replace(/<!--[\s\S]*?-->/g, '')
  const langs = {}
  for (const block of body.split(/^## /m).slice(1)) {
    const lang = block.split('\n')[0].trim()
    const sec = (name) => {
      const m = block.match(new RegExp(`### ${name}\\n([\\s\\S]*?)(?=\\n### |$)`))
      return m ? m[1].split('\n').filter(l => /^- \S/.test(l)).map(l => l.slice(2).trim()) : []
    }
    langs[lang] = { news: sec("What's new"), fixes: sec('Fixes') }
  }
  return { meta, langs }
}

/** One paragraph, as the stores take it. */
const storeText = (l) => [...l.news, ...l.fixes].join(' ')

function check(version) {
  const { meta, langs } = parse(version)
  const errs = []
  for (const lang of LANGS) {
    const l = langs[lang]
    if (!l) { errs.push(`${lang}: missing`); continue }
    if (!l.news.length && !l.fixes.length) errs.push(`${lang}: empty`)
    const t = storeText(l)
    if (t.length > 500) errs.push(`${lang}: ${t.length} chars, Play allows 500`)
    if (/[—–]/.test(t)) errs.push(`${lang}: contains a dash the house style forbids`)
    if (/!/.test(t) && lang !== 'ja') errs.push(`${lang}: exclamation mark`)
  }
  if (!/^\d+$/.test(meta.play_version_code ?? '')) errs.push('play_version_code missing')
  return errs
}

function discord(version, date) {
  const { meta, langs } = parse(version)
  const en = langs.en
  const lines = [
    en.news.length ? `**What's new**\n${en.news.map(s => `• ${s}`).join('\n')}` : '',
    en.fixes.length ? `**Fixes**\n${en.fixes.map(s => `• ${s}`).join('\n')}` : '',
    `**Available now**\n[Google Play](${PLAY})`,
  ].filter(Boolean).join('\n\n')
  return {
    username: 'PHASE',
    embeds: [{
      title: `PHASE ${meta.version}`,
      description: lines,
      color: 0x34c06f,
      url: `${SITE}/changelog.html#v${meta.version}`,
      footer: { text: `PHASE: Rugby Manager · ${date || (meta.date !== 'pending' ? meta.date : 'out now')}` },
    }],
  }
}

function social(version) {
  const { meta, langs } = parse(version)
  const lead = langs.en.news.slice(0, 2).join(' ')
  return `PHASE ${meta.version} is out. ${lead}\n\nFull notes: ${SITE}/changelog.html#v${meta.version}`
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function changelog(out) {
  const versions = readdirSync(DIR).filter(f => /^\d+\.\d+\.\d+\.md$/.test(f)).map(f => f.slice(0, -3))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
  const items = versions.map(v => {
    const { meta, langs } = parse(v)
    const en = langs.en
    const list = (h, xs) => xs.length ? `<h3>${h}</h3><ul>${xs.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''
    return `<article id="v${v}"><h2>PHASE ${v}</h2><p class="when">${meta.date === 'pending' ? 'Rolling out' : esc(meta.date)}</p>${list("What's new", en.news)}${list('Fixes', en.fixes)}</article>`
  }).join('\n')
  const tpl = readFileSync('scripts/launch/changelog.template.html', 'utf8')
  writeFileSync(out, tpl.replace('<!-- RELEASES -->', items))
  return versions.length
}

const [cmd, arg, arg2] = process.argv.slice(2)
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    if (cmd === 'check') {
      const errs = check(arg)
      if (errs.length) { console.error(errs.map(e => `FAIL ${e}`).join('\n')); process.exit(1) }
      const { langs } = parse(arg)
      for (const l of LANGS) console.log(`  ok  ${l}: ${storeText(langs[l]).length} chars`)
    } else if (cmd === 'store') {
      const { langs } = parse(arg)
      for (const l of LANGS) console.log(`--- ${l} (${storeText(langs[l]).length})\n${storeText(langs[l])}\n`)
    } else if (cmd === 'discord') {
      console.log(JSON.stringify(discord(arg, arg2)))
    } else if (cmd === 'social') {
      console.log(social(arg))
    } else if (cmd === 'changelog') {
      console.log(`changelog: ${changelog(arg || 'landing/changelog.html')} releases`)
    } else {
      console.error('usage: release.mjs check|store|discord|social <version> | changelog <out>')
      process.exit(2)
    }
  } catch (e) {
    console.error(`FAIL ${e.message}`)
    process.exit(1)
  }
}
