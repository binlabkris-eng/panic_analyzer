import { useMemo, useState } from 'react'
import type { PanicRule } from '../types/panic'

type Node = {
  name: string
  fullPath: string
  count: number
  children: Node[]
}

function incPathCount(map: Map<string, number>, path: string) {
  map.set(path, (map.get(path) ?? 0) + 1)
}

function buildTreeFromRules(rules: PanicRule[]): Node[] {
  const countByPath = new Map<string, number>()
  for (const r of rules) {
    const p = r.path ?? [r.category, r.subcategory].filter(Boolean).join(' > ')
    if (!p) continue
    incPathCount(countByPath, p)
  }

  const root: Node = { name: '__root__', fullPath: '', count: 0, children: [] }

  const ensureChild = (parent: Node, name: string, fullPath: string) => {
    let n = parent.children.find((c) => c.name === name)
    if (!n) {
      n = { name, fullPath, count: 0, children: [] }
      parent.children.push(n)
    }
    return n
  }

  for (const [path, count] of countByPath.entries()) {
    const parts = path.split('>').map((p) => p.trim()).filter(Boolean)
    let cur = root
    let acc = ''
    for (const part of parts) {
      acc = acc ? `${acc} > ${part}` : part
      cur = ensureChild(cur, part, acc)
    }
    cur.count += count
  }

  const sortNode = (n: Node) => {
    n.children.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    for (const c of n.children) sortNode(c)
  }
  sortNode(root)

  return root.children
}

function TreeNode({
  node,
  depth,
  expanded,
  toggle,
  onSelectPath,
}: {
  node: Node
  depth: number
  expanded: Set<string>
  toggle: (p: string) => void
  onSelectPath: (path: string) => void
}) {
  const isOpen = expanded.has(node.fullPath)
  const hasKids = node.children.length > 0
  return (
    <div>
      <div className="treeRow" style={{ paddingLeft: depth * 14 }}>
        <button
          className="treeToggle"
          onClick={() => (hasKids ? toggle(node.fullPath) : onSelectPath(node.fullPath))}
          title={hasKids ? (isOpen ? 'Collapse' : 'Expand') : 'Filter rules by this path'}
        >
          {hasKids ? (isOpen ? '▾' : '▸') : '•'}
        </button>
        <button className="treeLink" onClick={() => onSelectPath(node.fullPath)}>
          <span className="mono">{node.name}</span>
        </button>
        <span className="badge muted">{node.count}</span>
      </div>
      {hasKids && isOpen ? (
        <div>
          {node.children.map((c) => (
            <TreeNode
              key={c.fullPath}
              node={c}
              depth={depth + 1}
              expanded={expanded}
              toggle={toggle}
              onSelectPath={onSelectPath}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function TreePage({
  rules,
  onSelectPath,
}: {
  rules: PanicRule[]
  onSelectPath: (path: string) => void
}) {
  const tree = useMemo(() => buildTreeFromRules(rules), [rules])
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  const toggle = (p: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  return (
    <div className="page">
      <div className="header">
        <div>
          <div className="title">Tree</div>
          <div className="subtitle">Browse categories/paths and filter rules quickly</div>
        </div>
      </div>

      <div className="card">
        {tree.length === 0 ? (
          <div className="subtle">No path/category data yet (or no rules loaded).</div>
        ) : (
          tree.map((n) => (
            <TreeNode
              key={n.fullPath}
              node={n}
              depth={0}
              expanded={expanded}
              toggle={toggle}
              onSelectPath={onSelectPath}
            />
          ))
        )}
      </div>
    </div>
  )
}

