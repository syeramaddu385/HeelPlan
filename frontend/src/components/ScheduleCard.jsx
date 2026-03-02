import { useState } from 'react'
import ScheduleGrid from './ScheduleGrid'
import { COLORS } from './CourseList'

const fmtTime = (min) => {
  if (min == null) return '—'
  const h = Math.floor(min / 60), m = min % 60
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h > 12 ? h - 12 : h || 12}:${m.toString().padStart(2,'0')} ${ampm}`
}

const Star = ({ filled }) => (
  <span style={{ color: filled ? 'var(--gold)' : 'var(--text-muted)', fontSize: 12 }}>★</span>
)

export default function ScheduleCard({ schedule, rank, courseList }) {
  const [expanded, setExpanded] = useState(rank === 0)

  // Map course name → color
  const courseColors = Object.fromEntries(courseList.map((c, i) => [c, COLORS[i % COLORS.length]]))

  const score = schedule.score
  const stars = Math.round((score / 10) * 5)

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      transition: 'border-color 0.2s',
      animation: `fadeSlideIn 0.3s ease both`,
      animationDelay: `${rank * 80}ms`,
    }}>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header */}
      <div
        onClick={() => setExpanded(v => !v)}
        style={{
          padding: '14px 18px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', cursor: 'pointer',
          borderBottom: expanded ? '1px solid var(--border)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontFamily: 'var(--font-serif)', fontSize: 11, color: 'var(--text-muted)',
            fontStyle: 'italic', minWidth: 20,
          }}>#{rank + 1}</span>
          <div style={{ display: 'flex', gap: 2 }}>
            {[...Array(5)].map((_, i) => <Star key={i} filled={i < stars} />)}
          </div>
          <span style={{
            fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--gold)',
            fontWeight: 600,
          }}>{score.toFixed(1)}</span>
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: 16, transition: 'transform 0.2s', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>›</span>
      </div>

      {expanded && (
        <div style={{ padding: '18px' }}>
          {/* Calendar grid */}
          <ScheduleGrid sections={schedule.sections} courseColors={courseColors} />

          {/* Section details */}
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {schedule.sections.map((sec, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '90px 1fr 1fr auto',
                gap: 12, alignItems: 'center',
                padding: '8px 12px',
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius)',
                borderLeft: `3px solid ${courseColors[sec.course] || 'var(--carolina)'}`,
              }}>
                <span style={{ color: courseColors[sec.course], fontWeight: 500 }}>{sec.course}</span>
                <span style={{ color: 'var(--text-dim)' }}>{sec.instructor || 'TBA'}</span>
                <span style={{ color: 'var(--text-dim)' }}>{sec.schedule || 'TBA'}</span>
                <span style={{ color: 'var(--gold)', fontSize: 11, textAlign: 'right' }}>
                  {sec.avg_quality != null ? `★ ${sec.avg_quality.toFixed(1)}` : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
