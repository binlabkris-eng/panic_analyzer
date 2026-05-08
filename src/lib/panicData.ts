import type { PanicDb, PanicRule } from '../types/panic'
import { normalizeQueryForIndex, normalizeInput } from './panicNormalize'

const LS_KEY = 'panic_analyzer_mvp_db_v1'

type AnyObj = Record<string, unknown>

function asString(v: unknown): string | undefined {
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  return undefined
}

function asStringArray(v: unknown): string[] | undefined {
  if (Array.isArray(v)) return v.map((x) => asString(x)).filter(Boolean) as string[]
  return undefined
}

function parseTags(v: unknown): string[] | undefined {
  const arr = asStringArray(v)
  if (arr) return arr
  const s = asString(v)
  if (!s) return undefined
  const parts = s
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
  return parts.length ? parts : undefined
}

function pickFirstString(obj: AnyObj, keys: string[]): string | undefined {
  for (const k of keys) {
    const s = asString(obj[k])
    if (s && s.trim()) return s
  }
  return undefined
}

function normalizeRawRule(raw: AnyObj, idx: number): PanicRule {
  const query =
    pickFirstString(raw, ['query', 'panic_code', 'code', 'token', 'keyword']) ??
    ''
  const normalizedFromRaw =
    pickFirstString(raw, ['normalized_query', 'normalizedQuery']) ??
    normalizeQueryForIndex(query)

  const analysis =
    pickFirstString(raw, ['analysis', 'result', 'meaning', 'description']) ?? ''

  const id =
    pickFirstString(raw, ['id', 'rule_id', 'ruleId']) ??
    `${normalizedFromRaw || 'rule'}:${idx}`

  const path = pickFirstString(raw, ['path', 'menu_path', 'menuPath'])
  const category = pickFirstString(raw, ['category'])
  const subcategory = pickFirstString(raw, ['subcategory', 'subCategory'])

  const diagnosisArea = pickFirstString(raw, [
    'diagnosis_area',
    'diagnosisArea',
    'likely_area',
    'likelyArea',
  ])

  const tags = parseTags((raw as AnyObj).tags) ?? parseTags((raw as AnyObj).tag)

  const confidence = pickFirstString(raw, ['confidence'])
  const source = pickFirstString(raw, ['source'])
  const manualNotes = pickFirstString(raw, ['manual_notes', 'manualNotes', 'notes'])

  const verified =
    typeof raw.verified === 'boolean'
      ? raw.verified
      : typeof raw.is_verified === 'boolean'
        ? (raw.is_verified as boolean)
        : undefined

  const models = asStringArray(raw.models)
  const boardLocation = pickFirstString(raw, ['boardLocation', 'board_location'])
  const schematicRef = pickFirstString(raw, ['schematicRef', 'schematic_ref'])

  return {
    ...raw,
    id,
    query: normalizeInput(query),
    normalizedQuery: normalizeQueryForIndex(normalizedFromRaw),
    analysis: normalizeInput(analysis),
    diagnosisArea: diagnosisArea ? normalizeInput(diagnosisArea) : undefined,
    path: path ? normalizeInput(path) : undefined,
    category: category ? normalizeInput(category) : undefined,
    subcategory: subcategory ? normalizeInput(subcategory) : undefined,
    tags: tags?.map((t) => normalizeInput(t)),
    confidence: confidence ? normalizeInput(confidence) : undefined,
    source: source ? normalizeInput(source) : undefined,
    verified,
    manualNotes: manualNotes ? normalizeInput(manualNotes) : undefined,
    models: models?.map((m) => normalizeInput(m)),
    boardLocation: boardLocation ? normalizeInput(boardLocation) : undefined,
    schematicRef: schematicRef ? normalizeInput(schematicRef) : undefined,
  }
}

function normalizeRawDb(raw: unknown): PanicDb {
  const obj = (raw && typeof raw === 'object' ? (raw as AnyObj) : {}) as AnyObj
  const rawRules = Array.isArray(obj.rules)
    ? (obj.rules as unknown[])
    : Array.isArray(obj.data)
      ? (obj.data as unknown[])
      : Array.isArray(obj.records)
        ? (obj.records as unknown[])
      : []

  const rules = rawRules
    .map((r, i) => (r && typeof r === 'object' ? normalizeRawRule(r as AnyObj, i) : null))
    .filter(Boolean) as PanicRule[]

  const tree = Array.isArray(obj.tree) ? (obj.tree as Array<Record<string, unknown>>) : []
  const conflicts = Array.isArray(obj.conflicts)
    ? (obj.conflicts as Array<Record<string, unknown>>)
    : []

  return { rules, tree, conflicts, meta: (obj.meta as AnyObj) ?? undefined }
}

export function normalizeDbFromUnknown(raw: unknown): PanicDb {
  return normalizeRawDb(raw)
}

export async function loadBundledDb(): Promise<PanicDb> {
  // Use BASE_URL so this works on GitHub Pages (/repo-name/...)
  const url = `${import.meta.env.BASE_URL}data/panic_analyzer_mvp_data.json`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to load bundled DB: ${res.status}`)
  const raw = (await res.json()) as unknown
  return normalizeRawDb(raw)
}

export function loadDbFromLocalStorage(): PanicDb | null {
  try {
    const s = localStorage.getItem(LS_KEY)
    if (!s) return null
    return normalizeRawDb(JSON.parse(s) as unknown)
  } catch {
    return null
  }
}

export function saveDbToLocalStorage(db: PanicDb) {
  localStorage.setItem(LS_KEY, JSON.stringify(db))
}

export function clearLocalStorageDb() {
  localStorage.removeItem(LS_KEY)
}

export function exportDbAsJson(db: PanicDb) {
  // Export normalized fields, keep tree/conflicts if present.
  return JSON.stringify({ rules: db.rules, tree: db.tree ?? [], conflicts: db.conflicts ?? [] }, null, 2)
}

