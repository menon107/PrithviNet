import { useState } from 'react'
import WQIPanel from './WQIPanel.jsx'

// ── India AQI helpers (CPCB scale 0-500) ─────────────────────────────────────
function aqiColor(aqi) {
  if (!aqi && aqi !== 0) return '#6b7280'
  if (aqi <= 50)  return '#22c55e'
  if (aqi <= 100) return '#a3e635'
  if (aqi <= 200) return '#eab308'
  if (aqi <= 300) return '#f97316'
  if (aqi <= 400) return '#ef4444'
  return '#9f1239'
}
function aqiLabel(aqi) {
  if (!aqi && aqi !== 0) return 'N/A'
  if (aqi <= 50)  return 'Good'
  if (aqi <= 100) return 'Satisfactory'
  if (aqi <= 200) return 'Moderate'
  if (aqi <= 300) return 'Poor'
  if (aqi <= 400) return 'Very Poor'
  return 'Severe'
}

// ── Sparkline chart (past 24h history + next 24h forecast) ───────────────────
function SparkChart({ history = [], forecast = [] }) {
  const all = [...history, ...forecast]
  if (all.length < 2) return null

  const W = 262, H = 72
  const aqis   = all.map(d => d.aqi ?? 0)
  const maxVal = Math.max(...aqis, 200)

  const toXY = (d, i) => {
    const x = (i / (all.length - 1)) * W
    const y = H - Math.max(4, ((d.aqi ?? 0) / maxVal) * (H - 8))
    return [x, y]
  }

  const histPts = history.map((d, i) => toXY(d, i).join(',')).join(' ')
  const jIdx    = history.length - 1
  const jPt     = jIdx >= 0 ? toXY(history[jIdx], jIdx) : [0, H]
  const forecastPts = [
    jPt.join(','),
    ...forecast.map((d, i) => toXY(d, history.length + i).join(',')),
  ].join(' ')

  const nowX = jPt[0]

  // AQI zone bands (subtle)
  const zones = [
    { max: 50,  color: '#22c55e' },
    { max: 100, color: '#a3e635' },
    { max: 200, color: '#eab308' },
    { max: 300, color: '#f97316' },
    { max: 400, color: '#ef4444' },
  ]

  return (
    <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
      {/* Subtle horizontal zone ticks */}
      {[100, 200, 300].map(v => {
        const y = H - (v / maxVal) * (H - 8)
        return y > 0 && y < H ? (
          <g key={v}>
            <line x1={0} y1={y} x2={W} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
            <text x={W - 2} y={y - 2} textAnchor="end" fill="#374151" fontSize={8} fontFamily="Space Mono">{v}</text>
          </g>
        ) : null
      })}

      {/* History line — solid cyan */}
      {history.length > 1 && (
        <polyline points={histPts} fill="none" stroke="#00d4ff" strokeWidth={2} strokeLinejoin="round" />
      )}

      {/* Forecast line — dashed purple */}
      {forecast.length > 0 && (
        <polyline
          points={forecastPts}
          fill="none" stroke="#a78bfa" strokeWidth={2}
          strokeDasharray="5,3" strokeLinejoin="round"
        />
      )}

      {/* "Now" vertical marker */}
      <line x1={nowX} y1={0} x2={nowX} y2={H} stroke="rgba(255,255,255,0.18)" strokeWidth={1} strokeDasharray="3,2" />
      <text x={nowX + 3} y={9} fill="#6b7280" fontSize={8} fontFamily="Space Mono">now</text>

      {/* Dots on current and last forecast */}
      {jIdx >= 0 && (
        <circle cx={jPt[0]} cy={jPt[1]} r={3} fill="#00d4ff" />
      )}
      {forecast.length > 0 && (() => {
        const last = toXY(forecast[forecast.length - 1], history.length + forecast.length - 1)
        return <circle cx={last[0]} cy={last[1]} r={3} fill="#a78bfa" />
      })()}
    </svg>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const s = {
  panel: {
    position: 'absolute', top: 16, right: 16, width: 310,
    background: 'rgba(10,14,20,0.93)', backdropFilter: 'blur(18px)',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16,
    padding: 20, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 18,
    maxHeight: 'calc(100vh - 32px)', overflowY: 'auto',
  },
  heading: {
    fontFamily: "'Space Mono',monospace", fontSize: 10, letterSpacing: 2,
    color: '#6b7280', textTransform: 'uppercase', marginBottom: 8,
  },
  label:  { fontSize: 12, color: '#9ca3af', marginBottom: 4 },
  input: {
    width: '100%', background: '#111620', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, color: '#e8eaf0', padding: '8px 10px', fontSize: 13, outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box',
  },
  select: {
    background: '#111620', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8, color: '#e8eaf0', padding: '7px 10px', fontSize: 12,
    fontFamily: "'Space Mono',monospace", outline: 'none', cursor: 'pointer', flex: 1,
  },
  row:    { display: 'flex', gap: 8, alignItems: 'center' },
  btn: (v = 'primary') => ({
    flex: 1, padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontSize: 12, fontFamily: "'Space Mono',monospace", fontWeight: 700,
    background: v === 'primary' ? '#00d4ff' : v === 'danger' ? '#ef444420' : '#1a2030',
    color: v === 'primary' ? '#0a0e14' : v === 'danger' ? '#ef4444' : '#9ca3af',
  }),
  colorRow:   { display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' },
  colorInput: { width: 36, height: 28, border: 'none', borderRadius: 6, cursor: 'pointer', background: 'none' },
  slider:     { width: '100%', accentColor: '#00d4ff', cursor: 'pointer' },
  tag: (c) => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11,
    background: c + '22', color: c, borderRadius: 20, padding: '3px 10px',
    fontFamily: "'Space Mono',monospace",
  }),
  divider:   { borderTop: '1px solid rgba(255,255,255,0.06)', margin: '0 -20px' },
  toggle:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  toggleBtn: (active, c = '#00d4ff') => ({
    width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
    position: 'relative', background: active ? c : '#1a2030', transition: 'background .2s', flexShrink: 0,
  }),
  toggleKnob: (active) => ({
    position: 'absolute', top: 2, left: active ? 18 : 2, width: 16, height: 16,
    borderRadius: '50%', background: '#fff', transition: 'left .2s',
  }),
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 14, padding: '2px 4px' },
}

