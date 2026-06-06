# Kubera

Kubera is a personal paycheck allocator and finance tracker that runs locally in the browser. It tells you exactly where to put your money each week — covering essentials first, tracking bills and loans, and giving you a weekly guide based on your income history.

## Tech Stack

- **Vite** + **React 19** + **TypeScript**
- No external UI libraries — all styling is hand-written CSS
- Dual persistent storage: `localStorage` (instant, synchronous) + file-based JSON in `data/` via a Vite dev-server plugin (survives browser clears)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

Data is automatically saved to `data/*.json` as you use the app. No database or backend required.

## Features

### Paychecks
Enter your gross paycheck amount and date. Kubera runs your priority list against the amount and shows a full allocation breakdown. Past paychecks are saved and viewable in a collapsible history.

### Priorities
Define how your money is distributed, in order. Three allocation types:

| Type | How it works |
|---|---|
| **Fixed** | A monthly dollar amount — Kubera sets aside ¼ each paycheck |
| **Percentage** | Takes a % of what remains after fixed items |
| **Remainder** | Gets everything left over |

**Auto-managed priorities** — two special entries appear automatically and stay in sync without any manual input:
- **Bills** — aggregates all items marked as *bills* from the Bills & Expenses tab. Updates whenever a bill is added, changed, or removed.
- **Loans & Repayments** — aggregates all active loans. Calculates a monthly obligation based on upcoming installment due dates (pay-in-4) or outstanding balance (custom). Disappears when all loans are cleared.

Both can be reordered within the priority list.

### Goals
Track savings goals with two modes:

- **Long-term** — set a target amount and either a duration (Kubera calculates how much to set aside per paycheck) or a fixed monthly contribution
- **Standalone** — one-off targets with no paycheck schedule

Goals link to priorities by name. When the linked priority is paid, the goal updates automatically. Goals are marked complete when the target is reached.

### Bills & Expenses
A combined bill tracker and calendar. Items can be categorised as:

- **Bill** — rolled up into the auto Bills priority
- **Expense** — tracked standalone

Supported recurrence: Weekly, Fortnightly, Monthly, Quarterly, Yearly, One-time, Custom interval.

**Deposit tracking** — instead of a simple mark-paid toggle, you log partial deposits toward a bill. A progress bar fills as you add deposits. When the total reaches the bill amount the bill is marked paid automatically. Overdue recurring bills advance to the next cycle when fully settled.

The calendar view shows all bills, expenses, and pay-in-4 loan installments on their due dates with colour-coded dots. Select a day to see its events in detail.

### Loans & Repayments
Track money owed — Afterpay, Zip, personal debts, or anything else.

**Pay in 4** — four installments with individually editable due dates. Quick presets: Weekly (+0/+7/+14/+21) or Fortnightly (+0/+14/+28/+42 from today). When adding a loan for something partially paid off, tick which installments are already done. Each installment has a Pay button; paying all four completes the loan.

**Custom** — no fixed schedule. Deposit any amount at any time. The loan auto-completes when cumulative payments reach the total.

Both types show a progress bar. Completed loans collapse into a "Paid Off" archive.

### Assistant
A weekly guide that does the thinking for you.

**Income prediction** — averages your last 8 paychecks to estimate what you'll earn this week. Before you enter a paycheck, shows a preview allocation based on the prediction so you know what to expect.

**Once your paycheck is entered:**
- A chip in the header shows whether you're above average, on track, or below average
- Every priority is labelled **Essential** (fixed), **Flexible** (percentage), or **Discretionary** (remainder)
- **Tight week detection** — if your paycheck is more than 5% below your average, a warning card lists every non-essential priority and how much it received, and non-essential steps are dimmed. Essentials (Rent, Bills, Loans) are always fully covered first.

**Dual progress bars** — the allocation bars show two layers: green for expected allocation, red for actual deposits logged so far.

**Upcoming loans** — pay-in-4 installments due in the next 7 days appear with their due date and overdue flag. Active custom loans show a progress bar and remaining balance.

**Upcoming bills** — bills due in the next 7 days with partial deposit progress.

### Stats
Navigate week by week through your paycheck history. Each week shows gross income, how it was allocated, and a per-paycheck breakdown when multiple paychecks landed in the same week. Week navigation skips to weeks that actually have data.

## Project Structure

```
kubera/
├── src/
│   ├── App.tsx                    # Root — state, nav, auto-sync effects
│   ├── allocate.ts                # Priority allocation engine
│   ├── storage.ts                 # Dual localStorage + file persistence
│   ├── types.ts                   # All TypeScript interfaces
│   ├── index.css                  # All styles
│   └── components/
│       ├── PaycheckView.tsx
│       ├── PrioritiesView.tsx
│       ├── GoalsView.tsx
│       ├── CalendarView.tsx       # Bills, expenses, calendar grid
│       ├── LoansView.tsx
│       ├── AssistantView.tsx
│       ├── StatsView.tsx
│       └── HistoryView.tsx
├── data/                          # Auto-created JSON files (gitignored)
│   ├── priorities.json
│   ├── history.json
│   ├── goals.json
│   ├── bills.json
│   └── loans.json
├── index.html
├── vite.config.ts
└── package.json
```

## Data Persistence

All data is saved in two places simultaneously:

1. **`localStorage`** — written synchronously on every change; survives page refreshes
2. **`data/*.json`** — written via a Vite dev-server plugin; survives browser clears and profile resets

On load, file storage wins over localStorage. If neither exists, sensible defaults are used.

The `data/` directory is gitignored by default to keep personal financial data out of version control.

## Build

```bash
npm run build
```

Outputs a static site to `dist/`. The file-storage plugin is dev-only; in production, localStorage is the persistence layer.
