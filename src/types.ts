export type AllocationType = 'fixed' | 'percentage' | 'remainder';

export interface Priority {
  id: string;
  name: string;
  type: AllocationType;
  amount?: number;        // used when type === 'fixed' — stored as monthly total
  percentage?: number;    // used when type === 'percentage'
  dueDay?: number;        // for fixed type: day of month payment is due (1–28)
  paidPeriods?: string[]; // 'YYYY-MM' months marked paid in the calendar
}

export interface AllocationLine {
  priority: Priority;
  allocated: number;
  pct: number;
  shortfall: boolean;   // true when fixed amount couldn't be fully covered
}

export interface AllocationResult {
  lines: AllocationLine[];
  unallocated: number;
}

export interface PaycheckRecord {
  id: string;
  date: string;
  gross: number;
  result: AllocationResult;
}

export type BillRecurrence = 'monthly' | 'fortnightly' | 'quarterly' | 'yearly' | 'one-time' | 'interval';

export interface Bill {
  id: string;
  name: string;
  amount: number;
  recurrence: BillRecurrence;
  dueDay: number;          // for monthly/yearly: day of month (1–28)
  dueMonth?: number;       // for yearly: 1–12
  dueDate?: string;        // for one-time: ISO date string
  startDate?: string;      // for interval: ISO date of first occurrence
  intervalDays?: number;   // for interval: e.g. 28
  color: string;
  paidPeriods: string[];   // 'YYYY-MM' monthly · 'YYYY' yearly · 'YYYY-MM-DD' interval/one-time
}

export interface Goal {
  id: string;
  name: string;
  type: 'long-term' | 'standalone';
  targetAmount: number;
  months: number;       // for long-term: months to reach the goal; 0 for standalone (no deadline)
  saved: number;
  startDate: string;
  completed: boolean;
}
