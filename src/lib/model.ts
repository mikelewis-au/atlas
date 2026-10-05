export interface Base {
  id: string
  createdAt: string
  updatedAt: string
}

export type Space = 'personal' | 'work' | 'both'

export interface Person extends Base {
  type: 'person'
  name: string
  space?: Space
  /** false for a satellite: someone recorded only as context for another person */
  circle: boolean
  /** 'YYYY' or 'YYYY-MM-DD' */
  born?: string
  howIKnow?: string
  tags: string[]
  pinned?: boolean
  hasMap?: boolean
}

export type LinkKind = 'partner' | 'parent' | 'sibling' | 'friend' | 'colleague' | 'introducedBy'

/** Directional kinds read "from is the parent of to" and "from was introduced by to". */
export interface Link extends Base {
  type: 'link'
  fromId: string
  toId: string
  kind: LinkKind
  ended?: boolean
}

/** A child kept as a name on their parents' cards rather than as a person of their own. */
export interface Child extends Base {
  type: 'child'
  parentIds: string[]
  name: string
  /** 'YYYY' or 'YYYY-MM-DD' */
  born?: string
}

export interface Note extends Base {
  type: 'note'
  personId: string
  date: string
  text: string
  summary?: string
  sensitive: boolean
}

export interface Fact extends Base {
  type: 'fact'
  personId: string
  text: string
  sourceNoteId?: string
}

export interface OpenLoop extends Base {
  type: 'loop'
  personId: string
  text: string
  dueDate?: string
  status: 'open' | 'closed'
  sourceNoteId?: string
}

export type MapSection =
  | 'recentEvents'
  | 'upcomingEvents'
  | 'stresses'
  | 'worries'
  | 'hopes'
  | 'innerWorld'
  | 'favourites'

export interface MapEntry extends Base {
  type: 'mapEntry'
  personId: string
  section: MapSection
  text: string
  date: string
  status: 'current' | 'resolved'
  resolvedAt?: string
  sensitive: boolean
}

export interface Question extends Base {
  type: 'question'
  personId: string
  text: string
  section?: MapSection
  status: 'toAsk' | 'asked'
}

export interface RecordMap {
  person: Person
  link: Link
  child: Child
  note: Note
  fact: Fact
  loop: OpenLoop
  mapEntry: MapEntry
  question: Question
}

export type RecordType = keyof RecordMap
export type AnyRecord = RecordMap[RecordType]
export type Fields<K extends RecordType> = Omit<RecordMap[K], keyof Base | 'type'>
