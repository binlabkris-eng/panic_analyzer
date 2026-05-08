import type React from 'react'
import type { PanicRule, SearchHit } from '../types/panic'
import { getSuggestedDiagnosticStart } from '../lib/panicSuggestions'

function Badge({ children, tone }: { children: React.ReactNode; tone?: 'muted' | 'good' | 'warn' }) {
  return <span className={`badge ${tone ?? 'muted'}`}>{children}</span>
}

export function ResultCard({
  hit,
  isTop,
  hasConflict,
}: {
  hit: SearchHit
  isTop: boolean
  hasConflict: boolean
}) {
  const r: PanicRule = hit.rule

  return (
    <div className={`card result ${isTop ? 'top' : ''}`}>
      <div className="row space">
        <div className="mono big">{r.query || r.normalizedQuery}</div>
        <div className="row gap">
          <Badge tone={isTop ? 'good' : 'muted'}>score {hit.score}</Badge>
          {hasConflict ? <Badge tone="warn">conflict</Badge> : null}
        </div>
      </div>

      {r.diagnosisArea ? (
        <div className="kv">
          <div className="k">Likely area</div>
          <div className="v">{r.diagnosisArea}</div>
        </div>
      ) : null}

      {r.analysis ? (
        <div className="kv">
          <div className="k">Analysis</div>
          <div className="v">{r.analysis}</div>
        </div>
      ) : null}

      {r.path || r.category || r.subcategory ? (
        <div className="kv">
          <div className="k">Path</div>
          <div className="v">
            {r.path ?? [r.category, r.subcategory].filter(Boolean).join(' > ')}
          </div>
        </div>
      ) : null}

      <div className="kv">
        <div className="k">Suggested diagnostic start</div>
        <div className="v subtle">{getSuggestedDiagnosticStart(r)}</div>
      </div>

      <div className="row space wrap">
        <div className="row gap wrap">
          {(r.tags ?? []).slice(0, 12).map((t) => (
            <Badge key={t}>{t}</Badge>
          ))}
        </div>
        <div className="row gap wrap">
          {r.confidence ? <Badge tone="muted">{r.confidence}</Badge> : null}
          {r.source ? <Badge tone="muted">{r.source}</Badge> : null}
          {typeof r.verified === 'boolean' ? (
            <Badge tone={r.verified ? 'good' : 'muted'}>{r.verified ? 'verified' : 'unverified'}</Badge>
          ) : null}
        </div>
      </div>

      {hit.reasons?.length ? (
        <div className="small subtle">Match: {hit.reasons.join(' · ')}</div>
      ) : null}

      {hasConflict ? (
        <div className="warning small">
          Multiple possible meanings found. Check path/category and panic context.
        </div>
      ) : null}
    </div>
  )
}

