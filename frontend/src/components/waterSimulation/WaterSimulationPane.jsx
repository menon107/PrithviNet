import React, { useState, useRef, useEffect, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import MapView from './MapView';
import ControlPanel from './ControlPanel';
import Legend from './Legend';
import GoogleAQILayer from './GoogleAQILayer';
import { industriesAPI } from '../../services/api';
import { simulateTick, triggerSpill, cleanSegment, pollutionLabel } from './simulation/engine';
import { computeWQI, wqiToColor, wqiGrade } from './simulation/wqi';

const DEFAULT_REGION = {
  token: process.env.REACT_APP_MAPBOX_TOKEN || '',
  lat:   21.13,
  lng:   81.5,
  zoom:  7,
  span:  0.3,
  baseWidth: 4,
  opacity: 0.9,
};

const DEFAULT_COLORS = {
  clean: '#22d3ee',
  mild:  '#a3e635',
  moderate: '#fb923c',
  severe: '#ef4444',
};

function computeBbox(lat, lng, span) {
  return {
    minLat: lat - span / 2,
    minLon: lng - span / 2,
    maxLat: lat + span / 2,
    maxLon: lng + span / 2,
  };
}

export default function WaterSimulationPane({ height = '420px', defaultCenter, regionId }) {
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const simIntervalRef = useRef(null);

  const [regionConfig, setRegionConfig] = useState(() => ({
    ...DEFAULT_REGION,
    token: process.env.REACT_APP_MAPBOX_TOKEN || DEFAULT_REGION.token,
    ...(defaultCenter && { lat: defaultCenter.lat, lng: defaultCenter.lng }),
  }));
  const [colorConfig, setColorConfig] = useState(DEFAULT_COLORS);
  const [layers, setLayers] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [simRunning, setSimRunning] = useState(false);
  const [rainActive, setRainActive] = useState(false);
  const [tickSpeed, setTickSpeed] = useState(800);
  const [selectedLayer, setSelectedLayer] = useState(null);
  const [fetchReady, setFetchReady] = useState(false);
  const [fetchKey, setFetchKey] = useState(0);
  const [toast, setToast] = useState('');
  const [activeTab, setActiveTab] = useState('water');
  const [googleAqiMapType, setGoogleAqiMapType] = useState('INDIA_AQI');
  const [mapReady, setMapReady] = useState(false);

  const bbox = computeBbox(regionConfig.lat, regionConfig.lng, regionConfig.span);
  const mapConfig = { ...regionConfig, bbox };

  const stats = layers.length > 0 ? {
    total:    layers.length,
    degraded: layers.filter(l => (l.wqi ?? 100) < 60).length,
    avgWQI:   Math.round(layers.reduce((s, l) => s + (l.wqi ?? 100), 0) / layers.length),
    minWQI:   Math.min(...layers.map(l => l.wqi ?? 100)),
  } : null;

  const liveSelected = selectedLayer ? layers.find(l => l.id === selectedLayer.id) ?? null : null;

  // Load industries with latest water_data for this region to influence nearby water bodies
  useEffect(() => {
    if (!regionId) {
      setIndustries([]);
      return;
    }
    let cancelled = false;
    industriesAPI.getWithWaterData({ region_id: regionId })
      .then((res) => {
        if (!cancelled) setIndustries(res.data.data || []);
      })
      .catch(() => {
        if (!cancelled) setIndustries([]);
      });
    return () => { cancelled = true; };
  }, [regionId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    clearInterval(simIntervalRef.current);
    if (simRunning && layers.length > 0) {
      simIntervalRef.current = setInterval(() => {
        setLayers(prev => {
          const next = prev.map(l => ({ ...l, params: { ...l.params } }));
          simulateTick(next, { rainActive });
          return next;
        });
      }, tickSpeed);
    }
    return () => clearInterval(simIntervalRef.current);
  }, [simRunning, tickSpeed, rainActive, layers.length]);

  const handleLayerClick = useCallback(({ id, type, lngLat }) => {
    const layer = layers.find(l => l.id === id);
    if (!layer) return;
    setSelectedLayer(layer);
    if (popupRef.current) popupRef.current.remove();
    const { grade } = wqiGrade(layer.wqi ?? 100);
    const color = wqiToColor(layer.wqi ?? 100);
    popupRef.current = new mapboxgl.Popup({ closeButton: true, className: 'sim-popup' })
      .setLngLat(lngLat)
      .setHTML(`
        <div style="font-family:'Space Mono',monospace;font-size:11px;color:#e8eaf0;background:#111620;padding:10px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);min-width:160px">
          <div style="color:#6b7280;font-size:9px;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px">${type}</div>
          <div style="font-size:12px;margin-bottom:8px">${layer.name || id}</div>
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:36px;height:36px;border-radius:50%;border:2px solid ${color};display:flex;flex-direction:column;align-items:center;justify-content:center;">
              <span style="font-size:12px;font-weight:700;color:#e8eaf0">${layer.wqi ?? 100}</span>
            </div>
            <div>
              <div style="color:${color};font-weight:700;font-size:12px">${grade}</div>
              <div style="color:#6b7280;font-size:10px">WQI — ${pollutionLabel(layer.wqi ?? 100)}</div>
            </div>
          </div>
        </div>`)
      .addTo(mapRef.current);
  }, [layers]);

  const handleAirClick = useCallback(async (lngLat) => {
    if (activeTab !== 'air') return;
    const googleAqiKey = process.env.REACT_APP_GOOGLE_AQI_KEY || '';
    if (!googleAqiKey) {
      setToast('Set REACT_APP_GOOGLE_AQI_KEY in frontend .env');
      return;
    }
    try {
      const res = await fetch(`https://airquality.googleapis.com/v1/currentConditions:lookup?key=${googleAqiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: { latitude: lngLat.lat, longitude: lngLat.lng },
          universalAqi: true,
        }),
      });
      if (!res.ok) throw new Error(`AQI lookup failed: ${res.status}`);
      const data = await res.json();
      const index = (data.indexes && data.indexes.find((i) => i.code === 'uaqi')) || data.indexes?.[0];
      const aqi = index?.aqi;
      const category = index?.category || 'N/A';
      const colorObj = index?.color?.rgba;
      const color = colorObj
        ? `rgba(${colorObj.red},${colorObj.green},${colorObj.blue},${(colorObj.alpha ?? 1)})`
        : '#22c55e';
      if (popupRef.current) popupRef.current.remove();
      popupRef.current = new mapboxgl.Popup({ closeButton: true, className: 'sim-popup' })
        .setLngLat(lngLat)
        .setHTML(`
          <div style="font-family:'Space Mono',monospace;font-size:11px;color:#e8eaf0;background:#111620;padding:10px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);min-width:170px">
            <div style="color:#6b7280;font-size:9px;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px">Air (Google AQI)</div>
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:36px;height:36px;border-radius:50%;border:2px solid ${color};display:flex;flex-direction:column;align-items:center;justify-content:center;">
                <span style="font-size:12px;font-weight:700;color:#e8eaf0">${aqi ?? '—'}</span>
              </div>
              <div>
                <div style="color:${color};font-weight:700;font-size:12px">${category}</div>
                <div style="color:#6b7280;font-size:10px">Lat ${lngLat.lat.toFixed(3)}, Lon ${lngLat.lng.toFixed(3)}</div>
              </div>
            </div>
          </div>
        `)
        .addTo(mapRef.current);
    } catch (e) {
      console.error(e);
      setToast('Failed to fetch AQI for this point');
    }
  }, [activeTab]);

  const handleFetch = useCallback(() => {
    if (!regionConfig.token) { setToast('Enter Mapbox token'); return; }
    setFetchReady(true);
    setLoading(true);
    setFetchKey(k => k + 1);
  }, [regionConfig.token]);

  const handleSpill = useCallback(() => {
    if (!liveSelected) { setToast('Click a water body first'); return; }
    setLayers(prev => {
      const next = prev.map(l => ({ ...l, params: { ...l.params } }));
      triggerSpill(next, next.findIndex(l => l.id === liveSelected.id), 3);
      return next;
    });
    setToast('Industrial spill applied');
  }, [liveSelected]);

  const handleClean = useCallback(() => {
    if (!liveSelected) { setToast('Click a water body first'); return; }
    setLayers(prev => {
      const next = prev.map(l => ({ ...l, params: { ...l.params } }));
      cleanSegment(next, next.findIndex(l => l.id === liveSelected.id));
      return next;
    });
    setToast('Segment restored');
  }, [liveSelected]);

  const handleApplyWQI = useCallback((id, params) => {
    setLayers(prev => prev.map(l => {
      if (l.id !== id) return l;
      const { wqi } = computeWQI(params);
      return { ...l, params: { ...params }, wqi, color: wqiToColor(wqi) };
    }));
    setToast('WQI applied');
  }, []);

  const handleResetAll = useCallback(() => {
    setLayers(prev => prev.map(l => {
      const params = { ph: 7.2, cod: 20, bod: 3, do_: 8, turb: 8, nit: 4, temp: 22, col: 0 };
      const { wqi } = computeWQI(params);
      return { ...l, params, wqi, color: wqiToColor(wqi) };
    }));
    setToast('All reset to pristine');
  }, []);

  const handleLoaded = useCallback((n) => { setLoading(false); setToast(`Loaded ${n} water segments`); }, []);
  const handleFetchError = useCallback(() => { setLoading(false); setToast('Overpass API error'); }, []);

  const hasToken = !!regionConfig.token;
  const showMap = fetchReady && hasToken;
  const googleAqiKey = process.env.REACT_APP_GOOGLE_AQI_KEY || '';

  return (
    <div style={{ position: 'relative', width: '100%', height, minHeight: 320, background: '#0a0e14', borderRadius: 12, overflow: 'hidden' }}>
      {showMap && (
        <>
          <MapView
            config={mapConfig}
            layers={layers}
            setLayers={setLayers}
            onLayerClick={handleLayerClick}
            colorConfig={colorConfig}
            mapRef={mapRef}
            fetchKey={fetchKey}
            onLoaded={handleLoaded}
            onFetchError={handleFetchError}
            onMapReady={() => setMapReady(true)}
            industries={industries}
            mode={activeTab === 'air' ? 'air' : 'water'}
            onMapClick={activeTab === 'air' ? handleAirClick : undefined}
          />
          {activeTab === 'air' && googleAqiKey && (
            <GoogleAQILayer
              mapRef={mapRef}
              visible={true}
              apiKey={googleAqiKey}
              mapType={googleAqiMapType}
              mapReady={mapReady}
            />
          )}
          <Legend colorConfig={colorConfig} />
        </>
      )}

      {!showMap && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 12, background: '#0a0e14',
        }}>
          <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 18, color: '#00d4ff' }}>Water quality simulation</div>
          <div style={{ fontSize: 12, color: '#6b7280', maxWidth: 280, textAlign: 'center' }}>
            Set your Mapbox token in the panel and click <strong style={{ color: '#e8eaf0' }}>Load Water Bodies</strong> to start.
          </div>
        </div>
      )}

      <ControlPanel
        regionConfig={regionConfig}
        setRegionConfig={setRegionConfig}
        onFetch={handleFetch}
        loading={loading}
        simRunning={simRunning}
        setSimRunning={setSimRunning}
        rainActive={rainActive}
        setRainActive={setRainActive}
        tickSpeed={tickSpeed}
        setTickSpeed={setTickSpeed}
        colorConfig={colorConfig}
        setColorConfig={setColorConfig}
        layers={layers}
        selectedLayer={liveSelected}
        onSpill={handleSpill}
        onClean={handleClean}
        onResetAll={handleResetAll}
        onApplyWQI={handleApplyWQI}
        stats={stats}
        fetchReady={fetchReady}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        googleAqiMapType={googleAqiMapType}
        setGoogleAqiMapType={setGoogleAqiMapType}
        hasGoogleAqiKey={!!googleAqiKey}
      />

      {toast && (
        <div style={{
          position: 'absolute', bottom: 24, right: 320, zIndex: 20,
          background: '#111620', border: '1px solid rgba(0,212,255,0.3)', borderRadius: 8,
          padding: '8px 14px', fontSize: 11, color: '#00d4ff', fontFamily: "'Space Mono',monospace", pointerEvents: 'none',
        }}>
          {toast}
        </div>
      )}

      <style>{`
        .mapboxgl-popup-content { background: transparent !important; padding: 0 !important; box-shadow: none !important; }
        .mapboxgl-popup-tip { display: none; }
      `}</style>
    </div>
  );
}
