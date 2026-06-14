import type {
  Commitment,
  CommitmentList,
  GuidanceLine,
  GuidanceGroup,
  IncomeBaseline,
  IncomeRecord,
  UrgencyLevel,
} from '../types'
import { today, daysDiff, addDays, startOfWeek, monthKey, quarterKey, ymd } from './dates'
import { getPeriodKey, getDepositedThisPeriod } from './periodKey'

const WKPM = 52 / 12 // weeks per month

/** Convert a commitment's per-occurrence amount to a weekly equivalent. */
export function toWeeklyAmount(c: Commitment): number {
  switch (c.recurrence) {
    case 'weekly':      return c.amount
    case 'fortnightly': return c.amount / 2
    case 'monthly':     return c.amount / WKPM
    case 'quarterly':   return c.amount / (WKPM * 3)
    case 'yearly':      return c.amount / 52
    case 'interval':    return c.intervalDays ? c.amount / (c.intervalDays / 7) : c.amount
    case 'one-time':    return c.amount
    default:            return c.amount
  }
}

/** Monthly equivalent for display purposes. */
export function toMonthlyAmount(c: Commitment): number {
  return toWeeklyAmount(c) * WKPM
}

/** Next due date from a reference date. Returns null if not determinable. */
export function getNextDueDate(c: Commitment, from?: string): string | null {
  const ref = from ?? today()

  switch (c.recurrence) {
    case 'weekly': {
      if (!c.startDate) return null
      const anchor = c.startDate
      const diff = daysDiff(anchor, ref)
      if (diff < 0) return anchor
      const weeksAhead = Math.ceil(diff / 7)
      return addDays(anchor, weeksAhead * 7)
    }

    case 'fortnightly': {
      if (!c.startDate) return null
      const diff = daysDiff(c.startDate, ref)
      if (diff < 0) return c.startDate
      const cyclesAhead = Math.ceil(diff / 14)
      return addDays(c.startDate, cyclesAhead * 14)
    }

    case 'monthly': {
      if (!c.dueDay) return null
      const [yr, mo] = ref.split('-').map(Number)
      let d = new Date(yr, mo - 1, c.dueDay)
      let ds = ymd(d.getFullYear(), d.getMonth() + 1, d.getDate())
      if (ds <= ref) { d = new Date(yr, mo, c.dueDay); ds = ymd(d.getFullYear(), d.getMonth() + 1, d.getDate()) }
      return ds
    }

    case 'quarterly': {
      if (!c.dueDay) return null
      const [yr, mo] = ref.split('-').map(Number)
      const q = Math.ceil(mo / 3)
      const qEndMonth = q * 3
      let d = new Date(yr, qEndMonth - 1, c.dueDay)
      let ds = ymd(d.getFullYear(), d.getMonth() + 1, d.getDate())
      if (ds <= ref) { d = new Date(yr, qEndMonth + 2, c.dueDay); ds = ymd(d.getFullYear(), d.getMonth() + 1, d.getDate()) }
      return ds
    }

    case 'yearly': {
      if (!c.startDate) return null
      const startMo = parseInt(c.startDate.slice(5, 7)) - 1
      const startDay = parseInt(c.startDate.slice(8, 10))
      const yr = parseInt(ref.slice(0, 4))
      let d = new Date(yr, startMo, startDay)
      let ds = ymd(d.getFullYear(), d.getMonth() + 1, d.getDate())
      if (ds <= ref) { d = new Date(yr + 1, startMo, startDay); ds = ymd(d.getFullYear(), d.getMonth() + 1, d.getDate()) }
      return ds
    }

    case 'interval': {
      if (!c.startDate || !c.intervalDays) return null
      const diff = daysDiff(c.startDate, ref)
      if (diff < 0) return c.startDate
      const n = Math.ceil(diff / c.intervalDays)
      return addDays(c.startDate, n * c.intervalDays)
    }

    case 'one-time':
      return c.startDate ?? null

    default:
      return null
  }
}

function urgencyFromDays(days: number | null): UrgencyLevel {
  if (days === null) return 'normal'
  if (days < 0)  return 'overdue'
  if (days <= 2) return 'urgent'
  if (days <= 7) return 'soon'
  if (days <= 21) return 'normal'
  return 'future'
}

function urgencyScore(level: UrgencyLevel): number {
  return { overdue: 5, urgent: 4, soon: 3, normal: 2, future: 1 }[level]
}

/** Compute guidance lines sorted by urgency + priority order. */
export function computeGuidanceLines(
  commitments: Commitment[],
  lists: CommitmentList[],
  effectivePaycheck: number,
): GuidanceLine[] {
  const listMap = new Map(lists.map(l => [l.id, l]))
  const ref = today()

  const lines: GuidanceLine[] = commitments.map(c => {
    const weeklyTarget = toWeeklyAmount(c)
    const periodAllocated = getDepositedThisPeriod(c)
    const remaining = Math.max(0, weeklyTarget - periodAllocated)
    const nextDueDate = getNextDueDate(c, ref)
    const daysUntilDue = nextDueDate ? daysDiff(ref, nextDueDate) : null
    const urgency = urgencyFromDays(daysUntilDue)
    const periodKey = getPeriodKey(c)

    return {
      commitment: c,
      list: c.listId ? (listMap.get(c.listId) ?? null) : null,
      weeklyTarget,
      periodAllocated,
      remaining,
      suggestedAmount: 0, // filled below
      nextDueDate,
      daysUntilDue,
      urgency,
      periodKey,
    }
  })

  // Sort: urgency first, then manual priorityOrder
  lines.sort((a, b) => {
    const us = urgencyScore(b.urgency) - urgencyScore(a.urgency)
    if (us !== 0) return us
    return a.commitment.priorityOrder - b.commitment.priorityOrder
  })

  // Distribute paycheck across lines
  let available = effectivePaycheck
  for (const line of lines) {
    if (available <= 0) { line.suggestedAmount = 0; continue }
    const suggest = Math.min(line.remaining, available)
    line.suggestedAmount = Math.round(suggest * 100) / 100
    available -= suggest
  }

  return lines
}

/** Group guidance lines by their list (null list → "Uncategorised"). */
export function groupGuidanceLines(lines: GuidanceLine[]): GuidanceGroup[] {
  const groupMap = new Map<string, GuidanceGroup>()

  for (const line of lines) {
    const key = line.list?.id ?? '__none__'
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        list: line.list,
        label: line.list?.name ?? 'Uncategorised',
        lines: [],
        totalWeeklyTarget: 0,
        totalAllocated: 0,
        totalRemaining: 0,
      })
    }
    const group = groupMap.get(key)!
    group.lines.push(line)
    group.totalWeeklyTarget += line.weeklyTarget
    group.totalAllocated += line.periodAllocated
    group.totalRemaining += line.remaining
  }

  return [...groupMap.values()]
}

// ─── Income baseline (EWMA learning model) ────────────────────────────────────

const ALPHA = 0.3 // weight for most recent paycheck

export function computeBaseline(records: IncomeRecord[]): IncomeBaseline {
  if (records.length === 0) {
    return { value: 0, sampleCount: 0, confidence: 'none' }
  }

  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date))
  let ewma = sorted[0].amount

  for (let i = 1; i < sorted.length; i++) {
    ewma = ALPHA * sorted[i].amount + (1 - ALPHA) * ewma
  }

  const n = sorted.length
  const confidence =
    n >= 8 ? 'high' :
    n >= 4 ? 'medium' :
    n >= 2 ? 'low' : 'none'

  return { value: Math.round(ewma * 100) / 100, sampleCount: n, confidence }
}
