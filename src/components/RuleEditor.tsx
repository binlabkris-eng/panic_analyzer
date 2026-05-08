import { useState } from 'react'
import type { PanicRule } from '../types/panic'
import { normalizeQueryForIndex } from '../lib/panicNormalize'

function parseTags(s: string) {
  return s
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

export function RuleEditor({
  initial,
  onCancel,
  onSave,
}: {
  initial: PanicRule
  onCancel: () => void
  onSave: (rule: PanicRule) => void
}) {
  const [rule, setRule] = useState<PanicRule>(initial)
  const [tags, setTags] = useState(() => (initial.tags ?? []).join(', '))

  const update = <K extends keyof PanicRule>(k: K, v: PanicRule[K]) => setRule((r) => ({ ...r, [k]: v }))

  return (
    <div className="modal">
      <div className="card">
        <div className="row space">
          <div className="title small">Rule editor</div>
          <div className="row gap">
            <button className="btn ghost" onClick={onCancel}>
              Cancel
            </button>
            <button
              className="btn"
              onClick={() => onSave({ ...rule, tags: parseTags(tags) })}
            >
              Save
            </button>
          </div>
        </div>

        <div className="grid2">
          <label className="field">
            <div className="k">ID</div>
            <input className="text" value={rule.id} onChange={(e) => update('id', e.target.value)} />
          </label>

          <label className="field">
            <div className="k">Confidence / source</div>
            <input
              className="text"
              value={rule.confidence ?? ''}
              onChange={(e) => update('confidence', e.target.value || undefined)}
              placeholder="bot_database / verified / ..."
            />
          </label>

          <label className="field">
            <div className="k">Query (panic code / token)</div>
            <input
              className="text mono"
              value={rule.query}
              onChange={(e) => {
                const q = e.target.value
                update('query', q)
                update('normalizedQuery', normalizeQueryForIndex(q))
              }}
              placeholder="0X40000 / PressureController.cpp:280 / TG0B ..."
            />
          </label>

          <label className="field">
            <div className="k">Normalized query</div>
            <input
              className="text mono"
              value={rule.normalizedQuery}
              onChange={(e) => update('normalizedQuery', e.target.value)}
            />
          </label>
        </div>

        <div className="grid2">
          <label className="field">
            <div className="k">Diagnosis area</div>
            <input
              className="text"
              value={rule.diagnosisArea ?? ''}
              onChange={(e) => update('diagnosisArea', e.target.value || undefined)}
              placeholder="Charging Port Flex / Battery / Screen ..."
            />
          </label>

          <label className="field">
            <div className="k">Path</div>
            <input
              className="text"
              value={rule.path ?? ''}
              onChange={(e) => update('path', e.target.value || undefined)}
              placeholder="SMC PANIC - ASSERTION > Sensor array (1)"
            />
          </label>

          <label className="field">
            <div className="k">Category</div>
            <input
              className="text"
              value={rule.category ?? ''}
              onChange={(e) => update('category', e.target.value || undefined)}
            />
          </label>

          <label className="field">
            <div className="k">Subcategory</div>
            <input
              className="text"
              value={rule.subcategory ?? ''}
              onChange={(e) => update('subcategory', e.target.value || undefined)}
            />
          </label>
        </div>

        <label className="field">
          <div className="k">Analysis / result</div>
          <textarea
            className="text"
            value={rule.analysis}
            onChange={(e) => update('analysis', e.target.value)}
            rows={4}
            placeholder="It’s the Charging Port Flex"
          />
        </label>

        <label className="field">
          <div className="k">Tags (comma separated)</div>
          <input className="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="charging, flex" />
        </label>

        <label className="field">
          <div className="k">Manual notes</div>
          <textarea
            className="text"
            value={rule.manualNotes ?? ''}
            onChange={(e) => update('manualNotes', e.target.value || undefined)}
            rows={3}
          />
        </label>
      </div>
    </div>
  )
}

