<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-title">
        Priority Order
        <button class="btn-icon" @click="$emit('close')">✕</button>
      </div>

      <p class="text-sm text-muted" style="margin-bottom:16px">
        Drag to reorder open-ended commitments. The guidance engine uses this as a tiebreaker.
        Items with fixed due dates are prioritised automatically based on urgency.
      </p>

      <div v-if="orderedItems.length === 0 && autoItems.length === 0" class="empty-state">
        <p class="text-sm">No commitments yet.</p>
      </div>

      <template v-else>
        <!-- Manually ordered items (no fixed due date) -->
        <div v-if="orderedItems.length === 0" class="text-sm text-muted" style="margin-bottom:12px">
          All your commitments have fixed due dates and are managed automatically.
        </div>

        <div v-else class="priority-list" @dragover.prevent>
          <div
            v-for="item in orderedItems"
            :key="item.id"
            class="priority-item"
            :class="{ 'dragging': draggingId === item.id, 'drag-over': dragOverId === item.id }"
            draggable="true"
            @dragstart="onDragStart(item.id)"
            @dragover.prevent="onDragOver(item.id)"
            @dragleave="dragOverId = null"
            @dragend="onDragEnd"
            @drop="onDrop(item.id)"
          >
            <div class="drag-handle text-dim">⠿</div>
            <div class="dot" :style="{ background: lists.colorFor(item) }" />
            <div class="priority-item-info">
              <span class="fw-600">{{ item.name }}</span>
              <span v-if="item.listId" class="text-xs text-muted">{{ listName(item.listId) }}</span>
            </div>
            <span class="priority-order-num text-dim text-xs">#{{ orderedItems.indexOf(item) + 1 }}</span>
          </div>
        </div>

        <!-- Auto-managed items (have fixed due dates) -->
        <div v-if="autoItems.length" class="auto-section">
          <div class="auto-section-label text-xs text-dim">Managed automatically by due date</div>
          <div
            v-for="item in autoItems"
            :key="item.id"
            class="priority-item priority-item--auto"
          >
            <div class="dot" :style="{ background: lists.colorFor(item) }" />
            <div class="priority-item-info">
              <span class="fw-600">{{ item.name }}</span>
              <span class="text-xs text-muted">{{ recurrenceLabel(item) }}</span>
            </div>
            <span class="text-xs text-dim">auto</span>
          </div>
        </div>
      </template>

      <div class="modal-actions">
        <button class="btn btn-ghost" @click="$emit('close')">Cancel</button>
        <button class="btn btn-primary" @click="save">Save order</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Commitment } from '../types'
import { useCommitmentsStore } from '../stores/commitments'
import { useListsStore } from '../stores/lists'

const emit = defineEmits<{ (e: 'close'): void }>()
const commitments = useCommitmentsStore()
const lists = useListsStore()

/** A commitment has a hard due date if it has a fixed calendar deadline. */
function hasDueDate(c: Commitment): boolean {
  return !!c.dueDay || c.recurrence === 'one-time' || c.recurrence === 'yearly'
}

const orderedItems = ref(commitments.sortedItems.filter(c => !hasDueDate(c)))
const autoItems = computed(() => commitments.sortedItems.filter(hasDueDate))

const draggingId = ref<string | null>(null)
const dragOverId = ref<string | null>(null)

function onDragStart(id: string) { draggingId.value = id }
function onDragOver(id: string)  { dragOverId.value = id }
function onDragEnd()             { draggingId.value = null; dragOverId.value = null }

function onDrop(targetId: string) {
  if (!draggingId.value || draggingId.value === targetId) return
  const from = orderedItems.value.findIndex(c => c.id === draggingId.value)
  const to   = orderedItems.value.findIndex(c => c.id === targetId)
  const items = [...orderedItems.value]
  const [moved] = items.splice(from, 1)
  items.splice(to, 0, moved)
  orderedItems.value = items
  onDragEnd()
}

function listName(listId: string) {
  return lists.items.find(l => l.id === listId)?.name ?? ''
}

function recurrenceLabel(c: Commitment): string {
  const map: Record<string, string> = {
    monthly: `monthly · day ${c.dueDay}`,
    quarterly: `quarterly · day ${c.dueDay}`,
    yearly: 'yearly',
    'one-time': 'one-time',
  }
  return map[c.recurrence] ?? c.recurrence
}

async function save() {
  await commitments.reorder(orderedItems.value.map(c => c.id))
  emit('close')
}
</script>

<style scoped>
.priority-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 320px;
  overflow-y: auto;
  margin-bottom: 12px;
}

.priority-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: grab;
  transition: background var(--transition), border-color var(--transition), opacity var(--transition);
  user-select: none;
}
.priority-item:hover { border-color: var(--border-light); }
.priority-item.dragging { opacity: 0.4; }
.priority-item.drag-over { border-color: var(--accent); background: var(--accent-dim); }

.priority-item--auto {
  cursor: default;
  opacity: 0.6;
}
.priority-item--auto:hover { border-color: var(--border); }

.drag-handle {
  font-size: 16px;
  cursor: grab;
  flex-shrink: 0;
}

.priority-item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.priority-order-num {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.auto-section {
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 200px;
  overflow-y: auto;
}

.auto-section-label {
  padding: 4px 2px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 10px;
}
</style>
