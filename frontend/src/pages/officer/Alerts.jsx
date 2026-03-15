import React, { useEffect, useState, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { PageHeader, PageContent } from '../../components/common/Layout';
import { Empty, PageLoader, SectionHeader } from '../../components/common/UI';
import {
  ForecastChart,
  WaterTrendChart,
  NoiseTrendChart,
  AirSnapshotChart,
  WaterSnapshotChart,
  NoiseSnapshotChart,
  getReadingInsight,
} from '../../components/charts/Charts';
import { forecastAPI, reportsAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/helpers';

const TYPE_LABELS = {
  air: 'Air quality',
  water: 'Water quality',
  noise: 'Noise',
  aqi: 'AQI',
  general: 'Forecast',
};

// Build full metrics summary from forecast (f.data + top-level)
function forecastFullSummary(f) {
  const d = f.data || {};
  const air = {
    pm25: f.pm25 ?? d.pm25,
    pm10: f.pm10 ?? d.pm10,
    so2: d.so2,
    no2: d.no2,
    co: d.co,
    temperature: d.temperature,
    humidity: d.humidity,
  };
  const water = { ph: d.ph, bod: d.bod, cod: d.cod, tss: d.tss, turbidity: d.turbidity };
  const noise = { day_db: d.day_db, night_db: d.night_db, peak_db: d.peak_db };
  const parts = [];
  Object.entries(air).forEach(([k, v]) => { if (v != null) parts.push(`${k === 'pm25' ? 'PM2.5' : k === 'pm10' ? 'PM10' : k}: ${typeof v === 'number' ? v.toFixed(2) : v}`); });
  Object.entries(water).forEach(([k, v]) => { if (v != null) parts.push(`${k}: ${typeof v === 'number' ? v.toFixed(2) : v}`); });
  Object.entries(noise).forEach(([k, v]) => { if (v != null) parts.push(`${k}: ${typeof v === 'number' ? v.toFixed(1) : v}`); });
  return parts.join(' · ');
}

export default function OfficerForecastAlerts() {
  const { user } = useAuth();
  const regionId = user?.region_id?._id || user?.region_id;
  const [forecasts, setForecasts] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [googleLatLng, setGoogleLatLng] = useState({ lat: 21.25, lng: 81.63 });
  const [googleForecast, setGoogleForecast] = useState([]);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState('');
  const aqiMapContainerRef = useRef(null);
  const aqiMapRef = useRef(null);
  const aqiMarkerRef = useRef(null);
  const [aqiMapTokenPaste, setAqiMapTokenPaste] = useState('');
  const effectiveMapToken = (process.env.REACT_APP_MAPBOX_TOKEN || '').trim() || (aqiMapTokenPaste || '').trim();

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

  const fetchGoogleAqiForecast = async (clickedLat, clickedLng) => {
    const lat = clickedLat ?? googleLatLng.lat;
    const lng = clickedLng ?? googleLatLng.lng;
    const key = process.env.REACT_APP_GOOGLE_AQI_KEY || '';
    console.log('[Google AQI Forecast] Key present:', !!key, '| lat:', lat, 'lng:', lng);
    if (!key) {
      setGoogleError('Set REACT_APP_GOOGLE_AQI_KEY in your environment to use Google AQI forecast.');
      return;
    }
    setGoogleLatLng({ lat, lng });
    setGoogleLoading(true);
    setGoogleError('');
    setGoogleForecast([]);
    // API requires dateTime = future time (next hour, up to 96 hours ahead)
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setUTCHours(nextHour.getUTCHours() + 1);
    nextHour.setUTCMinutes(0, 0, 0);
    const dateTime = nextHour.toISOString().slice(0, 19) + 'Z';
    const body = {
      location: {
        latitude: lat,
        longitude: lng,
      },
      dateTime,
      pageSize: 48,
      languageCode: 'en',
      extraComputations: ['HEALTH_RECOMMENDATIONS'],
      universalAqi: true,
    };
    console.log('[Google AQI Forecast] Request body:', JSON.stringify(body, null, 2));
    try {
      const url = `https://airquality.googleapis.com/v1/forecast:lookup?key=${key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      console.log('[Google AQI Forecast] Response status:', res.status, res.statusText, 'ok:', res.ok);
      if (!res.ok) {
        const errText = await res.text();
        console.error('[Google AQI Forecast] Error response body:', errText);
        try {
          const errJson = JSON.parse(errText);
          console.error('[Google AQI Forecast] Parsed error:', errJson);
        } catch (_) {}
        setGoogleError(`Google AQI API error: ${res.status}. Check console for details.`);
        setGoogleLoading(false);
        return;
      }
      const data = await res.json();
      console.log('[Google AQI Forecast] Response keys:', Object.keys(data), '| hourlyForecasts length:', data.hourlyForecasts?.length ?? data.forecast?.length ?? 'n/a');
      if (data.hourlyForecasts?.length) {
        console.log('[Google AQI Forecast] First hour sample:', data.hourlyForecasts[0]);
      }
      const hours = data.hourlyForecasts || data.forecast || [];
      const series = hours
        .map((h) => {
          const dt = h.dateTime || h.datetime || h.time;
          if (!dt) return null;
          const idx =
            (h.indexes && h.indexes.find((i) => i.code === 'uaqi')) ||
            (h.indexes && h.indexes[0]) ||
            null;
          const aqi = idx?.aqi ?? null;
          if (aqi == null) return null;
          const iso = new Date(dt).toISOString();
          return {
            date: iso.slice(0, 16).replace('T', ' '),
            pm25: null,
            aqi: { value: Math.round(aqi) },
          };
        })
        .filter(Boolean);
      console.log('[Google AQI Forecast] Parsed series length:', series.length);
      setGoogleForecast(series);
    } catch (e) {
      console.error('[Google AQI Forecast] Caught error:', e?.message ?? e);
      console.error('[Google AQI Forecast] Error name:', e?.name, 'stack:', e?.stack);
      if (e?.cause) console.error('[Google AQI Forecast] Cause:', e.cause);
      setGoogleError(`Failed to fetch Google AQI forecast. ${e?.message || ''} Check console.`);
    } finally {
      setGoogleLoading(false);
    }
  };

  // Map for Google AQI: click to select location and fetch forecast (init when token + container available)
  useEffect(() => {
    if (!effectiveMapToken || !aqiMapContainerRef.current || aqiMapRef.current) return;
    const center = [googleLatLng.lng, googleLatLng.lat];
    mapboxgl.accessToken = effectiveMapToken;
    const map = new mapboxgl.Map({
      container: aqiMapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center,
      zoom: 6,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
    aqiMapRef.current = map;
    const marker = new mapboxgl.Marker({ color: '#0ea5e9' })
      .setLngLat(center)
      .addTo(map);
    aqiMarkerRef.current = marker;
    map.on('click', (e) => {
      const { lat, lng } = e.lngLat;
      if (aqiMarkerRef.current) aqiMarkerRef.current.setLngLat([lng, lat]);
      fetchGoogleAqiForecast(lat, lng);
    });
    return () => {
      map.remove();
      aqiMapRef.current = null;
      aqiMarkerRef.current = null;
    };
  }, [effectiveMapToken]);

  useEffect(() => {
    if (!regionId) { setReportsLoading(false); return; }
    let cancelled = false;
    reportsAPI.getByRegion(regionId, { limit: 100 })
      .then(({ data }) => {
        if (cancelled) return;
        const list = data.data || [];
        const byIndustry = {};
        list.forEach((r) => {
          const id = r.industry_id?._id || r.industry_id;
          if (!id) return;
          if (!byIndustry[id] || new Date(r.date) > new Date(byIndustry[id].date)) {
            byIndustry[id] = r;
          }
        });
        setReports(Object.values(byIndustry));
      })
      .catch(() => { if (!cancelled) setReports([]); })
      .finally(() => { if (!cancelled) setReportsLoading(false); });
    return () => { cancelled = true; };
  }, [regionId]);

  const classifyType = (f) => (f.type || f.forecast_type || 'general');

  const extractDate = (f) => {
    const d =
      f.forecast_time ||
      f.forecast_date ||
      f.date ||
      f.generated_at ||
      f.created_at;
    if (!d) return null;
    try {
      return new Date(d).toISOString().slice(0, 10);
    } catch {
      return null;
    }
  };

  const airForecasts = forecasts.filter((f) => {
    const t = classifyType(f);
    return t === 'air' || t === 'aqi' || t === 'general';
  });
  const waterForecasts = forecasts.filter((f) => classifyType(f) === 'water');
  const noiseForecasts = forecasts.filter((f) => classifyType(f) === 'noise');

  const groupedAirByIndustry = airForecasts.reduce((acc, f) => {
    const ind = f.industry_id;
    if (!ind) return acc;
    const key = ind._id || ind;
    if (!acc[key]) {
      acc[key] = { industry: ind, items: [] };
    }
    acc[key].items.push(f);
    return acc;
  }, {});

  const airIndustryGroups = Object.values(groupedAirByIndustry);

  // Aggregate series for charts by medium
  const airSeries = airForecasts
    .map((f) => {
      const date = extractDate(f);
      if (!date) return null;
      const pm25Val =
        f.pm25?.value ??
        f.pm25 ??
        f.data?.pm25?.value ??
        f.data?.pm25;
      const aqiVal =
        f.aqi?.value ??
        f.aqi ??
        f.data?.aqi?.value ??
        f.data?.aqi;
      if (pm25Val == null && aqiVal == null) return null;
      return {
        date,
        pm25: { value: pm25Val },
        aqi: { value: aqiVal ?? null },
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.date > b.date ? 1 : -1));

  const waterChartData = waterForecasts
    .map((f) => {
      const date = extractDate(f);
      if (!date) return null;
      const d = f.data || {};
      return {
        date,
        avg_ph: d.ph ?? d.pH ?? null,
        avg_bod: d.bod ?? null,
        avg_cod: d.cod ?? null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.date > b.date ? 1 : -1));

  const noiseChartData = noiseForecasts
    .map((f) => {
      const date = extractDate(f);
      if (!date) return null;
      const d = f.data || {};
      return {
        date,
        avg_day_db: d.day_db ?? d.day ?? null,
        avg_night_db: d.night_db ?? d.night ?? null,
        max_peak_db: d.peak_db ?? d.peak ?? null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.date > b.date ? 1 : -1));

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
          <>
            {/* Latest readings by industry — full metrics, graphs, insight */}
            {(reportsLoading || reports.length > 0) && (
              <div className="card p-5 mb-6">
                <SectionHeader
                  title="Latest readings by industry"
                  subtitle="All air, water and noise metrics from latest reports — graphs and insights"
                />
                {reportsLoading ? (
                  <PageLoader />
                ) : reports.length === 0 ? (
                  <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>No report readings in your region yet.</p>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 mt-3">
                    {reports.map((r) => {
                      const air = r.air_data || {};
                      const water = r.water_data || {};
                      const noise = r.noise_data || {};
                      const ind = r.industry_id;
                      const name = ind?.name || 'Industry';
                      const insight = getReadingInsight(air, water, noise);
                      return (
                        <div
                          key={r._id}
                          className="card p-4 flex flex-col gap-3"
                          style={{ borderColor: 'var(--border)' }}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                              {name}
                            </div>
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {formatDate(r.date)}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)', letterSpacing: 1 }}>AIR</div>
                              <AirSnapshotChart air={air} height={160} />
                              {(air.temperature != null || air.humidity != null) && (
                                <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                                  {air.temperature != null && `Temp: ${Number(air.temperature).toFixed(1)}°C`}
                                  {air.temperature != null && air.humidity != null && ' · '}
                                  {air.humidity != null && `Humidity: ${Number(air.humidity).toFixed(0)}%`}
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)', letterSpacing: 1 }}>WATER</div>
                              <WaterSnapshotChart water={water} height={160} />
                            </div>
                            <div>
                              <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)', letterSpacing: 1 }}>NOISE</div>
                              <NoiseSnapshotChart noise={noise} height={160} />
                            </div>
                          </div>
                          <div className="text-xs rounded-lg p-2 mt-1" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Insight: </span>
                            {insight}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Google AQI forecast: click map to get forecast for that location */}
            <div className="card p-5 mb-6">
              <SectionHeader
                title="Google AQI forecast"
                subtitle="Click a location on the map to fetch the 48‑hour AQI forecast for that point (Google Air Quality API)"
              />
              {!effectiveMapToken ? (
                <div className="py-4 space-y-3">
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Set REACT_APP_MAPBOX_TOKEN in <code className="text-xs px-1 rounded" style={{ background: 'var(--bg-secondary)' }}>frontend/.env</code> and restart the dev server, or paste your Mapbox token below:
                  </p>
                  <input
                    type="password"
                    placeholder="pk.eyJ1..."
                    value={aqiMapTokenPaste}
                    onChange={(e) => setAqiMapTokenPaste(e.target.value)}
                    className="w-full max-w-md rounded-md border px-3 py-2 text-sm bg-transparent"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    The map will load as soon as the field contains a token. Get one at mapbox.com.
                  </p>
                </div>
              ) : (
                <>
                  <div className="relative rounded-lg overflow-hidden border mt-2" style={{ height: 320, borderColor: 'var(--border)' }}>
                    <div ref={aqiMapContainerRef} className="w-full h-full" />
                    <div
                      className="absolute top-2 left-2 px-2 py-1 rounded text-xs font-medium"
                      style={{ background: 'rgba(7,9,15,0.85)', color: '#94a3b8' }}
                    >
                      Click map to select location
                    </div>
                    {googleLoading && (
                      <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{ background: 'rgba(0,0,0,0.4)' }}
                      >
                        <PageLoader />
                      </div>
                    )}
                  </div>
                  {googleError && (
                    <p className="text-xs mt-2" style={{ color: '#f97316' }}>
                      {googleError}
                    </p>
                  )}
                  {googleForecast.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                        Forecast for {googleLatLng.lat.toFixed(4)}, {googleLatLng.lng.toFixed(4)}
                      </p>
                      <ForecastChart data={googleForecast} height={220} />
                      <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                        Data source: Google Air Quality API (universal AQI).
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* High-level air / water / noise forecast charts */}
            {(airSeries.length > 0 || waterChartData.length > 0 || noiseChartData.length > 0) && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                {airSeries.length > 0 && (
                  <div className="card p-4">
                    <SectionHeader
                      title="Air Forecast"
                      subtitle="PM2.5 and AQI outlook"
                    />
                    <ForecastChart data={airSeries} height={220} />
                  </div>
                )}
                {waterChartData.length > 0 && (
                  <div className="card p-4">
                    <SectionHeader
                      title="Water Forecast"
                      subtitle="pH, BOD, COD trend (forecast)"
                    />
                    <WaterTrendChart data={waterChartData} height={220} />
                  </div>
                )}
                {noiseChartData.length > 0 && (
                  <div className="card p-4">
                    <SectionHeader
                      title="Noise Forecast"
                      subtitle="Day, night and peak dB (forecast)"
                    />
                    <NoiseTrendChart data={noiseChartData} height={220} />
                  </div>
                )}
              </div>
            )}

            {/* Air forecasts: per-industry charts */}
            {airIndustryGroups.length > 0 && (
              <div className="card p-5 mb-6">
                <SectionHeader
                  title="Industry Forecasts"
                  subtitle="Per-industry PM2.5 and AQI forecast curves for your region"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                  {airIndustryGroups.map((group) => {
                    const series = group.items
                      .map((f) => {
                        const date =
                          f.forecast_time ||
                          f.forecast_date ||
                          f.date ||
                          f.generated_at ||
                          f.created_at;
                        const pm25Val =
                          f.pm25?.value ??
                          f.pm25 ??
                          f.data?.pm25?.value ??
                          f.data?.pm25;
                        const aqiVal =
                          f.aqi?.value ??
                          f.aqi ??
                          f.data?.aqi?.value ??
                          f.data?.aqi;
                        if (!date || pm25Val == null) return null;
                        return {
                          date: new Date(date).toISOString().slice(0, 10),
                          pm25: { value: pm25Val },
                          aqi: { value: aqiVal ?? null },
                        };
                      })
                      .filter(Boolean)
                      .sort((a, b) => (a.date > b.date ? 1 : -1));

                    if (!series.length) return null;

                    return (
                      <div key={group.industry._id || group.industry} className="card p-4">
                        <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                          {group.industry.name || 'Industry forecast'}
                        </p>
                        <ForecastChart data={series} height={220} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Water forecasts */}
            {waterForecasts.length > 0 && (
              <div className="card p-5 mb-6">
                <SectionHeader
                  title="Water Quality Forecasts"
                  subtitle="Predicted pH, BOD, COD and turbidity for key industries"
                />
                <div className="flex flex-col gap-3 mt-2">
                  {waterForecasts.map((f) => {
                    const displayDate =
                      f.forecast_time ||
                      f.generated_at ||
                      f.forecast_date ||
                      f.date ||
                      f.created_at;
                    const location = f.region_id?.name || f.industry_id?.name;
                    const d = f.data || {};
                    const ph = d.ph ?? d.pH;
                    const bod = d.bod;
                    const cod = d.cod;
                    const turbidity = d.turbidity;
                    const summary = [
                      ph != null && `pH: ${ph.toFixed ? ph.toFixed(2) : ph}`,
                      bod != null && `BOD: ${Math.round(bod)} mg/L`,
                      cod != null && `COD: ${Math.round(cod)} mg/L`,
                      turbidity != null && `Turbidity: ${Math.round(turbidity)} NTU`,
                    ]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <div key={f._id} className="card p-4" style={{ borderColor: 'var(--border)' }}>
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                              {f.title || 'Water quality forecast'}
                            </div>
                            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                              Water{location && ` · ${location}`}
                            </div>
                          </div>
                          {displayDate && (
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {formatDate(displayDate)}
                            </span>
                          )}
                        </div>
                        {summary && (
                          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                            {summary}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Noise forecasts */}
            {noiseForecasts.length > 0 && (
              <div className="card p-5 mb-6">
                <SectionHeader
                  title="Noise Forecasts"
                  subtitle="Predicted day, night and peak noise levels"
                />
                <div className="flex flex-col gap-3 mt-2">
                  {noiseForecasts.map((f) => {
                    const displayDate =
                      f.forecast_time ||
                      f.generated_at ||
                      f.forecast_date ||
                      f.date ||
                      f.created_at;
                    const location = f.region_id?.name || f.industry_id?.name;
                    const d = f.data || {};
                    const day = d.day_db ?? d.day;
                    const night = d.night_db ?? d.night;
                    const peak = d.peak_db ?? d.peak;
                    const summary = [
                      day != null && `Day: ${Math.round(day)} dB`,
                      night != null && `Night: ${Math.round(night)} dB`,
                      peak != null && `Peak: ${Math.round(peak)} dB`,
                    ]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <div key={f._id} className="card p-4" style={{ borderColor: 'var(--border)' }}>
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                              {f.title || 'Noise forecast'}
                            </div>
                            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                              Noise{location && ` · ${location}`}
                            </div>
                          </div>
                          {displayDate && (
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {formatDate(displayDate)}
                            </span>
                          )}
                        </div>
                        {summary && (
                          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                            {summary}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Forecast list — all metrics from data (pm25, pm10, so2, no2, co, temp, humidity, ph, bod, cod, tss, turbidity, day_db, night_db, peak_db) */}
            <div className="flex flex-col gap-3">
              {forecasts.map((f) => {
                const displayDate =
                  f.forecast_time || f.generated_at || f.forecast_date || f.date || f.created_at;
                const typeStr = (f.forecast_type || f.type || 'general').replace(
                  /^\w/,
                  (c) => c.toUpperCase()
                );
                const typeLabel = TYPE_LABELS[f.type] || `${typeStr} forecast`;
                const location = f.region_id?.name || f.industry_id?.name;
                const fullSummary = forecastFullSummary(f);
                const fallbackSummary = (() => {
                  const pm25 = f.pm25 ?? f.data?.pm25;
                  const pm10 = f.pm10 ?? f.data?.pm10;
                  return [
                    pm25 != null && `PM2.5: ${Math.round(pm25)}`,
                    pm10 != null && `PM10: ${Math.round(pm10)}`,
                  ].filter(Boolean).join(' · ');
                })();
                const summary = fullSummary || fallbackSummary;
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
                      <p className="text-sm mt-1 break-words" style={{ color: 'var(--text-secondary)' }}>
                        {f.message || summary}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </PageContent>
    </>
  );
}
