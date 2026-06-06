import type { Priority, AllocationResult, AllocationLine } from './types';

export function allocate(gross: number, priorities: Priority[]): AllocationResult {
  if (gross <= 0 || priorities.length === 0) {
    return { lines: [], unallocated: gross };
  }

  let remaining = gross;
  const lines: AllocationLine[] = [];

  // 1. Fixed amounts in priority order — amount is monthly; use 52/12 weeks-per-month so
  //    5-paycheck months are handled correctly over the year.
  const WEEKS_PER_MONTH = 52 / 12;
  for (const p of priorities) {
    if (p.type !== 'fixed') continue;
    const want = (p.amount ?? 0) / WEEKS_PER_MONTH;
    const got = Math.min(want, remaining);
    lines.push({ priority: p, allocated: got, pct: (got / gross) * 100, shortfall: got < want });
    remaining -= got;
  }

  // 2. Percentages of what remained after all fixed items
  const afterFixed = remaining;
  for (const p of priorities) {
    if (p.type !== 'percentage') continue;
    const want = ((p.percentage ?? 0) / 100) * afterFixed;
    const got = Math.min(want, remaining);
    lines.push({ priority: p, allocated: got, pct: (got / gross) * 100, shortfall: false });
    remaining -= got;
  }

  // 3. First remainder item gets everything left
  for (const p of priorities) {
    if (p.type !== 'remainder') continue;
    lines.push({ priority: p, allocated: remaining, pct: (remaining / gross) * 100, shortfall: false });
    remaining = 0;
    break;
  }

  // Re-sort lines to match the user's defined priority order
  const order = priorities.map((p) => p.id);
  lines.sort((a, b) => order.indexOf(a.priority.id) - order.indexOf(b.priority.id));

  return { lines, unallocated: remaining };
}
