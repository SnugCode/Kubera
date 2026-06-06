import { useState } from 'react';
import type { Bill, BillRecurrence, Priority, Goal } from '../types';

interface Props {
  bills: Bill[];
  onChange: (bills: Bill[]) => void;
  priorities: Priority[];
  onPrioritiesChange: (priorities: Priority[]) => void;
  goals: Goal[];
}

function getLinkKey(item: { linkKey?: string; name: string }): string {
  return (item.linkKey ?? item.name).trim().toLowerCase();
}

// Unified event used for display — can come from a Bill or a fixed Priority
interface CalEvent {
  key: string;
  name: string;
  amount: number;
  color: string;
  day: number;
  meta: string;
  paid: boolean;
  source: 'bill' | 'priority';
  billRef?: Bill;
  priorityRef?: Priority;
}

interface Form {
  name: string;
  amount: string;
  recurrence: BillRecurrence;
  dueDay: string;
  dueMonth: string;
  dueDate: string;
  startDate: string;
  intervalDays: string;
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_LABELS  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const PALETTE     = ['#176b41','#b84040','#2e6b9a','#8a5c2e','#6b2e8a','#1a7c7c','#7c6b1a'];
const PRIORITY_COLOR = '#15251b';

const emptyForm: Form = {
  name: '', amount: '', recurrence: 'monthly', dueDay: '', dueMonth: '', dueDate: '',
  startDate: '', intervalDays: '',
};

// ── Helpers ───────────────────────────────────────────

function buildDays(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1).getDay();
  const total = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(first).fill(null);
  for (let d = 1; d <= total; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function billPaidKey(bill: Bill, year: number, month: number, day: number): string {
  if (bill.recurrence === 'monthly' || bill.recurrence === 'quarterly')
    return `${year}-${String(month + 1).padStart(2, '0')}`;
  if (bill.recurrence === 'yearly') return `${year}`;
  return dateKey(year, month, day);  // fortnightly, interval, one-time use the specific date
}

function priorityPaidKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function isBillDue(bill: Bill, year: number, month: number, day: number): boolean {
  if (bill.recurrence === 'monthly') return bill.dueDay === day;
  if (bill.recurrence === 'weekly' && bill.startDate) {
    const start  = new Date(bill.startDate + 'T00:00:00');
    const target = new Date(year, month, day);
    const diff   = target.getTime() - start.getTime();
    if (diff < 0) return false;
    return Math.round(diff / 86_400_000) % 7 === 0;
  }
  if (bill.recurrence === 'fortnightly' && bill.startDate) {
    const start  = new Date(bill.startDate + 'T00:00:00');
    const target = new Date(year, month, day);
    const diff   = target.getTime() - start.getTime();
    if (diff < 0) return false;
    return Math.round(diff / 86_400_000) % 14 === 0;
  }
  if (bill.recurrence === 'quarterly' && bill.startDate) {
    const start = new Date(bill.startDate + 'T00:00:00');
    const monthDiff = (year - start.getFullYear()) * 12 + (month - start.getMonth());
    return monthDiff >= 0 && monthDiff % 3 === 0 && day === start.getDate();
  }
  if (bill.recurrence === 'yearly')  return bill.dueMonth === month + 1 && bill.dueDay === day;
  if (bill.recurrence === 'one-time' && bill.dueDate) {
    const d = new Date(bill.dueDate + 'T00:00:00');
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
  }
  if (bill.recurrence === 'interval' && bill.startDate && bill.intervalDays) {
    const start  = new Date(bill.startDate + 'T00:00:00');
    const target = new Date(year, month, day);
    const diff   = target.getTime() - start.getTime();
    if (diff < 0) return false;
    const days = Math.round(diff / 86_400_000);
    return days % bill.intervalDays === 0;
  }
  return false;
}

function buildMonthEvents(
  bills: Bill[],
  priorities: Priority[],
  year: number,
  month: number
): CalEvent[] {
  const events: CalEvent[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Bills
  for (let d = 1; d <= daysInMonth; d++) {
    for (const bill of bills) {
      if (!isBillDue(bill, year, month, d)) continue;
      events.push({
        key: `bill-${bill.id}-${d}`,
        name: bill.name,
        amount: bill.amount,
        color: bill.color,
        day: d,
        meta: bill.recurrence === 'weekly'        ? 'weekly'
            : bill.recurrence === 'fortnightly' ? 'fortnightly'
            : bill.recurrence === 'monthly'     ? 'monthly'
            : bill.recurrence === 'quarterly'   ? 'quarterly'
            : bill.recurrence === 'yearly'      ? 'yearly'
            : bill.recurrence === 'interval'    ? `every ${bill.intervalDays}d`
            : 'one-time',
        paid: bill.paidPeriods.includes(billPaidKey(bill, year, month, d)),
        source: 'bill',
        billRef: bill,
      });
    }
  }

  // Fixed priorities with a due day
  const pKey = priorityPaidKey(year, month);
  for (const p of priorities) {
    if (p.type !== 'fixed' || !p.dueDay || p.dueDay > daysInMonth) continue;
    events.push({
      key: `priority-${p.id}`,
      name: p.name,
      amount: p.amount ?? 0,
      color: PRIORITY_COLOR,
      day: p.dueDay,
      meta: 'monthly · allocation',
      paid: (p.paidPeriods ?? []).includes(pKey),
      source: 'priority',
      priorityRef: p,
    });
  }

  return events.sort((a, b) => a.day - b.day);
}

// ── Component ─────────────────────────────────────────

export function CalendarView({ bills, onChange, priorities, onPrioritiesChange, goals }: Props) {
  const now = new Date();
  const [year, setYear]         = useState(now.getFullYear());
  const [month, setMonth]       = useState(now.getMonth());
  const [selDay, setSelDay]     = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState<Form>(emptyForm);

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
    setSelDay(null);
  }

  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
    setSelDay(null);
  }

  function togglePaid(event: CalEvent) {
    if (event.source === 'bill' && event.billRef) {
      const bill      = event.billRef;
      const key       = billPaidKey(bill, year, month, event.day);
      const willBePaid = !bill.paidPeriods.includes(key);

      onChange(bills.map((b) =>
        b.id !== bill.id ? b : {
          ...b,
          paidPeriods: willBePaid
            ? [...b.paidPeriods, key]
            : b.paidPeriods.filter((k) => k !== key),
        }
      ));

      // Sync paid state to any priority with the same linkKey
      const billKey = getLinkKey(bill);
      const linked  = priorities.find((p) => getLinkKey(p) === billKey);
      if (linked) {
        const pKey    = priorityPaidKey(year, month);
        const already = (linked.paidPeriods ?? []).includes(pKey);
        if (willBePaid !== already) {
          onPrioritiesChange(priorities.map((pr) =>
            pr.id !== linked.id ? pr : {
              ...pr,
              paidPeriods: willBePaid
                ? [...(pr.paidPeriods ?? []), pKey]
                : (pr.paidPeriods ?? []).filter((k) => k !== pKey),
            }
          ));
        }
      }
    } else if (event.source === 'priority' && event.priorityRef) {
      const p   = event.priorityRef;
      const key = priorityPaidKey(year, month);
      onPrioritiesChange(priorities.map((pr) =>
        pr.id !== p.id ? pr : {
          ...pr,
          paidPeriods: (pr.paidPeriods ?? []).includes(key)
            ? (pr.paidPeriods ?? []).filter((k) => k !== key)
            : [...(pr.paidPeriods ?? []), key],
        }
      ));
    }
  }

  function addBill() {
    const amount = parseFloat(form.amount) || 0;
    if (!form.name.trim()) return;
    if (form.recurrence === 'monthly'  && !form.dueDay)  return;
    if (form.recurrence === 'yearly'   && (!form.dueMonth || !form.dueDay)) return;
    if (form.recurrence === 'one-time'    && !form.dueDate) return;
    if (form.recurrence === 'weekly'      && !form.startDate) return;
    if (form.recurrence === 'fortnightly' && !form.startDate) return;
    if (form.recurrence === 'quarterly'   && !form.startDate) return;
    if (form.recurrence === 'interval'    && (!form.startDate || !form.intervalDays)) return;

    onChange([
      ...bills,
      {
        id:           crypto.randomUUID(),
        name:         form.name.trim(),
        linkKey:      form.name.trim().toLowerCase(),
        amount,
        recurrence:   form.recurrence,
        dueDay:       parseInt(form.dueDay) || 1,
        dueMonth:     form.recurrence === 'yearly'   ? parseInt(form.dueMonth) : undefined,
        dueDate:      form.recurrence === 'one-time' ? form.dueDate : undefined,
        startDate:    (['weekly', 'fortnightly', 'interval', 'quarterly'] as BillRecurrence[]).includes(form.recurrence) ? form.startDate : undefined,
        intervalDays: form.recurrence === 'interval' ? parseInt(form.intervalDays) : undefined,
        color:        PALETTE[bills.length % PALETTE.length],
        paidPeriods:  [],
      },
    ]);
    setForm(emptyForm);
    setShowForm(false);
  }

  function removeBill(id: string) {
    onChange(bills.filter((b) => b.id !== id));
  }

  // Derived
  const days       = buildDays(year, month);
  const allEvents  = buildMonthEvents(bills, priorities, year, month);
  const shown      = selDay ? allEvents.filter((e) => e.day === selDay) : allEvents;
  const isNow      = year === now.getFullYear() && month === now.getMonth();
  const totalDue   = allEvents.reduce((s, e) => s + e.amount, 0);
  const totalPaid  = allEvents.filter((e) => e.paid).reduce((s, e) => s + e.amount, 0);

  const canAdd =
    !!form.name.trim() &&
    !(form.recurrence === 'monthly'  && !form.dueDay) &&
    !(form.recurrence === 'yearly'   && (!form.dueMonth || !form.dueDay)) &&
    !(form.recurrence === 'one-time'    && !form.dueDate) &&
    !(form.recurrence === 'weekly'      && !form.startDate) &&
    !(form.recurrence === 'fortnightly' && !form.startDate) &&
    !(form.recurrence === 'quarterly'   && !form.startDate) &&
    !(form.recurrence === 'interval'    && (!form.startDate || !form.intervalDays));

  // Events per day for the grid dots
  function dayEvents(day: number): CalEvent[] {
    return allEvents.filter((e) => e.day === day);
  }

  // Fixed priorities visible in calendar
  const calPriorities = priorities.filter((p) => p.type === 'fixed' && p.dueDay);

  return (
    <div className="view">

      {/* ── Calendar grid ── */}
      <div className="card cal-card">
        <div className="cal-nav">
          <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
          <h2 className="cal-month-title">{MONTH_NAMES[month]} {year}</h2>
          <button className="cal-nav-btn" onClick={nextMonth}>›</button>
        </div>

        <div className="cal-grid">
          {DAY_LABELS.map((d) => (
            <div key={d} className="cal-day-label">{d}</div>
          ))}
          {days.map((day, idx) => {
            if (day === null) return <div key={`e${idx}`} />;
            const evs     = dayEvents(day);
            const isToday = isNow && day === now.getDate();
            const isSel   = selDay === day;

            return (
              <button
                key={day}
                className={`cal-cell${isToday ? ' today' : ''}${isSel ? ' selected' : ''}`}
                onClick={() => setSelDay(isSel ? null : day)}
              >
                <span className="cal-day-num">{day}</span>
                {evs.length > 0 && (
                  <div className="cal-dots">
                    {evs.slice(0, 3).map((e) => (
                      <span
                        key={e.key}
                        className="cal-dot"
                        style={{ background: e.paid ? '#c8d1bd' : e.color }}
                      />
                    ))}
                    {evs.length > 3 && (
                      <span className="cal-dot-overflow">+{evs.length - 3}</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {allEvents.length > 0 && (
          <div className="cal-summary">
            <span className="cal-summary-count">
              {allEvents.length} payment{allEvents.length !== 1 ? 's' : ''} · ${totalDue.toFixed(2)}
            </span>
            <span className={`cal-summary-paid${totalPaid >= totalDue && totalDue > 0 ? ' done' : ''}`}>
              ${totalPaid.toFixed(2)} paid
            </span>
          </div>
        )}
      </div>

      {/* ── Event list for selected day / full month ── */}
      {allEvents.length > 0 && (
        <div className="card">
          <div className="bill-list-header">
            <h3 className="section-title" style={{ marginBottom: 0 }}>
              {selDay ? `${MONTH_SHORT[month]} ${selDay}` : MONTH_NAMES[month]}
            </h3>
            {selDay && (
              <button className="clear-sel-btn" onClick={() => setSelDay(null)}>
                Show all ×
              </button>
            )}
          </div>

          <div className="bill-list">
            {shown.length === 0 && (
              <p className="empty-hint" style={{ padding: '6px 0' }}>Nothing due on this day.</p>
            )}
            {shown.map((event) => {
              const ek = (event.billRef ?? event.priorityRef) ? getLinkKey(event.billRef ?? event.priorityRef!) : event.name.trim().toLowerCase();
              const linkedPriority = event.source === 'bill' && priorities.some((p) => getLinkKey(p) === ek);
              const linkedBill     = event.source === 'priority' && bills.some((b) => getLinkKey(b) === ek);
              const linkedGoal     = goals.some((g) => getLinkKey(g) === ek);
              return (
              <div key={event.key} className={`bill-item${event.paid ? ' paid' : ''}`}>
                <span className="bill-color-dot" style={{ background: event.color }} />
                <div className="bill-info">
                  <span className="bill-name">{event.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                    <span className="bill-meta">{MONTH_SHORT[month]} {event.day} · {event.meta}</span>
                    {linkedPriority && <span className="link-tag priority-link">→ Priority</span>}
                    {linkedBill     && <span className="link-tag bill-link">→ Bill</span>}
                    {linkedGoal     && <span className="link-tag goal-link">→ Goal</span>}
                  </div>
                </div>
                {event.amount > 0 && (
                  <span className="bill-amount">${event.amount.toFixed(2)}</span>
                )}
                <button
                  className={`pay-btn${event.paid ? ' paid' : ''}`}
                  onClick={() => togglePaid(event)}
                >
                  {event.paid ? '✓ Paid' : 'Mark paid'}
                </button>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Manage bills ── */}
      <div className="card">
        <div className="manage-header">
          <h3 className="section-title" style={{ marginBottom: 0 }}>Bills &amp; Subscriptions</h3>
          <button
            className={`add-toggle-btn${showForm ? ' cancel' : ''}`}
            onClick={() => { setShowForm((v) => !v); setForm(emptyForm); }}
          >
            {showForm ? '✕ Cancel' : '+ Add'}
          </button>
        </div>

        {showForm && (
          <div className="add-form" style={{ marginTop: 14 }}>
            <input
              className="form-input"
              value={form.name}
              autoFocus
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Name — e.g. Netflix, Rent, Car insurance..."
              onKeyDown={(e) => e.key === 'Enter' && addBill()}
            />
            <select
              className="form-select"
              value={form.recurrence}
              onChange={(e) => setForm({ ...form, recurrence: e.target.value as BillRecurrence, dueDay: '', dueMonth: '', dueDate: '', startDate: '', intervalDays: '' })}
            >
              <option value="weekly">Weekly — repeats every week</option>
              <option value="fortnightly">Fortnightly — repeats every 2 weeks</option>
              <option value="monthly">Monthly — repeats every month</option>
              <option value="quarterly">Quarterly — repeats every 3 months</option>
              <option value="yearly">Yearly — repeats every year</option>
              <option value="interval">Every N days — e.g. every 28 days</option>
              <option value="one-time">One-time — specific date</option>
            </select>
            <div className="prefixed-input">
              <span className="prefix">$</span>
              <input
                className="form-input no-border-left"
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="Amount (optional)"
              />
            </div>
            {form.recurrence === 'monthly' && (
              <div className="prefixed-input">
                <span className="prefix">Day</span>
                <input
                  className="form-input no-border-left"
                  type="number"
                  min="1"
                  max="28"
                  value={form.dueDay}
                  onChange={(e) => setForm({ ...form, dueDay: e.target.value })}
                  placeholder="of the month  (1–28)"
                />
              </div>
            )}
            {form.recurrence === 'yearly' && (
              <div className="two-col">
                <select
                  className="form-select"
                  value={form.dueMonth}
                  onChange={(e) => setForm({ ...form, dueMonth: e.target.value })}
                >
                  <option value="">Month</option>
                  {MONTH_NAMES.map((m, i) => (
                    <option key={i} value={i + 1}>{m}</option>
                  ))}
                </select>
                <div className="prefixed-input">
                  <span className="prefix">Day</span>
                  <input
                    className="form-input no-border-left"
                    type="number"
                    min="1"
                    max="28"
                    value={form.dueDay}
                    onChange={(e) => setForm({ ...form, dueDay: e.target.value })}
                    placeholder="1–28"
                  />
                </div>
              </div>
            )}
            {(form.recurrence === 'weekly' || form.recurrence === 'fortnightly' || form.recurrence === 'quarterly') && (
              <div>
                <label className="form-label">First occurrence date</label>
                <input
                  className="form-input"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
            )}
            {form.recurrence === 'interval' && (
              <div className="two-col">
                <div>
                  <label className="form-label">First occurrence (start date)</label>
                  <input
                    className="form-input"
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </div>
                <div className="prefixed-input">
                  <span className="prefix">Every</span>
                  <input
                    className="form-input no-border-left"
                    type="number"
                    min="1"
                    max="365"
                    value={form.intervalDays}
                    onChange={(e) => setForm({ ...form, intervalDays: e.target.value })}
                    placeholder="days"
                  />
                </div>
              </div>
            )}
            {form.recurrence === 'one-time' && (
              <input
                className="form-input"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            )}
            <button className="add-btn" onClick={addBill} disabled={!canAdd}>
              Add Bill
            </button>
          </div>
        )}

        {bills.length === 0 && !showForm && calPriorities.length === 0 && (
          <p className="empty-hint">No bills added yet. Hit + Add to get started.</p>
        )}

        {bills.length > 0 && (
          <div className="all-bills-list">
            {bills.map((b) => (
              <div key={b.id} className="all-bill-row">
                <span className="bill-color-dot" style={{ background: b.color }} />
                <div className="bill-info">
                  <span className="bill-name">{b.name}</span>
                  <span className="bill-meta">
                    {b.recurrence === 'weekly'      && b.startDate && `Weekly · from ${b.startDate}`}
                    {b.recurrence === 'fortnightly' && b.startDate && `Fortnightly · from ${b.startDate}`}
                    {b.recurrence === 'monthly'     && `Monthly · due day ${b.dueDay}`}
                    {b.recurrence === 'quarterly'   && b.startDate && `Quarterly · from ${b.startDate}`}
                    {b.recurrence === 'yearly'      && `Yearly · ${String(b.dueMonth ?? 1).padStart(2, '0')}-${String(b.dueDay).padStart(2, '0')}`}
                    {b.recurrence === 'one-time'    && b.dueDate   && `One-time · ${b.dueDate}`}
                    {b.recurrence === 'interval'    && b.startDate && b.intervalDays && `Every ${b.intervalDays} days · from ${b.startDate}`}
                  </span>
                </div>
                {b.amount > 0 && <span className="bill-amount">${b.amount.toFixed(2)}</span>}
                <button className="icon-btn danger" onClick={() => removeBill(b.id)} title="Remove">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Priorities shown in calendar ── */}
      {calPriorities.length > 0 && (
        <div className="card">
          <h3 className="section-title">From Priorities</h3>
          <p className="hint-text" style={{ marginBottom: 10 }}>
            These appear automatically because they have a due day set. Edit them in the Priorities tab.
          </p>
          <div className="all-bills-list">
            {calPriorities.map((p) => (
              <div key={p.id} className="all-bill-row">
                <span className="bill-color-dot" style={{ background: PRIORITY_COLOR }} />
                <div className="bill-info">
                  <span className="bill-name">{p.name}</span>
                  <span className="bill-meta">Monthly · due day {p.dueDay}</span>
                </div>
                <span className="bill-amount">${(p.amount ?? 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
