import { useState } from 'react';
import type { Goal, Bill, Priority } from '../types';

interface Props {
  goals: Goal[];
  onChange: (goals: Goal[]) => void;
  bills: Bill[];
  priorities: Priority[];
}

function getLinkKey(item: { linkKey?: string; name: string }): string {
  return (item.linkKey ?? item.name).trim().toLowerCase();
}

interface AddForm {
  type: 'long-term' | 'standalone';
  ltMode: 'duration' | 'fixed';
  name: string;
  targetAmount: string;
  months: string;
  monthlyAllocation: string;
}

const emptyForm: AddForm = { type: 'long-term', ltMode: 'duration', name: '', targetAmount: '', months: '', monthlyAllocation: '' };
const WEEKS_PER_MONTH = 52 / 12;

function getDeadline(startDate: string, months: number): Date {
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + months);
  return d;
}

function getMonthsRemaining(startDate: string, months: number): number {
  const deadline = getDeadline(startDate, months);
  return Math.max(0, (deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.44));
}

function isOverdue(startDate: string, months: number): boolean {
  return getDeadline(startDate, months).getTime() < Date.now();
}

function perPaycheck(goal: Goal): number {
  if (goal.allocationMode === 'fixed' && goal.monthlyAllocation) {
    return goal.monthlyAllocation / WEEKS_PER_MONTH;
  }
  const remaining = goal.targetAmount - goal.saved;
  if (remaining <= 0) return 0;
  if (!goal.months) return 0;
  const monthsLeft = getMonthsRemaining(goal.startDate, goal.months);
  if (monthsLeft <= 0) return remaining;
  return remaining / (monthsLeft * WEEKS_PER_MONTH);
}

function progressPct(goal: Goal): number {
  if (goal.targetAmount <= 0) return 0;
  return Math.min(100, (goal.saved / goal.targetAmount) * 100);
}

// ── GoalCard ─────────────────────────────────────────────

interface GoalCardProps {
  goal: Goal;
  onContribute: (id: string, amount: number) => void;
  onComplete: (id: string) => void;
  onRemove: (id: string) => void;
  isActive?: boolean;
  linkedCategories?: string[];  // e.g. ['Priority', 'Bill']
}

function GoalCard({ goal, onContribute, onComplete, onRemove, isActive = true, linkedCategories = [] }: GoalCardProps) {
  const [contributing, setContributing] = useState(false);
  const [input, setInput] = useState('');

  const pct       = progressPct(goal);
  const remaining = Math.max(0, goal.targetAmount - goal.saved);
  const needed    = goal.type === 'long-term' ? perPaycheck(goal) : 0;
  const deadline  = goal.months ? getDeadline(goal.startDate, goal.months) : null;
  const overdue   = goal.months ? isOverdue(goal.startDate, goal.months) : false;
  const mLeft     = goal.months ? getMonthsRemaining(goal.startDate, goal.months) : 0;

  function confirm() {
    const amount = parseFloat(input);
    if (!amount || amount <= 0) { setContributing(false); return; }
    onContribute(goal.id, amount);
    setContributing(false);
    setInput('');
  }

  return (
    <div className={`card goal-card${isActive && goal.type === 'standalone' ? ' goal-card-active' : ''}`}>
      <div className="goal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {goal.type === 'standalone' && isActive && (
            <span className="goal-active-badge">Active</span>
          )}
          <span className="goal-name">{goal.name}</span>
          {linkedCategories.map((cat) => (
            <span key={cat} className={`link-tag ${cat === 'Priority' ? 'priority-link' : 'bill-link'}`}>→ {cat}</span>
          ))}
        </div>
        <div className="goal-actions">
          <button className="icon-btn" onClick={() => onComplete(goal.id)} title="Mark complete">✓</button>
          <button className="icon-btn danger" onClick={() => onRemove(goal.id)} title="Delete">✕</button>
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
          <span className="stat-value">${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      <div className="goal-bar-wrap">
        <div className="bar-track goal-bar-track">
          <div className="bar-fill goal-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="goal-pct">{pct.toFixed(0)}%</span>
      </div>

      {goal.type === 'long-term' && (
        goal.allocationMode === 'fixed' && goal.monthlyAllocation ? (
          <div className="goal-deadline">
            <span>${goal.monthlyAllocation.toFixed(2)}/mo · ${(goal.monthlyAllocation / WEEKS_PER_MONTH).toFixed(2)}/paycheck</span>
            {remaining > 0 && (
              <span className="per-paycheck">
                ~{(remaining / goal.monthlyAllocation).toFixed(1)}
                <span className="per-paycheck-label"> mo left</span>
              </span>
            )}
          </div>
        ) : (
          deadline ? (
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
          ) : null
        )
      )}

      {isActive && (
        contributing ? (
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
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && confirm()}
              />
            </div>
            <button className="btn-sm primary" onClick={confirm}>Add</button>
            <button className="btn-sm" onClick={() => setContributing(false)}>Cancel</button>
          </div>
        ) : (
          <button className="contribute-btn" onClick={() => setContributing(true)}>
            + Log contribution
          </button>
        )
      )}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────

