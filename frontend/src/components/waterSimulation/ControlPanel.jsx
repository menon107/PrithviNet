import React from 'react';
import WQIPanel from './WQIPanel';

const AQI_MAP_TYPES = [
  { value: 'INDIA_AQI', label: 'India AQI' },
  { value: 'UAQI_RED_GREEN', label: 'UAQI Red-Green' },
  { value: 'UAQI_INDIGO_PERSIAN', label: 'UAQI Indigo-Persian' },
  { value: 'US_AQI', label: 'US AQI' },
];

const s = {
  panel: {
    position: 'absolute', top: 16, right: 16, width: 300,
    background: 'rgba(10,14,20,0.93)', backdropFilter: 'blur(18px)',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16,
    padding: 16, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 14,
    maxHeight: 'calc(100% - 32px)', overflowY: 'auto',
  },
  heading: { fontFamily: "'Space Mono',monospace", fontSize: 10, letterSpacing: 2, color: '#6b7280', textTransform: 'uppercase', marginBottom: 6 },
  label:  { fontSize: 12, color: '#9ca3af', marginBottom: 4 },
  input: { width: '100%', background: '#111620', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e8eaf0', padding: '6px 10px', fontSize: 12, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
  row:    { display: 'flex', gap: 8, alignItems: 'center' },
  btn: (v = 'primary') => ({
    flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontFamily: "'Space Mono',monospace", fontWeight: 700,
    background: v === 'primary' ? '#00d4ff' : v === 'danger' ? '#ef444420' : '#1a2030',
    color: v === 'primary' ? '#0a0e14' : v === 'danger' ? '#ef4444' : '#9ca3af',
  }),
  colorRow:   { display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' },
  colorInput: { width: 32, height: 24, border: 'none', borderRadius: 6, cursor: 'pointer', background: 'none' },
  slider:     { width: '100%', accentColor: '#00d4ff', cursor: 'pointer' },
  tag: (c) => ({ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, background: c + '22', color: c, borderRadius: 20, padding: '2px 8px', fontFamily: "'Space Mono',monospace" }),
  divider:   { borderTop: '1px solid rgba(255,255,255,0.06)', margin: '0 -16px' },
  toggle:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  toggleBtn: (active, c = '#00d4ff') => ({ width: 32, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer', position: 'relative', background: active ? c : '#1a2030', transition: 'background .2s', flexShrink: 0 }),
  toggleKnob: (active) => ({ position: 'absolute', top: 2, left: active ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .2s' }),
};

function ToggleRow({ label, active, onToggle, color = '#00d4ff' }) {
  return (
    <div style={s.toggle}>
      <span style={s.label}>{label}</span>
      <button type="button" style={s.toggleBtn(active, color)} onClick={onToggle}>
        <div style={s.toggleKnob(active)} />
      </button>
    </div>
  );
}

export default function ControlPanel({
  regionConfig, setRegionConfig, onFetch, loading,
  simRunning, setSimRunning, rainActive, setRainActive,
  tickSpeed, setTickSpeed,
  colorConfig, setColorConfig,
  layers, selectedLayer, onSpill, onClean, onResetAll, onApplyWQI,
  stats, fetchReady,
  activeTab = 'water', setActiveTab = () => {}, googleAqiMapType = 'INDIA_AQI', setGoogleAqiMapType = () => {}, hasGoogleAqiKey = false,
}) {
  return (
    <div style={s.panel}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {['water', 'air'].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontFamily: "'Space Mono',monospace", fontWeight: 600,
              background: activeTab === tab ? '#00d4ff' : '#1a2030',
              color: activeTab === tab ? '#0a0e14' : '#9ca3af',
            }}
          >
            {tab === 'water' ? 'Water' : 'Air (Google AQI)'}
          </button>
        ))}
      </div>
      <div style={s.divider} />
      {activeTab === 'water' && (
        <>
      <div>
        <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 12, fontWeight: 700, color: '#00d4ff' }}>Water simulation</div>
        <div style={{ fontSize: 9, color: '#6b7280', marginTop: 2 }}>WQI · Spill &amp; clean</div>
      </div>
      <div style={s.divider} />
      <div>
        <div style={s.heading}>Region &amp; area</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div>
            <div style={s.label}>Mapbox token</div>
            <input style={s.input} type="password" placeholder="pk.eyJ1..." value={regionConfig.token} onChange={e => setRegionConfig(p => ({ ...p, token: e.target.value }))} />
          </div>
          <div style={s.row}>
            <div style={{ flex: 1 }}>
              <div style={s.label}>Lat</div>
              <input style={s.input} type="number" value={regionConfig.lat} onChange={e => setRegionConfig(p => ({ ...p, lat: parseFloat(e.target.value) }))} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={s.label}>Lng</div>
              <input style={s.input} type="number" value={regionConfig.lng} onChange={e => setRegionConfig(p => ({ ...p, lng: parseFloat(e.target.value) }))} />
            </div>
          </div>
          <div style={s.row}>
            <div style={{ flex: 1 }}>
              <div style={s.label}>Span</div>
              <input style={s.input} type="number" step="0.01" value={regionConfig.span} onChange={e => setRegionConfig(p => ({ ...p, span: parseFloat(e.target.value) }))} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={s.label}>Zoom</div>
              <input style={s.input} type="number" value={regionConfig.zoom} onChange={e => setRegionConfig(p => ({ ...p, zoom: parseInt(e.target.value, 10) }))} />
            </div>
          </div>
          <button type="button" style={s.btn('primary')} onClick={onFetch} disabled={loading}>
            {loading ? 'Loading…' : fetchReady ? '▶ Reload' : '▶ Load Water Bodies'}
          </button>
          <div style={{ fontSize: 10, color: '#6b7280', marginTop: 6 }}>Change lat/lng/span/zoom to focus on a specific area.</div>
        </div>
      </div>
      <div style={s.divider} />
      <div>
        <div style={s.heading}>Color scale</div>
        {[{ key: 'clean', label: 'Clean' }, { key: 'mild', label: 'Mild' }, { key: 'moderate', label: 'Moderate' }, { key: 'severe', label: 'Severe' }].map(({ key, label }) => (
          <div key={key} style={{ ...s.colorRow, marginBottom: 6 }}>
            <input type="color" value={colorConfig[key]} style={s.colorInput} onChange={e => setColorConfig(p => ({ ...p, [key]: e.target.value }))} />
            <span style={{ ...s.tag(colorConfig[key]), flex: 2 }}>{label}</span>
          </div>
        ))}
      </div>
      <div style={s.divider} />
      <div>
        <div style={s.heading}>Style</div>
        <div style={s.label}>Width: {regionConfig.baseWidth}px</div>
        <input type="range" min="1" max="12" step="1" style={s.slider} value={regionConfig.baseWidth} onChange={e => setRegionConfig(p => ({ ...p, baseWidth: parseInt(e.target.value, 10) }))} />
        <div style={{ ...s.label, marginTop: 6 }}>Opacity: {Math.round(regionConfig.opacity * 100)}%</div>
        <input type="range" min="0.1" max="1" step="0.05" style={s.slider} value={regionConfig.opacity} onChange={e => setRegionConfig(p => ({ ...p, opacity: parseFloat(e.target.value) }))} />
      </div>
      <div style={s.divider} />
      <div>
        <div style={s.heading}>Simulation</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ToggleRow label="Auto-run" active={simRunning} onToggle={() => setSimRunning(p => !p)} />
          <ToggleRow label="Rain event" active={rainActive} onToggle={() => setRainActive(p => !p)} />
          <div>
            <div style={s.label}>Tick: {tickSpeed}ms</div>
            <input type="range" min="200" max="3000" step="100" style={s.slider} value={tickSpeed} onChange={e => setTickSpeed(parseInt(e.target.value, 10))} />
          </div>
          <button type="button" style={{ ...s.btn(), flex: 'unset', width: '100%' }} onClick={onResetAll}>↺ Reset all</button>
        </div>
      </div>
      {stats && (
        <>
          <div style={s.divider} />
          <div>
            <div style={s.heading}>WQI Stats</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {[{ label: 'Segments', val: stats.total }, { label: 'Degraded', val: stats.degraded, warn: stats.degraded > 0 }, { label: 'Avg WQI', val: stats.avgWQI }, { label: 'Min WQI', val: stats.minWQI, warn: stats.minWQI < 40 }].map(({ label, val, warn }) => (
                <div key={label} style={{ background: '#111620', borderRadius: 8, padding: '6px 8px' }}>
                  <div style={{ fontSize: 9, color: '#6b7280', fontFamily: "'Space Mono',monospace", textTransform: 'uppercase' }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: warn ? '#f97316' : '#e8eaf0', marginTop: 2, fontFamily: "'Space Mono',monospace" }}>{val}</div>
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
              <div style={s.heading}>Selected</div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button type="button" style={{ ...s.btn('danger'), flex: 'unset', padding: '4px 8px', fontSize: 10 }} onClick={onSpill}>Spill</button>
                <button type="button" style={{ ...s.btn(), flex: 'unset', padding: '4px 8px', fontSize: 10 }} onClick={onClean}>Clean</button>
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 10, wordBreak: 'break-word' }}>{selectedLayer.name || selectedLayer.id}</div>
            <WQIPanel layer={selectedLayer} onApply={(params) => onApplyWQI(selectedLayer.id, params)} />
          </div>
        </>
      )}
        </>
      )}
      {activeTab === 'air' && (
        <>
          <div>
            <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 12, fontWeight: 700, color: '#00d4ff' }}>Google Air Quality</div>
            <div style={{ fontSize: 9, color: '#6b7280', marginTop: 2 }}>Heatmap overlay on map</div>
          </div>
          <div style={s.divider} />
          <div>
            <div style={s.heading}>Layer</div>
            {hasGoogleAqiKey ? (
              <>
                <div style={s.label}>Map type</div>
                <select
                  style={{ ...s.input, marginBottom: 8 }}
                  value={googleAqiMapType}
                  onChange={(e) => setGoogleAqiMapType(e.target.value)}
                >
                  {AQI_MAP_TYPES.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <div style={{ fontSize: 10, color: '#6b7280' }}>Load the map from the Water tab first; the AQI layer will then show on the map when you’re on this tab.</div>
              </>
            ) : (
              <div style={{ fontSize: 11, color: '#f97316' }}>Set REACT_APP_GOOGLE_AQI_KEY in .env to enable Google AQI tiles.</div>
            )}
          </div>
          <div style={s.divider} />
          <div>
            <div style={s.heading}>Area</div>
            <div style={{ fontSize: 10, color: '#6b7280' }}>Use the same region controls in the Water tab (lat, lng, span, zoom) to change the map area; the AQI layer follows the map view.</div>
          </div>
        </>
      )}
    </div>
  );
}
