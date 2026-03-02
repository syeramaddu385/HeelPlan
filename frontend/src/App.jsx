import { useState } from 'react'
import CourseSearch from './components/CourseSearch'
import CourseList from './components/CourseList'
import Preferences from './components/Preferences'
import ScheduleCard from './components/ScheduleCard'
import { buildSchedule } from './api'

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

  const addCourse    = (c) => setCourses(p => [...p, c])
  const removeCourse = (c) => setCourses(p => p.filter(x => x !== c))

  const handleBuild = async () => {
    if (courses.length === 0) return
    setLoading(true)
    setError(null)
    setSchedules([])
    try {
      const result = await buildSchedule(courses, prefs)
      setSchedules(result)
      if (result.length === 0) setError('No conflict-free schedules found. Try removing a course or adjusting preferences.')
    } catch (e) {
      setError(e.response?.data?.detail || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* ── Left panel ── */}
      <div style={{
        width: 320, flexShrink: 0, height: '100%', overflowY: 'auto',
        borderRight: '1px solid var(--border)',
        padding: '32px 24px',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 36 }}>
          <h1 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 28, fontWeight: 600, lineHeight: 1.1,
            color: 'var(--text)',
          }}>
            Heel<span style={{ color: 'var(--carolina)' }}>'</span>s<br />
            <span style={{ fontStyle: 'italic', fontWeight: 300 }}>Schedule</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 6 }}>
            UNC Chapel Hill · Spring 2026
          </p>
        </div>

        <Section title="Courses">
          <div style={{ marginBottom: 10 }}>
            <CourseSearch onAdd={addCourse} selectedCourses={courses} />
          </div>
          <CourseList courses={courses} onRemove={removeCourse} />
        </Section>

        <Section title="Preferences">
          <Preferences prefs={prefs} onChange={setPrefs} />
        </Section>

        <div style={{ marginTop: 'auto' }}>
          <button
            onClick={handleBuild}
            disabled={courses.length === 0 || loading}
            style={{
              width: '100%', padding: '11px 0',
              background: courses.length === 0 ? 'var(--bg-elevated)' : 'var(--carolina)',
              color: courses.length === 0 ? 'var(--text-muted)' : '#fff',
              borderRadius: 'var(--radius)',
              fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase',
              fontWeight: 500, transition: 'all 0.2s',
              cursor: courses.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Building...' : 'Build Schedule'}
          </button>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 32px' }}>
        {schedules.length === 0 && !loading && !error && (
          <div style={{
            height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12,
          }}>
            <p style={{
              fontFamily: 'var(--font-serif)', fontStyle: 'italic',
              fontSize: 32, color: 'var(--text-muted)', fontWeight: 300,
            }}>No schedules yet.</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              Add courses and hit Build Schedule.
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
              textTransform: 'uppercase', marginBottom: 16,
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
