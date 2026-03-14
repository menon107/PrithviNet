import React, { useEffect, useState } from 'react';
import { PageHeader, PageContent } from '../../components/common/Layout';
import { SectionHeader, StatCard, PageLoader } from '../../components/common/UI';
import { ForecastChart } from '../../components/charts/Charts';
import { aiAPI } from '../../services/api';
import { getAQICategory } from '../../utils/helpers';

export default function CitizenForecast() {
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    aiAPI.getAirForecast({ hours: 72 }).then(({ data }) => {
      setForecast(data.data?.forecast || []); setLoading(false);
    });
  }, []);
  if (loading) return <PageLoader />;
  return (
    <>
      <PageHeader title="72-Hour Air Quality Forecast" subtitle="AI-powered pollution prediction for your region" />
      <PageContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-7">
          {forecast.slice(0, 3).map(f => {
            const { color, label } = getAQICategory(f.aqi?.value);
            return (
              <div key={f.date} className="card p-5 text-center">
                <p className="text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>{f.date}</p>
                <div className="stat-number text-5xl mb-1" style={{ color }}>{f.aqi?.value ?? '—'}</div>
                <div className="text-sm font-semibold mb-3" style={{ color }}>{label}</div>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>PM 2.5</span><span className="font-mono" style={{ color: 'var(--text-primary)' }}>{f.pm25?.value ?? '—'} µg/m³</span></div>
                  <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Range</span><span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{f.pm25?.lower}–{f.pm25?.upper}</span></div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="card p-5">
          <SectionHeader title="Forecast Chart" subtitle="PM 2.5 prediction with confidence interval" />
          <ForecastChart data={forecast} height={300} />
        </div>
      </PageContent>
    </>
  );
}
