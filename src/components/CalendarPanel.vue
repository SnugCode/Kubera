<template>
  <div class="calendar card">
    <!-- Header -->
    <div class="cal-header">
      <button class="btn-icon" @click="prevMonth">‹</button>
      <span class="cal-title fw-700">{{ monthTitle }}</span>
      <button class="btn-icon" @click="nextMonth">›</button>
    </div>

    <!-- Day labels -->
    <div class="cal-grid cal-labels">
      <span v-for="d in DAYS" :key="d" class="cal-label text-xs text-dim">{{ d }}</span>
    </div>

    <!-- Day cells -->
    <div class="cal-grid">
      <div
        v-for="(cell, i) in cells"
        :key="i"
        class="cal-cell"
        :class="{
          'cal-cell--empty': !cell.date,
          'cal-cell--today': cell.isToday,
          'cal-cell--has-dues': cell.dues.length > 0,
        }"
        @mouseenter="hoveredCell = cell"
        @mouseleave="hoveredCell = null"
      >
        <span v-if="cell.date" class="cal-day-num">{{ cell.day }}</span>
        <div v-if="cell.dues.length" class="cal-dots">
          <div
            v-for="c in cell.dues.slice(0, 4)"
            :key="c.id"
            class="cal-dot"
            :style="{ background: lists.colorFor(c) }"
          />
        </div>

        <!-- Tooltip -->
        <Transition name="fade">
          <div v-if="hoveredCell === cell && cell.dues.length" class="cal-tooltip">
            <div class="cal-tooltip-title text-xs fw-700">{{ formatShort(cell.date!) }}</div>
            <div v-for="c in cell.dues" :key="c.id" class="cal-tooltip-item text-xs">
              <div class="dot" :style="{ background: lists.colorFor(c), width:'6px', height:'6px' }" />
              {{ c.name }}
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <!-- Legend -->
    <div v-if="activeCommitments.length" class="cal-legend">
      <div v-for="c in activeCommitments.slice(0, 6)" :key="c.id" class="cal-legend-item text-xs text-muted">
        <div class="dot" :style="{ background: lists.colorFor(c), width:'6px', height:'6px' }" />
        {{ c.name }}
      </div>
      <div v-if="activeCommitments.length > 6" class="text-xs text-dim">
        +{{ activeCommitments.length - 6 }} more
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCommitmentsStore } from '../stores/commitments'
import { useListsStore } from '../stores/lists'
import { today, formatShort, daysInMonth } from '../utils/dates'
import { dueDatesInMonth } from '../utils/periodKey'
import type { Commitment } from '../types'

const commitments = useCommitmentsStore()
const lists = useListsStore()
const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

const now = new Date(today())
const viewYear  = ref(now.getFullYear())
const viewMonth = ref(now.getMonth() + 1)
const hoveredCell = ref<any>(null)

const monthTitle = computed(() =>
  new Date(viewYear.value, viewMonth.value - 1).toLocaleDateString('en-AU', {
    month: 'long', year: 'numeric',
  })
)

function prevMonth() {
  if (viewMonth.value === 1) { viewMonth.value = 12; viewYear.value-- }
  else viewMonth.value--
}
function nextMonth() {
  if (viewMonth.value === 12) { viewMonth.value = 1; viewYear.value++ }
  else viewMonth.value++
}

const todayStr = today()

interface Cell {
  date: string | null
  day: number
  isToday: boolean
  dues: Commitment[]
}

const cells = computed<Cell[]>(() => {
  const yearMonth = `${viewYear.value}-${String(viewMonth.value).padStart(2, '0')}`
  const days = daysInMonth(viewYear.value, viewMonth.value)

  // Due dates map: YYYY-MM-DD → Commitment[]
  const dueMap = new Map<string, Commitment[]>()
  for (const c of commitments.items) {
    const dates = dueDatesInMonth(c, yearMonth)
    for (const d of dates) {
      if (!dueMap.has(d)) dueMap.set(d, [])
      dueMap.get(d)!.push(c)
    }
  }

  // Leading empty cells (Mon = 1 … Sun = 7)
  const firstDate = new Date(days[0])
  const firstWeekday = firstDate.getDay() || 7 // convert Sun(0) → 7
  const leading: Cell[] = Array.from({ length: firstWeekday - 1 }, () => ({
    date: null, day: 0, isToday: false, dues: [],
  }))

  const dayCells: Cell[] = days.map(d => ({
    date: d,
    day: parseInt(d.slice(8)),
    isToday: d === todayStr,
    dues: dueMap.get(d) ?? [],
  }))

  return [...leading, ...dayCells]
})

const activeCommitments = computed(() =>
  commitments.items.filter(c => c.recurrence !== 'one-time' || (c.startDate && c.startDate >= todayStr))
)
</script>

<style scoped>
.calendar { padding: 14px; }

.cal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.cal-title { font-size: 14px; }

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.cal-labels { margin-bottom: 4px; }
.cal-label { text-align: center; padding: 2px 0; }

.cal-cell {
  position: relative;
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3px 2px 2px;
  border-radius: var(--radius-xs);
  cursor: default;
  transition: background var(--transition);
  min-height: 32px;
}

.cal-cell:not(.cal-cell--empty):hover { background: var(--surface-2); }
.cal-cell--empty { pointer-events: none; }
.cal-cell--today { background: var(--accent-dim); }
.cal-cell--today .cal-day-num { color: var(--accent); font-weight: 700; }

.cal-day-num { font-size: 12px; line-height: 1.2; }

.cal-dots {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 2px;
}
.cal-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

/* Tooltip */
.cal-tooltip {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  z-index: 50;
  white-space: nowrap;
  box-shadow: var(--shadow);
  pointer-events: none;
}
.cal-tooltip-title { margin-bottom: 4px; color: var(--text); }
.cal-tooltip-item {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--text-2);
  margin-top: 3px;
}

/* Legend */
.cal-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}
.cal-legend-item { display: flex; align-items: center; gap: 4px; }
</style>
