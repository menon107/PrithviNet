import React, { useState, useEffect } from 'react';
import { PARAMS, computeWQI, wqiToColor, wqiGrade, defaultParams, PRESETS } from './simulation/wqi';

const s = {
  heading: { fontFamily: "'Space Mono',monospace", fontSize: 10, letterSpacing: 2, color: '#6b7280', textTransform: 'uppercase', marginBottom: 8 },
  paramRow: { display: 'grid', gridTemplateColumns: '82px 1fr 54px', alignItems: 'center', gap: 8, padding: '4px 0' },
  paramName: { fontSize: 12, color: '#9ca3af' },
  paramVal:  { fontSize: 11, color: '#00d4ff', fontFamily: "'Space Mono',monospace", textAlign: 'right' },
  paramUnit: { fontSize: 9,  color: '#4b5563', textAlign: 'right', marginTop: -1 },
  slider:    { width: '100%', accentColor: '#00d4ff', cursor: 'pointer' },
  presetBtn: (v) => ({
    flex: 1, padding: '6px 4px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 10,
    fontFamily: "'Space Mono',monospace", fontWeight: 700,
    background: v === 'pristine' ? '#22d3ee22' : v === 'urban' ? '#1a2030' : v === 'industrial' ? '#fb923c22' : '#ef444422',
    color: v === 'pristine' ? '#22d3ee' : v === 'urban' ? '#9ca3af' : v === 'industrial' ? '#fb923c' : '#ef4444',
  }),
  applyBtn: { width: '100%', padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#00d4ff', color: '#0a0e14', fontSize: 12, fontFamily: "'Space Mono',monospace", fontWeight: 700, marginTop: 10 },
};

function formatVal(key, val) {
  const precise = ['ph', 'do_', 'bod', 'nit', 'temp'];
  return precise.includes(key) ? parseFloat(val).toFixed(1) : Math.round(val);
}

export default function WQIPanel({ layer, onApply }) {
  const [params, setParams] = useState(() => layer.params ?? defaultParams());
  useEffect(() => { setParams(layer.params ?? defaultParams()); }, [layer.id]);
  const { wqi, breakdown } = computeWQI(params);
  const { grade, desc } = wqiGrade(wqi);
  const color = wqiToColor(wqi);
  const set = (key, val) => setParams(p => ({ ...p, [key]: val }));

  return (
    <div>
      <div style={{ background: '#111620', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', border: `3px solid ${color}`, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 16, fontWeight: 700, color: '#e8eaf0' }}>{wqi}</div>
          <div style={{ fontSize: 8, color: '#6b7280', fontFamily: "'Space Mono',monospace", textTransform: 'uppercase', letterSpacing: 1 }}>WQI</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color, marginBottom: 2 }}>{grade}</div>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>{desc}</div>
          {Object.keys(PARAMS).map(key => {
            const { si } = breakdown[key];
            const bc = si >= 80 ? '#22c55e' : si >= 60 ? '#a3e635' : si >= 40 ? '#eab308' : si >= 20 ? '#f97316' : '#ef4444';
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                <span style={{ fontSize: 9, color: '#6b7280', width: 60, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{PARAMS[key].label}</span>
                <div style={{ flex: 1, height: 3, background: '#1a2030', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${si}%`, background: bc, borderRadius: 2, transition: 'width .3s' }} />
                </div>
                <span style={{ fontSize: 9, fontFamily: "'Space Mono',monospace", color: bc, width: 22, textAlign: 'right' }}>{si}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div style={s.heading}>Adjust Parameters</div>
      {Object.entries(PARAMS).map(([key, meta]) => (
        <div key={key} style={s.paramRow}>
          <span style={s.paramName}>{meta.label}</span>
          <input type="range" min={meta.min} max={meta.max} step={meta.step} value={params[key] ?? meta.min} style={s.slider} onChange={e => set(key, parseFloat(e.target.value))} />
          <div>
            <div style={s.paramVal}>{formatVal(key, params[key] ?? 0)}</div>
            <div style={s.paramUnit}>{meta.unit}</div>
          </div>
        </div>
      ))}
      <div style={{ marginTop: 12 }}>
        <div style={s.heading}>Presets</div>
        <div style={{ display: 'flex', gap: 5 }}>
          {Object.keys(PRESETS).map(name => (
            <button key={name} style={s.presetBtn(name)} onClick={() => setParams({ ...PRESETS[name] })}>
              {name === 'pristine' ? 'Pristine' : name === 'urban' ? 'Urban' : name === 'industrial' ? 'Industrial' : 'Sewage'}
            </button>
          ))}
        </div>
      </div>
      <button style={s.applyBtn} onClick={() => onApply(params)}>Apply to Map</button>
    </div>
  );
}
