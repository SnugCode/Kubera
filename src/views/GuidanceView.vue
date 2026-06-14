<template>
  <div class="guidance-layout">

    <!-- Paycheck context card -->
    <div class="card paycheck-card">
      <div class="flex items-center justify-between">
        <div>
          <div class="section-title">Effective Paycheck</div>
          <div class="paycheck-amount">${{ fmt(income.effectivePaycheck) }}</div>
          <div class="text-xs text-muted mt-2">
            <template v-if="income.thisWeekTotal > 0">
              This week's recorded income
            </template>
            <template v-else-if="income.baseline.sampleCount > 0">
              Baseline estimate ·
              <span :class="confidenceColor">{{ income.baseline.confidence }} confidence</span>
              ({{ income.baseline.sampleCount }} paychecks)
            </template>
            <template v-else>
              Record your first paycheck on Home to get started
            </template>
          </div>
        </div>
        <div class="paycheck-ring">
          <svg viewBox="0 0 60 60" class="ring-svg">
            <circle cx="30" cy="30" r="24" fill="none" stroke="var(--surface-3)" stroke-width="5" />
            <circle
              cx="30" cy="30" r="24" fill="none"
              stroke="var(--accent)" stroke-width="5"
              stroke-linecap="round"
              stroke-dasharray="150.8"
              :stroke-dashoffset="150.8 * (1 - allocationPct / 100)"
              transform="rotate(-90 30 30)"
              style="transition: stroke-dashoffset 500ms ease"
            />
          </svg>
          <span class="ring-label">{{ Math.round(allocationPct) }}%</span>
        </div>
      </div>

      <!-- Allocation bar -->
      <div v-if="guidance.lines.length > 0" class="alloc-bar mt-3">
        <div
          v-for="line in guidance.lines"
          :key="line.commitment.id"
          class="alloc-bar-seg"
          :style="{
            width: ((line.suggestedAmount / income.effectivePaycheck) * 100) + '%',
            background: line.list?.color ?? line.commitment.color,
          }"
          :title="line.commitment.name + ': $' + fmt(line.suggestedAmount)"
        />
      </div>
    </div>

    <!-- Overdue warning -->
    <div v-if="guidance.overdueLines.length" class="card mt-4 overdue-card">
      <div class="section-title" style="color: var(--danger)">⚠ Overdue</div>
      <div v-for="line in guidance.overdueLines" :key="line.commitment.id" class="guidance-line overdue-line">
        <GuidanceLine :line="line" />
      </div>
    </div>

    <!-- No commitments -->
    <div v-if="guidance.lines.length === 0" class="empty-state mt-4">
      <div class="empty-state-title">Nothing to guide yet</div>
      <p class="text-sm">Add your financial commitments on the Home page.</p>
    </div>

    <!-- Groups -->
    <template v-for="group in guidance.groups" :key="group.label">
      <div class="card mt-4 group-card">
        <!-- Group header -->
        <div class="group-header">
          <div class="flex items-center gap-2">
            <div v-if="group.list" class="dot" :style="{ background: group.list.color }" />
            <span class="fw-700">{{ group.label }}</span>
            <span class="text-dim text-xs">{{ group.lines.length }} item{{ group.lines.length !== 1 ? 's' : '' }}</span>
          </div>
          <div class="group-totals text-xs text-muted">
            <span>Weekly target: <span class="fw-600 text-accent">${{ fmt(group.totalWeeklyTarget) }}</span></span>
            <span>Allocated: <span class="fw-600 text-success">${{ fmt(group.totalAllocated) }}</span></span>
            <span v-if="group.totalRemaining > 0">Remaining: <span class="fw-600 text-warning">${{ fmt(group.totalRemaining) }}</span></span>
          </div>
        </div>

        <!-- List purpose / context -->
        <div v-if="group.list?.purpose" class="list-purpose text-xs text-muted">
          {{ group.list.purpose }}
        </div>

        <div class="divider" />

        <!-- Guidance lines -->
        <div class="guidance-lines">
          <GuidanceLine
            v-for="line in group.lines"
            :key="line.commitment.id"
            :line="line"
          />
        </div>
      </div>
    </template>

    <!-- Leftover -->
    <div v-if="leftover > 0" class="card mt-4 leftover-card">
      <div class="flex items-center justify-between">
        <div>
          <div class="section-title">Unallocated</div>
          <div class="leftover-amount">${{ fmt(leftover) }}</div>
          <div class="text-xs text-muted mt-2">After funding all commitments</div>
        </div>
        <div class="leftover-icon">💰</div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGuidanceStore } from '../stores/guidance'
import { useIncomeStore } from '../stores/income'
import GuidanceLine from '../components/GuidanceLine.vue'

const guidance = useGuidanceStore()
const income = useIncomeStore()

function fmt(n: number) {
  return n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const allocationPct = computed(() => {
  const ep = income.effectivePaycheck
  if (!ep) return 0
  return Math.min(100, (guidance.totalSuggested / ep) * 100)
})

const leftover = computed(() => {
  const ep = income.effectivePaycheck
  if (!ep) return 0
  return Math.max(0, ep - guidance.totalSuggested)
})

const confidenceColor = computed(() => {
  const c = income.baseline.confidence
  return c === 'high' ? 'text-success' : c === 'medium' ? 'text-accent' : 'text-muted'
})
</script>

<style scoped>
.guidance-layout { max-width: 720px; }

.paycheck-card { }
.paycheck-amount { font-size: 32px; font-weight: 700; letter-spacing: -1px; }

.paycheck-ring {
  position: relative;
  width: 64px;
  height: 64px;
  flex-shrink: 0;
}
.ring-svg { width: 100%; height: 100%; }
.ring-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--text);
}

.alloc-bar {
  height: 6px;
  border-radius: 3px;
  background: var(--surface-3);
  display: flex;
  overflow: hidden;
  gap: 1px;
}
.alloc-bar-seg {
  height: 100%;
  transition: width 400ms ease;
}

.overdue-card { border-color: var(--danger); }

.group-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.group-totals { display: flex; gap: 12px; flex-wrap: wrap; }
.list-purpose {
  margin-top: 6px;
  padding: 6px 10px;
  background: var(--surface-2);
  border-radius: var(--radius-xs);
  border-left: 2px solid var(--border-light);
  font-style: italic;
}
.guidance-lines { display: flex; flex-direction: column; gap: 2px; }

.leftover-card { border-color: var(--success); }
.leftover-amount { font-size: 24px; font-weight: 700; color: var(--success); }
.leftover-icon { font-size: 36px; }
</style>
