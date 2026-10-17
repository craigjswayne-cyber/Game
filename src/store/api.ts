import type { StoreApi } from 'zustand'
import type { Store } from './types'

/** THE ONE STORE, HANDED DOWN RATHER than imported back.
 *
 *  The save queue and the week settle both need the live store, and the
 *  store's actions need them, so importing src/store.ts from here would be a
 *  cycle. src/store.ts binds the store once, straight after create(), and
 *  these modules ask for it when they run. Nothing calls them before then:
 *  every caller is an action, and no action runs until the store exists. */
let bound: StoreApi<Store> | null = null

export function bindStore(api: StoreApi<Store>): void { bound = api }

export function storeApi(): StoreApi<Store> {
  if (!bound) throw new Error('store used before bindStore')
  return bound
}
