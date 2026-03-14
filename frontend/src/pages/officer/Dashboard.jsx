import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, PageContent } from '../../components/common/Layout';
import { StatCard, SectionHeader, LiveIndicator, ComplianceBadge, PageLoader, AQIBadge, Spinner, Modal } from '../../components/common/UI';
import { AlertsPanel } from '../../components/alerts/AlertsPanel';
import { AQITrendChart, PollutantBarChart, WaterTrendChart, NoiseTrendChart } from '../../components/charts/Charts';
import WaterSimulationPane from '../../components/waterSimulation/WaterSimulationPane';
import { PollutionMap } from '../../components/maps/PollutionMap';
import { pollutionAPI, reportsAPI, industriesAPI, aiAPI, forecastAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { formatDate, INDUSTRY_TYPE_LABELS } from '../../utils/helpers';

export default function OfficerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const regionId = user?.region_id?._id || user?.region_id;

  const [summary, setSummary] = useState(null);
  const [airData, setAirData] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [missing, setMissing] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [forecasts, setForecasts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!regionId) return;
    const fetchAll = async () => {
      try {
        const [sumRes, airRes, indRes, missRes, inspRes, forecastRes] = await Promise.all([
          pollutionAPI.getSummary({ region_id: regionId }),
          pollutionAPI.getAir({ region_id: regionId, from_date: new Date(Date.now() - 30 * 86400000).toISOString() }),
          industriesAPI.getAll({ region_id: regionId, limit: 10 }),
          reportsAPI.getMissing(),
          aiAPI.getInspectionOptimization({ region_id: regionId, top_n: 5 }),
          forecastAPI.getAll({ limit: 8, region_id: regionId }).catch((err) => {
            console.warn('Forecast fetch failed', err?.response?.status, err?.response?.data);
            return { data: { data: [] } };
          }),
        ]);
        setSummary(sumRes.data.data);
        setAirData(airRes.data.data);
        setIndustries(indRes.data.data);
        setMissing(missRes.data.data);
        setInspections(inspRes.data.data?.recommendations || []);
        setForecasts(Array.isArray(forecastRes?.data?.data) ? forecastRes.data.data : []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetchAll();
  }, [regionId]);

  if (loading) return <PageLoader />;

  return (
    <>
      <PageHeader
        title={`${user?.region_id?.name || 'Region'} — Officer Dashboard`}
        subtitle="Pollution monitoring and industry compliance"
        actions={<LiveIndicator />}
      />
      <PageContent>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
          <StatCard title="Avg AQI (7d)" value={summary?.air?.avg_aqi ? parseFloat(summary.air.avg_aqi).toFixed(0) : '—'} icon="💨" color="#14b369" />
          <StatCard title="PM 2.5 Avg" value={summary?.air?.avg_pm25 ? parseFloat(summary.air.avg_pm25).toFixed(0) : '—'} unit="µg/m³" icon="🌫" color="#f79009" />
          <StatCard title="Violations (7d)" value={summary?.violations ?? '—'} icon="⚠" color="#ef4444" />
          <StatCard title="Missing Reports" value={missing.length} icon="📋" color="#a78bfa" subtitle="Today" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-7">
          {/* Water quality & air (simulation + Google AQI) */}
          <div className="xl:col-span-2">
            <WaterSimulationPane
              height="420px"
              defaultCenter={regionId ? { lat: 21.13, lng: 81.5 } : undefined}
              regionId={regionId}
            />
          </div>

          {/* Alerts & Forecast */}
          <div className="card p-5">
            <SectionHeader title="Active Alerts" action={
              <button onClick={() => navigate('/officer/alerts')}
                className="text-xs" style={{ color: '#14b369', background: 'none', border: 'none', cursor: 'pointer' }}>
                All →
              </button>
            } />
            <AlertsPanel limit={6} showResolve forecasts={forecasts} />
          </div>
        </div>

        {/* Industries & monitoring stations map (region) */}
        <div className="mb-7">
          <SectionHeader title="Industries & monitoring stations" subtitle="Stations and industry boundaries by compliance in your region" />
          <PollutionMap regionId={regionId} height="420px" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
          {/* Industry list */}
          <div className="card p-5">
            <SectionHeader title="Industries" subtitle="Your region" action={
              <button onClick={() => navigate('/officer/industries')}
                className="text-xs" style={{ color: '#14b369', background: 'none', border: 'none', cursor: 'pointer' }}>
                View all →
              </button>
            } />
            <table className="data-table">
              <thead>
                <tr><th>Industry</th><th>Type</th><th>Status</th><th className="text-right">Score</th></tr>
              </thead>
              <tbody>
                {industries.map((ind) => (
                  <tr key={ind._id} style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/officer/industries/${ind._id}`)}>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{ind.name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{INDUSTRY_TYPE_LABELS[ind.industry_type]}</td>
                    <td><ComplianceBadge status={ind.compliance_status} /></td>
                    <td className="text-right font-mono font-bold"
                      style={{ color: ind.compliance_score < 60 ? '#ef4444' : ind.compliance_score < 80 ? '#f79009' : '#14b369' }}>
                      {ind.compliance_score}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* AI Inspection Recommendations */}
          <div className="card p-5">
            <SectionHeader title="🤖 Inspection Priority"
              subtitle="AI-recommended industries to inspect" />
            <div className="flex flex-col gap-2">
              {inspections.map((rec, i) => (
                <div key={rec.industry_id} className="flex items-start gap-3 p-3 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: i === 0 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)', color: i === 0 ? '#ef4444' : 'var(--text-muted)' }}>
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{rec.industry_name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{rec.reason}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs font-mono" style={{ color: '#f79009' }}>
                        Priority: {rec.priority_score}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Score: {rec.compliance_score}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Air trend + Industry reports */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="card p-5">
            <SectionHeader title="Air Quality Trend — 30 Days" />
            <AQITrendChart data={airData} height={220} />
          </div>
          <div className="card p-5">
            <SectionHeader title="Weekly & Monthly Reports" subtitle="Period reports from industries (charts, compliance, figures — not the live daily stream)" />
            <OfficerIndustryReports regionId={regionId} />
          </div>
        </div>
      </PageContent>
    </>
  );
}

function OfficerIndustryReports({ regionId }) {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [reportDetail, setReportDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!regionId) return;
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await reportsAPI.getByRegion(regionId, { reporting_period: 'weekly,monthly', limit: 20 });
        setReports(data.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [regionId]);

  useEffect(() => {
    if (!selectedReportId) {
      setReportDetail(null);
      return;
    }
    const fetchDetail = async () => {
      setDetailLoading(true);
      try {
        const { data } = await reportsAPI.getById(selectedReportId);
        setReportDetail(data.data);
      } catch (e) {
        console.error(e);
      } finally {
        setDetailLoading(false);
      }
    };
    fetchDetail();
  }, [selectedReportId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Spinner />
      </div>
    );
  }

  if (!reports.length) {
    return (
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        No weekly or monthly reports yet. Industries submit these from their dashboard (generated from daily data).
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Period</th>
            <th>Type</th>
            <th>Industry</th>
            <th>Compliance</th>
            <th>Air (avg)</th>
            <th>Water (avg)</th>
            <th>Noise (avg)</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((r) => (
            <tr
              key={r._id}
              style={{ cursor: 'pointer' }}
              onClick={() => setSelectedReportId(r._id)}
            >
              <td className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                {r.period_start && r.period_end
                  ? `${formatDate(r.period_start)} – ${formatDate(r.period_end)}`
                  : formatDate(r.date)}
              </td>
              <td className="capitalize">{r.reporting_period}</td>
              <td style={{ fontWeight: 500 }}>{r.industry_id?.name}</td>
              <td>
                <span className="font-mono font-bold" style={{ color: r.compliance_score >= 70 ? '#14b369' : r.compliance_score >= 40 ? '#f79009' : '#ef4444' }}>
                  {r.compliance_score ?? '—'}
                </span>
                <span className="ml-1"><ComplianceBadge status={r.is_compliant ? 'compliant' : 'violation'} /></span>
              </td>
              <td className="text-xs">PM2.5 {r.air_data?.pm25 ?? '—'}</td>
              <td className="text-xs">pH {r.water_data?.ph != null ? Number(r.water_data.ph).toFixed(1) : '—'}</td>
              <td className="text-xs">{r.noise_data?.day_db ?? '—'} dB</td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedReportId && (
        <Modal
          isOpen={!!selectedReportId}
          onClose={() => setSelectedReportId(null)}
          title={reportDetail ? `${reportDetail.industry_id?.name} — ${reportDetail.reporting_period} report` : 'Report detail'}
          width="max-w-4xl"
        >
          {detailLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : reportDetail ? (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-4 items-center">
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {reportDetail.period_start && reportDetail.period_end
                    ? `${formatDate(reportDetail.period_start)} – ${formatDate(reportDetail.period_end)}`
                    : formatDate(reportDetail.date)}
                </span>
                <span className="font-mono font-bold text-lg" style={{ color: reportDetail.compliance_score >= 70 ? '#14b369' : reportDetail.compliance_score >= 40 ? '#f79009' : '#ef4444' }}>
                  Compliance: {reportDetail.compliance_score ?? '—'}/100
                </span>
                <ComplianceBadge status={reportDetail.is_compliant ? 'compliant' : 'violation'} />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Summary figures (averages)</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="p-3 rounded border" style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                    <div className="text-xs uppercase text-green-400 mb-1">Air</div>
                    <div>PM2.5: {reportDetail.air_data?.pm25 ?? '—'}</div>
                    <div>PM10: {reportDetail.air_data?.pm10 ?? '—'}</div>
                    <div>SO₂: {reportDetail.air_data?.so2 ?? '—'}</div>
                    <div>NO₂: {reportDetail.air_data?.no2 ?? '—'}</div>
                  </div>
                  <div className="p-3 rounded border" style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                    <div className="text-xs uppercase text-blue-400 mb-1">Water</div>
                    <div>pH: {reportDetail.water_data?.ph != null ? Number(reportDetail.water_data.ph).toFixed(1) : '—'}</div>
                    <div>BOD: {reportDetail.water_data?.bod ?? '—'}</div>
                    <div>COD: {reportDetail.water_data?.cod ?? '—'}</div>
                    <div>TSS: {reportDetail.water_data?.tss ?? '—'}</div>
                  </div>
                  <div className="p-3 rounded border" style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                    <div className="text-xs uppercase text-amber-400 mb-1">Noise</div>
                    <div>Day: {reportDetail.noise_data?.day_db ?? '—'} dB</div>
                    <div>Night: {reportDetail.noise_data?.night_db ?? '—'} dB</div>
                    <div>Peak: {reportDetail.noise_data?.peak_db ?? '—'} dB</div>
                  </div>
                </div>
              </div>
              {reportDetail.summary_chart_data && reportDetail.summary_chart_data.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Pictorial (period trend)</h4>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs text-green-400 mb-1">Air</div>
                      <PollutantBarChart
                        data={reportDetail.summary_chart_data.map((d) => ({
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
                      <div className="text-xs text-blue-400 mb-1">Water</div>
                      <WaterTrendChart
                        data={reportDetail.summary_chart_data.map((d) => ({
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
                      <div className="text-xs text-amber-400 mb-1">Noise</div>
                      <NoiseTrendChart
                        data={reportDetail.summary_chart_data.map((d) => ({
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
              <div className="flex justify-end pt-2">
                <button type="button" className="btn-ghost" onClick={() => setSelectedReportId(null)}>Close</button>
              </div>
            </div>
          ) : null}
        </Modal>
      )}
    </div>
  );
}
