import { describe, expect, it } from 'vitest'
import { newRecoveryKey, normaliseRecoveryKey } from './crypto'
import { ageLabel, parseBorn, todayIso } from './dates'
import { canEnd, household, linkExists, linkFor, relationsOf, roleOf } from './links'
import type { Fact, Link, MapEntry, Note, Person } from './model'
import { searchPeople } from './search'
import { inSide } from './space'

const base = { createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }

function person(id: string, name: string, extra: Partial<Person> = {}): Person {
  return { ...base, type: 'person', id, name, circle: true, tags: [], ...extra }
}

function link(id: string, fromId: string, toId: string, kind: Link['kind'], ended = false): Link {
  return { ...base, type: 'link', id, fromId, toId, kind, ended }
}

describe('dates', () => {
  const today = new Date(2026, 9, 5)

  it('formats today in local time', () => {
    expect(todayIso(today)).toBe('2026-10-05')
    expect(todayIso(new Date(2026, 0, 9))).toBe('2026-01-09')
  })

  it('gives an exact age from a full date, respecting the birthday', () => {
    expect(ageLabel('2019-10-05', today)).toBe('7')
    expect(ageLabel('2019-10-06', today)).toBe('6')
    expect(ageLabel('2019-03-01', today)).toBe('7')
  })

  it('marks a year-only age as approximate', () => {
    expect(ageLabel('2019', today)).toBe('~7')
  })

  it('gives no age when the birth is unknown or in the future', () => {
    expect(ageLabel(undefined, today)).toBeUndefined()
    expect(ageLabel('2030', today)).toBeUndefined()
    expect(ageLabel('2026-12-25', today)).toBeUndefined()
  })

  it('parses a year or a real date and rejects the rest', () => {
    expect(parseBorn(' 2018 ')).toBe('2018')
    expect(parseBorn('2018-05-31')).toBe('2018-05-31')
    expect(parseBorn('2018-02-30')).toBeUndefined()
    expect(parseBorn('31/05/2018')).toBeUndefined()
    expect(parseBorn('')).toBeUndefined()
  })
})

describe('recovery key', () => {
  it('is 32 characters in groups of four from an unambiguous alphabet', () => {
    expect(newRecoveryKey()).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){7}[0-9A-HJKMNP-TV-Z]{4}$/)
  })

  it('normalises case, spacing and look-alike letters', () => {
    expect(normaliseRecoveryKey('ab1o-il 9z')).toBe('AB1011' + '9Z')
  })
})

describe('links', () => {
  it('stores child and parent as one parent link seen from either side', () => {
    expect(linkFor('dave', 'mia', 'child')).toEqual({ fromId: 'dave', toId: 'mia', kind: 'parent' })
    expect(linkFor('mia', 'dave', 'parent')).toEqual({ fromId: 'dave', toId: 'mia', kind: 'parent' })
    const stored = link('l1', 'dave', 'mia', 'parent')
    expect(roleOf(stored, 'dave')).toBe('child')
    expect(roleOf(stored, 'mia')).toBe('parent')
  })

  it('reads an introduction from either side', () => {
    const stored = link('l1', ...(Object.values(linkFor('dave', 'sam', 'introducer')) as [
      string,
      string,
      Link['kind'],
    ]))
    expect(roleOf(stored, 'dave')).toBe('introducer')
    expect(roleOf(stored, 'sam')).toBe('introduced')
  })

  it('lists relations with the other person and a label', () => {
    const links = [
      link('l1', 'dave', 'sarah', 'partner'),
      link('l2', 'dave', 'mia', 'parent'),
      link('l3', 'priya', 'sam', 'friend'),
    ]
    expect(relationsOf(links, 'dave').map((r) => [r.otherId, r.label])).toEqual([
      ['sarah', 'Partner'],
      ['mia', 'Child'],
    ])
    expect(relationsOf(links, 'sarah').map((r) => [r.otherId, r.label])).toEqual([
      ['dave', 'Partner'],
    ])
    expect(relationsOf(links, 'mia')[0].label).toBe('Parent')
  })

  it('labels an ended link as former and drops it from the household', () => {
    const links = [
      link('l1', 'dave', 'sarah', 'partner', true),
      link('l2', 'dave', 'jo', 'partner'),
      link('l3', 'dave', 'mia', 'parent'),
      link('l4', 'dave', 'sam', 'friend'),
    ]
    const relations = relationsOf(links, 'dave')
    expect(relations[0].label).toBe('Former partner')
    expect(household(relations).map((r) => r.otherId)).toEqual(['jo', 'mia'])
  })

  it('only lets relationships that can end be ended', () => {
    expect(canEnd('partner')).toBe(true)
    expect(canEnd('colleague')).toBe(true)
    expect(canEnd('child')).toBe(false)
    expect(canEnd('sibling')).toBe(false)
  })

  it('detects a duplicate, in either direction for symmetric kinds only', () => {
    const links = [link('l1', 'dave', 'sarah', 'partner'), link('l2', 'dave', 'mia', 'parent')]
    expect(linkExists(links, { fromId: 'sarah', toId: 'dave', kind: 'partner' })).toBe(true)
    expect(linkExists(links, { fromId: 'dave', toId: 'mia', kind: 'parent' })).toBe(true)
    expect(linkExists(links, { fromId: 'mia', toId: 'dave', kind: 'parent' })).toBe(false)
    expect(linkExists(links, { fromId: 'dave', toId: 'sarah', kind: 'friend' })).toBe(false)
  })
})

