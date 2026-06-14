<template>
  <div class="home-layout">
    <!-- Left panel: income + commitments -->
    <div class="home-left">

      <!-- Toolbar -->
      <div class="toolbar">
        <button class="btn btn-primary btn-sm" @click="showNL = true">+ Add with words</button>
        <button class="btn btn-ghost btn-sm" @click="showPriority = true">↕ Priority Order</button>
        <button class="btn btn-ghost btn-sm" @click="showList = true">⊞ Lists</button>
        <button class="btn btn-ghost btn-sm" @click="openAddCommitment(null)">+ Add Item</button>
      </div>

      <!-- Income this week -->
      <div class="card mt-3">
        <div class="flex items-center justify-between" style="margin-bottom:10px">
          <span class="section-title" style="margin-bottom:0">Income This Week</span>
          <span v-if="income.baseline.sampleCount > 0" class="text-xs text-muted">
            Baseline
            <span class="fw-600" :class="baselineColor">
              ${{ fmt(income.baseline.value) }}
            </span>
            · {{ income.baseline.confidence }}
          </span>
        </div>
        <div class="income-row">
          <span class="income-prefix">$</span>
          <input
            v-model="incomeInput"
            class="input income-input"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            @keyup.enter="recordIncome"
          />
          <button class="btn btn-primary btn-sm" :disabled="!incomeInputNum" @click="recordIncome">
            Record
          </button>
        </div>
        <div v-if="income.thisWeekTotal > 0" class="text-xs text-muted mt-2">
          This week: <span class="fw-600 text-success">${{ fmt(income.thisWeekTotal) }}</span>
        </div>
      </div>

      <!-- Commitments grouped by list -->
      <div class="commitments-section mt-4">

        <div v-if="commitments.items.length === 0" class="empty-state">
          <div class="empty-state-title">No commitments yet</div>
          <p class="text-sm">Add your bills, expenses and savings goals.</p>
          <button class="btn btn-primary mt-3" @click="openAddCommitment(null)">+ Add commitment</button>
        </div>

        <template v-else>
          <!-- Each list group -->
          <div v-for="group in listGroups" :key="group.key" class="list-group">
            <div class="list-group-header" :style="{ borderLeftColor: group.color }">
              <div class="flex items-center gap-2">
                <div class="dot" :style="{ background: group.color }" />
                <span class="fw-600">{{ group.label }}</span>
                <span class="text-dim text-xs">{{ group.items.length }}</span>
              </div>
              <button class="btn-icon text-xs" title="Add item to this list" @click="openAddCommitment(group.listId)">+</button>
            </div>

            <div class="commitment-list">
              <div
                v-for="c in group.items"
                :key="c.id"
                class="commitment-item"
              >
                <div class="commitment-row">
                  <div class="commitment-dot" :style="{ background: lists.colorFor(c) }" />
                  <div class="commitment-info">
                    <span class="commitment-name">{{ c.name }}</span>
                    <span class="commitment-meta text-xs text-muted">
                      ${{ fmt(c.amount) }} · {{ recurrenceLabel(c) }}
                    </span>
                  </div>
                  <div class="commitment-due">
                    <span v-if="nextDue(c)" class="badge" :class="dueBadgeClass(c)">
                      {{ dueLabel(c) }}
                    </span>
                  </div>
                  <div class="commitment-actions">
                    <button class="btn btn-success btn-xs" @click="toggleAllocate(c.id)">
                      {{ allocating === c.id ? '✕' : '+ Allocate' }}
                    </button>
                    <button class="btn-icon" @click="openEditCommitment(c)" title="Edit">✎</button>
                    <button class="btn-icon" @click="confirmDelete(c.id)" title="Delete">✕</button>
                  </div>
                </div>

                <!-- Period progress -->
                <div class="commitment-progress" v-if="periodDeposited(c) > 0 || weeklyTarget(c) > 0">
                  <div class="progress-bar">
                    <div
                      class="progress-fill"
                      :class="progressClass(c)"
                      :style="{ width: progressPct(c) + '%' }"
                    />
                  </div>
                  <div class="progress-label">
                    <span class="text-xs text-muted">
                      ${{ fmt(periodDeposited(c)) }} / ${{ fmt(weeklyTarget(c)) }}
                    </span>
                    <button
                      class="btn-icon adjust-btn"
                      title="Adjust allocated amount"
                      @click="toggleAdjust(c.id, periodDeposited(c))"
                    >✎</button>
                  </div>
                </div>

                <!-- Inline adjust panel -->
                <Transition name="slide-down">
                  <div v-if="adjusting === c.id" class="allocate-panel">
                    <span class="text-xs text-muted">Set total allocated this period:</span>
                    <div class="allocate-row">
                      <span class="income-prefix">$</span>
                      <input
                        v-model="adjustInput"
                        class="input"
                        type="number"
                        min="0"
                        step="0.01"
                        @keyup.enter="saveAdjust(c)"
                      />
                      <button class="btn btn-primary btn-sm" :disabled="adjustInputNum === null" @click="saveAdjust(c)">
                        Set
                      </button>
                    </div>
                  </div>
                </Transition>

                <!-- Inline allocate panel -->
                <Transition name="slide-down">
                  <div v-if="allocating === c.id" class="allocate-panel">
                    <span class="text-xs text-muted">Amount to allocate:</span>
                    <div class="allocate-row">
                      <span class="income-prefix">$</span>
                      <input
                        v-model="allocateInput"
                        class="input"
                        type="number"
                        min="0"
                        step="0.01"
                        :placeholder="fmt(Math.max(0, weeklyTarget(c) - periodDeposited(c)))"
                        @keyup.enter="saveAllocation(c)"
                      />
                      <button class="btn btn-success btn-sm" :disabled="!allocateInputNum" @click="saveAllocation(c)">
                        Save
                      </button>
                    </div>
                  </div>
                </Transition>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Right panel: calendar -->
    <div class="home-right">
      <CalendarPanel />
    </div>
  </div>

  <!-- Modals -->
  <CommitmentModal
    v-if="showCommitment"
    :initial="editTarget"
    :default-list-id="defaultListId"
    @close="showCommitment = false"
    @saved="showCommitment = false"
  />
  <NLModal
    v-if="showNL"
    @close="showNL = false"
    @open-commitment="openAddFromNL"
    @income-recorded="showNL = false"
  />
  <PriorityModal
    v-if="showPriority"
    @close="showPriority = false"
  />
  <ListModal
    v-if="showList"
    @close="showList = false"
  />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCommitmentsStore } from '../stores/commitments'
