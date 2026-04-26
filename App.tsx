import React, { useMemo, useState } from "react";
import {
  FlatList,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Section = "Overview" | "Income" | "Expenses" | "Transaction History";
type Frequency =
  | "weekly"
  | "bi-weekly"
  | "monthly"
  | "quarterly"
  | "annually"
  | "custom";
type EntryType = "income" | "expense";

type FinanceEntry = {
  id: string;
  type: EntryType;
  title: string;
  amount: number;
  frequency: Frequency;
  createdAt: string;
  startDate?: string;
  isOneTime?: boolean;
  customDays?: number;
};

type EntryForm = {
  title: string;
  amount: string;
  frequency: Frequency;
  startDate: string;
  isOneTime: boolean;
  customDays: number;
};

type MonthProjection = {
  month: string;
  year: number;
  weeks: number;
  income: number;
  expenses: number;
  net: number;
};

type YearProjection = {
  year: number;
  income: number;
  expenses: number;
  net: number;
};

const sections: Section[] = [
  "Overview",
  "Income",
  "Expenses",
  "Transaction History",
];

const incomeFrequencies: Frequency[] = ["weekly", "bi-weekly", "monthly"];
const expenseFrequencies: Frequency[] = [
  "weekly",
  "bi-weekly",
  "monthly",
  "quarterly",
  "annually",
  "custom",
];
const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const getDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const createEmptyForm = (): EntryForm => ({
  title: "",
  amount: "",
  frequency: "monthly",
  startDate: getDateInputValue(new Date()),
  isOneTime: false,
  customDays: 0,
});

const formatCurrency = (amount: number) =>
  `$${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatFrequency = (frequency: Frequency) => {
  if (frequency === "custom") return "Custom";

  return frequency
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("-");
};

const formatDateLabel = (date: Date) =>
  date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

const parseDateInput = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, monthIndex, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

const getWeeksInMonth = (year: number, monthIndex: number) => {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  return Math.ceil(daysInMonth / 7);
};

const getMonthsSinceStart = (
  startDate: Date,
  year: number,
  monthIndex: number,
) =>
  (year - startDate.getFullYear()) * 12 + monthIndex - startDate.getMonth();

const getDaysBetween = (startDate: Date, endDate: Date) =>
  Math.floor((endDate.getTime() - startDate.getTime()) / 86400000);

const countCustomOccurrencesForMonth = (
  startDate: Date,
  intervalDays: number,
  year: number,
  monthIndex: number,
) => {
  const safeIntervalDays = Math.floor(intervalDays);

  if (safeIntervalDays <= 0) return 0;

  const monthStart = new Date(year, monthIndex, 1);
  const monthEnd = new Date(year, monthIndex + 1, 0);

  if (monthEnd < startDate) return 0;

  let occurrenceDate = new Date(startDate);

  if (occurrenceDate < monthStart) {
    const daysUntilMonth = getDaysBetween(occurrenceDate, monthStart);
    const intervalsToSkip = Math.floor(daysUntilMonth / safeIntervalDays);

    occurrenceDate = new Date(occurrenceDate);
    occurrenceDate.setDate(occurrenceDate.getDate() + intervalsToSkip * safeIntervalDays);

    while (occurrenceDate < monthStart) {
      occurrenceDate.setDate(occurrenceDate.getDate() + safeIntervalDays);
    }
  }

  let count = 0;

  while (occurrenceDate <= monthEnd) {
    count += 1;
    occurrenceDate.setDate(occurrenceDate.getDate() + safeIntervalDays);
  }

  return count;
};

const getOccurrencesForMonth = (
  entry: FinanceEntry,
  weeks: number,
  year: number,
  monthIndex: number,
) => {
  if (entry.isOneTime) {
    const createdAt = new Date(entry.createdAt);

    return createdAt.getFullYear() === year && createdAt.getMonth() === monthIndex
      ? 1
      : 0;
  }

  if (entry.frequency === "weekly") return weeks;
  if (entry.frequency === "bi-weekly") return Math.ceil(weeks / 2);
  if (
    entry.frequency === "quarterly" ||
    entry.frequency === "annually" ||
    entry.frequency === "custom"
  ) {
    const startDate = entry.startDate ? parseDateInput(entry.startDate) : null;

    if (!startDate) return 0;
    if (entry.frequency === "custom") {
      return countCustomOccurrencesForMonth(
        startDate,
        entry.customDays ?? 0,
        year,
        monthIndex,
      );
    }

    const monthsSinceStart = getMonthsSinceStart(startDate, year, monthIndex);

    if (monthsSinceStart < 0) return 0;
    if (entry.frequency === "quarterly") return monthsSinceStart % 3 === 0 ? 1 : 0;

    return monthsSinceStart % 12 === 0 ? 1 : 0;
  }

  return 1;
};

const isEntryActiveForMonth = (
  entry: FinanceEntry,
  year: number,
  monthIndex: number,
) => {
  if (entry.isOneTime) {
    const createdAt = new Date(entry.createdAt);

    return createdAt.getFullYear() === year && createdAt.getMonth() === monthIndex;
  }

  if (entry.type === "income" || !entry.startDate) return true;

  const startDate = parseDateInput(entry.startDate);

  if (!startDate) return true;

  const entryMonth = new Date(year, monthIndex, 1).getTime();
  const startMonth = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    1,
  ).getTime();

  return entryMonth >= startMonth;
};

const getEntryValueForMonth = (
  entry: FinanceEntry,
  weeks: number,
  year: number,
  monthIndex: number,
) => {
  if (!isEntryActiveForMonth(entry, year, monthIndex)) return 0;

  return entry.amount * getOccurrencesForMonth(entry, weeks, year, monthIndex);
};

const getMonthProjection = (
  year: number,
  monthIndex: number,
  entries: FinanceEntry[],
): MonthProjection => {
  const weeks = getWeeksInMonth(year, monthIndex);
  const income = entries
    .filter((entry) => entry.type === "income")
    .reduce(
      (sum, entry) => sum + getEntryValueForMonth(entry, weeks, year, monthIndex),
      0,
    );
  const expenses = entries
    .filter((entry) => entry.type === "expense")
    .reduce(
      (sum, entry) => sum + getEntryValueForMonth(entry, weeks, year, monthIndex),
      0,
    );

  return {
    month: monthNames[monthIndex],
    year,
    weeks,
    income,
    expenses,
    net: income - expenses,
  };
};

const getYearRange = (startYear: number, endYear: number) =>
  Array.from({ length: endYear - startYear + 1 }, (_, index) =>
    startYear + index,
  );

export default function App() {
  const [activeSection, setActiveSection] = useState<Section>("Overview");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMonthlyOpen, setIsMonthlyOpen] = useState(true);
  const [isYearlyOpen, setIsYearlyOpen] = useState(false);
  const [nickname, setNickname] = useState("");
  const [nicknameInput, setNicknameInput] = useState("");
  const [appStartedAt] = useState(() => new Date());
  const [incomeForm, setIncomeForm] = useState<EntryForm>(() => createEmptyForm());
  const [expenseForm, setExpenseForm] = useState<EntryForm>(() => createEmptyForm());
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const today = new Date();
  const todayLabel = formatDateLabel(today);
  const currentYear = today.getFullYear();
  const currentMonthIndex = today.getMonth();
  const startYear = appStartedAt.getFullYear();
  const startMonthIndex = appStartedAt.getMonth();

  const visibleMonthProjections = useMemo<MonthProjection[]>(() => {
    const projections: MonthProjection[] = [];

    getYearRange(startYear, currentYear).forEach((year) => {
      const firstMonth = year === startYear ? startMonthIndex : 0;
      const lastMonth = year === currentYear ? currentMonthIndex : 11;

      for (let monthIndex = firstMonth; monthIndex <= lastMonth; monthIndex += 1) {
        projections.push(getMonthProjection(year, monthIndex, entries));
      }
    });

    return projections;
  }, [currentMonthIndex, currentYear, entries, startMonthIndex, startYear]);

  const fullYearMonthProjections = useMemo<MonthProjection[]>(() => {
    const projections: MonthProjection[] = [];

    getYearRange(startYear, currentYear).forEach((year) => {
      const firstMonth = year === startYear ? startMonthIndex : 0;

      for (let monthIndex = firstMonth; monthIndex <= 11; monthIndex += 1) {
        projections.push(getMonthProjection(year, monthIndex, entries));
      }
    });

    return projections;
  }, [currentYear, entries, startMonthIndex, startYear]);

  const currentMonthProjection =
    visibleMonthProjections[visibleMonthProjections.length - 1] ??
    getMonthProjection(currentYear, currentMonthIndex, entries);

  const yearProjections = useMemo<YearProjection[]>(
    () =>
      getYearRange(startYear, currentYear).map((year) => {
        const yearMonths = fullYearMonthProjections.filter(
          (projection) => projection.year === year,
        );
        const income = yearMonths.reduce(
          (sum, projection) => sum + projection.income,
          0,
        );
        const expenses = yearMonths.reduce(
          (sum, projection) => sum + projection.expenses,
          0,
        );

        return {
          year,
          income,
          expenses,
          net: income - expenses,
        };
      }),
    [currentYear, fullYearMonthProjections, startYear],
  );

  const addEntry = (type: EntryType) => {
    const form = type === "income" ? incomeForm : expenseForm;
    const amount = Number.parseFloat(form.amount);

    const startDate = type === "expense" ? parseDateInput(form.startDate) : null;

    if (
      !form.title.trim() ||
      Number.isNaN(amount) ||
      amount <= 0 ||
      (type === "expense" && !startDate)
    ) {
      return;
    }

    const newEntry: FinanceEntry = {
      id: `${type}-${Date.now()}`,
      type,
      title: form.title.trim(),
      amount,
      frequency: form.isOneTime ? "monthly" : form.frequency,
      createdAt: new Date().toISOString(),
      startDate: startDate ? getDateInputValue(startDate) : undefined,
      isOneTime: type === "income" ? form.isOneTime : false,
      customDays:
        type === "expense" && form.frequency === "custom"
          ? Math.max(0, Math.floor(form.customDays))
          : undefined,
    };

    setEntries((prev) => [newEntry, ...prev]);

    if (type === "income") {
      setIncomeForm(createEmptyForm());
      return;
    }

    setExpenseForm(createEmptyForm());
  };

  const saveNickname = () => {
    const trimmedNickname = nicknameInput.trim();

    if (!trimmedNickname) return;

    setNickname(trimmedNickname);
  };

  const selectSection = (section: Section) => {
    setActiveSection(section);
    setIsMenuOpen(false);
  };

  const renderFrequencySelector = (
    availableFrequencies: Frequency[],
    selectedFrequency: Frequency,
    onSelect: (frequency: Frequency) => void,
  ) => (
    <View style={styles.frequencyRow}>
      {availableFrequencies.map((frequency) => {
        const isSelected = selectedFrequency === frequency;

        return (
          <TouchableOpacity
            key={frequency}
            style={[
              styles.frequencyButton,
              isSelected && styles.frequencyButtonActive,
            ]}
            onPress={() => onSelect(frequency)}
          >
            <Text
              style={[
                styles.frequencyButtonText,
                isSelected && styles.frequencyButtonTextActive,
              ]}
            >
              {formatFrequency(frequency)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderEntryForm = (type: EntryType) => {
    const isIncome = type === "income";
    const form = isIncome ? incomeForm : expenseForm;
    const setForm = isIncome ? setIncomeForm : setExpenseForm;

    return (
      <ScrollView contentContainerStyle={styles.sectionContent}>
        <Text style={styles.sectionEyebrow}>
          {isIncome ? "Money coming in" : "Money going out"}
        </Text>
        <Text style={styles.sectionTitle}>
          {isIncome ? "Add Income" : "Add Expense"}
        </Text>
        <Text style={styles.sectionCopy}>
          Capture recurring {isIncome ? "income" : "costs"} here so the
          overview can project your monthly position.
        </Text>

        <Text style={styles.label}>Title</Text>
        <TextInput
          placeholder={isIncome ? "Salary, client work..." : "Rent, groceries..."}
          value={form.title}
          onChangeText={(title) => setForm((prev) => ({ ...prev, title }))}
          style={styles.input}
        />

        <Text style={styles.label}>Amount</Text>
        <TextInput
          placeholder="0.00"
          value={form.amount}
          onChangeText={(amount) => setForm((prev) => ({ ...prev, amount }))}
          keyboardType="decimal-pad"
          style={styles.input}
        />

        {isIncome && (
          <>
            <Text style={styles.label}>Income Type</Text>
            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[
                  styles.typeOption,
                  !form.isOneTime && styles.typeOptionActive,
                ]}
                onPress={() =>
                  setForm((prev) => ({ ...prev, isOneTime: false }))
                }
              >
                <Text
                  style={[
                    styles.typeOptionTitle,
                    !form.isOneTime && styles.typeOptionTitleActive,
                  ]}
                >
                  Recurring
                </Text>
                <Text
                  style={[
                    styles.typeOptionText,
                    !form.isOneTime && styles.typeOptionTextActive,
                  ]}
                >
                  Uses frequency below
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typeOption,
                  form.isOneTime && styles.typeOptionActive,
                ]}
                onPress={() =>
                  setForm((prev) => ({ ...prev, isOneTime: true }))
                }
              >
                <Text
                  style={[
                    styles.typeOptionTitle,
                    form.isOneTime && styles.typeOptionTitleActive,
                  ]}
                >
                  One-time
                </Text>
                <Text
                  style={[
                    styles.typeOptionText,
                    form.isOneTime && styles.typeOptionTextActive,
                  ]}
                >
                  Counts once only
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {(!isIncome || !form.isOneTime) && (
          <>
            <Text style={styles.label}>Frequency</Text>
            {renderFrequencySelector(
              isIncome ? incomeFrequencies : expenseFrequencies,
              form.frequency,
              (frequency) => setForm((prev) => ({ ...prev, frequency })),
            )}
          </>
        )}

        {!isIncome && form.frequency === "custom" && (
          <View style={styles.customFrequencyCard}>
            <View style={styles.customFrequencySentence}>
              <Text style={styles.customFrequencyText}>Every</Text>
              <TouchableOpacity
                style={styles.counterButton}
                onPress={() =>
                  setForm((prev) => ({
                    ...prev,
                    customDays: Math.max(0, prev.customDays - 1),
                  }))
                }
              >
                <Text style={styles.counterButtonText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.counterValue}>{form.customDays}</Text>
              <TouchableOpacity
                style={styles.counterButton}
                onPress={() =>
                  setForm((prev) => ({
                    ...prev,
                    customDays: prev.customDays + 1,
                  }))
                }
              >
                <Text style={styles.counterButtonText}>+</Text>
              </TouchableOpacity>
              <Text style={styles.customFrequencyText}>days</Text>
            </View>
            <Text style={styles.customFrequencyHint}>
              Starts at 0. Use + to add days and - to deduct while above 0.
            </Text>
          </View>
        )}

        {!isIncome && (
          <>
            <Text style={styles.label}>Start Date</Text>
            <TextInput
              placeholder="YYYY-MM-DD"
              value={form.startDate}
              onChangeText={(startDate) =>
                setForm((prev) => ({ ...prev, startDate }))
              }
              keyboardType="numbers-and-punctuation"
              style={styles.input}
            />
          </>
        )}

        <TouchableOpacity
          style={[styles.button, isIncome ? styles.incomeButton : styles.expenseButton]}
          onPress={() => addEntry(type)}
        >
          <Text style={styles.buttonText}>
            Add {isIncome ? "Income" : "Expense"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  const renderProjectionTotals = (
    income: number,
    expenses: number,
    net: number,
  ) => (
    <View style={styles.projectionTotals}>
      <Text style={[styles.monthAmount, styles.positiveText]}>
        +{formatCurrency(income)}
      </Text>
      <Text style={[styles.monthAmount, styles.negativeText]}>
        -{formatCurrency(expenses)}
      </Text>
      <Text
        style={[styles.monthNet, net >= 0 ? styles.positiveText : styles.negativeText]}
      >
        Net {formatCurrency(net)}
      </Text>
    </View>
  );

  const renderOverview = () => (
    <ScrollView contentContainerStyle={styles.sectionContent}>
      <Text style={styles.sectionEyebrow}>Since you got Kubera</Text>
      <Text style={styles.sectionTitle}>Overview</Text>
      <Text style={styles.sectionCopy}>
        Monthly projections show from the month you first opened the app through
        the current month. Yearly totals still calculate the full current year
        in the background, including upcoming months.
      </Text>

      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>Current Month Net</Text>
        <Text
          style={[
            styles.heroAmount,
            currentMonthProjection.net >= 0
              ? styles.positiveText
              : styles.negativeText,
          ]}
        >
          {formatCurrency(currentMonthProjection.net)}
        </Text>
        <Text style={styles.heroMeta}>
          {currentMonthProjection.month} {currentMonthProjection.year} uses {" "}
          {currentMonthProjection.weeks} pay weeks.
        </Text>
      </View>

      <View style={styles.collapsibleCard}>
        <TouchableOpacity
          style={styles.collapsibleHeader}
          onPress={() => setIsMonthlyOpen((prev) => !prev)}
        >
          <View>
            <Text style={styles.collapsibleTitle}>Monthly</Text>
            <Text style={styles.collapsibleMeta}>
              {visibleMonthProjections.length} month
              {visibleMonthProjections.length === 1 ? "" : "s"} shown
            </Text>
          </View>
          <Text style={styles.collapsibleIcon}>{isMonthlyOpen ? "-" : "+"}</Text>
        </TouchableOpacity>

        {isMonthlyOpen && (
          <View style={styles.projectionList}>
            {visibleMonthProjections.map((projection) => (
              <View
                key={`${projection.year}-${projection.month}`}
                style={styles.projectionRow}
              >
                <View>
                  <Text style={styles.monthName}>
                    {projection.month} {projection.year}
                  </Text>
                  <Text style={styles.monthMeta}>{projection.weeks} weeks</Text>
                </View>
                {renderProjectionTotals(
                  projection.income,
                  projection.expenses,
                  projection.net,
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.collapsibleCard}>
        <TouchableOpacity
          style={styles.collapsibleHeader}
          onPress={() => setIsYearlyOpen((prev) => !prev)}
        >
          <View>
            <Text style={styles.collapsibleTitle}>Yearly</Text>
            <Text style={styles.collapsibleMeta}>
              {yearProjections.length} year
              {yearProjections.length === 1 ? "" : "s"} shown
            </Text>
          </View>
          <Text style={styles.collapsibleIcon}>{isYearlyOpen ? "-" : "+"}</Text>
        </TouchableOpacity>

        {isYearlyOpen && (
          <View style={styles.projectionList}>
            {yearProjections.map((projection) => (
              <View key={projection.year} style={styles.projectionRow}>
                <View>
                  <Text style={styles.monthName}>{projection.year}</Text>
                  <Text style={styles.monthMeta}>Full year projection</Text>
                </View>
                {renderProjectionTotals(
                  projection.income,
                  projection.expenses,
                  projection.net,
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>Frequency math</Text>
        <Text style={styles.noteText}>Weekly = amount x month week count</Text>
        <Text style={styles.noteText}>Bi-weekly = amount x half the month week count</Text>
        <Text style={styles.noteText}>Monthly = amount x 1</Text>
        <Text style={styles.noteText}>Quarterly = amount every 3 months from start date</Text>
        <Text style={styles.noteText}>Annually = amount every 12 months from start date</Text>
        <Text style={styles.noteText}>Custom = amount every chosen number of days</Text>
        <Text style={styles.noteText}>One-time income = amount in the month added</Text>
      </View>
    </ScrollView>
  );

  const renderHistory = () => (
    <View style={styles.sectionContent}>
      <Text style={styles.sectionEyebrow}>All user inputs</Text>
      <Text style={styles.sectionTitle}>Transaction History</Text>

      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No entries yet. Add income or expenses and they will appear here.
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.historyCard}>
            <View>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardMeta}>
                {item.type === "income" ? "Income" : "Expense"} -{" "}
                {item.isOneTime ? "One-Time" : formatFrequency(item.frequency)}
                {item.frequency === "custom" && item.customDays
                  ? ` every ${item.customDays} days`
                  : ""}
                {item.startDate ? ` - Starts ${item.startDate}` : ""}
              </Text>
            </View>
            <Text
              style={[
                styles.cardAmount,
                item.type === "income" ? styles.positiveText : styles.negativeText,
              ]}
            >
              {item.type === "income" ? "+" : "-"}
              {formatCurrency(item.amount)}
            </Text>
          </View>
        )}
      />
    </View>
  );

  const renderActiveSection = () => {
    if (activeSection === "Income") return renderEntryForm("income");
    if (activeSection === "Expenses") return renderEntryForm("expense");
    if (activeSection === "Transaction History") return renderHistory();

    return renderOverview();
  };

  if (!nickname) {
    return (
      <SafeAreaView style={styles.onboardingContainer}>
        <View style={styles.onboardingCard}>
          <Text style={styles.onboardingEyebrow}>Welcome to</Text>
          <Text style={styles.onboardingTitle}>Kubera</Text>
          <Text style={styles.onboardingCopy}>
            What should we call your personal finance tracker?
          </Text>

          <Text style={styles.label}>Nickname</Text>
          <TextInput
            placeholder="Your nickname"
            value={nicknameInput}
            onChangeText={setNicknameInput}
            onSubmitEditing={saveNickname}
            style={styles.input}
          />

          <TouchableOpacity style={styles.button} onPress={saveNickname}>
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>Kubera</Text>
          <Text style={styles.appTagline}>
            {nickname}'s Personal Finance Tracker
          </Text>
          <Text style={styles.todayLabel}>Today: {todayLabel}</Text>
        </View>

        <TouchableOpacity
          accessibilityLabel="Open navigation menu"
          style={styles.menuButton}
          onPress={() => setIsMenuOpen((prev) => !prev)}
        >
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
        </TouchableOpacity>
      </View>

      {isMenuOpen && (
        <View style={styles.menu}>
          {sections.map((section) => (
            <TouchableOpacity
              key={section}
              style={[
                styles.menuItem,
                activeSection === section && styles.menuItemActive,
              ]}
              onPress={() => selectSection(section)}
            >
              <Text
                style={[
                  styles.menuItemText,
                  activeSection === section && styles.menuItemTextActive,
                ]}
              >
                {section}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {renderActiveSection()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f0e8",
  },
  onboardingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
    backgroundColor: "#15251b",
  },
  onboardingCard: {
    width: "100%",
    padding: 24,
    borderRadius: 30,
    backgroundColor: "#fffaf1",
  },
  onboardingEyebrow: {
    color: "#8a5c2e",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  onboardingTitle: {
    color: "#15251b",
    fontSize: 44,
    fontWeight: "900",
    marginBottom: 8,
  },
  onboardingCopy: {
    color: "#5b665d",
    fontSize: 17,
    lineHeight: 24,
    marginBottom: 22,
  },
  header: {
    position: "relative",
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 18,
    backgroundColor: "#15251b",
  },
  appName: {
    color: "#f9e8b8",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  appTagline: {
    marginTop: 2,
    color: "#c8d1bd",
    fontSize: 13,
    fontWeight: "600",
  },
  todayLabel: {
    marginTop: 6,
    color: "#f9e8b8",
    fontSize: 12,
    fontWeight: "800",
  },
  menuButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#f9e8b8",
  },
  menuLine: {
    width: 22,
    height: 2,
    marginVertical: 3,
    borderRadius: 2,
    backgroundColor: "#15251b",
  },
  menu: {
    position: "absolute",
    top: 92,
    right: 18,
    zIndex: 3,
    width: 230,
    padding: 10,
    borderRadius: 22,
    backgroundColor: "#fffaf1",
    shadowColor: "#15251b",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  menuItem: {
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  menuItemActive: {
    backgroundColor: "#dfe8cf",
  },
  menuItemText: {
    color: "#223427",
    fontSize: 16,
    fontWeight: "700",
  },
  menuItemTextActive: {
    color: "#0c1f13",
  },
  sectionContent: {
    flexGrow: 1,
    padding: 22,
  },
  sectionEyebrow: {
    color: "#8a5c2e",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  sectionTitle: {
    color: "#18251c",
    fontSize: 32,
    fontWeight: "900",
    marginBottom: 10,
  },
  sectionCopy: {
    color: "#5b665d",
    fontSize: 16,
    lineHeight: 23,
    marginBottom: 22,
  },
  heroCard: {
    padding: 24,
    borderRadius: 28,
    marginBottom: 16,
    backgroundColor: "#fffaf1",
    borderWidth: 1,
    borderColor: "#eadcc4",
  },
  heroLabel: {
    color: "#66715f",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  heroAmount: {
    fontSize: 42,
    fontWeight: "900",
  },
  heroMeta: {
    color: "#66715f",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 8,
  },
  collapsibleCard: {
    overflow: "hidden",
    borderRadius: 24,
    marginBottom: 14,
    backgroundColor: "#fffaf1",
    borderWidth: 1,
    borderColor: "#eadcc4",
  },
  collapsibleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 18,
  },
  collapsibleTitle: {
    color: "#18251c",
    fontSize: 20,
    fontWeight: "900",
  },
  collapsibleMeta: {
    color: "#6d766c",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
  },
  collapsibleIcon: {
    color: "#15251b",
    fontSize: 30,
    fontWeight: "800",
  },
  projectionList: {
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  projectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#f5f0e8",
  },
  monthName: {
    color: "#18251c",
    fontSize: 18,
    fontWeight: "900",
  },
  monthMeta: {
    color: "#6d766c",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
  },
  projectionTotals: {
    alignItems: "flex-end",
    gap: 3,
  },
  monthAmount: {
    fontSize: 13,
    fontWeight: "800",
  },
  monthNet: {
    fontSize: 15,
    fontWeight: "900",
  },
  noteCard: {
    padding: 18,
    borderRadius: 22,
    marginTop: 16,
    backgroundColor: "#17261d",
  },
  noteTitle: {
    color: "#f9e8b8",
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 8,
  },
  noteText: {
    color: "#dbe5d2",
    fontSize: 14,
    lineHeight: 22,
  },
  label: {
    color: "#223427",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#dccdb6",
    padding: 15,
    borderRadius: 16,
    marginBottom: 16,
    backgroundColor: "#fffaf1",
    color: "#18251c",
    fontSize: 16,
  },
  typeSelector: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  typeOption: {
    flex: 1,
    padding: 14,
    borderWidth: 1,
    borderColor: "#dccdb6",
    borderRadius: 18,
    backgroundColor: "#fffaf1",
  },
  typeOptionActive: {
    borderColor: "#176b41",
    backgroundColor: "#176b41",
  },
  typeOptionTitle: {
    color: "#18251c",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 4,
  },
  typeOptionTitleActive: {
    color: "#fffaf1",
  },
  typeOptionText: {
    color: "#6d766c",
    fontSize: 12,
    fontWeight: "800",
  },
  typeOptionTextActive: {
    color: "#dbe5d2",
  },
  customFrequencyCard: {
    padding: 16,
    borderWidth: 1,
    borderColor: "#dccdb6",
    borderRadius: 20,
    marginTop: -6,
    marginBottom: 18,
    backgroundColor: "#fffaf1",
  },
  customFrequencySentence: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  customFrequencyText: {
    color: "#18251c",
    fontSize: 18,
    fontWeight: "900",
  },
  counterButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    marginHorizontal: 6,
    backgroundColor: "#15251b",
  },
  counterButtonText: {
    color: "#f9e8b8",
    fontSize: 20,
    fontWeight: "900",
  },
  counterValue: {
    color: "#176b41",
    fontSize: 24,
    fontWeight: "900",
  },
  customFrequencyHint: {
    color: "#6d766c",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 8,
  },
  frequencyRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 22,
  },
  frequencyButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#c8b99f",
    borderRadius: 999,
    backgroundColor: "#fffaf1",
  },
  frequencyButtonActive: {
    borderColor: "#15251b",
    backgroundColor: "#15251b",
  },
  frequencyButtonText: {
    color: "#344139",
    fontSize: 14,
    fontWeight: "800",
  },
  frequencyButtonTextActive: {
    color: "#f9e8b8",
  },
  button: {
    padding: 17,
    borderRadius: 18,
    marginTop: 4,
  },
  incomeButton: {
    backgroundColor: "#176b41",
  },
  expenseButton: {
    backgroundColor: "#9f3d28",
  },
  buttonText: {
    color: "#fffaf1",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "900",
  },
  historyCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    backgroundColor: "#fffaf1",
    borderWidth: 1,
    borderColor: "#eadcc4",
  },
  cardTitle: {
    color: "#18251c",
    fontSize: 16,
    fontWeight: "900",
  },
  cardMeta: {
    color: "#6d766c",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 5,
  },
  cardAmount: {
    fontSize: 16,
    fontWeight: "900",
  },
  positiveText: {
    color: "#176b41",
  },
  negativeText: {
    color: "#9f3d28",
  },
  emptyText: {
    color: "#66715f",
    fontSize: 16,
    lineHeight: 23,
    paddingTop: 14,
  },
});
