import React, { useEffect, useState } from 'react';
import { PageHeader, PageContent } from '../../components/common/Layout';
import { ComplianceBadge, Empty, PageLoader, Modal, Spinner } from '../../components/common/UI';
import { reportsAPI, warningsAPI } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import { PollutantBarChart, WaterTrendChart, NoiseTrendChart } from '../../components/charts/Charts';

export default function OfficerReports() {
  const { user } = useAuth();
  const regionId = user?.region_id?._id || user?.region_id;

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [filter, setFilter] = useState({ status: '', is_compliant: '' });
  const [selectedReport, setSelectedReport] = useState(null);
  const [detailReport, setDetailReport] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState('');
  const [warningSending, setWarningSending] = useState(false);
  const [warningForm, setWarningForm] = useState({ subject: '', message: '', action_items: [], priority: 'medium' });
  const [showWarningForm, setShowWarningForm] = useState(false);
  const [warningSent, setWarningSent] = useState(false);

  const fetchReports = async () => {
    if (!regionId) return;
    setLoading(true);
    try {
      const params = {
        page,
        limit: 20,
        reporting_period: 'weekly,monthly',
        ...filter,
      };
      if (filter.status) params.status = filter.status;
      if (filter.is_compliant !== '') params.is_compliant = filter.is_compliant;
      const { data } = await reportsAPI.getByRegion(regionId, params);
      setReports(data.data);
      setPagination(data.pagination || {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [regionId, page, filter.status, filter.is_compliant]);

  useEffect(() => {
    if (!selectedReport?._id) {
      setDetailReport(null);
      setInsights(null);
      setInsightsError('');
      setShowWarningForm(false);
      setWarningSent(false);
      return;
    }
    setDetailLoading(true);
    reportsAPI
      .getById(selectedReport._id)
      .then((res) => {
        setDetailReport(res.data.data);
      })
      .catch(() => setDetailReport(null))
      .finally(() => setDetailLoading(false));
  }, [selectedReport?._id]);

  const fetchInsights = async () => {
    if (!detailReport?._id) return;
    setInsightsLoading(true);
    setInsightsError('');
    try {
      const { data } = await reportsAPI.getInsights(detailReport._id);
      setInsights(data.data);
      if (data.data?.actionItems?.length && !warningForm.message) {
        setWarningForm((f) => ({
          ...f,
          subject: `Action required: ${detailReport.industry_id?.name || 'Report'} — compliance`,
          message: data.data.summary || '',
          action_items: data.data.actionItems || [],
        }));
      }
    } catch (e) {
      setInsightsError(e.response?.data?.message || 'Failed to load AI insights.');
    } finally {
      setInsightsLoading(false);
    }
  };

  const handleSendWarning = async () => {
    if (!detailReport?.industry_id?._id || !warningForm.subject.trim() || !warningForm.message.trim()) return;
    setWarningSending(true);
    try {
      await warningsAPI.create({
        industry_id: detailReport.industry_id._id,
        report_id: detailReport._id,
        subject: warningForm.subject.trim(),
        message: warningForm.message.trim(),
        action_items: warningForm.action_items.filter(Boolean),
        priority: warningForm.priority,
      });
      setWarningSent(true);
      setShowWarningForm(false);
      setWarningForm({ subject: '', message: '', action_items: [], priority: 'medium' });
    } catch (e) {
      console.error(e);
    } finally {
      setWarningSending(false);
    }
  };

  const handleReview = async (id, status, notes) => {
    await reportsAPI.review(id, { status, review_notes: notes });
    fetchReports();
    setSelectedReport(null);
    setDetailReport(null);
  };

  return (
    <>
      <PageHeader
        title="Monitoring Reports"
        subtitle="Weekly and monthly period reports from industries in your region (aggregated data, compliance score, charts)"
      />
      <PageContent>
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <select
            className="input"
            style={{ maxWidth: 160 }}
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          >
            <option value="">All statuses</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under Review</option>
            <option value="approved">Approved</option>
            <option value="flagged">Flagged</option>
            <option value="rejected">Rejected</option>
          </select>
          <select
            className="input"
            style={{ maxWidth: 160 }}
            value={filter.is_compliant}
            onChange={(e) => setFilter({ ...filter, is_compliant: e.target.value })}
          >
            <option value="">Compliance: All</option>
            <option value="true">Compliant only</option>
            <option value="false">Violations only</option>
          </select>
          <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
            {pagination.total ?? 0} period reports
          </span>
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <PageLoader />
          ) : reports.length === 0 ? (
            <Empty message="No weekly or monthly reports yet. Industries submit these from their dashboard (generated from daily data)." />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Type</th>
                  <th>Industry</th>
                  <th>Region</th>
                  <th>Compliance</th>
                  <th>Air (avg)</th>
                  <th>Water (avg)</th>
                  <th>Noise (avg)</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr
                    key={r._id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedReport(r)}
                  >
                    <td className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {r.period_start && r.period_end
                        ? `${formatDate(r.period_start)} – ${formatDate(r.period_end)}`
                        : formatDate(r.date)}
                    </td>
                    <td className="capitalize">{r.reporting_period}</td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {r.industry_id?.name || '—'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{r.region_id?.name || '—'}</td>
                    <td>
                      <span
                        className="font-mono font-bold"
                        style={{
                          color:
                            r.compliance_score >= 70
                              ? '#14b369'
                              : r.compliance_score >= 40
                                ? '#f79009'
                                : '#ef4444',
                        }}
                      >
                        {r.compliance_score ?? '—'}
                      </span>
                      <span className="ml-1">
                        <ComplianceBadge status={r.is_compliant ? 'compliant' : 'violation'} />
                      </span>
                    </td>
                    <td className="text-xs font-mono">PM2.5 {r.air_data?.pm25 ?? '—'}</td>
                    <td className="text-xs font-mono">
                      pH {r.water_data?.ph != null ? Number(r.water_data.ph).toFixed(1) : '—'}
                    </td>
                    <td className="text-xs font-mono">{r.noise_data?.day_db ?? '—'} dB</td>
                    <td>
                      <span
                        className="text-xs capitalize"
                        style={{
                          color:
                            r.status === 'approved'
                              ? '#14b369'
                              : r.status === 'flagged' || r.status === 'rejected'
                                ? '#ef4444'
                                : 'var(--text-muted)',
                        }}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="text-xs"
                        style={{
                          color: '#14b369',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedReport(r);
                        }}
                      >
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
            <button
              type="button"
              className="btn-ghost text-sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Prev
            </button>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Page {page} of {pagination.pages}
            </span>
            <button
              type="button"
              className="btn-ghost text-sm"
              disabled={page >= pagination.pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </button>
          </div>
        )}
      </PageContent>

      {/* Report detail modal — period report with charts and figures */}
      <Modal
        isOpen={!!selectedReport}
        onClose={() => {
          setSelectedReport(null);
          setDetailReport(null);
        }}
        title={
          detailReport
            ? `${detailReport.industry_id?.name ?? 'Report'} — ${detailReport.reporting_period} report`
            : 'Report detail'
        }
        width="max-w-4xl"
      >
        {detailLoading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : detailReport ? (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-4 items-center">
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {detailReport.period_start && detailReport.period_end
                  ? `${formatDate(detailReport.period_start)} – ${formatDate(detailReport.period_end)}`
                  : formatDate(detailReport.date)}
              </span>
              <span
                className="font-mono font-bold text-lg"
                style={{
                  color:
                    detailReport.compliance_score >= 70
                      ? '#14b369'
                      : detailReport.compliance_score >= 40
                        ? '#f79009'
                        : '#ef4444',
                }}
              >
                Compliance: {detailReport.compliance_score ?? '—'}/100
              </span>
              <ComplianceBadge
                status={detailReport.is_compliant ? 'compliant' : 'violation'}
              />
              <span className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>
                {detailReport.status}
              </span>
            </div>

            <div>
              <h4
                className="text-xs font-bold uppercase tracking-widest mb-2"
                style={{ color: 'var(--text-muted)' }}
              >
                Summary figures (averages)
              </h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div
                  className="p-3 rounded border"
                  style={{
                    borderColor: 'var(--border)',
                    background: 'rgba(255,255,255,0.02)',
                  }}
                >
                  <div className="text-xs uppercase mb-1" style={{ color: '#14b369' }}>
                    Air
                  </div>
                  <div>PM2.5: {detailReport.air_data?.pm25 ?? '—'}</div>
                  <div>PM10: {detailReport.air_data?.pm10 ?? '—'}</div>
                  <div>SO₂: {detailReport.air_data?.so2 ?? '—'}</div>
                  <div>NO₂: {detailReport.air_data?.no2 ?? '—'}</div>
                </div>
                <div
                  className="p-3 rounded border"
                  style={{
                    borderColor: 'var(--border)',
                    background: 'rgba(255,255,255,0.02)',
                  }}
                >
                  <div className="text-xs uppercase mb-1" style={{ color: '#0ea5e9' }}>
                    Water
                  </div>
                  <div>pH: {detailReport.water_data?.ph != null ? Number(detailReport.water_data.ph).toFixed(1) : '—'}</div>
                  <div>BOD: {detailReport.water_data?.bod ?? '—'}</div>
                  <div>COD: {detailReport.water_data?.cod ?? '—'}</div>
                  <div>TSS: {detailReport.water_data?.tss ?? '—'}</div>
                </div>
                <div
                  className="p-3 rounded border"
                  style={{
                    borderColor: 'var(--border)',
                    background: 'rgba(255,255,255,0.02)',
                  }}
                >
                  <div className="text-xs uppercase mb-1" style={{ color: '#f97316' }}>
                    Noise
                  </div>
                  <div>Day: {detailReport.noise_data?.day_db ?? '—'} dB</div>
                  <div>Night: {detailReport.noise_data?.night_db ?? '—'} dB</div>
                  <div>Peak: {detailReport.noise_data?.peak_db ?? '—'} dB</div>
                </div>
              </div>
            </div>

            {detailReport.summary_chart_data && detailReport.summary_chart_data.length > 0 && (
              <div>
                <h4
                  className="text-xs font-bold uppercase tracking-widest mb-3"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Period trend (daily points)
                </h4>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div>
                    <div className="text-xs mb-1" style={{ color: '#14b369' }}>
                      Air
                    </div>
                    <PollutantBarChart
                      data={detailReport.summary_chart_data.map((d) => ({
                        _id: new Date(d.date).toISOString().slice(0, 10),
                        avg_pm25: d.air?.pm25 ?? null,
                        avg_pm10: d.air?.pm10 ?? null,
                        avg_so2: d.air?.so2 ?? null,
                        avg_no2: d.air?.no2 ?? null,
                      }))}
                      height={180}
                    />
                  </div>
                  <div>
                    <div className="text-xs mb-1" style={{ color: '#0ea5e9' }}>
                      Water
                    </div>
                    <WaterTrendChart
                      data={detailReport.summary_chart_data.map((d) => ({
                        _id: new Date(d.date).toISOString().slice(0, 10),
                        avg_ph: d.water?.ph ?? null,
                        avg_bod: d.water?.bod ?? null,
                        avg_cod: d.water?.cod ?? null,
                        avg_tss: d.water?.tss ?? null,
                      }))}
                      height={180}
                    />
                  </div>
                  <div>
                    <div className="text-xs mb-1" style={{ color: '#f97316' }}>
                      Noise
                    </div>
                    <NoiseTrendChart
                      data={detailReport.summary_chart_data.map((d) => ({
                        _id: new Date(d.date).toISOString().slice(0, 10),
                        avg_day_db: d.noise?.day_db ?? null,
                        avg_night_db: d.noise?.night_db ?? null,
                        max_peak_db: d.noise?.peak_db ?? null,
                      }))}
                      height={180}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* AI insights (Gemini) */}
            <div className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <h4 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
                AI insights (what to fix)
              </h4>
              {!insights && !insightsLoading && (
                <button
                  type="button"
                  className="btn-ghost text-sm"
                  onClick={fetchInsights}
                  disabled={insightsLoading}
                >
                  {insightsLoading ? 'Loading…' : '✨ Get AI insights'}
                </button>
              )}
              {insightsLoading && <Spinner />}
              {insightsError && <p className="text-sm" style={{ color: '#ef4444' }}>{insightsError}</p>}
              {insights && !insightsLoading && (
                <div className="space-y-2 text-sm" style={{ overflow: 'visible', minHeight: 0 }}>
                  <p
                    style={{
                      color: 'var(--text-secondary)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      overflow: 'visible',
                    }}
                  >
                    {insights.summary}
                  </p>
                  {insights.actionItems?.length > 0 && (
                    <ul className="list-disc pl-5 space-y-1" style={{ color: 'var(--text-secondary)', wordBreak: 'break-word', overflow: 'visible' }}>
                      {insights.actionItems.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Priority: {insights.priority}</p>
                </div>
              )}
            </div>

            {/* Send warning to industry (officer only) */}
            {user?.role === 'regional_officer' || user?.role === 'super_admin' ? (
              <div className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                <h4 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
                  Send warning to industry
                </h4>
                {warningSent ? (
                  <p className="text-sm" style={{ color: '#14b369' }}>Warning sent. Industry can view it in their dashboard.</p>
                ) : !showWarningForm ? (
                  <button
                    type="button"
                    className="btn-ghost text-sm"
                    onClick={() => setShowWarningForm(true)}
                  >
                    📩 Compose warning
                  </button>
                ) : (
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Subject"
                      className="input w-full text-sm"
                      value={warningForm.subject}
                      onChange={(e) => setWarningForm((f) => ({ ...f, subject: e.target.value }))}
                    />
                    <textarea
                      placeholder="Message (what needs to be fixed, deadline, etc.)"
                      className="input w-full text-sm min-h-[80px]"
                      value={warningForm.message}
                      onChange={(e) => setWarningForm((f) => ({ ...f, message: e.target.value }))}
                    />
                    {warningForm.action_items.length > 0 && (
                      <div>
                        <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Action items (editable)</label>
                        {warningForm.action_items.map((item, i) => (
                          <input
                            key={i}
                            type="text"
                            className="input w-full text-sm mb-1"
                            value={item}
                            onChange={(e) => {
                              const next = [...warningForm.action_items];
                              next[i] = e.target.value;
                              setWarningForm((f) => ({ ...f, action_items: next }));
                            }}
                          />
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Priority:</label>
                      <select
                        className="input text-sm"
                        style={{ width: 'auto' }}
                        value={warningForm.priority}
                        onChange={(e) => setWarningForm((f) => ({ ...f, priority: e.target.value }))}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" className="btn-primary text-sm" onClick={handleSendWarning} disabled={warningSending}>
                        {warningSending ? 'Sending…' : 'Send warning'}
                      </button>
                      <button type="button" className="btn-ghost text-sm" onClick={() => setShowWarningForm(false)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {detailReport.status === 'submitted' && (
              <div
                className="flex gap-3 pt-4 border-t"
                style={{ borderColor: 'var(--border)' }}
              >
                <button
                  type="button"
                  className="btn-primary flex-1"
                  onClick={() => handleReview(detailReport._id, 'approved', '')}
                >
                  ✓ Approve
                </button>
                <button
                  type="button"
                  className="btn-ghost flex-1"
                  onClick={() =>
                    handleReview(detailReport._id, 'flagged', 'Requires investigation')
                  }
                >
                  ⚑ Flag
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setSelectedReport(null);
                    setDetailReport(null);
                  }}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
