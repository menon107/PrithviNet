import React, { useEffect, useState } from 'react';
import { forecastAPI } from '../../services/api';
import { formatDate } from '../../utils/helpers';

const FORECAST_TYPE_LABELS = { air: 'Air', water: 'Water', noise: 'Noise', aqi: 'AQI', general: 'Forecast' };

export const AlertsPanel = ({ limit = 8 }) => {
  const [forecasts, setForecasts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchForecasts = async () => {
    try {
      const { data } = await forecastAPI.getAll({ limit });
      setForecasts(data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchForecasts(); }, []);

  if (loading) return (
    <div className="flex flex-col gap-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-14 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
      ))}
    </div>
  );

  const hasForecasts = Array.isArray(forecasts) && forecasts.length > 0;

  if (!hasForecasts) return (
    <div className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
      ✓ No active alerts or forecasts
    </div>
  );

  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
        📡 Forecast
      </div>
      {forecasts.slice(0, limit).map((f) => {
        const displayDate = f.forecast_time || f.generated_at || f.forecast_date || f.date || f.created_at;
        const typeLabel = (f.forecast_type || f.type || 'general').replace(/^\w/, (c) => c.toUpperCase());
        const label = f.title || f.message || (f.data?.aqi != null ? `AQI ${f.data.aqi}` : null) || `${FORECAST_TYPE_LABELS[f.type] || typeLabel} forecast`;
        const pm25 = f.pm25 ?? f.data?.pm25;
        const pm10 = f.pm10 ?? f.data?.pm10;
        const sub = f.message && f.title ? f.message : (pm25 != null ? `PM2.5 ${Math.round(pm25)}` : null) || (pm10 != null ? `PM10 ${Math.round(pm10)}` : null);
        const location = f.region_id?.name || f.industry_id?.name;
        return (
          <div
            key={f._id}
            className="flex items-start gap-3 p-3 rounded-lg"
            style={{
              background: 'rgba(0,212,255,0.04)',
              border: '1px solid rgba(0,212,255,0.12)',
            }}
          >
            <span className="text-lg flex-shrink-0 mt-0.5">📡</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{label}</p>
              {(sub || location) && (
                <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
                  {sub}
                  {location && ` · ${location}`}
                </p>
              )}
              {displayDate && (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(displayDate)}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
