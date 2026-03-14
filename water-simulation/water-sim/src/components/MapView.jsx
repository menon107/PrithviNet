import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { fetchWaterBodies, splitIntoSegments } from '../utils/overpass'
import { makeLayer } from '../simulation/engine.js'

const RIVER_SOURCE = 'wsim-rivers'
const LAKE_SOURCE  = 'wsim-lakes'
const RIVER_LAYER  = 'wsim-river-layer'
const LAKE_LAYER   = 'wsim-lake-layer'
const LAKE_OUTLINE = 'wsim-lake-outline'

/**
 * Color expression driven by WQI feature-state (0–100, higher = cleaner).
 * Maps 4 WQI bands to the user's color config.
 */
function colorExpr(c) {
  return [
    'step', ['coalesce', ['feature-state', 'wqi'], 100],
    c.severe,        // WQI < 40  → Critical / Poor
    40, c.moderate,  // WQI 40–59 → Fair
    60, c.mild,      // WQI 60–79 → Good
    80, c.clean,     // WQI ≥ 80  → Pristine
  ]
}

/**
 * Width expression: worse WQI → thicker line to draw attention.
 * WQI 100 → base px, WQI 0 → base + 6 px.
 */
function widthExpr(base) {
  return [
    '+', base,
    ['*', ['-', 1, ['/', ['coalesce', ['feature-state', 'wqi'], 100], 100]], 6],
  ]
}

