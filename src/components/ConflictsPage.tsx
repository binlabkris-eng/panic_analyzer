import { useMemo } from 'react'
import type { PanicRule } from '../types/panic'
import { detectConflicts } from '../lib/panicConflicts'

export function ConflictsPage({
  rules,
  onJumpToDatabaseFilter,
}: {
  rules: PanicRule[]
  onJumpToDatabaseFilter: (filter: string) => void
}) {
  const conflicts = useMemo(() => detectConflicts(rules), [rules])

  return (
    <div className="page">
      <div className="header">
        <div>
          <div className="title">Conflicts</div>
          <div className="subtitle">Automatically detected: same code, different meanings</div>
        </div>
      </div>

      {conflicts.length === 0 ? (
        <div className="card">
          <div className="subtle">No conflicts detected.</div>
        </div>
      ) : (
        <div className="stack">
          {conflicts.map((c) => (
            <div key={c.normalizedQuery} className="card">
              <div className="row space wrap">
                <div>
                  <div className="mono big">{c.normalizedQuery}</div>
                  <div className="small warningText">
                    Differs by: {c.differingFields.join(', ')}
                  </div>
                </div>
                <button className="btn ghost" onClick={() => onJumpToDatabaseFilter(c.normalizedQuery)}>
                  Open in Database (filter)
                </button>
              </div>

              <div className="tableWrap" style={{ marginTop: 10 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Query</th>
                      <th>Diagnosis area</th>
                      <th>Analysis</th>
                      <th>Path</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.rules.map((r: PanicRule) => (
                      <tr key={r.id}>
                        <td className="mono">{r.query}</td>
                        <td>{r.diagnosisArea ?? ''}</td>
                        <td>{r.analysis}</td>
                        <td className="mono">{r.path ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="warning small" style={{ marginTop: 10 }}>
                Multiple possible meanings found. Check path/category and panic context.
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

