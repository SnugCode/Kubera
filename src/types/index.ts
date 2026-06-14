// ─── Recurrence ──────────────────────────────────────────────────────────────

export type Recurrence =
  | 'weekly'
  | 'fortnightly'
  | 'monthly'
  | 'quarterly'
  | 'yearly'
  | 'interval'
  | 'one-time'

// ─── Custom list (user-defined category grouping) ─────────────────────────────

export interface CommitmentList {
  id: string
  name: string
  /** Why the user made this list — read by the guidance engine for context */
  purpose?: string
  color: string
  createdAt: string
}

// ─── Commitment ───────────────────────────────────────────────────────────────

export interface Commitment {
  id: string
  name: string
  amount: number
  recurrence: Recurrence
  /** Used when recurrence === 'interval' */
  intervalDays?: number
  /** Day of month (1–31) for monthly / quarterly / yearly due dates */
  dueDay?: number
  /** Anchor date (YYYY-MM-DD) for weekly / fortnightly / interval / one-time */
  startDate?: string
  /** Optional ID of a CommitmentList this belongs to */
  listId?: string
  color: string
  /** Lower index = higher manual priority (tiebreaker for guidance engine) */
  priorityOrder: number
  /** periodKey → amount deposited */
  deposits: Record<string, number>
  note?: string
  createdAt: string
}

// ─── Income ───────────────────────────────────────────────────────────────────

export interface IncomeRecord {
  id: string
  /** YYYY-MM-DD */
  date: string
  amount: number
  note?: string
  createdAt: string
}

// ─── Allocation ───────────────────────────────────────────────────────────────

export interface AllocationRecord {
  id: string
  commitmentId: string
  /** YYYY-MM-DD */
  date: string
  amount: number
  periodKey: string
  note?: string
  createdAt: string
}

// ─── Guidance ─────────────────────────────────────────────────────────────────

export type UrgencyLevel = 'overdue' | 'urgent' | 'soon' | 'normal' | 'future'

export interface GuidanceLine {
  commitment: Commitment
  list: CommitmentList | null
  /** Weekly equivalent of the commitment's amount */
  weeklyTarget: number
  /** How much has already been deposited in the current period */
  periodAllocated: number
  /** weeklyTarget − periodAllocated (0 when fully funded) */
  remaining: number
  /** How much the guidance engine suggests allocating now from the paycheck */
  suggestedAmount: number
  nextDueDate: string | null
  daysUntilDue: number | null
  urgency: UrgencyLevel
  periodKey: string
}

export interface GuidanceGroup {
  list: CommitmentList | null
  /** "Uncategorised" when list is null */
  label: string
  lines: GuidanceLine[]
  totalWeeklyTarget: number
  totalAllocated: number
  totalRemaining: number
}

// ─── Income baseline (learning model) ────────────────────────────────────────

export type BaselineConfidence = 'none' | 'low' | 'medium' | 'high'

export interface IncomeBaseline {
  /** EWMA value */
  value: number
  sampleCount: number
  confidence: BaselineConfidence
}

// ─── NL parser result ─────────────────────────────────────────────────────────

export type NLParseResult =
  | { type: 'income'; amount: number; note?: string }
  | { type: 'commitment'; data: Partial<Commitment> }
  | { type: 'unknown'; raw: string }