export function GoalsView({ goals, onChange, bills, priorities }: Props) {
  function linkedCats(goal: Goal): string[] {
    const k = getLinkKey(goal);
    const cats: string[] = [];
    if (priorities.some((p) => getLinkKey(p) === k)) cats.push('Priority');
    if (bills.some((b) => getLinkKey(b) === k)) cats.push('Bill');
    return cats;
  }
  const [form, setForm] = useState<AddForm>(emptyForm);
  const [showForm, setShowForm] = useState(false);

  // Treat goals with no type (old data) as long-term
  const active = goals.filter((g) => !g.completed);
  const done   = goals.filter((g) => g.completed);

  const longTermActive  = active.filter((g) => (g.type ?? 'long-term') === 'long-term');
  const standaloneActive = active.filter((g) => g.type === 'standalone');
  // standaloneActive[0] is the current focus; rest are queued

  function addGoal() {
    const target = parseFloat(form.targetAmount);
    if (!form.name.trim() || !target) return;
    if (form.type === 'long-term') {
      if (form.ltMode === 'duration' && (!form.months || parseInt(form.months) < 1)) return;
      if (form.ltMode === 'fixed'    && (!form.monthlyAllocation || parseFloat(form.monthlyAllocation) <= 0)) return;
    }
    const isFixed = form.type === 'long-term' && form.ltMode === 'fixed';
    onChange([
      ...goals,
      {
        id:                crypto.randomUUID(),
        name:              form.name.trim(),
        linkKey:           form.name.trim().toLowerCase(),
        type:              form.type,
        allocationMode:    form.type === 'long-term' ? form.ltMode : undefined,
        monthlyAllocation: isFixed ? parseFloat(form.monthlyAllocation) : undefined,
        targetAmount:      target,
        months:            form.type === 'long-term' && form.ltMode === 'duration' ? parseInt(form.months, 10) : 0,
        saved:             0,
        startDate:         new Date().toISOString(),
        completed:         false,
      },
    ]);
    setForm({ ...emptyForm, type: form.type, ltMode: form.ltMode });
    setShowForm(false);
  }

  function removeGoal(id: string) {
    onChange(goals.filter((g) => g.id !== id));
  }

  function markComplete(id: string) {
    onChange(goals.map((g) => (g.id === id ? { ...g, completed: true } : g)));
  }

  function contribute(id: string, amount: number) {
    onChange(
      goals.map((g) => {
        if (g.id !== id) return g;
        const newSaved = g.saved + amount;
        return { ...g, saved: newSaved, completed: newSaved >= g.targetAmount };
      })
    );
  }

  function moveStandalone(id: string, dir: -1 | 1) {
    const indices = goals
      .map((g, i) => ({ g, i }))
      .filter(({ g }) => g.type === 'standalone' && !g.completed)
      .map(({ i }) => i);
    const pos = indices.findIndex((i) => goals[i].id === id);
    if (pos === -1) return;
    const swapPos = pos + dir;
    if (swapPos < 0 || swapPos >= indices.length) return;
    const next = [...goals];
    [next[indices[pos]], next[indices[swapPos]]] = [next[indices[swapPos]], next[indices[pos]]];
    onChange(next);
  }

  const canAdd =
    !!form.name.trim() &&
    !!form.targetAmount &&
    parseFloat(form.targetAmount) > 0 &&
    (form.type === 'standalone' ||
      (form.ltMode === 'duration'
        ? (!!form.months && parseInt(form.months) > 0)
        : (!!form.monthlyAllocation && parseFloat(form.monthlyAllocation) > 0)));

  const hasAny = goals.length > 0;

  return (
    <div className="view">

      {!hasAny && !showForm && (
        <div className="card hint-card">
          No goals yet. Add a long-term savings goal or a standalone purchase goal below.
        </div>
      )}

      {/* ── Long Term ── */}
      {longTermActive.length > 0 && (
        <div className="goals-section">
          <h3 className="goals-section-title">Long Term</h3>
          {longTermActive.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onContribute={contribute}
              onComplete={markComplete}
              onRemove={removeGoal}
              linkedCategories={linkedCats(goal)}
            />
          ))}
        </div>
      )}

      {/* ── Standalone queue ── */}
      {standaloneActive.length > 0 && (
        <div className="goals-section">
          <h3 className="goals-section-title">Standalone</h3>

          {/* Active (top) goal */}
          <GoalCard
            key={standaloneActive[0].id}
            goal={standaloneActive[0]}
            onContribute={contribute}
            onComplete={markComplete}
            onRemove={removeGoal}
            isActive={true}
            linkedCategories={linkedCats(standaloneActive[0])}
          />

          {/* Queued goals */}
          {standaloneActive.length > 1 && (
            <div className="card queue-card">
              <p className="queue-label">Up next</p>
              <div className="queue-list">
                {standaloneActive.slice(1).map((goal, idx) => {
                  const pct = progressPct(goal);
                  const remaining = Math.max(0, goal.targetAmount - goal.saved);
                  return (
                    <div key={goal.id} className="queue-item">
                      <span className="queue-num">{idx + 2}</span>
                      <div className="queue-info">
                        <span className="queue-name">{goal.name}</span>
                        <span className="queue-meta">
                          ${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })} left
                          {pct > 0 && ` · ${pct.toFixed(0)}% saved`}
                        </span>
                      </div>
                      <span className="queue-target">${goal.targetAmount.toLocaleString('en-US', { minimumFractionDigits: 0 })}</span>
                      <div className="queue-reorder">
                        <button
                          className="reorder-btn"
                          onClick={() => moveStandalone(goal.id, -1)}
                          disabled={idx === 0}
                          title="Move up"
                        >▲</button>
                        <button
                          className="reorder-btn"
                          onClick={() => moveStandalone(goal.id, 1)}
                          disabled={idx === standaloneActive.length - 2}
                          title="Move down"
                        >▼</button>
                      </div>
                      <button className="icon-btn danger" onClick={() => removeGoal(goal.id)} title="Delete">✕</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Completed ── */}
      {done.length > 0 && (
        <div className="card">
          <h3 className="section-title">Completed</h3>
          <div className="completed-list">
            {done.map((goal) => (
              <div key={goal.id} className="completed-item">
                <span className="completed-check">✓</span>
                <div style={{ flex: 1 }}>
                  <span className="completed-name">{goal.name}</span>
                  {goal.type === 'standalone' && (
                    <span className="completed-type-tag">standalone</span>
                  )}
                </div>
                <span className="completed-amount">${goal.targetAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                <button className="icon-btn danger" onClick={() => removeGoal(goal.id)} title="Remove">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Add form ── */}
      <div className="card">
        <div className="manage-header">
          <h3 className="section-title" style={{ marginBottom: 0 }}>New Goal</h3>
          <button
            className={`add-toggle-btn${showForm ? ' cancel' : ''}`}
            onClick={() => { setShowForm((v) => !v); setForm(emptyForm); }}
          >
            {showForm ? '✕ Cancel' : '+ Add'}
          </button>
        </div>

        {showForm && (
          <div className="add-form" style={{ marginTop: 14 }}>
            <div className="goal-type-toggle">
              <button
                className={`type-btn${form.type === 'long-term' ? ' active' : ''}`}
                onClick={() => setForm({ ...form, type: 'long-term' })}
              >
                Long Term
              </button>
              <button
                className={`type-btn${form.type === 'standalone' ? ' active' : ''}`}
                onClick={() => setForm({ ...form, type: 'standalone' })}
              >
                Standalone
              </button>
            </div>

            {form.type === 'long-term' && (
              <div className="goal-type-toggle">
                <button
                  className={`type-btn${form.ltMode === 'duration' ? ' active' : ''}`}
                  onClick={() => setForm({ ...form, ltMode: 'duration' })}
                >By Duration</button>
                <button
                  className={`type-btn${form.ltMode === 'fixed' ? ' active' : ''}`}
                  onClick={() => setForm({ ...form, ltMode: 'fixed' })}
                >Fixed Amount</button>
              </div>
            )}

            <p className="hint-text" style={{ marginTop: 2, marginBottom: 4 }}>
              {form.type === 'standalone'
                ? 'Priority queue — focus and contribute to this until done, then move to the next.'
                : form.ltMode === 'duration'
                  ? 'Set a target date — the app calculates how much to put aside each paycheck.'
                  : 'Set a monthly amount — the app calculates how long until the goal is reached.'}
            </p>

            <input
              className="form-input"
              value={form.name}
              autoFocus
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={form.type === 'long-term' ? 'e.g. Emergency fund, Investment account...' : 'e.g. New laptop, Holiday trip, Shoes...'}
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
              {form.type === 'long-term' && form.ltMode === 'duration' && (
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
              )}
              {form.type === 'long-term' && form.ltMode === 'fixed' && (
                <div className="prefixed-input" style={{ flex: 1 }}>
                  <span className="prefix">$</span>
                  <input
                    className="form-input no-border-left"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.monthlyAllocation}
                    onChange={(e) => setForm({ ...form, monthlyAllocation: e.target.value })}
                    placeholder="per month"
                  />
                </div>
              )}
            </div>

            {form.type === 'long-term' && form.ltMode === 'duration' &&
              form.targetAmount && form.months &&
              parseFloat(form.targetAmount) > 0 && parseInt(form.months) > 0 && (
              <div className="goal-preview">
                ~${(parseFloat(form.targetAmount) / (parseInt(form.months) * WEEKS_PER_MONTH)).toFixed(2)}/paycheck
                for {form.months} month{parseInt(form.months) !== 1 ? 's' : ''}
              </div>
            )}
            {form.type === 'long-term' && form.ltMode === 'fixed' &&
              form.targetAmount && form.monthlyAllocation &&
              parseFloat(form.targetAmount) > 0 && parseFloat(form.monthlyAllocation) > 0 && (
              <div className="goal-preview">
                ${(parseFloat(form.monthlyAllocation) / WEEKS_PER_MONTH).toFixed(2)}/paycheck
                · done in ~{(parseFloat(form.targetAmount) / parseFloat(form.monthlyAllocation)).toFixed(1)} months
              </div>
            )}

            {form.type === 'standalone' && standaloneActive.length > 0 && (
              <p className="hint-text">
                Will be added to the queue after "{standaloneActive[standaloneActive.length - 1].name}".
              </p>
            )}

            <button className="add-btn" onClick={addGoal} disabled={!canAdd}>
              Add Goal
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