import { useIncomeStore } from '../stores/income'
import { useAllocationsStore } from '../stores/allocations'
import { useListsStore } from '../stores/lists'
import type { Commitment } from '../types'
import { toWeeklyAmount, getNextDueDate } from '../utils/guidance'
import { getDepositedThisPeriod, getPeriodKey } from '../utils/periodKey'
import { daysDiff, today, formatRelative } from '../utils/dates'
import CalendarPanel from '../components/CalendarPanel.vue'
import CommitmentModal from '../components/CommitmentModal.vue'
import NLModal from '../components/NLModal.vue'
import PriorityModal from '../components/PriorityModal.vue'
import ListModal from '../components/ListModal.vue'

const commitments = useCommitmentsStore()
const income = useIncomeStore()
const allocations = useAllocationsStore()
const lists = useListsStore()

// ─── Modal state ──────────────────────────────────────────────────────────────
const showNL = ref(false)
const showPriority = ref(false)
const showList = ref(false)
const showCommitment = ref(false)
const editTarget = ref<Commitment | undefined>(undefined)
const defaultListId = ref<string | undefined>(undefined)

function openAddCommitment(listId: string | null) {
  editTarget.value = undefined
  defaultListId.value = listId ?? undefined
  showCommitment.value = true
}

function openEditCommitment(c: Commitment) {
  editTarget.value = c
  defaultListId.value = undefined
  showCommitment.value = true
}

function openAddFromNL(partial: Partial<Commitment>) {
  showNL.value = false
  editTarget.value = partial as Commitment
  showCommitment.value = true
}

async function confirmDelete(id: string) {
  if (confirm('Delete this commitment?')) await commitments.remove(id)
}

// ─── Income ───────────────────────────────────────────────────────────────────
const incomeInput = ref('')
const incomeInputNum = computed(() => {
  const n = parseFloat(incomeInput.value)
  return isNaN(n) || n <= 0 ? null : n
})

async function recordIncome() {
  if (!incomeInputNum.value) return
  await income.add(incomeInputNum.value)
  incomeInput.value = ''
}

const baselineColor = computed(() => {
  const c = income.baseline.confidence
  return c === 'high' ? 'text-success' : c === 'medium' ? 'text-accent' : 'text-muted'
})

// ─── Allocate inline ──────────────────────────────────────────────────────────
const allocating = ref<string | null>(null)
const allocateInput = ref('')
const allocateInputNum = computed(() => {
  const n = parseFloat(allocateInput.value)
  return isNaN(n) || n <= 0 ? null : n
})

function toggleAllocate(id: string) {
  adjusting.value = null
  adjustInput.value = ''
  if (allocating.value === id) {
    allocating.value = null
    allocateInput.value = ''
  } else {
    allocating.value = id
    allocateInput.value = ''
  }
}

// ─── Adjust period total ──────────────────────────────────────────────────────
const adjusting = ref<string | null>(null)
const adjustInput = ref('')
const adjustInputNum = computed(() => {
  const n = parseFloat(adjustInput.value)
  return isNaN(n) || n < 0 ? null : n
})

function toggleAdjust(id: string, current: number) {
  allocating.value = null
  allocateInput.value = ''
  if (adjusting.value === id) {
    adjusting.value = null
    adjustInput.value = ''
  } else {
    adjusting.value = id
    adjustInput.value = current > 0 ? String(current) : ''
  }
}

