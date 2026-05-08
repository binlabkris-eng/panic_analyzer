import { useMemo, useRef, useState } from 'react'
import type { PanicDb, PanicRule } from '../types/panic'
import { normalizeDbFromUnknown, exportDbAsJson } from '../lib/panicData'
import { RuleEditor } from './RuleEditor'

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function includesAny(hay: string, needle: string) {
  const n = needle.trim().toLowerCase()
  if (!n) return true
  return hay.toLowerCase().includes(n)
}

function ruleToSearchText(r: PanicRule) {
  return [
    r.id,
    r.query,
    r.normalizedQuery,
    r.analysis,
    r.diagnosisArea,
    r.path,
    r.category,
    r.subcategory,
    ...(r.tags ?? []),
    r.confidence,
    r.source,
    r.manualNotes,
  ]
    .filter(Boolean)
    .join(' ')
}

export function DatabasePage({
  db,
  setDb,
  onResetToBundled,
  filter,
  setFilter,
}: {
  db: PanicDb
  setDb: (db: PanicDb) => void
  onResetToBundled: () => Promise<void>
  filter: string
  setFilter: (s: string) => void
}) {
  const [editing, setEditing] = useState<PanicRule | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase()
    if (!f) return db.rules
    return db.rules.filter((r) => includesAny(ruleToSearchText(r), f))
  }, [db.rules, filter])

  const onDelete = (id: string) => {
    if (!confirm(`Delete rule ${id}?`)) return
    setDb({ ...db, rules: db.rules.filter((r) => r.id !== id) })
  }

  const onAdd = () => {
    const nowId = `new:${Date.now()}`
    setEditing({
      id: nowId,
      query: '',
      normalizedQuery: '',
      analysis: '',
      tags: [],
    })
  }

  const onImportClick = () => fileRef.current?.click()

  const onImportFile = async (file: File) => {
    const text = await file.text()
    const parsed = JSON.parse(text) as unknown
    const imported = normalizeDbFromUnknown(parsed)
    setDb(imported)
  }

  const onExport = () => {
    downloadText('panic_analyzer_mvp_data.json', exportDbAsJson(db))
  }

  return (
    <div className="page">
      <div className="header">
        <div>
          <div className="title">Database</div>
          <div className="subtitle">Edit rules locally (saved in your browser localStorage)</div>
        </div>
        <div className="row gap wrap">
          <button className="btn" onClick={onAdd}>
            Add rule
          </button>
          <button className="btn ghost" onClick={onExport}>
            Export updated JSON
          </button>
          <button className="btn ghost" onClick={onImportClick}>
            Import JSON
          </button>
          <button className="btn danger" onClick={() => void onResetToBundled()}>
            Reset to bundled database
          </button>
        </div>
      </div>

      <input
        className="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter rules by code, path, tags, analysis..."
      />

      <div className="row space wrap small subtle">
        <div>
          Showing <span className="mono">{filtered.length}</span> /{' '}
          <span className="mono">{db.rules.length}</span>
        </div>
        <div className="mono">Bundle: `/public/data/panic_analyzer_mvp_data.json`</div>
      </div>

      <div className="tableWrap">
        <table className="table">
          <thead>
            <tr>
              <th>Query</th>
              <th>Diagnosis area</th>
              <th>Path</th>
              <th>Tags</th>
              <th className="right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td className="mono">{r.query}</td>
                <td>{r.diagnosisArea ?? ''}</td>
                <td className="mono">{r.path ?? ''}</td>
                <td>{(r.tags ?? []).join(', ')}</td>
                <td className="right">
                  <button className="link" onClick={() => setEditing(r)}>
                    edit
                  </button>{' '}
                  <button className="link dangerText" onClick={() => onDelete(r.id)}>
                    delete
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="subtle">
                  No rules match this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (!f) return
          void onImportFile(f)
          e.target.value = ''
        }}
      />

      {editing ? (
        <RuleEditor
          initial={editing}
          onCancel={() => setEditing(null)}
          onSave={(rule) => {
            setEditing(null)
            const exists = db.rules.some((r) => r.id === rule.id)
            setDb({
              ...db,
              rules: exists ? db.rules.map((r) => (r.id === rule.id ? rule : r)) : [rule, ...db.rules],
            })
          }}
        />
      ) : null}
    </div>
  )
}

