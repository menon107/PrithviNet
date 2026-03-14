import React, { useState, useEffect } from 'react';
import { PageHeader, PageContent } from '../../components/common/Layout';
import { SectionHeader, StatCard, AlertBanner, Spinner, Modal, PageLoader } from '../../components/common/UI';
import { aiAPI, industriesAPI, regionsAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const ResultCard = ({ label, baseline, predicted, unit = '' }) => {
  const diff = predicted != null && baseline != null ? predicted - baseline : null;
  const pct = diff != null && baseline ? ((diff / baseline) * 100).toFixed(1) : null;
  const improved = diff < 0;
  return (
    <div className="card p-4 text-center">
      <p className="text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <div className="flex items-center justify-center gap-4">
        <div>
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Baseline</div>
          <div className="stat-number text-2xl" style={{ color: 'var(--text-secondary)' }}>
            {baseline ?? '—'}<span className="text-sm ml-0.5">{unit}</span>
          </div>
        </div>
        <div className="text-xl">→</div>
        <div>
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Predicted</div>
          <div className="stat-number text-2xl" style={{ color: improved ? '#14b369' : '#ef4444' }}>
            {predicted ?? '—'}<span className="text-sm ml-0.5">{unit}</span>
          </div>
        </div>
      </div>
      {pct && (
        <div className="mt-2 text-sm font-semibold" style={{ color: improved ? '#14b369' : '#ef4444' }}>
          {improved ? '↓' : '↑'} {Math.abs(pct)}% {improved ? 'reduction' : 'increase'}
        </div>
      )}
    </div>
  );
};

export default function SimulationPage() {
  const { user } = useAuth();
  const [industries, setIndustries] = useState([]);
  const [regions, setRegions] = useState([]);
  const [simulations, setSimulations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [activeResult, setActiveResult] = useState(null);

  const regionId = user?.region_id?._id || user?.region_id;

  const [form, setForm] = useState({
    name: '',
    type: 'emission_reduction',
    region_id: regionId || '',
    industries: [],
    timeframe_days: 7,
  });

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [indRes, regRes, simRes] = await Promise.all([
          industriesAPI.getAll({ region_id: regionId, limit: 50 }),
          regionsAPI.getAll(),
          aiAPI.getSimulations({ region_id: regionId }),
        ]);
        setIndustries(indRes.data.data);
        setRegions(regRes.data.data);
        setSimulations(simRes.data.data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetchAll();
  }, [regionId]);

  const toggleIndustry = (id) => {
    const exists = form.industries.find((i) => i.industry_id === id);
    if (exists) {
      setForm({ ...form, industries: form.industries.filter((i) => i.industry_id !== id) });
    } else {
      setForm({ ...form, industries: [...form.industries, { industry_id: id, reduction_percent: 30 }] });
    }
  };

  const updateReduction = (id, val) => {
    setForm({
      ...form,
      industries: form.industries.map((i) => i.industry_id === id ? { ...i, reduction_percent: parseInt(val) } : i),
    });
  };

  const handleRun = async () => {
    if (!form.name || !form.industries.length) {
      setError('Please name the simulation and select at least one industry.');
      return;
    }
    setRunning(true); setError('');
    try {
      const { data } = await aiAPI.runSimulation({ ...form, parameters: { industries: form.industries, timeframe_days: form.timeframe_days } });
      // Poll for result
      let sim = data.data;
      let attempts = 0;
      while (sim.results?.status === 'pending' || sim.results?.status === 'running') {
        await new Promise((r) => setTimeout(r, 1500));
        const res = await aiAPI.getSimulation(sim._id);
        sim = res.data.data;
        if (++attempts > 15) break;
      }
      setActiveResult(sim);
      setSimulations((prev) => [sim, ...prev]);
    } catch (err) {
      setError(err.response?.data?.message || 'Simulation failed.');
    } finally { setRunning(false); }
  };

  if (loading) return <PageLoader />;

  return (
    <>
      <PageHeader
        title="🧪 Digital Twin Simulator"
        subtitle="Model emission interventions and predict regional impact"
      />
      <PageContent>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Configuration Panel */}
          <div className="card p-6">
            <SectionHeader title="Configure Simulation" />
            <div className="space-y-5">
              {error && <AlertBanner type="error" message={error} />}

              <div>
                <label className="text-xs uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Simulation Name
                </label>
                <input className="input" placeholder="e.g. 30% Steel Reduction — Q2 2025"
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>Type</label>
                  <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    <option value="emission_reduction">Emission Reduction</option>
                    <option value="plant_shutdown">Plant Shutdown</option>
                    <option value="policy_change">Policy Change</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Timeframe (days)
                  </label>
                  <input className="input" type="number" min={1} max={90}
                    value={form.timeframe_days}
                    onChange={(e) => setForm({ ...form, timeframe_days: parseInt(e.target.value) })} />
                </div>
              </div>

              {user?.role === 'super_admin' && (
                <div>
                  <label className="text-xs uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>Region</label>
                  <select className="input" value={form.region_id} onChange={(e) => setForm({ ...form, region_id: e.target.value })}>
                    <option value="">Select region</option>
                    {regions.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs uppercase tracking-wider block mb-2" style={{ color: 'var(--text-muted)' }}>
                  Select Industries ({form.industries.length} selected)
                </label>
                <div className="flex flex-col gap-2 max-h-52 overflow-y-auto">
                  {industries.map((ind) => {
                    const selected = form.industries.find((i) => i.industry_id === ind._id);
                    return (
                      <div key={ind._id}
                        className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all"
                        style={{
                          background: selected ? 'rgba(20,179,105,0.08)' : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${selected ? 'rgba(20,179,105,0.3)' : 'var(--border)'}`,
                        }}
                        onClick={() => toggleIndustry(ind._id)}
                      >
                        <input type="checkbox" readOnly checked={!!selected}
                          style={{ accentColor: '#14b369' }} />
                        <div className="flex-1">
                          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{ind.name}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Score: {ind.compliance_score}</p>
                        </div>
                        {selected && form.type === 'emission_reduction' && (
                          <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Reduce:</span>
                            <input
                              type="number" min={5} max={100} step={5}
                              value={selected.reduction_percent}
                              onChange={(e) => updateReduction(ind._id, e.target.value)}
                              className="input text-xs w-16"
                              style={{ padding: '4px 8px' }}
                            />
                            <span className="text-xs" style={{ color: '#14b369' }}>%</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <button className="btn-primary w-full flex items-center justify-center gap-2 py-3"
                onClick={handleRun} disabled={running}>
                {running ? (
                  <><Spinner size="sm" /> Running simulation...</>
                ) : '▶ Run Simulation'}
              </button>
            </div>
          </div>

          {/* Results Panel */}
          <div>
            {activeResult ? (
              <div className="card p-6">
                <SectionHeader title={activeResult.name} subtitle={`${activeResult.type?.replace('_', ' ')} · ${activeResult.parameters?.timeframe_days}d`} />

                {activeResult.results?.status === 'completed' ? (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-3">
                      <ResultCard label="AQI" baseline={activeResult.results.baseline?.aqi}
                        predicted={activeResult.results.predicted?.aqi} />
                      <ResultCard label="PM 2.5" baseline={activeResult.results.baseline?.pm25}
                        predicted={activeResult.results.predicted?.pm25} unit="µg/m³" />
                      <ResultCard label="NO₂" baseline={activeResult.results.baseline?.no2}
                        predicted={activeResult.results.predicted?.no2} unit="µg/m³" />
                      <ResultCard label="SO₂" baseline={activeResult.results.baseline?.so2}
                        predicted={activeResult.results.predicted?.so2} unit="µg/m³" />
                    </div>

                    {activeResult.results.health_impact && (
                      <div className="card p-4" style={{ background: 'rgba(20,179,105,0.06)', borderColor: 'rgba(20,179,105,0.2)' }}>
                        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#14b369' }}>
                          🏥 Health Impact
                        </p>
                        <div className="grid grid-cols-2 gap-4 text-center">
                          <div>
                            <div className="stat-number text-2xl" style={{ color: '#14b369' }}>
                              {activeResult.results.health_impact.affected_population?.toLocaleString()}
                            </div>
                            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Population benefited</div>
                          </div>
                          <div>
                            <div className="stat-number text-2xl" style={{ color: '#14b369' }}>
                              {activeResult.results.health_impact.health_risk_reduction_percent}%
                            </div>
                            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Health risk reduction</div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                      <span>Method: {activeResult.results.method}</span>
                      <span>Confidence: {activeResult.results.confidence_score
                        ? `${(activeResult.results.confidence_score * 100).toFixed(0)}%` : '—'}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-12 gap-3">
                    <Spinner />
                    <span style={{ color: 'var(--text-secondary)' }}>Processing simulation…</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="card p-6 flex flex-col items-center justify-center text-center" style={{ minHeight: 300 }}>
                <div className="text-4xl mb-3">🧪</div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>No simulation run yet</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Configure and run a simulation to see predicted pollution impact
                </p>
              </div>
            )}

            {/* Past simulations */}
            {simulations.length > 0 && (
              <div className="card p-5 mt-4">
                <SectionHeader title="Past Simulations" />
                <div className="flex flex-col gap-2">
                  {simulations.slice(0, 5).map((sim) => (
                    <div key={sim._id}
                      onClick={() => setActiveResult(sim)}
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{sim.name}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {sim.type?.replace('_', ' ')} · {new Date(sim.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="text-xs px-2 py-1 rounded"
                        style={{
                          background: sim.results?.status === 'completed' ? 'rgba(20,179,105,0.1)' : 'rgba(255,255,255,0.05)',
                          color: sim.results?.status === 'completed' ? '#14b369' : 'var(--text-muted)',
                        }}>
                        {sim.results?.status || 'unknown'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </PageContent>
    </>
  );
}
