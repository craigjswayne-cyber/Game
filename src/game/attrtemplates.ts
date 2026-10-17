// The positional templates and the pure per-player traits that the ageing
// and development modules read. They live in this leaf, below attributes.ts,
// so that ageing and devproject can use them without importing attributes
// back (attributes imports ageing); attributes.ts re-exports all of them.
import type { Pos } from '../data/types'
import type { Attrs, Player } from './model'
import { mulberry32 } from './rng'

// Positional attribute templates: importance weight 0..1 of each attribute
// for the position. Derived attribute = base from quality scaled by weight,
// plus noise, so a 90-rated prop has monster scrummaging but modest passing.

type T = Partial<Record<keyof Attrs, number>>

export const BASE: Record<keyof Attrs, number> = {
  tac: 0.55, str: 0.55, scr: 0.2, lin: 0.2, ruc: 0.5, han: 0.55, pas: 0.5,
  kic: 0.25, goa: 0.1, pac: 0.5, sta: 0.6, agi: 0.5, vis: 0.45, dec: 0.55,
  pos: 0.55, agg: 0.55, lea: 0.4, wor: 0.6,
}

export const TEMPLATES: Record<Pos, T> = {
  LP: { scr: 1, str: 1, ruc: 0.85, tac: 0.8, agg: 0.85, pac: 0.15, agi: 0.2, vis: 0.2, kic: 0.02, goa: 0, han: 0.4, pas: 0.3, lin: 0.35 },
  HK: { scr: 0.9, lin: 1, str: 0.95, ruc: 0.85, tac: 0.85, agg: 0.85, pac: 0.25, han: 0.5, pas: 0.35, kic: 0.02, goa: 0, vis: 0.3 },
  TP: { scr: 1, str: 1, ruc: 0.8, tac: 0.8, agg: 0.85, pac: 0.12, agi: 0.18, vis: 0.2, kic: 0.02, goa: 0, han: 0.35, pas: 0.28, lin: 0.35 },
  LK: { lin: 1, str: 0.95, scr: 0.8, ruc: 0.85, tac: 0.85, agg: 0.8, pac: 0.25, han: 0.5, pas: 0.35, kic: 0.03, goa: 0, vis: 0.3, lea: 0.6 },
  FL: { tac: 1, ruc: 1, str: 0.85, agg: 0.9, wor: 1, pac: 0.55, han: 0.6, pas: 0.45, lin: 0.6, scr: 0.5, kic: 0.05, goa: 0, vis: 0.4 },
  N8: { str: 0.95, ruc: 0.95, tac: 0.9, han: 0.75, pac: 0.6, agg: 0.9, lin: 0.6, scr: 0.5, pas: 0.5, kic: 0.08, goa: 0, vis: 0.5 },
  SH: { pas: 1, vis: 0.9, dec: 0.9, kic: 0.75, agi: 0.85, pac: 0.7, han: 0.85, tac: 0.5, str: 0.3, ruc: 0.35, scr: 0.05, lin: 0.05, goa: 0.15 },
  FH: { kic: 1, vis: 1, dec: 1, pas: 0.95, han: 0.85, goa: 0.6, agi: 0.7, pac: 0.6, tac: 0.45, str: 0.3, ruc: 0.25, scr: 0.02, lin: 0.02 },
  CE: { han: 0.85, tac: 0.85, str: 0.75, pac: 0.8, agi: 0.75, vis: 0.7, pas: 0.75, dec: 0.75, kic: 0.4, goa: 0.1, ruc: 0.55, scr: 0.03, lin: 0.05 },
  WG: { pac: 1, agi: 0.95, han: 0.8, tac: 0.55, pos: 0.7, str: 0.55, vis: 0.5, pas: 0.5, kic: 0.35, goa: 0.05, ruc: 0.4, scr: 0.02, lin: 0.05 },
  FB: { pos: 1, kic: 0.85, han: 0.85, pac: 0.85, agi: 0.8, tac: 0.7, dec: 0.8, vis: 0.7, pas: 0.65, goa: 0.3, str: 0.5, ruc: 0.35, scr: 0.02, lin: 0.03 },
}

/** How much a position leans on an attribute (0-1): the weight deriveAttrs
 *  builds it with, and the share of a rating change the summer passes to it. */
export function attrWeight(pos: Pos, k: keyof Attrs): number {
  const t = TEMPLATES[pos]
  return t[k] !== undefined ? t[k]! : BASE[k]
}

/**
 * THE LATE BLOOMER (25D, from the FM blueprint the user loves: "the random
 * kinda who become high value and legends"). About one player in twelve keeps
 * developing past the age everyone else plateaus - the fast lane runs to 25
 * instead of 23 and growth stays alive to 29 instead of 27 (rollover's
 * agePlayers reads this).
 *
 * A pure function of (world seed, player id), never stored: every save, every
 * screen and every future system that asks gets the same answer with no
 * migration, and there is nothing in the save file for a curious eye to find.
 * Hidden on purpose - FM's magic is that you find out the way a scout does,
 * by watching a 27-year-old refuse to stop improving.
 */
export function isLateBloomer(seed: number, id: number): boolean {
  return mulberry32((seed ^ Math.imul(id, 0x9E3779B1)) >>> 0)() < 0.085
}

/**
 * PROFESSIONALISM (1.8.0, E7, from the fm-arena thread: a professional keeps
 * working when he is not picked). The game has no hidden professionalism
 * number; what stands for it is the character the scouts already report -
 * Professional, and a Leader half as much - and the work rate on his sheet,
 * whose top half adds up to 0.4 more. 0 is a man who stops training properly
 * the week he is dropped, 1 a Professional with a work rate of 20.
 */
export function professionalism(p: Pick<Player, 'pers' | 'a'>): number {
  const pers = p.pers === 'Professional' ? 0.6 : p.pers === 'Leader' ? 0.3 : 0
  return Math.min(1, pers + Math.max(0, (p.a.wor ?? 10) - 10) / 10 * 0.4)
}

/** How much of the no-minutes penalty a man takes: 1 with no professionalism,
 *  0.5 at full (E7). Read by devFactor, the weekly morale drift and the
 *  player screen's development note, so all three say the same thing. */
export function benchDrag(p: Pick<Player, 'pers' | 'a'>): number {
  return 1 - 0.5 * professionalism(p)
}
