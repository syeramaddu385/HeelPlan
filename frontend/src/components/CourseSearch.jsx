import { useState, useEffect, useRef } from 'react'
import { searchCourses } from '../api'

export default function CourseSearch({ onAdd, selectedCourses }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!query.trim()) { setResults([]); setOpen(false); return }
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const courses = await searchCourses(query)
        setResults(courses)
        setOpen(true)
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (course) => {
    if (!selectedCourses.includes(course)) onAdd(course)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '8px 12px',
        transition: 'border-color 0.2s',
      }}
        onFocus={() => results.length && setOpen(true)}
      >
        <span style={{ color: 'var(--carolina)', fontSize: 12 }}>›</span>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search courses — COMP 210, MATH..."
          style={{
            background: 'none', border: 'none', flex: 1,
            color: 'var(--text)', fontSize: 13, letterSpacing: '0.02em',
          }}
        />
        {loading && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>...</span>}
      </div>

      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-bright)',
          borderRadius: 'var(--radius)',
          zIndex: 100, maxHeight: 220, overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          {results.map(course => {
            const already = selectedCourses.includes(course)
            return (
              <div
                key={course}
                onClick={() => !already && handleSelect(course)}
                style={{
                  padding: '8px 14px',
                  cursor: already ? 'default' : 'pointer',
                  color: already ? 'var(--text-muted)' : 'var(--text)',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!already) e.currentTarget.style.background = 'var(--carolina-dim)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <span>{course}</span>
                {already && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>added</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
