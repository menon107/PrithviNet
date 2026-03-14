export default function Legend({ colorConfig }) {
  const items = [
    { key: 'clean',    label: 'Clean',    range: '0–25%' },
    { key: 'mild',     label: 'Mild',     range: '25–50%' },
    { key: 'moderate', label: 'Moderate', range: '50–75%' },
    { key: 'severe',   label: 'Severe',   range: '75–100%' },
  ]

  return (
    <div style={{
      position: 'absolute', bottom: 40, left: 16, zIndex: 10,
      background: 'rgba(10,14,20,0.88)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
      padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 7,
    }}>
      <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, letterSpacing: 2, color: '#6b7280', textTransform: 'uppercase', marginBottom: 2 }}>
        Pollution level
      </div>
      {items.map(({ key, label, range }) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 4, borderRadius: 2, background: colorConfig[key] }} />
          <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: "'Space Mono',monospace" }}>
            {label}
          </span>
          <span style={{ fontSize: 10, color: '#4b5563', marginLeft: 'auto', paddingLeft: 8 }}>
            {range}
          </span>
        </div>
      ))}
    </div>
  )
}
