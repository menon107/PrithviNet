import React, { useEffect, useState } from 'react';
import { PageHeader, PageContent } from '../../components/common/Layout';
import { ComplianceBadge, SectionHeader, Empty, PageLoader, Modal, AQIBadge } from '../../components/common/UI';
import { reportsAPI } from '../../services/api';
import { formatDate, formatDateTime } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';

export default function ReportsPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [filter, setFilter] = useState({ status: '', is_compliant: '' });
  const [selectedReport, setSelectedReport] = useState(null);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20, ...filter };
      if (filter.is_compliant !== '') params.is_compliant = filter.is_compliant;
      const { data } = await reportsAPI.getAll(params);
      setReports(data.data);
      setPagination(data.pagination);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchReports(); }, [page, filter]);

  const handleReview = async (id, status, notes) => {
    await reportsAPI.review(id, { status, review_notes: notes });
    fetchReports();
    setSelectedReport(null);
  };

  return (
    <>
      <PageHeader title="Monitoring Reports"
        subtitle="Daily industry environmental submissions" />
      <PageContent>
        {/* Filters */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <select className="input" style={{ maxWidth: 160 }} value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
            <option value="">All statuses</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under Review</option>
            <option value="approved">Approved</option>
            <option value="flagged">Flagged</option>
            <option value="rejected">Rejected</option>
          </select>
          <select className="input" style={{ maxWidth: 160 }} value={filter.is_compliant}
            onChange={(e) => setFilter({ ...filter, is_compliant: e.target.value })}>
            <option value="">Compliance: All</option>
            <option value="true">Compliant only</option>
            <option value="false">Violations only</option>
          </select>
          <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
            {pagination.total ?? '—'} total reports
          </span>
        </div>

        <div className="card overflow-hidden">
          {loading ? <PageLoader /> : reports.length === 0 ? <Empty /> : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Industry</th>
                  <th>Region</th>
                  <th>PM 2.5</th>
                  <th>AQI</th>
                  <th>pH</th>
                  <th>Compliance</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r._id} style={{ cursor: 'pointer' }} onClick={() => setSelectedReport(r)}>
                    <td style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--text-muted)' }}>
                      {formatDate(r.date)}
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {r.industry_id?.name || '—'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{r.region_id?.name || '—'}</td>
                    <td className="font-mono" style={{ color: r.air_data?.pm25 > 80 ? '#ef4444' : 'var(--text-primary)' }}>
                      {r.air_data?.pm25 ?? '—'}
                    </td>
                    <td><AQIBadge aqi={r.air_data?.aqi} /></td>
                    <td className="font-mono" style={{ color: 'var(--text-secondary)' }}>{r.water_data?.ph?.toFixed(1) ?? '—'}</td>
                    <td><ComplianceBadge status={r.is_compliant ? 'compliant' : 'violation'} /></td>
                    <td>
                      <span className="text-xs capitalize" style={{
                        color: r.status === 'approved' ? '#14b369' : r.status === 'flagged' || r.status === 'rejected' ? '#ef4444' : 'var(--text-muted)'
                      }}>{r.status}</span>
                    </td>
                    <td>
                      <button className="text-xs" style={{ color: '#14b369', background: 'none', border: 'none', cursor: 'pointer' }}>
                        View →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {pagination.pages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button className="btn-ghost text-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Page {page} of {pagination.pages}</span>
            <button className="btn-ghost text-sm" disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </PageContent>

      {/* Report Detail Modal */}
      <Modal isOpen={!!selectedReport} onClose={() => setSelectedReport(null)}
        title={`Report — ${formatDate(selectedReport?.date)}`} width="max-w-2xl">
        {selectedReport && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                {selectedReport.industry_id?.name}
              </span>
              <ComplianceBadge status={selectedReport.is_compliant ? 'compliant' : 'violation'} />
              <AQIBadge aqi={selectedReport.air_data?.aqi} />
            </div>

            {/* Violations */}
            {selectedReport.violations?.length > 0 && (
              <div className="rounded-lg p-4" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#ef4444' }}>⚠ Violations</p>
                <div className="space-y-2">
                  {selectedReport.violations.map((v, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span style={{ color: 'var(--text-secondary)' }}>{v.parameter}</span>
                      <span>
                        <span style={{ color: '#ef4444', fontWeight: 600 }}>{v.measured_value}</span>
                        <span style={{ color: 'var(--text-muted)' }}> / limit {v.limit_value} (+{v.excess_percentage}%)</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Data grids */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#14b369' }}>💨 Air</p>
                <div className="space-y-1.5">
                  {['pm25', 'pm10', 'so2', 'no2', 'co', 'aqi'].map((k) => (
                    selectedReport.air_data?.[k] != null && (
                      <div key={k} className="flex justify-between text-xs">
                        <span style={{ color: 'var(--text-muted)', textTransform: 'uppercase' }}>{k}</span>
                        <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{selectedReport.air_data[k]}</span>
                      </div>
                    )
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#0ea5e9' }}>💧 Water</p>
                <div className="space-y-1.5">
                  {['ph', 'bod', 'cod', 'tss', 'turbidity'].map((k) => (
                    selectedReport.water_data?.[k] != null && (
                      <div key={k} className="flex justify-between text-xs">
                        <span style={{ color: 'var(--text-muted)', textTransform: 'uppercase' }}>{k}</span>
                        <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{selectedReport.water_data[k]}</span>
                      </div>
                    )
                  ))}
                </div>
              </div>
            </div>

            {/* Officer actions */}
            {(user?.role === 'regional_officer' || user?.role === 'super_admin') && selectedReport.status === 'submitted' && (
              <div className="flex gap-3 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                <button className="btn-primary flex-1" onClick={() => handleReview(selectedReport._id, 'approved', '')}>
                  ✓ Approve
                </button>
                <button className="btn-ghost flex-1" onClick={() => handleReview(selectedReport._id, 'flagged', 'Requires investigation')}>
                  ⚑ Flag
                </button>
                <button onClick={() => setSelectedReport(null)} className="btn-ghost">Close</button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
