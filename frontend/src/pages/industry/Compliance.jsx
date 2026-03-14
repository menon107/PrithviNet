import React, { useEffect, useState } from 'react';
import { PageHeader, PageContent } from '../../components/common/Layout';
import { StatCard, SectionHeader, ProgressBar, PageLoader } from '../../components/common/UI';
import { ComplianceScoreChart } from '../../components/charts/Charts';
import { industriesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function IndustryCompliance() {
  const { user } = useAuth();
  const industryId = user?.industry_id?._id || user?.industry_id;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!industryId) return;
    industriesAPI.getStats(industryId).then(({ data: d }) => { setData(d.data); setLoading(false); });
  }, [industryId]);

  if (loading) return <PageLoader />;

  const { industry, stats, trend } = data || {};
  const limits = industry?.region_id?.environmental_limits;

  return (
    <>
      <PageHeader title="Compliance Status" subtitle={industry?.name} />
      <PageContent>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
          <StatCard title="Compliance Score" value={stats?.avg_compliance_score} unit="/100" color="#14b369" />
          <StatCard title="Compliance Rate" value={stats?.compliance_rate} unit="%" color="#22c55e" />
          <StatCard title="Violation Days (30d)" value={stats?.violation_days} color="#ef4444" />
          <StatCard title="All-time Violations" value={stats?.all_time_violations} color="#f79009" />
        </div>
        <div className="card p-5 mb-6">
          <SectionHeader title="Score Trend — Last 14 Days" />
          <ComplianceScoreChart data={trend} height={200} />
        </div>
        {limits && (
          <div className="card p-5">
            <SectionHeader title="Your Emission Limits" subtitle="Regional environmental standards applicable to your facility" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#14b369' }}>💨 Air (µg/m³)</p>
                <div className="space-y-3">
                  {Object.entries(limits.air || {}).map(([k, v]) => (
                    <div key={k}>
                      <div className="flex justify-between text-xs mb-1">
                        <span style={{ color: 'var(--text-muted)', textTransform: 'uppercase' }}>{k}</span>
                        <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{v}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#0ea5e9' }}>💧 Water (mg/L)</p>
                <div className="space-y-3">
                  {Object.entries(limits.water || {}).map(([k, v]) => (
                    <div key={k}>
                      <div className="flex justify-between text-xs mb-1">
                        <span style={{ color: 'var(--text-muted)', textTransform: 'uppercase' }}>{k.replace('_',' ')}</span>
                        <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{v}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#f79009' }}>🔊 Noise (dB)</p>
                <div className="space-y-3">
                  {Object.entries(limits.noise || {}).map(([k, v]) => (
                    <div key={k}>
                      <div className="flex justify-between text-xs mb-1">
                        <span style={{ color: 'var(--text-muted)', textTransform: 'uppercase' }}>{k.replace('_',' ')}</span>
                        <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{v}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </PageContent>
    </>
  );
}
