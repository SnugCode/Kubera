import { useState } from 'react';
import type { PaycheckRecord, Priority, Bill, Loan } from '../types';

interface Props {
  history:    PaycheckRecord[];
  priorities: Priority[];
  bills:      Bill[];
  loans:      Loan[];
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtShort(d: Date): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function billPeriodKey(bill: Bill, d: Date): string {
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  if (bill.recurrence === 'monthly' || bill.recurrence === 'quarterly') return `${y}-${mo}`;
  if (bill.recurrence === 'yearly') return `${y}`;
  return `${y}-${mo}-${dd}`;
}

function findBillOccurrence(bill: Bill, from: Date, to: Date): Date | null {
  if (bill.recurrence === 'one-time' && bill.dueDate) {
    const d = new Date(bill.dueDate + 'T00:00:00');
    return d >= from && d <= to ? d : null;
  }
  if (bill.recurrence === 'monthly') {
    for (let mo = -2; mo <= 3; mo++) {
      const d = new Date(from.getFullYear(), from.getMonth() + mo, bill.dueDay);
      if (d >= from && d <= to) return d;
    }
    return null;
  }
  if (bill.recurrence === 'yearly' && bill.dueMonth && bill.dueDay) {
    for (let yr = -1; yr <= 2; yr++) {
      const d = new Date(from.getFullYear() + yr, bill.dueMonth - 1, bill.dueDay);
      if (d >= from && d <= to) return d;
    }
    return null;
  }
  if (bill.recurrence === 'quarterly' && bill.startDate) {
    let d = new Date(bill.startDate + 'T00:00:00'); d.setHours(0,0,0,0);
    while (d < from) { const n = new Date(d.getFullYear(), d.getMonth() + 3, d.getDate()); if (n > from) break; d = n; }
    for (let i = 0; i < 6; i++) {
      if (d >= from && d <= to) return d;
      d = new Date(d.getFullYear(), d.getMonth() + 3, d.getDate());
      if (d > to) break;
    }
    return null;
  }
  if (bill.startDate && ['weekly','fortnightly','interval'].includes(bill.recurrence)) {
    const step = bill.recurrence === 'weekly' ? 7 : bill.recurrence === 'fortnightly' ? 14 : (bill.intervalDays ?? 1);
    let d = new Date(bill.startDate + 'T00:00:00'); d.setHours(0,0,0,0);
    if (d > to) return null;
    while (d < from) d.setDate(d.getDate() + step);
    return d <= to ? new Date(d) : null;
  }
  return null;
}

interface WeekRange {
  start: Date;
  end:   Date;
  label: string;
}

function getWeekRange(offset: number): WeekRange {
  const now = new Date();
  const dow = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1) + offset * 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return {
    start,
    end,
    label: `${fmtShort(start)} – ${fmtShort(end)}, ${start.getFullYear()}`,
  };
}