export default function MapView({
  config, layers, setLayers, onLayerClick,
  colorConfig, mapRef, fetchKey, onLoaded, onFetchError,
}) {
  const containerRef    = useRef(null)
  const onLayerClickRef = useRef(onLayerClick)
  const colorConfigRef  = useRef(colorConfig)
  const baseWidthRef    = useRef(config.baseWidth)
  const opacityRef      = useRef(config.opacity)

  useEffect(() => { onLayerClickRef.current = onLayerClick })
  useEffect(() => { colorConfigRef.current  = colorConfig  })
  useEffect(() => { baseWidthRef.current    = config.baseWidth })
  useEffect(() => { opacityRef.current      = config.opacity   })

  // ── Effect 1: Create the map once ────────────────────────────────────────
  useEffect(() => {
    if (!config.token || mapRef.current) return

    mapboxgl.accessToken = config.token
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style:     'mapbox://styles/mapbox/satellite-streets-v12',
      center:    [config.lng, config.lat],
      zoom:      config.zoom,
      attributionControl: false,
    })
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right')
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left')
    mapRef.current = map

    return () => { map.remove(); mapRef.current = null }
  }, [config.token]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect 2: Fetch + render on "Load" ───────────────────────────────────
  useEffect(() => {
    if (!fetchKey || !config.token) return
    let cancelled = false

    const run = async () => {
      const map = mapRef.current
      if (!map) return

      if (!map.isStyleLoaded()) {
        await new Promise(resolve => map.once('load', resolve))
      }
      if (cancelled) return

      map.flyTo({ center: [config.lng, config.lat], zoom: config.zoom })

      // Remove old layers/sources
      for (const id of [RIVER_LAYER, LAKE_LAYER, LAKE_OUTLINE]) {
        try { if (map.getLayer(id)) map.removeLayer(id) } catch (_) {}
      }
      for (const id of [RIVER_SOURCE, LAKE_SOURCE]) {
        try { if (map.getSource(id)) map.removeSource(id) } catch (_) {}
      }
      setLayers([])

      let geojson
      try {
        geojson = await fetchWaterBodies(config.bbox)
      } catch (e) {
        console.error('Overpass fetch failed:', e)
        if (!cancelled) onFetchError()
        return
      }
      if (cancelled) return

      const riverFeatures = []
      const lakeFeatures  = []
      const newLayers     = []
      let fid = 1

      geojson.features.forEach(feature => {
        const geomType = feature.geometry.type
        const name = feature.properties?.name || feature.properties?.waterway || 'Water body'

        if (geomType === 'LineString' || geomType === 'MultiLineString') {
          const lineFeatures = geomType === 'LineString'
            ? [feature]
            : feature.geometry.coordinates.map(coords => ({
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: coords },
                properties: feature.properties,
              }))

          lineFeatures.forEach((lf, li) => {
            splitIntoSegments(lf, 8).forEach((seg, si) => {
              const id    = fid++
              const label = lineFeatures.length > 1
                ? `${name} (part ${li + 1}, seg ${si + 1})`
                : `${name} (seg ${si + 1})`
              riverFeatures.push({ ...seg, id })
              newLayers.push(makeLayer(id, 'river', label))
            })
          })
        }

        if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
          const id = fid++
          lakeFeatures.push({ ...feature, id })
          newLayers.push(makeLayer(id, 'lake', name))
        }
      })

      const colors  = colorConfigRef.current
      const base    = baseWidthRef.current
      const opacity = opacityRef.current

      if (riverFeatures.length > 0) {
        map.addSource(RIVER_SOURCE, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: riverFeatures },
        })
        map.addLayer({
          id: RIVER_LAYER, type: 'line', source: RIVER_SOURCE,
          paint: {
            'line-color':   colorExpr(colors),
            'line-width':   widthExpr(base),
            'line-opacity': opacity,
            'line-cap':     'round',
            'line-join':    'round',
          },
        })
        map.on('mouseenter', RIVER_LAYER, () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', RIVER_LAYER, () => { map.getCanvas().style.cursor = '' })
        map.on('click', RIVER_LAYER, e => {
          const f = e.features?.[0]
          if (f) onLayerClickRef.current({ id: f.id, type: 'river', lngLat: e.lngLat })
        })
      }

      if (lakeFeatures.length > 0) {
        map.addSource(LAKE_SOURCE, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: lakeFeatures },
        })
        map.addLayer({
          id: LAKE_LAYER, type: 'fill', source: LAKE_SOURCE,
          paint: {
            'fill-color':   colorExpr(colors),
            'fill-opacity': ['*', opacity * 0.6,
              ['+', 1, ['*', 0.4, ['-', 1, ['/', ['coalesce', ['feature-state', 'wqi'], 100], 100]]]]],
          },
        })
        map.addLayer({
          id: LAKE_OUTLINE, type: 'line', source: LAKE_SOURCE,
          paint: { 'line-color': colorExpr(colors), 'line-width': 1, 'line-opacity': 0.4 },
        })
        map.on('mouseenter', LAKE_LAYER, () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', LAKE_LAYER, () => { map.getCanvas().style.cursor = '' })
        map.on('click', LAKE_LAYER, e => {
          const f = e.features?.[0]
          if (f) onLayerClickRef.current({ id: f.id, type: 'lake', lngLat: e.lngLat })
        })
      }

      // Seed initial feature states (all pristine = wqi 100)
      newLayers.forEach(({ id, type, wqi }) => {
        try {
          map.setFeatureState(
            { source: type === 'river' ? RIVER_SOURCE : LAKE_SOURCE, id },
            { wqi }
          )
        } catch (_) {}
      })

      setLayers(newLayers)
      if (!cancelled) onLoaded(newLayers.length)
    }

    run()
    return () => { cancelled = true }
  }, [fetchKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect 3: Push WQI to Mapbox feature-state on every tick ─────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    layers.forEach(({ id, type, wqi }) => {
      try {
        map.setFeatureState(
          { source: type === 'river' ? RIVER_SOURCE : LAKE_SOURCE, id },
          { wqi: wqi ?? 100 }
        )
      } catch (_) {}
    })
  }, [layers]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect 4: Recolor when color pickers change ───────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    const expr = colorExpr(colorConfig)
    try {
      if (map.getLayer(RIVER_LAYER))  map.setPaintProperty(RIVER_LAYER,  'line-color', expr)
      if (map.getLayer(LAKE_LAYER))   map.setPaintProperty(LAKE_LAYER,   'fill-color', expr)
      if (map.getLayer(LAKE_OUTLINE)) map.setPaintProperty(LAKE_OUTLINE, 'line-color', expr)
    } catch (_) {}
  }, [colorConfig])

  // ── Effect 5: Update width / opacity from style sliders ──────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    try {
      if (map.getLayer(RIVER_LAYER)) {
        map.setPaintProperty(RIVER_LAYER, 'line-width',   widthExpr(config.baseWidth))
        map.setPaintProperty(RIVER_LAYER, 'line-opacity', config.opacity)
      }
      if (map.getLayer(LAKE_LAYER)) {
        map.setPaintProperty(LAKE_LAYER, 'fill-opacity',
          ['*', config.opacity * 0.6,
            ['+', 1, ['*', 0.4, ['-', 1, ['/', ['coalesce', ['feature-state', 'wqi'], 100], 100]]]]])
      }
    } catch (_) {}
  }, [config.baseWidth, config.opacity])

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
}