function TabBtn({ label, active, onClick, accent }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
      fontSize: 12, fontFamily: "'Space Mono',monospace", fontWeight: 700,
      background: active ? accent + '20' : 'transparent',
      color: active ? accent : '#4b5563',
      borderBottom: active ? `2px solid ${accent}` : '2px solid transparent',
      transition: 'all .2s',
    }}>
      {label}
    </button>
  )
}

function ToggleRow({ label, active, onToggle, color = '#00d4ff' }) {
  return (
    <div style={s.toggle}>
      <span style={s.label}>{label}</span>
      <button style={s.toggleBtn(active, color)} onClick={onToggle}>
        <div style={s.toggleKnob(active)} />
      </button>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function ControlPanel({
  activeTab, setActiveTab,
  // Water
  regionConfig, setRegionConfig, onFetch, loading,
  simRunning, setSimRunning, rainActive, setRainActive,
  tickSpeed, setTickSpeed,
  colorConfig, setColorConfig,
  layers, selectedLayer, onSpill, onClean, onResetAll, onApplyWQI,
  stats, fetchReady,
  // Air
  gAQIData, gAQILoading, gAQIError, showGAQI, setShowGAQI, onRefreshGAQI,
  aqMapType, setAqMapType,
  selectedCity, hourlyData, hourlyLoading, onCityClick,
}) {
  // eslint-disable-next-line no-unused-vars
  const [spillAmount, setSpillAmount] = useState(0.5)

  return (
    <div style={s.panel}>

      {/* Header */}
      <div>
        <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 17, fontWeight: 700, color: '#00d4ff', letterSpacing: -0.5 }}>
          PrithviNet
        </div>
        <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2, letterSpacing: 1 }}>
          ENVIRONMENTAL MONITOR · CHHATTISGARH
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: '#0d1117', borderRadius: 10, padding: 4 }}>
        <TabBtn label="💧  Water"       active={activeTab === 'water'} onClick={() => setActiveTab('water')} accent="#00d4ff" />
        <TabBtn label="🌫  Air Quality" active={activeTab === 'air'}   onClick={() => setActiveTab('air')}   accent="#a78bfa" />
      </div>

      <div style={s.divider} />

      {/* ══ WATER TAB ══════════════════════════════════════════════════════ */}
      {activeTab === 'water' && (
        <>
          <div>
            <div style={s.heading}>Region</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <div style={s.label}>Mapbox Token</div>
                <input style={s.input} type="password" placeholder="pk.eyJ1..."
                  value={regionConfig.token}
                  onChange={e => setRegionConfig(p => ({ ...p, token: e.target.value }))} />
              </div>
              <div style={s.row}>
                <div style={{ flex: 1 }}>
                  <div style={s.label}>Latitude</div>
                  <input style={s.input} type="number" value={regionConfig.lat}
                    onChange={e => setRegionConfig(p => ({ ...p, lat: parseFloat(e.target.value) }))} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={s.label}>Longitude</div>
                  <input style={s.input} type="number" value={regionConfig.lng}
                    onChange={e => setRegionConfig(p => ({ ...p, lng: parseFloat(e.target.value) }))} />
                </div>
              </div>
              <div style={s.row}>
                <div style={{ flex: 1 }}>
                  <div style={s.label}>Span (°)</div>
                  <input style={s.input} type="number" step="0.01" value={regionConfig.span}
                    onChange={e => setRegionConfig(p => ({ ...p, span: parseFloat(e.target.value) }))} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={s.label}>Zoom</div>
                  <input style={s.input} type="number" value={regionConfig.zoom}
                    onChange={e => setRegionConfig(p => ({ ...p, zoom: parseInt(e.target.value) }))} />
                </div>
              </div>
              <button style={s.btn('primary')} onClick={onFetch} disabled={loading}>
                {loading ? 'Loading…' : fetchReady ? '▶  Reload' : '▶  Load Water Bodies'}
              </button>
            </div>
          </div>

          <div style={s.divider} />

          <div>
            <div style={s.heading}>Pollution Color Scale</div>
            {[
              { key: 'clean',    label: 'Clean    (0–25%)' },
              { key: 'mild',     label: 'Mild     (25–50%)' },
              { key: 'moderate', label: 'Moderate (50–75%)' },
              { key: 'severe',   label: 'Severe   (75–100%)' },
            ].map(({ key, label }) => (
              <div key={key} style={{ ...s.colorRow, marginBottom: 8 }}>
                <input type="color" value={colorConfig[key]} style={s.colorInput}
                  onChange={e => setColorConfig(p => ({ ...p, [key]: e.target.value }))} />
                <span style={{ ...s.tag(colorConfig[key]), flex: 2 }}>{label}</span>
              </div>
            ))}
          </div>

          <div style={s.divider} />

          <div>
            <div style={s.heading}>Highlight Style</div>
            <div style={s.label}>Base width: {regionConfig.baseWidth}px</div>
            <input type="range" min="1" max="12" step="1" style={s.slider}
              value={regionConfig.baseWidth}
              onChange={e => setRegionConfig(p => ({ ...p, baseWidth: parseInt(e.target.value) }))} />
            <div style={{ ...s.label, marginTop: 8 }}>Opacity: {Math.round(regionConfig.opacity * 100)}%</div>
            <input type="range" min="0.1" max="1" step="0.05" style={s.slider}
              value={regionConfig.opacity}
              onChange={e => setRegionConfig(p => ({ ...p, opacity: parseFloat(e.target.value) }))} />
          </div>

          <div style={s.divider} />

          <div>
            <div style={s.heading}>Simulation</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <ToggleRow label="Auto-run"      active={simRunning}  onToggle={() => setSimRunning(p => !p)} />
              <ToggleRow label="Rain event 🌧" active={rainActive}  onToggle={() => setRainActive(p => !p)} />
              <div>
                <div style={s.label}>Tick speed: {tickSpeed}ms</div>
                <input type="range" min="200" max="3000" step="100" style={s.slider}
                  value={tickSpeed} onChange={e => setTickSpeed(parseInt(e.target.value))} />
              </div>
              <div style={s.divider} />
              <button style={{ ...s.btn(), flex: 'unset', width: '100%' }} onClick={onResetAll}>↺ Reset all to Pristine</button>
            </div>
          </div>

          {stats && (
            <>
              <div style={s.divider} />
              <div>
                <div style={s.heading}>Live Stats · WQI</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'Segments', val: stats.total },
                    { label: 'Degraded',  val: stats.degraded, warn: stats.degraded > 0 },
                    { label: 'Avg WQI',  val: stats.avgWQI },
                    { label: 'Min WQI',  val: stats.minWQI, warn: stats.minWQI < 40 },
                  ].map(({ label, val, warn }) => (
                    <div key={label} style={{ background: '#111620', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ fontSize: 10, color: '#6b7280', fontFamily: "'Space Mono',monospace", textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: warn ? '#f97316' : '#e8eaf0', marginTop: 2, fontFamily: "'Space Mono',monospace" }}>{val}</div>
                    </div>
                  ))}
                </div>
                {/* WQI legend */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                  {[['≥80','Pristine','#22d3ee'],['≥60','Good','#a3e635'],['≥40','Fair','#facc15'],['≥20','Poor','#fb923c'],['<20','Critical','#ef4444']].map(([r,l,c]) => (
                    <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: '#6b7280', fontFamily: "'Space Mono',monospace" }}>
                      <div style={{ width: 8, height: 3, borderRadius: 1, background: c }} />{l}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {selectedLayer && (
            <>
              <div style={s.divider} />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={s.heading} >Selected Segment</div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <button style={{ ...s.btn('danger'), flex: 'unset', padding: '5px 10px', fontSize: 10 }} onClick={onSpill}>
                      💧 Spill
                    </button>
                    <button style={{ ...s.btn(), flex: 'unset', padding: '5px 10px', fontSize: 10 }} onClick={onClean}>
                      ✨ Clean
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 12, wordBreak: 'break-word' }}>
                  {selectedLayer.name || selectedLayer.id}
                </div>
                <WQIPanel layer={selectedLayer} onApply={(params) => onApplyWQI(selectedLayer.id, params)} />
              </div>
            </>
          )}
        </>
      )}

      {/* ══ AIR QUALITY TAB ════════════════════════════════════════════════ */}
      {activeTab === 'air' && (
        <>
          {/* Google AQI map layer controls */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={s.heading}>Google AQI · Live Heatmap</div>
              <button style={s.toggleBtn(showGAQI, '#a78bfa')} onClick={() => setShowGAQI(v => !v)}>
                <div style={s.toggleKnob(showGAQI)} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <div style={{ ...s.label, marginBottom: 0, whiteSpace: 'nowrap' }}>Map type</div>
              <select style={s.select} value={aqMapType} onChange={e => setAqMapType(e.target.value)}>
                <option value="INDIA_AQI">India AQI</option>
                <option value="UAQI_RED_GREEN">Universal (Red–Green)</option>
                <option value="UAQI_INDIGO_PERSIAN">Universal (Indigo)</option>
                <option value="US_AQI">US AQI</option>
              </select>
            </div>

            {/* AQI scale legend */}
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {[
                ['≤50',  'Good',         '#22c55e'],
                ['≤100', 'Satisfactory', '#a3e635'],
                ['≤200', 'Moderate',     '#eab308'],
                ['≤300', 'Poor',         '#f97316'],
                ['≤400', 'Very Poor',    '#ef4444'],
                ['400+', 'Severe',       '#9f1239'],
              ].map(([range, label, color]) => (
                <div key={range} title={`${range}: ${label}`} style={{
                  display: 'flex', alignItems: 'center', gap: 3, fontSize: 9,
                  color: '#6b7280', fontFamily: "'Space Mono',monospace", marginBottom: 2,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div style={s.divider} />

          {/* City AQI table */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={s.heading}>City Readings · India AQI</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button onClick={onRefreshGAQI} disabled={gAQILoading} title="Refresh" style={s.iconBtn}>↻</button>
              </div>
            </div>

            {gAQILoading && <div style={{ fontSize: 11, color: '#6b7280', fontFamily: "'Space Mono',monospace" }}>Fetching from Google…</div>}
            {gAQIError && !gAQILoading && <div style={{ fontSize: 11, color: '#f97316', lineHeight: 1.5 }}>{gAQIError}</div>}

            {gAQIData && !gAQILoading && (
              <>
                <div style={{ fontSize: 10, color: '#4b5563', fontFamily: "'Space Mono',monospace", marginBottom: 8 }}>
                  {new Date(gAQIData.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {' · '}click a city for hourly trend
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {gAQIData.cities.map(city => {
                    const isSelected = selectedCity?.name === city.name
                    return (
                      <button
                        key={city.name}
                        onClick={() => onCityClick(city)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          background: isSelected ? '#1a1f2e' : '#111620',
                          border: isSelected ? '1px solid rgba(167,139,250,0.4)' : '1px solid transparent',
                          borderRadius: 8, padding: '6px 10px', cursor: 'pointer', width: '100%',
                          transition: 'all .15s',
                        }}
                      >
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: 12, color: '#e8eaf0' }}>{city.name}</div>
                          <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>{city.category}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: aqiColor(city.aqi), fontFamily: "'Space Mono',monospace" }}>
                            {city.aqi ?? '—'}
                          </div>
                          <div style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: aqiColor(city.aqi), fontFamily: "'Space Mono',monospace" }}>
                            {aqiLabel(city.aqi)}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          {/* Hourly chart for selected city */}
          {selectedCity && (
            <>
              <div style={s.divider} />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={s.heading}>{selectedCity.name} · 24 h + Forecast</div>
                  {hourlyLoading && (
                    <div style={{ fontSize: 10, color: '#6b7280', fontFamily: "'Space Mono',monospace" }}>loading…</div>
                  )}
                </div>

                {hourlyData && !hourlyLoading && (
                  <>
                    {/* Sparkline */}
                    <div style={{ background: '#0d1117', borderRadius: 8, padding: '10px 8px 6px', marginBottom: 8 }}>
                      <SparkChart history={hourlyData.history} forecast={hourlyData.forecast} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 16, height: 2, background: '#00d4ff', borderRadius: 1 }} />
                          <span style={{ fontSize: 9, color: '#6b7280', fontFamily: "'Space Mono',monospace" }}>history</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 16, height: 2, background: '#a78bfa', borderRadius: 1, borderTop: '1px dashed #a78bfa' }} />
                          <span style={{ fontSize: 9, color: '#6b7280', fontFamily: "'Space Mono',monospace" }}>forecast</span>
                        </div>
                      </div>
                    </div>

                    {/* Next 6 hours forecast table */}
                    {hourlyData.forecast.length > 0 && (
                      <>
                        <div style={{ ...s.heading, marginBottom: 6 }}>Next 6 Hours</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {hourlyData.forecast.slice(0, 6).map(f => {
                            const time = new Date(f.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            return (
                              <div key={f.dateTime} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                background: '#111620', borderRadius: 6, padding: '5px 10px',
                              }}>
                                <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: "'Space Mono',monospace" }}>{time}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontSize: 10, color: '#6b7280' }}>{f.category}</span>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: aqiColor(f.aqi), fontFamily: "'Space Mono',monospace", minWidth: 32, textAlign: 'right' }}>
                                    {f.aqi ?? '—'}
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </>
                    )}

                    {hourlyData.forecast.length === 0 && (
                      <div style={{ fontSize: 11, color: '#6b7280' }}>Forecast not available for this location.</div>
                    )}
                  </>
                )}

                {!hourlyData && !hourlyLoading && (
                  <div style={{ fontSize: 11, color: '#6b7280' }}>No data available.</div>
                )}
              </div>
            </>
          )}
        </>
      )}

    </div>
  )
}
