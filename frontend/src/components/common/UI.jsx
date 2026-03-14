import React from 'react';
import { getComplianceBadge, getSeverityColor, getAQICategory } from '../../utils/helpers';

// ── Spinner ──────────────────────────────────────────────
export const Spinner = ({ size = 'md', className = '' }) => {
  const s = { sm: 'w-4 h-4', md: 'w-7 h-7', lg: 'w-10 h-10' }[size];
  return (
    <div className={`${s} ${className}`}>
      <svg className="animate-spin w-full h-full" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="#14b369" strokeWidth="3" />
        <path className="opacity-80" fill="#14b369" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
};

export const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <Spinner size="lg" />
  </div>
);

// ── Badge ────────────────────────────────────────────────
export const ComplianceBadge = ({ status }) => {
  const { label, cls } = getComplianceBadge(status);
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
};

export const SeverityBadge = ({ severity }) => {
  const color = getSeverityColor(severity);
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize"
      style={{ color, background: `${color}22`, border: `1px solid ${color}44` }}
    >
      {severity}
    </span>
  );
};

export const AQIBadge = ({ aqi }) => {
  const { label, color, bg } = getAQICategory(aqi);
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ color, background: bg, border: `1px solid ${color}44` }}
    >
      <span className="font-mono font-bold">{aqi ?? '—'}</span>
      <span className="opacity-80">{label}</span>
    </span>
  );
};

// ── Stat Card ────────────────────────────────────────────
export const StatCard = ({ title, value, unit, icon, trend, color = '#14b369', subtitle, loading }) => (
  <div className="card p-5 flex flex-col gap-3 animate-fade-in">
    <div className="flex items-start justify-between">
      <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
        {title}
      </p>
      {icon && (
        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
          style={{ background: `${color}18`, color }}>
          {icon}
        </div>
      )}
    </div>
    {loading ? (
      <div className="h-8 w-24 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
    ) : (
      <div className="flex items-baseline gap-1.5">
        <span className="stat-number text-3xl" style={{ color }}>{value ?? '—'}</span>
        {unit && <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{unit}</span>}
      </div>
    )}
    {subtitle && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>}
    {trend && (
      <div className="flex items-center gap-1 text-xs">
        <span style={{ color: trend.up ? '#22c55e' : '#ef4444' }}>{trend.up ? '↑' : '↓'} {trend.value}</span>
        <span style={{ color: 'var(--text-muted)' }}>{trend.label}</span>
      </div>
    )}
  </div>
);

// ── Empty State ──────────────────────────────────────────
export const Empty = ({ message = 'No data found', icon = '📭' }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-3 opacity-60">
    <span className="text-4xl">{icon}</span>
    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{message}</p>
  </div>
);

// ── Section Header ───────────────────────────────────────
export const SectionHeader = ({ title, subtitle, action }) => (
  <div className="flex items-start justify-between mb-5">
    <div>
      <h2 className="section-title">{title}</h2>
      {subtitle && <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>}
    </div>
    {action}
  </div>
);

// ── Live Indicator ───────────────────────────────────────
export const LiveIndicator = ({ label = 'Live' }) => (
  <div className="flex items-center gap-2">
    <span className="live-dot" />
    <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#14b369' }}>{label}</span>
  </div>
);

// ── Progress Bar ─────────────────────────────────────────
export const ProgressBar = ({ value, max = 100, color }) => {
  const pct = Math.min(100, (value / max) * 100);
  const c = color || (pct > 80 ? '#ef4444' : pct > 60 ? '#f97316' : pct > 40 ? '#eab308' : '#14b369');
  return (
    <div className="w-full rounded-full h-1.5" style={{ background: 'rgba(255,255,255,0.07)' }}>
      <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: c }} />
    </div>
  );
};

// ── Modal ────────────────────────────────────────────────
export const Modal = ({ isOpen, onClose, title, children, width = 'max-w-lg' }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className={`card w-full ${width} animate-slide-up`} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <h3 className="section-title text-base">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-lg"
            style={{ color: 'var(--text-muted)' }}>✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

// ── Alert Banner ─────────────────────────────────────────
export const AlertBanner = ({ type = 'info', message }) => {
  const styles = {
    error: { bg: 'rgba(240,68,56,0.1)', border: 'rgba(240,68,56,0.3)', color: '#fca5a5', icon: '⚠' },
    success: { bg: 'rgba(20,179,105,0.1)', border: 'rgba(20,179,105,0.3)', color: '#14b369', icon: '✓' },
    info: { bg: 'rgba(14,165,233,0.1)', border: 'rgba(14,165,233,0.3)', color: '#7dd3fc', icon: 'ℹ' },
  }[type];
  return (
    <div className="rounded-lg px-4 py-3 text-sm flex items-center gap-2"
      style={{ background: styles.bg, border: `1px solid ${styles.border}`, color: styles.color }}>
      <span>{styles.icon}</span> {message}
    </div>
  );
};
