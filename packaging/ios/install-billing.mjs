// Put the StoreKit bridge INTO THE XCODE TARGET, not merely into the folder.
//
// scaffold.sh copies PhaseBilling.swift, PhaseBilling.m, App-Bridging-Header.h
// and Products.storekit next to the app's other sources. Copying is not
// membership: an Xcode target compiles what project.pbxproj lists, and
// `cap add ios` generates that file from Capacitor's template, which knows
// nothing about these four. So the files sit in the folder, are never
// compiled, NSClassFromString("PhaseBilling") returns nil, and the game has no
// shop - with nothing anywhere to say why. The README has said "drag the four
// files into the App target" since the first shell, and that instruction is
// the single most expensive thing in this project to forget.
//
// It also sets SWIFT_OBJC_BRIDGING_HEADER, without which the CAP_PLUGIN macro
// in PhaseBilling.m has no Capacitor header to expand against and the target
// fails to build at all.
//
// Everything here is idempotent and keyed on names, so a re-scaffold or a
// re-sync can run it again safely. Run by scaffold.sh; also runnable alone:
//   node install-billing.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const PBX = 'ios/App/App.xcodeproj/project.pbxproj'
if (!existsSync(PBX)) { console.error(`no ${PBX}: run cap add ios first`); process.exit(1) }
let s = readFileSync(PBX, 'utf8')

if (s.includes('PhaseBilling.swift in Sources')) {
  console.log('    the billing files are already in the App target')
} else {
  // 24-character object ids, fixed rather than random so a second run over a
  // half-patched file cannot produce two entries for one file.
  const ID = {
    swiftRef: 'DEADBEEF0000000000000001', swiftBuild: 'DEADBEEF0000000000000011',
    mRef:     'DEADBEEF0000000000000002', mBuild:     'DEADBEEF0000000000000012',
    hdrRef:   'DEADBEEF0000000000000003',
    skRef:    'DEADBEEF0000000000000004', skBuild:    'DEADBEEF0000000000000014',
  }
  const add = (anchor, lines) => {
    if (!s.includes(anchor)) { console.error(`!! the project no longer contains ${anchor.trim()} - patch by hand`); process.exit(1) }
    s = s.replace(anchor, anchor + lines)
  }

  add('/* Begin PBXBuildFile section */\n',
    `\t\t${ID.swiftBuild} /* PhaseBilling.swift in Sources */ = {isa = PBXBuildFile; fileRef = ${ID.swiftRef} /* PhaseBilling.swift */; };\n` +
    `\t\t${ID.mBuild} /* PhaseBilling.m in Sources */ = {isa = PBXBuildFile; fileRef = ${ID.mRef} /* PhaseBilling.m */; };\n` +
    `\t\t${ID.skBuild} /* Products.storekit in Resources */ = {isa = PBXBuildFile; fileRef = ${ID.skRef} /* Products.storekit */; };\n`)

  add('/* Begin PBXFileReference section */\n',
    `\t\t${ID.swiftRef} /* PhaseBilling.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PhaseBilling.swift; sourceTree = "<group>"; };\n` +
    `\t\t${ID.mRef} /* PhaseBilling.m */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.c.objc; path = PhaseBilling.m; sourceTree = "<group>"; };\n` +
    `\t\t${ID.hdrRef} /* App-Bridging-Header.h */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.c.h; path = "App-Bridging-Header.h"; sourceTree = "<group>"; };\n` +
    `\t\t${ID.skRef} /* Products.storekit */ = {isa = PBXFileReference; lastKnownFileType = text; path = Products.storekit; sourceTree = "<group>"; };\n`)

  // the App group, so the four are visible in Xcode's navigator
  const group = s.match(/(\/\* App \*\/ = \{\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = \(\n)/)
  if (!group) { console.error('!! the App group is not where it was - patch by hand'); process.exit(1) }
  s = s.replace(group[1], group[1] +
    `\t\t\t\t${ID.swiftRef} /* PhaseBilling.swift */,\n` +
    `\t\t\t\t${ID.mRef} /* PhaseBilling.m */,\n` +
    `\t\t\t\t${ID.hdrRef} /* App-Bridging-Header.h */,\n` +
    `\t\t\t\t${ID.skRef} /* Products.storekit */,\n`)

  // Compile Sources: the two that must actually be built
  const src = s.match(/(isa = PBXSourcesBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = \(\n)/)
  if (!src) { console.error('!! no Sources build phase - patch by hand'); process.exit(1) }
  s = s.replace(src[1], src[1] +
    `\t\t\t\t${ID.swiftBuild} /* PhaseBilling.swift in Sources */,\n` +
    `\t\t\t\t${ID.mBuild} /* PhaseBilling.m in Sources */,\n`)

  // Copy Bundle Resources: the StoreKit configuration, so a device build can
  // find it. The bridging header is a compiler input and belongs in neither.
  const res = s.match(/(isa = PBXResourcesBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = \(\n)/)
  if (!res) { console.error('!! no Resources build phase - patch by hand'); process.exit(1) }
  s = s.replace(res[1], res[1] + `\t\t\t\t${ID.skBuild} /* Products.storekit in Resources */,\n`)

  console.log('    added PhaseBilling.swift, PhaseBilling.m and Products.storekit to the App target')
}

// the bridging header, in every build configuration that names the app bundle
if (s.includes('SWIFT_OBJC_BRIDGING_HEADER')) {
  console.log('    bridging header already set')
} else {
  const before = s
  s = s.replace(/(\n\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = com\.phaserugbymanager\.app;)/g,
    '$1\n\t\t\t\tSWIFT_OBJC_BRIDGING_HEADER = "App/App-Bridging-Header.h";')
  if (s === before) { console.error('!! could not find a build configuration to set the bridging header on'); process.exit(1) }
  const n = (s.match(/SWIFT_OBJC_BRIDGING_HEADER/g) ?? []).length
  console.log(`    set SWIFT_OBJC_BRIDGING_HEADER in ${n} build configuration${n === 1 ? '' : 's'}`)
}

writeFileSync(PBX, s)

// a project file that does not parse is worse than one that is missing a
// plugin, so check the shape before leaving
const check = readFileSync(PBX, 'utf8')
const opens = (check.match(/\{/g) ?? []).length
const closes = (check.match(/\}/g) ?? []).length
const parens = (check.match(/\(/g) ?? []).length - (check.match(/\)/g) ?? []).length
if (opens !== closes || parens !== 0) {
  console.error(`!! the project file no longer balances (${opens} { vs ${closes} }, ${parens} unclosed parens) - restore it with: npx cap add ios`)
  process.exit(1)
}
for (const need of ['PhaseBilling.swift in Sources', 'PhaseBilling.m in Sources', 'Products.storekit in Resources', 'SWIFT_OBJC_BRIDGING_HEADER']) {
  if (!check.includes(need)) { console.error(`!! ${need} did not take`); process.exit(1) }
}
console.log('    the App target now compiles the purchase bridge')
