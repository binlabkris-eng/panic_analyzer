const SMART_QUOTES: Array<[RegExp, string]> = [
  [/[\u2018\u2019\u201A\u201B]/g, "'"],
  [/[\u201C\u201D\u201E\u201F]/g, '"'],
]

export function normalizeSpaces(s: string) {
  return s.replace(/\s+/g, ' ').trim()
}

export function normalizeHexToken(token: string) {
  // Normalize 0X / 0x forms, keep hex digits
  const m = token.match(/^0x([0-9a-f]+)$/i)
  if (!m) return token
  const digits = m[1].toLowerCase().replace(/^0+/, '') || '0'
  return `0x${digits}`
}

export function normalizeInput(input: string) {
  let s = input ?? ''
  for (const [re, rep] of SMART_QUOTES) s = s.replace(re, rep)
  // Preserve newlines for log parsing, but normalize internal spacing
  s = s.replace(/\r\n/g, '\n')
  s = s.replace(/[ \t]+/g, ' ')
  s = s.trim()
  return s
}

export type ExtractedToken = {
  raw: string
  normalized: string
  kind:
    | 'hex'
    | 'cpp_location'
    | 'sensor_code'
    | 'short_token'
}

const SENSOR_CODE_RE =
  /\b(?:TG\d[A-Z0-9]|TP\d[A-Z0-9]|TT[A-Z0-9]{2}|Prs\d|MIC\d|PP\d[A-Z0-9])\b/g

export function extractPossibleCodes(input: string): ExtractedToken[] {
  const s = normalizeInput(input)
  const out: ExtractedToken[] = []
  const seen = new Set<string>()

  const push = (raw: string, normalized: string, kind: ExtractedToken['kind']) => {
    const key = `${kind}:${normalized}`
    if (seen.has(key)) return
    seen.add(key)
    out.push({ raw, normalized, kind })
  }

  // hex codes like 0X40000, 0xA1
  const hexRe = /\b0x[0-9a-f]+\b/gi
  for (const m of s.matchAll(hexRe)) {
    const raw = m[0]
    push(raw, normalizeHexToken(raw), 'hex')
  }

  // PressureController.cpp:280
  const cppRe = /\b[A-Za-z0-9_]+\.(?:cpp|c|h|mm|m):\d+\b/g
  for (const m of s.matchAll(cppRe)) {
    const raw = m[0]
    push(raw, raw.toLowerCase(), 'cpp_location')
  }

  // common sensor/thermal short codes
  for (const m of s.matchAll(SENSOR_CODE_RE)) {
    const raw = m[0]
    push(raw, raw.toUpperCase(), 'sensor_code')
  }

  // other short alphanumeric tokens (3-10 chars) that look like panic tokens
  const shortTokenRe = /\b[A-Za-z0-9_]{3,12}\b/g
  for (const m of s.matchAll(shortTokenRe)) {
    const raw = m[0]
    // Skip pure words that are too generic
    if (/^[A-Za-z]{3,12}$/.test(raw) && raw.length <= 4) continue
    // normalize: keep original case-insensitive matching
    push(raw, raw.toLowerCase(), 'short_token')
  }

  return out
}

export function normalizeQueryForIndex(q: string) {
  const s = normalizeInput(q)
  // If it’s hex-like, normalize hex casing
  if (/^\s*0x[0-9a-f]+\s*$/i.test(s)) return normalizeHexToken(s)
  // Keep cpp location but normalize case
  if (/\.(cpp|c|h|mm|m):\d+$/i.test(s)) return s.toLowerCase()
  // Default: case-insensitive index
  return s.toLowerCase()
}

