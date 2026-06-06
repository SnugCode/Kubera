import { useState } from 'react';
import type { PaycheckRecord } from '../types';

interface Props {
  history: PaycheckRecord[];
  onDelete: (id: string) => void;
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function HistoryView({ history, onDelete }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (history.length === 0) {
    return (
      <div className="view">
        <div className="card hint-card">
          No history yet. Enter a paycheck amount and hit Save to start tracking.
        </div>
      </div>
    );
  }

  const sorted = [...history].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="view">
      {sorted.map((record) => {
        const date = new Date(record.date);
        const isOpen = expanded === record.id;

        return (
          <div key={record.id} className="card history-card">
            <button
              className="history-header"
              onClick={() => setExpanded(isOpen ? null : record.id)}
            >
              <div className="history-meta">
                <span className="history-date">
                  {fmtDate(date)}
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
  );
}
