import type { Person } from './model'

/** The home screen shows one side at a time; a person can belong to both. */
export type Side = 'personal' | 'work'

export const SIDES: Side[] = ['personal', 'work']

export const SIDE_LABELS: Record<Side, string> = { personal: 'Personal', work: 'Work' }

export function inSide(person: Person, side: Side): boolean {
  // People recorded before sides existed have no space and count as personal.
  const space = person.space ?? 'personal'
  return space === 'both' || space === side
}

const PREFERENCE_KEY = 'people.side'

export function loadSide(): Side {
  try {
    return localStorage.getItem(PREFERENCE_KEY) === 'work' ? 'work' : 'personal'
  } catch {
    return 'personal'
  }
}

export function saveSide(side: Side): void {
  try {
    localStorage.setItem(PREFERENCE_KEY, side)
  } catch {
    // Private browsing can refuse storage; the choice then lasts for this visit only.
  }
}
