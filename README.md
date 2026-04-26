# Kubera

Kubera is a starter personal finance tracker built with React Native, Expo, and TypeScript. It helps a user enter recurring income, one-time income, and expenses, then projects monthly and yearly net amounts from those inputs.

## Current Status

This is an early local prototype. Data is stored in React state only, so entries and the nickname reset when the app reloads. Persistence can be added later with local storage or a database.

## Tech Stack

- React Native
- Expo
- TypeScript
- No external navigation or form libraries yet

## Getting Started

Install dependencies:

```bash
npm install
```

Start Expo:

```bash
npm start
```

Useful scripts:

```bash
npm run android
npm run ios
npm run web
```

Type-check the app:

```bash
npx tsc --noEmit
```

## First-Run Nickname

When the app starts, Kubera asks for the user's nickname. After the nickname is entered, the app header changes to:

```text
Kubera
{Nickname}'s Personal Finance Tracker
```

The header also shows today's date for reference.

## App Sections

Kubera uses a hamburger menu in the top-right corner. The menu contains:

- Overview
- Income
- Expenses
- Transaction History

Adding a transaction happens from the circular `+` button in the bottom-right corner.

## Overview

The Overview screen summarizes the user's projected finances.

It includes:

- Current month net amount
- Collapsible Monthly projection
- Collapsible Yearly projection
- Frequency math notes

Monthly projections only show months from when the user first opened the app through the current month.

Yearly projections calculate the full current year in the background, including upcoming months, even though upcoming months are not shown in the Monthly list.

## Add Transaction

Tap the circular `+` button in the bottom-right corner to open the Add Transaction screen. This single screen handles both income and expenses.

First choose the transaction type:

- Income
- Expense

For income, the form includes:

- Title
- Amount
- Income Type
- Frequency, if recurring

Income types:

- Recurring
- One-time

Recurring income supports:

- Weekly
- Bi-weekly
- Monthly

One-time income hides the frequency selector and counts only once in the month it was added.

For expenses, the form includes:

- Title
- Amount
- Frequency
- Optional custom day counter, when Custom is selected
- Start Date

## Income

The Income menu page displays income entries only, separately from expenses. It shows an income total and a filtered list of income items.

## Expenses

The Expenses menu page displays expense entries only, separately from income. It shows an expense total and a filtered list of expense items.

Expense frequencies:

- Weekly
- Bi-weekly
- Monthly
- Quarterly
- Annually
- Custom

The start date controls when the expense begins being counted in projections.

Custom expenses use a day counter shown as:

```text
Every [-] 0 [+] days
```

The counter starts at `0`. The `+` button adds one day. The `-` button subtracts one day only when the value is above `0`. A custom value of `0` means the expense is not scheduled yet.

## Transaction History

Transaction History records all user-entered income and expense items for the current app session.

Each history item shows:

- Title
- Income or Expense type
- Frequency or One-Time label
- Custom day interval, if applicable
- Start date, if applicable
- Amount

## Frequency Math

Kubera calculates recurring entries as follows:

- Weekly: amount multiplied by the practical week count for that month
- Bi-weekly: amount multiplied by half the practical week count, rounded up
- Monthly: amount once per month
- Quarterly: amount every 3 months from the expense start date
- Annually: amount every 12 months from the expense start date
- Custom: amount every chosen number of days from the expense start date
- One-time income: amount once in the month it was added

## Important Limitations

- Data is not saved after reload yet.
- The nickname is not saved after reload yet.
- Date entry currently uses `YYYY-MM-DD` text input rather than a native date picker.
- The app currently lives mostly in `App.tsx`; future refactors can split screens, components, and finance logic into separate files.

## Project Structure

```text
kubera/
  App.tsx
  app.json
  index.ts
  package.json
  tsconfig.json
  assets/
```

## Next Steps

1. Add persistent storage for nickname, income, expenses, and history.
2. Add edit and delete actions for entries.
3. Replace manual date text input with a proper date picker.
4. Split `App.tsx` into screens, components, and finance calculation utilities.
5. Add automated tests for projection math.
