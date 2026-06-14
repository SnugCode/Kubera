import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AllocationRecord } from '../types'
import { loadStore, saveStore } from '../services/store'
import { today, monthKey, startOfWeek, addDays } from '../utils/dates'

function uuid() { return crypto.randomUUID() }

export const useAllocationsStore = defineStore('allocations', () => {
  const records = ref<AllocationRecord[]>([])
  const ready = ref(false)

  async function load() {
    records.value = await loadStore<AllocationRecord>('allocations')
    ready.value = true
  }

  async function persist() {
    await saveStore('allocations', records.value)
  }

  async function record(commitmentId: string, amount: number, periodKey: string, note?: string) {
    records.value.push({
      id: uuid(),
      commitmentId,
      date: today(),
      amount,
      periodKey,
      note,
      createdAt: new Date().toISOString(),
    })
    await persist()
  }

  async function remove(id: string) {
    records.value = records.value.filter(r => r.id !== id)
    await persist()
  }

  /** Replace all records for a commitment+period with a single record for the new total. */
  async function adjustForPeriod(commitmentId: string, periodKey: string, newTotal: number) {
    records.value = records.value.filter(
      r => !(r.commitmentId === commitmentId && r.periodKey === periodKey)
    )
    if (newTotal > 0) {
      records.value.push({
        id: uuid(),
        commitmentId,
        date: today(),
        amount: newTotal,
        periodKey,
        note: 'Manually adjusted',
        createdAt: new Date().toISOString(),
      })
    }
    await persist()
  }

  /** Allocation records for the current ISO week. */
  const thisWeek = computed(() => {
    const weekStart = startOfWeek(today())
    const weekEnd = addDays(weekStart, 6)
    return records.value.filter(r => r.date >= weekStart && r.date <= weekEnd)
  })

  /** Allocation records for the current calendar month. */
  const thisMonth = computed(() => {
    const mo = monthKey(today())
    return records.value.filter(r => r.date.startsWith(mo))
  })

  /** Total allocated per commitment ID, across all time. */
  const totalByCommitment = computed(() => {
    const map = new Map<string, number>()
    for (const r of records.value) {
      map.set(r.commitmentId, (map.get(r.commitmentId) ?? 0) + r.amount)
    }
    return map
  })

  const sorted = computed(() =>
    [...records.value].sort((a, b) => b.date.localeCompare(a.date))
  )

  return { records, ready, sorted, thisWeek, thisMonth, totalByCommitment, load, record, remove, adjustForPeriod }
})
