import { useState, useRef, useEffect, useCallback } from 'react'
import MapView        from './components/MapView.jsx'
import GoogleAQILayer from './components/GoogleAQILayer.jsx'
import ControlPanel   from './components/ControlPanel.jsx'
import Legend         from './components/Legend.jsx'
import { simulateTick, triggerSpill, cleanSegment, pollutionLabel } from './simulation/engine.js'
import { computeWQI, wqiToColor, wqiGrade } from './simulation/wqi.js'
import { fetchGoogleAQIData, fetchHourlyData } from './services/api.js'
import mapboxgl from 'mapbox-gl'

const DEFAULT_REGION = {
  token:     import.meta.env.VITE_MAPBOX_TOKEN || '',
  lat:       21.13,
  lng:       81.5,
  zoom:      7,
  span:      0.3,
  baseWidth: 4,
  opacity:   0.9,
}

const DEFAULT_COLORS = {
  clean:    '#22d3ee',
  mild:     '#a3e635',
  moderate: '#fb923c',
  severe:   '#ef4444',
}

function computeBbox(lat, lng, span) {
  return {
    minLat: lat - span / 2,
    minLon: lng - span / 2,
    maxLat: lat + span / 2,
    maxLon: lng + span / 2,
  }
}

const AQ_REFRESH_MS = 5 * 60 * 1000

