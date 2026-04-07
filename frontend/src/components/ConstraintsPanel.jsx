import { useState } from 'react'

const formatTime = (min) => {
  if (min == null) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h > 12 ? h - 12 : h || 12}:${m.toString().padStart(2, '0')} ${ampm}`
}

const dayLabels = {
  M: 'Mon',
  T: 'Tue',
  W: 'Wed',
  H: 'Thu',
  F: 'Fri',
  S: 'Sat',
  U: 'Sun',
}

const constraintTypeLabels = {
  earliest_start: 'Earliest Start',
  latest_end: 'Latest End',
  days_off: 'Days Off',
  blocked_time: 'Blocked Time',
  recurring_activity: 'Activity',
  soft_preference: 'Preference',
}

export default function ConstraintsPanel({ constraints = [], onDelete }) {
  const [expandedId, setExpandedId] = useState(null)

  if (!constraints || constraints.length === 0) {
    return (
      <div style={{
        padding: '16px',
        background: 'var(--bg-elevated)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        color: 'var(--text-muted)',
        fontSize: '13px',
        textAlign: 'center',
      }}>
        No active constraints. Use the chat assistant to add scheduling rules.
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}>
      <p style={{
        fontFamily: 'var(--font-serif)',
        fontStyle: 'italic',
        color: 'var(--text-muted)',
        fontSize: 11,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        marginBottom: '4px',
      }}>
        Active Constraints ({constraints.length})
      </p>

      {constraints.map((constraint) => (
        <div
          key={constraint.id}
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            onClick={() => setExpandedId(expandedId === constraint.id ? null : constraint.id)}
            style={{
              padding: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-elevated)',
              borderBottom: expandedId === constraint.id ? '1px solid var(--border)' : 'none',
              transition: 'background 0.2s',
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-card)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
          >
            <div style={{ flex: 1 }}>
              <div style={{
                fontWeight: 500,
                color: 'var(--text-primary)',
                fontSize: '13px',
                marginBottom: '4px',
              }}>
                {constraint.title}
              </div>
              <div style={{
                display: 'flex',
                gap: '8px',
                fontSize: '11px',
                color: 'var(--text-muted)',
              }}>
                <span style={{
                  padding: '2px 6px',
                  background: constraint.is_hard_constraint
                    ? 'rgba(220, 53, 69, 0.1)'
                    : 'rgba(40, 167, 69, 0.1)',
                  color: constraint.is_hard_constraint ? '#dc3545' : '#28a745',
                  borderRadius: '3px',
                  fontSize: '10px',
                  fontWeight: 500,
                }}>
                  {constraint.is_hard_constraint ? 'Hard' : 'Soft'}
                </span>
                <span>
                  {constraintTypeLabels[constraint.constraint_type] || constraint.constraint_type}
                </span>
                {constraint.source && (
                  <span style={{ color: 'var(--text-dim)' }}>
                    from {constraint.source}
                  </span>
                )}
              </div>
            </div>
            <div style={{
              fontSize: '16px',
              color: 'var(--text-muted)',
              transform: expandedId === constraint.id ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
            }}>
              ›
            </div>
          </div>

          {/* Details */}
          {expandedId === constraint.id && (
            <div style={{ padding: '12px', fontSize: '12px', color: 'var(--text-dim)' }}>
              {constraint.description && (
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontWeight: 500, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Description
                  </div>
                  {constraint.description}
                </div>
              )}

              {constraint.days_of_week && constraint.days_of_week.length > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontWeight: 500, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Days
                  </div>
                  {constraint.days_of_week.map(d => dayLabels[d] || d).join(', ')}
                </div>
              )}

              {constraint.time_range && (
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontWeight: 500, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Time
                  </div>
                  {formatTime(constraint.time_range.start_min)} – {formatTime(constraint.time_range.end_min)}
                </div>
              )}

              {constraint.earliest_start && (
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontWeight: 500, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Earliest Start
                  </div>
                  {formatTime(constraint.earliest_start)}
                </div>
              )}

              {constraint.latest_end && (
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontWeight: 500, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Latest End
                  </div>
                  {formatTime(constraint.latest_end)}
                </div>
              )}

              {constraint.recurrence_type && (
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontWeight: 500, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Recurrence
                  </div>
                  {constraint.recurrence_type === 'once' ? 'One-time' : 'Weekly'}
                </div>
              )}

              {constraint.priority && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontWeight: 500, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Priority
                  </div>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    {[...Array(10)].map((_, i) => (
                      <div
                        key={i}
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: i < constraint.priority ? 'var(--carolina)' : 'var(--border)',
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => onDelete && onDelete(constraint.id)}
                style={{
                  padding: '6px 12px',
                  background: 'rgba(220, 53, 69, 0.1)',
                  color: '#dc3545',
                  border: '1px solid rgba(220, 53, 69, 0.3)',
                  borderRadius: 'var(--radius)',
                  fontSize: '11px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(220, 53, 69, 0.2)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(220, 53, 69, 0.1)'}
              >
                Remove
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
