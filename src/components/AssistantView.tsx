import type { Priority, PaycheckRecord, Bill, Goal, Loan } from '../types';
import { allocate } from '../allocate';

interface Props {
  history:    PaycheckRecord[];
  priorities: Priority[];
  bills:      Bill[];
  goals:      Goal[];
  loans:      Loan[];
}

const WKPM = 52 / 12;

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function thisWeekMonday(): Date {
  const now = new Date();
  const dow = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function getThisWeekPaycheck(history: PaycheckRecord[]): PaycheckRecord | null {
  const monday = thisWeekMonday();
  return (
    [...history]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .find(r => new Date(r.date + 'T00:00:00') >= monday) ?? null
  );
}

// Average gross of last N paychecks before this week
function predictWeeklyIncome(history: PaycheckRecord[]): number | null {
  const monday = thisWeekMonday();
  const past = [...history]
    .filter(r => new Date(r.date + 'T00:00:00') < monday)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);
  if (past.length === 0) return null;
  return past.reduce((s, r) => s + r.gross, 0) / past.length;
}

function priorityTier(p: Priority): 'essential' | 'flexible' | 'discretionary' {
  if (p.type === 'fixed')      return 'essential';
  if (p.type === 'percentage') return 'flexible';
  return 'discretionary';
}

// Find how much has been deposited toward a bill in its current active period
function getActiveDeposited(bill: Bill): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const y  = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');

  let periodKey: string;

  if (bill.recurrence === 'monthly' || bill.recurrence === 'quarterly') {
    periodKey = `${y}-${mo}`;
  } else if (bill.recurrence === 'yearly') {
    periodKey = `${y}`;
  } else if (bill.recurrence === 'one-time' && bill.dueDate) {
    periodKey = bill.dueDate;
  } else if (bill.startDate) {
    const step =
      bill.recurrence === 'weekly'      ? 7 :
      bill.recurrence === 'fortnightly' ? 14 :
      (bill.intervalDays ?? 1);
    let cur = new Date(bill.startDate + 'T00:00:00');
    cur.setHours(0, 0, 0, 0);
    let active = new Date(cur);
    // advance to the most recent occurrence on or before today
    while (cur <= now) {
      active = new Date(cur);
      cur.setDate(cur.getDate() + step);
    }
    periodKey = fmtDate(active);
  } else {
    return 0;
  }

  return (bill.deposits ?? {})[periodKey] ?? 0;
}

interface UpcomingBill {
  bill:       Bill;
  dueDate:    Date;
  periodKey:  string;
  deposited:  number;
  remaining:  number;
  paid:       boolean;
}

function billPeriodKey(bill: Bill, d: Date): string {
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  if (bill.recurrence === 'monthly' || bill.recurrence === 'quarterly') return `${y}-${mo}`;
  if (bill.recurrence === 'yearly') return `${y}`;
  return `${y}-${mo}-${dd}`;
}

function billsDueSoon(bills: Bill[]): UpcomingBill[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lookahead = new Date(today);
  lookahead.setDate(today.getDate() + 7);

  const results: UpcomingBill[] = [];

  for (const b of bills) {
    const candidates: Date[] = [];

    if (b.recurrence === 'one-time' && b.dueDate) {
      candidates.push(new Date(b.dueDate));
    } else if (b.recurrence === 'monthly') {
      const d = new Date(today.getFullYear(), today.getMonth(), b.dueDay);
      candidates.push(d);
      candidates.push(new Date(today.getFullYear(), today.getMonth() + 1, b.dueDay));
    } else if (b.recurrence === 'yearly' && b.dueMonth) {
      const d = new Date(today.getFullYear(), b.dueMonth - 1, b.dueDay);
      candidates.push(d);
      candidates.push(new Date(today.getFullYear() + 1, b.dueMonth - 1, b.dueDay));
    } else if (b.startDate && (b.recurrence === 'weekly' || b.recurrence === 'fortnightly' || b.recurrence === 'interval')) {
      const step =
        b.recurrence === 'weekly'      ? 7 :
        b.recurrence === 'fortnightly' ? 14 :
        (b.intervalDays ?? 1);
      let d = new Date(b.startDate);
      d.setHours(0, 0, 0, 0);
      while (d <= lookahead) {
        if (d >= today) candidates.push(new Date(d));
        d.setDate(d.getDate() + step);
      }
    } else if (b.recurrence === 'quarterly' && b.startDate) {
      let d = new Date(b.startDate);
      d.setHours(0, 0, 0, 0);
      while (d <= lookahead) {
        if (d >= today) candidates.push(new Date(d));
        d.setMonth(d.getMonth() + 3);
      }
    }

    for (const c of candidates) {
      c.setHours(0, 0, 0, 0);
      if (c >= today && c <= lookahead) {
        const periodKey = billPeriodKey(b, c);
        const deposited = (b.deposits ?? {})[periodKey] ?? 0;
        const paid      = b.paidPeriods.includes(periodKey) || (b.amount > 0 && deposited >= b.amount);
        const remaining = Math.max(0, b.amount - deposited);
        results.push({ bill: b, dueDate: c, periodKey, deposited, remaining, paid });
        break;
      }
    }
  }

  // Unpaid first (soonest due), paid at the bottom
  return results.sort((a, b) => {
    if (a.paid !== b.paid) return a.paid ? 1 : -1;
    return a.dueDate.getTime() - b.dueDate.getTime();
  });
}

