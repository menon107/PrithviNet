import React, { useEffect, useState } from 'react';
import { PageHeader, PageContent } from '../../components/common/Layout';
import { StatCard, SectionHeader, LiveIndicator, Empty, PageLoader } from '../../components/common/UI';
import { AlertsPanel } from '../../components/alerts/AlertsPanel';
import { AQITrendChart, PollutantBarChart } from '../../components/charts/Charts';
import { industriesAPI, regionsAPI, reportsAPI, pollutionAPI, alertsAPI, complaintsAPI } from '../../services/api';
import { ComplianceBadge } from '../../components/common/UI';
import { formatDate, INDUSTRY_TYPE_LABELS } from '../../utils/helpers';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [regions, setRegions] = useState([]);
  const [topPolluters, setTopPolluters] = useState([]);
  const [airData, setAirData] = useState([]);
  const [meta, setMeta] = useState({ regions: 0, industries: 0, activeAlerts: 0, flaggedIndustries: 0, pendingComplaints: 0 });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [
          regRes,
          pollutersRes,
          summaryRes,
          airRes,
          allIndRes,
          alertsRes,
          complaintsRes,
        ] = await Promise.all([
          regionsAPI.getAll(),
          industriesAPI.getTopPolluters({ limit: 8 }),
          pollutionAPI.getSummary(),
          pollutionAPI.getAir({ from_date: new Date(Date.now() - 30 * 86400000).toISOString() }),
          industriesAPI.getAll({ page: 1, limit: 1 }),
          alertsAPI.getAll({ status: 'active', limit: 200 }).catch(() => ({ data: { data: [] } })),
          complaintsAPI.getAll({ status: 'pending', limit: 1 }).catch(() => ({ data: { data: [], pagination: { total: 0 } } })),
        ]);
        const regionList = regRes.data?.data || [];
        const topList = pollutersRes.data?.data || [];
        const industryPagination = allIndRes.data?.pagination;
        const industriesTotal = industryPagination?.total ?? (allIndRes.data?.data?.length || 0);
        const alertsList = alertsRes.data?.data || [];
        const complaintsList = complaintsRes.data?.data || [];
        const complaintsTotal = complaintsRes.data?.pagination?.total ?? complaintsList.length;

        setRegions(regionList);
        setTopPolluters(topList);
        setStats(summaryRes.data?.data || null);
        setAirData(airRes.data?.data || []);
        setMeta({
          regions: regionList.length,
          industries: industriesTotal,
          activeAlerts: alertsList.length,
          flaggedIndustries: topList.length,
          pendingComplaints: complaintsTotal,
        });
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetchAll();
  }, []);

  if (loading) return <PageLoader />;

  return (
    <>
      <PageHeader
        title="State Dashboard"
        subtitle="Maharashtra Pollution Control Board — Real-time overview"
        actions={<LiveIndicator />}
      />
      <PageContent>
        {/* National overview widgets */}
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-7">
          <StatCard
            title="Regions Monitored"
            value={meta.regions || '—'}
            icon="🗺"
            color="#0ea5e9"
            subtitle="Total active regions"
          />
          <StatCard
            title="Industries Registered"
            value={meta.industries || '—'}
            icon="🏭"
            color="#22c55e"
            subtitle="Across all regions"
          />
          <StatCard
            title="Active Alerts"
            value={meta.activeAlerts || 0}
            icon="🚨"
            color="#f97316"
            subtitle="Environment & compliance"
          />
          <StatCard
            title="Flagged Industries"
            value={meta.flaggedIndustries || 0}
            icon="⚠"
            color="#ef4444"
            subtitle="Top polluters"
          />
          <StatCard
            title="Citizen Complaints"
            value={meta.pendingComplaints || 0}
            icon="📣"
            color="#a855f7"
            subtitle="Pending review"
          />
        </div>

        {/* Air/compliance stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
          <StatCard title="Avg AQI (7d)" value={stats?.air?.avg_aqi ? parseFloat(stats.air.avg_aqi).toFixed(0) : '—'}
            icon="💨" color="#14b369" subtitle="State average" />
          <StatCard title="Peak PM 2.5" value={stats?.air?.max_pm25 ? parseFloat(stats.air.max_pm25).toFixed(0) : '—'}
            unit="µg/m³" icon="🔴" color="#ef4444" subtitle="7-day maximum" />
          <StatCard title="Violations (7d)" value={stats?.violations ?? '—'}
            icon="⚠" color="#f79009" subtitle={`of ${stats?.total_reports ?? '—'} reports`} />
          <StatCard title="Compliance Rate" value={stats?.compliance_rate ?? '—'}
            unit="%" icon="✅" color="#22c55e" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-7">
          {/* Air trend chart */}
          <div className="xl:col-span-2 card p-5">
            <SectionHeader title="Air Quality Trend — 30 Days" subtitle="Aggregated across all regions" />
            <AQITrendChart data={airData} height={220} />
          </div>

          {/* Alerts */}
          <div className="card p-5">
            <SectionHeader title="Active Alerts"
              action={
                <button onClick={() => navigate('/admin/alerts')}
                  className="text-xs" style={{ color: '#14b369', background: 'none', border: 'none', cursor: 'pointer' }}>
                  View all →
                </button>
              }
            />
            <AlertsPanel limit={6} showResolve />
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Top Polluters */}
          <div className="card p-5">
            <SectionHeader title="Top Polluters" subtitle="Ranked by compliance score" />
            {topPolluters.length === 0 ? <Empty /> : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Industry</th>
                    <th>Type</th>
                    <th>Region</th>
                    <th>Status</th>
                    <th className="text-right">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {topPolluters.map((ind) => (
                    <tr key={ind._id} style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/admin/industries/${ind._id}`)}>
                      <td className="font-semibold" style={{ color: 'var(--text-primary)' }}>{ind.name}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{INDUSTRY_TYPE_LABELS[ind.industry_type]}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{ind.region_id?.name || '—'}</td>
                      <td><ComplianceBadge status={ind.compliance_status} /></td>
                      <td className="text-right font-mono font-bold"
                        style={{ color: ind.compliance_score < 60 ? '#ef4444' : ind.compliance_score < 80 ? '#f79009' : '#14b369' }}>
                        {ind.compliance_score}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Regions overview */}
          <div className="card p-5">
            <SectionHeader title="Regions" subtitle="All monitored districts"
              action={
                <button onClick={() => navigate('/admin/regions')}
                  className="text-xs" style={{ color: '#14b369', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Manage →
                </button>
              }
            />
            <div className="flex flex-col gap-2 mt-1">
              {regions.map((region) => (
                <div key={region._id}
                  onClick={() => navigate(`/admin/regions/${region._id}`)}
                  className="flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}
                >
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{region.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{region.state}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {region.monitoring_stations?.length || 0} stations
                    </p>
                    {region.regional_officer_id && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {region.regional_officer_id.name}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pollutant bar chart */}
        <div className="card p-5 mt-6">
          <SectionHeader title="Daily Pollutant Levels — Last 14 Days" subtitle="Multi-pollutant comparison across all industries" />
          <PollutantBarChart data={airData} height={220} />
        </div>
      </PageContent>
    </>
  );
}
