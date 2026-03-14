import React, { useEffect, useState } from 'react';
import { PageHeader, PageContent } from '../../components/common/Layout';
import { SectionHeader, AQIBadge, StatCard, Modal, AlertBanner, Spinner, Empty } from '../../components/common/UI';
import { PollutionMap } from '../../components/maps/PollutionMap';
import { ForecastChart } from '../../components/charts/Charts';
import { pollutionAPI, industriesAPI, complaintsAPI, aiAPI, regionsAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { getAQICategory, INDUSTRY_TYPE_LABELS, formatDate } from '../../utils/helpers';

export default function CitizenDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [topPolluters, setTopPolluters] = useState([]);
  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showComplaint, setShowComplaint] = useState(false);
  const [complaint, setComplaint] = useState({ title: '', description: '', category: 'air_pollution', is_anonymous: false });
  const [submitting, setSubmitting] = useState(false);
  const [complaintDone, setComplaintDone] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const [regRes, sumRes, forecastRes, polRes] = await Promise.all([
          regionsAPI.getAll(),
          pollutionAPI.getSummary(),
          aiAPI.getAirForecast({ hours: 72 }),
          industriesAPI.getTopPolluters({ limit: 10 }),
        ]);
        setRegions(regRes.data.data);
        setSummary(sumRes.data.data);
        setForecast(forecastRes.data.data?.forecast || []);
        setTopPolluters(polRes.data.data);
        if (regRes.data.data.length) setSelectedRegion(regRes.data.data[0]._id);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    init();
  }, []);

  const aqi = summary?.air?.avg_aqi ? Math.round(parseFloat(summary.air.avg_aqi)) : null;
  const { label: aqiLabel, color: aqiColor, bg: aqiBg } = getAQICategory(aqi);

  const handleComplaint = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await complaintsAPI.submit({ ...complaint, region_id: selectedRegion });
      setComplaintDone(true);
      setTimeout(() => setShowComplaint(false), 1500);
    } catch (err) {
      console.error(err);
    } finally { setSubmitting(false); }
  };

  return (
    <>
      <PageHeader
        title="Air Quality Portal"
        subtitle="Public environmental transparency dashboard"
        actions={
          <button className="btn-primary text-sm" onClick={() => setShowComplaint(true)}>
            📣 Report Issue
          </button>
        }
      />
      <PageContent>
        {/* AQI Hero */}
        <div className="card p-6 mb-7 flex flex-col md:flex-row items-center gap-6"
          style={{ background: `linear-gradient(135deg, ${aqiBg}, rgba(0,0,0,0))`, borderColor: `${aqiColor}30` }}>
          <div className="text-center md:text-left">
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>
              Current Air Quality Index (7-day avg)
            </p>
            <div className="stat-number text-7xl" style={{ color: aqiColor }}>{aqi ?? '—'}</div>
            <div className="text-xl mt-1 font-semibold" style={{ color: aqiColor }}>{aqiLabel}</div>
          </div>
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Avg PM 2.5" value={summary?.air?.avg_pm25 ? parseFloat(summary.air.avg_pm25).toFixed(1) : '—'}
              unit="µg/m³" color="#f79009" />
            <StatCard title="Peak PM 2.5" value={summary?.air?.max_pm25 ? parseFloat(summary.air.max_pm25).toFixed(1) : '—'}
              unit="µg/m³" color="#ef4444" />
            <StatCard title="Reports (7d)" value={summary?.total_reports ?? '—'} color="#0ea5e9" />
            <StatCard title="Compliance" value={summary?.compliance_rate ?? '—'} unit="%" color="#14b369" />
          </div>
        </div>

        {/* Region selector */}
        <div className="flex items-center gap-3 mb-5">
          <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Region:</span>
          <div className="flex gap-2 flex-wrap">
            {regions.map((r) => (
              <button
                key={r._id}
                onClick={() => setSelectedRegion(r._id)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: selectedRegion === r._id ? 'rgba(20,179,105,0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${selectedRegion === r._id ? 'rgba(20,179,105,0.4)' : 'var(--border)'}`,
                  color: selectedRegion === r._id ? '#14b369' : 'var(--text-secondary)',
                }}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-7">
          <PollutionMap regionId={selectedRegion} height="420px" />

          <div className="card p-5">
            <SectionHeader title="🤖 72-Hour Forecast" subtitle="AI-powered pollution prediction" />
            {forecast.length ? (
              <>
                <ForecastChart data={forecast} height={200} />
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {forecast.slice(0, 3).map((f) => {
                    const { color } = getAQICategory(f.aqi?.value);
                    return (
                      <div key={f.date} className="text-center p-3 rounded-lg"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                        <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{f.date?.slice(5)}</p>
                        <p className="stat-number text-xl" style={{ color }}>
                          {f.aqi?.value ?? '—'}
                        </p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                          PM2.5: {f.pm25?.value ?? '—'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : <Empty message="Forecast unavailable" icon="📡" />}
          </div>
        </div>

        {/* Top Polluters public view */}
        <div className="card p-5">
          <SectionHeader title="Industry Compliance — Public Record"
            subtitle="Industries monitored in your region" />
          <table className="data-table">
            <thead>
              <tr>
                <th>Industry</th>
                <th>Type</th>
                <th>Compliance Score</th>
                <th>Violations</th>
                <th>Status</th>
                <th>Last Report</th>
              </tr>
            </thead>
            <tbody>
              {topPolluters.map((ind) => (
                <tr key={ind._id}>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{ind.name}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{INDUSTRY_TYPE_LABELS[ind.industry_type]}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="flex-1" style={{ maxWidth: 80 }}>
                        <div className="w-full h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
                          <div className="h-1.5 rounded-full" style={{
                            width: `${ind.compliance_score}%`,
                            background: ind.compliance_score > 80 ? '#14b369' : ind.compliance_score > 60 ? '#f79009' : '#ef4444',
                          }} />
                        </div>
                      </div>
                      <span className="font-mono text-xs">{ind.compliance_score}</span>
                    </div>
                  </td>
                  <td className="font-mono" style={{ color: ind.total_violations > 10 ? '#ef4444' : 'var(--text-secondary)' }}>
                    {ind.total_violations}
                  </td>
                  <td>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold
                      ${ind.compliance_status === 'compliant' ? 'badge-compliant' :
                        ind.compliance_status === 'warning' ? 'badge-warning' :
                        ind.compliance_status === 'violation' ? 'badge-violation' : 'badge-critical'}`}>
                      {ind.compliance_status}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono', fontSize: 12 }}>
                    {formatDate(ind.last_report_date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageContent>

      {/* Complaint Modal */}
      <Modal isOpen={showComplaint} onClose={() => setShowComplaint(false)} title="📣 Report a Pollution Issue">
        <form onSubmit={handleComplaint} className="space-y-4">
          {complaintDone && <AlertBanner type="success" message="Complaint submitted. Thank you!" />}
          <div>
            <label className="text-xs uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Category
            </label>
            <select className="input" value={complaint.category}
              onChange={(e) => setComplaint({ ...complaint, category: e.target.value })}>
              <option value="air_pollution">Air Pollution</option>
              <option value="water_pollution">Water Pollution</option>
              <option value="noise_pollution">Noise Pollution</option>
              <option value="illegal_dumping">Illegal Dumping</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>Title</label>
            <input className="input" placeholder="Brief title of the issue"
              value={complaint.title}
              onChange={(e) => setComplaint({ ...complaint, title: e.target.value })}
              required />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Description
            </label>
            <textarea className="input" rows={4} placeholder="Describe what you observed..."
              value={complaint.description}
              onChange={(e) => setComplaint({ ...complaint, description: e.target.value })}
              required style={{ resize: 'vertical' }} />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={complaint.is_anonymous}
              onChange={(e) => setComplaint({ ...complaint, is_anonymous: e.target.checked })} />
            Submit anonymously
          </label>
          <div className="flex gap-3 pt-1">
            <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2">
              {submitting ? <Spinner size="sm" /> : 'Submit Complaint'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setShowComplaint(false)}>Cancel</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
