import { useState } from 'react';
import type { Loan, LoanInstallment, LoanType } from '../types';

interface Props {
  loans:    Loan[];
  onChange: (loans: Loan[]) => void;
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(base: Date, n: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return fmtDate(d);
}

function todayStr() { return fmtDate(new Date()); }

function splitAmounts(total: number): [number, number, number, number] {
  const base = Math.floor((total / 4) * 100) / 100;
  const last = Math.round((total - base * 3) * 100) / 100;
  return [base, base, base, last];
}

function totalPaid(loan: Loan): number {
  return loan.payments.reduce((s, p) => s + p.amount, 0);
}

const PALETTE = ['#8e44ad','#c0392b','#d35400','#16a085','#2980b9','#f39c12','#27ae60'];

type InstallmentDates = [string, string, string, string];

function defaultDates(step: number): InstallmentDates {
  const t = new Date();
  return [fmtDate(t), addDays(t, step), addDays(t, step * 2), addDays(t, step * 3)];
}

type PaidFlags = [boolean, boolean, boolean, boolean];

interface AddForm {
  name:        string;
  description: string;
  totalAmount: string;
  type:        LoanType;
  dates:       InstallmentDates;
  alreadyPaid: PaidFlags;
}

function emptyForm(): AddForm {
  return {
    name: '', description: '', totalAmount: '', type: 'pay-in-4',
    dates: defaultDates(14),
    alreadyPaid: [false, false, false, false],
  };
}

export function LoansView({ loans, onChange }: Props) {
  const [showForm,      setShowForm]      = useState(false);
  const [form,          setForm]          = useState<AddForm>(emptyForm);
  const [depositInputs, setDepositInputs] = useState<Record<string, string>>({});
  const [showCompleted, setShowCompleted] = useState(false);

  const active    = loans.filter(l => !l.completed);
  const completed = loans.filter(l =>  l.completed);

  // ── Helpers ────────────────────────────────────────────

  function setPreset(step: number) {
    setForm(f => ({ ...f, dates: defaultDates(step) }));
  }

  function setDate(idx: number, val: string) {
    setForm(f => {
      const d: InstallmentDates = [...f.dates] as InstallmentDates;
      d[idx] = val;
      return { ...f, dates: d };
    });
  }

  function toggleAlreadyPaid(idx: number) {
    setForm(f => {
      const p: PaidFlags = [...f.alreadyPaid] as PaidFlags;
      p[idx] = !p[idx];
      return { ...f, alreadyPaid: p };
    });
  }

  function addLoan() {
    const total = parseFloat(form.totalAmount);
    if (!form.name.trim() || !(total > 0)) return;

    const amounts = splitAmounts(total);
    const installments: LoanInstallment[] | undefined =
      form.type === 'pay-in-4'
        ? form.dates.map((date, i) => ({
            id:       crypto.randomUUID(),
            dueDate:  date,
            amount:   amounts[i],
            paid:     form.alreadyPaid[i],
            paidDate: form.alreadyPaid[i] ? date : undefined,
          }))
        : undefined;

    const payments: LoanPayment[] = form.type === 'pay-in-4'
      ? form.dates
          .map((date, i) => form.alreadyPaid[i]
            ? { id: crypto.randomUUID(), date, amount: amounts[i] }
            : null)
          .filter((p): p is LoanPayment => p !== null)
      : [];

    const paidTotal  = payments.reduce((s, p) => s + p.amount, 0);
    const completed  = form.type === 'pay-in-4' && paidTotal >= total;

    const loan: Loan = {
      id:          crypto.randomUUID(),
      name:        form.name.trim(),
      description: form.description.trim() || undefined,
      totalAmount: total,
      type:        form.type,
      installments,
      payments,
      createdDate: todayStr(),
      completed,
      color:       PALETTE[loans.length % PALETTE.length],
    };

    onChange([...loans, loan]);
    setForm(emptyForm());
    setShowForm(false);
  }

  function payInstallment(loanId: string, insId: string) {
    onChange(loans.map(l => {
      if (l.id !== loanId) return l;
      const ins = l.installments?.find(i => i.id === insId);
      if (!ins || ins.paid) return l;
      const newInstallments = l.installments!.map(i =>
        i.id === insId ? { ...i, paid: true, paidDate: todayStr() } : i
      );
      const payments = [...l.payments, { id: crypto.randomUUID(), date: todayStr(), amount: ins.amount }];
      const completed = newInstallments.every(i => i.paid);
      return { ...l, installments: newInstallments, payments, completed };
    }));
  }

  function addCustomDeposit(loanId: string, raw: string) {
    const amount = parseFloat(raw);
    if (!(amount > 0)) return;
    onChange(loans.map(l => {
      if (l.id !== loanId) return l;
      const payments = [...l.payments, { id: crypto.randomUUID(), date: todayStr(), amount }];
      const paid = payments.reduce((s, p) => s + p.amount, 0);
      return { ...l, payments, completed: paid >= l.totalAmount };
    }));
    setDepositInputs(prev => ({ ...prev, [loanId]: '' }));
  }

  function removeLoan(id: string) {
    onChange(loans.filter(l => l.id !== id));
  }

  // ── Render helpers ─────────────────────────────────────

  function LoanCard({ loan }: { loan: Loan }) {
    const paid      = totalPaid(loan);
    const remaining = Math.max(0, loan.totalAmount - paid);
    const pct       = loan.totalAmount > 0 ? Math.min(100, (paid / loan.totalAmount) * 100) : 0;
    const today     = todayStr();

    return (
      <div className={`loan-card${loan.completed ? ' loan-done' : ''}`}>
        <div className="loan-color-bar" style={{ background: loan.color }} />

        <div className="loan-body">
          {/* Header */}
          <div className="loan-header">
            <div className="loan-header-left">
              <span className="loan-name">{loan.name}</span>
              {loan.description && <span className="loan-desc">{loan.description}</span>}
              <span className={`loan-type-badge loan-type-${loan.type}`}>
                {loan.type === 'pay-in-4' ? 'Pay in 4' : 'Custom'}
              </span>
            </div>
            <div className="loan-header-right">
              <span className="loan-total">${loan.totalAmount.toFixed(2)}</span>
              <button className="icon-btn danger" onClick={() => removeLoan(loan.id)} title="Remove">✕</button>
            </div>
          </div>

          {/* Progress */}
          <div className="loan-progress-section">
            <div className="loan-progress-row">
              <span className="loan-progress-label">
                {loan.completed
                  ? `Paid in full — $${paid.toFixed(2)}`
                  : `$${paid.toFixed(2)} paid · $${remaining.toFixed(2)} remaining`}
              </span>
              <span className="loan-progress-pct">{pct.toFixed(0)}%</span>
            </div>
            <div className="loan-bar-track">
              <div
                className={`loan-bar-fill${loan.completed ? ' done' : ''}`}
                style={{ width: `${pct}%`, background: loan.color }}
              />
            </div>
          </div>

          {/* Pay in 4 installments */}
          {loan.type === 'pay-in-4' && loan.installments && (
            <div className="loan-installments">
              {loan.installments.map((ins, i) => {
                const overdue = !ins.paid && ins.dueDate < today;
                const dueToday = !ins.paid && ins.dueDate === today;
                return (
                  <div key={ins.id} className={`loan-ins-row${ins.paid ? ' ins-paid' : ''}${overdue ? ' ins-overdue' : ''}`}>
                    <span className="ins-num">{i + 1}</span>
                    <div className="ins-info">
                      <span className="ins-date">{ins.dueDate}</span>
                      {overdue   && <span className="ins-flag overdue">overdue</span>}
                      {dueToday  && <span className="ins-flag today">due today</span>}
                      {ins.paidDate && <span className="ins-flag paid-on">paid {ins.paidDate}</span>}
                    </div>
                    <span className="ins-amount">${ins.amount.toFixed(2)}</span>
                    {ins.paid
                      ? <span className="ins-paid-check">✓</span>
                      : <button
                          className="ins-pay-btn"
                          onClick={() => payInstallment(loan.id, ins.id)}
                        >
                          Pay ${ins.amount.toFixed(2)}
                        </button>
                    }
                  </div>
                );
              })}
            </div>
          )}

          {/* Custom deposit input */}
          {loan.type === 'custom' && !loan.completed && (
            <div className="loan-deposit-row">
              <div className="prefixed-input deposit-prefixed">
                <span className="prefix">$</span>
                <input
                  className="form-input no-border-left deposit-input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={depositInputs[loan.id] ?? ''}
                  onChange={e => setDepositInputs(prev => ({ ...prev, [loan.id]: e.target.value }))}
                  onKeyDown={e => {
                    if (e.key === 'Enter') addCustomDeposit(loan.id, depositInputs[loan.id] ?? '');
                  }}
                />
              </div>
              <button
                className="deposit-btn"
                disabled={!(parseFloat(depositInputs[loan.id] ?? '') > 0)}
                onClick={() => addCustomDeposit(loan.id, depositInputs[loan.id] ?? '')}
              >
                + Pay
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Add form ────────────────────────────────────────────

  const total   = parseFloat(form.totalAmount) || 0;
  const amounts = total > 0 ? splitAmounts(total) : [0, 0, 0, 0];
  const canAdd  = !!form.name.trim() && total > 0 &&
    (form.type === 'custom' || form.dates.every(d => !!d));

  return (
    <div className="view">

      {/* ── Active loans ── */}
      <div className="card">
        <div className="manage-header">
          <h3 className="section-title" style={{ marginBottom: 0 }}>
            Active Loans & Repayments
            {active.length > 0 && <span className="nav-badge" style={{ marginLeft: 8 }}>{active.length}</span>}
          </h3>
          <button
            className={`add-toggle-btn${showForm ? ' cancel' : ''}`}
            onClick={() => { setShowForm(v => !v); setForm(emptyForm()); }}
          >
            {showForm ? '✕ Cancel' : '+ Add'}
          </button>
        </div>

        {/* Add form */}
        {showForm && (
          <div className="add-form" style={{ marginTop: 16 }}>
            <input
              className="form-input"
              value={form.name}
              autoFocus
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Name — e.g. Afterpay - Nike Shoes, John (lunch), Zip"
            />
            <input
              className="form-input"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Description (optional)"
            />
            <div className="prefixed-input">
              <span className="prefix">$</span>
              <input
                className="form-input no-border-left"
                type="number"
                min="0.01"
                step="0.01"
                value={form.totalAmount}
                onChange={e => setForm(f => ({ ...f, totalAmount: e.target.value }))}
                placeholder="Total amount owed"
              />
            </div>

            {/* Payment type toggle */}
            <div>
              <label className="form-label">Payment type</label>
              <div className="category-toggle">
                <button
                  type="button"
                  className={`cat-btn${form.type === 'pay-in-4' ? ' active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, type: 'pay-in-4', dates: defaultDates(14) }))}
                >
                  Pay in 4
                </button>
                <button
                  type="button"
                  className={`cat-btn${form.type === 'custom' ? ' active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, type: 'custom' }))}
                >
                  Custom
                </button>
              </div>
            </div>

            {/* Pay in 4 date picker */}
            {form.type === 'pay-in-4' && (
              <div className="p4-section">
                <div className="p4-presets">
                  <span className="form-label" style={{ marginBottom: 0 }}>Payment schedule</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className="preset-btn" onClick={() => setPreset(14)}>Fortnightly</button>
                    <button type="button" className="preset-btn" onClick={() => setPreset(7)}>Weekly</button>
                  </div>
                </div>
                <div className="p4-installments">
                  {([0, 1, 2, 3] as const).map(i => (
                    <div key={i} className={`p4-row${form.alreadyPaid[i] ? ' p4-row-paid' : ''}`}>
                      <span className="p4-num">{i + 1}</span>
                      <input
                        className="form-input p4-date-input"
                        type="date"
                        lang="en-CA"
                        value={form.dates[i]}
                        onChange={e => setDate(i, e.target.value)}
                      />
                      {total > 0 && (
                        <span className="p4-amount">${amounts[i].toFixed(2)}</span>
                      )}
                      <label className="p4-paid-label">
                        <input
                          type="checkbox"
                          className="p4-paid-check"
                          checked={form.alreadyPaid[i]}
                          onChange={() => toggleAlreadyPaid(i)}
                        />
                        Paid
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {form.type === 'custom' && (
              <p className="cat-hint">You'll be able to deposit any amount at any time until the loan is fully repaid.</p>
            )}

            <button className="add-btn" onClick={addLoan} disabled={!canAdd}>
              Add Loan
            </button>
          </div>
        )}

        {active.length === 0 && !showForm && (
          <p className="empty-hint">No active loans. Hit + Add to track a new one.</p>
        )}

        {active.length > 0 && (
          <div className="loan-list">
            {active.map(l => <LoanCard key={l.id} loan={l} />)}
          </div>
        )}
      </div>

      {/* ── Completed loans ── */}
      {completed.length > 0 && (
        <div className="card">
          <button
            className="history-header"
            onClick={() => setShowCompleted(v => !v)}
            style={{ width: '100%' }}
          >
            <div className="history-meta">
              <span className="section-title" style={{ margin: 0 }}>Paid Off</span>
              <span className="nav-badge">{completed.length}</span>
            </div>
            <span className="expand-icon">{showCompleted ? '▲' : '▼'}</span>
          </button>

          {showCompleted && (
            <div className="loan-list" style={{ marginTop: 12 }}>
              {completed.map(l => <LoanCard key={l.id} loan={l} />)}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
