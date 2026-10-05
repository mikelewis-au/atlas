export function todayIso(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export function formatDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-AU', {
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
