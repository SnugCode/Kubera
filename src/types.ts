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

export type BillRecurrence = 'monthly' | 'yearly' | 'one-time';

export interface Bill {
  id: string;
  name: string;
  amount: number;
  recurrence: BillRecurrence;
  dueDay: number;       // for monthly/yearly: day of month (1–28)
  dueMonth?: number;    // for yearly: 1–12
  dueDate?: string;     // for one-time: ISO date string
  color: string;
  paidPeriods: string[]; // 'YYYY-MM' monthly · 'YYYY' yearly · ISO date one-time
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  months: number;       // how many months to reach the goal
  saved: number;        // running total of contributions
  startDate: string;    // ISO date string
  completed: boolean;
}
