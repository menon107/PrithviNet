import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { regionsAPI, industriesAPI } from '../../services/api';
import { Spinner } from '../common/UI';

const INDUSTRY_IMPACT = {
  steel: { aqi: 52, noise: 14, wqi: -12, emoji: '🏗' },
  chemical: { aqi: 44, noise: 9, wqi: -18, emoji: '⚗' },
  cement: { aqi: 31, noise: 12, wqi: -6, emoji: '🏭' },
  textile: { aqi: 22, noise: 8, wqi: -14, emoji: '🧵' },
  power_plant: { aqi: 58, noise: 11, wqi: -8, emoji: '⚡' },
  refinery: { aqi: 46, noise: 10, wqi: -10, emoji: '🛢' },
  mining: { aqi: 38, noise: 15, wqi: -16, emoji: '⛏' },
  paper: { aqi: 28, noise: 9, wqi: -12, emoji: '📄' },
  pharmaceutical: { aqi: 24, noise: 7, wqi: -14, emoji: '💊' },
  food_processing: { aqi: 20, noise: 8, wqi: -8, emoji: '🍽' },
  other: { aqi: 26, noise: 7, wqi: -5, emoji: '🏺' },
};

const TOOLS = {
  shutdown: { label: 'Shut Down Industry', color: '#ff6b35', aqi: -1, noise: -1, wqi: 1, green: 0 },
  trees: { label: 'Plant Trees', color: '#00e5a0', aqi: -22, noise: -8, wqi: 5, green: 9 },
  treatment: { label: 'Water Treatment', color: '#3b9eff', aqi: -2, noise: -1, wqi: 30, green: 1 },
  traffic: { label: 'Traffic Restriction', color: '#f5a623', aqi: -28, noise: -18, wqi: 3, green: 2 },
  solar: { label: 'Solar Farm', color: '#fbbf24', aqi: -34, noise: -4, wqi: 2, green: 0 },
  wetland: { label: 'Restore Wetland', color: '#a78bfa', aqi: -9, noise: -5, wqi: 26, green: 7 },
};

function haversineKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(s));
}

function circlePolygon(lat, lng, radiusM, n = 52) {
  const R = 6371000;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI;
    const dLat = (radiusM * Math.cos(a)) / R * (180 / Math.PI);
    const dLng = (radiusM * Math.sin(a)) / (R * Math.cos(lat * Math.PI / 180)) * (180 / Math.PI);
    pts.push([lng + dLng, lat + dLat]);
  }
  return { type: 'Polygon', coordinates: [pts] };
}

function aqiLabel(v) {
  return v < 50 ? 'Good' : v < 100 ? 'Moderate' : v < 150 ? 'Unhealthy*' : v < 200 ? 'Unhealthy' : v < 300 ? 'Very Unhealthy' : 'Hazardous';
}
function wqiLabel(v) {
  return v >= 80 ? 'Pristine' : v >= 60 ? 'Good' : v >= 40 ? 'Fair' : v >= 20 ? 'Poor' : 'Critical';
}
function aqiColor(v) {
  return v < 50 ? '#00e5a0' : v < 100 ? '#a3e635' : v < 150 ? '#facc15' : v < 200 ? '#fb923c' : v < 300 ? '#ef4444' : '#a855f7';
}

const CHHATTISGARH_CENTER = { lng: 81.6296, lat: 21.2514 };

