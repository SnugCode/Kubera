import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useCommitmentsStore } from './commitments'
import { useIncomeStore } from './income'
import { useListsStore } from './lists'
import { computeGuidanceLines, groupGuidanceLines } from '../utils/guidance'

export const useGuidanceStore = defineStore('guidance', () => {
  const commitmentsStore = useCommitmentsStore()
  const incomeStore = useIncomeStore()
  const listsStore = useListsStore()

  const lines = computed(() =>
    computeGuidanceLines(
      commitmentsStore.sortedItems,
      listsStore.items,
      incomeStore.effectivePaycheck,
    )
  )

  const groups = computed(() => groupGuidanceLines(lines.value))

  const totalSuggested = computed(() =>
    lines.value.reduce((s, l) => s + l.suggestedAmount, 0)
  )

  const totalRemaining = computed(() =>
    lines.value.reduce((s, l) => s + l.remaining, 0)
  )

  const overdueLines = computed(() =>
    lines.value.filter(l => l.urgency === 'overdue')
  )

  const urgentLines = computed(() =>
    lines.value.filter(l => l.urgency === 'urgent' || l.urgency === 'overdue')
  )

  return { lines, groups, totalSuggested, totalRemaining, overdueLines, urgentLines }
})
