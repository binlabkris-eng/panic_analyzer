import type { PanicRule, SearchHit } from '../types/panic'
import type { ParsedPanicLog, ExtractedToken as ParsedExtractedToken } from './panicLogParser'
import { extractPossibleCodes, normalizeInput, normalizeQueryForIndex } from './panicNormalize'

function textIncludes(haystack: string | undefined, needle: string) {
  if (!haystack) return false
  return haystack.toLowerCase().includes(needle)
}

function scoreForKeywordMatch(rule: PanicRule, needle: string): { score: number; reasons: string[] } {
  const reasons: string[] = []
  let score = 0

  const fields: Array<[string, string | undefined]> = [
    ['diagnosisArea', rule.diagnosisArea],
    ['analysis', rule.analysis],
    ['path', rule.path],
    ['category', rule.category],
    ['subcategory', rule.subcategory],
    ['manualNotes', rule.manualNotes],
  ]

  for (const [name, v] of fields) {
    if (textIncludes(v, needle)) {
      score = Math.max(score, 50)
      reasons.push(`keyword match in ${name}`)
    }
  }

  if (rule.tags?.some((t) => t.toLowerCase().includes(needle))) {
    score = Math.max(score, 50)
    reasons.push('keyword match in tags')
  }

  // Weak fuzzy: split words and match partials
  const parts = needle.split(/[^a-z0-9]+/i).filter((p) => p.length >= 3)
  if (parts.length >= 2) {
    const joined = [
      rule.query,
      rule.normalizedQuery,
      rule.analysis,
      rule.diagnosisArea,
      rule.path,
      rule.category,
      rule.subcategory,
      ...(rule.tags ?? []),
      rule.manualNotes,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    const matched = parts.filter((p) => joined.includes(p.toLowerCase())).length
    if (matched >= Math.max(2, Math.floor(parts.length * 0.6))) {
      score = Math.max(score, 25)
      reasons.push('weak fuzzy match')
    }
  }

  return { score, reasons }
}

export function searchRules(rules: PanicRule[], inputRaw: string, limit = 50): SearchHit[] {
  const input = normalizeInput(inputRaw)
  if (!input) return []

  const needle = normalizeQueryForIndex(input)
  const extracted = extractPossibleCodes(input)
  const extractedNormalizedSet = new Set(extracted.map((t) => t.normalized))
  const extractedRawLowerSet = new Set(extracted.map((t) => t.raw.toLowerCase()))

  const hits: SearchHit[] = []

  for (const rule of rules) {
    const reasons: string[] = []
    let score = 0

    // Priority 1: exact normalized_query match
    if (rule.normalizedQuery && rule.normalizedQuery === needle) {
      score = 100
      reasons.push('exact normalized query')
    }

    // Priority 2: exact case-insensitive raw query match
    if (score < 100 && rule.query && rule.query.toLowerCase() === input.toLowerCase()) {
      score = Math.max(score, 95)
      reasons.push('exact raw query (case-insensitive)')
    }

    // Priority 3: panic log contains known query/code
    // - If user pasted a log, check if it contains this rule's query or normalizedQuery
    if (score < 95) {
      const qLower = rule.query?.toLowerCase()
      const nqLower = rule.normalizedQuery?.toLowerCase()
      const inputLower = input.toLowerCase()
      if ((qLower && inputLower.includes(qLower)) || (nqLower && inputLower.includes(nqLower))) {
        score = Math.max(score, 85)
        reasons.push('input contains known query/code')
      }
    }

    // Extra: extracted tokens match query/normalizedQuery
    if (score < 85) {
      if (rule.normalizedQuery && extractedNormalizedSet.has(rule.normalizedQuery)) {
        score = Math.max(score, 85)
        reasons.push('extracted token matches normalized query')
      } else if (rule.query && extractedRawLowerSet.has(rule.query.toLowerCase())) {
        score = Math.max(score, 85)
        reasons.push('extracted token matches raw query')
      }
    }

    // Priority 4a: query contains user input
    if (score < 85) {
      const inLower = input.toLowerCase()
      if (rule.query?.toLowerCase().includes(inLower) || rule.normalizedQuery?.toLowerCase().includes(inLower)) {
        score = Math.max(score, 75)
        reasons.push('query contains input')
      }
    }

    // Priority 4b: keyword/fuzzy search across other fields
    if (score < 75) {
      const kw = scoreForKeywordMatch(rule, needle)
      if (kw.score > 0) {
        score = Math.max(score, kw.score)
        reasons.push(...kw.reasons)
      }
    }

    if (score > 0) hits.push({ rule, score, reasons })
  }

  hits.sort((a, b) => b.score - a.score || a.rule.query.localeCompare(b.rule.query))
  return hits.slice(0, limit)
}

function sourceBaseScore(src: ParsedExtractedToken['source']) {
  switch (src) {
    case 'manual_text':
      return 100
    case 'sensor_array':
      return 95
    case 'panic_string':
      return 90
    case 'mailbox_fourcc':
      return 45
    case 'generic_hex':
      return 25
    default:
      return 25
  }
}

function matchTokenToRule(rule: PanicRule, token: ParsedExtractedToken): { score: number; reason: string } | null {
  const base = sourceBaseScore(token.source)
  const t = token.normalizedToken
  const ruleN = rule.normalizedQuery
  const ruleQ = rule.query

  if (ruleN && t === ruleN) {
    return { score: base, reason: `${token.source} exact normalized match` }
  }
  if (ruleQ && t.toLowerCase() === ruleQ.toLowerCase()) {
    return { score: Math.max(10, base - 5), reason: `${token.source} exact raw match` }
  }

  return null
}

export function searchDatabase(
  rules: PanicRule[],
  inputTextRaw: string,
  parsed?: ParsedPanicLog,
  limit = 50,
): SearchHit[] {
  const inputText = normalizeInput(inputTextRaw)
  if (!inputText) return []

  // If we have a parsed panic log, use source-aware scoring first.
  if (parsed?.extractedTokens?.length) {
    const hits: SearchHit[] = []
    for (const rule of rules) {
      let best = 0
      const reasons: string[] = []

      for (const t of parsed.extractedTokens) {
        const m = matchTokenToRule(rule, t)
        if (!m) continue
        if (m.score > best) {
          best = m.score
          reasons.length = 0
          reasons.push(m.reason)
        } else if (m.score === best) {
          reasons.push(m.reason)
        }
      }

      // Fallback: allow keyword match for context / secondary matches
      if (best === 0) {
        const needle = normalizeQueryForIndex(inputText)
        const kw = scoreForKeywordMatch(rule, needle)
        if (kw.score > 0) {
          best = kw.score
          reasons.push(...kw.reasons)
        }
      }

      if (best > 0) hits.push({ rule, score: best, reasons })
    }

    hits.sort((a, b) => b.score - a.score || a.rule.query.localeCompare(b.rule.query))
    return hits.slice(0, limit)
  }

  // Manual-only path (existing behavior)
  return searchRules(rules, inputText, limit)
}

