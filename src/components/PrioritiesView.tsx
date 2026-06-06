import { useState } from 'react';
import type { Priority, AllocationType, Bill, Goal } from '../types';

const WKPM = 52 / 12;

function billPerPaycheck(b: Bill): number {
  if (b.amount <= 0) return 0;
  switch (b.recurrence) {
    case 'weekly':      return b.amount;
    case 'fortnightly': return b.amount / 2;
    case 'monthly':     return b.amount / WKPM;
    case 'quarterly':   return b.amount / (3 * WKPM);
    case 'yearly':      return b.amount / (12 * WKPM);
    case 'interval':    return b.intervalDays && b.intervalDays > 0
      ? b.amount * 7 / b.intervalDays
      : 0;
    default:            return 0;
  }
}

interface Props {
  priorities: Priority[];
  onChange: (priorities: Priority[]) => void;
  bills: Bill[];
  goals: Goal[];
}

function getLinkKey(item: { linkKey?: string; name: string }): string {
  return (item.linkKey ?? item.name).trim().toLowerCase();
}

interface Form {
  name: string;
  type: AllocationType;
  amount: string;
  percentage: string;
  dueDay: string;
}

const empty: Form = { name: '', type: 'fixed', amount: '', percentage: '', dueDay: '' };

function priorityToForm(p: Priority): Form {
  return {
    name: p.name,
    type: p.type,
    amount: p.amount?.toString() ?? '',
    percentage: p.percentage?.toString() ?? '',
    dueDay: p.dueDay?.toString() ?? '',
  };
}

function formToPriority(f: Form, id: string, existing?: Priority): Priority {
  return {
    id,
    name: f.name.trim(),
    linkKey: f.name.trim().toLowerCase(),
    type: f.type,
    ...(f.type === 'fixed' && { amount: parseFloat(f.amount) || 0 }),
    ...(f.type === 'fixed' && f.dueDay && { dueDay: parseInt(f.dueDay) }),
    ...(f.type === 'percentage' && { percentage: parseFloat(f.percentage) || 0 }),
    paidPeriods: existing?.paidPeriods ?? [],
  };
}

