import { useState } from 'react';
import type { Goal } from '../types';

interface Props {
  goals: Goal[];
  onChange: (goals: Goal[]) => void;
}

interface AddForm {
  name: string;
  targetAmount: string;
  months: string;
}

const emptyForm: AddForm = { name: '', targetAmount: '', months: '' };

// Weeks per month (52 / 12)
const WEEKS_PER_MONTH = 52 / 12;

function getDeadline(startDate: string, months: number): Date {
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + months);
  return d;
}

function getMonthsRemaining(startDate: string, months: number): number {
  const deadline = getDeadline(startDate, months);
  const msLeft = deadline.getTime() - Date.now();
  return Math.max(0, msLeft / (1000 * 60 * 60 * 24 * 30.44));
}

function isOverdue(startDate: string, months: number): boolean {
  return getDeadline(startDate, months).getTime() < Date.now();
}

function perPaycheck(goal: Goal): number {
  const remaining = goal.targetAmount - goal.saved;
  if (remaining <= 0) return 0;
  const monthsLeft = getMonthsRemaining(goal.startDate, goal.months);
  if (monthsLeft <= 0) return remaining;
  return remaining / (monthsLeft * WEEKS_PER_MONTH);
}

function progressPct(goal: Goal): number {
  if (goal.targetAmount <= 0) return 0;
  return Math.min(100, (goal.saved / goal.targetAmount) * 100);
}

