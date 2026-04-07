import { useState, useEffect } from 'react'
import CourseSearch from './components/CourseSearch'
import CourseList from './components/CourseList'
import Preferences from './components/Preferences'
import ScheduleCard from './components/ScheduleCard'
import Chatbot from './components/Chatbot'
import ConstraintsPanel from './components/ConstraintsPanel'
import { buildSchedule, getConstraints, deleteConstraint } from './api'

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 28 }}>
    <p style={{
      fontFamily: 'var(--font-serif)', fontStyle: 'italic',
      color: 'var(--text-muted)', fontSize: 11, letterSpacing: '0.1em',
      textTransform: 'uppercase', marginBottom: 12,
    }}>{title}</p>
    {children}
  </div>
)

export default function App() {
  const [courses, setCourses]       = useState([])
  const [prefs, setPrefs]           = useState({ avoid_before: 480, avoid_after: 1140, days_off: [] })
  const [schedules, setSchedules]   = useState([])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [constraints, setConstraints] = useState([])
  const [showChat, setShowChat]     = useState(true)

  const derivePrefsFromConstraints = (constraintList, basePrefs) => {
    const updated = { ...basePrefs }
    const earliestStarts = constraintList
      .filter(c => c.constraint_type === 'earliest_start' && c.earliest_start)
      .map(c => c.earliest_start)
    const latestEnds = constraintList
      .filter(c => c.constraint_type === 'latest_end' && c.latest_end)
      .map(c => c.latest_end)
    const daysOff = constraintList
      .filter(c => c.constraint_type === 'days_off' && c.days_of_week)
      .flatMap(c => c.days_of_week || [])

    if (earliestStarts.length) {
      updated.avoid_before = Math.max(...earliestStarts)
    }
    if (latestEnds.length) {
      updated.avoid_after = Math.min(...latestEnds)
    }
    if (daysOff.length) {
      updated.days_off = Array.from(new Set([...(updated.days_off || []), ...daysOff]))
    }

    return updated
  }

  // Load constraints on mount
  useEffect(() => {
    loadConstraints()
  }, [])

  const loadConstraints = async () => {
    try {
      const data = await getConstraints()
      setConstraints(data)
      setPrefs(prev => derivePrefsFromConstraints(data, prev))
    } catch (e) {
      console.error('Failed to load constraints:', e)
    }
  }

  const addCourse    = (c) => setCourses(p => [...p, c])
  const removeCourse = (c) => setCourses(p => p.filter(x => x !== c))

  const handleBuild = async (overridePrefs) => {
    if (courses.length === 0) return
    setLoading(true)
    setError(null)
    setSchedules([])
    try {
      const schedulePrefs = overridePrefs || prefs
      const result = await buildSchedule(courses, schedulePrefs)
      setSchedules(result)
      if (result.length === 0) setError('No conflict-free schedules found. Try removing a course or adjusting preferences.')
    } catch (e) {
      setError(e.response?.data?.detail || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const handleConstraintsUpdate = async (newConstraints) => {
    const derived = derivePrefsFromConstraints(newConstraints, prefs)
    setConstraints(newConstraints)
    setPrefs(derived)
    if (courses.length > 0) {
      await handleBuild(derived)
    }
  }

  const handleDeleteConstraint = async (id) => {
    try {
      await deleteConstraint(id)
      const updatedConstraints = constraints.filter(c => c.id !== id)
      const derived = derivePrefsFromConstraints(updatedConstraints, prefs)
      setConstraints(updatedConstraints)
      setPrefs(derived)
      if (courses.length > 0) {
        await handleBuild(derived)
      }
    } catch (e) {
      console.error('Failed to delete constraint:', e)
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', gap: '16px', padding: '16px' }}>

      {/* ── Left panel: Input ── */}
      <div style={{
        width: 300, flexShrink: 0, height: '100%', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: '16px',
      }}>
        {/* Logo */}
        <div>
          <h1 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 24, fontWeight: 600, lineHeight: 1.1,
            color: 'var(--text)',
            margin: 0, marginBottom: '4px',
          }}>
            Heel<span style={{ color: 'var(--carolina)' }}>Plan</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 10, margin: 0 }}>
            Spring 2026
          </p>
        </div>

        {/* Courses */}
        <div>
          <p style={{
            fontFamily: 'var(--font-serif)', fontStyle: 'italic',
            color: 'var(--text-muted)', fontSize: 10, letterSpacing: '0.08em',
            textTransform: 'uppercase', marginBottom: 8, margin: '0 0 8px 0',
          }}>Courses</p>
          <div style={{ marginBottom: 8 }}>
            <CourseSearch onAdd={addCourse} selectedCourses={courses} />
          </div>
          <CourseList courses={courses} onRemove={removeCourse} />
        </div>

        {/* Basic preferences */}
        <div>
          <p style={{
            fontFamily: 'var(--font-serif)', fontStyle: 'italic',
            color: 'var(--text-muted)', fontSize: 10, letterSpacing: '0.08em',
            textTransform: 'uppercase', marginBottom: 8, margin: '0 0 8px 0',
          }}>Quick Preferences</p>
          <Preferences prefs={prefs} onChange={setPrefs} />
        </div>

        {/* Build button */}
        <button
          onClick={handleBuild}
          disabled={courses.length === 0 || loading}
          style={{
            padding: '10px 0',
            background: courses.length === 0 ? 'var(--bg-elevated)' : 'var(--carolina)',
            color: courses.length === 0 ? 'var(--text-muted)' : '#fff',
            borderRadius: 'var(--radius)',
            fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase',
            fontWeight: 500, transition: 'all 0.2s', border: 'none',
            cursor: courses.length === 0 ? 'not-allowed' : 'pointer',
            marginTop: 'auto',
          }}
        >
          {loading ? 'Building...' : 'Build Schedule'}
        </button>
      </div>

      {/* ── Center panel: Chat + Constraints ── */}
      <div style={{
        width: 320, flexShrink: 0, height: '100%', display: 'flex', flexDirection: 'column', gap: '16px',
      }}>
        {/* Chatbot */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <Chatbot onConstraintsUpdate={handleConstraintsUpdate} />
        </div>

        {/* Constraints Panel */}
        <div style={{ maxHeight: '40%', overflowY: 'auto' }}>
          <ConstraintsPanel constraints={constraints} onDelete={handleDeleteConstraint} />
        </div>
      </div>

      {/* ── Right panel: Schedules ── */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {schedules.length === 0 && !loading && !error && (
          <div style={{
            height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12,
          }}>
            <p style={{
              fontFamily: 'var(--font-serif)', fontStyle: 'italic',
              fontSize: 32, color: 'var(--text-muted)', fontWeight: 300, margin: 0,
            }}>No schedules yet.</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>
              Add courses and click Build Schedule.
            </p>
          </div>
        )}

        {error && (
          <div style={{
            padding: '14px 18px',
            background: 'rgba(255,107,107,0.08)',
            border: '1px solid rgba(255,107,107,0.3)',
            borderRadius: 'var(--radius)',
            color: 'var(--danger)', fontSize: 13,
          }}>{error}</div>
        )}

        {schedules.length > 0 && (
          <>
            <p style={{
              fontFamily: 'var(--font-serif)', fontStyle: 'italic',
              color: 'var(--text-muted)', fontSize: 11, letterSpacing: '0.1em',
              textTransform: 'uppercase', marginBottom: 16, margin: '0 0 16px 0',
            }}>
              {schedules.length} schedule{schedules.length > 1 ? 's' : ''} found — ranked by quality
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {schedules.map((s, i) => (
                <ScheduleCard key={i} schedule={s} rank={i} courseList={courses} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
