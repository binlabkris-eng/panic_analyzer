import { useEffect, useMemo, useState } from 'react'
import type { PanicDb } from './types/panic'
import { clearLocalStorageDb, loadBundledDb, loadDbFromLocalStorage, saveDbToLocalStorage } from './lib/panicData'
import { detectConflicts } from './lib/panicConflicts'
import { AnalyzerPage } from './components/AnalyzerPage'
import { DatabasePage } from './components/DatabasePage'
import { TreePage } from './components/TreePage'
import { ConflictsPage } from './components/ConflictsPage'

type Tab = 'analyzer' | 'database' | 'tree' | 'conflicts'

export default function App() {
  const localDb = loadDbFromLocalStorage()

  const [tab, setTab] = useState<Tab>('analyzer')
  const [db, setDb] = useState<PanicDb>(localDb ?? { rules: [], tree: [], conflicts: [] })
  const [loading, setLoading] = useState(!localDb)
  const [error, setError] = useState<string | null>(null)

  const [dbFilter, setDbFilter] = useState('')

  const conflicts = useMemo(() => detectConflicts(db.rules), [db.rules])
  const conflictSet = useMemo(() => new Set(conflicts.map((c) => c.normalizedQuery)), [conflicts])

  useEffect(() => {
    if (localDb) return
    void (async () => {
      try {
        setLoading(true)
        setDb(await loadBundledDb())
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    })()
  }, [localDb])

  // Persist edits to localStorage
  useEffect(() => {
    if (loading) return
    saveDbToLocalStorage(db)
  }, [db, loading])

  const resetToBundled = async () => {
    clearLocalStorageDb()
    setLoading(true)
    try {
      setDb(await loadBundledDb())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const usingLocalEdits = !!localDb

  const jumpToDatabaseFilter = (filter: string) => {
    setDbFilter(filter)
    setTab('database')
  }

  const jumpToPath = (path: string) => {
    setDbFilter(path)
    setTab('database')
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <div className="brandTitle">Panic Analyzer</div>
          <div className="brandSub">iPhone panic code lookup (local MVP)</div>
        </div>
        <nav className="tabs">
          <button className={`tab ${tab === 'analyzer' ? 'active' : ''}`} onClick={() => setTab('analyzer')}>
            Analyzer
          </button>
          <button className={`tab ${tab === 'database' ? 'active' : ''}`} onClick={() => setTab('database')}>
            Database
          </button>
          <button className={`tab ${tab === 'tree' ? 'active' : ''}`} onClick={() => setTab('tree')}>
            Tree
          </button>
          <button className={`tab ${tab === 'conflicts' ? 'active' : ''}`} onClick={() => setTab('conflicts')}>
            Conflicts
            {conflicts.length ? <span className="pill">{conflicts.length}</span> : null}
          </button>
        </nav>
      </div>

      <div className="container">
        {!loading && !error ? (
          <div className="row space wrap small subtle" style={{ marginBottom: 10 }}>
            <div>
              Loaded rules: <span className="mono">{db.rules.length}</span>
              {usingLocalEdits ? (
                <span className="badge warn" style={{ marginLeft: 8 }}>
                  using localStorage edits
                </span>
              ) : (
                <span className="badge muted" style={{ marginLeft: 8 }}>
                  using bundled JSON
                </span>
              )}
            </div>
            {usingLocalEdits ? (
              <button className="btn ghost" onClick={() => void resetToBundled()}>
                Reload bundled JSON (reset local)
              </button>
            ) : null}
          </div>
        ) : null}

        {loading ? (
          <div className="card">
            <div className="subtle">Loading database…</div>
          </div>
        ) : error ? (
          <div className="card">
            <div className="warning">Failed to load database: {error}</div>
            <div className="small subtle" style={{ marginTop: 8 }}>
              Expected file: <span className="mono">/public/data/panic_analyzer_mvp_data.json</span> (loaded via{' '}
              <span className="mono">fetch('/data/panic_analyzer_mvp_data.json')</span>)
            </div>
          </div>
        ) : tab === 'analyzer' ? (
          <AnalyzerPage rules={db.rules} conflictNormalizedQueries={conflictSet} onJumpToDatabaseFilter={jumpToDatabaseFilter} />
        ) : tab === 'database' ? (
          <DatabasePage db={db} setDb={setDb} onResetToBundled={resetToBundled} filter={dbFilter} setFilter={setDbFilter} />
        ) : tab === 'tree' ? (
          <TreePage rules={db.rules} onSelectPath={jumpToPath} />
        ) : (
          <ConflictsPage rules={db.rules} onJumpToDatabaseFilter={jumpToDatabaseFilter} />
        )}

        <footer className="footer">
          <div className="small subtle">
            This tool gives repair direction based on collected panic patterns. Always confirm with measurement, known-good parts,
            visual inspection and board-level diagnostics.
          </div>
        </footer>
      </div>
    </div>
  )
}
