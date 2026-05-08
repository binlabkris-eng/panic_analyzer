import type { PanicRule } from '../types/panic'

function norm(s?: string) {
  return (s ?? '').toLowerCase()
}

export function getSuggestedDiagnosticStart(rule: PanicRule): string {
  const area = norm(rule.diagnosisArea)
  const tags = (rule.tags ?? []).map((t) => t.toLowerCase())
  const hay = `${area} ${tags.join(' ')}`

  if (hay.includes('charging') || hay.includes('charge') || hay.includes('port') || hay.includes('usb')) {
    return 'Start with known-good charging port flex, connector inspection, corrosion check and related board-side lines.'
  }
  if (hay.includes('proximity') || hay.includes('front sensor') || hay.includes('true depth') || hay.includes('face id')) {
    return 'Start with known-good proximity/front sensor flex, connector inspection and liquid damage around the connector area.'
  }
  if (hay.includes('battery') || hay.includes('gas gauge') || hay.includes('pp_batt')) {
    return 'Start with known-good battery, battery data line checks, connector inspection and gas gauge communication verification.'
  }
  if (hay.includes('screen') || hay.includes('display') || hay.includes('touch') || hay.includes('lcd') || hay.includes('oled')) {
    return 'Start with known-good screen, display connector inspection and related touch/display line verification around the connector area.'
  }
  if (hay.includes('sandwich') || hay.includes('interposer') || hay.includes('layer') || hay.includes('stack')) {
    return 'Start with interposer/sandwich inspection: separation history, connection integrity and board-to-board contact verification.'
  }

  return 'Use the matched analysis as repair direction and confirm with measurement, known-good parts and visual inspection.'
}