describe('searchPeople', () => {
  const people = [
    person('dave', 'Dave Tester', { tags: ['footy'], howIKnow: 'Under 9s coach' }),
    person('priya', 'Priya Shah', { tags: ['work'] }),
    person('mia', 'Mia', { circle: false }),
  ]
  const facts: Fact[] = [{ ...base, type: 'fact', id: 'f1', personId: 'dave', text: 'Has twin girls' }]
  const notes: Note[] = [
    {
      ...base,
      type: 'note',
      id: 'n1',
      personId: 'priya',
      date: '2026-08-01',
      text: 'Training for a trail marathon',
      sensitive: false,
    },
  ]
  const mapEntries: MapEntry[] = [
    {
      ...base,
      type: 'mapEntry',
      id: 'm1',
      personId: 'priya',
      section: 'hopes',
      text: 'Wants to open a bakery',
      date: '2026-08-01',
      status: 'current',
      sensitive: false,
    },
  ]
  const data = { people, links: [link('l1', 'dave', 'mia', 'parent')], facts, notes, mapEntries }
  const names = (query: string) => searchPeople(query, data).map((p) => p.name)

  it('returns nothing for an empty query', () => {
    expect(names('   ')).toEqual([])
  })

  it('matches name, tag and how-I-know, ignoring case', () => {
    expect(names('PRIYA')).toEqual(['Priya Shah'])
    expect(names('work')).toEqual(['Priya Shah'])
    expect(names('coach')).toEqual(['Dave Tester'])
  })

  it('finds a person from fragments spread across tags and facts', () => {
    expect(names('footy twins')).toEqual(['Dave Tester'])
    expect(names('footy marathon')).toEqual([])
  })

  it('searches notes and map entries', () => {
    expect(names('trail')).toEqual(['Priya Shah'])
    expect(names('bakery')).toEqual(['Priya Shah'])
  })

  it('finds a parent by their child\'s name, and the child too', () => {
    expect(names('mia')).toEqual(['Dave Tester', 'Mia'])
  })
})

describe('inSide', () => {
  it('treats a person with no space as personal', () => {
    expect(inSide(person('a', 'A'), 'personal')).toBe(true)
    expect(inSide(person('a', 'A'), 'work')).toBe(false)
  })

  it('puts work people on the work side only', () => {
    expect(inSide(person('a', 'A', { space: 'work' }), 'work')).toBe(true)
    expect(inSide(person('a', 'A', { space: 'work' }), 'personal')).toBe(false)
  })

  it('puts people marked both on each side', () => {
    expect(inSide(person('a', 'A', { space: 'both' }), 'work')).toBe(true)
    expect(inSide(person('a', 'A', { space: 'both' }), 'personal')).toBe(true)
  })
})
