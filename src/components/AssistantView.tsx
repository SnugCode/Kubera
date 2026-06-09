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

// Handles both 'YYYY-MM-DD' (new) and full ISO strings (legacy records)
function parseRecordDate(s: string): Date {
  return s.includes('T') ? new Date(s) : new Date(s + 'T00:00:00');
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
      .find(r => parseRecordDate(r.date) >= monday) ?? null
  );
}

// Average gross of last N paychecks before this week
function predictWeeklyIncome(history: PaycheckRecord[]): number | null {
  const monday = thisWeekMonday();
  const past = [...history]
    .filter(r => parseRecordDate(r.date) < monday)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);
  if (past.length === 0) return null;
  return past.reduce((s, r) => s + r.gross, 0) / past.length;
}

// Top 4 priorities (by position) are essential — everything else is good-to-have
function priorityTier(index: number): 'essential' | 'good-to-have' {
  return index < 4 ? 'essential' : 'good-to-have';
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

function billPeriodKey(bill: Bill, d: Date): string {
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  if (bill.recurrence === 'monthly' || bill.recurrence === 'quarterly') return `${y}-${mo}`;
  if (bill.recurrence === 'yearly') return `${y}`;
  return `${y}-${mo}-${dd}`;
}

// First occurrence of a bill within [from, max] (both inclusive)
function findBillOccurrence(bill: Bill, from: Date, max: Date): Date | null {
  if (bill.recurrence === 'one-time' && bill.dueDate) {
    const d = new Date(bill.dueDate + 'T00:00:00');
    return d >= from && d <= max ? d : null;
  }
  if (bill.recurrence === 'monthly') {
    for (let mo = -2; mo <= 3; mo++) {
      const d = new Date(from.getFullYear(), from.getMonth() + mo, bill.dueDay);
      if (d >= from && d <= max) return d;
    }
    return null;
  }
  if (bill.recurrence === 'yearly' && bill.dueMonth && bill.dueDay) {
    for (let yr = -1; yr <= 2; yr++) {
      const d = new Date(from.getFullYear() + yr, bill.dueMonth - 1, bill.dueDay);
      if (d >= from && d <= max) return d;
    }
    return null;
  }
  if (bill.recurrence === 'quarterly' && bill.startDate) {
    let d = new Date(bill.startDate + 'T00:00:00'); d.setHours(0,0,0,0);
    while (d < from) { const n = new Date(d.getFullYear(), d.getMonth() + 3, d.getDate()); if (n > from) break; d = n; }
    for (let i = 0; i < 6; i++) {
      if (d >= from && d <= max) return d;
      d = new Date(d.getFullYear(), d.getMonth() + 3, d.getDate());
      if (d > max) break;
    }
    return null;
  }
  if (bill.startDate && ['weekly','fortnightly','interval'].includes(bill.recurrence)) {
    const step = bill.recurrence === 'weekly' ? 7 : bill.recurrence === 'fortnightly' ? 14 : (bill.intervalDays ?? 1);
    let d = new Date(bill.startDate + 'T00:00:00'); d.setHours(0,0,0,0);
    if (d > max) return null;
    while (d < from) d.setDate(d.getDate() + step);
    return d <= max ? new Date(d) : null;
  }
  return null;
}

type PayTag = 'overdue' | 'this-week' | 'quick-win' | 'this-month' | 'next-month';
const PAY_TAG_ORDER: PayTag[] = ['overdue', 'this-week', 'quick-win', 'this-month', 'next-month'];

interface PayAction {
  key:       string;
  tag:       PayTag;
  name:      string;
  suggest:   number;   // recommended amount to move NOW
  remaining: number;   // total still owed for this period
  dueStr:    string;
  color:     string;
  source:    'bill' | 'loan';
  deposited: number;
  total:     number;
  subLabel:  string;   // context shown under name
}

function buildPaymentPlan(bills: Bill[], loans: Loan[]): PayAction[] {
  const today        = new Date(); today.setHours(0,0,0,0);
  const yesterday    = new Date(today); yesterday.setDate(today.getDate() - 1);
  const past30       = new Date(today); past30.setDate(today.getDate() - 30);
  const in7          = new Date(today); in7.setDate(today.getDate() + 7);
  const endThisMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const endNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0);

  const actions: PayAction[] = [];

  // ── Bills ──
  for (const bill of bills) {
    if (bill.amount <= 0) continue;

    // Overdue: find most recent unpaid occurrence in the past 30 days
    const pastOcc = findBillOccurrence(bill, past30, yesterday);
    if (pastOcc) {
      const pKey      = billPeriodKey(bill, pastOcc);
      const deposited = (bill.deposits ?? {})[pKey] ?? 0;
      const paid      = bill.paidPeriods.includes(pKey) || deposited >= bill.amount;
      if (!paid) {
        const remaining = Math.max(0, bill.amount - deposited);
        actions.push({
          key: `bill-${bill.id}-ov`, tag: 'overdue',
          name: bill.name, suggest: remaining, remaining,
          dueStr: fmtDate(pastOcc), color: bill.color, source: 'bill',
          deposited, total: bill.amount,
          subLabel: `was due ${fmtDate(pastOcc)} · ${bill.recurrence}`,
        });
        continue;
      }
    }

    // Upcoming occurrence
    const upOcc = findBillOccurrence(bill, today, endNextMonth);
    if (!upOcc) continue;
    const pKey      = billPeriodKey(bill, upOcc);
    const deposited = (bill.deposits ?? {})[pKey] ?? 0;
    const paid      = bill.paidPeriods.includes(pKey) || deposited >= bill.amount;
    if (paid) continue;
    const remaining = Math.max(0, bill.amount - deposited);

    const isThisWeek  = upOcc <= in7;
    const isQuickWin  = !isThisWeek && (remaining <= 30 || (deposited > 0 && remaining <= bill.amount * 0.15));
    const isThisMonth = !isThisWeek && !isQuickWin && upOcc <= endThisMonth;

    const tag: PayTag = isThisWeek ? 'this-week' : isQuickWin ? 'quick-win' : isThisMonth ? 'this-month' : 'next-month';

    const days    = Math.round((upOcc.getTime() - today.getTime()) / 86400000);
    const dayStr  = days === 0 ? 'due today' : days === 1 ? 'due tomorrow' : `due in ${days} days`;
    const suggest = (tag === 'this-week' || tag === 'quick-win')
      ? remaining
      : Math.min(remaining, bill.amount / WKPM);

    actions.push({
      key: `bill-${bill.id}`, tag,
      name: bill.name, suggest, remaining,
      dueStr: fmtDate(upOcc), color: bill.color, source: 'bill',
      deposited, total: bill.amount,
      subLabel: `${dayStr} — ${fmtDate(upOcc)} · ${bill.recurrence}`,
    });
  }

  // ── Pay-in-4 loan installments (only the next unpaid one per loan) ──
  for (const loan of loans) {
    if (loan.completed || loan.type !== 'pay-in-4' || !loan.installments) continue;
    const unpaid = loan.installments.filter(i => !i.paid).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    if (unpaid.length === 0) continue;
    const ins        = unpaid[0];
    const d          = new Date(ins.dueDate + 'T00:00:00');
    const paidCount  = loan.installments.filter(i => i.paid).length;
    const totalCount = loan.installments.length;
    const days       = Math.round((d.getTime() - today.getTime()) / 86400000);
    const dayStr     = d < today ? `overdue — was due ${ins.dueDate}` : days === 0 ? 'due today' : days === 1 ? 'due tomorrow' : `due in ${days} days`;

    const tag: PayTag = d < today ? 'overdue' : d <= in7 ? 'this-week' : d <= endThisMonth ? 'this-month' : 'next-month';

    actions.push({
      key: `loan-p4-${loan.id}-${ins.id}`, tag,
      name: loan.name, suggest: ins.amount, remaining: ins.amount,
      dueStr: ins.dueDate, color: loan.color, source: 'loan',
      deposited: paidCount, total: totalCount,
      subLabel: `${dayStr} · installment ${paidCount + 1}/${totalCount}`,
    });
  }

  // ── Custom loans ──
  for (const loan of loans) {
    if (loan.completed || loan.type !== 'custom') continue;
    const paidAmt   = loan.payments.reduce((s, p) => s + p.amount, 0);
    const remaining = Math.max(0, loan.totalAmount - paidAmt);
    if (remaining <= 0) continue;

    const tag: PayTag   = remaining <= 50 ? 'quick-win' : 'this-month';
    const suggest       = tag === 'quick-win' ? remaining : Math.min(remaining, loan.totalAmount / (WKPM * 2));
    const pct           = Math.round((paidAmt / loan.totalAmount) * 100);

    actions.push({
      key: `loan-custom-${loan.id}`, tag,
      name: loan.name, suggest: Math.min(suggest, remaining), remaining,
      dueStr: 'flexible', color: loan.color, source: 'loan',
      deposited: paidAmt, total: loan.totalAmount,
      subLabel: `custom repayment · ${pct}% paid off`,
    });
  }

  return actions.sort((a, b) => PAY_TAG_ORDER.indexOf(a.tag) - PAY_TAG_ORDER.indexOf(b.tag));
}