export default function App() {
  const mapRef         = useRef(null)
  const popupRef       = useRef(null)
  const simIntervalRef = useRef(null)

  // ── Tab ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('water')

  // ── Water simulation ─────────────────────────────────────────────────────
  const [regionConfig,  setRegionConfig]  = useState(DEFAULT_REGION)
  const [colorConfig,   setColorConfig]   = useState(DEFAULT_COLORS)
  const [layers,        setLayers]        = useState([])
  const [loading,       setLoading]       = useState(false)
  const [simRunning,    setSimRunning]    = useState(false)
  const [rainActive,    setRainActive]    = useState(false)
  const [tickSpeed,     setTickSpeed]     = useState(800)
  const [selectedLayer, setSelectedLayer] = useState(null)
  const [fetchReady,    setFetchReady]    = useState(false)
  const [fetchKey,      setFetchKey]      = useState(0)
  const [toast,         setToast]         = useState('')

  // ── Google AQI ───────────────────────────────────────────────────────────
  const [gAQIData,    setGAQIData]    = useState(null)
  const [gAQILoading, setGAQILoading] = useState(false)
  const [gAQIError,   setGAQIError]   = useState(null)
  const [showGAQI,    setShowGAQI]    = useState(true)
  const [aqMapType,   setAqMapType]   = useState('INDIA_AQI')
  const [selectedCity,  setSelectedCity]  = useState(null)
  const [hourlyData,    setHourlyData]    = useState(null)
  const [hourlyLoading, setHourlyLoading] = useState(false)

  // ── Derived ───────────────────────────────────────────────────────────────
  const bbox      = computeBbox(regionConfig.lat, regionConfig.lng, regionConfig.span)
  const mapConfig = { ...regionConfig, bbox }

  // WQI-based stats (higher WQI = better)
  const stats = layers.length > 0 ? {
    total:    layers.length,
    degraded: layers.filter(l => (l.wqi ?? 100) < 60).length,
    avgWQI:   Math.round(layers.reduce((s, l) => s + (l.wqi ?? 100), 0) / layers.length),
    minWQI:   Math.min(...layers.map(l => l.wqi ?? 100)),
  } : null

  // The selected layer object (always fresh from layers array)
  const liveSelected = selectedLayer
    ? layers.find(l => l.id === selectedLayer.id) ?? null
    : null

  // ── Toast ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2500)
    return () => clearTimeout(t)
  }, [toast])

  // ── Google city AQI fetch ─────────────────────────────────────────────────
  const loadGAQI = useCallback(async (silent = false) => {
    if (!silent) setGAQILoading(true)
    setGAQIError(null)
    try {
      const data = await fetchGoogleAQIData()
      setGAQIData(data)
    } catch (e) {
      setGAQIError('Google AQI unavailable — is the backend running?')
      console.warn('[App] fetchGoogleAQIData:', e.message)
    } finally {
      setGAQILoading(false)
    }
  }, [])

  useEffect(() => {
    loadGAQI()
    const interval = setInterval(() => loadGAQI(true), AQ_REFRESH_MS)
    return () => clearInterval(interval)
  }, [loadGAQI])

  // ── Hourly history + forecast ─────────────────────────────────────────────
  const loadHourly = useCallback(async (city) => {
    setSelectedCity(city)
    setHourlyLoading(true)
    setHourlyData(null)
    try {
      const data = await fetchHourlyData(city.lat, city.lon)
      setHourlyData(data)
    } catch (e) {
      console.warn('[App] fetchHourlyData:', e.message)
    } finally {
      setHourlyLoading(false)
    }
  }, [])

  // ── Simulation tick ───────────────────────────────────────────────────────
  useEffect(() => {
    clearInterval(simIntervalRef.current)
    if (simRunning && layers.length > 0) {
      simIntervalRef.current = setInterval(() => {
        setLayers(prev => {
          const next = prev.map(l => ({ ...l, params: { ...l.params } }))
          simulateTick(next, { rainActive })
          return next
        })
      }, tickSpeed)
    }
    return () => clearInterval(simIntervalRef.current)
  }, [simRunning, tickSpeed, rainActive, layers.length])

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleLayerClick = useCallback(({ id, type, lngLat }) => {
    const layer = layers.find(l => l.id === id)
    if (!layer) return
    setSelectedLayer(layer)
    const { grade } = wqiGrade(layer.wqi ?? 100)
    const color     = wqiToColor(layer.wqi ?? 100)
    if (popupRef.current) popupRef.current.remove()
    popupRef.current = new mapboxgl.Popup({ closeButton: true, className: 'sim-popup' })
      .setLngLat(lngLat)
      .setHTML(`
        <div style="font-family:'Space Mono',monospace;font-size:11px;color:#e8eaf0;background:#111620;
                    padding:10px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);min-width:180px">
          <div style="color:#6b7280;font-size:9px;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px">${type}</div>
          <div style="font-size:13px;margin-bottom:8px">${layer.name || id}</div>
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:36px;height:36px;border-radius:50%;border:2px solid ${color};
              display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;">
              <span style="font-size:12px;font-weight:700;color:#e8eaf0">${layer.wqi ?? 100}</span>
            </div>
            <div>
              <div style="color:${color};font-weight:700;font-size:12px">${grade}</div>
              <div style="color:#6b7280;font-size:10px">WQI — ${pollutionLabel(layer.wqi ?? 100)}</div>
            </div>
          </div>
          <div style="margin-top:8px;font-size:10px;color:#6b7280;">Click ↓ panel to adjust parameters</div>
        </div>`)
      .addTo(mapRef.current)
  }, [layers])

  const handleFetch = useCallback(() => {
    if (!regionConfig.token) { setToast('Please enter your Mapbox token'); return }
    setFetchReady(true)
    setLoading(true)
    setFetchKey(k => k + 1)
  }, [regionConfig.token])

  // Trigger industrial spill on the selected segment and its neighbours
  const handleSpill = useCallback(() => {
    if (!liveSelected) { setToast('Click a water body first'); return }
    setLayers(prev => {
      const next = prev.map(l => ({ ...l, params: { ...l.params } }))
      triggerSpill(next, next.findIndex(l => l.id === liveSelected.id), 3)
      return next
    })
    setToast('Industrial spill applied')
  }, [liveSelected])

  // Restore selected segment to pristine
  const handleClean = useCallback(() => {
    if (!liveSelected) { setToast('Click a water body first'); return }
    setLayers(prev => {
      const next = prev.map(l => ({ ...l, params: { ...l.params } }))
      cleanSegment(next, next.findIndex(l => l.id === liveSelected.id))
      return next
    })
    setToast('Segment restored to pristine')
  }, [liveSelected])

  // Apply custom WQI parameters from the WQI panel to a specific segment
  const handleApplyWQI = useCallback((id, params) => {
    setLayers(prev => prev.map(l => {
      if (l.id !== id) return l
      const { wqi } = computeWQI(params)
      const color   = wqiToColor(wqi)
      return { ...l, params: { ...params }, wqi, color }
    }))
    setToast('WQI parameters applied to map')
  }, [])

  const handleResetAll = useCallback(() => {
    setLayers(prev => prev.map(l => {
      const { wqi } = computeWQI({ ph: 7.2, cod: 20, bod: 3, do_: 8, turb: 8, nit: 4, temp: 22, col: 0 })
      const color = wqiToColor(wqi)
      return { ...l, params: { ph: 7.2, cod: 20, bod: 3, do_: 8, turb: 8, nit: 4, temp: 22, col: 0 }, wqi, color }
    }))
    setToast('All segments reset to pristine')
  }, [])

  const handleLoaded     = useCallback((n) => { setLoading(false); setToast(`Loaded ${n} water segments — click any to set parameters`) }, [])
  const handleFetchError = useCallback(() => { setLoading(false); setToast('Overpass API error — try again') }, [])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>

      {fetchReady && (
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
          />
          <GoogleAQILayer
            mapRef={mapRef}
            visible={activeTab === 'air' && showGAQI}
            apiKey={import.meta.env.VITE_GOOGLE_AQI_KEY || ''}
            mapType={aqMapType}
          />
        </>
      )}

      {!fetchReady && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', background: '#0a0e14', flexDirection: 'column', gap: 16,
        }}>
          <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 32, color: '#00d4ff', letterSpacing: -1 }}>PrithviNet</div>
          <div style={{ fontSize: 14, color: '#6b7280', maxWidth: 320, textAlign: 'center', lineHeight: 1.6 }}>
            Enter your Mapbox token and region, then click{' '}
            <strong style={{ color: '#e8eaf0' }}>Load Water Bodies</strong> to begin.
          </div>
        </div>
      )}

      <Legend colorConfig={colorConfig} />

      <ControlPanel
        activeTab={activeTab}           setActiveTab={setActiveTab}
        // Water tab
        regionConfig={regionConfig}     setRegionConfig={setRegionConfig}
        onFetch={handleFetch}           loading={loading}
        simRunning={simRunning}         setSimRunning={setSimRunning}
        rainActive={rainActive}         setRainActive={setRainActive}
        tickSpeed={tickSpeed}           setTickSpeed={setTickSpeed}
        colorConfig={colorConfig}       setColorConfig={setColorConfig}
        layers={layers}
        selectedLayer={liveSelected}
        onSpill={handleSpill}           onClean={handleClean}
        onResetAll={handleResetAll}     onApplyWQI={handleApplyWQI}
        stats={stats}                   fetchReady={fetchReady}
        // Air tab
        gAQIData={gAQIData}       gAQILoading={gAQILoading}
        gAQIError={gAQIError}     showGAQI={showGAQI}
        setShowGAQI={setShowGAQI} onRefreshGAQI={() => loadGAQI()}
        aqMapType={aqMapType}     setAqMapType={setAqMapType}
        selectedCity={selectedCity}
        hourlyData={hourlyData}   hourlyLoading={hourlyLoading}
        onCityClick={loadHourly}
      />

      {toast && (
        <div style={{
          position: 'absolute', bottom: 24, right: 324, zIndex: 20,
          background: '#111620', border: '1px solid rgba(0,212,255,0.3)',
          borderRadius: 8, padding: '10px 16px', fontSize: 12, color: '#00d4ff',
          fontFamily: "'Space Mono',monospace", pointerEvents: 'none',
        }}>
          {toast}
        </div>
      )}

      <style>{`
        .mapboxgl-popup-content { background: transparent !important; padding: 0 !important; box-shadow: none !important; }
        .mapboxgl-popup-tip { display: none; }
      `}</style>
    </div>
  )
}
