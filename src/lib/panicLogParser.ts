import { extractPossibleCodes, normalizeHexToken, normalizeInput } from './panicNormalize'

export type ParsedSensorArray = {
  arrayType: 'S' | 'F' | 'unknown'
  startIndex: number
  values: {
    index: number
    rawValue: string
    normalizedValue: string
    isZero: boolean
  }[]
}

export type ExtractedToken = {
  token: string
  normalizedToken: string
  source: 'sensor_array' | 'panic_string' | 'mailbox_fourcc' | 'manual_text' | 'generic_hex'
  confidenceWeight: number
}

export type ParsedPanicLog = {
  isFullPanicLog: boolean
  product?: string
  osVersion?: string
  bugType?: string
  panicString?: string
  mainPanic?: string
  reason?: string
  sourceFile?: string
  extraReason?: string
  sensorArrays: ParsedSensorArray[]
  extractedTokens: ExtractedToken[]
  rawText: string
}

function safeRegexCapture(text: string, re: RegExp) {
  const m = text.match(re)
  return m?.[1]
}

export function decodeMailboxFourCC(hexValue: string): string | null {
  const m = hexValue.match(/^0x([0-9a-f]{8,})$/i)
  if (!m) return null
  const hex = m[1].toLowerCase()
  const first8 = hex.slice(0, 8)
  const bytes: number[] = []
  for (let i = 0; i < 8; i += 2) {
    bytes.push(parseInt(first8.slice(i, i + 2), 16))
  }
  if (bytes.length !== 4) return null
  const printable = bytes.every((b) => b >= 0x20 && b <= 0x7e)
  if (!printable) return null
  return String.fromCharCode(...bytes)
}

function classifyMainPanic(panicString: string | undefined) {
  const s = (panicString ?? '').toLowerCase()
  if (!s) return undefined
  if (s.includes('smc panic - assertion failed')) return 'SMC PANIC - ASSERTION FAILED'
  if (s.includes('smc panic - assertion')) return 'SMC PANIC - ASSERTION'
  if (s.includes('smc bsc failure')) return 'SMC BSC failure'
  if (s.includes('userspace watchdog timeout')) return 'Userspace watchdog timeout'
  if (s.includes('aop panic')) return 'AOP PANIC'
  if (s.includes('rtkit')) return 'RTKit'
  if (s.includes('applesmcfirmware')) return 'AppleSMCFirmware'
  if (s.match(/target\/.+\.(cpp|c|h|mm|m):\d+/i)) return 'Source file panic'
  return 'Misc'
}

function detectFullPanicLog(text: string) {
  const t = text.toLowerCase()
  return (
    t.includes('"bug_type"') ||
    t.includes('bug_type') ||
    t.includes('"os_version"') ||
    t.includes('os_version') ||
    t.includes('"product"') ||
    t.includes('product') ||
    t.includes('panicstring') ||
    t.includes('smc panic') ||
    t.includes('userspace watchdog timeout') ||
    t.includes('panic-full')
  )
}

function parseSensorArrays(rawText: string) {
  const arrays: ParsedSensorArray[] = []
  const lines = rawText.split('\n')

  // Examples:
  // S.sensor array 0 - 6 is 0x0, 0x800, 0x0
  // F.sensor array 0 is 0x0
  const re = /^\s*([SF])\.sensor array\s+(\d+)(?:\s*-\s*(\d+))?\s+is\s+(.+)\s*$/i

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]
    const m = line.match(re)
    if (!m) continue

    const arrayType = (m[1].toUpperCase() === 'S' ? 'S' : 'F') as 'S' | 'F'
    const startIndex = parseInt(m[2], 10)
    const valuesText = m[4]

    const rawValues = valuesText
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)

    const values = rawValues.map((rv, i) => {
      const norm = rv.match(/^0x[0-9a-f]+$/i) ? normalizeHexToken(rv) : rv
      const isZero = /^0x0$/i.test(norm)
      return { index: startIndex + i, rawValue: rv, normalizedValue: norm, isZero }
    })

    arrays.push({ arrayType, startIndex, values })
  }

  return arrays
}

