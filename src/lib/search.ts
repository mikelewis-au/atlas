import { relationsOf } from './links'
import type { Child, Fact, Link, MapEntry, Note, Person } from './model'

export interface SearchData {
  people: Person[]
  links: Link[]
  children: Child[]
  facts: Fact[]
  notes: Note[]
  mapEntries: MapEntry[]
}

/**
 * Every word of the query must appear somewhere in what is known about a
 * person, including the names of the people they are linked to, so a
 * half-remembered detail ("footy twins") or a child's name finds them.
 */
export function searchPeople(query: string, data: SearchData): Person[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const names = new Map(data.people.map((person) => [person.id, person.name]))

  const haystacks = new Map<string, string[]>()
  for (const person of data.people) {
    haystacks.set(person.id, [person.name, person.howIKnow ?? '', ...person.tags])
  }
  for (const item of [...data.facts, ...data.notes, ...data.mapEntries]) {
    haystacks.get(item.personId)?.push(item.text)
  }
  for (const child of data.children) {
    for (const parentId of child.parentIds) haystacks.get(parentId)?.push(child.name)
  }
  for (const person of data.people) {
    for (const relation of relationsOf(data.links, person.id)) {
      haystacks.get(person.id)?.push(names.get(relation.otherId) ?? '')
    }
  }

  return data.people
    .filter((person) => {
      const haystack = haystacks.get(person.id)!.join('\n').toLowerCase()
      return words.every((word) => haystack.includes(singular(word)))
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** So "twins" finds a note that says "twin girls". */
function singular(word: string): string {
  return word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word
}
