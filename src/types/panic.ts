export type PanicRule = {
  id: string
  query: string
  normalizedQuery: string
  analysis: string
  diagnosisArea?: string
  path?: string
  category?: string
  subcategory?: string
  tags?: string[]
  confidence?: string
  source?: string
  verified?: boolean
  manualNotes?: string
  models?: string[]
  boardLocation?: string
  schematicRef?: string

  // Allow unknown future fields without breaking normalization/display
  [key: string]: unknown
}

export type PanicDb = {
  rules: PanicRule[]
  tree?: Array<Record<string, unknown>>
  conflicts?: Array<Record<string, unknown>>
  meta?: Record<string, unknown>
}

export type SearchHit = {
  rule: PanicRule
  score: number
  reasons: string[]
}

