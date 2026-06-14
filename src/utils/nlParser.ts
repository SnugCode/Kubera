import type { Commitment, NLParseResult, Recurrence } from '../types'
import { today } from './dates'

// ─── Stopwords stripped from extracted name candidates ────────────────────────

const STOP = new Set([
  'i','me','my','myself','we','our','ours','you','your','yourself',
  'he','him','his','she','her','hers','it','its','they','them','their',
  'the','a','an',
  'and','but','or','so','if','of','in','on','at','to','into','with','by',
  'from','up','out','about','through','as','also',
  'is','are','was','were','be','been','being','am',
  'have','has','had','do','does','did',
  'will','would','should','could','can','may','might',
  'pay','paying','paid','pays',
  'cost','costs','costing',
  'spend','spending','spent',
  'charge','charges','charging',
  'need','needs','needed',
  'want','wants','wanted',
  'get','gets','got','gotten',
  'set','aside',
  'go','going','went','gone',
  'make','makes','made',
  'put','puts',
  'take','takes','took','taken',
  'use','uses','used',
  'currently','every','each','per','once','due','owing',
  'that','this','these','those','what','which','how','why','when','where',
])

function cleanTokens(phrase: string): string {
  return phrase
    .split(/\s+/)
    .filter(t => t.length > 0 && !STOP.has(t.toLowerCase()))
    .join(' ')
    .trim()
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ─── Amount ───────────────────────────────────────────────────────────────────

function extractAmount(text: string): number | null {
  const m = text.match(/\$\s*(\d[\d,]*(?:\.\d{1,2})?)|(\d[\d,]*(?:\.\d{1,2})?)\s*(?:dollars?|bucks?)/i)
  if (m) return parseFloat((m[1] || m[2]).replace(/,/g, ''))

  // Fallback: first standalone number
  const bare = text.match(/(?<![a-z])(\d+(?:\.\d{1,2})?)(?![a-z%])/i)
  if (bare) return parseFloat(bare[1])
  return null
}

// ─── Recurrence ───────────────────────────────────────────────────────────────

function extractRecurrence(text: string): { recurrence: Recurrence; intervalDays?: number } | null {
  const t = text.toLowerCase()
  if (/every\s+week|weekly|each\s+week|per\s+week|\ba\s+week\b/.test(t)) return { recurrence: 'weekly' }
  if (/fortnightly|every\s+(2|two)\s+weeks?|every\s+fortnight/.test(t)) return { recurrence: 'fortnightly' }
  if (/every\s+month|monthly|per\s+month|\ba\s+month\b/.test(t)) return { recurrence: 'monthly' }
  if (/quarterly|every\s+(3|three)\s+months?|every\s+quarter/.test(t)) return { recurrence: 'quarterly' }
  if (/yearly|annually|every\s+year|per\s+year|\ba\s+year\b|once\s+a\s+year/.test(t)) return { recurrence: 'yearly' }
  if (/\bonce\b|one.?time|one.?off|does\s+no?t\s+repeat|doesn'?t\s+repeat|won'?t\s+repeat|will\s+not\s+repeat|not\s+repeat(?:ing)?|no\s+repeat|non.?recurr|not\s+recurr/.test(t)) return { recurrence: 'one-time' }

  const interval = t.match(/every\s+(\d+)\s+days?/)
  if (interval) return { recurrence: 'interval', intervalDays: parseInt(interval[1]) }

  return null
}

// ─── Due day ──────────────────────────────────────────────────────────────────

function extractDueDay(text: string): number | null {
  const m = text.match(/(?:due\s+(?:on\s+)?(?:the\s+)?|on\s+the\s+)(\d{1,2})(?:st|nd|rd|th)?/i)
  return m ? parseInt(m[1]) : null
}

// ─── Start date ───────────────────────────────────────────────────────────────

function extractStartDate(text: string): string | null {
  const MONTHS: Record<string, string> = {
    jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06',
    jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12',
  }
  const m1 = text.match(/(?:starting|from|beginning|since|on)\s+(\w+)\s+(\d{1,2})/i)
  const m2 = text.match(/(?:starting|from|beginning|since|on)\s+(\d{1,2})\s+(\w+)/i)

  let day: string | null = null, monthStr: string | null = null
  if (m1) { monthStr = m1[1]; day = m1[2] }
  else if (m2) { day = m2[1]; monthStr = m2[2] }

  if (day && monthStr) {
    const mo = MONTHS[monthStr.toLowerCase().slice(0, 3)]
    if (mo) return `${new Date().getFullYear()}-${mo}-${day.padStart(2, '0')}`
  }

  const iso = text.match(/\b(\d{4}-\d{2}-\d{2})\b/)
  return iso ? iso[1] : null
}

// ─── Name extraction ──────────────────────────────────────────────────────────

function extractName(raw: string, amount: number | null): string {
  // ── Pattern 0: explicit quotes — highest priority ─────────────────────────
  // Matches 'name' or "name" (straight or curly quotes)
  const quoted = raw.match(/['"''""]([^'"''""]+)['"''""]/)
  if (quoted) return capitalize(quoted[1].trim())

  // Remove the known amount string first so it can't pollute the name
  let text = raw
  if (amount !== null) {
    const a = amount.toFixed(2).replace(/\.00$/, '')
    const af = amount.toFixed(2)
    text = text
      .replace(new RegExp('\\$\\s*' + escRe(af), 'g'), '')
      .replace(new RegExp('\\$\\s*' + escRe(a), 'g'), '')
      .replace(new RegExp('(?<![a-z])' + escRe(af) + '(?![a-z%])', 'gi'), '')
      .replace(new RegExp('(?<![a-z])' + escRe(a) + '(?![a-z%])', 'gi'), '')
  }

  // ── Pattern 1: "for NAME" (pay for X, paying for X, money for X)
  const forMatch = text.match(
    /\bfor\s+([a-z][\w\s&+'.,-]+?)(?=\s*(?:every|weekly|fortnightly|monthly|quarterly|yearly|annually|per\s|a\s+(?:week|month|year)|starting|from|due\s+on|$))/i
  )
  if (forMatch) {
    const name = cleanTokens(forMatch[1])
    if (name.length > 1) return capitalize(name)
  }

  // ── Pattern 2: "NAME costs/charges/is $X" (subject before verb)
  const subjectMatch = text.match(
    /^([a-z][\w\s&+'.,-]+?)\s+(?:costs?|charges?|is|are|was|price[sd]?)\b/i
  )
  if (subjectMatch) {
    const name = cleanTokens(subjectMatch[1])
    if (name.length > 1) return capitalize(name)
  }

  // ── Pattern 3: "NAME" appears before any recurrence keyword (most common)
  // e.g. "Netflix monthly", "gym fortnightly", "Rent every 28 days"
  const beforeRec = text.match(
    /^(.*?)(?=\s*(?:every|weekly|fortnightly|monthly|quarterly|yearly|annually|per\s|(?:a|each)\s+(?:week|month|year|fortnight)|once\b))/i
  )
  if (beforeRec) {
    const name = cleanTokens(beforeRec[1])
    if (name.length > 1) return capitalize(name)
  }

  // ── Fallback: strip noise and take whatever remains
  const stripped = text
    .replace(/\b(?:dollars?|bucks?)\b/gi, '')
    .replace(/\bevery\s+(?:\d+\s+)?(?:week|fortnight|month|quarter|year|day)s?\b/gi, '')
    .replace(/\bper\s+(?:week|fortnight|month|quarter|year|day)s?\b/gi, '')
    .replace(/\b(?:a|each)\s+(?:week|fortnight|month|quarter|year|day)s?\b/gi, '')
    .replace(/\b(?:weekly|fortnightly|monthly|quarterly|yearly|annually|once|one-?time|one-?off)\b/gi, '')
    .replace(/\b(?:starting|from|beginning|since)\s+\w+\s+\d{1,2}\b/gi, '')
    .replace(/\b\d{1,2}(?:st|nd|rd|th)\b/gi, '')
    .replace(/[^a-z0-9\s&+'.,-]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  const fallback = cleanTokens(stripped)
  return capitalize(fallback) || 'New Commitment'
}

// ─── Category / colour inference ──────────────────────────────────────────────

function inferCategory(name: string): string {
  const n = name.toLowerCase()
  if (/rent|mortgage|lease|housing/.test(n)) return 'housing'
  if (/fuel|petrol|gas|car|rego|registration|insurance|toll/.test(n)) return 'transport'
  if (/gym|fitness|netflix|spotify|apple|disney|hulu|audible|icloud|subscription|plan|membership/.test(n)) return 'subscriptions'
  if (/grocery|groceries|food|supermarket|coles|woolworths|aldi/.test(n)) return 'food'
  if (/save|saving|emergency|fund|invest|investing|shares|etf/.test(n)) return 'savings'
  if (/loan|debt|credit|repayment|afterpay|zip|laybuy/.test(n)) return 'loans'
  if (/electric|power|water|internet|phone|mobile|utility|utilities/.test(n)) return 'utilities'
  return 'other'
}

function inferColor(category: string): string {
  return ({
    housing: '#6366f1', transport: '#f59e0b', subscriptions: '#8b5cf6',
    food: '#22c55e', savings: '#06b6d4', loans: '#ef4444',
    utilities: '#64748b', other: '#94a3b8',
  } as Record<string, string>)[category] ?? '#94a3b8'
}

// ─── Income detection ─────────────────────────────────────────────────────────

function tryParseIncome(text: string): NLParseResult | null {
  const t = text.toLowerCase()
  if (!/(?:paid|earned|received|got|income|paycheck|pay\s*cheque|salary|wage|pay\s+of|my\s+pay)/.test(t)) return null

  const amount = extractAmount(text)
  if (!amount) return null

  const noteMatch = text.match(/for\s+(.+)$/i)
  return { type: 'income', amount, note: noteMatch?.[1]?.trim() }
}

// ─── Commitment detection ─────────────────────────────────────────────────────

function tryParseCommitment(text: string): NLParseResult | null {
  const amount = extractAmount(text)
  if (!amount) return null

  const rec = extractRecurrence(text)
  if (!rec) return null

  const name = extractName(text, amount)
  const dueDay = extractDueDay(text)
  const startDate = extractStartDate(text) ?? (rec.recurrence === 'one-time' ? today() : undefined)
  const category = inferCategory(name)

  const data: Partial<Commitment> = {
    name,
    amount,
    recurrence: rec.recurrence,
    color: inferColor(category),
    note: `Parsed from: "${text}"`,
  }

  if (rec.intervalDays) data.intervalDays = rec.intervalDays
  if (dueDay) data.dueDay = dueDay
  if (startDate) data.startDate = startDate

  return { type: 'commitment', data }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function parseNL(raw: string): NLParseResult {
  const text = raw.trim()
  if (!text) return { type: 'unknown', raw }

  const income = tryParseIncome(text)
  if (income) return income

  const commitment = tryParseCommitment(text)
  if (commitment) return commitment

  return { type: 'unknown', raw }
}
