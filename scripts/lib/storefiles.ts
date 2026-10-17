// The store's source files: the src/store.ts facade and everything under
// src/store/ it was split into (1.9.1). A probe that reads the store's source
// reads all of them, so a rule holds wherever the code it names now lives.
import { readdirSync, readFileSync } from 'node:fs'

export function storeFiles(): string[] {
  const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true })
    .flatMap(e => e.isDirectory() ? walk(`${d}/${e.name}`) : e.name.endsWith('.ts') ? [`${d}/${e.name}`] : [])
  return ['src/store.ts', ...walk('src/store').sort()]
}

/** Every store file's text, joined. */
export const storeSource = (): string => storeFiles().map(f => readFileSync(f, 'utf8')).join('\n')
