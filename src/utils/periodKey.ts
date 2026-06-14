import type { Commitment } from '../types'
import { today, startOfWeek, addDays, daysDiff, monthKey, quarterKey, ymd } from './dates'

/** Returns the period key for the active cycle that contains `date`. */
export function getPeriodKey(c: Commitment, date?: string): string {
  const d = date ?? today()

  switch (c.recurrence) {
    case 'weekly':
      return startOfWeek(d)

    case 'fortnightly': {
      const anchor = c.startDate ? startOfWeek(c.startDate) : startOfWeek(d)
      const current = startOfWeek(d)
      const weeks = Math.floor(Math.max(0, daysDiff(anchor, current)) / 7)
      return addDays(anchor, Math.floor(weeks / 2) * 14)
    }

    case 'monthly':
      return monthKey(d)

    case 'quarterly':
      return quarterKey(d)

    case 'yearly':
      return d.slice(0, 4)

    case 'interval': {
      if (!c.startDate || !c.intervalDays) return d
      const diff = daysDiff(c.startDate, d)
      if (diff < 0) return c.startDate
      const n = Math.floor(diff / c.intervalDays)
      return addDays(c.startDate, n * c.intervalDays)
    }

    case 'one-time':
      return c.startDate ?? d

    default:
      return d
  }
}

/** Sum of all deposits for the current active period. */
export function getDepositedThisPeriod(c: Commitment, date?: string): number {
  const key = getPeriodKey(c, date)
  return c.deposits[key] ?? 0
}

/** All due dates for a commitment within a given month (YYYY-MM). */
export function dueDatesInMonth(c: Commitment, yearMonth: string): string[] {
  const [yr, mo] = yearMonth.split('-').map(Number)
  const firstDay = `${yearMonth}-01`
  const lastDay = ymd(yr, mo, new Date(yr, mo, 0).getDate())
  const results: string[] = []

  switch (c.recurrence) {
    case 'weekly': {
      if (!c.startDate) break
      const anchor = c.startDate
      let cursor = anchor
      // Walk forward from anchor to end of month, collect matches
      while (cursor <= lastDay) {
        if (cursor >= firstDay) results.push(cursor)
        cursor = addDays(cursor, 7)
      }
      // Also walk backward if anchor is after first day
      cursor = addDays(anchor, -7)
      while (cursor >= firstDay) {
        results.push(cursor)
        cursor = addDays(cursor, -7)
      }
      break
    }

    case 'fortnightly': {
      if (!c.startDate) break
      const anchor = c.startDate
      let cursor = anchor
      while (cursor <= lastDay) {
        if (cursor >= firstDay) results.push(cursor)
        cursor = addDays(cursor, 14)
      }
      cursor = addDays(anchor, -14)
      while (cursor >= firstDay) {
        results.push(cursor)
        cursor = addDays(cursor, -14)
      }
      break
    }

    case 'monthly': {
      if (!c.dueDay) break
      const d = new Date(yr, mo - 1, c.dueDay)
      if (d.getMonth() === mo - 1) results.push(ymd(d.getFullYear(), d.getMonth() + 1, d.getDate()))
      break
    }

    case 'quarterly': {
      if (!c.dueDay) break
      // Quarter end months: 3, 6, 9, 12
      if ([3, 6, 9, 12].includes(mo)) {
        const d = new Date(yr, mo - 1, c.dueDay)
        if (d.getMonth() === mo - 1) results.push(ymd(d.getFullYear(), d.getMonth() + 1, d.getDate()))
      }
      break
    }

    case 'yearly': {
      if (!c.startDate) break
      const startMo = parseInt(c.startDate.slice(5, 7))
      const startDay = parseInt(c.startDate.slice(8, 10))
      if (startMo === mo) {
        const d = new Date(yr, mo - 1, startDay)
        if (d.getMonth() === mo - 1) results.push(ymd(d.getFullYear(), d.getMonth() + 1, d.getDate()))
      }
      break
    }

    case 'interval': {
      if (!c.startDate || !c.intervalDays) break
      let cursor = c.startDate
      while (cursor <= lastDay) {
        if (cursor >= firstDay) results.push(cursor)
        cursor = addDays(cursor, c.intervalDays)
      }
      // Walk backward too
      cursor = addDays(c.startDate, -c.intervalDays)
      while (cursor >= firstDay) {
        results.push(cursor)
        cursor = addDays(cursor, -c.intervalDays)
      }
      break
    }

    case 'one-time': {
      if (c.startDate && c.startDate >= firstDay && c.startDate <= lastDay) {
        results.push(c.startDate)
      }
      break
    }
  }

  return [...new Set(results)].sort()
}
