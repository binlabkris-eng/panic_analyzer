import type { PanicRule } from '../types/panic'

export type PanicConflictGroup = {
  normalizedQuery: string
  rules: PanicRule[]
  differingFields: Array<'analysis' | 'diagnosisArea' | 'path'>
}

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr))
}

export function detectConflicts(rules: PanicRule[]): PanicConflictGroup[] {
  const by = new Map<string, PanicRule[]>()
  for (const r of rules) {
    const key = r.normalizedQuery || r.query.toLowerCase()
    const list = by.get(key) ?? []
    list.push(r)
    by.set(key, list)
  }

  const conflicts: PanicConflictGroup[] = []

  for (const [normalizedQuery, group] of by.entries()) {
    if (group.length <= 1) continue

    const analyses = uniq(group.map((g) => (g.analysis ?? '').trim()).filter(Boolean))
    const areas = uniq(group.map((g) => (g.diagnosisArea ?? '').trim()).filter(Boolean))
    const paths = uniq(group.map((g) => (g.path ?? '').trim()).filter(Boolean))

    const differingFields: PanicConflictGroup['differingFields'] = []
    if (analyses.length > 1) differingFields.push('analysis')
    if (areas.length > 1) differingFields.push('diagnosisArea')
    if (paths.length > 1) differingFields.push('path')

    if (differingFields.length) {
      conflicts.push({ normalizedQuery, rules: group, differingFields })
    }
  }

  conflicts.sort((a, b) => a.normalizedQuery.localeCompare(b.normalizedQuery))
  return conflicts
}

