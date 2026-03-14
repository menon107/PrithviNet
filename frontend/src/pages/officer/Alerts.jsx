import React, { useEffect, useState } from 'react';
import { PageHeader, PageContent } from '../../components/common/Layout';
import { Empty, PageLoader } from '../../components/common/UI';
import { forecastAPI } from '../../services/api';
import { formatDate } from '../../utils/helpers';

const TYPE_LABELS = {
  air: 'Air quality',
  water: 'Water quality',
  noise: 'Noise',
  aqi: 'AQI',
  general: 'Forecast',
};

export default function OfficerForecastAlerts() {
  const [forecasts, setForecasts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchForecasts = async () => {
    setLoading(true);
    try {
      const { data } = await forecastAPI.getAll({ limit: 50 });
      setForecasts(data.data || []);
    } catch (e) {
      console.error(e);
      setForecasts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchForecasts(); }, []);

  return (
    <>
      <PageHeader
        title="Forecasts"
        subtitle="AI and model-based forecasts for air and water quality (shown instead of legacy alerts)."
      />
      <PageContent>
        {loading ? (
          <PageLoader />
        ) : forecasts.length === 0 ? (
          <Empty message="No forecasts available." icon="📡" />
        ) : (
          <div className="flex flex-col gap-3">
            {forecasts.map((f) => {
              const displayDate = f.forecast_time || f.generated_at || f.forecast_date || f.date || f.created_at;
              const typeStr = (f.forecast_type || f.type || 'general').replace(/^\w/, (c) => c.toUpperCase());
              const typeLabel = TYPE_LABELS[f.type] || `${typeStr} forecast`;
              const location = f.region_id?.name || f.industry_id?.name;
              const pm25 = f.pm25 ?? f.data?.pm25;
              const pm10 = f.pm10 ?? f.data?.pm10;
              const summary = [pm25 != null && `PM2.5: ${Math.round(pm25)}`, pm10 != null && `PM10: ${Math.round(pm10)}`].filter(Boolean).join(' · ');
              return (
                <div
                  key={f._id}
                  className="card p-4 flex flex-col gap-1"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {f.title || `${typeLabel}`}
                      </div>
                      <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        {typeStr}
                        {location && ` · ${location}`}
                      </div>
                    </div>
                    {displayDate && (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {formatDate(displayDate)}
                      </span>
                    )}
                  </div>
                  {(f.message || summary) && (
                    <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                      {f.message || summary}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </PageContent>
    </>
  );
}
