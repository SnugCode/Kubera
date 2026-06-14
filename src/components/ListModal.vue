<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-title">
        Manage Lists
        <button class="btn-icon" @click="$emit('close')">✕</button>
      </div>

      <!-- Existing lists -->
      <div v-if="lists.items.length > 0" class="existing-lists">
        <div class="section-title">Your Lists</div>
        <div
          v-for="l in lists.items"
          :key="l.id"
          class="list-row"
        >
          <div v-if="editingId !== l.id" class="list-display">
            <div class="dot" :style="{ background: l.color }" />
            <div class="list-display-info">
              <span class="fw-600">{{ l.name }}</span>
              <span v-if="l.purpose" class="text-xs text-muted">{{ l.purpose }}</span>
            </div>
            <div class="list-display-actions">
              <button class="btn-icon" @click="startEdit(l)">✎</button>
              <button class="btn-icon" @click="removeList(l.id)">✕</button>
            </div>
          </div>

          <!-- Inline edit -->
          <div v-else class="list-edit-form">
            <input v-model="editForm.name" class="input input-sm" placeholder="List name" />
            <textarea v-model="editForm.purpose" class="input input-sm" rows="1" placeholder="Purpose (helps Kubera guide better)" />
            <div class="color-swatches">
              <button
                v-for="color in COLORS"
                :key="color"
                class="swatch"
                :class="{ 'swatch--active': editForm.color === color }"
                :style="{ background: color }"
                @click="editForm.color = color"
              />
            </div>
            <div class="list-edit-actions">
              <button class="btn btn-ghost btn-xs" @click="cancelEdit">Cancel</button>
              <button class="btn btn-primary btn-xs" @click="saveEdit(l.id)">Save</button>
            </div>
          </div>
        </div>
      </div>

      <div class="divider" />

      <!-- Create new list -->
      <div class="section-title">Create New List</div>
      <div class="new-list-form">
        <div class="input-group">
          <label class="input-label">Name</label>
          <input v-model="newForm.name" class="input" placeholder="e.g. Bills, Car Expenses, Subscriptions" />
        </div>
        <div class="input-group">
          <label class="input-label">Purpose <span class="text-dim">(optional — helps guidance engine)</span></label>
          <textarea
            v-model="newForm.purpose"
            class="input"
            rows="2"
            placeholder='e.g. "All recurring household bills I need to pay each month"'
          />
        </div>
        <div class="input-group">
          <label class="input-label">Color</label>
          <div class="color-swatches">
            <button
              v-for="color in COLORS"
              :key="color"
              class="swatch"
              :class="{ 'swatch--active': newForm.color === color }"
              :style="{ background: color }"
              @click="newForm.color = color"
            />
          </div>
        </div>
        <button class="btn btn-primary" :disabled="!newForm.name.trim()" @click="createList">
          + Create list
        </button>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useListsStore } from '../stores/lists'
import type { CommitmentList } from '../types'

const emit = defineEmits<{ (e: 'close'): void }>()
const lists = useListsStore()

const COLORS = [
  '#7c6af5', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#ef4444', '#f97316',
  '#f59e0b', '#22c55e', '#10b981', '#06b6d4',
  '#0ea5e9', '#3b82f6', '#6366f1', '#64748b',
]

const newForm = ref({ name: '', purpose: '', color: COLORS[0] })

async function createList() {
  if (!newForm.value.name.trim()) return
  await lists.add({
    name: newForm.value.name.trim(),
    purpose: newForm.value.purpose || undefined,
    color: newForm.value.color,
  })
  newForm.value = { name: '', purpose: '', color: COLORS[0] }
}

async function removeList(id: string) {
  if (confirm('Delete this list? Commitments in it won\'t be deleted.')) {
    await lists.remove(id)
  }
}

// Inline edit
const editingId = ref<string | null>(null)
const editForm = ref({ name: '', purpose: '', color: '' })

function startEdit(l: CommitmentList) {
  editingId.value = l.id
  editForm.value = { name: l.name, purpose: l.purpose ?? '', color: l.color }
}

function cancelEdit() { editingId.value = null }

async function saveEdit(id: string) {
  await lists.update(id, {
    name: editForm.value.name.trim(),
    purpose: editForm.value.purpose || undefined,
    color: editForm.value.color,
  })
  editingId.value = null
}
</script>

<style scoped>
.existing-lists { margin-bottom: 4px; }

.list-row { margin-bottom: 8px; }

.list-display {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px;
  background: var(--surface-2);
  border-radius: var(--radius-sm);
}
.list-display .dot { margin-top: 4px; }
.list-display-info { flex: 1; display: flex; flex-direction: column; }
.list-display-actions { display: flex; gap: 4px; flex-shrink: 0; }

.list-edit-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: var(--surface-2);
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
}
.list-edit-actions { display: flex; gap: 8px; justify-content: flex-end; }

.input-sm { padding: 6px 10px; font-size: 13px; }

.new-list-form { display: flex; flex-direction: column; gap: 12px; }

.color-swatches { display: flex; flex-wrap: wrap; gap: 6px; }
.swatch {
  width: 24px; height: 24px; border-radius: 50%;
  border: 2px solid transparent; cursor: pointer;
  transition: transform var(--transition), border-color var(--transition);
}
.swatch:hover { transform: scale(1.15); }
.swatch--active { border-color: #fff; outline: 2px solid var(--accent); }
</style>
