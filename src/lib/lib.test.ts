import { describe, expect, it } from 'vitest'
import { childLabel, childrenOf, parseChild } from './children'
import { newRecoveryKey, normaliseRecoveryKey } from './crypto'
import { ageLabel, parseBorn, todayIso, whenLabel } from './dates'
import { canEnd, household, linkExists, linkFor, relationsOf, roleOf } from './links'
import { mapHighlights } from './map'
import type { Child, Fact, Link, MapEntry, Note, OpenLoop, Person } from './model'
import { openLoops, questionsIn } from './people'
import { searchMatches, searchPeople } from './search'
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
  const children: Child[] = [
    { ...base, type: 'child', id: 'c1', parentIds: ['priya', 'dave'], name: 'Ollie' },
  ]
  const data = {
    people,
    links: [link('l1', 'dave', 'mia', 'parent')],
    children,
    facts,
    notes,
    mapEntries,
  }
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

  it('says what matched when it was not the name', () => {
    const snippets = (query: string) =>
      searchMatches(query, data).map((m) => [m.person.name, m.snippet])
    expect(snippets('priya')).toEqual([['Priya Shah', undefined]])
    expect(snippets('twins')).toEqual([['Dave Tester', 'Has twin girls']])
    expect(snippets('bakery')).toEqual([['Priya Shah', 'Wants to open a bakery']])
    expect(snippets('ollie')).toEqual([
      ['Dave Tester', 'Ollie'],
      ['Priya Shah', 'Ollie'],
    ])
  })

  it('trims a long snippet around the match', () => {
    const long = 'A '.repeat(80) + 'went to Japan in the holidays' + ' B'.repeat(80)
    const noisy = {
      ...data,
      notes: [{ ...notes[0], text: long }],
    }
    const [match] = searchMatches('japan', noisy)
    expect(match.snippet!.length).toBeLessThan(90)
    expect(match.snippet).toMatch(/^…A .*went to Japan in the holidays B.*…$/)
  })

  it('ignores accents in either the query or the record', () => {
    const accented = { ...data, people: [...people, person('zoe', 'Zoë Martín')] }
    expect(searchPeople('zoe', accented).map((p) => p.name)).toEqual(['Zoë Martín'])
    expect(searchPeople('Zoë martin', accented).map((p) => p.name)).toEqual(['Zoë Martín'])
  })

  it('finds a parent by their child\'s name, and the child too', () => {
    expect(names('mia')).toEqual(['Dave Tester', 'Mia'])
  })

  it('finds every parent of a child kept as a name', () => {
    expect(names('ollie')).toEqual(['Dave Tester', 'Priya Shah'])
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

describe('children kept as names', () => {
  const today = new Date(2026, 9, 5)
  const child = (id: string, name: string, extra: Partial<Child> = {}): Child => ({
    ...base,
    type: 'child',
    id,
    parentIds: ['dave'],
    name,
    ...extra,
  })

  it('takes plain text as the name', () => {
    expect(parseChild('  Mia  ', today)).toEqual({ name: 'Mia' })
    expect(parseChild('Mary Jane', today)).toEqual({ name: 'Mary Jane' })
    expect(parseChild('   ', today)).toBeUndefined()
  })

  it('splits off a trailing birth year or date', () => {
    expect(parseChild('Mia 2019', today)).toEqual({ name: 'Mia', born: '2019' })
    expect(parseChild('Mary Jane 2019-03-01', today)).toEqual({
      name: 'Mary Jane',
      born: '2019-03-01',
    })
  })

  it('keeps an implausible year as part of the name', () => {
    expect(parseChild('Mia 2099', today)).toEqual({ name: 'Mia 2099' })
    expect(parseChild('Mia 1066', today)).toEqual({ name: 'Mia 1066' })
    expect(parseChild('2019', today)).toEqual({ name: '2019' })
  })

  it('labels a child with a current age when the birth is known', () => {
    expect(childLabel(child('c1', 'Mia', { born: '2019' }), today)).toBe('Mia (~7)')
    expect(childLabel(child('c1', 'Mia'), today)).toBe('Mia')
  })

  it('lists a person\'s children oldest first, unknown ages last', () => {
    const all = [
      child('c1', 'Unknown'),
      child('c2', 'Younger', { born: '2021' }),
      child('c3', 'Older', { born: '2017-06-01' }),
      child('c4', 'Someone else\'s', { parentIds: ['priya'] }),
    ]
    expect(childrenOf(all, 'dave').map((c) => c.name)).toEqual(['Older', 'Younger', 'Unknown'])
  })
})

describe('whenLabel', () => {
  const today = new Date(2026, 9, 26)
  const label = (iso: string) => whenLabel(iso, today)

  it('names the nearest days', () => {
    expect(label('2026-10-26')).toBe('Today')
    expect(label('2026-10-25')).toBe('Yesterday')
    expect(label('2026-10-27')).toBe('Tomorrow')
  })

  it('counts days under a week and weeks after that', () => {
    expect(label('2026-10-23')).toBe('3 days ago')
    expect(label('2026-10-12')).toBe('2 weeks ago')
    expect(label('2026-10-31')).toBe('In 5 days')
    expect(label('2026-11-09')).toBe('In 2 weeks')
    expect(label('2026-11-02')).toBe('In 1 week')
  })

  it('falls back to the date beyond two months', () => {
    expect(label('2026-07-01')).toMatch(/^1 Jul\w* 2026$/)
    expect(label('2027-02-01')).toMatch(/^1 Feb\w* 2027$/)
  })

  it('reads a timestamp in local time', () => {
    expect(label(new Date(2026, 9, 26, 23, 59).toISOString())).toBe('Today')
  })
})

describe('openLoops', () => {
  const loop = (id: string, extra: Partial<OpenLoop>): OpenLoop => ({
    ...base,
    type: 'loop',
    id,
    personId: 'dave',
    text: id,
    status: 'open',
    ...extra,
  })

  it('puts dated loops first by date, then the rest oldest first', () => {
    const loops = [
      loop('later', { createdAt: '2026-02-01T00:00:00.000Z' }),
      loop('soon', { dueDate: '2026-11-01' }),
      loop('closed', { status: 'closed', dueDate: '2026-10-01' }),
      loop('other', { personId: 'priya', dueDate: '2026-10-01' }),
      loop('earlier', { createdAt: '2026-01-01T00:00:00.000Z' }),
      loop('sooner', { dueDate: '2026-10-28' }),
    ]
    expect(openLoops(loops, 'dave').map((l) => l.id)).toEqual(['sooner', 'soon', 'earlier', 'later'])
  })
})

describe('questionsIn', () => {
  it('picks the questions out of a dictated paragraph', () => {
    expect(
      questionsIn('Long chat at training. His dad had a fall. How is his dad after the fall? They might go to Japan. Did they book the trip?'),
    ).toEqual(['How is his dad after the fall?', 'Did they book the trip?'])
  })

  it('takes a question on its own line and ignores duplicates and bare marks', () => {
    expect(questionsIn('Nervous about work\nHow did the interview go?\nHow did the interview go?\n?')).toEqual([
      'How did the interview go?',
    ])
  })

  it('finds nothing in a note with no questions', () => {
    expect(questionsIn('Starting a new job in March.')).toEqual([])
  })
})

describe('mapHighlights', () => {
  const entry = (id: string, section: MapEntry['section'], extra: Partial<MapEntry> = {}): MapEntry => ({
    ...base,
    type: 'mapEntry',
    id,
    personId: 'jess',
    section,
    text: id,
    date: '2026-10-01',
    status: 'current',
    sensitive: false,
    ...extra,
  })

  it('keeps current stresses, worries and upcoming events, newest first, at most five', () => {
    const entries = [
      entry('old-worry', 'worries', { createdAt: '2026-01-01T00:00:00.000Z' }),
      entry('hope', 'hopes'),
      entry('resolved', 'stresses', { status: 'resolved' }),
      entry('stress', 'stresses', { createdAt: '2026-03-01T00:00:00.000Z' }),
      entry('event', 'upcomingEvents', { createdAt: '2026-02-01T00:00:00.000Z' }),
      entry('w1', 'worries', { createdAt: '2026-04-01T00:00:00.000Z' }),
      entry('w2', 'worries', { createdAt: '2026-05-01T00:00:00.000Z' }),
      entry('w3', 'worries', { createdAt: '2026-06-01T00:00:00.000Z' }),
    ]
    expect(mapHighlights(entries).map((e) => e.id)).toEqual(['w3', 'w2', 'w1', 'stress', 'event'])
  })
})
