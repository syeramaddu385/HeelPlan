const COLORS = ['#4B9CD3','#FF6B6B','#51CF66','#FFD43B','#CC5DE8','#FF922B','#20C997','#74C0FC']

export { COLORS }

export default function CourseList({ courses, onRemove }) {
  if (courses.length === 0) return (
    <p style={{ color: 'var(--text-muted)', fontSize: 12, padding: '10px 0' }}>
      No courses added yet.
    </p>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {courses.map((course, i) => (
        <div key={course} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderLeft: `3px solid ${COLORS[i % COLORS.length]}`,
          borderRadius: 'var(--radius)',
          padding: '7px 12px',
        }}>
          <span style={{ color: 'var(--text)', letterSpacing: '0.04em' }}>{course}</span>
          <button
            onClick={() => onRemove(course)}
            style={{
              background: 'none', color: 'var(--text-muted)',
              fontSize: 16, lineHeight: 1, padding: '0 2px',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >×</button>
        </div>
      ))}
    </div>
  )
}
