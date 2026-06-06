import type { Priority, PaycheckRecord, Goal, Bill } from './types';

const PRIORITIES_KEY = 'kubera_priorities';
const HISTORY_KEY = 'kubera_history';

function makeDefaults(): Priority[] {
  return [
    { id: crypto.randomUUID(), name: 'Rent', type: 'fixed', amount: 0 },
    { id: crypto.randomUUID(), name: 'Savings', type: 'percentage', percentage: 10 },
    { id: crypto.randomUUID(), name: 'Groceries', type: 'fixed', amount: 0 },
    { id: crypto.randomUUID(), name: 'Spending', type: 'remainder' },
  ];
}

export function loadPriorities(): Priority[] {
  try {
    const raw = localStorage.getItem(PRIORITIES_KEY);
    return raw ? (JSON.parse(raw) as Priority[]) : makeDefaults();
  } catch {
    return makeDefaults();
  }
}

export function savePriorities(priorities: Priority[]): void {
  localStorage.setItem(PRIORITIES_KEY, JSON.stringify(priorities));
}

export function loadHistory(): PaycheckRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as PaycheckRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveHistory(history: PaycheckRecord[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

const GOALS_KEY = 'kubera_goals';

export function loadGoals(): Goal[] {
  try {
    const raw = localStorage.getItem(GOALS_KEY);
    return raw ? (JSON.parse(raw) as Goal[]) : [];
  } catch {
    return [];
  }
}

export function saveGoals(goals: Goal[]): void {
  localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
}

const BILLS_KEY = 'kubera_bills';

export function loadBills(): Bill[] {
  try {
    const raw = localStorage.getItem(BILLS_KEY);
    return raw ? (JSON.parse(raw) as Bill[]) : [];
  } catch {
    return [];
  }
}

export function saveBills(bills: Bill[]): void {
  localStorage.setItem(BILLS_KEY, JSON.stringify(bills));
}
