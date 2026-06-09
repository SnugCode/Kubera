import { useState, useEffect } from 'react';
import { loadAll, savePriorities, saveHistory, saveGoals, saveBills, saveLoans } from './storage';
import { PaycheckView } from './components/PaycheckView';
import { PrioritiesView } from './components/PrioritiesView';
import { GoalsView } from './components/GoalsView';
import { CalendarView } from './components/CalendarView';
import { AssistantView } from './components/AssistantView';
import { StatsView } from './components/StatsView';
import { LoansView } from './components/LoansView';
import type { Priority, PaycheckRecord, Goal, Bill, Loan } from './types';

type View = 'paycheck' | 'priorities' | 'goals' | 'calendar' | 'assistant' | 'stats' | 'loans';

const WKPM = 52 / 12;

function computeBillsMonthlyTotal(bills: Bill[], priorities: Priority[]): number {
  return bills
    .filter(b => {
      if ((b.category ?? 'bill') !== 'bill' || b.amount <= 0) return false;
      // Exclude any bill that has its own standalone priority (prevent double-counting)
      const lk = (b.linkKey ?? b.name).trim().toLowerCase();
      return !priorities.some(p => !p.autoSum && !p.loansAutoSum && (p.linkKey ?? p.name).trim().toLowerCase() === lk);
    })
    .reduce((sum, b) => {
      switch (b.recurrence) {
        case 'weekly':      return sum + b.amount * WKPM;
        case 'fortnightly': return sum + b.amount * (WKPM / 2);
        case 'monthly':     return sum + b.amount;
        case 'quarterly':   return sum + b.amount / 3;
        case 'yearly':      return sum + b.amount / 12;
        case 'interval':    return b.intervalDays && b.intervalDays > 0
          ? sum + b.amount * 365 / (b.intervalDays * 12)
          : sum;
        default:            return sum; // one-time — not a recurring cost
      }
    }, 0);
}

function computeLoansMonthlyTotal(loans: Loan[]): number {
  const today = new Date();
  return loans
    .filter(l => !l.completed)
    .reduce((sum, l) => {
      const paid      = l.payments.reduce((s, p) => s + p.amount, 0);
      const remaining = Math.max(0, l.totalAmount - paid);
      if (remaining <= 0) return sum;
      if (l.type === 'pay-in-4' && l.installments) {
        const futureDates = l.installments
          .filter(i => !i.paid)
          .map(i => new Date(i.dueDate + 'T00:00:00'));
        if (futureDates.length === 0) return sum;
        const lastMs  = Math.max(...futureDates.map(d => d.getTime()));
        const months  = Math.max(1, (lastMs - today.getTime()) / (1000 * 60 * 60 * 24 * 30));
        return sum + remaining / months;
      }
      // Custom: treat full remaining as this month's obligation
      return sum + remaining;
    }, 0);
}

