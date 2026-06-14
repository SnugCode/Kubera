import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { IncomeRecord } from '../types'
import { loadStore, saveStore } from '../services/store'
import { today, startOfWeek, addDays } from '../utils/dates'
import { computeBaseline } from '../utils/guidance'

function uuid() { return crypto.randomUUID() }

export const useIncomeStore = defineStore('income', () => {
  const records = ref<IncomeRecord[]>([])
  const ready = ref(false)

  async function load() {
    records.value = await loadStore<IncomeRecord>('income')
    ready.value = true
  }

  async function persist() {
    await saveStore('income', records.value)
  }

  async function add(amount: number, date?: string, note?: string) {
    records.value.push({
      id: uuid(),
      date: date ?? today(),
      amount,
      note,
      createdAt: new Date().toISOString(),
    })
    records.value.sort((a, b) => b.date.localeCompare(a.date))
    await persist()
  }

  async function remove(id: string) {
    records.value = records.value.filter(r => r.id !== id)
    await persist()
  }

  /** Sum of income recorded in the current ISO week (Mon–Sun). */
  const thisWeekTotal = computed(() => {
    const weekStart = startOfWeek(today())
    const weekEnd = addDays(weekStart, 6)
    return records.value
      .filter(r => r.date >= weekStart && r.date <= weekEnd)
      .reduce((s, r) => s + r.amount, 0)
  })

  const baseline = computed(() => computeBaseline(records.value))

  /** The effective paycheck to use for guidance: this week's total or the baseline. */
  const effectivePaycheck = computed(() =>
    thisWeekTotal.value > 0 ? thisWeekTotal.value : baseline.value.value
  )

  const sorted = computed(() =>
    [...records.value].sort((a, b) => b.date.localeCompare(a.date))
  )

  return { records, ready, sorted, thisWeekTotal, baseline, effectivePaycheck, load, add, remove }
})
