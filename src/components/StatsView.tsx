import { useState } from 'react';
import type { PaycheckRecord, Priority } from '../types';

interface Props {
  history:    PaycheckRecord[];
  priorities: Priority[];
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtShort(d: Date): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

interface WeekRange {
  start: Date;
  end:   Date;
  label: string;
}

function getWeekRange(offset: number): WeekRange {
  const now = new Date();
  const dow = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1) + offset * 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return {
    start,
    end,
    label: `${fmtShort(start)} – ${fmtShort(end)}, ${start.getFullYear()}`,
  };
}

function getWeekRecords(history: PaycheckRecord[], start: Date, end: Date): PaycheckRecord[] {
  return history
    .filter(r => { const d = new Date(r.date); return d >= start && d <= end; })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// Find the most recent week (offset) that has at least one paycheck record
function nearestPastWeek(history: PaycheckRecord[], fromOffset: number): number | null {
  for (let o = fromOffset - 1; o >= -104; o--) {
    const { start, end } = getWeekRange(o);
    if (history.some(r => { const d = new Date(r.date); return d >= start && d <= end; })) return o;
  }
  return null;
}

function nearestFutureWeek(history: PaycheckRecord[], fromOffset: number): number | null {
  for (let o = fromOffset + 1; o <= 0; o++) {
    const { start, end } = getWeekRange(o);
    if (history.some(r => { const d = new Date(r.date); return d >= start && d <= end; })) return o;
  }
  return null;
}

export function StatsView({ history, priorities }: Props) {
  const [weekOffset, setWeekOffset] = useState(0);

  const { start, end, label } = getWeekRange(weekOffset);
  const records   = getWeekRecords(history, start, end);
  const isNow     = weekOffset === 0;

  const hasPrev = nearestPastWeek(history, weekOffset) !== null;
  const hasNext = !isNow && nearestFutureWeek(history, weekOffset) !== null;

  function goBack() {
    const o = nearestPastWeek(history, weekOffset);
    if (o !== null) setWeekOffset(o);
  }

  function goForward() {
    if (isNow) return;
    const o = nearestFutureWeek(history, weekOffset);
    if (o !== null) setWeekOffset(o);
  }

  // Aggregate totals across multiple paychecks in the same week (rare but possible)
  const weekGross       = records.reduce((s, r) => s + r.gross, 0);
  const weekUnallocated = records.reduce((s, r) => s + r.result.unallocated, 0);

  // Merge allocation lines by priority id, summing amounts
  const mergedLines = (() => {
    const map = new Map<string, { name: string; allocated: number; shortfall: boolean }>();
    for (const r of records) {
      for (const l of r.result.lines) {
        const prev = map.get(l.priority.id);
        if (prev) {
          prev.allocated += l.allocated;
          if (l.shortfall) prev.shortfall = true;
        } else {
          map.set(l.priority.id, {
            name:      l.priority.name,
            allocated: l.allocated,
            shortfall: l.shortfall,
          });
        }
      }
    }
    return [...map.values()].sort((a, b) => b.allocated - a.allocated);
  })();

  return (
    <div className="view">

      {/* ── Week navigation ── */}
      <div className="card stats-nav-card">
        <button
          className="stats-nav-btn"
          onClick={goBack}
          disabled={!hasPrev}
          title="Previous week with data"
        >
          ‹
        </button>
        <div className="stats-nav-center">
          <span className="stats-week-label">{label}</span>
          {isNow && <span className="stats-now-badge">this week</span>}
        </div>
        <button
          className="stats-nav-btn"
          onClick={goForward}
          disabled={isNow || !hasNext}
          title="Next week with data"
        >
          ›
        </button>
      </div>

      {/* ── No data state ── */}
      {records.length === 0 && (
        <div className="card hint-card">
          {isNow
            ? 'No paycheck recorded yet this week. Head to Paychecks to enter one.'
            : 'No paycheck recorded for this week.'}
          {hasPrev && (
            <button className="stats-jump-btn" onClick={goBack}>
              ← Jump to last recorded week
            </button>
          )}
        </div>
      )}

      {/* ── Weekly summary ── */}
      {records.length > 0 && (
        <>
          <div className="card stats-summary-card">
            <div className="stats-gross-row">
              <div>
                <div className="stats-gross-label">
                  {records.length === 1
                    ? `Paycheck on ${fmtDate(new Date(records[0].date))}`
                    : `${records.length} paychecks this week`}
                </div>
                <div className="stats-gross-amount">
                  ${weekGross.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="stats-gross-chips">
                <span className="stats-chip allocated">
                  ${(weekGross - weekUnallocated).toFixed(2)} allocated
                </span>
                {weekUnallocated > 0.005 && (
                  <span className="stats-chip unallocated">
                    ${weekUnallocated.toFixed(2)} unallocated
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="section-title">Allocation breakdown</h3>
            <div className="stats-alloc-list">
              {mergedLines.map(line => {
                const pct = weekGross > 0 ? (line.allocated / weekGross) * 100 : 0;
                return (
                  <div key={line.name} className={`stats-alloc-row${line.shortfall ? ' shortfall' : ''}`}>
                    <div className="stats-alloc-top">
                      <span className="stats-alloc-name">{line.name}</span>
                      <div className="stats-alloc-right">
                        <span className="stats-alloc-pct">{pct.toFixed(1)}%</span>
                        <span className={`stats-alloc-amount${line.shortfall ? ' shortfall' : ''}`}>
                          ${line.allocated.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="stats-bar-track">
                      <div
                        className={`stats-bar-fill${line.shortfall ? ' shortfall' : ''}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              {weekUnallocated > 0.005 && (
                <div className="stats-alloc-row">
                  <div className="stats-alloc-top">
                    <span className="stats-alloc-name muted">Unallocated</span>
                    <div className="stats-alloc-right">
                      <span className="stats-alloc-pct muted">
                        {((weekUnallocated / weekGross) * 100).toFixed(1)}%
                      </span>
                      <span className="stats-alloc-amount muted">
                        ${weekUnallocated.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="stats-bar-track">
                    <div
                      className="stats-bar-fill unallocated"
                      style={{ width: `${Math.min(100, (weekUnallocated / weekGross) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Multiple paychecks breakdown ── */}
          {records.length > 1 && (
            <div className="card">
              <h3 className="section-title">Individual paychecks</h3>
              <div className="stats-individual-list">
                {records.map(r => (
                  <div key={r.id} className="stats-individual-row">
                    <span className="stats-indiv-date">{fmtDate(new Date(r.date))}</span>
                    <span className="stats-indiv-amount">
                      ${r.gross.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
}
