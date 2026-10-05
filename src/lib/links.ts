import type { Link, LinkKind } from './model'

/** What the other person is to the person whose card is being viewed. */
export type Role =
  | 'partner'
  | 'child'
  | 'parent'
  | 'sibling'
  | 'friend'
  | 'colleague'
  | 'introducer'
  | 'introduced'

export const ROLE_LABELS: Record<Role, string> = {
  partner: 'Partner',
  child: 'Child',
  parent: 'Parent',
  sibling: 'Sibling',
  friend: 'Friend',
  colleague: 'Colleague',
  introducer: 'Introduced us',
  introduced: 'Introduced to me',
}

export const ROLES = Object.keys(ROLE_LABELS) as Role[]

const CAN_END: Role[] = ['partner', 'friend', 'colleague']

export function canEnd(role: Role): boolean {
  return CAN_END.includes(role)
}

export function linkFor(
  selfId: string,
  otherId: string,
  role: Role,
): { fromId: string; toId: string; kind: LinkKind } {
  switch (role) {
    case 'child':
      return { fromId: selfId, toId: otherId, kind: 'parent' }
    case 'parent':
      return { fromId: otherId, toId: selfId, kind: 'parent' }
    case 'introducer':
      return { fromId: selfId, toId: otherId, kind: 'introducedBy' }
    case 'introduced':
      return { fromId: otherId, toId: selfId, kind: 'introducedBy' }
    default:
      return { fromId: selfId, toId: otherId, kind: role }
  }
}

export function roleOf(link: Link, selfId: string): Role {
  const selfIsFrom = link.fromId === selfId
  if (link.kind === 'parent') return selfIsFrom ? 'child' : 'parent'
  if (link.kind === 'introducedBy') return selfIsFrom ? 'introducer' : 'introduced'
  return link.kind
}

export interface Relation {
  link: Link
  otherId: string
  role: Role
  label: string
}

export function relationsOf(links: Link[], selfId: string): Relation[] {
  return links
    .filter((link) => link.fromId === selfId || link.toId === selfId)
    .map((link) => {
      const role = roleOf(link, selfId)
      const label = ROLE_LABELS[role]
      return {
        link,
        otherId: link.fromId === selfId ? link.toId : link.fromId,
        role,
        label: link.ended ? `Former ${label.toLowerCase()}` : label,
      }
    })
}

/** Current partner and children: the people to ask after by name. */
export function household(relations: Relation[]): Relation[] {
  const partners = relations.filter((r) => r.role === 'partner' && !r.link.ended)
  const children = relations.filter((r) => r.role === 'child')
  return [...partners, ...children]
}

export function linkExists(links: Link[], candidate: { fromId: string; toId: string; kind: LinkKind }): boolean {
  const symmetric = candidate.kind !== 'parent' && candidate.kind !== 'introducedBy'
  return links.some(
    (link) =>
      link.kind === candidate.kind &&
      ((link.fromId === candidate.fromId && link.toId === candidate.toId) ||
        (symmetric && link.fromId === candidate.toId && link.toId === candidate.fromId)),
  )
}
