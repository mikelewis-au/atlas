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

export interface Match {
  person: Person
  /** The piece of text that matched, when it was not the name itself. */
  snippet?: string
}

/**
 * Every word of the query must appear somewhere in what is known about a
 * person, including the names of the people they are linked to, so a
 * half-remembered detail ("footy twins") or a child's name finds them.
 */
export function searchMatches(query: string, data: SearchData): Match[] {
  const words = fold(query).split(/\s+/).filter(Boolean).map(singular)
  if (words.length === 0) return []
  const names = new Map(data.people.map((person) => [person.id, person.name]))

  // The name comes first so a snippet is only shown for a match found elsewhere.
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

  const matches: Match[] = []
  for (const person of data.people) {
    const pieces = haystacks.get(person.id)!
    const folded = pieces.map(fold)
    if (!words.every((word) => folded.some((piece) => piece.includes(word)))) continue
    const index = folded.findIndex((piece, i) => i > 0 && words.some((word) => piece.includes(word)))
    const snippet =
      folded[0].includes(words[0]) || index < 0 ? undefined : excerpt(pieces[index], folded[index], words)
    matches.push({ person, snippet })
  }
  return matches.sort((a, b) => a.person.name.localeCompare(b.person.name))
}

export function searchPeople(query: string, data: SearchData): Person[] {
  return searchMatches(query, data).map((match) => match.person)
}

const EXCERPT_LENGTH = 80

/** The text around the first matching word, cut at word boundaries to fit two short lines. */
function excerpt(original: string, folded: string, words: string[]): string {
  if (original.length <= EXCERPT_LENGTH) return original.replace(/\s+/g, ' ').trim()
  // Folding never changes the length of a character, so indexes line up with the original.
  const at = Math.min(...words.map((word) => folded.indexOf(word)).filter((i) => i >= 0))
  let start = Math.max(0, Math.min(at - 25, original.length - EXCERPT_LENGTH))
  let end = Math.min(original.length, start + EXCERPT_LENGTH)
  if (start > 0) start = original.indexOf(' ', start) + 1 || start
  if (end < original.length) end = original.lastIndexOf(' ', end) || end
  const piece = original.slice(start, end).replace(/\s+/g, ' ').trim()
  return `${start > 0 ? '…' : ''}${piece}${end < original.length ? '…' : ''}`
}

/** So "twins" finds a note that says "twin girls". */
function singular(word: string): string {
  return word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word
}

/** Lower-cased with accents stripped, so "zoe" finds Zoë and "Zoë" finds zoe. */
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}