export function AssistantView({ history, priorities, bills, goals, loans }: Props) {
  const record      = getThisWeekPaycheck(history);
  const activeGoals = goals.filter(g => !g.completed);
  const predicted   = predictWeeklyIncome(history);
  const paymentPlan = buildPaymentPlan(bills, loans);

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
                const tier = priorityTier(i);
                return (
                  <div key={line.priority.id} className={`guide-step${line.shortfall ? ' guide-step-warn' : ''}`}>
                    <span className="guide-step-num">{i + 1}</span>
                    <div className="guide-step-body">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="guide-step-name">{line.priority.name}</span>
                        <span className={`guide-tier-badge guide-tier-${tier}`}>
                          {tier === 'essential' ? 'Essential' : 'Good to have'}
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

  // Non-essential priorities the user should hold off on this low week (positions 4+)
  const holdOffLines = isLowWeek
    ? result.lines.filter((l, i) => i >= 4 && l.allocated > 0)
    : [];

  // Map linkKey → deposited amount for the current active period of each bill
  const depositMap = new Map<string, number>();
  for (const b of bills) {
    const lk = (b.linkKey ?? b.name).trim().toLowerCase();
    const dep = getActiveDeposited(b);
    if (dep > 0) depositMap.set(lk, dep);
  }

  // Bills aggregator: sum deposits across bill-category items that don't have their own priority
  const billsAggDeposited = bills
    .filter(b => {
      if ((b.category ?? 'bill') !== 'bill') return false;
      const lk = (b.linkKey ?? b.name).trim().toLowerCase();
      return !priorities.some(p => !p.autoSum && !p.loansAutoSum && (p.linkKey ?? p.name).trim().toLowerCase() === lk);
    })
    .reduce((sum, b) => sum + getActiveDeposited(b), 0);
  if (billsAggDeposited > 0) depositMap.set('bills', billsAggDeposited);

  // Loans aggregator: sum all payments toward active loans (cumulative, not just this week)
  const monday = thisWeekMonday();
  const loansAggDeposited = loans.reduce((sum, loan) =>
    sum + loan.payments
      .filter(p => parseRecordDate(p.date) >= monday)
      .reduce((s, p) => s + p.amount, 0), 0);
  if (loansAggDeposited > 0) depositMap.set('loans', loansAggDeposited);

  // Quick lookup: linkKey → Bill (for multi-week saving detection)
  const billMap = new Map<string, Bill>();
  for (const b of bills) billMap.set((b.linkKey ?? b.name).trim().toLowerCase(), b);

  return (
    <div className="view">

      {/* ── Summary banner ── */}
      <div className="card assistant-guide-card">
        <div className="guide-header">
          <div>
            <h2 className="guide-title">This Week's Allocation Guide</h2>
            <p className="guide-sub">
              Paycheck of <strong>${gross.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> entered on {fmtDate(parseRecordDate(date))}
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
                  <span className="guide-tier-badge guide-tier-good-to-have">
                    Good to have
                  </span>
                  <span className="guide-tight-name">{l.priority.name}</span>
                  <span className="guide-tight-amount">${l.allocated.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <p className="guide-tight-note">
              Your top 4 priorities are still fully covered. Resume normal contributions next week.
            </p>
          </div>
        </div>
      )}

      {/* ── Step-by-step allocations ── */}
      {priorities.length > 0 && (() => {
        // Pre-compute per-line deposit state
        const lineData = result.lines.map((line, i) => {
          const lk        = (line.priority.linkKey ?? line.priority.name).trim().toLowerCase();
          const deposited = depositMap.get(lk) ?? 0;
          const overage   = deposited > line.allocated + 0.01 ? deposited - line.allocated : 0;

          // Resolve a savings target — the total amount the user is saving toward
          const billTarget: number | null =
            line.priority.autoSum      ? (line.priority.amount ?? null) :
            line.priority.loansAutoSum ? (line.priority.amount ?? null) :
            (billMap.get(lk)?.amount ?? null);

          // Multi-week saving: deposited more than this week's slice, but still under the full target
          const isMultiWeek  = overage > 0 && billTarget != null && deposited < billTarget - 0.01;
          // Fully covered: deposited at or past the total target
          const isFullySaved = overage > 0 && billTarget != null && deposited >= billTarget - 0.01;
          // Genuinely over budget: no bill target to compare against, just over this week's slice
          const isOver       = overage > 0 && !isMultiWeek && !isFullySaved;

          return { line, i, lk, deposited, overage, billTarget, isMultiWeek, isFullySaved, isOver };
        });
        // Only count lines that are truly over (not multi-week saving) for the banner
        const totalOverage = lineData.reduce((s, d) => s + (d.isOver ? d.overage : 0), 0);
        const overCount    = lineData.filter(d => d.isOver).length;

        return (
        <div className="card">
          <h3 className="section-title">Where to put your money</h3>

          {totalOverage > 0.01 && (
            <div className="guide-over-note">
              You've deposited <strong>${totalOverage.toFixed(2)}</strong> more than planned across {overCount} item{overCount !== 1 ? 's' : ''}.
              Items shown in amber are over-budget — unfunded priorities have less room as a result.
            </div>
          )}

          <div className="guide-steps">
            {lineData.map(({ line, i, deposited, overage, billTarget, isMultiWeek, isFullySaved, isOver }) => {
              const expectedPct = Math.min(100, Math.max(0, line.pct));
              const actualPct   = gross > 0 ? Math.min(100, (deposited / gross) * 100) : 0;
              const savePct     = billTarget && billTarget > 0 ? Math.min(100, (deposited / billTarget) * 100) : 0;
              const tier        = priorityTier(i);
              const isDimmed    = isLowWeek && tier !== 'essential';
              return (
              <div key={line.priority.id} className={`guide-step${line.shortfall ? ' guide-step-warn' : ''}${isDimmed ? ' guide-step-dimmed' : ''}${isOver ? ' guide-step-over' : ''}${isFullySaved ? ' guide-step-full' : ''}`}>
                <span className="guide-step-num">{i + 1}</span>
                <div className="guide-step-body">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span className="guide-step-name">{line.priority.name}</span>
                    <span className={`guide-tier-badge guide-tier-${tier}`}>
                      {tier === 'essential' ? 'Essential' : 'Good to have'}
                    </span>
                    {isOver       && <span className="guide-over-chip">↑ +${overage.toFixed(2)} over</span>}
                    {isFullySaved && <span className="guide-saved-chip">✓ Fully covered</span>}
                  </div>
                  <span className={`guide-step-amount${line.shortfall ? ' shortfall' : ''}${isOver ? ' over-alloc' : ''}`}>
                    ${isOver ? deposited.toFixed(2) : line.allocated.toFixed(2)}
                    {isOver && (
                      <span className="guide-step-note"> (suggested ${line.allocated.toFixed(2)})</span>
                    )}
                    {isMultiWeek && (
                      <span className="guide-step-note"> this paycheck</span>
                    )}
                    {isFullySaved && (
                      <span className="guide-step-note"> · ${deposited.toFixed(2)} saved</span>
                    )}
                    {!isOver && !isMultiWeek && !isFullySaved && line.shortfall && (
                      <span className="guide-step-note"> (short — need ${((line.priority.amount ?? 0) / WKPM).toFixed(2)})</span>
                    )}
                    {!isOver && !isMultiWeek && !isFullySaved && !line.shortfall && line.priority.type === 'fixed' && (
                      <span className="guide-step-note"> / ${((line.priority.amount ?? 0) / WKPM).toFixed(2)} needed</span>
                    )}
                    {!isOver && !isMultiWeek && !isFullySaved && line.priority.type === 'percentage' && (
                      <span className="guide-step-note"> ({line.pct.toFixed(1)}%)</span>
                    )}
                  </span>
                </div>

                {/* Allocation bar — this paycheck's contribution */}
                <div className="guide-bar-track guide-bar-dual">
                  <div className="guide-bar-expected" style={{ width: `${expectedPct}%` }} />
                  {deposited > 0 && !isMultiWeek && !isFullySaved && (
                    <div className={`guide-bar-actual${isOver ? ' over' : ''}`} style={{ width: `${actualPct}%` }} />
                  )}
                </div>

                {/* Cumulative savings progress bar for multi-week items */}
                {(isMultiWeek || isFullySaved) && billTarget != null && (
                  <div className="guide-cumulative">
                    <div className="guide-cumulative-label">
                      <span className="guide-cumulative-saved">${deposited.toFixed(2)} saved</span>
                      <span className="guide-cumulative-of"> of ${billTarget.toFixed(2)}</span>
                      <span className="guide-cumulative-pct"> · {savePct.toFixed(0)}%</span>
                      {isMultiWeek && (
                        <span className="guide-cumulative-left"> · ${(billTarget - deposited).toFixed(2)} to go</span>
                      )}
                    </div>
                    <div className={`guide-cumulative-track${isFullySaved ? ' done' : ''}`}>
                      <div className="guide-cumulative-fill" style={{ width: `${savePct}%` }} />
                    </div>
                  </div>
                )}
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
        );
      })()}

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

      {/* ── Payment plan ── */}
      <div className="card">
        <h3 className="section-title">Payment plan</h3>
        {paymentPlan.length === 0 ? (
          <p className="empty-hint">No upcoming bills or loans.</p>
        ) : (() => {
          // Group by tag and render with section headers
          const groups: { tag: PayTag; label: string; items: PayAction[] }[] = [
            { tag: 'overdue',    label: 'Overdue',         items: [] },
            { tag: 'this-week',  label: 'This week',       items: [] },
            { tag: 'quick-win',  label: 'Quick wins',      items: [] },
            { tag: 'this-month', label: 'This month',      items: [] },
            { tag: 'next-month', label: 'Heads up',        items: [] },
          ];
          for (const action of paymentPlan) {
            groups.find(g => g.tag === action.tag)!.items.push(action);
          }
          return (
            <div className="pay-plan-list">
              {groups.filter(g => g.items.length > 0).map((group, gi) => (
                <div key={group.tag}>
                  {gi > 0 && <div className="pay-plan-divider" />}
                  <div className={`pay-plan-group-label pay-tag-${group.tag}`}>{group.label}</div>
                  {group.items.map(action => {
                    const pct        = action.total > 0 ? Math.min(100, (action.deposited / action.total) * 100) : 0;
                    const showBar    = action.source === 'bill' ? action.deposited > 0 && action.total > 0 : action.source === 'loan' && action.tag !== 'this-week' && action.tag !== 'overdue';
                    const isPayAll   = Math.abs(action.suggest - action.remaining) < 0.01;
                    // For p4 loans the deposited/total are installment counts, not amounts
                    const isP4Loan   = action.source === 'loan' && action.total <= 4 && Number.isInteger(action.total);
                    return (
                      <div key={action.key} className={`pay-action-row pay-action-${action.tag}`}>
                        <div className="pay-action-left">
                          <div className="pay-action-top">
                            <span className="pay-action-dot" style={{ background: action.color }} />
                            <span className="pay-action-name">{action.name}</span>
                            <span className={`pay-tag-chip pay-tag-${action.tag}`}>
                              {group.label}
                            </span>
                          </div>
                          <span className="pay-action-sub">{action.subLabel}</span>
                          {showBar && !isP4Loan && (
                            <div className="pay-action-bar-wrap">
                              <div className="deposit-bar-track">
                                <div className="deposit-bar-fill" style={{ width: `${pct}%`, background: action.color }} />
                              </div>
                              <span className="pay-action-bar-label">
                                ${action.deposited.toFixed(2)} of ${action.total.toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="pay-action-right">
                          <span className="pay-action-suggest">${action.suggest.toFixed(2)}</span>
                          <span className="pay-action-verb">
                            {isPayAll ? 'to clear' : 'to set aside'}
                          </span>
                          {!isPayAll && (
                            <span className="pay-action-remaining">${action.remaining.toFixed(2)} total</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          );
        })()}
      </div>

    </div>
  );
}
