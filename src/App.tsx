import { useState, useEffect } from 'react';
import { loadPriorities, savePriorities, loadHistory, saveHistory, loadGoals, saveGoals, loadBills, saveBills } from './storage';
import { PaycheckView } from './components/PaycheckView';
import { PrioritiesView } from './components/PrioritiesView';
import { HistoryView } from './components/HistoryView';
import { GoalsView } from './components/GoalsView';
import { CalendarView } from './components/CalendarView';
import type { Priority, PaycheckRecord, Goal, Bill } from './types';

type View = 'paycheck' | 'priorities' | 'history' | 'goals' | 'calendar';

export default function App() {
  const [view, setView] = useState<View>('paycheck');
  const [priorities, setPriorities] = useState<Priority[]>(() => loadPriorities());
  const [history, setHistory] = useState<PaycheckRecord[]>(() => loadHistory());
  const [goals, setGoals] = useState<Goal[]>(() => loadGoals());
  const [bills, setBills] = useState<Bill[]>(() => loadBills());
  const [toast, setToast] = useState('');

  useEffect(() => { savePriorities(priorities); }, [priorities]);
  useEffect(() => { saveHistory(history); }, [history]);
  useEffect(() => { saveGoals(goals); }, [goals]);
  useEffect(() => { saveBills(bills); }, [bills]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  }

  function handleSavePaycheck(record: PaycheckRecord) {
    setHistory((prev) => [...prev, record]);
    showToast('Paycheck saved!');
  }

  function handleDeleteRecord(id: string) {
    setHistory((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="app">
      <header className="header">
        <h1 className="app-title">KUBERA</h1>
        <p className="app-subtitle">Paycheck Allocator</p>
      </header>

      <nav className="nav">
        <button
          className={`nav-btn${view === 'paycheck' ? ' active' : ''}`}
          onClick={() => setView('paycheck')}
        >
          This Paycheck
        </button>
        <button
          className={`nav-btn${view === 'priorities' ? ' active' : ''}`}
          onClick={() => setView('priorities')}
        >
          Priorities
        </button>
        <button
          className={`nav-btn${view === 'history' ? ' active' : ''}`}
          onClick={() => setView('history')}
        >
          History
          {history.length > 0 && <span className="nav-badge">{history.length}</span>}
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

      <main className="main">
        {view === 'paycheck' && (
          <PaycheckView priorities={priorities} onSave={handleSavePaycheck} />
        )}
        {view === 'priorities' && (
          <PrioritiesView priorities={priorities} onChange={setPriorities} />
        )}
        {view === 'history' && (
          <HistoryView history={history} onDelete={handleDeleteRecord} />
        )}
        {view === 'goals' && (
          <GoalsView goals={goals} onChange={setGoals} />
        )}
        {view === 'calendar' && (
          <CalendarView
            bills={bills}
            onChange={setBills}
            priorities={priorities}
            onPrioritiesChange={setPriorities}
          />
        )}
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
