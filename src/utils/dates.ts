/** Format a year/month/day triplet to YYYY-MM-DD without UTC conversion. */
export function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Today's date in the user's local timezone. */
export function today(): string {
  const d = new Date()
  return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

export function daysDiff(from: string, to: string): number {
  const a = new Date(from).getTime()
  const b = new Date(to).getTime()
  return Math.round((b - a) / 86_400_000)
}

export function addDays(date: string, days: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Returns the ISO Monday (YYYY-MM-DD) of the week containing `date`. */
export function startOfWeek(date: string): string {
  const d = new Date(date)
  const day = d.getDay() // 0 = Sun
  const offset = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatShort(date: string): string {
  return new Date(date).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
  })
}

export function formatRelative(daysUntil: number): string {
  if (daysUntil < 0) return `${Math.abs(daysUntil)}d overdue`
  if (daysUntil === 0) return 'due today'
  if (daysUntil === 1) return 'due tomorrow'
  if (daysUntil <= 7) return `due in ${daysUntil}d`
  if (daysUntil <= 30) return `due in ${Math.round(daysUntil / 7)}wk`
  return `due in ${Math.round(daysUntil / 30)}mo`
}

export function isoWeekKey(date: string): string {
  return startOfWeek(date)
}

export function monthKey(date: string): string {
  return date.slice(0, 7)
}

export function quarterKey(date: string): string {
  const [year, month] = date.slice(0, 7).split('-').map(Number)
  return `${year}-Q${Math.ceil(month / 3)}`
}

/** All days in a given month as YYYY-MM-DD strings. */
export function daysInMonth(year: number, month: number): string[] {
  const days: string[] = []
  const daysInMo = new Date(year, month, 0).getDate()
  for (let d = 1; d <= daysInMo; d++) {
    days.push(ymd(year, month, d))
  }
  return days
}
