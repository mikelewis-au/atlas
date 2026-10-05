import { ageLabel, parseBorn } from './dates'
import { relationsOf } from './links'
import type { Child, Link } from './model'
import type { Vault } from './vault'

/** "Mia" or "Mia 2019": a trailing birth year or date is split off so the age stays current. */
export function parseChild(
  text: string,
  today = new Date(),
): { name: string; born?: string } | undefined {
  const trimmed = text.trim()
  if (!trimmed) return undefined
  const match = /^(.*\S)\s+(\d{4}(?:-\d{2}-\d{2})?)$/.exec(trimmed)
  const born = match ? parseBorn(match[2]) : undefined
  const year = born ? Number(born.slice(0, 4)) : 0
  if (match && born && year >= 1900 && year <= today.getFullYear()) {
    return { name: match[1], born }
  }
  return { name: trimmed }
}

export function childLabel(child: Child, today = new Date()): string {
  const age = ageLabel(child.born, today)
  return age ? `${child.name} (${age})` : child.name
}

/** Oldest first; children with no known birth come last, in the order they were added. */
export function childrenOf(children: Child[], personId: string): Child[] {
  return children
    .filter((child) => child.parentIds.includes(personId))
    .sort(
      (a, b) =>
        (a.born ?? '9999').localeCompare(b.born ?? '9999') ||
        a.createdAt.localeCompare(b.createdAt),
    )
}

function currentPartnerIds(links: Link[], personId: string): string[] {
  return relationsOf(links, personId)
    .filter((relation) => relation.role === 'partner' && !relation.link.ended)
    .map((relation) => relation.otherId)
}

/** The child is recorded against the person and whoever they are a couple with right now. */
export async function addChild(
  vault: Vault,
  personId: string,
  text: string,
): Promise<Child | undefined> {
  const parsed = parseChild(text)
  if (!parsed) return undefined
  return vault.create('child', {
    ...parsed,
    parentIds: [personId, ...currentPartnerIds(vault.all('link'), personId)],
  })
}

/**
 * Called when two people become a couple: each one's children appear on the
 * other's card too. Parents are stored on the child, so a later separation
 * leaves the children on both cards.
 */
export async function shareChildren(vault: Vault, aId: string, bId: string): Promise<void> {
  for (const child of vault.all('child')) {
    const hasA = child.parentIds.includes(aId)
    const hasB = child.parentIds.includes(bId)
    if (hasA !== hasB) {
      await vault.update('child', child.id, { parentIds: [...child.parentIds, hasA ? bId : aId] })
    }
  }
}
