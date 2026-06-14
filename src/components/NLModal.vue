<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-title">
        Add with words
        <button class="btn-icon" @click="$emit('close')">✕</button>
      </div>

      <p class="text-sm text-muted" style="margin-bottom:14px">
        Describe your income or a financial commitment in plain English. Kubera will parse it.
      </p>

      <div class="input-group">
        <textarea
          v-model="raw"
          class="input nl-textarea"
          rows="4"
          placeholder='Try: "I pay $880 rent every 28 days starting June 26" or "I got paid $750 today"'
          @keydown.ctrl.enter="parse"
        />
      </div>

      <div class="examples text-xs text-dim mt-2">
        Examples: "Netflix $22.99 monthly" · "Fuel $100 weekly starting Monday" · "Paycheck $756"
      </div>

      <button class="btn btn-primary mt-3 full-w" :disabled="!raw.trim()" @click="parse">
        Parse →
      </button>

      <!-- Result preview -->
      <Transition name="slide-down">
        <div v-if="result" class="result-box mt-3">
          <!-- Income -->
          <template v-if="result.type === 'income'">
            <div class="result-type badge badge-success">Income detected</div>
            <div class="result-detail">
              Amount: <span class="fw-700">${{ fmt(result.amount) }}</span>
              <span v-if="result.note"> · {{ result.note }}</span>
            </div>
            <div class="modal-actions" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
              <button class="btn btn-ghost" @click="reset">Try again</button>
              <button class="btn btn-success" @click="confirmIncome">Record income</button>
            </div>
          </template>

          <!-- Commitment -->
          <template v-else-if="result.type === 'commitment'">
            <div class="result-type badge badge-normal">Commitment detected</div>
            <div class="result-fields">
              <div class="result-field">
                <span class="result-key">Name</span>
                <span class="fw-600">{{ result.data.name }}</span>
              </div>
              <div class="result-field">
                <span class="result-key">Amount</span>
                <span class="fw-600">${{ fmt(result.data.amount ?? 0) }}</span>
              </div>
              <div class="result-field">
                <span class="result-key">Recurrence</span>
                <span class="fw-600">{{ result.data.recurrence }}</span>
              </div>
              <div v-if="result.data.intervalDays" class="result-field">
                <span class="result-key">Every</span>
                <span class="fw-600">{{ result.data.intervalDays }} days</span>
              </div>
              <div v-if="result.data.startDate" class="result-field">
                <span class="result-key">Start</span>
                <span class="fw-600">{{ result.data.startDate }}</span>
              </div>
              <div v-if="result.data.dueDay" class="result-field">
                <span class="result-key">Due day</span>
                <span class="fw-600">{{ result.data.dueDay }}</span>
              </div>
            </div>
            <p class="text-xs text-muted mt-2">
              You can review and edit the details before saving.
            </p>
            <div class="modal-actions" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
              <button class="btn btn-ghost" @click="reset">Try again</button>
              <button class="btn btn-primary" @click="confirmCommitment">Review & save</button>
            </div>
          </template>

          <!-- Unknown -->
          <template v-else>
            <div class="result-type badge badge-overdue">Couldn't parse</div>
            <p class="text-sm text-muted mt-2">
              Try being more specific about the amount and how often it recurs.
            </p>
            <button class="btn btn-ghost btn-sm mt-3" @click="reset">Try again</button>
          </template>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { parseNL } from '../utils/nlParser'
import { useIncomeStore } from '../stores/income'
import type { Commitment, NLParseResult } from '../types'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'open-commitment', partial: Partial<Commitment>): void
  (e: 'income-recorded'): void
}>()

const income = useIncomeStore()

const raw = ref('')
const result = ref<NLParseResult | null>(null)

function fmt(n: number) {
  return n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function parse() {
  result.value = parseNL(raw.value)
}

function reset() {
  result.value = null
  raw.value = ''
}

async function confirmIncome() {
  if (result.value?.type !== 'income') return
  await income.add(result.value.amount, undefined, result.value.note)
  emit('income-recorded')
  emit('close')
}

function confirmCommitment() {
  if (result.value?.type !== 'commitment') return
  emit('open-commitment', result.value.data)
}
</script>

<style scoped>
.nl-textarea {
  font-size: 15px;
  line-height: 1.6;
  resize: vertical;
}

.full-w { width: 100%; justify-content: center; }

.examples { line-height: 1.8; }

.result-box {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 14px;
}

.result-type { margin-bottom: 10px; }
.result-detail { font-size: 14px; margin-top: 4px; }

.result-fields {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}
.result-field {
  display: flex;
  gap: 10px;
  font-size: 14px;
}
.result-key {
  min-width: 90px;
  color: var(--text-2);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  padding-top: 2px;
}
</style>
