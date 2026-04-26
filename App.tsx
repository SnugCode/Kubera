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
type Frequency = "weekly" | "bi-weekly" | "monthly";
type EntryType = "income" | "expense";

type FinanceEntry = {
  id: string;
  type: EntryType;
  title: string;
  amount: number;
  frequency: Frequency;
  createdAt: string;
};

type EntryForm = {
  title: string;
  amount: string;
  frequency: Frequency;
};

const sections: Section[] = [
  "Overview",
  "Income",
  "Expenses",
  "Transaction History",
];

const frequencies: Frequency[] = ["weekly", "bi-weekly", "monthly"];

const emptyForm: EntryForm = {
  title: "",
  amount: "",
  frequency: "monthly",
};

const frequencyMultiplier: Record<Frequency, number> = {
  weekly: 52 / 12,
  "bi-weekly": 26 / 12,
  monthly: 1,
};

const formatCurrency = (amount: number) =>
  `$${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatFrequency = (frequency: Frequency) =>
  frequency
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("-");

const getMonthlyValue = (entry: FinanceEntry) =>
  entry.amount * frequencyMultiplier[entry.frequency];

const getMonthLabel = () =>
  new Date().toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

export default function App() {
  const [activeSection, setActiveSection] = useState<Section>("Overview");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [incomeForm, setIncomeForm] = useState<EntryForm>(emptyForm);
  const [expenseForm, setExpenseForm] = useState<EntryForm>(emptyForm);
  const [entries, setEntries] = useState<FinanceEntry[]>([]);

  const monthlyIncome = useMemo(
    () =>
      entries
        .filter((entry) => entry.type === "income")
        .reduce((sum, entry) => sum + getMonthlyValue(entry), 0),
    [entries],
  );

  const monthlyExpenses = useMemo(
    () =>
      entries
        .filter((entry) => entry.type === "expense")
        .reduce((sum, entry) => sum + getMonthlyValue(entry), 0),
    [entries],
  );

  const monthlyNet = monthlyIncome - monthlyExpenses;

  const addEntry = (type: EntryType) => {
    const form = type === "income" ? incomeForm : expenseForm;
    const amount = Number.parseFloat(form.amount);

    if (!form.title.trim() || Number.isNaN(amount) || amount <= 0) return;

    const newEntry: FinanceEntry = {
      id: `${type}-${Date.now()}`,
      type,
      title: form.title.trim(),
      amount,
      frequency: form.frequency,
      createdAt: new Date().toISOString(),
    };

    setEntries((prev) => [newEntry, ...prev]);

    if (type === "income") {
      setIncomeForm(emptyForm);
      return;
    }

    setExpenseForm(emptyForm);
  };

  const selectSection = (section: Section) => {
    setActiveSection(section);
    setIsMenuOpen(false);
  };

  const renderFrequencySelector = (
    selectedFrequency: Frequency,
    onSelect: (frequency: Frequency) => void,
  ) => (
    <View style={styles.frequencyRow}>
      {frequencies.map((frequency) => {
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

        <Text style={styles.label}>Frequency</Text>
        {renderFrequencySelector(form.frequency, (frequency) =>
          setForm((prev) => ({ ...prev, frequency })),
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

  const renderOverview = () => (
    <ScrollView contentContainerStyle={styles.sectionContent}>
      <Text style={styles.sectionEyebrow}>Current month onwards</Text>
      <Text style={styles.sectionTitle}>Overview</Text>
      <Text style={styles.sectionCopy}>
        Starting {getMonthLabel()}, weekly and bi-weekly entries are converted
        into monthly averages to show your expected net amount.
      </Text>

      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>Projected Monthly Net</Text>
        <Text
          style={[
            styles.heroAmount,
            monthlyNet >= 0 ? styles.positiveText : styles.negativeText,
          ]}
        >
          {formatCurrency(monthlyNet)}
        </Text>
      </View>

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Monthly Income</Text>
          <Text style={[styles.summaryAmount, styles.positiveText]}>
            {formatCurrency(monthlyIncome)}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Monthly Expenses</Text>
          <Text style={[styles.summaryAmount, styles.negativeText]}>
            {formatCurrency(monthlyExpenses)}
          </Text>
        </View>
      </View>

      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>Frequency math</Text>
        <Text style={styles.noteText}>Weekly = amount x 52 / 12</Text>
        <Text style={styles.noteText}>Bi-weekly = amount x 26 / 12</Text>
        <Text style={styles.noteText}>Monthly = amount x 1</Text>
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
                {formatFrequency(item.frequency)}
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>Kubera</Text>
          <Text style={styles.appTagline}>Personal finance tracker</Text>
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
  summaryGrid: {
    gap: 12,
  },
  summaryCard: {
    padding: 18,
    borderRadius: 22,
    backgroundColor: "#eef4e3",
  },
  summaryLabel: {
    color: "#66715f",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  summaryAmount: {
    fontSize: 24,
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
