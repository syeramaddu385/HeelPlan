import { COLORS } from './CourseList'

// Grid window: 8:00 AM (480) to 9:00 PM (1260)
const GRID_START = 480
const GRID_END   = 1260
const GRID_RANGE = GRID_END - GRID_START

const DAYS   = ['M', 'T', 'W', 'H', 'F']
const LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI']

// Time labels every 60 minutes
const TIME_LABELS = []
for (let m = GRID_START; m <= GRID_END; m += 60) {
  const h = Math.floor(m / 60)
  const ampm = h >= 12 ? 'PM' : 'AM'
  TIME_LABELS.push({ min: m, label: `${h > 12 ? h - 12 : h}${ampm}` })
}

// Map day characters to column index
const DAY_COL = { M: 0, T: 1, W: 2, H: 3, F: 4 }

export default function ScheduleGrid({ sections, courseColors }) {
  // Build blocks: one block per (section × day)
  const blocks = []
  sections.forEach((sec) => {
    if (!sec.days || sec.start_min == null) return
    const color = courseColors[sec.course] || 'var(--carolina)'
    const uniqueDays = [...new Set(sec.days.split(''))]
    uniqueDays.forEach(d => {
      const col = DAY_COL[d]
      if (col === undefined) return
      blocks.push({ ...sec, col, color })
    })
  })

  const toPercent = (min) => ((min - GRID_START) / GRID_RANGE) * 100

  return (
    <div style={{ display: 'flex', gap: 0, height: 480, fontSize: 11 }}>
      {/* Time axis */}
      <div style={{ width: 44, flexShrink: 0, position: 'relative', paddingTop: 28 }}>
        {TIME_LABELS.map(({ min, label }) => (
          <div key={min} style={{
            position: 'absolute',
            top: `calc(28px + ${toPercent(min)}%)`,
            right: 8,
            color: 'var(--text-muted)',
            fontSize: 10,
            transform: 'translateY(-50%)',
            whiteSpace: 'nowrap',
          }}>{label}</div>
        ))}
      </div>

      {/* Day columns */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
        {DAYS.map((day, i) => (
          <div key={day} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {/* Header */}
            <div style={{
              height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', letterSpacing: '0.1em', fontSize: 10, fontWeight: 500,
            }}>{LABELS[i]}</div>

            {/* Column body */}
            <div style={{
              flex: 1, position: 'relative',
              background: 'var(--bg-elevated)',
              borderRadius: 6,
              border: '1px solid var(--border)',
              overflow: 'hidden',
            }}>
              {/* Hour grid lines */}
              {TIME_LABELS.map(({ min }) => min > GRID_START && (
                <div key={min} style={{
                  position: 'absolute', left: 0, right: 0,
                  top: `${toPercent(min)}%`,
                  borderTop: '1px solid var(--border)',
                  pointerEvents: 'none',
                }} />
              ))}

              {/* Section blocks */}
              {blocks.filter(b => b.col === i).map((b, j) => {
                const top    = toPercent(Math.max(b.start_min, GRID_START))
                const bottom = toPercent(Math.min(b.end_min,   GRID_END))
                const height = bottom - top
                return (
                  <div key={j} style={{
                    position: 'absolute', left: 2, right: 2,
                    top: `${top}%`, height: `${height}%`,
                    background: b.color + '26',
                    border: `1px solid ${b.color}88`,
                    borderLeft: `3px solid ${b.color}`,
                    borderRadius: 4,
                    padding: '3px 5px',
                    overflow: 'hidden',
                    cursor: 'default',
                  }}>
                    <div style={{ color: b.color, fontWeight: 500, lineHeight: 1.3, fontSize: 10 }}>
                      {b.course}
                    </div>
                    {height > 8 && (
                      <div style={{ color: 'var(--text-dim)', fontSize: 9, marginTop: 1 }}>
                        §{b.section}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
