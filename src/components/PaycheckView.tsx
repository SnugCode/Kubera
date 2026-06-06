import { useState } from 'react';
import { allocate } from '../allocate';
import type { Priority, PaycheckRecord } from '../types';

interface Props {
  priorities: Priority[];
  onSave: (record: PaycheckRecord) => void;
  history: PaycheckRecord[];
  onDelete: (id: string) => void;
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayStr() { return fmtDate(new Date()); }

export function PaycheckView({ priorities, onSave, history, onDelete }: Props) {
  const [input, setInput]       = useState('');
  const [date, setDate]         = useState(todayStr);
  const [expanded, setExpanded] = useState<string | null>(null);

  const gross = parseFloat(input) || 0;
  const result = gross > 0 ? allocate(gross, priorities) : { lines: [], unallocated: 0 };
  const hasShortfall = result.lines.some((l) => l.shortfall);

  function handleSave() {
    if (gross <= 0) return;
    onSave({
      id:   crypto.randomUUID(),
      date: new Date(date + 'T12:00:00').toISOString(),
      gross,
      result,
    });
    setInput('');
    setDate(todayStr());
  }

  const sorted = [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="paychecks-grid">

      {/* ── Left: entry + allocation ── */}
      <div className="paychecks-left">
        <div className="card paycheck-entry">
          <label className="entry-label">How much did you receive this paycheck?</label>
          <div className="amount-input-wrap">
            <span className="dollar-sign">$</span>
            <input
              className="amount-input"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
            />
          </div>
          <div className="date-row">
            <label className="date-label">Paycheck date</label>
            <input
              className="date-input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        {priorities.length === 0 && (
          <div className="card hint-card">
            No priorities set up yet. Go to <strong>Priorities</strong> to configure how your money gets split.
          </div>
        )}

        {gross > 0 && priorities.length > 0 && (
          <div className="card allocation-card">
            <h2 className="section-title">
              How to split your ${gross.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>

            {hasShortfall && (
              <div className="warning">
                Your paycheck doesn't fully cover all fixed expenses this week.
              </div>
            )}

            <div className="allocation-list">
              {result.lines.map((line) => (
                <div key={line.priority.id} className="allocation-row">
                  <div className="alloc-top">
                    <span className="alloc-name">{line.priority.name}</span>
                    <div className="alloc-right">
                      <span className={`alloc-amount${line.shortfall ? ' shortfall' : ''}`}>
                        ${line.allocated.toFixed(2)}
                        {line.priority.type === 'fixed' && !line.shortfall && (
                          <span className="shortfall-note"> of ${line.priority.amount?.toFixed(2)}/mo</span>
                        )}
                        {line.shortfall && (
                          <span className="shortfall-note"> / ${((line.priority.amount ?? 0) / (52 / 12)).toFixed(2)} needed</span>
                        )}
                      </span>
                      <span className="alloc-pct">{line.pct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${Math.max(0, line.pct)}%` }} />
                  </div>
                </div>
              ))}

              {result.unallocated > 0.005 && (
                <div className="allocation-row">
                  <div className="alloc-top">
                    <span className="alloc-name muted">Unallocated</span>
                    <div className="alloc-right">
                      <span className="alloc-amount muted">${result.unallocated.toFixed(2)}</span>
                      <span className="alloc-pct">{((result.unallocated / gross) * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill unallocated" style={{ width: `${(result.unallocated / gross) * 100}%` }} />
                  </div>
                </div>
              )}
            </div>

            <button className="save-btn" onClick={handleSave}>
              Save this paycheck →
            </button>
          </div>
        )}
      </div>

      {/* ── Right: history ── */}
      <div className="paychecks-right">
        <div className="card">
          <h3 className="section-title">Paycheck History</h3>
          {sorted.length === 0 ? (
            <p className="empty-hint">No history yet. Save a paycheck to start tracking.</p>
          ) : (
            <div className="history-list">
              {sorted.map((record) => {
                const d      = new Date(record.date);
                const isOpen = expanded === record.id;
                return (
                  <div key={record.id} className="history-card">
                    <button
                      className="history-header"
                      onClick={() => setExpanded(isOpen ? null : record.id)}
                    >
                      <div className="history-meta">
                        <span className="history-date">
                          {fmtDate(d)}
                        </span>
                        <span className="history-gross">
                          ${record.gross.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <span className="expand-icon">{isOpen ? '▲' : '▼'}</span>
                    </button>
                    {isOpen && (
                      <div className="history-detail">
                        {record.result.lines.map((line) => (
                          <div key={line.priority.id} className="history-line">
                            <span className="history-line-name">{line.priority.name}</span>
                            <div className="history-bar-track">
                              <div className="history-bar-fill" style={{ width: `${line.pct}%` }} />
                            </div>
                            <span className="history-line-amount">${line.allocated.toFixed(2)}</span>
                          </div>
                        ))}
                        {record.result.unallocated > 0.005 && (
                          <div className="history-line muted">
                            <span className="history-line-name">Unallocated</span>
                            <div className="history-bar-track">
                              <div className="history-bar-fill unallocated" style={{ width: `${(record.result.unallocated / record.gross) * 100}%` }} />
                            </div>
                            <span className="history-line-amount">${record.result.unallocated.toFixed(2)}</span>
                          </div>
                        )}
                        <button className="delete-btn" onClick={() => onDelete(record.id)}>
                          Delete record
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
