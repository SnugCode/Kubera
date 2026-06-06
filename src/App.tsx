import { useState, useEffect } from 'react';
import { loadAll, savePriorities, saveHistory, saveGoals, saveBills } from './storage';
import { PaycheckView } from './components/PaycheckView';
import { PrioritiesView } from './components/PrioritiesView';
import { GoalsView } from './components/GoalsView';
import { CalendarView } from './components/CalendarView';
import { AssistantView } from './components/AssistantView';
import { StatsView } from './components/StatsView';
import type { Priority, PaycheckRecord, Goal, Bill } from './types';

type View = 'paycheck' | 'priorities' | 'goals' | 'calendar' | 'assistant' | 'stats';

const WKPM = 52 / 12;

function computeBillsMonthlyTotal(bills: Bill[]): number {
  return bills
    .filter(b => (b.category ?? 'bill') === 'bill' && b.amount > 0)
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

export default function App() {
  const [ready, setReady]           = useState(false);
  const [view, setView]             = useState<View>('paycheck');
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [history, setHistory]       = useState<PaycheckRecord[]>([]);
  const [goals, setGoals]           = useState<Goal[]>([]);
  const [bills, setBills]           = useState<Bill[]>([]);
  const [toast, setToast]           = useState('');

  // Load all data once on mount
  useEffect(() => {
    loadAll().then(({ priorities, history, goals, bills }) => {
      setPriorities(priorities);
      setHistory(history);
      setGoals(goals);
      setBills(bills);
      setReady(true);
    });
  }, []);

  // Auto-create / update / remove the Bills aggregator priority whenever bills change
  useEffect(() => {
    if (!ready) return;
    const monthlyTotal = computeBillsMonthlyTotal(bills);
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

  // ── Mutation handlers ────────────────────────────────────

  function handlePrioritiesChange(next: Priority[]) {
    setPriorities(next);
    savePriorities(next);
  }

  function handleBillsChange(next: Bill[]) {
    setBills(next);
    saveBills(next);
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
          <PrioritiesView priorities={priorities} onChange={handlePrioritiesChange} bills={bills} goals={goals} />
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
          />
        )}
        {view === 'stats' && (
          <StatsView
            history={history}
            priorities={priorities}
          />
        )}
        {view === 'calendar' && (
          <CalendarView
            bills={bills}
            onChange={handleBillsChange}
            priorities={priorities}
            onPrioritiesChange={handlePrioritiesChange}
            goals={goals}
          />
        )}
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
