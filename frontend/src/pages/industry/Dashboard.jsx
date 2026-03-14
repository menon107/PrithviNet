import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, PageContent } from '../../components/common/Layout';
import { StatCard, SectionHeader, ComplianceBadge, PageLoader, Modal, AlertBanner, Spinner, ProgressBar, Empty } from '../../components/common/UI';
import { AlertsPanel } from '../../components/alerts/AlertsPanel';
import { ComplianceScoreChart, PollutantBarChart, WaterTrendChart, NoiseTrendChart } from '../../components/charts/Charts';
import { reportsAPI, aiAPI, industriesAPI, pollutionAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/helpers';

const defaultAir = { pm25: '', pm10: '', so2: '', no2: '', co: '', temperature: '', humidity: '' };
const defaultWater = { ph: '', bod: '', cod: '', tss: '', turbidity: '' };
const defaultNoise = { day_db: '', night_db: '', peak_db: '' };

export default function IndustryDashboard() {
  const { user } = useAuth();
  const industryId = user?.industry_id?._id || user?.industry_id;

  const [industryStats, setIndustryStats] = useState(null);
  const [risk, setRisk] = useState(null);
  const [recentReports, setRecentReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showReportModal, setShowReportModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const [airData, setAirData] = useState(defaultAir);
  const [waterData, setWaterData] = useState(defaultWater);
  const [noiseData, setNoiseData] = useState(defaultNoise);

  // Submit modal: daily | weekly | monthly
  const [reportModalMode, setReportModalMode] = useState('daily');
  const [periodEnd, setPeriodEnd] = useState('');
  const [periodReports, setPeriodReports] = useState([]);

  // Live series for this industry (air / water / noise)
  const [series, setSeries] = useState({ air: [], water: [], noise: [] });
  const [seriesLoading, setSeriesLoading] = useState(false);

  useEffect(() => {
    if (!industryId) return;
    const fetchAll = async () => {
      try {
        const [statsRes, riskRes, reportsRes, periodRes] = await Promise.all([
          industriesAPI.getStats(industryId),
          aiAPI.getComplianceRisk({ industry_id: industryId }),
          reportsAPI.getByIndustry(industryId, { limit: 20 }),
          reportsAPI.getByIndustry(industryId, { reporting_period: 'weekly,monthly', limit: 30 }),
        ]);
        setIndustryStats(statsRes.data.data);
        setRisk(riskRes.data.data);
        setRecentReports(reportsRes.data.data);
        setPeriodReports(periodRes.data.data || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetchAll();
  }, [industryId]);

  // Fetch time-series for this industry (air, water, noise) and refresh every 5 minutes
  useEffect(() => {
    if (!industryId) return;

    const fetchSeries = async () => {
      setSeriesLoading(true);
      try {
        const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const [airRes, waterRes, noiseRes] = await Promise.all([
          pollutionAPI.getAir({ industry_id: industryId, from_date: fromDate }),
          pollutionAPI.getWater({ industry_id: industryId, from_date: fromDate }),
          pollutionAPI.getNoise({ industry_id: industryId, from_date: fromDate }),
        ]);
        setSeries({
          air: airRes.data.data,
          water: waterRes.data.data,
          noise: noiseRes.data.data,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setSeriesLoading(false);
      }
    };

    fetchSeries();
    const id = setInterval(fetchSeries, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [industryId]);

  // Auto-generate and submit a monitoring report every 5 minutes for this industry.
  // Bodybag Zippers: always generate data within regulatory limits (compliant).
  // INDIGO: always generate rough/dangerous data (exceeds limits).
  useEffect(() => {
    if (!industryId) return;

    const generateAndSubmit = async () => {
      try {
        let industryName = '';
        try {
          const res = await industriesAPI.getById(industryId);
          industryName = (res.data?.data?.name || '').toLowerCase();
        } catch (_) {}

        const rand = (min, max) => Number((min + Math.random() * (max - min)).toFixed(2));
        let air, water, noise;

        if (industryName.includes('bodybag')) {
          // Within regulatory limits: pm25≤60, pm10≤100, so2/no2≤80, co≤4000, ph 6.5–8.5, bod≤30, cod≤250, tss≤100, turbidity≤10, day≤55, night≤45
          air = {
            pm25: rand(15, 55),
            pm10: rand(25, 95),
            so2: rand(10, 75),
            no2: rand(10, 75),
            co: rand(100, 3500),
            temperature: rand(22, 35),
            humidity: rand(45, 80),
          };
          water = {
            ph: rand(6.6, 8.4),
            bod: rand(5, 28),
            cod: rand(30, 240),
            tss: rand(5, 95),
            turbidity: rand(1, 9),
          };
          noise = {
            day_db: rand(35, 54),
            night_db: rand(30, 44),
            peak_db: rand(50, 60),
          };
        } else if (industryName.includes('indigo')) {
          // Rough/dangerous: exceed limits
          air = {
            pm25: rand(90, 180),
            pm10: rand(120, 250),
            so2: rand(100, 160),
            no2: rand(100, 150),
            co: rand(5000, 12000),
            temperature: rand(25, 42),
            humidity: rand(50, 95),
          };
          water = {
            ph: rand(4.0, 5.0),
            bod: rand(50, 120),
            cod: rand(300, 500),
            tss: rand(150, 300),
            turbidity: rand(15, 30),
          };
          noise = {
            day_db: rand(65, 85),
            night_db: rand(55, 75),
            peak_db: rand(80, 95),
          };
        } else {
          // Default: mixed (current behaviour)
          air = {
            pm25: rand(30, 120),
            pm10: rand(40, 180),
            so2: rand(10, 80),
            no2: rand(15, 90),
            co: rand(400, 1200),
            temperature: rand(20, 40),
            humidity: rand(40, 90),
          };
          water = {
            ph: rand(6.0, 8.8),
            bod: rand(10, 60),
            cod: rand(80, 280),
            tss: rand(20, 140),
            turbidity: rand(2, 14),
          };
          noise = {
            day_db: rand(50, 80),
            night_db: rand(40, 70),
            peak_db: rand(60, 90),
          };
        }

        await reportsAPI.submit({
          industry_id: industryId,
          date: new Date().toISOString(),
          air_data: air,
          water_data: water,
          noise_data: noise,
        });

        const reportsRes = await reportsAPI.getByIndustry(industryId, { limit: 20 });
        setRecentReports(reportsRes.data.data);
      } catch (e) {
        console.error('Auto-reporting failed', e);
      }
    };

    // Immediately send one report, then repeat every 5 minutes
    generateAndSubmit();
    const id = setInterval(generateAndSubmit, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [industryId]);

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    setSubmitting(true); setSubmitError(''); setSubmitSuccess(false);
    try {
      if (reportModalMode === 'weekly' || reportModalMode === 'monthly') {
        if (!periodEnd) {
          setSubmitError('Please select period ending date.');
          setSubmitting(false);
          return;
        }
        await reportsAPI.submitPeriod({
          industry_id: industryId,
          reporting_period: reportModalMode,
          period_end: new Date(periodEnd).toISOString(),
        });
        setSubmitSuccess(true);
        const periodRes = await reportsAPI.getByIndustry(industryId, { reporting_period: 'weekly,monthly', limit: 30 });
        setPeriodReports(periodRes.data.data || []);
        setTimeout(() => { setShowReportModal(false); setPeriodEnd(''); }, 1500);
      } else {
        const parse = (obj) => Object.fromEntries(
          Object.entries(obj).map(([k, v]) => [k, v !== '' ? parseFloat(v) : null])
        );
        await reportsAPI.submit({
          industry_id: industryId,
          date: new Date().toISOString(),
          air_data: parse(airData),
          water_data: parse(waterData),
          noise_data: parse(noiseData),
        });
        setSubmitSuccess(true);
        const reportsRes = await reportsAPI.getByIndustry(industryId, { limit: 20 });
        setRecentReports(reportsRes.data.data);
        setTimeout(() => setShowReportModal(false), 1500);
      }
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Submission failed.');
    } finally { setSubmitting(false); }
  };

  if (loading) return <PageLoader />;

  const { industry, stats, trend } = industryStats || {};
  const riskColor = { low: '#14b369', medium: '#f79009', high: '#ef4444' }[risk?.risk_level] || '#6b7280';

  return (
    <>
      <PageHeader
        title={industry?.name || 'Industry Dashboard'}
        subtitle={industry?.industry_type?.replace('_', ' ')}
        actions={
          <button className="btn-primary" onClick={() => { setReportModalMode('daily'); setSubmitError(''); setSubmitSuccess(false); setShowReportModal(true); }}>
            + Submit Report Manually
          </button>
        }
      />
      <PageContent>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
          <StatCard title="Compliance Score" value={stats?.avg_compliance_score ?? '—'} unit="/100"
            icon="✅" color="#14b369" />
          <StatCard title="Compliant Days (30d)" value={stats?.compliant_days ?? '—'}
            icon="📅" color="#22c55e" subtitle={`of ${stats?.total_reports_30d || 0} reported`} />
          <StatCard title="Violations (30d)" value={stats?.violation_days ?? '—'}
            icon="⚠" color="#ef4444" />
          <StatCard title="Compliance Rate" value={stats?.compliance_rate ?? '—'} unit="%"
            icon="📊" color="#0ea5e9" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-7">
          {/* Compliance trend */}
          <div className="xl:col-span-2 card p-5">
            <SectionHeader title="Compliance Score — Last 14 Days" />
            <ComplianceScoreChart data={trend} height={200} />
          </div>

          {/* AI Risk */}
          <div className="card p-5">
            <SectionHeader title="🤖 AI Compliance Risk" subtitle="Next 24 hours" />
            {risk ? (
              <div className="space-y-4">
                <div className="text-center py-4">
                  <div className="stat-number text-5xl" style={{ color: riskColor }}>
                    {Math.round(parseFloat(risk.violation_probability) * 100)}%
                  </div>
                  <div className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                    Violation probability
                  </div>
                  <div className="mt-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold capitalize"
                      style={{ color: riskColor, background: `${riskColor}18`, border: `1px solid ${riskColor}30` }}>
                      {risk.risk_level} risk
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  {risk.factors?.map((f, i) => (
                    <div key={i} className="text-xs p-2 rounded" style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-secondary)' }}>
                      ⚡ {f}
                    </div>
                  ))}
                </div>
                {risk.trend && (
                  <div className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                    Trend: <span className="font-semibold capitalize" style={{
                      color: risk.trend === 'worsening' ? '#ef4444' : risk.trend === 'improving' ? '#14b369' : 'var(--text-secondary)'
                    }}>{risk.trend}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
                No risk data available
              </div>
            )}
          </div>
        </div>

        {/* Weekly & Monthly Reports — sent to regional officer */}
        <div className="card p-5 mt-6">
          <SectionHeader
            title="Weekly & Monthly Reports"
            subtitle="Generate from daily data and send to your regional officer (charts, compliance score, summary figures)"
          />
          <div className="mb-6 flex flex-wrap items-end gap-4">
            <div>
              <label className="text-xs uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>Period type</label>
              <select
                className="input"
                style={{ width: 140 }}
                value={reportModalMode}
                onChange={(e) => setReportModalMode(e.target.value)}
              >
                <option value="daily">Daily (manual)</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            {(reportModalMode === 'weekly' || reportModalMode === 'monthly') && (
              <div>
                <label className="text-xs uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                  {reportModalMode === 'weekly' ? 'Week ending' : 'Month ending'}
                </label>
                <input
                  type="date"
                  className="input"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </div>
            )}
            <button
              type="button"
              className="btn-primary"
              onClick={async () => {
                if (reportModalMode === 'weekly' || reportModalMode === 'monthly') {
                  if (!periodEnd) {
                    setSubmitError('Select period ending date.');
                    setShowReportModal(true);
                    setSubmitSuccess(false);
                    return;
                  }
                  setSubmitting(true); setSubmitError(''); setSubmitSuccess(false);
                  try {
                    await reportsAPI.submitPeriod({
                      industry_id: industryId,
                      reporting_period: reportModalMode,
                      period_end: new Date(periodEnd).toISOString(),
                    });
                    setSubmitSuccess(true);
                    const periodRes = await reportsAPI.getByIndustry(industryId, { reporting_period: 'weekly,monthly', limit: 30 });
                    setPeriodReports(periodRes.data.data || []);
                  } catch (err) {
                    setSubmitError(err.response?.data?.message || 'Failed to generate period report.');
                  } finally { setSubmitting(false); }
                } else {
                  setReportModalMode('daily');
                  setPeriodEnd('');
                  setSubmitError('');
                  setSubmitSuccess(false);
                  setShowReportModal(true);
                }
              }}
            >
              {reportModalMode === 'daily' ? '+ Submit Report' : (submitting ? 'Generating…' : 'Generate & Submit period report')}
            </button>
          </div>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            Period reports are built from your daily data: pictorial charts, compliance score for the period, and summary figures. Officers see these under Reports (not the live daily stream).
          </p>
          {periodReports.length > 0 ? (
            <div className="overflow-x-auto border rounded-lg">
              <table className="data-table w-full text-sm">
                <thead className="bg-opacity-10 bg-gray-500">
                  <tr>
                    <th className="text-left p-3">Period</th>
                    <th>Type</th>
                    <th>Compliance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {periodReports.map((r) => (
                    <tr key={r._id}>
                      <td className="font-mono text-xs">
                        {r.period_start && r.period_end
                          ? `${formatDate(r.period_start)} – ${formatDate(r.period_end)}`
                          : formatDate(r.date)}
                      </td>
                      <td className="capitalize">{r.reporting_period}</td>
                      <td>
                        <span className="font-mono font-bold" style={{ color: r.compliance_score >= 70 ? '#14b369' : r.compliance_score >= 40 ? '#f79009' : '#ef4444' }}>
                          {r.compliance_score ?? '—'}
                        </span>
                      </td>
                      <td><ComplianceBadge status={r.is_compliant ? 'compliant' : 'violation'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No weekly or monthly reports submitted yet. Use the options above to generate one.</p>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
          {/* Recent reports table */}
          <div className="card p-5">
            <SectionHeader title="Recent Daily Reports" />
            <table className="data-table">
              <thead>
                <tr><th>Date</th><th>PM 2.5</th><th>AQI</th><th>Status</th><th>Compliance</th></tr>
              </thead>
              <tbody>
                {recentReports.slice(0, 10).map((r) => (
                  <tr key={r._id}>
                    <td style={{ color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono' }}>
                      {formatDate(r.date)}
                    </td>
                    <td className="font-mono"
                      style={{ color: r.air_data?.pm25 > 80 ? '#ef4444' : 'var(--text-primary)' }}>
                      {r.air_data?.pm25 ?? '—'}
                    </td>
                    <td className="font-mono" style={{ color: r.air_data?.aqi > 200 ? '#f97316' : 'var(--text-primary)' }}>
                      {r.air_data?.aqi ?? '—'}
                    </td>
                    <td>
                      <span className="text-xs capitalize" style={{
                        color: r.status === 'approved' ? '#14b369' : r.status === 'flagged' ? '#ef4444' : 'var(--text-muted)'
                      }}>{r.status}</span>
                    </td>
                    <td><ComplianceBadge status={r.is_compliant ? 'compliant' : 'violation'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Alerts */}
          <div className="card p-5">
            <SectionHeader title="My Alerts" />
            <AlertsPanel limit={8} />
          </div>
        </div>

        {/* Emission trends (air / water / noise) shared with officer view */}
        <div className="card p-5 mt-6">
          <SectionHeader title="My Emission Trends" subtitle="Same data visible to your regional officer" />
          {seriesLoading ? (
            <div className="flex items-center justify-center h-64">
              <Spinner />
            </div>
          ) : (!series.air.length && !series.water.length && !series.noise.length) ? (
            <Empty message="No recent emission data yet. Submit a report or enable auto-reporting." />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#14b369' }}>
                  Air Emissions
                </h4>
                <PollutantBarChart data={series.air} height={220} />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#0ea5e9' }}>
                  Water Pollution
                </h4>
                <WaterTrendChart data={series.water} height={220} />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#f97316' }}>
                  Noise Levels
                </h4>
                <NoiseTrendChart data={series.noise} height={220} />
              </div>
            </div>
          )}
        </div>
      </PageContent>

      {/* Submit Report Modal */}
      <Modal isOpen={showReportModal} onClose={() => { setShowReportModal(false); setReportModalMode('daily'); setPeriodEnd(''); setSubmitError(''); }}
        title="Submit Report" width="max-w-2xl">
        <div className="space-y-5">
          <div className="flex gap-2 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
            {['daily', 'weekly', 'monthly'].map((mode) => (
              <button
                key={mode}
                type="button"
                className="px-4 py-2 rounded-t text-sm font-medium capitalize"
                style={{
                  background: reportModalMode === mode ? 'rgba(20,179,105,0.2)' : 'transparent',
                  color: reportModalMode === mode ? '#14b369' : 'var(--text-muted)',
                  borderBottom: reportModalMode === mode ? '2px solid #14b369' : '2px solid transparent',
                }}
                onClick={() => { setReportModalMode(mode); setSubmitError(''); setSubmitSuccess(false); }}
              >
                {mode}
              </button>
            ))}
          </div>
          {submitError && <AlertBanner type="error" message={submitError} />}
          {submitSuccess && <AlertBanner type="success" message="Report submitted successfully!" />}

          {reportModalMode === 'weekly' || reportModalMode === 'monthly' ? (
            <form onSubmit={handleSubmitReport} className="space-y-5">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Generate a {reportModalMode} report from your daily data. The report will include charts, compliance score for the period, and summary figures for the regional officer.
              </p>
              <div>
                <label className="text-xs uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                  {reportModalMode === 'weekly' ? 'Week ending (date)' : 'Month ending (date)'}
                </label>
                <input
                  type="date"
                  className="input w-full"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {submitting ? <Spinner size="sm" /> : `Generate & Submit ${reportModalMode} report`}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setShowReportModal(false)}>Cancel</button>
              </div>
            </form>
          ) : (
        <form onSubmit={handleSubmitReport} className="space-y-5">
          {/* Air Data */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#14b369' }}>
              💨 Air Emissions (µg/m³)
            </h4>
            <div className="grid grid-cols-3 gap-3">
              {Object.keys(defaultAir).map((key) => (
                <div key={key}>
                  <label className="text-xs uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                    {key.toUpperCase()}
                  </label>
                  <input
                    className="input"
                    type="number" step="0.01" placeholder="—"
                    value={airData[key]}
                    onChange={(e) => setAirData({ ...airData, [key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Water Data */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#0ea5e9' }}>
              💧 Water Discharge (mg/L)
            </h4>
            <div className="grid grid-cols-3 gap-3">
              {Object.keys(defaultWater).map((key) => (
                <div key={key}>
                  <label className="text-xs uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                    {key.toUpperCase()}
                  </label>
                  <input
                    className="input"
                    type="number" step="0.01" placeholder="—"
                    value={waterData[key]}
                    onChange={(e) => setWaterData({ ...waterData, [key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Noise */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#f79009' }}>
              🔊 Noise Levels (dB)
            </h4>
            <div className="grid grid-cols-3 gap-3">
              {Object.keys(defaultNoise).map((key) => (
                <div key={key}>
                  <label className="text-xs uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                    {key.replace('_', ' ').toUpperCase()}
                  </label>
                  <input
                    className="input"
                    type="number" step="0.1" placeholder="—"
                    value={noiseData[key]}
                    onChange={(e) => setNoiseData({ ...noiseData, [key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2">
              {submitting ? <Spinner size="sm" /> : 'Submit Daily Report'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setShowReportModal(false)}>
              Cancel
            </button>
          </div>
        </form>
          )}
        </div>
      </Modal>
    </>
  );
}