export function GoalsView({ goals, onChange }: Props) {
  const [form, setForm] = useState<AddForm>(emptyForm);
  const [contributingId, setContributingId] = useState<string | null>(null);
  const [contributionInput, setContributionInput] = useState('');

  function addGoal() {
    const target = parseFloat(form.targetAmount);
    const months = parseInt(form.months, 10);
    if (!form.name.trim() || !target || !months || months < 1) return;
    const goal: Goal = {
      id: crypto.randomUUID(),
      name: form.name.trim(),
      targetAmount: target,
      months,
      saved: 0,
      startDate: new Date().toISOString(),
      completed: false,
    };
    onChange([...goals, goal]);
    setForm(emptyForm);
  }

  function removeGoal(id: string) {
    onChange(goals.filter((g) => g.id !== id));
  }

  function markComplete(id: string) {
    onChange(goals.map((g) => (g.id === id ? { ...g, completed: true } : g)));
  }

  function startContribute(id: string) {
    setContributingId(id);
    setContributionInput('');
  }

  function confirmContribution(id: string) {
    const amount = parseFloat(contributionInput);
    if (!amount || amount <= 0) { setContributingId(null); return; }
    onChange(
      goals.map((g) => {
        if (g.id !== id) return g;
        const newSaved = g.saved + amount;
        return { ...g, saved: newSaved, completed: newSaved >= g.targetAmount };
      })
    );
    setContributingId(null);
    setContributionInput('');
  }

  const active = goals.filter((g) => !g.completed);
  const done   = goals.filter((g) => g.completed);

  return (
    <div className="view">

      {/* Active goals */}
      {active.length === 0 && done.length === 0 && (
        <div className="card hint-card">
          No goals yet. Add something you're saving toward below.
        </div>
      )}

      {active.map((goal) => {
        const pct      = progressPct(goal);
        const needed   = perPaycheck(goal);
        const deadline = getDeadline(goal.startDate, goal.months);
        const overdue  = isOverdue(goal.startDate, goal.months);
        const mLeft    = getMonthsRemaining(goal.startDate, goal.months);
        const remaining = goal.targetAmount - goal.saved;

        return (
          <div key={goal.id} className="card goal-card">
            <div className="goal-header">
              <span className="goal-name">{goal.name}</span>
              <div className="goal-actions">
                <button className="icon-btn" onClick={() => markComplete(goal.id)} title="Mark complete">✓</button>
                <button className="icon-btn danger" onClick={() => removeGoal(goal.id)} title="Delete">✕</button>
              </div>
            </div>

            <div className="goal-stats">
              <div className="stat">
                <span className="stat-label">Target</span>
                <span className="stat-value">${goal.targetAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Saved</span>
                <span className="stat-value green">${goal.saved.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Left</span>
                <span className="stat-value">${Math.max(0, remaining).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="goal-bar-wrap">
              <div className="bar-track goal-bar-track">
                <div className="bar-fill goal-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="goal-pct">{pct.toFixed(0)}%</span>
            </div>

            <div className={`goal-deadline${overdue ? ' overdue' : ''}`}>
              <span>
                {overdue
                  ? `Overdue — was due ${deadline.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
                  : `Due ${deadline.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} · ${mLeft.toFixed(1)} months left`}
              </span>
              {!overdue && remaining > 0 && (
                <span className="per-paycheck">
                  ~${needed.toFixed(2)}<span className="per-paycheck-label">/paycheck</span>
                </span>
              )}
            </div>

            {contributingId === goal.id ? (
              <div className="contribute-row">
                <div className="prefixed-input">
                  <span className="prefix">$</span>
                  <input
                    className="form-input no-border-left"
                    type="number"
                    min="0"
                    step="0.01"
                    autoFocus
                    placeholder="0.00"
                    value={contributionInput}
                    onChange={(e) => setContributionInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && confirmContribution(goal.id)}
                  />
                </div>
                <button className="btn-sm primary" onClick={() => confirmContribution(goal.id)}>Add</button>
                <button className="btn-sm" onClick={() => setContributingId(null)}>Cancel</button>
              </div>
            ) : (
              <button className="contribute-btn" onClick={() => startContribute(goal.id)}>
                + Log contribution
              </button>
            )}
          </div>
        );
      })}

      {/* Completed goals */}
      {done.length > 0 && (
        <div className="card">
          <h3 className="section-title">Completed</h3>
          <div className="completed-list">
            {done.map((goal) => (
              <div key={goal.id} className="completed-item">
                <span className="completed-check">✓</span>
                <span className="completed-name">{goal.name}</span>
                <span className="completed-amount">${goal.targetAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                <button className="icon-btn danger" onClick={() => removeGoal(goal.id)} title="Remove">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add goal form */}
      <div className="card">
        <h3 className="section-title">New Goal</h3>
        <div className="add-form">
          <input
            className="form-input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="What are you saving for? — e.g. Laptop, Vacation, Emergency fund..."
            onKeyDown={(e) => e.key === 'Enter' && addGoal()}
          />
          <div className="goal-form-row">
            <div className="prefixed-input" style={{ flex: 1 }}>
              <span className="prefix">$</span>
              <input
                className="form-input no-border-left"
                type="number"
                min="0"
                step="0.01"
                value={form.targetAmount}
                onChange={(e) => setForm({ ...form, targetAmount: e.target.value })}
                placeholder="Target amount"
              />
            </div>
            <div className="prefixed-input" style={{ flex: 1 }}>
              <input
                className="form-input no-border-right"
                type="number"
                min="1"
                step="1"
                value={form.months}
                onChange={(e) => setForm({ ...form, months: e.target.value })}
                placeholder="Months"
              />
              <span className="suffix">mo</span>
            </div>
          </div>

          {form.targetAmount && form.months && parseFloat(form.targetAmount) > 0 && parseInt(form.months) > 0 && (
            <div className="goal-preview">
              ~${(parseFloat(form.targetAmount) / (parseInt(form.months) * WEEKS_PER_MONTH)).toFixed(2)} per paycheck
              for {form.months} month{parseInt(form.months) !== 1 ? 's' : ''}
            </div>
          )}

          <button
            className="add-btn"
            onClick={addGoal}
            disabled={!form.name.trim() || !form.targetAmount || !form.months}
          >
            Add Goal
          </button>
        </div>
      </div>
    </div>
  );
}
