import { useCallback, useMemo, useRef, useState } from 'react'

const ACCEPT_EXT = ['.ips', '.txt', '.json', '.log']
const MAX_BYTES = 20 * 1024 * 1024

function extOk(name: string) {
  const n = name.toLowerCase()
  return ACCEPT_EXT.some((e) => n.endsWith(e))
}

export function PanicFileUpload({
  onLoad,
  onClear,
  filename,
}: {
  onLoad: (content: string, filename: string) => void
  onClear: () => void
  filename: string | null
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [drag, setDrag] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)

  const helper = useMemo(
    () => `Accepted: ${ACCEPT_EXT.join(', ')} · Local-only (FileReader) · Max ${Math.round(MAX_BYTES / (1024 * 1024))} MB`,
    [],
  )

  const readFile = useCallback(
    (file: File) => {
      setWarning(null)
      if (!extOk(file.name)) {
        setWarning(`Unsupported file type. Accepted: ${ACCEPT_EXT.join(', ')}`)
        return
      }
      if (file.size > MAX_BYTES) {
        setWarning(`File is large (${Math.round(file.size / (1024 * 1024))} MB). It may be slow in the browser.`)
      }
      const reader = new FileReader()
      reader.onerror = () => setWarning('Failed to read file in browser.')
      reader.onload = () => {
        const text = typeof reader.result === 'string' ? reader.result : ''
        onLoad(text, file.name)
      }
      reader.readAsText(file)
    },
    [onLoad],
  )

  const onPick = () => inputRef.current?.click()

  return (
    <div className="card">
      <div className="row space wrap">
        <div>
          <div className="title small">Upload panic file</div>
          <div className="subtitle">{helper}</div>
        </div>
        <div className="row gap wrap">
          <button className="btn ghost" onClick={onPick}>
            {filename ? 'Replace file' : 'Upload panic file'}
          </button>
          {filename ? (
            <button className="btn ghost" onClick={onClear}>
              Remove
            </button>
          ) : null}
        </div>
      </div>

      <div
        className={`drop ${drag ? 'drag' : ''}`}
        onDragEnter={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDrag(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDrag(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDrag(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDrag(false)
          const f = e.dataTransfer.files?.[0]
          if (f) readFile(f)
        }}
      >
        <div className="subtle small">
          Drag & drop a panic log here, or use the button above.
        </div>
        {filename ? <div className="mono" style={{ marginTop: 6 }}>Loaded: {filename}</div> : null}
        {warning ? <div className="warning small" style={{ marginTop: 10 }}>{warning}</div> : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_EXT.join(',')}
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) readFile(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

