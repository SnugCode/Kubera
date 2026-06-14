import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Commitment } from '../types'
import { loadStore, saveStore } from '../services/store'
import { getPeriodKey, getDepositedThisPeriod } from '../utils/periodKey'
import { today } from '../utils/dates'

function uuid() { return crypto.randomUUID() }

export const useCommitmentsStore = defineStore('commitments', () => {
  const items = ref<Commitment[]>([])
  const ready = ref(false)

  async function load() {
    items.value = await loadStore<Commitment>('commitments')
    ready.value = true
  }

  async function persist() {
    await saveStore('commitments', items.value)
  }

  async function add(payload: Omit<Commitment, 'id' | 'createdAt' | 'deposits' | 'priorityOrder'>) {
    const maxOrder = items.value.reduce((m, c) => Math.max(m, c.priorityOrder), -1)
    items.value.push({
      ...payload,
      id: uuid(),
      priorityOrder: maxOrder + 1,
      deposits: {},
      createdAt: new Date().toISOString(),
    })
    await persist()
  }

  async function update(id: string, payload: Partial<Commitment>) {
    const idx = items.value.findIndex(c => c.id === id)
    if (idx === -1) return
    items.value[idx] = { ...items.value[idx], ...payload }
    await persist()
  }

  async function remove(id: string) {
    items.value = items.value.filter(c => c.id !== id)
    await persist()
  }

  /** Add to (or replace) the deposit for the current active period. */
  async function deposit(id: string, amount: number, periodKey?: string) {
    const c = items.value.find(c => c.id === id)
    if (!c) return
    const key = periodKey ?? getPeriodKey(c)
    c.deposits = { ...c.deposits, [key]: (c.deposits[key] ?? 0) + amount }
    await persist()
  }

  /** Overwrite the deposit for a specific period key. */
  async function setDeposit(id: string, amount: number, periodKey: string) {
    const c = items.value.find(c => c.id === id)
    if (!c) return
    if (amount <= 0) {
      const { [periodKey]: _, ...rest } = c.deposits
      c.deposits = rest
    } else {
      c.deposits = { ...c.deposits, [periodKey]: amount }
    }
    await persist()
  }

  /** Reorder: receives an ordered array of IDs and updates priorityOrder accordingly. */
  async function reorder(orderedIds: string[]) {
    orderedIds.forEach((id, idx) => {
      const c = items.value.find(c => c.id === id)
      if (c) c.priorityOrder = idx
    })
    await persist()
  }

  const sortedItems = computed(() =>
    [...items.value].sort((a, b) => a.priorityOrder - b.priorityOrder)
  )

  const byList = computed(() => {
    const map = new Map<string | null, Commitment[]>()
    for (const c of sortedItems.value) {
      const key = c.listId ?? null
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(c)
    }
    return map
  })

  return { items, ready, sortedItems, byList, load, persist, add, update, remove, deposit, setDeposit, reorder }
})
