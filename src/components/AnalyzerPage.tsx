import { useEffect, useMemo, useState } from 'react'
import type { PanicRule, SearchHit } from '../types/panic'
import { parsePanicLog } from '../lib/panicLogParser'
import { searchDatabase } from '../lib/panicSearch'
import { ResultCard } from './ResultCard'
import { PanicFileUpload } from './PanicFileUpload'

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(t)
  }, [value, delayMs])
  return debounced
}

export function AnalyzerPage({
  rules,
  conflictNormalizedQueries,
  onJumpToDatabaseFilter,
}: {
  rules: PanicRule[]
  conflictNormalizedQueries: Set<string>
  onJumpToDatabaseFilter: (filter: string) => void
}) {
  const [inputText, setInputText] = useState('')
  const [submitted, setSubmitted] = useState<string | null>(null)
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null)

  const debounced = useDebouncedValue(inputText, 250)
  const effectiveText = submitted ?? debounced

  const parsed = useMemo(() => parsePanicLog(effectiveText), [effectiveText])
  const hits: SearchHit[] = useMemo(
    () => searchDatabase(rules, effectiveText, parsed, 50),
    [rules, effectiveText, parsed],
  )

  const onAnalyze = () => setSubmitted(inputText)
  const onClear = () => {
    setInputText('')
    setSubmitted(null)
    setUploadedFilename(null)
  }

  const sensorRows = useMemo(() => {
    if (!parsed.isFullPanicLog) return []
    const rows: Array<{
      array: string
      index: number
      raw: string
      normalized: string
      hit?: SearchHit
    }> = []

    for (const arr of parsed.sensorArrays) {
      for (const v of arr.values) {
        if (v.isZero) continue
        const top = searchDatabase(rules, v.normalizedValue, {
          ...parsed,
          extractedTokens: [
            {
              token: v.normalizedValue,
              normalizedToken: v.normalizedValue,
              source: 'sensor_array',
              confidenceWeight: 0.95,
            },
          ],
        })[0]
        rows.push({
          array: arr.arrayType,
          index: v.index,
          raw: v.rawValue,
          normalized: v.normalizedValue,
          hit: top,
        })
      }
    }
    return rows
  }, [parsed, rules])

  return (
    <div className="page">
      <div className="header">
        <div>
          <div className="title">Panic Analyzer</div>
          <div className="subtitle">Manual input or upload a panic log file</div>
        </div>
        <div className="row gap wrap">
          <button className="btn" onClick={onAnalyze}>
            Analyze
          </button>
          <button className="btn ghost" onClick={onClear}>
            Clear
          </button>
        </div>
      </div>

      <textarea
        className="input"
        value={inputText}
        onChange={(e) => {
          setInputText(e.target.value)
          setSubmitted(null)
        }}
        placeholder="Manual mode: 0X800 · 0X40000 · TG0B · Prs0 · MIC1 · PressureController.cpp:280 … or paste full panic log…"
        rows={7}
      />

      <PanicFileUpload
        filename={uploadedFilename}
        onClear={() => onClear()}
        onLoad={(content, filename) => {
          setUploadedFilename(filename)
          setInputText(content)
          setSubmitted(content)
        }}
      />

      {parsed.isFullPanicLog ? (
        <div className="card">
          <div className="row space wrap">
            <div className="title small">Panic Summary</div>
            <div className="row gap wrap">
              {uploadedFilename ? <span className="badge muted">{uploadedFilename}</span> : null}
              {parsed.mainPanic ? <span className="badge warn">{parsed.mainPanic}</span> : null}
            </div>
          </div>

          <div className="kv">
            <div className="k">Device / product</div>
            <div className="v mono">{parsed.product ?? '—'}</div>
          </div>
          <div className="kv">
            <div className="k">iOS version</div>
            <div className="v mono">{parsed.osVersion ?? '—'}</div>
          </div>
          <div className="kv">
            <div className="k">Bug type</div>
            <div className="v mono">{parsed.bugType ?? '—'}</div>
          </div>
          <div className="kv">
            <div className="k">Main panic</div>
            <div className="v">{parsed.mainPanic ?? '—'}</div>
          </div>
          <div className="kv">
            <div className="k">Reason</div>
            <div className="v">{parsed.reason ?? '—'}</div>
          </div>
          <div className="kv">
            <div className="k">Source file</div>
            <div className="v mono">{parsed.sourceFile ?? '—'}</div>
          </div>
        </div>
      ) : null}

      {parsed.isFullPanicLog ? (
        <div className="card">
          <div className="row space wrap">
            <div className="title small">Extracted sensor arrays</div>
            <div className="small subtle">Non‑zero values are high-confidence tokens.</div>
          </div>

          <div className="tableWrap" style={{ marginTop: 10 }}>
            <table className="table" style={{ minWidth: 700 }}>
              <thead>
                <tr>
                  <th>Array</th>
                  <th className="right">Index</th>
                  <th>Raw</th>
                  <th>Normalized</th>
                  <th>Matched diagnosis</th>
                </tr>
              </thead>
              <tbody>
                {sensorRows.length ? (
                  sensorRows.map((r) => (
                    <tr key={`${r.array}:${r.index}:${r.normalized}`}>
                      <td className="mono">{r.array}</td>
                      <td className="right mono">{r.index}</td>
                      <td className="mono">{r.raw}</td>
                      <td className="mono">{r.normalized}</td>
                      <td>{r.hit?.rule?.diagnosisArea ?? r.hit?.rule?.analysis ?? ''}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="subtle">
                      No non‑zero sensor array values detected.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="warning small" style={{ marginTop: 10 }}>
            Some hex values were found inside mailbox/callstack data and may not be direct panic codes. Sensor array and panicString matches are prioritized.
          </div>
        </div>
      ) : null}

      <div className="row space wrap">
        <div className="small subtle">
          Results: <span className="mono">{hits.length}</span>
          {rules.length ? (
            <>
              {' '}
              / <span className="mono">{rules.length}</span> rules
            </>
          ) : null}
        </div>
        <div className="small subtle">Live search is debounced; “Analyze” forces immediate search.</div>
      </div>

      <div className="stack">
        {hits.length === 0 ? (
          <div className="card">
            <div className="subtle">
              No matches yet. Try a panic code (hex), a keyword like <span className="mono">PressureController.cpp:280</span>, or upload/paste the full log.
            </div>
          </div>
        ) : null}

        {hits.map((h, i) => {
          const hasConflict = conflictNormalizedQueries.has(h.rule.normalizedQuery)
          return (
            <div key={`${h.rule.id}:${h.score}`}>
              <ResultCard hit={h} isTop={i === 0} hasConflict={hasConflict} />
              {hasConflict ? (
                <div className="row gap wrap small subtle" style={{ marginTop: 6 }}>
                  <button className="link" onClick={() => onJumpToDatabaseFilter(h.rule.normalizedQuery)}>
                    Open in Database (filter)
                  </button>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

