import type { Note, Person } from './model'
import { type Side, inSide } from './space'
import type { Vault } from './vault'

export function notesFor(vault: Vault, personId: string): Note[] {
  return vault
    .all('note')
    .filter((note) => note.personId === personId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
}

/** People in the circle on one side, most recently touched first (edited, or a note added or changed). */
export function recentPeople(vault: Vault, limit: number, side: Side): Person[] {
  const lastTouched = new Map<string, string>()
  for (const person of vault.all('person')) lastTouched.set(person.id, person.updatedAt)
  for (const note of vault.all('note')) {
    const current = lastTouched.get(note.personId)
    if (current && note.updatedAt > current) lastTouched.set(note.personId, note.updatedAt)
  }
  return vault
    .all('person')
    .filter((person) => person.circle && inSide(person, side))
    .sort((a, b) => lastTouched.get(b.id)!.localeCompare(lastTouched.get(a.id)!))
    .slice(0, limit)
}

/** Removes the person, their links, and everything recorded against them. */
export async function deletePerson(vault: Vault, personId: string): Promise<void> {
  for (const link of vault.all('link')) {
    if (link.fromId === personId || link.toId === personId) await vault.remove(link.id)
  }
  for (const type of ['note', 'fact', 'loop', 'mapEntry', 'question'] as const) {
    for (const record of vault.all(type)) {
      if (record.personId === personId) await vault.remove(record.id)
    }
  }
  await vault.remove(personId)
}
