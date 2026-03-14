import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip, Polygon } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { pollutionAPI } from '../../services/api';
import { getAQICategory } from '../../utils/helpers';
import { Spinner } from '../common/UI';

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

export const PollutionMap = ({ regionId, height = '500px' }) => {
  const [mapData, setMapData] = useState(null);
  const [pollutant, setPollutant] = useState('pm25');
  const [loading, setLoading] = useState(true);
  const [selectedStation, setSelectedStation] = useState(null);
  const [attribution, setAttribution] = useState(null);
  const [attributionLoading, setAttributionLoading] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const { data } = await pollutionAPI.getMap({ region_id: regionId, pollutant });
        setMapData(data.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
    const interval = setInterval(fetch, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, [regionId, pollutant]);

  const runAttribution = useCallback(async (station) => {
    if (!station?.coordinates?.length) return;
    setSelectedStation(station);
    setAttribution(null);
    const [lng, lat] = station.coordinates; // [lng, lat]
    setAttributionLoading(true);
    try {
      const { data } = await pollutionAPI.getAttribution({
        latitude: lat,
        longitude: lng,
        region_id: regionId || undefined,
        pollutant,
      });
      setAttribution(data.data || null);
    } catch (e) {
      console.error(e);
      setAttribution({ attribution: [], note: 'Failed to load attribution.' });
    } finally {
      setAttributionLoading(false);
    }
  }, [regionId, pollutant]);

  const topCulprit = useMemo(() => {
    const list = attribution?.attribution;
    if (!Array.isArray(list) || list.length === 0) return null;
    return list[0];
  }, [attribution]);

  const getColor = (value) => {
    if (value == null) return '#6b7280';
    if (pollutant === 'aqi') {
      const { color } = getAQICategory(value);
      return color;
    }
    // PM2.5 thresholds
    if (value <= 30) return '#22c55e';
    if (value <= 60) return '#84cc16';
    if (value <= 90) return '#eab308';
    if (value <= 120) return '#f97316';
    if (value <= 200) return '#ef4444';
    return '#9333ea';
  };

  const getRadius = (value) => {
    if (value == null) return 8;
    return Math.min(28, Math.max(8, (value / 150) * 24));
  };

  const center = [21.2514, 81.6296]; // default Chhattisgarh

  const getComplianceColor = (score) => {
    if (score == null) return '#38bdf8';
    if (score <= 40) return '#ef4444';       // critical / very low
    if (score <= 70) return '#f97316';       // intermediate / warning
    return '#38bdf8';                        // good / default
  };

  return (
    <div className="card overflow-hidden" style={{ height }}>
      {/* Controls */}
      <div className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
        <div className="flex items-center gap-2">
          <span className="live-dot" />
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#14b369' }}>Live Map</span>
        </div>
        <select
          value={pollutant}
          onChange={(e) => setPollutant(e.target.value)}
          className="input text-xs"
          style={{ width: 'auto', padding: '5px 10px' }}
        >
          <option value="pm25">PM 2.5</option>
          <option value="pm10">PM 10</option>
          <option value="no2">NO₂</option>
          <option value="so2">SO₂</option>
          <option value="aqi">AQI</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center" style={{ height: 'calc(100% - 50px)' }}>
          <Spinner />
        </div>
      ) : (
        <MapContainer
          center={center}
          zoom={10}
          style={{ height: 'calc(100% - 50px)', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer url={TILE_URL} attribution="CartoDB" />

          {/* Station markers */}
          {mapData?.stations?.map((s) => (
            <CircleMarker
              key={s.id}
              center={[s.coordinates[1], s.coordinates[0]]}
              radius={getRadius(s.value)}
              eventHandlers={{ click: () => runAttribution(s) }}
              pathOptions={{
                color: getColor(s.value),
                fillColor: getColor(s.value),
                fillOpacity: 0.7,
                weight: 2,
              }}
            >
              <Tooltip sticky>
                <div style={{ fontFamily: 'DM Sans', fontSize: 13 }}>
                  <strong>{s.name}</strong>
                  <div>{pollutant.toUpperCase()}: <strong>{s.value ?? 'N/A'}</strong></div>
                  {s.aqi && <div>AQI: <strong>{s.aqi}</strong></div>}
                </div>
              </Tooltip>
              <Popup>
                <div style={{ fontFamily: 'DM Sans', fontSize: 13, minWidth: 160 }}>
                  <p style={{ fontWeight: 700, marginBottom: 4 }}>📡 {s.name}</p>
                  <p style={{ color: '#8899bb', marginBottom: 6 }}>{s.region}</p>
                  <div className="flex items-center justify-between">
                    <span>{pollutant.toUpperCase()}</span>
                    <strong style={{ color: getColor(s.value) }}>{s.value ?? '—'} µg/m³</strong>
                  </div>
                  {s.aqi && (
                    <div className="flex items-center justify-between mt-1">
                      <span>AQI</span>
                      <strong style={{ color: getAQICategory(s.aqi).color }}>{s.aqi}</strong>
                    </div>
                  )}
                  <div style={{ borderTop: '1px solid rgba(148,163,184,0.25)', marginTop: 8, paddingTop: 6 }}>
                    <div className="flex items-center justify-between gap-2">
                      <span style={{ color: '#14b369', fontSize: 11, fontWeight: 600 }}>Probable culprit (factory)</span>
                      <button
                        type="button"
                        onClick={() => runAttribution(s)}
                        className="text-[10px] px-2 py-0.5 rounded"
                        style={{ background: 'rgba(20,179,105,0.2)', color: '#14b369', border: '1px solid rgba(20,179,105,0.5)' }}
                      >
                        {String(selectedStation?.id) === String(s.id) && attributionLoading ? '…' : 'Detect'}
                      </button>
                    </div>
                    {String(selectedStation?.id) === String(s.id) && attributionLoading && (
                      <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>Detecting likely source…</div>
                    )}
                    {String(selectedStation?.id) === String(s.id) && !attributionLoading && topCulprit && (
                      <div style={{ marginTop: 6, padding: 6, borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                        <div style={{ color: '#fca5a5', fontSize: 12, fontWeight: 700 }}>🏭 {topCulprit.name}</div>
                        <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>
                          <strong style={{ color: '#00d4ff' }}>{topCulprit.probability_pct}%</strong> likely · {topCulprit.distance_km} km away
                        </div>
                      </div>
                    )}
                    {String(selectedStation?.id) === String(s.id) && !attributionLoading && attribution && !topCulprit && (
                      <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>
                        No likely industry found near this station.
                      </div>
                    )}
                  </div>
                  <p style={{ color: '#4a5875', fontSize: 11, marginTop: 6 }}>
                    {s.timestamp ? new Date(s.timestamp).toLocaleTimeString() : 'No recent reading'}
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          ))}

          {/* Industry boundary polygons (approved industries) */}
          {mapData?.industry_polygons?.map((ind) => {
            const c = getComplianceColor(ind.compliance_score);
            return (
              <Polygon
                key={ind.id}
                positions={ind.boundary_polygon}
                pathOptions={{
                  color: c,
                  weight: 2,
                  fillColor: c,
                  fillOpacity: 0.15,
                }}
              >
                <Popup>
                  <div style={{ fontFamily: 'DM Sans', fontSize: 13, minWidth: 160 }}>
                    <p style={{ fontWeight: 700 }}>🏭 {ind.name}</p>
                    <p style={{ color: '#8899bb', textTransform: 'capitalize' }}>{ind.type?.replace('_', ' ')}</p>
                    {ind.compliance_score != null && (
                      <div className="mt-1">
                        <span style={{ color: '#a1a1aa', fontSize: 11 }}>Compliance score:</span>{' '}
                        <strong style={{ color: c }}>{ind.compliance_score}</strong>
                      </div>
                    )}
                  </div>
                </Popup>
              </Polygon>
            );
          })}
        </MapContainer>
      )}

      {/* Legend */}
      <div className="flex items-center gap-3 px-4 py-2 border-t text-xs"
        style={{ borderColor: 'var(--border)', background: 'rgba(0,0,0,0.3)' }}>
        <span style={{ color: 'var(--text-muted)' }}>Level:</span>
        {[
          { color: '#22c55e', label: 'Good' },
          { color: '#84cc16', label: 'Satisfactory' },
          { color: '#eab308', label: 'Moderate' },
          { color: '#f97316', label: 'Poor' },
          { color: '#ef4444', label: 'Very Poor' },
          { color: '#9333ea', label: 'Severe' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1 ml-2">
          <span className="w-2.5 h-2.5 rounded-full border border-dashed" style={{ borderColor: '#14b369' }} />
          <span style={{ color: 'var(--text-secondary)' }}>Industry</span>
        </div>
      </div>

      {/* Attribution panel under map */}
      {selectedStation && (
        <div
          className="px-4 py-3 border-t"
          style={{ borderColor: 'var(--border)', background: 'rgba(0,0,0,0.35)' }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold tracking-[0.18em] uppercase" style={{ color: '#14b369' }}>
                Attribution
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Station:{' '}
                <span style={{ color: 'var(--text-secondary)' }}>{selectedStation.name}</span> ·{' '}
                {pollutant.toUpperCase()}
              </div>
            </div>
            {attributionLoading ? (
              <Spinner />
            ) : (
              <button
                type="button"
                onClick={() => runAttribution(selectedStation)}
                className="text-xs px-3 py-1.5 rounded"
                style={{ background: '#14b369', color: '#02140b' }}
              >
                Re-run
              </button>
            )}
          </div>

          {!attributionLoading && attribution?.attribution?.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              {attribution.attribution.slice(0, 5).map((a) => (
                <div key={String(a.industry_id)} className="flex items-center justify-between gap-3">
                  <div style={{ minWidth: 0 }}>
                    <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      🏭 {a.name}
                    </div>
                    <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                      {a.distance_km} km · {a.industry_type?.replace('_', ' ')}
                    </div>
                  </div>
                  <div className="text-sm font-bold" style={{ color: '#00d4ff' }}>
                    {a.probability_pct}%
                  </div>
                </div>
              ))}
              {attribution?.note && (
                <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  {attribution.note}
                </div>
              )}
            </div>
          )}

          {!attributionLoading && attribution && (!attribution.attribution || attribution.attribution.length === 0) && (
            <div className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              No likely industries found near this station.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
