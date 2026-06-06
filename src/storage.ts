import type { Priority, PaycheckRecord, Goal, Bill } from './types';

export interface AppData {
  priorities: Priority[];
  history:    PaycheckRecord[];
  goals:      Goal[];
  bills:      Bill[];
}

function makeDefaultPriorities(): Priority[] {
  return [
    { id: crypto.randomUUID(), name: 'Rent',      type: 'fixed',      amount: 0,  paidPeriods: [] },
    { id: crypto.randomUUID(), name: 'Savings',   type: 'percentage', percentage: 10 },
    { id: crypto.randomUUID(), name: 'Groceries', type: 'fixed',      amount: 0,  paidPeriods: [] },
    { id: crypto.randomUUID(), name: 'Spending',  type: 'remainder' },
  ];
}

// ── File store (Vite dev-server plugin at /api/store/:key) ────────────────────

async function fileRead<T>(key: string): Promise<T | null> {
  try {
    const res = await fetch(`/api/store/${key}`);
    if (!res.ok) return null;
    const data: unknown = await res.json();
    return (data !== null && data !== undefined) ? (data as T) : null;
  } catch {
    return null;
  }
}

function fileWrite<T>(key: string, data: T): void {
  fetch(`/api/store/${key}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  }).catch(() => {/* server unavailable — localStorage still has it */});
}

// ── localStorage (synchronous fallback / instant cache) ──────────────────────

function lsRead<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`kubera_${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}

function lsWrite<T>(key: string, data: T): void {
  try { localStorage.setItem(`kubera_${key}`, JSON.stringify(data)); } catch { /* quota */ }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Load all app data on startup.
 * File storage wins over localStorage (it's the persistent source of truth).
 * Falls back to localStorage, then built-in defaults.
 */
export async function loadAll(): Promise<AppData> {
  const [priorities, history, goals, bills] = await Promise.all([
    fileRead<Priority[]>('priorities').then(d => d ?? lsRead<Priority[]>('priorities') ?? makeDefaultPriorities()),
    fileRead<PaycheckRecord[]>('history').then(d => d ?? lsRead<PaycheckRecord[]>('history') ?? []),
    fileRead<Goal[]>('goals').then(d => d ?? lsRead<Goal[]>('goals') ?? []),
    fileRead<Bill[]>('bills').then(d => d ?? lsRead<Bill[]>('bills') ?? []),
  ]);
  return { priorities, history, goals, bills };
}

/**
 * Persist a data key — writes to localStorage immediately, then to the file store.
 */
function save<T>(key: string, data: T): void {
  lsWrite(key, data);
  fileWrite(key, data);
}

export const savePriorities = (d: Priority[])     => save('priorities', d);
export const saveHistory    = (d: PaycheckRecord[]) => save('history',    d);
export const saveGoals      = (d: Goal[])          => save('goals',       d);
export const saveBills      = (d: Bill[])           => save('bills',       d);