interface UpcomingInstallment {
  loan:      Loan;
  insId:     string;
  dueDate:   Date;
  amount:    number;
  paid:      boolean;
  overdue:   boolean;
}

function loansDueSoon(loans: Loan[]): UpcomingInstallment[] {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const horizon = new Date(today); horizon.setDate(today.getDate() + 7);
  const results: UpcomingInstallment[] = [];
  for (const loan of loans) {
    if (loan.completed || loan.type !== 'pay-in-4' || !loan.installments) continue;
    for (const ins of loan.installments) {
      if (ins.paid) continue;
      const d = new Date(ins.dueDate + 'T00:00:00');
      if (d <= horizon) {
        results.push({
          loan, insId: ins.id, dueDate: d, amount: ins.amount,
          paid: false, overdue: d < today,
        });
      }
    }
  }
  return results.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

function activeCustomLoans(loans: Loan[]): { loan: Loan; remaining: number }[] {
  return loans
    .filter(l => !l.completed && l.type === 'custom')
    .map(l => ({
      loan: l,
      remaining: Math.max(0, l.totalAmount - l.payments.reduce((s, p) => s + p.amount, 0)),
    }))
    .filter(x => x.remaining > 0);
}

export function AssistantView({ history, priorities, bills, goals, loans }: Props) {
  const record        = getThisWeekPaycheck(history);
  const upcoming      = billsDueSoon(bills);
  const activeGoals   = goals.filter(g => !g.completed);
  const upcomingLoans = loansDueSoon(loans);
  const customLoans   = activeCustomLoans(loans);
  const predicted     = predictWeeklyIncome(history);

  // No paycheck this week — show prediction + preview allocation
  if (!record) {
    const previewGross  = predicted ?? 0;
    const previewResult = previewGross > 0 ? allocate(previewGross, priorities) : null;
    return (
      <div className="view">
        <div className="card assistant-guide-card">
          <div className="guide-header">
            <div>
              <h2 className="guide-title">This Week's Guide</h2>
              <p className="guide-sub">No paycheck entered yet for this week.</p>
            </div>
          </div>
          {predicted !== null ? (
            <div className="guide-prediction-banner">
              <span className="guide-prediction-label">Based on your last paychecks, you're expected to earn approximately</span>
              <span className="guide-prediction-amount">${predicted.toFixed(2)}</span>
              <span className="guide-prediction-label">this week. Here's what your allocation would look like — enter your actual paycheck in <strong>Paychecks</strong> to confirm.</span>
            </div>
          ) : (
            <p className="guide-hint">
              Head to <strong>Paychecks</strong> and enter your gross amount for this week to see your allocation guide.
            </p>
          )}
        </div>

        {previewResult && priorities.length > 0 && (
          <div className="card">
            <h3 className="section-title">
              Preview allocation
              <span className="guide-preview-badge">estimated</span>
            </h3>
            <div className="guide-steps">
              {previewResult.lines.map((line, i) => {
                const tier = priorityTier(line.priority);
                return (
                  <div key={line.priority.id} className={`guide-step${line.shortfall ? ' guide-step-warn' : ''}`}>
                    <span className="guide-step-num">{i + 1}</span>
                    <div className="guide-step-body">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="guide-step-name">{line.priority.name}</span>
                        <span className={`guide-tier-badge guide-tier-${tier}`}>
                          {tier === 'essential' ? 'Essential' : tier === 'flexible' ? 'Flexible' : 'Discretionary'}
                        </span>
                      </div>
                      <span className={`guide-step-amount${line.shortfall ? ' shortfall' : ''}`}>
                        ${line.allocated.toFixed(2)}
                      </span>
                    </div>
                    <div className="guide-bar-track">
                      <div className="guide-bar-fill" style={{ width: `${Math.min(100, line.pct)}%` }} />
                    </div>
                  </div>
                );
              })}
              {previewResult.unallocated > 0.005 && (
                <div className="guide-step guide-step-unalloc">
                  <span className="guide-step-num">→</span>
                  <div className="guide-step-body">
                    <span className="guide-step-name muted">Unallocated</span>
                    <span className="guide-step-amount muted">${previewResult.unallocated.toFixed(2)}</span>
                  </div>
                  <div className="guide-bar-track">
                    <div className="guide-bar-fill unallocated" style={{ width: `${(previewResult.unallocated / previewGross) * 100}%` }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  const { gross, date } = record;
  const result       = allocate(gross, priorities);
  const hasShortfall = result.lines.some(l => l.shortfall);

  // Is this a meaningfully lower-than-expected week? (more than 5% below average)
  const isLowWeek  = predicted !== null && gross < predicted * 0.95;
  const isGoodWeek = predicted !== null && gross >= predicted;
  const delta      = predicted !== null ? gross - predicted : null;

  // Non-essential priorities the user should hold off on this low week
  const holdOffLines = isLowWeek
    ? result.lines.filter(l => priorityTier(l.priority) !== 'essential' && l.allocated > 0)
    : [];

  // Map linkKey → deposited amount for the current active period of each bill
  const depositMap = new Map<string, number>();
  for (const b of bills) {
    const lk = (b.linkKey ?? b.name).trim().toLowerCase();
    const dep = getActiveDeposited(b);
    if (dep > 0) depositMap.set(lk, dep);
  }

  return (
    <div className="view">

      {/* ── Summary banner ── */}
      <div className="card assistant-guide-card">
        <div className="guide-header">
          <div>
            <h2 className="guide-title">This Week's Allocation Guide</h2>
            <p className="guide-sub">
              Paycheck of <strong>${gross.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> entered on {fmtDate(new Date(date + 'T00:00:00'))}
            </p>
          </div>
          {delta !== null && (
            <span className={`guide-delta-chip${isLowWeek ? ' low' : isGoodWeek ? ' good' : ''}`}>
              {isGoodWeek
                ? `↑ $${Math.abs(delta).toFixed(2)} above avg`
                : isLowWeek
                ? `↓ $${Math.abs(delta).toFixed(2)} below avg`
                : `≈ avg $${predicted!.toFixed(2)}`}
            </span>
          )}
        </div>

        {hasShortfall && (
          <div className="guide-warning">
            Your paycheck doesn't fully cover all fixed expenses this week. Essentials are funded first.
          </div>
        )}
      </div>

      {/* ── Tight week advice ── */}
      {isLowWeek && holdOffLines.length > 0 && (
        <div className="card guide-tight-card">
          <div className="guide-tight-header">
            <span className="guide-tight-icon">⚠</span>
            <div>
              <span className="guide-tight-title">Tighter week than usual</span>
              <span className="guide-tight-sub">
                ${gross.toFixed(2)} vs avg ${predicted!.toFixed(2)} — focus on essentials this week.
              </span>
            </div>
          </div>
          <div className="guide-tight-body">
            <span className="guide-tight-label">Consider holding off on:</span>
            <div className="guide-tight-list">
              {holdOffLines.map(l => (
                <div key={l.priority.id} className="guide-tight-row">
                  <span className={`guide-tier-badge guide-tier-${priorityTier(l.priority)}`}>
                    {priorityTier(l.priority) === 'flexible' ? 'Flexible' : 'Discretionary'}
                  </span>
                  <span className="guide-tight-name">{l.priority.name}</span>
                  <span className="guide-tight-amount">${l.allocated.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <p className="guide-tight-note">
              Your essentials (Rent, Bills, Loans) are still fully covered. Resume normal contributions next week.
            </p>
          </div>
        </div>
      )}

      {/* ── Step-by-step allocations ── */}
      {priorities.length > 0 && (
        <div className="card">
          <h3 className="section-title">Where to put your money</h3>
          <div className="guide-steps">
            {result.lines.map((line, i) => {
              const lk          = (line.priority.linkKey ?? line.priority.name).trim().toLowerCase();
              const deposited   = depositMap.get(lk) ?? 0;
              const expectedPct = Math.min(100, Math.max(0, line.pct));
              const actualPct   = gross > 0 ? Math.min(100, (deposited / gross) * 100) : 0;
              const tier        = priorityTier(line.priority);
              const isDimmed    = isLowWeek && tier !== 'essential';
              return (
              <div key={line.priority.id} className={`guide-step${line.shortfall ? ' guide-step-warn' : ''}${isDimmed ? ' guide-step-dimmed' : ''}`}>
                <span className="guide-step-num">{i + 1}</span>
                <div className="guide-step-body">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span className="guide-step-name">{line.priority.name}</span>
                    <span className={`guide-tier-badge guide-tier-${tier}`}>
                      {tier === 'essential' ? 'Essential' : tier === 'flexible' ? 'Flexible' : 'Discretionary'}
                    </span>
                  </div>
                  <span className={`guide-step-amount${line.shortfall ? ' shortfall' : ''}`}>
                    ${line.allocated.toFixed(2)}
                    {line.shortfall && (
                      <span className="guide-step-note"> (short — need ${((line.priority.amount ?? 0) / WKPM).toFixed(2)})</span>
                    )}
                    {!line.shortfall && line.priority.type === 'fixed' && (
                      <span className="guide-step-note"> / ${((line.priority.amount ?? 0) / WKPM).toFixed(2)} needed</span>
                    )}
                    {line.priority.type === 'percentage' && (
                      <span className="guide-step-note"> ({line.pct.toFixed(1)}%)</span>
                    )}
                  </span>
                </div>
                <div className="guide-bar-track guide-bar-dual">
                  <div className="guide-bar-expected" style={{ width: `${expectedPct}%` }} />
                  {deposited > 0 && (
                    <div className="guide-bar-actual" style={{ width: `${actualPct}%` }} />
                  )}
                </div>
              </div>
              );
            })}

            {result.unallocated > 0.005 && (
              <div className="guide-step guide-step-unalloc">
                <span className="guide-step-num">→</span>
                <div className="guide-step-body">
                  <span className="guide-step-name muted">Unallocated</span>
                  <span className="guide-step-amount muted">${result.unallocated.toFixed(2)}</span>
                </div>
                <div className="guide-bar-track">
                  <div className="guide-bar-fill unallocated" style={{ width: `${(result.unallocated / gross) * 100}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Goal contributions ── */}
      {activeGoals.length > 0 && (
        <div className="card">
          <h3 className="section-title">Savings goals this paycheck</h3>
          <div className="guide-goals">
            {activeGoals.map(g => {
              const ppc =
                g.allocationMode === 'fixed' && g.monthlyAllocation
                  ? g.monthlyAllocation / WKPM
                  : g.months > 0
                  ? (g.targetAmount - g.saved) / (g.months * WKPM)
                  : null;
              const pct = g.targetAmount > 0 ? (g.saved / g.targetAmount) * 100 : 0;
              return (
                <div key={g.id} className="guide-goal-row">
                  <div className="guide-goal-top">
                    <span className="guide-goal-name">{g.name}</span>
                    <span className="guide-goal-amount">
                      {ppc !== null ? `$${ppc.toFixed(2)}/paycheck` : 'no schedule'}
                    </span>
                  </div>
                  <div className="guide-goal-meta">
                    ${g.saved.toFixed(2)} of ${g.targetAmount.toFixed(2)} saved — {pct.toFixed(0)}%
                  </div>
                  <div className="guide-bar-track">
                    <div className="guide-bar-fill" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Upcoming loan installments ── */}
      {(upcomingLoans.length > 0 || customLoans.length > 0) && (
        <div className="card">
          <h3 className="section-title">Loans & Repayments</h3>
          <div className="guide-bills">

            {upcomingLoans.map(({ loan, insId, dueDate, amount, overdue }) => {
              const today = new Date(); today.setHours(0, 0, 0, 0);
              const days  = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
              const paidCount   = loan.installments!.filter(i => i.paid).length;
              const totalCount  = loan.installments!.length;
              return (
                <div key={`${loan.id}-${insId}`} className={`guide-bill-row${overdue ? ' guide-bill-overdue' : ''}`}>
                  <div className="guide-bill-dot" style={{ background: loan.color }} />
                  <div className="guide-bill-info">
                    <span className="guide-bill-name">{loan.name}</span>
                    <span className="guide-bill-when">
                      {overdue
                        ? `Overdue — was due ${fmtDate(dueDate)}`
                        : days === 0 ? `Due today — ${fmtDate(dueDate)}`
                        : days === 1 ? `Due tomorrow — ${fmtDate(dueDate)}`
                        : `Due in ${days} days — ${fmtDate(dueDate)}`}
                      {' · '}{paidCount}/{totalCount} paid
                    </span>
                  </div>
                  <span className="guide-bill-amount" style={{ color: overdue ? 'var(--red)' : undefined }}>
                    ${amount.toFixed(2)}
                  </span>
                </div>
              );
            })}

            {customLoans.map(({ loan, remaining }) => {
              const paidSoFar = loan.payments.reduce((s, p) => s + p.amount, 0);
              const pct       = loan.totalAmount > 0 ? Math.min(100, (paidSoFar / loan.totalAmount) * 100) : 0;
              return (
                <div key={loan.id} className="guide-bill-row">
                  <div className="guide-bill-dot" style={{ background: loan.color }} />
                  <div className="guide-bill-info">
                    <span className="guide-bill-name">{loan.name}</span>
                    <span className="guide-bill-when">Custom repayment · {pct.toFixed(0)}% paid off</span>
                    <div className="guide-bill-progress">
                      <div className="guide-bar-track">
                        <div className="guide-bar-fill" style={{ width: `${pct}%`, background: loan.color }} />
                      </div>
                      <span className="guide-bill-prog-label">
                        ${paidSoFar.toFixed(2)} of ${loan.totalAmount.toFixed(2)} paid
                      </span>
                    </div>
                  </div>
                  <span className="guide-bill-amount">
                    <span style={{ color: 'var(--red)' }}>${remaining.toFixed(2)}</span>
                    <span className="guide-bill-remaining"> left</span>
                  </span>
                </div>
              );
            })}

          </div>
        </div>
      )}

      {/* ── Upcoming bills ── */}
      <div className="card">
        <h3 className="section-title">Bills due in the next 7 days</h3>
        {upcoming.length === 0 ? (
          <p className="empty-hint">No bills due in the next 7 days.</p>
        ) : (
          <div className="guide-bills">
            {upcoming.map(({ bill, dueDate, deposited, remaining, paid }) => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const days    = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
              const hasProg = bill.amount > 0 && deposited > 0;
              const pct     = bill.amount > 0 ? Math.min(100, (deposited / bill.amount) * 100) : 0;
              return (
                <div key={bill.id} className={`guide-bill-row${paid ? ' guide-bill-paid' : ''}`}>
                  <div className="guide-bill-dot" style={{ background: bill.color }} />
                  <div className="guide-bill-info">
                    <span className="guide-bill-name">{bill.name}</span>
                    <span className="guide-bill-when">
                      {paid
                        ? `Paid — due ${fmtDate(dueDate)}`
                        : days === 0 ? `Due today — ${fmtDate(dueDate)}`
                        : days === 1 ? `Due tomorrow — ${fmtDate(dueDate)}`
                        : `Due in ${days} days — ${fmtDate(dueDate)}`}
                    </span>
                    {hasProg && !paid && (
                      <div className="guide-bill-progress">
                        <div className="guide-bar-track">
                          <div className="guide-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="guide-bill-prog-label">
                          ${deposited.toFixed(2)} of ${bill.amount.toFixed(2)} deposited
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="guide-bill-amount">
                    {paid
                      ? <span style={{ color: 'var(--green)', fontWeight: 700 }}>✓ Paid</span>
                      : bill.amount > 0
                      ? (deposited > 0
                          ? <><span style={{ color: 'var(--green)' }}>${remaining.toFixed(2)}</span><span className="guide-bill-remaining"> left</span></>
                          : `$${bill.amount.toFixed(2)}`)
                      : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