function extractFromPanicString(panicString: string): ExtractedToken[] {
  const out: ExtractedToken[] = []
  const seen = new Set<string>()
  const push = (token: string, normalizedToken: string, source: ExtractedToken['source'], confidenceWeight: number) => {
    const k = `${source}:${normalizedToken}`
    if (seen.has(k)) return
    seen.add(k)
    out.push({ token, normalizedToken, source, confidenceWeight })
  }

  // file:line patterns
  const cppRe = /\b(?:target\/[^\s"']+?\.(?:cpp|c|h|mm|m):\d+|[A-Za-z0-9_]+\.(?:cpp|c|h|mm|m):\d+)\b/gi
  for (const m of panicString.matchAll(cppRe)) {
    const raw = m[0]
    push(raw, raw.toLowerCase(), 'panic_string', 0.88)
  }

  // hex tokens inside panicString (lower confidence than sensor array)
  const hexRe = /\b0x[0-9a-f]{1,16}\b/gi
  for (const m of panicString.matchAll(hexRe)) {
    const raw = m[0]
    push(raw, normalizeHexToken(raw), 'panic_string', 0.7)
  }

  // short panic tokens (TG0B, Prs0, MIC1, etc.) from panicString
  for (const t of extractPossibleCodes(panicString)) {
    if (t.kind === 'sensor_code') push(t.raw, t.normalized, 'panic_string', 0.9)
    if (t.kind === 'cpp_location') push(t.raw, t.normalized, 'panic_string', 0.88)
  }

  return out
}

function extractMailboxFourCC(rawText: string): ExtractedToken[] {
  const out: ExtractedToken[] = []
  const seen = new Set<string>()

  const push = (token: string) => {
    const k = token.toUpperCase()
    if (seen.has(k)) return
    seen.add(k)
    out.push({ token: k, normalizedToken: k, source: 'mailbox_fourcc', confidenceWeight: 0.45 })
  }

  // Look for 64-bit-ish mailbox hex values; be defensive.
  const hex64 = /\b0x[0-9a-f]{16}\b/gi
  for (const m of rawText.matchAll(hex64)) {
    const raw = m[0]
    const decoded = decodeMailboxFourCC(raw)
    if (decoded) push(decoded)
  }

  return out
}

export function parsePanicLog(input: string): ParsedPanicLog {
  const rawText = normalizeInput(input)
  const isFullPanicLog = detectFullPanicLog(rawText)

  let product: string | undefined
  let osVersion: string | undefined
  let bugType: string | undefined
  let panicString: string | undefined

  // Try JSON.parse first (common for .ips)
  try {
    const parsed = JSON.parse(rawText) as unknown
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>
      product = typeof obj.product === 'string' ? obj.product : product
      osVersion = typeof obj.os_version === 'string' ? obj.os_version : osVersion
      bugType =
        typeof obj.bug_type === 'number'
          ? String(obj.bug_type)
          : typeof obj.bug_type === 'string'
            ? obj.bug_type
            : bugType
      panicString = typeof obj.panicString === 'string' ? obj.panicString : panicString
    }
  } catch {
    // fall back to regex below
  }

  // Regex fallback for semi-JSON / text dumps
  product ??= safeRegexCapture(rawText, /"product"\s*:\s*"([^"]+)"/i) ?? safeRegexCapture(rawText, /\bproduct\s*[:=]\s*([A-Za-z0-9,._-]+)/i)
  osVersion ??= safeRegexCapture(rawText, /"os_version"\s*:\s*"([^"]+)"/i)
  bugType ??= safeRegexCapture(rawText, /"bug_type"\s*:\s*"?([0-9]+)"?/i)
  panicString ??= safeRegexCapture(rawText, /"panicString"\s*:\s*"([\s\S]*?)"\s*,\s*"/i)

  // If panicString is missing, try to find a line starting with panicString:
  if (!panicString) {
    const m = rawText.match(/panicString\s*[:=]\s*([\s\S]{0,1200})/i)
    if (m) panicString = m[1].split('\n')[0]?.trim()
  }

  const mainPanic = classifyMainPanic(panicString)
  const reason =
    panicString && panicString.toLowerCase().includes('smc bsc failure')
      ? 'SMC BSC failure'
      : undefined

  const sourceFile =
    panicString?.match(/\btarget\/[^\s"']+?\.(?:cpp|c|h|mm|m):\d+\b/i)?.[0] ??
    panicString?.match(/\b[A-Za-z0-9_]+\.(?:cpp|c|h|mm|m):\d+\b/i)?.[0]

  const sensorArrays = parseSensorArrays(rawText)

  const extractedTokens: ExtractedToken[] = []
  const seen = new Set<string>()
  const push = (t: ExtractedToken) => {
    const k = `${t.source}:${t.normalizedToken}`
    if (seen.has(k)) return
    seen.add(k)
    extractedTokens.push(t)
  }

  // Manual text tokens always exist (even if full log); used as a fallback.
  for (const t of extractPossibleCodes(rawText)) {
    // Avoid promoting a full log's generic short tokens too much.
    const w = isFullPanicLog ? 0.25 : 1.0
    const source: ExtractedToken['source'] = t.kind === 'hex' ? 'generic_hex' : 'manual_text'
    const norm =
      t.kind === 'hex'
        ? normalizeHexToken(t.raw)
        : t.kind === 'sensor_code'
          ? t.raw.toUpperCase()
          : t.normalized
    push({ token: t.raw, normalizedToken: norm, source, confidenceWeight: w })
  }

  // Sensor array tokens (strong evidence)
  for (const arr of sensorArrays) {
    for (const v of arr.values) {
      if (v.isZero) continue
      if (!/^0x[0-9a-f]+$/i.test(v.normalizedValue)) continue
      push({
        token: v.normalizedValue,
        normalizedToken: normalizeHexToken(v.normalizedValue),
        source: 'sensor_array',
        confidenceWeight: 0.95,
      })
    }
  }

  if (panicString) {
    for (const t of extractFromPanicString(panicString)) push(t)
  }

  for (const t of extractMailboxFourCC(rawText)) push(t)

  return {
    isFullPanicLog,
    product,
    osVersion,
    bugType,
    panicString,
    mainPanic,
    reason,
    sourceFile,
    extraReason: undefined,
    sensorArrays,
    extractedTokens,
    rawText,
  }
}

