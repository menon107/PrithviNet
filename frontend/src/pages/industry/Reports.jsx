import React, { useEffect, useState } from 'react';
import { PageHeader, PageContent } from '../../components/common/Layout';
import { SectionHeader, PageLoader, Empty, ComplianceBadge, Spinner } from '../../components/common/UI';
import { reportsAPI, pollutionAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/helpers';
import { PollutantBarChart, WaterTrendChart, NoiseTrendChart } from '../../components/charts/Charts';

export default function IndustryReportsPage() {
  const { user } = useAuth();
  const industryId = user?.industry_id?._id || user?.industry_id;

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [series, setSeries] = useState({ air: [], water: [], noise: [] });
  const [seriesLoading, setSeriesLoading] = useState(false);

  // Load full report history for this industry
  useEffect(() => {
    if (!industryId) {
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await reportsAPI.getByIndustry(industryId, { limit: 100 });
        setReports(data.data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [industryId]);

  // Load aggregated air / water / noise history (same as officer view)
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
  }, [industryId]);

  if (loading) return <PageLoader />;

  return (
    <>
      <PageHeader
        title="Monitoring Reports"
        subtitle="Detailed history of your air, water, and noise submissions"
      />
      <PageContent>
        {/* Time-series charts */}
        <div className="card p-5 mb-6">
          <SectionHeader title="Emission History — Last 7 Days" />
          {seriesLoading ? (
            <div className="flex items-center justify-center h-64">
              <Spinner />
            </div>
          ) : (!series.air.length && !series.water.length && !series.noise.length) ? (
            <Empty message="No recent emission data yet. Stay on the dashboard for a few minutes or submit a report." />
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

        {/* Tabular history */}
        <div className="card p-5">
          <SectionHeader title="All Monitoring Reports" />
          {reports.length === 0 ? (
            <Empty message="No reports submitted yet for this industry." />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>PM2.5</th>
                    <th>PM10</th>
                    <th>SO₂</th>
                    <th>NO₂</th>
                    <th>pH</th>
                    <th>BOD</th>
                    <th>COD</th>
                    <th>Day dB</th>
                    <th>Night dB</th>
                    <th>Status</th>
                    <th>Compliance</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r._id}>
                      <td style={{ fontFamily: 'JetBrains Mono', color: 'var(--text-secondary)' }}>
                        {formatDate(r.date)}
                      </td>
                      <td>{r.air_data?.pm25 ?? '—'}</td>
                      <td>{r.air_data?.pm10 ?? '—'}</td>
                      <td>{r.air_data?.so2 ?? '—'}</td>
                      <td>{r.air_data?.no2 ?? '—'}</td>
                      <td>{r.water_data?.ph ?? '—'}</td>
                      <td>{r.water_data?.bod ?? '—'}</td>
                      <td>{r.water_data?.cod ?? '—'}</td>
                      <td>{r.noise_data?.day_db ?? '—'}</td>
                      <td>{r.noise_data?.night_db ?? '—'}</td>
                      <td>
                        <span className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>
                          {r.status}
                        </span>
                      </td>
                      <td>
                        <ComplianceBadge status={r.is_compliant ? 'compliant' : 'violation'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </PageContent>
    </>
  );
}