export function PrioritiesView({ priorities, onChange, bills, goals }: Props) {
  const [addForm, setAddForm]               = useState<Form>(empty);
  const [editId, setEditId]                 = useState<string | null>(null);
  const [editForm, setEditForm]             = useState<Form>(empty);
  const [showBillsBreak, setShowBillsBreak] = useState(false);

  // Bills that count toward the autoSum Bills priority
  const aggregatedBills = bills.filter(b => (b.category ?? 'bill') === 'bill' && b.amount > 0);

  function add() {
    if (!addForm.name.trim()) return;
    onChange([...priorities, formToPriority(addForm, crypto.randomUUID())]);
    setAddForm(empty);
  }


  function remove(id: string) {
    onChange(priorities.filter((p) => p.id !== id));
    if (editId === id) setEditId(null);
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    const next = [...priorities];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onChange(next);
  }

  function moveDown(idx: number) {
    if (idx === priorities.length - 1) return;
    const next = [...priorities];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    onChange(next);
  }

  function startEdit(p: Priority) {
    setEditId(p.id);
    setEditForm(priorityToForm(p));
  }

  function saveEdit(id: string) {
    if (!editForm.name.trim()) return;
    onChange(priorities.map((p) => (p.id === id ? formToPriority(editForm, id, p) : p)));
    setEditId(null);
  }

  const typeLabel = (p: Priority) => {
    if (p.type === 'fixed') {
      const base = `$${(p.amount ?? 0).toFixed(2)}/mo`;
      return p.dueDay ? `${base} · due ${p.dueDay}${ordinal(p.dueDay)}` : base;
    }
    if (p.type === 'percentage') return `${p.percentage ?? 0}%`;
    return 'Remainder';
  };

  function ordinal(n: number) {
    if (n >= 11 && n <= 13) return 'th';
    return ['th','st','nd','rd','th','th','th','th','th','th'][n % 10];
  }

  return (
    <div className="view">
      <div className="card">
        <h2 className="section-title">Your Priorities</h2>
        <p className="hint-text">
          Money is allocated top to bottom. Fixed amounts are entered monthly — the app sets aside ¼ each paycheck. Percentages pull from what's left after fixed items. Remainder gets everything else.
        </p>

        {priorities.length === 0 && (
          <p className="empty-hint">No priorities yet. Add your first one below.</p>
        )}

        <div className="priority-list">
          {priorities.map((p, idx) => (
            <div key={p.id} className={`priority-item${editId === p.id ? ' editing' : ''}${p.autoSum ? ' auto-sum-item' : ''}`}>

              {/* ── Auto-managed Bills aggregator ── */}
              {p.autoSum ? (
                <div className="auto-sum-row">
                  <div className="priority-rank">{idx + 1}</div>
                  <div className="priority-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="priority-name">{p.name}</span>
                      <span className="auto-badge">Auto</span>
                    </div>
                    <div className="priority-tags">
                      <span className={`type-badge type-${p.type}`}>
                        ${(p.amount ?? 0).toFixed(2)}/mo · ${((p.amount ?? 0) / WKPM).toFixed(2)}/paycheck
                      </span>
                      <span className="auto-badge-sub">{aggregatedBills.length} bill{aggregatedBills.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className="priority-actions">
                    <button
                      className="icon-btn"
                      onClick={() => moveUp(idx)}
                      disabled={idx === 0}
                      title="Move up"
                    >↑</button>
                    <button
                      className="icon-btn"
                      onClick={() => moveDown(idx)}
                      disabled={idx === priorities.length - 1}
                      title="Move down"
                    >↓</button>
                    <button
                      className="icon-btn"
                      onClick={() => setShowBillsBreak(v => !v)}
                      title="Show bills breakdown"
                    >
                      {showBillsBreak ? '▲' : '▼'}
                    </button>
                  </div>
                </div>
              ) : editId === p.id ? (

              /* ── Edit form ── */
                <div className="inline-edit">
                  <input
                    className="edit-input"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="Name"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit(p.id)}
                  />
                  <select
                    className="edit-select"
                    value={editForm.type}
                    onChange={(e) => setEditForm({ ...editForm, type: e.target.value as AllocationType })}
                  >
                    <option value="fixed">Fixed $/mo</option>
                    <option value="percentage">Percentage %</option>
                    <option value="remainder">Remainder</option>
                  </select>
                  {editForm.type === 'fixed' && (
                    <input
                      className="edit-input narrow"
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.amount}
                      onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                      placeholder="$/mo"
                    />
                  )}
                  {editForm.type === 'percentage' && (
                    <input
                      className="edit-input narrow"
                      type="number"
                      min="0"
                      max="100"
                      value={editForm.percentage}
                      onChange={(e) => setEditForm({ ...editForm, percentage: e.target.value })}
                      placeholder="%"
                    />
                  )}
                  <button className="btn-sm primary" onClick={() => saveEdit(p.id)}>Save</button>
                  <button className="btn-sm" onClick={() => setEditId(null)}>Cancel</button>
                </div>
              ) : (

              /* ── Normal row ── */
                <>
                  <div className="priority-rank">{idx + 1}</div>
                  <div className="priority-info">
                    <span className="priority-name">{p.name}</span>
                    <div className="priority-tags">
                      <span className={`type-badge type-${p.type}`}>{typeLabel(p)}</span>
                      {bills.some((b) => getLinkKey(b) === getLinkKey(p)) && (
                        <span className="link-tag bill-link" title={`Linked to: ${bills.filter(b => getLinkKey(b) === getLinkKey(p)).map(b => b.name).join(', ')} in Bills`}>→ Bill</span>
                      )}
                      {goals.some((g) => getLinkKey(g) === getLinkKey(p)) && (
                        <span className="link-tag goal-link" title={`Linked to: ${goals.filter(g => getLinkKey(g) === getLinkKey(p)).map(g => g.name).join(', ')} in Goals`}>→ Goal</span>
                      )}
                    </div>
                  </div>
                  <div className="priority-actions">
                    <button className="icon-btn" onClick={() => moveUp(idx)} disabled={idx === 0} title="Move up">↑</button>
                    <button className="icon-btn" onClick={() => moveDown(idx)} disabled={idx === priorities.length - 1} title="Move down">↓</button>
                    <button className="icon-btn" onClick={() => startEdit(p)} title="Edit">✎</button>
                    <button className="icon-btn danger" onClick={() => remove(p.id)} title="Remove">✕</button>
                  </div>
                </>
              )}

              {/* ── Bills breakdown (expandable, only for autoSum) ── */}
              {p.autoSum && showBillsBreak && aggregatedBills.length > 0 && (
                <div className="bills-breakdown">
                  {aggregatedBills.map(b => (
                    <div key={b.id} className="bills-breakdown-row">
                      <span className="bb-dot" style={{ background: b.color }} />
                      <span className="bb-name">{b.name}</span>
                      <span className="bb-freq">{b.recurrence}</span>
                      <span className="bb-amount">${billPerPaycheck(b).toFixed(2)}/paycheck</span>
                    </div>
                  ))}
                </div>
              )}

            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 className="section-title">Add Priority</h3>
        <div className="add-form">
          <input
            className="form-input"
            value={addForm.name}
            onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
            placeholder="Name — e.g. Rent, Savings, Car payment..."
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <select
            className="form-select"
            value={addForm.type}
            onChange={(e) => setAddForm({ ...addForm, type: e.target.value as AllocationType, amount: '', percentage: '' })}
          >
            <option value="fixed">Fixed amount — enter monthly total, set aside ¼ each paycheck</option>
            <option value="percentage">Percentage — takes a % of what's left</option>
            <option value="remainder">Remainder — gets whatever is left over</option>
          </select>

          {addForm.type === 'fixed' && (
            <>
              <div className="prefixed-input">
                <span className="prefix">$</span>
                <input
                  className="form-input no-border-left"
                  type="number"
                  min="0"
                  step="0.01"
                  value={addForm.amount}
                  onChange={(e) => setAddForm({ ...addForm, amount: e.target.value })}
                  placeholder="monthly amount"
                />
              </div>
              {addForm.amount && parseFloat(addForm.amount) > 0 && (
                <div className="monthly-breakdown">
                  ${(parseFloat(addForm.amount) / (52 / 12)).toFixed(2)} set aside each paycheck
                </div>
              )}
              <div className="prefixed-input">
                <span className="prefix">Due</span>
                <input
                  className="form-input no-border-left"
                  type="number"
                  min="1"
                  max="28"
                  value={addForm.dueDay}
                  onChange={(e) => setAddForm({ ...addForm, dueDay: e.target.value })}
                  placeholder="day of month — shows in calendar (optional)"
                />
              </div>
            </>
          )}

          {addForm.type === 'percentage' && (
            <div className="prefixed-input">
              <input
                className="form-input no-border-right"
                type="number"
                min="0"
                max="100"
                value={addForm.percentage}
                onChange={(e) => setAddForm({ ...addForm, percentage: e.target.value })}
                placeholder="10"
              />
              <span className="suffix">%</span>
            </div>
          )}

          <button className="add-btn" onClick={add} disabled={!addForm.name.trim()}>
            Add Priority
          </button>
        </div>
      </div>
    </div>
  );
}
