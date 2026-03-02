const DAYS = ['M', 'T', 'W', 'H', 'F']
const DAY_LABELS = { M: 'Mon', T: 'Tue', W: 'Wed', H: 'Thu', F: 'Fri' }

const fmtTime = (min) => {
  const h = Math.floor(min / 60)
  const m = min % 60
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h > 12 ? h - 12 : h || 12}:${m.toString().padStart(2,'0')} ${ampm}`
}

export default function Preferences({ prefs, onChange }) {
  const set = (key, val) => onChange({ ...prefs, [key]: val })

  const toggleDay = (day) => {
    const off = new Set(prefs.days_off || [])
    off.has(day) ? off.delete(day) : off.add(day)
    set('days_off', [...off])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Earliest start */}
      <div>
        <label style={{ color: 'var(--text-dim)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Earliest start — <span style={{ color: 'var(--carolina)' }}>{fmtTime(prefs.avoid_before ?? 480)}</span>
        </label>
        <input type="range" min={480} max={780} step={30}
          value={prefs.avoid_before ?? 480}
          onChange={e => set('avoid_before', +e.target.value)}
          style={{ width: '100%', marginTop: 8, accentColor: 'var(--carolina)' }}
        />
      </div>

      {/* Latest end */}
      <div>
        <label style={{ color: 'var(--text-dim)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Latest end — <span style={{ color: 'var(--carolina)' }}>{fmtTime(prefs.avoid_after ?? 1140)}</span>
        </label>
        <input type="range" min={840} max={1260} step={30}
          value={prefs.avoid_after ?? 1140}
          onChange={e => set('avoid_after', +e.target.value)}
          style={{ width: '100%', marginTop: 8, accentColor: 'var(--carolina)' }}
        />
      </div>

      {/* Days off */}
      <div>
        <label style={{ color: 'var(--text-dim)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
          Days off
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          {DAYS.map(day => {
            const active = (prefs.days_off || []).includes(day)
            return (
              <button key={day} onClick={() => toggleDay(day)} style={{
                flex: 1, padding: '6px 0', borderRadius: 'var(--radius)',
                fontSize: 11, letterSpacing: '0.06em',
                background: active ? 'var(--carolina-dim)' : 'var(--bg-elevated)',
                border: `1px solid ${active ? 'var(--carolina)' : 'var(--border)'}`,
                color: active ? 'var(--carolina)' : 'var(--text-dim)',
                transition: 'all 0.15s',
              }}>
                {DAY_LABELS[day]}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
