import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { CommitmentList, Commitment } from '../types'
import { loadStore, saveStore } from '../services/store'

function uuid() { return crypto.randomUUID() }

export const useListsStore = defineStore('lists', () => {
  const items = ref<CommitmentList[]>([])
  const ready = ref(false)

  async function load() {
    items.value = await loadStore<CommitmentList>('lists')
    ready.value = true
  }

  async function persist() {
    await saveStore('lists', items.value)
  }

  async function add(payload: Omit<CommitmentList, 'id' | 'createdAt'>) {
    items.value.push({ ...payload, id: uuid(), createdAt: new Date().toISOString() })
    await persist()
  }

  async function update(id: string, payload: Partial<CommitmentList>) {
    const idx = items.value.findIndex(l => l.id === id)
    if (idx === -1) return
    items.value[idx] = { ...items.value[idx], ...payload }
    await persist()
  }

  async function remove(id: string) {
    items.value = items.value.filter(l => l.id !== id)
    await persist()
  }

  const colorMap = computed(() => new Map(items.value.map(l => [l.id, l.color])))

  /** Effective display color: list color if assigned to a list, else the item's own color. */
  function colorFor(c: Commitment): string {
    return (c.listId && colorMap.value.get(c.listId)) ?? c.color
  }

  return { items, ready, load, add, update, remove, colorFor }
})
