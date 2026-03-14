import React, { useEffect, useState } from 'react';
import { PageHeader, PageContent } from '../../components/common/Layout';
import { SeverityBadge, Empty, PageLoader } from '../../components/common/UI';
import { alertsAPI } from '../../services/api';
import { timeAgo } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';

const ALERT_ICONS = {
  violation_alert: '⚠', report_missing: '📋', forecast_risk: '📡',
  sensor_anomaly: '🔧', compliance_warning: '⚡', inspection_due: '🔍',
};

const TYPE_LABELS = {
  violation_alert: 'Violation', report_missing: 'Missing Report', forecast_risk: 'Forecast Risk',
  sensor_anomaly: 'Sensor Anomaly', compliance_warning: 'Compliance Warning', inspection_due: 'Inspection Due',
};

export default function AlertsPage() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [filter, setFilter] = useState({ severity: '', type: '', is_resolved: 'false' });

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const { data } = await alertsAPI.getAll({ ...filter, page, limit: 25 });
      setAlerts(data.data);
      setPagination(data.pagination);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAlerts(); }, [filter, page]);

  const handleResolve = async (id) => {
    await alertsAPI.resolve(id);
    fetchAlerts();
  };

  const canResolve = ['super_admin', 'regional_officer'].includes(user?.role);

  return (
    <>
      <PageHeader title="Alerts" subtitle="System-wide pollution and compliance alerts" />
      <PageContent>
        {/* Resolved toggle + filters */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
            {['false', 'true'].map((val) => (
              <button key={val}
                onClick={() => setFilter({ ...filter, is_resolved: val })}
                className="px-4 py-2 text-xs font-semibold transition-all"
                style={{
                  background: filter.is_resolved === val ? 'rgba(20,179,105,0.15)' : 'transparent',
                  color: filter.is_resolved === val ? '#14b369' : 'var(--text-secondary)',
                }}>
                {val === 'false' ? 'Active' : 'Resolved'}
              </button>
            ))}
          </div>

          <select className="input" style={{ maxWidth: 150 }} value={filter.severity}
            onChange={(e) => setFilter({ ...filter, severity: e.target.value })}>
            <option value="">All severities</option>
            {['low', 'medium', 'high', 'critical'].map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
          </select>

          <select className="input" style={{ maxWidth: 180 }} value={filter.type}
            onChange={(e) => setFilter({ ...filter, type: e.target.value })}>
            <option value="">All types</option>
            {Object.entries(TYPE_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
          </select>

          {canResolve && (
            <button className="btn-ghost text-xs ml-auto" onClick={async () => {
              await alertsAPI.markAllRead(); fetchAlerts();
            }}>
              Mark all read
            </button>
          )}
        </div>

        {loading ? <PageLoader /> : alerts.length === 0 ? <Empty message="No alerts found" icon="✓" /> : (
          <div className="flex flex-col gap-2">
            {alerts.map((alert) => (
              <div key={alert._id}
                className="card p-4 flex items-start gap-4 transition-all"
                style={{ borderColor: alert.severity === 'critical' ? 'rgba(239,68,68,0.25)' : 'var(--border)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.04)' }}>
                  {ALERT_ICONS[alert.type] || '🔔'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-3 flex-wrap">
                    <p className="font-semibold text-sm flex-1" style={{ color: 'var(--text-primary)' }}>{alert.title}</p>
                    <SeverityBadge severity={alert.severity} />
                    <span className="text-xs px-2 py-0.5 rounded"
                      style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                      {TYPE_LABELS[alert.type]}
                    </span>
                  </div>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{alert.message}</p>
                  <div className="flex items-center gap-4 mt-2 flex-wrap">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{timeAgo(alert.created_at)}</span>
                    {alert.region_id && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>📍 {alert.region_id.name}</span>}
                    {alert.industry_id && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>🏭 {alert.industry_id.name}</span>}
                    {alert.metadata?.measured_value != null && (
                      <span className="text-xs font-mono" style={{ color: '#ef4444' }}>
                        {alert.metadata.parameter}: {alert.metadata.measured_value} / limit {alert.metadata.limit_value}
                      </span>
                    )}
                  </div>
                </div>
                {canResolve && !alert.is_resolved && (
                  <button onClick={() => handleResolve(alert._id)}
                    className="text-xs px-3 py-1.5 rounded-lg flex-shrink-0"
                    style={{ background: 'rgba(20,179,105,0.1)', color: '#14b369', border: '1px solid rgba(20,179,105,0.2)' }}>
                    Resolve
                  </button>
                )}
                {alert.is_resolved && (
                  <span className="text-xs px-3 py-1.5 rounded-lg flex-shrink-0"
                    style={{ color: '#14b369', background: 'rgba(20,179,105,0.08)' }}>
                    ✓ Resolved
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {pagination.pages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-5">
            <button className="btn-ghost text-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Page {page} of {pagination.pages}</span>
            <button className="btn-ghost text-sm" disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </PageContent>
    </>
  );
}
