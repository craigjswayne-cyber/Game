// The game's model, split by concern under model/ (types, players, clubs,
// competitions, the estate, the manager, the calendar, money, stored text).
// This file is the one path everything imports: it re-exports every name the
// single model.ts used to, so a caller never needs to know which file holds it.
export * from './model/types'
export * from './model/players'
export * from './model/competition'
export * from './model/club'
export * from './model/text'
export * from './model/facilities'
export * from './model/manager'
export * from './model/calendar'
export * from './model/money'
