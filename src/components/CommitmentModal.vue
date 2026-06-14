<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-title">
        {{ isEdit ? 'Edit Commitment' : 'Add Commitment' }}
        <button class="btn-icon" @click="$emit('close')">✕</button>
      </div>

      <div class="form-grid">
        <div class="input-group">
          <label class="input-label">Name</label>
          <input v-model="form.name" class="input" placeholder="e.g. Rent, Netflix, Groceries" />
        </div>

        <div class="form-row">
          <div class="input-group">
            <label class="input-label">Amount ($)</label>
            <input v-model="form.amount" class="input" type="number" min="0" step="0.01" placeholder="0.00" />
          </div>
          <div class="input-group">
            <label class="input-label">Recurrence</label>
            <select v-model="form.recurrence" class="input">
              <option value="weekly">Weekly</option>
              <option value="fortnightly">Fortnightly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
              <option value="interval">Every N days</option>
              <option value="one-time">One-time</option>
            </select>
          </div>
        </div>

        <!-- Interval days -->
        <div v-if="form.recurrence === 'interval'" class="input-group">
          <label class="input-label">Interval (days)</label>
          <input v-model="form.intervalDays" class="input" type="number" min="1" placeholder="e.g. 28" />
        </div>

        <!-- Start date (for weekly / fortnightly / interval / one-time) -->
        <div
          v-if="['weekly', 'fortnightly', 'interval', 'one-time'].includes(form.recurrence)"
          class="input-group"
        >
          <label class="input-label">
            {{ form.recurrence === 'one-time' ? 'Due date' : 'Start / anchor date' }}
          </label>
          <input v-model="form.startDate" class="input" type="date" />
        </div>

        <!-- Due day (for monthly / quarterly / yearly) -->
        <div
          v-if="['monthly', 'quarterly', 'yearly'].includes(form.recurrence)"
          class="input-group"
        >
          <label class="input-label">Due day of month</label>
          <input v-model="form.dueDay" class="input" type="number" min="1" max="31" placeholder="e.g. 15" />
        </div>

        <!-- List -->
        <div class="input-group">
          <label class="input-label">List (optional)</label>
          <select v-model="form.listId" class="input">
            <option value="">No list</option>
            <option v-for="l in lists.items" :key="l.id" :value="l.id">{{ l.name }}</option>
          </select>
        </div>

        <!-- Color -->
        <div class="input-group">
          <label class="input-label">Color</label>
          <div class="color-swatches">
            <button
              v-for="color in COLORS"
              :key="color"
              class="swatch"
              :class="{ 'swatch--active': form.color === color }"
              :style="{ background: color }"
              @click="form.color = color"
            />
          </div>
        </div>

        <!-- Note -->
        <div class="input-group">
          <label class="input-label">Note (optional)</label>
          <textarea v-model="form.note" class="input" rows="2" placeholder="Any extra context..." />
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn btn-ghost" @click="$emit('close')">Cancel</button>
        <button class="btn btn-primary" :disabled="!isValid" @click="save">
          {{ isEdit ? 'Save changes' : 'Add commitment' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCommitmentsStore } from '../stores/commitments'
import { useListsStore } from '../stores/lists'
import type { Commitment, Recurrence } from '../types'
import { today } from '../utils/dates'

const props = defineProps<{
  initial?: Partial<Commitment>
  defaultListId?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved'): void
}>()

const commitments = useCommitmentsStore()
const lists = useListsStore()

const COLORS = [
  '#7c6af5', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#ef4444', '#f97316',
  '#f59e0b', '#22c55e', '#10b981', '#06b6d4',
  '#0ea5e9', '#3b82f6', '#6366f1', '#64748b',
]

const isEdit = computed(() => !!props.initial?.id)

const form = ref({
  name:        props.initial?.name ?? '',
  amount:      props.initial?.amount ?? ('' as any),
  recurrence:  (props.initial?.recurrence ?? 'monthly') as Recurrence,
  intervalDays: props.initial?.intervalDays ?? ('' as any),
  startDate:   props.initial?.startDate ?? today(),
  dueDay:      props.initial?.dueDay ?? ('' as any),
  listId:      props.initial?.listId ?? (props.defaultListId ?? ''),
  color:       props.initial?.color ?? COLORS[0],
  note:        props.initial?.note ?? '',
})

const isValid = computed(() =>
  form.value.name.trim().length > 0 &&
  parseFloat(form.value.amount) > 0
)

async function save() {
  if (!isValid.value) return
  const payload = {
    name: form.value.name.trim(),
    amount: parseFloat(form.value.amount),
    recurrence: form.value.recurrence,
    intervalDays: form.value.intervalDays ? parseInt(form.value.intervalDays) : undefined,
    startDate: form.value.startDate || undefined,
    dueDay: form.value.dueDay ? parseInt(form.value.dueDay) : undefined,
    listId: form.value.listId || undefined,
    color: form.value.color,
    note: form.value.note || undefined,
  }

  if (isEdit.value && props.initial?.id) {
    await commitments.update(props.initial.id, payload)
  } else {
    await commitments.add(payload)
  }

  emit('saved')
}
</script>

<style scoped>
.form-grid { display: flex; flex-direction: column; gap: 14px; }
.form-row  { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

textarea.input { resize: vertical; }

.color-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.swatch {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform var(--transition), border-color var(--transition);
}
.swatch:hover { transform: scale(1.15); }
.swatch--active { border-color: #fff; outline: 2px solid var(--accent); }
</style>