async function fetchGoogleAqi(lat, lng) {
  const key = process.env.REACT_APP_GOOGLE_AQI_KEY || '';
  if (!key) return null;
  const res = await fetch(
    `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: { latitude: lat, longitude: lng },
        universalAqi: true,
      }),
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const index = (data.indexes && data.indexes.find((i) => i.code === 'uaqi')) || data.indexes?.[0];
  return index?.aqi ?? null;
}

export default function EcoSim() {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const industryMarkersRef = useRef({});
  const industriesRef = useRef([]);
  const interventionsRef = useRef([]);
  const placingRef = useRef(false);
  const activeToolRef = useRef('shutdown');
  const placeInterventionRef = useRef(() => {});
  const radiusKmRef = useRef(2);
  const strengthPctRef = useRef(100);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [region, setRegion] = useState(null);
  const [industries, setIndustries] = useState([]);
  const [initialized, setInitialized] = useState(false);
  const [token, setToken] = useState(() => process.env.REACT_APP_MAPBOX_TOKEN || '');
  const [center, setCenter] = useState({ lat: CHHATTISGARH_CENTER.lat, lng: CHHATTISGARH_CENTER.lng });
  const [baseline, setBaseline] = useState({ aqi: 142, wqi: 38, noise: 74, green: 11 });
  const [current, setCurrent] = useState({ aqi: 142, wqi: 38, noise: 74, green: 11 });
  const [interventions, setInterventions] = useState([]);
  const [activeTool, setActiveTool] = useState('shutdown');
  const [placing, setPlacing] = useState(false);
  const [radiusKm, setRadiusKm] = useState(2);
  const [strengthPct, setStrengthPct] = useState(100);
  const [toast, setToast] = useState('');
  const [layerIndustry, setLayerIndustry] = useState(true);
  const [layerAqi, setLayerAqi] = useState(true);
  const [layerGreen, setLayerGreen] = useState(true);
  const [timelineMonths, setTimelineMonths] = useState(0);
  const [aqiLoading, setAqiLoading] = useState(false);

  industriesRef.current = industries;
  interventionsRef.current = interventions;
  placingRef.current = placing;
  activeToolRef.current = activeTool;
  radiusKmRef.current = radiusKm;
  strengthPctRef.current = strengthPct;

  // Resolve Chhattisgarh region and fetch its industries
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const regionsRes = await regionsAPI.getAll();
        const regions = regionsRes.data?.data || [];
        const chhattisgarh = regions.find(
          (r) => r.name && r.name.toLowerCase().includes('chhattisgarh')
        ) || regions[0];
        if (!chhattisgarh) {
          setError('No region found. Seed the database.');
          setLoading(false);
          return;
        }
        if (!cancelled) setRegion(chhattisgarh);

        const coords = chhattisgarh.coordinates?.coordinates;
        if (coords && coords.length >= 2) {
          if (!cancelled) setCenter({ lng: coords[0], lat: coords[1] });
        }
        if (chhattisgarh.center?.lat != null) setCenter((c) => ({ ...c, lat: chhattisgarh.center.lat }));
        if (chhattisgarh.center?.lng != null) setCenter((c) => ({ ...c, lng: chhattisgarh.center.lng }));

        const indRes = await industriesAPI.getAll({ region_id: chhattisgarh._id, limit: 50 });
        const raw = indRes.data?.data || [];
        const fallbackLng = coords?.[0] ?? CHHATTISGARH_CENTER.lng;
        const fallbackLat = coords?.[1] ?? CHHATTISGARH_CENTER.lat;
        const list = raw.map((ind, idx) => {
          let lng = ind.lng ?? ind.location?.coordinates?.[0];
          let lat = ind.lat ?? ind.location?.coordinates?.[1];
          if (lat == null || lng == null) {
            const offset = 0.02 * (idx + 1);
            lng = fallbackLng + (idx % 2 === 0 ? offset : -offset);
            lat = fallbackLat + (idx % 3 === 0 ? offset : -offset * 0.5);
          }
          const imp = INDUSTRY_IMPACT[ind.industry_type] || INDUSTRY_IMPACT.other;
          return {
            id: `${ind._id}-${idx}`,
            _rawId: ind._id,
            name: ind.name || 'Industry',
            type: ind.industry_type || 'other',
            lng: Number(lng),
            lat: Number(lat),
            aqi: imp.aqi,
            noise: imp.noise,
            wqi: imp.wqi,
            emoji: imp.emoji,
            active: true,
          };
        });

        if (!cancelled) setIndustries(list);
      } catch (e) {
        console.error(e);
        if (!cancelled) setError('Failed to load region or industries.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!region || center.lat == null || center.lng == null) return;
    fetchGoogleAqi(center.lat, center.lng).then((aqi) => {
      if (aqi != null) setBaseline((b) => ({ ...b, aqi: Math.round(aqi) }));
    });
  }, [region?._id, center.lat, center.lng]);

  const fetchRegionAqi = useCallback(async () => {
    setAqiLoading(true);
    try {
      const aqi = await fetchGoogleAqi(center.lat, center.lng);
      if (aqi != null) {
        setBaseline((b) => ({ ...b, aqi: Math.round(aqi) }));
        setToast(`Region AQI updated: ${Math.round(aqi)}`);
      } else {
        setToast('Set REACT_APP_GOOGLE_AQI_KEY for live AQI');
      }
    } catch (e) {
      setToast('Failed to fetch AQI');
    } finally {
      setAqiLoading(false);
    }
  }, [center.lat, center.lng]);

  const recompute = useCallback(() => {
    const inds = industriesRef.current;
    const ivs = interventionsRef.current;
    let aqi = baseline.aqi;
    let wqi = baseline.wqi;
    let noise = baseline.noise;
    let green = baseline.green;

    inds.forEach((ind) => {
      if (!ind.active) {
        aqi -= ind.aqi;
        noise -= ind.noise;
        wqi -= ind.wqi;
      }
    });

    ivs.forEach((iv) => {
      if (iv.tool === 'shutdown') return;
      const t = TOOLS[iv.tool];
      const str = iv.strength ?? 1;
      aqi += t.aqi * str;
      noise += t.noise * str;
      wqi += t.wqi * str;
      green += t.green * str;
    });

    const treeCount = ivs.filter((i) => i.tool === 'trees').length;
    const wetCount = ivs.filter((i) => i.tool === 'wetland').length;
    if (treeCount > 0 && aqi > 100) {
      aqi -= treeCount * 8 * (aqi / 200);
      green += treeCount * 2;
    }
    if (wetCount > 0) {
      wqi += wetCount * 5;
      green += wetCount * 2;
    }

    aqi = Math.max(5, Math.min(500, Math.round(aqi)));
    wqi = Math.max(0, Math.min(100, Math.round(wqi)));
    noise = Math.max(30, Math.min(100, Math.round(noise)));
    green = Math.max(0, Math.min(100, Math.round(green)));

    setCurrent({ aqi, wqi, noise, green });
    return { aqi, wqi, noise, green };
  }, [baseline]);

  useEffect(() => {
    recompute();
  }, [industries, interventions, baseline, recompute]);

  const initMap = useCallback(() => {
    if (!mapContainerRef.current || !token.trim()) {
      setToast('Enter Mapbox token');
      return;
    }
    const inds = industriesRef.current;
    if (!inds.length) {
      setToast('No industries in this region');
      return;
    }

    mapboxgl.accessToken = token.trim();
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [center.lng, center.lat],
      zoom: 10,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');

    map.on('load', () => {
      const indsNow = industriesRef.current;
      const buildAqiGeoJSON = () => ({
        type: 'FeatureCollection',
        features: indsNow
          .filter((i) => i.active)
          .map((ind) => ({
            type: 'Feature',
            geometry: circlePolygon(ind.lat, ind.lng, ind.aqi * 18),
            properties: { c: aqiColor(ind.aqi * 2.5), aqi: ind.aqi },
          })),
      });

      map.addSource('aqi-src', { type: 'geojson', data: buildAqiGeoJSON() });
      map.addLayer({
        id: 'aqi-fill',
        type: 'fill',
        source: 'aqi-src',
        paint: { 'fill-color': ['get', 'c'], 'fill-opacity': 0.18 },
      });
      map.addLayer({
        id: 'aqi-line',
        type: 'line',
        source: 'aqi-src',
        paint: {
          'line-color': ['get', 'c'],
          'line-width': 1,
          'line-opacity': 0.45,
          'line-dasharray': [3, 2],
        },
      });

      map.addSource('green-src', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [
            { type: 'Feature', geometry: circlePolygon(center.lat + 0.04, center.lng - 0.01, 380), properties: {} },
            { type: 'Feature', geometry: circlePolygon(center.lat - 0.04, center.lng + 0.03, 280), properties: {} },
          ],
        },
      });
      map.addLayer({
        id: 'green-fill',
        type: 'fill',
        source: 'green-src',
        paint: { 'fill-color': '#00e5a0', 'fill-opacity': 0.14 },
      });

      map.addSource('iv-src', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'iv-fill',
        type: 'fill',
        source: 'iv-src',
        paint: { 'fill-color': ['get', 'c'], 'fill-opacity': 0.07 },
      });
      map.addLayer({
        id: 'iv-line',
        type: 'line',
        source: 'iv-src',
        paint: {
          'line-color': ['get', 'c'],
          'line-width': 1.5,
          'line-opacity': 0.5,
          'line-dasharray': [4, 3],
        },
      });

      indsNow.forEach((ind) => {
        const el = document.createElement('div');
        el.style.cssText = `
          width:30px;height:30px;border-radius:7px;cursor:pointer;
          background:rgba(255,107,53,0.2);border:2px solid #ff6b35;
          display:flex;align-items:center;justify-content:center;font-size:15px;
          box-shadow:0 0 10px rgba(255,107,53,0.4);
        `;
        el.textContent = ind.emoji;
        el.title = ind.name;
        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([ind.lng, ind.lat])
          .addTo(map);
        industryMarkersRef.current[ind.id] = marker;
      });

      map.on('click', (e) => {
        if (placingRef.current) placeInterventionRef.current(e.lngLat);
      });
    });

    mapRef.current = map;
    setInitialized(true);
    setToast('Region loaded — select tool and click map to place');
  }, [token, center]);

  const placeIntervention = useCallback(
    (lngLat) => {
      const radiusM = radiusKmRef.current * 1000;
      const strength = strengthPctRef.current / 100;
      const inds = industriesRef.current;
      const tool = activeToolRef.current;

      if (tool === 'shutdown') {
        let nearest = null;
        let best = Infinity;
        inds.forEach((ind) => {
          if (!ind.active) return;
          const d = haversineKm({ lat: lngLat.lat, lng: lngLat.lng }, { lat: ind.lat, lng: ind.lng });
          if (d < best) {
            best = d;
            nearest = ind;
          }
        });
        if (!nearest || best > 1.5) {
          setToast('No active industry within 1.5 km — click closer to a factory');
          return;
        }
        setIndustries((prev) =>
          prev.map((i) => (i.id === nearest.id ? { ...i, active: false } : i))
        );
        setInterventions((prev) => [
          ...prev,
          {
            id: `iv-${Date.now()}`,
            tool: 'shutdown',
            lngLat,
            radiusM,
            strength,
            industryId: nearest.id,
          },
        ]);
        setToast(`${nearest.name} shut down`);
      } else {
        setInterventions((prev) => [
          ...prev,
          {
            id: `iv-${Date.now()}`,
            tool,
            lngLat,
            radiusM,
            strength,
          },
        ]);
        setToast(`${TOOLS[tool].label} placed`);
      }
      setPlacing(false);
    },
    []
  );

  useEffect(() => {
    placeInterventionRef.current = placeIntervention;
  }, [placeIntervention]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource) return;
    const ivs = interventionsRef.current;
    const feats = ivs
      .filter((i) => i.tool !== 'shutdown')
      .map((iv) => ({
        type: 'Feature',
        geometry: circlePolygon(iv.lngLat.lat, iv.lngLat.lng, iv.radiusM || 2000),
        properties: { c: TOOLS[iv.tool]?.color || '#888' },
      }));
    try {
      if (map.getSource('iv-src')) {
        map.getSource('iv-src').setData({ type: 'FeatureCollection', features: feats });
      }
    } catch (_) {}
  }, [interventions]);

  useEffect(() => {
    const inds = industriesRef.current;
    inds.forEach((ind) => {
      const marker = industryMarkersRef.current[ind.id];
      if (!marker) return;
      const el = marker.getElement();
      el.style.opacity = ind.active ? '1' : '0.25';
      el.style.filter = ind.active ? 'none' : 'grayscale(1)';
      el.style.pointerEvents = ind.active ? 'auto' : 'none';
    });
  }, [industries]);

  useEffect(() => {
    if (!mapRef.current || !mapRef.current.getSource) return;
    const inds = industriesRef.current;
    const feats = inds
      .filter((i) => i.active)
      .map((ind) => ({
        type: 'Feature',
        geometry: circlePolygon(ind.lat, ind.lng, ind.aqi * 18),
        properties: { c: aqiColor(ind.aqi * 2.5), aqi: ind.aqi },
      }));
    try {
      if (mapRef.current.getSource('aqi-src')) {
        mapRef.current.getSource('aqi-src').setData({ type: 'FeatureCollection', features: feats });
      }
    } catch (_) {}
  }, [industries]);

  useEffect(() => {
    if (!mapRef.current) return;
    const setVis = (name, vis) => {
      try {
        if (name === 'industry') {
          Object.values(industryMarkersRef.current).forEach((m) => {
            if (m && m.getElement()) m.getElement().style.display = vis ? 'flex' : 'none';
          });
        }
        if (name === 'aqi' && mapRef.current.getLayer('aqi-fill')) {
          mapRef.current.setLayoutProperty('aqi-fill', 'visibility', vis ? 'visible' : 'none');
          mapRef.current.setLayoutProperty('aqi-line', 'visibility', vis ? 'visible' : 'none');
        }
        if (name === 'green' && mapRef.current.getLayer('green-fill')) {
          mapRef.current.setLayoutProperty('green-fill', 'visibility', vis ? 'visible' : 'none');
        }
      } catch (_) {}
    };
    setVis('industry', layerIndustry);
    setVis('aqi', layerAqi);
    setVis('green', layerGreen);
  }, [layerIndustry, layerAqi, layerGreen, initialized]);

  const clearAll = useCallback(() => {
    setInterventions([]);
    setIndustries((prev) => prev.map((i) => ({ ...i, active: true })));
    setCurrent(baseline);
    setToast('All interventions cleared');
  }, [baseline]);

  const removeIntervention = useCallback((id) => {
    setInterventions((prev) => {
      const iv = prev.find((i) => i.id === id);
      if (iv && iv.tool === 'shutdown' && iv.industryId) {
        setIndustries((p) => p.map((i) => (i.id === iv.industryId ? { ...i, active: true } : i)));
      }
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: 400 }}>
        <Spinner />
      </div>
    );
  }

  const activeCount = industries.filter((i) => i.active).length;
  const hasChange = interventions.length > 0 || industries.some((i) => !i.active);
  const displayMetrics = timelineMonths === 0 ? current : {
    aqi: Math.round(baseline.aqi + (current.aqi - baseline.aqi) * Math.min(1, timelineMonths / 18)),
    wqi: Math.round(baseline.wqi + (current.wqi - baseline.wqi) * Math.min(1, timelineMonths / 18)),
    noise: Math.round(baseline.noise + (current.noise - baseline.noise) * Math.min(1, timelineMonths / 18)),
    green: Math.round(baseline.green + (current.green - baseline.green) * Math.min(1, timelineMonths / 18)),
  };

  return (
    <div
      className="rounded-xl overflow-hidden border"
      style={{
        background: '#07090f',
        borderColor: 'rgba(255,255,255,0.08)',
        display: 'grid',
        gridTemplateColumns: '270px 1fr 280px',
        minHeight: 560,
        fontFamily: "'Syne', sans-serif",
      }}
    >
      {/* Left panel */}
      <div style={{ background: '#0d1117', borderRight: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 18px 0', flexShrink: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>Eco<span style={{ color: '#00e5a0' }}>Sim</span></div>
          <div style={{ fontSize: 10, color: '#5a6a82', fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
            {region ? region.name : '—'}
          </div>
          {error && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 8 }}>{error}</div>}
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div><label style={{ fontSize: 11, color: '#5a6a82', display: 'block', marginBottom: 3 }}>Mapbox Token</label><input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="pk.eyJ1..." style={{ width: '100%', padding: '7px 9px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: '#131b26', color: '#dde4f0', fontSize: 12 }} /></div>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1 }}><label style={{ fontSize: 11, color: '#5a6a82', display: 'block', marginBottom: 3 }}>Lat</label><input type="number" value={center.lat} step={0.01} onChange={(e) => setCenter((c) => ({ ...c, lat: parseFloat(e.target.value) || 0 }))} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: '#131b26', color: '#dde4f0', fontSize: 11 }} /></div>
              <div style={{ flex: 1 }}><label style={{ fontSize: 11, color: '#5a6a82', display: 'block', marginBottom: 3 }}>Lng</label><input type="number" value={center.lng} step={0.01} onChange={(e) => setCenter((c) => ({ ...c, lng: parseFloat(e.target.value) || 0 }))} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: '#131b26', color: '#dde4f0', fontSize: 11 }} /></div>
            </div>
            <button type="button" onClick={initMap} disabled={!industries.length} style={{ width: '100%', padding: '8px 14px', borderRadius: 8, border: 'none', background: '#00e5a0', color: '#07090f', fontSize: 12, fontWeight: 600, cursor: industries.length ? 'pointer' : 'not-allowed' }}>Initialize Region</button>
            <button type="button" onClick={fetchRegionAqi} disabled={aqiLoading} style={{ width: '100%', marginTop: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(59,158,255,0.5)', background: 'rgba(59,158,255,0.1)', color: '#3b9eff', fontSize: 11, fontWeight: 600, cursor: aqiLoading ? 'wait' : 'pointer' }}>{aqiLoading ? 'Fetching…' : 'Refresh region AQI (Google)'}</button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
          <div style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 2, color: '#5a6a82', textTransform: 'uppercase', marginBottom: 8 }}>Live Metrics</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            {[
              { key: 'aqi', label: 'AQI', unit: aqiLabel(displayMetrics.aqi), delta: displayMetrics.aqi - baseline.aqi, lowerBetter: true },
              { key: 'wqi', label: 'WQI', unit: wqiLabel(displayMetrics.wqi), delta: displayMetrics.wqi - baseline.wqi, lowerBetter: false },
              { key: 'noise', label: 'Noise', unit: displayMetrics.noise + ' dB', delta: displayMetrics.noise - baseline.noise, lowerBetter: true },
              { key: 'green', label: 'Green', unit: displayMetrics.green + '%', delta: displayMetrics.green - baseline.green, lowerBetter: false },
            ].map(({ key, label, unit, delta, lowerBetter }) => (
              <div key={key} style={{ background: '#131b26', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 11px' }}>
                <div style={{ fontSize: 9, color: '#5a6a82', letterSpacing: 1.5, textTransform: 'uppercase' }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginTop: 2 }}>{displayMetrics[key]}</div>
                <div style={{ fontSize: 10, color: '#5a6a82', marginTop: 1 }}>{unit}</div>
                {hasChange && delta !== 0 && <div style={{ fontSize: 11, marginTop: 2, color: (lowerBetter ? delta < 0 : delta > 0) ? '#00e5a0' : '#ff4d6d' }}>{(delta > 0 ? '+' : '') + delta} from baseline</div>}
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '12px 0' }} />
          <div style={{ fontSize: 9, letterSpacing: 2, color: '#5a6a82', textTransform: 'uppercase', marginBottom: 8 }}>Data Layers</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { id: 'industry', label: 'Industries', sub: `(${activeCount} active)`, color: '#ff6b35', state: layerIndustry, set: setLayerIndustry },
              { id: 'aqi', label: 'AQI zones', color: '#f5a623', state: layerAqi, set: setLayerAqi },
              { id: 'green', label: 'Green zones', color: '#00e5a0', state: layerGreen, set: setLayerGreen },
            ].map(({ id, label, sub, color, state, set }) => (
              <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 9, height: 9, borderRadius: id === 'industry' ? 2 : 50, background: color }} />
                  <span style={{ fontSize: 12 }}>{label} {sub && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#ef4444' }}>{sub}</span>}</span>
                </div>
                <button type="button" onClick={() => set(!state)} style={{ width: 34, height: 19, borderRadius: 10, border: 'none', cursor: 'pointer', background: state ? '#00e5a0' : '#2a3548', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 2, left: state ? 17 : 2, width: 15, height: 15, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
                </button>
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '12px 0' }} />
          <div style={{ fontSize: 9, letterSpacing: 2, color: '#5a6a82', textTransform: 'uppercase', marginBottom: 6 }}>Interventions <span style={{ color: '#00e5a0', fontFamily: "'JetBrains Mono', monospace" }}>{interventions.length}</span></div>
          {interventions.length === 0 ? <div style={{ fontSize: 11, color: '#5a6a82', fontFamily: "'JetBrains Mono', monospace" }}>No interventions yet.</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {interventions.map((iv) => (
                <div key={iv.id} style={{ background: '#131b26', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '9px 11px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: TOOLS[iv.tool]?.color || '#888', marginTop: 4, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{TOOLS[iv.tool]?.label}</div>
                    <button type="button" onClick={() => removeIntervention(iv.id)} style={{ background: 'none', border: 'none', color: '#5a6a82', cursor: 'pointer', fontSize: 12, padding: '2px 6px', marginTop: 4 }}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button type="button" onClick={clearAll} style={{ width: '100%', marginTop: 10, padding: '6px 11px', borderRadius: 8, border: 'none', background: 'rgba(255,77,109,0.12)', color: '#ff4d6d', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Clear all interventions</button>
        </div>
      </div>

      {/* Map */}
      <div style={{ position: 'relative', background: '#020617' }}>
        {!initialized && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(7,9,15,0.9)', zIndex: 5, flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Initialize map first</div>
            <div style={{ fontSize: 11, color: '#5a6a82' }}>Enter token + click Initialize Region</div>
          </div>
        )}
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%', minHeight: 480 }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(7,9,15,0.94)', borderTop: '1px solid rgba(255,255,255,0.07)', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 14, zIndex: 4 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#5a6a82', whiteSpace: 'nowrap' }}>Baseline</span>
          <input type="range" min={0} max={60} value={timelineMonths} onChange={(e) => setTimelineMonths(parseInt(e.target.value, 10))} style={{ flex: 1, accentColor: '#00e5a0' }} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#5a6a82' }}>+60 mo</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: '#00e5a0', fontWeight: 500, minWidth: 48, textAlign: 'center' }}>{timelineMonths === 0 ? 'Now' : `+${timelineMonths}mo`}</span>
        </div>
        {toast && (
          <div style={{ position: 'absolute', bottom: 54, left: '50%', transform: 'translateX(-50%)', zIndex: 20, background: '#131b26', border: '1px solid #00e5a0', borderRadius: 8, padding: '9px 16px', fontSize: 11, color: '#00e5a0', fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap' }}>{toast}</div>
        )}
      </div>

      {/* Right panel */}
      <div style={{ background: '#0d1117', borderLeft: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 18px 0', flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Intervention Tools</div>
          <div style={{ fontSize: 10, color: '#5a6a82', fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>Select tool → click map to place</div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: '#5a6a82', textTransform: 'uppercase', marginBottom: 8 }}>Actions</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            {Object.entries(TOOLS).map(([key, t]) => (
              <button
                key={key}
                type="button"
                onClick={() => { setActiveTool(key); setPlacing(true); setToast(`Click map to place: ${t.label}`); }}
                style={{
                  background: activeTool === key ? 'rgba(0,229,160,0.07)' : '#131b26',
                  border: `1px solid ${activeTool === key ? t.color + '80' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: 10,
                  padding: 11,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 18, display: 'block', marginBottom: 5 }}>{key === 'shutdown' ? '🏭' : key === 'trees' ? '🌳' : key === 'treatment' ? '💧' : key === 'traffic' ? '🚗' : key === 'solar' ? '☀️' : '🌿'}</span>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>{t.label}</div>
                <div style={{ fontSize: 10, color: '#5a6a82', marginTop: 2, lineHeight: 1.4 }}>{t.label === 'Shut Down Industry' ? 'Removes emission source.' : `AQI ${t.aqi} · WQI ${t.wqi > 0 ? '+' : ''}${t.wqi}`}</div>
              </button>
            ))}
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '12px 0' }} />
          <div style={{ fontSize: 9, letterSpacing: 2, color: '#5a6a82', textTransform: 'uppercase', marginBottom: 6 }}>Parameters</div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: '#5a6a82', marginBottom: 4 }}>Effect radius: <span style={{ color: '#00e5a0', fontFamily: "'JetBrains Mono', monospace" }}>{radiusKm.toFixed(1)} km</span></div>
            <input type="range" min={0.5} max={8} step={0.5} value={radiusKm} onChange={(e) => setRadiusKm(parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#00e5a0' }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#5a6a82', marginBottom: 4 }}>Effect strength: <span style={{ color: '#00e5a0', fontFamily: "'JetBrains Mono', monospace" }}>{strengthPct}%</span></div>
            <input type="range" min={20} max={100} step={10} value={strengthPct} onChange={(e) => setStrengthPct(parseInt(e.target.value, 10))} style={{ width: '100%', accentColor: '#00e5a0' }} />
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '12px 0' }} />
          <div style={{ fontSize: 9, letterSpacing: 2, color: '#5a6a82', textTransform: 'uppercase', marginBottom: 6 }}>Before → After</div>
          {hasChange ? (
            <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#5a6a82' }}>
              <div>AQI {baseline.aqi} → {current.aqi}</div>
              <div>WQI {baseline.wqi} → {current.wqi}</div>
              <div>Noise {baseline.noise} → {current.noise}</div>
              <div>Green {baseline.green} → {current.green}</div>
            </div>
          ) : (
            <div style={{ fontSize: 11, color: '#5a6a82', fontFamily: "'JetBrains Mono', monospace" }}>Place interventions to see change.</div>
          )}
        </div>
      </div>
    </div>
  );
}
