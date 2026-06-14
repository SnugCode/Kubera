<template>
  <div class="gl" :class="'gl--' + line.urgency">
    <div class="gl-main">
      <div class="gl-left">
        <div class="dot" :style="{ background: line.list?.color ?? line.commitment.color }" />
        <div class="gl-info">
          <div class="gl-name">
            {{ line.commitment.name }}
            <span v-if="line.list" class="list-pill" :style="{ background: line.list.color + '22', color: line.list.color }">
              {{ line.list.name }}
            </span>
          </div>
          <div class="gl-meta text-xs text-muted">
            Weekly target: <span class="fw-600">${{ fmt(line.weeklyTarget) }}</span>
            <template v-if="line.periodAllocated > 0">
              · Allocated: <span class="fw-600 text-success">${{ fmt(line.periodAllocated) }}</span>
            </template>
            <template v-if="line.nextDueDate && line.daysUntilDue !== null">
              · <span :class="urgencyTextClass">{{ dueText }}</span>
            </template>
          </div>
        </div>
      </div>
      <div class="gl-right">
        <span class="badge" :class="urgencyBadge">{{ urgencyLabel }}</span>
        <div class="gl-suggest">${{ fmt(line.suggestedAmount) }}</div>
      </div>
    </div>

    <!-- Progress -->
    <div v-if="line.weeklyTarget > 0" class="gl-progress">
      <div class="progress-bar">
        <div
          class="progress-fill"
          :class="progressClass"
          :style="{ width: progressPct + '%' }"
        />
      </div>
    </div>

    <!-- Suggest action -->
    <div v-if="line.remaining > 0" class="gl-action">
      <button class="btn btn-ghost btn-xs" @click="allocateNow">
        + Allocate ${{ fmt(line.suggestedAmount || line.remaining) }} now
      </button>
    </div>
    <div v-else class="gl-funded text-xs text-success">✓ Fully funded this period</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { GuidanceLine } from '../types'
import { formatRelative } from '../utils/dates'
import { useCommitmentsStore } from '../stores/commitments'
import { useAllocationsStore } from '../stores/allocations'
import { getPeriodKey } from '../utils/periodKey'

const props = defineProps<{ line: GuidanceLine }>()
const commitments = useCommitmentsStore()
const allocations = useAllocationsStore()

function fmt(n: number) {
  return n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const dueText = computed(() => {
  if (props.line.daysUntilDue === null) return ''
  return formatRelative(props.line.daysUntilDue)
})

const urgencyBadge = computed(() => `badge-${props.line.urgency}`)

const urgencyLabel = computed(() => {
  const map: Record<string, string> = {
    overdue: 'Overdue', urgent: 'Urgent', soon: 'Soon', normal: 'Normal', future: 'Future',
  }
  return map[props.line.urgency] ?? props.line.urgency
})

const urgencyTextClass = computed(() => {
  const map: Record<string, string> = {
    overdue: 'text-danger', urgent: 'text-warning', soon: 'text-info', normal: '', future: 'text-dim',
  }
  return map[props.line.urgency] ?? ''
})

const progressPct = computed(() => {
  if (!props.line.weeklyTarget) return 0
  return Math.min(100, (props.line.periodAllocated / props.line.weeklyTarget) * 100)
})

const progressClass = computed(() => {
  const p = progressPct.value
  if (p >= 100) return 'success'
  if (p >= 50) return ''
  if (p > 0) return 'warning'
  return ''
})

async function allocateNow() {
  const amount = props.line.suggestedAmount || props.line.remaining
  if (!amount) return
  await commitments.deposit(props.line.commitment.id, amount)
  await allocations.record(props.line.commitment.id, amount, props.line.periodKey)
}
</script>

<style scoped>
.gl {
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}
.gl:last-child { border-bottom: none; }

.gl--overdue { background: var(--danger-dim); padding: 10px; border-radius: var(--radius-sm); margin-bottom: 2px; }
.gl--urgent  { padding: 10px; border-radius: var(--radius-sm); }

.gl-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.gl-left {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.gl-left .dot { margin-top: 4px; }

.gl-info { flex: 1; min-width: 0; }

.gl-name {
  font-weight: 600;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.list-pill {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 10px;
}

.gl-meta { margin-top: 3px; }

.gl-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
}

.gl-suggest {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
}

.gl-progress { margin-top: 8px; }

.gl-action { margin-top: 8px; }
.gl-funded { margin-top: 6px; }
</style>
