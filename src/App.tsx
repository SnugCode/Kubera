import { useState, useEffect } from 'react';
import { loadAll, savePriorities, saveHistory, saveGoals, saveBills } from './storage';
import { PaycheckView } from './components/PaycheckView';
import { PrioritiesView } from './components/PrioritiesView';
import { GoalsView } from './components/GoalsView';
import { CalendarView } from './components/CalendarView';
import type { Priority, PaycheckRecord, Goal, Bill } from './types';

type View = 'paycheck' | 'priorities' | 'goals' | 'calendar';

export default function App() {
  const [ready, setReady]           = useState(false);
  const [view, setView]             = useState<View>('paycheck');
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [history, setHistory]       = useState<PaycheckRecord[]>([]);
  const [goals, setGoals]           = useState<Goal[]>([]);
  const [bills, setBills]           = useState<Bill[]>([]);
  const [toast, setToast]           = useState('');

  // Load all data once on mount (file store → localStorage → defaults)
  useEffect(() => {
    loadAll().then(({ priorities, history, goals, bills }) => {
      setPriorities(priorities);
      setHistory(history);
      setGoals(goals);
      setBills(bills);
      setReady(true);
    });
  }, []);

  // ── Mutation handlers — update state AND write to storage immediately ────────

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
            Bills
            {bills.length > 0 && <span className="nav-badge">{bills.length}</span>}
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
