export type AllocationType = 'fixed' | 'percentage' | 'remainder';

export interface Priority {
  id: string;
  name: string;
  linkKey?: string;       // normalized name for cross-category linking; defaults to name.toLowerCase()
  type: AllocationType;
  amount?: number;        // used when type === 'fixed' — stored as monthly total
  percentage?: number;    // used when type === 'percentage'
  dueDay?: number;        // for fixed type: day of month payment is due (1–28)
  paidPeriods?: string[]; // 'YYYY-MM' months marked paid in the calendar
  autoSum?:      boolean; // true for the auto-managed 'Bills' aggregator priority
  loansAutoSum?: boolean; // true for the auto-managed 'Loans' aggregator priority
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

export type BillRecurrence = 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly' | 'one-time' | 'interval';

export interface Bill {
  id: string;
  name: string;
  linkKey?: string;       // normalized name for cross-category linking
  amount: number;
  recurrence: BillRecurrence;
  dueDay: number;          // for monthly/yearly: day of month (1–28)
  dueMonth?: number;       // for yearly: 1–12
  dueDate?: string;        // for one-time: ISO date string
  startDate?: string;      // for interval: ISO date of first occurrence
  intervalDays?: number;   // for interval: e.g. 28
  color: string;
  category?: 'bill' | 'expense'; // 'bill' = rolls up into Bills priority; 'expense' = standalone
  paidPeriods: string[];   // 'YYYY-MM' monthly · 'YYYY' yearly · 'YYYY-MM-DD' interval/one-time
  deposits?: Record<string, number>; // period key → cumulative deposited amount
}

export interface LoanInstallment {
  id:        string;
  dueDate:   string;    // YYYY-MM-DD
  amount:    number;
  paid:      boolean;
  paidDate?: string;    // YYYY-MM-DD
}

export interface LoanPayment {
  id:     string;
  date:   string;       // YYYY-MM-DD
  amount: number;
}

export type LoanType = 'pay-in-4' | 'custom';

export interface Loan {
  id:             string;
  name:           string;
  description?:   string;
  totalAmount:    number;
  type:           LoanType;
  installments?:  LoanInstallment[]; // pay-in-4 only
  payments:       LoanPayment[];     // all payments made
  createdDate:    string;
  completed:      boolean;
  color:          string;
}

export interface Goal {
  id: string;
  name: string;
  linkKey?: string;
  type: 'long-term' | 'standalone';
  allocationMode?: 'duration' | 'fixed'; // long-term only; defaults to 'duration' for old data
  monthlyAllocation?: number;            // long-term fixed: monthly amount set aside ($X/mo ÷ (52/12) per paycheck)
  targetAmount: number;
  months: number;       // duration mode: target months; fixed mode / standalone: 0
  saved: number;
  startDate: string;
  completed: boolean;
}