async function saveAdjust(c: Commitment) {
  if (adjustInputNum.value === null) return
  const key = getPeriodKey(c)
  await commitments.setDeposit(c.id, adjustInputNum.value, key)
  await allocations.adjustForPeriod(c.id, key, adjustInputNum.value)
  adjusting.value = null
  adjustInput.value = ''
}

async function saveAllocation(c: Commitment) {
  if (!allocateInputNum.value) return
  const amount = allocateInputNum.value
  const key = getPeriodKey(c)
  await commitments.deposit(c.id, amount)
  await allocations.record(c.id, amount, key)
  allocating.value = null
  allocateInput.value = ''
}

// ─── Commitment helpers ───────────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function weeklyTarget(c: Commitment) { return toWeeklyAmount(c) }
function periodDeposited(c: Commitment) { return getDepositedThisPeriod(c) }

function progressPct(c: Commitment) {
  const target = weeklyTarget(c)
  if (!target) return 0
  return Math.min(100, (periodDeposited(c) / target) * 100)
}

function progressClass(c: Commitment) {
  const pct = progressPct(c)
  if (pct >= 100) return 'success'
  if (pct >= 60) return ''
  if (pct > 0) return 'warning'
  return ''
}

function nextDue(c: Commitment) { return getNextDueDate(c) }

function dueLabel(c: Commitment) {
  const d = nextDue(c)
  if (!d) return ''
  return formatRelative(daysDiff(today(), d))
}

function dueBadgeClass(c: Commitment) {
  const d = nextDue(c)
  if (!d) return 'badge-normal'
  const days = daysDiff(today(), d)
  if (days < 0) return 'badge-overdue'
  if (days <= 2) return 'badge-urgent'
  if (days <= 7) return 'badge-soon'
  return 'badge-normal'
}

function recurrenceLabel(c: Commitment) {
  const map: Record<string, string> = {
    weekly: 'weekly', fortnightly: 'fortnightly', monthly: 'monthly',
    quarterly: 'quarterly', yearly: 'yearly', 'one-time': 'one-time',
    interval: `every ${c.intervalDays}d`,
  }
  return map[c.recurrence] ?? c.recurrence
}

// ─── List grouping ────────────────────────────────────────────────────────────
const listGroups = computed(() => {
  const listMap = new Map(lists.items.map(l => [l.id, l]))
  const groups: Array<{
    key: string
    label: string
    color: string
    listId: string | null
    items: Commitment[]
  }> = []

  const listsWithItems = new Map<string | null, Commitment[]>()
  listsWithItems.set(null, [])

  for (const l of lists.items) {
    listsWithItems.set(l.id, [])
  }

  for (const c of commitments.sortedItems) {
    const key = c.listId ?? null
    if (!listsWithItems.has(key)) listsWithItems.set(key, [])
    listsWithItems.get(key)!.push(c)
  }

  for (const [listId, items] of listsWithItems) {
    if (items.length === 0 && listId !== null) continue
    const list = listId ? listMap.get(listId) : null
    groups.push({
      key: listId ?? '__none__',
      label: list?.name ?? 'Uncategorised',
      color: list?.color ?? 'var(--text-3)',
      listId: listId ?? null,
      items,
    })
  }

  // Put uncategorised at the end
  const none = groups.findIndex(g => g.key === '__none__')
  if (none > 0) {
    const [g] = groups.splice(none, 1)
    groups.push(g)
  }

  return groups
})
</script>

<style scoped>
.home-layout {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 20px;
  align-items: start;
}

@media (max-width: 860px) {
  .home-layout { grid-template-columns: 1fr; }
  .home-right  { order: -1; }
}

.toolbar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* Income */
.income-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.income-prefix {
  color: var(--text-2);
  font-size: 15px;
}
.income-input {
  flex: 1;
  font-size: 18px;
  font-weight: 600;
  padding: 8px 12px;
}

/* List groups */
.list-group {
  margin-bottom: 16px;
}
.list-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-left: 3px solid var(--border);
  padding: 6px 8px 6px 10px;
  margin-bottom: 6px;
  border-radius: 0 var(--radius-xs) var(--radius-xs) 0;
  background: var(--surface);
}

/* Commitment items */
.commitment-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.commitment-item {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  transition: border-color var(--transition);
}
.commitment-item:hover { border-color: var(--border-light); }

.commitment-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.commitment-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.commitment-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.commitment-name {
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.commitment-meta {
  margin-top: 1px;
}

.commitment-due { flex-shrink: 0; }

.commitment-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.commitment-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.commitment-progress .progress-bar { flex: 1; }

.progress-label {
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.adjust-btn {
  font-size: 11px;
  opacity: 0;
  transition: opacity var(--transition);
  color: var(--text-3);
  padding: 0 2px;
}
.commitment-item:hover .adjust-btn { opacity: 1; }

/* Allocate panel */
.allocate-panel {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.allocate-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.allocate-row .input {
  flex: 1;
  padding: 6px 10px;
  font-size: 14px;
}

/* Calendar column */
.home-right { position: sticky; top: 0; }
</style>
