<template>
  <div class="stats-layout">

    <!-- Income history -->
    <div class="card">
      <div class="flex items-center justify-between" style="margin-bottom:16px">
        <div>
          <h2 class="fw-700" style="font-size:17px">Income History</h2>
          <div v-if="income.baseline.sampleCount > 0" class="text-xs text-muted mt-2">
            Baseline:
            <span class="fw-600" :class="baselineColor">${{ fmt(income.baseline.value) }}/wk</span>
            · {{ income.baseline.confidence }} confidence
            · {{ income.baseline.sampleCount }} records
          </div>
        </div>
        <span class="text-dim text-xs">{{ income.sorted.length }} records</span>
      </div>

      <div v-if="income.sorted.length === 0" class="empty-state">
        <div class="empty-state-title">No income recorded yet</div>
        <p class="text-sm">Record your paycheck on the Home page.</p>
      </div>

      <div v-else class="income-list">
        <div
          v-for="r in income.sorted"
          :key="r.id"
          class="income-record"
        >
          <div class="income-record-left">
            <div class="fw-600">{{ formatDate(r.date) }}</div>
            <div v-if="r.note" class="text-xs text-muted">{{ r.note }}</div>
          </div>
          <div class="income-record-right">
            <div class="income-bar-wrap">
              <div
                class="income-bar-fill"
                :style="{ width: barPct(r.amount) + '%' }"
              />
            </div>
            <span class="fw-700 text-success income-amt">${{ fmt(r.amount) }}</span>
            <button class="btn-icon text-xs" @click="removeIncome(r.id)" title="Remove">✕</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Allocation history -->
    <div class="card mt-4">
      <div class="flex items-center justify-between" style="margin-bottom:16px">
        <h2 class="fw-700" style="font-size:17px">Allocation History</h2>
        <span class="text-dim text-xs">{{ allocations.sorted.length }} records</span>
      </div>

      <div v-if="allocations.sorted.length === 0" class="empty-state">
        <div class="empty-state-title">No allocations yet</div>
        <p class="text-sm">Allocate money to your commitments on the Home page.</p>
      </div>

      <div v-else class="alloc-list">
        <div
          v-for="r in allocations.sorted"
          :key="r.id"
          class="alloc-record"
        >
          <div class="alloc-dot" :style="{ background: commitmentColor(r.commitmentId) }" />
          <div class="alloc-info">
            <span class="fw-600">{{ commitmentName(r.commitmentId) }}</span>
            <span class="text-xs text-muted">{{ formatDate(r.date) }}</span>
          </div>
          <span class="fw-700 text-accent">${{ fmt(r.amount) }}</span>
          <button class="btn-icon text-xs" @click="removeAlloc(r.id)" title="Remove">✕</button>
        </div>
      </div>
    </div>

    <!-- Breakdown by commitment -->
    <div class="card mt-4">
      <div style="margin-bottom:16px">
        <h2 class="fw-700" style="font-size:17px">Total by Commitment</h2>
        <div class="text-xs text-muted mt-2">All time allocation totals</div>
      </div>

      <div v-if="allocations.totalByCommitment.size === 0" class="empty-state">
        <p class="text-sm text-dim">No data yet.</p>
      </div>

      <div v-else class="breakdown-list">
        <div
          v-for="[id, total] in allocations.totalByCommitment"
          :key="id"
          class="breakdown-row"
        >
          <div class="dot" :style="{ background: commitmentColor(id) }" />
          <span class="breakdown-name">{{ commitmentName(id) }}</span>
          <div class="breakdown-bar-wrap">
            <div
              class="breakdown-bar-fill"
              :style="{
                width: breakdownPct(total) + '%',
                background: commitmentColor(id),
              }"
            />
          </div>
          <span class="fw-700">${{ fmt(total) }}</span>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useIncomeStore } from '../stores/income'
import { useAllocationsStore } from '../stores/allocations'
import { useCommitmentsStore } from '../stores/commitments'
import { useListsStore } from '../stores/lists'
import { formatDate } from '../utils/dates'

const income = useIncomeStore()
const allocations = useAllocationsStore()
const commitments = useCommitmentsStore()
const lists = useListsStore()

function fmt(n: number) {
  return n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const baselineColor = computed(() => {
  const c = income.baseline.confidence
  return c === 'high' ? 'text-success' : c === 'medium' ? 'text-accent' : 'text-muted'
})

const maxIncome = computed(() =>
  Math.max(...income.sorted.map(r => r.amount), 1)
)

function barPct(amount: number) {
  return Math.min(100, (amount / maxIncome.value) * 100)
}

async function removeIncome(id: string) {
  if (confirm('Remove this income record?')) await income.remove(id)
}

async function removeAlloc(id: string) {
  if (confirm('Remove this allocation record?')) await allocations.remove(id)
}

const maxAlloc = computed(() => {
  let max = 1
  allocations.totalByCommitment.forEach(v => { if (v > max) max = v })
  return max
})

function breakdownPct(total: number) {
  return Math.min(100, (total / maxAlloc.value) * 100)
}

function commitmentName(id: string) {
  return commitments.items.find(c => c.id === id)?.name ?? 'Unknown'
}

function commitmentColor(id: string) {
  const c = commitments.items.find(c => c.id === id)
  return c ? lists.colorFor(c) : 'var(--text-3)'
}
</script>

<style scoped>
.stats-layout { max-width: 720px; }

.income-list { display: flex; flex-direction: column; gap: 8px; }
.income-record {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}
.income-record:last-child { border-bottom: none; }
.income-record-left { flex: 0 0 120px; }
.income-record-right {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
}
.income-bar-wrap {
  flex: 1;
  height: 5px;
  background: var(--surface-3);
  border-radius: 3px;
  overflow: hidden;
}
.income-bar-fill {
  height: 100%;
  background: var(--success);
  border-radius: 3px;
  transition: width 400ms ease;
}
.income-amt { min-width: 70px; text-align: right; }

.alloc-list { display: flex; flex-direction: column; gap: 2px; }
.alloc-record {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: var(--radius-xs);
  transition: background var(--transition);
}
.alloc-record:hover { background: var(--surface-2); }
.alloc-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.alloc-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.breakdown-list { display: flex; flex-direction: column; gap: 8px; }
.breakdown-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
}
.breakdown-name { flex: 0 0 130px; font-weight: 500; font-size: 14px; }
.breakdown-bar-wrap {
  flex: 1;
  height: 6px;
  background: var(--surface-3);
  border-radius: 3px;
  overflow: hidden;
}
.breakdown-bar-fill {
  height: 100%;
  border-radius: 3px;
  opacity: 0.85;
  transition: width 400ms ease;
}
</style>
