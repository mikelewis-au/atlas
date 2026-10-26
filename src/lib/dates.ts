export function todayIso(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function localDate(iso: string): Date {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function formatDate(iso: string): string {
  return localDate(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Accepts 'YYYY' or 'YYYY-MM-DD'. Returns undefined for anything else. */
export function parseBorn(input: string): string | undefined {
  const text = input.trim()
  if (/^\d{4}$/.test(text)) return text
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined
  const [year, month, day] = text.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getMonth() === month - 1 && date.getDate() === day ? text : undefined
}

/** A year-only birth gives an age that may be one out, so it is marked with '~'. */
export function ageLabel(born: string | undefined, today = new Date()): string | undefined {
  if (!born) return undefined
  const [year, month, day] = born.split('-').map(Number)
  let age = today.getFullYear() - year
  if (!month || !day) return age >= 0 ? `~${age}` : undefined
  const birthdayPassed =
    today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() >= day)
  if (!birthdayPassed) age--
  return age >= 0 ? String(age) : undefined
}

const DAY_MS = 24 * 60 * 60 * 1000
const RELATIVE_LIMIT_DAYS = 60

/** "Today", "3 weeks ago" or "In 2 days" while it is close, the plain date once it is not. */
export function whenLabel(iso: string, today = new Date()): string {
  // A timestamp is read in local time; a plain date already is one.
  const then = iso.includes('T') ? new Date(iso) : localDate(iso)
  then.setHours(0, 0, 0, 0)
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const days = Math.round((then.getTime() - now.getTime()) / DAY_MS)
  if (Math.abs(days) > RELATIVE_LIMIT_DAYS) return formatDate(todayIso(then))
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return 'Yesterday'
  const count = Math.abs(days) < 7 ? Math.abs(days) : Math.round(Math.abs(days) / 7)
  const unit = Math.abs(days) < 7 ? 'day' : 'week'
  const span = `${count} ${unit}${count === 1 ? '' : 's'}`
  return days > 0 ? `In ${span}` : `${span} ago`
}
