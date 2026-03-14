import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, PageContent } from '../../components/common/Layout';
import { SectionHeader, ComplianceBadge, Spinner, Empty } from '../../components/common/UI';
import { industriesAPI, reportsAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { INDUSTRY_TYPE_LABELS } from '../../utils/helpers';
import { PollutantBarChart, WaterTrendChart, NoiseTrendChart } from '../../components/charts/Charts';

export default function OfficerIndustries() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const regionId = user?.region_id?._id || user?.region_id;

  const [industries, setIndustries] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState('air'); // 'air' | 'water' | 'noise'
  const [series, setSeries] = useState({ air: [], water: [], noise: [] });
  const [loadingSeries, setLoadingSeries] = useState(false);

  // Load industries for officer's region
  useEffect(() => {
    if (!regionId) {
      setLoadingList(false);
      return;
    }
    const load = async () => {
      setLoadingList(true);
      try {
        const { data } = await industriesAPI.getAll({ region_id: regionId, limit: 50 });
        const industryData = data.data || [];
        setIndustries(industryData);
        if (!selected && industryData.length > 0) {
          setSelected(industryData[0]);
        }
      } catch (e) {
        console.error("Error loading industries:", e);
      } finally {
        setLoadingList(false);
      }
    };
    load();
  }, [regionId]);

  // Load time-series for selected industry, based on the same raw reports
  // that the industry dashboard uses. We hit /reports/industry/:id and
  // shape the data into the aggregated format expected by the shared charts.
  useEffect(() => {
    if (!selected?._id) return;

    const fetchSeries = async () => {
      setLoadingSeries(true);
      try {
        const { data } = await reportsAPI.getByIndustry(selected._id, { limit: 100 });
        const reports = data.data || [];

        const airSeries = reports.map((r) => ({
          _id: new Date(r.date).toISOString().slice(0, 10),
          avg_pm25: r.air_data?.pm25 ?? null,
          avg_pm10: r.air_data?.pm10 ?? null,
          avg_so2:  r.air_data?.so2  ?? null,
          avg_no2:  r.air_data?.no2  ?? null,
        }));

        const waterSeries = reports.map((r) => ({
          _id: new Date(r.date).toISOString().slice(0, 10),
          avg_ph:   r.water_data?.ph   ?? null,
          avg_bod:  r.water_data?.bod  ?? null,
          avg_cod:  r.water_data?.cod  ?? null,
          avg_tss:  r.water_data?.tss  ?? null,
        }));

        const noiseSeries = reports.map((r) => ({
          _id: new Date(r.date).toISOString().slice(0, 10),
          avg_day_db:   r.noise_data?.day_db   ?? null,
          avg_night_db: r.noise_data?.night_db ?? null,
          max_peak_db:  r.noise_data?.peak_db  ?? null,
        }));

        setSeries({
          air: airSeries,
          water: waterSeries,
          noise: noiseSeries,
        });
      } catch (e) {
        console.error('Error fetching industry reports for officer view:', e);
      } finally {
        setLoadingSeries(false);
      }
    };

    fetchSeries();
    const id = setInterval(fetchSeries, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [selected?._id]);

  // Helper to render the appropriate table for the active tab,
  // using the same aggregated format as the officer charts.
  const renderDataTable = () => {
    const data = series[activeTab];
    if (!data || data.length === 0) {
      return <Empty message={`No ${activeTab} records found.`} />;
    }

    return (
      <div className="mt-6 overflow-x-auto border rounded-lg">
        <table className="data-table w-full text-sm">
          <thead className="bg-opacity-10 bg-gray-500">
            <tr>
              <th className="text-left p-3">Date</th>
              {activeTab === 'air' && (
                <>
                  <th>Avg PM2.5</th>
                  <th>Avg PM10</th>
                  <th>Avg SO₂</th>
                  <th>Avg NO₂</th>
                </>
              )}
              {activeTab === 'water' && (
                <>
                  <th>Avg pH</th>
                  <th>Avg BOD</th>
                  <th>Avg COD</th>
                  <th>Avg TSS</th>
                </>
              )}
              {activeTab === 'noise' && (
                <>
                  <th>Avg Day dB</th>
                  <th>Avg Night dB</th>
                  <th>Max Peak dB</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 10).map((item, idx) => (
              <tr key={item._id || idx} className="border-t border-gray-700">
                <td className="p-3 text-xs opacity-70">
                  {/* _id is "YYYY-MM-DD" from aggregate */}
                  {item._id || item.date}
                </td>
                {activeTab === 'air' && (
                  <>
                    <td>{item.avg_pm25 != null ? item.avg_pm25.toFixed(1) : '—'}</td>
                    <td>{item.avg_pm10 != null ? item.avg_pm10.toFixed(1) : '—'}</td>
                    <td>{item.avg_so2 != null ? item.avg_so2.toFixed(1) : '—'}</td>
                    <td>{item.avg_no2 != null ? item.avg_no2.toFixed(1) : '—'}</td>
                  </>
                )}
                {activeTab === 'water' && (
                  <>
                    <td>{item.avg_ph != null ? item.avg_ph.toFixed(2) : '—'}</td>
                    <td>{item.avg_bod != null ? item.avg_bod.toFixed(1) : '—'}</td>
                    <td>{item.avg_cod != null ? item.avg_cod.toFixed(1) : '—'}</td>
                    <td>{item.avg_tss != null ? item.avg_tss.toFixed(1) : '—'}</td>
                  </>
                )}
                {activeTab === 'noise' && (
                  <>
                    <td>{item.avg_day_db != null ? item.avg_day_db.toFixed(1) : '—'}</td>
                    <td>{item.avg_night_db != null ? item.avg_night_db.toFixed(1) : '—'}</td>
                    <td>{item.max_peak_db != null ? item.max_peak_db.toFixed(1) : '—'}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title="Industries"
        subtitle="Live emissions and compliance for industries in your region"
        actions={
          <button
            className="text-xs font-bold"
            style={{ color: '#14b369', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={() => navigate('/officer/industry-approvals')}
          >
            Incoming Requests →
          </button>
        }
      />
      <PageContent>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* Industry List Section */}
          <div className="card p-5">
            <SectionHeader title="Industries" subtitle="Click to view live data" />
            {loadingList ? (
              <div className="flex items-center justify-center h-40"><Spinner /></div>
            ) : industries.length === 0 ? (
              <Empty message="No industries found for your region." />
            ) : (
              <div className="max-h-[600px] overflow-y-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Industry</th>
                      <th>Status</th>
                      <th className="text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {industries.map((ind) => (
                      <tr
                        key={ind._id}
                        className="transition-colors"
                        style={{
                          cursor: 'pointer',
                          background: selected?._id === ind._id ? 'rgba(20,179,105,0.12)' : 'transparent',
                        }}
                        onClick={() => setSelected(ind)}
                      >
                        <td className="py-3">
                          <div className="font-semibold text-sm">{ind.name}</div>
                          <div className="text-[10px] opacity-50">{INDUSTRY_TYPE_LABELS[ind.industry_type]}</div>
                        </td>
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
            )}
          </div>

          {/* Details & Charts Section */}
          <div className="card p-5 xl:col-span-2">
            <SectionHeader
              title={selected ? selected.name : 'Select an industry'}
              subtitle={selected ? 'Monitoring history and live logs' : 'Choose an industry from the list'}
            />
            {!selected ? (
              <Empty message="Select an industry on the left to view metrics." />
            ) : loadingSeries ? (
              <div className="flex items-center justify-center h-64"><Spinner /></div>
            ) : (
              <>
                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                  {[
                    { id: 'air', label: 'Air' },
                    { id: 'water', label: 'Water' },
                    { id: 'noise', label: 'Noise' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className="px-4 py-1.5 rounded-full text-xs font-bold border transition-all"
                      style={{
                        background: activeTab === tab.id ? 'rgba(20,179,105,0.15)' : 'transparent',
                        borderColor: activeTab === tab.id ? '#14b369' : 'rgba(255,255,255,0.1)',
                        color: activeTab === tab.id ? '#14b369' : 'gray',
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Visual Charts */}
                <div className="min-h-[260px]">
                  {activeTab === 'air' && <PollutantBarChart data={series.air} height={260} />}
                  {activeTab === 'water' && <WaterTrendChart data={series.water} height={260} />}
                  {activeTab === 'noise' && <NoiseTrendChart data={series.noise} height={260} />}
                </div>

                {/* New Data Table Integration */}
                <div className="mt-8">
                   <h3 className="text-sm font-bold uppercase tracking-wider opacity-60">Recent Parameters Log</h3>
                   {renderDataTable()}
                </div>
              </>
            )}
          </div>
        </div>
      </PageContent>
    </>
  );
}