export default function App() {
  const [ready, setReady]           = useState(false);
  const [view, setView]             = useState<View>('paycheck');
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [history, setHistory]       = useState<PaycheckRecord[]>([]);
  const [goals, setGoals]           = useState<Goal[]>([]);
  const [bills, setBills]           = useState<Bill[]>([]);
  const [loans, setLoans]           = useState<Loan[]>([]);
  const [toast, setToast]           = useState('');

  // Load all data once on mount
  useEffect(() => {
    loadAll().then(({ priorities, history, goals, bills, loans }) => {
      setPriorities(priorities);
      setHistory(history);
      setGoals(goals);
      setBills(bills);
      setLoans(loans);
      setReady(true);
    });
  }, []);

  // Auto-create / update / remove the Bills aggregator priority whenever bills change
  useEffect(() => {
    if (!ready) return;
    const monthlyTotal = computeBillsMonthlyTotal(bills, priorities);
    const idx = priorities.findIndex(p => p.autoSum);

    if (monthlyTotal > 0) {
      if (idx >= 0) {
        if (Math.abs((priorities[idx].amount ?? 0) - monthlyTotal) < 0.01) return; // no change
        const next = priorities.map((p, i) =>
          i === idx ? { ...p, amount: monthlyTotal } : p
        );
        handlePrioritiesChange(next);
      } else {
        // Insert after the last fixed priority (or at end)
        let insertAt = priorities.length;
        for (let i = priorities.length - 1; i >= 0; i--) {
          if (priorities[i].type === 'fixed' && !priorities[i].autoSum) { insertAt = i + 1; break; }
        }
        const billsPriority: Priority = {
          id:       'bills-auto-sum',
          name:     'Bills',
          linkKey:  'bills',
          type:     'fixed',
          amount:   monthlyTotal,
          autoSum:  true,
          paidPeriods: [],
        };
        const next = [...priorities.slice(0, insertAt), billsPriority, ...priorities.slice(insertAt)];
        handlePrioritiesChange(next);
      }
    } else if (idx >= 0) {
      handlePrioritiesChange(priorities.filter(p => !p.autoSum));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bills, ready]);

  // Auto-create / update / remove the Loans aggregator priority whenever loans change
  useEffect(() => {
    if (!ready) return;
    const monthlyTotal = computeLoansMonthlyTotal(loans);
    const idx = priorities.findIndex(p => p.loansAutoSum);

    if (monthlyTotal > 0) {
      if (idx >= 0) {
        if (Math.abs((priorities[idx].amount ?? 0) - monthlyTotal) < 0.01) return;
        const next = priorities.map((p, i) =>
          i === idx ? { ...p, amount: monthlyTotal } : p
        );
        handlePrioritiesChange(next);
      } else {
        // Insert after Bills aggregator, or after last fixed priority
        let insertAt = priorities.length;
        for (let i = priorities.length - 1; i >= 0; i--) {
          if (priorities[i].autoSum) { insertAt = i + 1; break; }
          if (priorities[i].type === 'fixed') { insertAt = i + 1; }
        }
        const loansPriority: Priority = {
          id:           'loans-auto-sum',
          name:         'Loans & Repayments',
          linkKey:      'loans',
          type:         'fixed',
          amount:       monthlyTotal,
          loansAutoSum: true,
          paidPeriods:  [],
        };
        const next = [...priorities.slice(0, insertAt), loansPriority, ...priorities.slice(insertAt)];
        handlePrioritiesChange(next);
      }
    } else if (idx >= 0) {
      handlePrioritiesChange(priorities.filter(p => !p.loansAutoSum));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loans, ready]);

  // ── Mutation handlers ────────────────────────────────────

  function handlePrioritiesChange(next: Priority[]) {
    setPriorities(next);
    savePriorities(next);
  }

  function handleBillsChange(next: Bill[]) {
    setBills(next);
    saveBills(next);
  }

  function handleLoansChange(next: Loan[]) {
    setLoans(next);
    saveLoans(next);
  }

  function handleGoalsChange(next: Goal[]) {
    setGoals(next);
    saveGoals(next);
  }

  function handleSavePaycheck(record: PaycheckRecord) {
    const next = [...history, record];
    setHistory(next);
    saveHistory(next);
    showToast('Paycheck saved!');
  }

  function handleDeleteRecord(id: string) {
    const next = history.filter((r) => r.id !== id);
    setHistory(next);
    saveHistory(next);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  }

  if (!ready) {
    return (
      <div className="app">
        <div className="header-block">
          <header className="header">
            <h1 className="app-title">KUBERA</h1>
            <p className="app-subtitle">Personal Finance Manager</p>
          </header>
        </div>
        <div className="app-loading">Loading your data…</div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="header-block">
        <header className="header">
          <h1 className="app-title">KUBERA</h1>
          <p className="app-subtitle">Personal Finance Manager</p>
        </header>

        <nav className="nav">
          <button
            className={`nav-btn${view === 'paycheck' ? ' active' : ''}`}
            onClick={() => setView('paycheck')}
          >
            Paychecks
            {history.length > 0 && <span className="nav-badge">{history.length}</span>}
          </button>
          <button
            className={`nav-btn${view === 'priorities' ? ' active' : ''}`}
            onClick={() => setView('priorities')}
          >
            Priorities
          </button>
          <button
            className={`nav-btn${view === 'goals' ? ' active' : ''}`}
            onClick={() => setView('goals')}
          >
            Goals
            {goals.filter((g) => !g.completed).length > 0 && (
              <span className="nav-badge">{goals.filter((g) => !g.completed).length}</span>
            )}
          </button>
          <button
            className={`nav-btn${view === 'calendar' ? ' active' : ''}`}
            onClick={() => setView('calendar')}
          >
            Bills & Expenses
            {bills.length > 0 && <span className="nav-badge">{bills.length}</span>}
          </button>
          <button
            className={`nav-btn${view === 'loans' ? ' active' : ''}`}
            onClick={() => setView('loans')}
          >
            Loans
            {loans.filter(l => !l.completed).length > 0 && (
              <span className="nav-badge">{loans.filter(l => !l.completed).length}</span>
            )}
          </button>
          <button
            className={`nav-btn${view === 'assistant' ? ' active' : ''}`}
            onClick={() => setView('assistant')}
          >
            Assistant
          </button>
          <button
            className={`nav-btn${view === 'stats' ? ' active' : ''}`}
            onClick={() => setView('stats')}
          >
            Stats
          </button>
        </nav>
      </div>

      <main className="main">
        {view === 'paycheck' && (
          <PaycheckView
            priorities={priorities}
            onSave={handleSavePaycheck}
            history={history}
            onDelete={handleDeleteRecord}
          />
        )}
        {view === 'priorities' && (
          <PrioritiesView priorities={priorities} onChange={handlePrioritiesChange} bills={bills} goals={goals} loans={loans} />
        )}
        {view === 'goals' && (
          <GoalsView goals={goals} onChange={handleGoalsChange} bills={bills} priorities={priorities} />
        )}
        {view === 'assistant' && (
          <AssistantView
            history={history}
            priorities={priorities}
            bills={bills}
            goals={goals}
            loans={loans}
          />
        )}
        {view === 'stats' && (
          <StatsView
            history={history}
            priorities={priorities}
            bills={bills}
            loans={loans}
          />
        )}
        {view === 'loans' && (
          <LoansView loans={loans} onChange={handleLoansChange} />
        )}
        {view === 'calendar' && (
          <CalendarView
            bills={bills}
            onChange={handleBillsChange}
            priorities={priorities}
            onPrioritiesChange={handlePrioritiesChange}
            goals={goals}
            loans={loans}
          />
        )}
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
