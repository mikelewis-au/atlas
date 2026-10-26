import type { MapEntry, MapSection } from './model'

export interface SectionInfo {
  id: MapSection
  title: string
  placeholder: string
  quiz: (name: string) => string
}

export const MAP_SECTIONS: SectionInfo[] = [
  {
    id: 'recentEvents',
    title: 'Recent important events',
    placeholder: 'Something significant that happened lately',
    quiz: (name) => `What important things have happened for ${name} recently?`,
  },
  {
    id: 'upcomingEvents',
    title: 'Upcoming events',
    placeholder: 'Something coming up, looked forward to or dreaded',
    quiz: (name) => `What is coming up that ${name} is looking forward to or dreading?`,
  },
  {
    id: 'stresses',
    title: 'Current stresses',
    placeholder: 'A pressure right now',
    quiz: (name) => `What is stressing ${name} at the moment?`,
  },
  {
    id: 'worries',
    title: 'Current worries',
    placeholder: 'Something weighing on the mind',
    quiz: (name) => `What is ${name} worried about right now?`,
  },
  {
    id: 'hopes',
    title: 'Hopes and aspirations',
    placeholder: 'A hope, dream or ambition',
    quiz: (name) => `What are ${name}'s hopes and aspirations?`,
  },
  {
    id: 'innerWorld',
    title: 'Inner world',
    placeholder: 'History, values, proud moments, old hurts',
    quiz: (name) => `What do you know about ${name}'s history and values?`,
  },
  {
    id: 'favourites',
    title: 'Favourites and preferences',
    placeholder: 'A favourite, or how things are preferred',
    quiz: (name) => `What are ${name}'s favourites and preferences?`,
  },
]

export function sectionInfo(id: MapSection): SectionInfo {
  return MAP_SECTIONS.find((section) => section.id === id)!
}

const HIGHLIGHT_SECTIONS: MapSection[] = ['stresses', 'worries', 'upcomingEvents']
const HIGHLIGHT_LIMIT = 5

/** What is on their mind right now: the pressing sections of the map, newest first. */
export function mapHighlights(entries: MapEntry[]): MapEntry[] {
  return entries
    .filter((entry) => entry.status === 'current' && HIGHLIGHT_SECTIONS.includes(entry.section))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, HIGHLIGHT_LIMIT)
}