function getWeekRecords(history: PaycheckRecord[], start: Date, end: Date): PaycheckRecord[] {
  return history
    .filter(r => { const d = new Date(r.date); return d >= start && d <= end; })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// Find the most recent week (offset) that has at least one paycheck record
function nearestPastWeek(history: PaycheckRecord[], fromOffset: number): number | null {
  for (let o = fromOffset - 1; o >= -104; o--) {
    const { start, end } = getWeekRange(o);
    if (history.some(r => { const d = new Date(r.date); return d >= start && d <= end; })) return o;
  }
  return null;
}

function nearestFutureWeek(history: PaycheckRecord[], fromOffset: number): number | null {
  for (let o = fromOffset + 1; o <= 0; o++) {
    const { start, end } = getWeekRange(o);
    if (history.some(r => { const d = new Date(r.date); return d >= start && d <= end; })) return o;
  }
  return null;
}

export function StatsView({ history, priorities, bills, loans }: Props) {
  const [weekOffset, setWeekOffset] = useState(0);

  const { start, end, label } = getWeekRange(weekOffset);
  const records   = getWeekRecords(history, start, end);
  const isNow     = weekOffset === 0;

  const hasPrev = nearestPastWeek(history, weekOffset) !== null;
  const hasNext = !isNow && nearestFutureWeek(history, weekOffset) !== null;

  function goBack() {
    const o = nearestPastWeek(history, weekOffset);
    if (o !== null) setWeekOffset(o);
  }

  function goForward() {
    if (isNow) return;
    const o = nearestFutureWeek(history, weekOffset);
    if (o !== null) setWeekOffset(o);
  }

  // Aggregate totals across multiple paychecks in the same week (rare but possible)
  const weekGross       = records.reduce((s, r) => s + r.gross, 0);
  const weekUnallocated = records.reduce((s, r) => s + r.result.unallocated, 0);

  // Merge allocation lines by priority id, summing amounts
  const mergedLines = (() => {
    const map = new Map<string, { name: string; allocated: number; shortfall: boolean }>();
    for (const r of records) {
      for (const l of r.result.lines) {
        const prev = map.get(l.priority.id);
        if (prev) {
          prev.allocated += l.allocated;
          if (l.shortfall) prev.shortfall = true;
        } else {
          map.set(l.priority.id, {
            name:      l.priority.name,
            allocated: l.allocated,
            shortfall: l.shortfall,
          });
        }
      }
    }
    return [...map.values()].sort((a, b) => b.allocated - a.allocated);
  })();

  // Bills due during this week and their payment status
  const billsDueThisWeek = bills.flatMap(bill => {
    const occ = findBillOccurrence(bill, start, end);
    if (!occ) return [];
    const pKey     = billPeriodKey(bill, occ);
    const deposited = (bill.deposits ?? {})[pKey] ?? 0;
    const paid      = bill.paidPeriods.includes(pKey) || deposited >= bill.amount;
    const remaining = Math.max(0, bill.amount - deposited);
    return [{ bill, occ, pKey, deposited, paid, remaining }];
  });

  // Loan payments made during this week (have exact dates)
  const loanPaymentsThisWeek = loans.flatMap(loan =>
    loan.payments
      .filter(p => {
        const d = new Date(p.date + 'T00:00:00');
        return d >= start && d <= end;
      })
      .map(p => ({ loan, payment: p }))
  ).sort((a, b) => a.payment.date.localeCompare(b.payment.date));

  return (
    <div className="view">

      {/* ── Week navigation ── */}
      <div className="card stats-nav-card">
        <button
          className="stats-nav-btn"
          onClick={goBack}
          disabled={!hasPrev}
          title="Previous week with data"
        >
          ‹
        </button>
        <div className="stats-nav-center">
          <span className="stats-week-label">{label}</span>
          {isNow && <span className="stats-now-badge">this week</span>}
        </div>
        <button
          className="stats-nav-btn"
          onClick={goForward}
          disabled={isNow || !hasNext}
          title="Next week with data"
        >
          ›
        </button>
      </div>

      {/* ── No data state ── */}
      {records.length === 0 && (
        <div className="card hint-card">
          {isNow
            ? 'No paycheck recorded yet this week. Head to Paychecks to enter one.'
            : 'No paycheck recorded for this week.'}
          {hasPrev && (
            <button className="stats-jump-btn" onClick={goBack}>
              ← Jump to last recorded week
            </button>
          )}
        </div>
      )}

      {/* ── Weekly summary ── */}
      {records.length > 0 && (
        <>
          <div className="card stats-summary-card">
            <div className="stats-gross-row">
              <div>
                <div className="stats-gross-label">
                  {records.length === 1
                    ? `Paycheck on ${fmtDate(new Date(records[0].date))}`
                    : `${records.length} paychecks this week`}
                </div>
                <div className="stats-gross-amount">
                  ${weekGross.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="stats-gross-chips">
                <span className="stats-chip allocated">
                  ${(weekGross - weekUnallocated).toFixed(2)} allocated
                </span>
                {weekUnallocated > 0.005 && (
                  <span className="stats-chip unallocated">
                    ${weekUnallocated.toFixed(2)} unallocated
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="section-title">Allocation breakdown</h3>
            <div className="stats-alloc-list">
              {mergedLines.map(line => {
                const pct = weekGross > 0 ? (line.allocated / weekGross) * 100 : 0;
                return (
                  <div key={line.name} className={`stats-alloc-row${line.shortfall ? ' shortfall' : ''}`}>
                    <div className="stats-alloc-top">
                      <span className="stats-alloc-name">{line.name}</span>
                      <div className="stats-alloc-right">
                        <span className="stats-alloc-pct">{pct.toFixed(1)}%</span>
                        <span className={`stats-alloc-amount${line.shortfall ? ' shortfall' : ''}`}>
                          ${line.allocated.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="stats-bar-track">
                      <div
                        className={`stats-bar-fill${line.shortfall ? ' shortfall' : ''}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              {weekUnallocated > 0.005 && (
                <div className="stats-alloc-row">
                  <div className="stats-alloc-top">
                    <span className="stats-alloc-name muted">Unallocated</span>
                    <div className="stats-alloc-right">
                      <span className="stats-alloc-pct muted">
                        {((weekUnallocated / weekGross) * 100).toFixed(1)}%
                      </span>
                      <span className="stats-alloc-amount muted">
                        ${weekUnallocated.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="stats-bar-track">
                    <div
                      className="stats-bar-fill unallocated"
                      style={{ width: `${Math.min(100, (weekUnallocated / weekGross) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Multiple paychecks breakdown ── */}
          {records.length > 1 && (
            <div className="card">
              <h3 className="section-title">Individual paychecks</h3>
              <div className="stats-individual-list">
                {records.map(r => (
                  <div key={r.id} className="stats-individual-row">
                    <span className="stats-indiv-date">{fmtDate(new Date(r.date))}</span>
                    <span className="stats-indiv-amount">
                      ${r.gross.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── What was paid this week ── */}
          {(billsDueThisWeek.length > 0 || loanPaymentsThisWeek.length > 0) && (
            <div className="card">
              <h3 className="section-title">What was paid this week</h3>

              {billsDueThisWeek.length > 0 && (
                <div className="stats-pay-section">
                  <div className="stats-pay-section-label">Bills &amp; Expenses</div>
                  {billsDueThisWeek.map(({ bill, occ, deposited, paid, remaining }) => {
                    const pct = bill.amount > 0 ? Math.min(100, (deposited / bill.amount) * 100) : 0;
                    return (
                      <div key={bill.id} className="stats-pay-row">
                        <span className="stats-pay-dot" style={{ background: bill.color }} />
                        <div className="stats-pay-info">
                          <div className="stats-pay-top">
                            <span className="stats-pay-name">{bill.name}</span>
                            <span className={`stats-pay-badge ${paid ? 'paid' : deposited > 0 ? 'partial' : 'unpaid'}`}>
                              {paid ? 'Paid' : deposited > 0 ? 'Partial' : 'Unpaid'}
                            </span>
                          </div>
                          <div className="stats-pay-sub">
                            due {fmtDate(occ)} ·{' '}
                            {paid
                              ? `$${bill.amount.toFixed(2)}`
                              : deposited > 0
                              ? `$${deposited.toFixed(2)} of $${bill.amount.toFixed(2)} — $${remaining.toFixed(2)} left`
                              : `$${bill.amount.toFixed(2)} outstanding`}
                          </div>
                          {deposited > 0 && !paid && (
                            <div className="stats-pay-bar-track">
                              <div className="stats-pay-bar-fill" style={{ width: `${pct}%`, background: bill.color }} />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {loanPaymentsThisWeek.length > 0 && (
                <div className="stats-pay-section">
                  <div className="stats-pay-section-label">Loan Payments</div>
                  {loanPaymentsThisWeek.map(({ loan, payment }) => {
                    const totalPaid = loan.payments.reduce((s, p) => s + p.amount, 0);
                    const pct       = loan.totalAmount > 0 ? Math.min(100, (totalPaid / loan.totalAmount) * 100) : 0;
                    return (
                      <div key={payment.id} className="stats-pay-row">
                        <span className="stats-pay-dot" style={{ background: loan.color }} />
                        <div className="stats-pay-info">
                          <div className="stats-pay-top">
                            <span className="stats-pay-name">{loan.name}</span>
                            <span className="stats-pay-amount">${payment.amount.toFixed(2)}</span>
                          </div>
                          <div className="stats-pay-sub">
                            {payment.date} · {pct.toFixed(0)}% of ${loan.totalAmount.toFixed(2)} paid off
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

    </div>
  );
}
