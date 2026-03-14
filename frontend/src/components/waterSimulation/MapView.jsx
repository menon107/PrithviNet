import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { fetchWaterBodies, splitIntoSegments } from './utils/overpass';
import { makeLayer } from './simulation/engine';
import { computeWQI, wqiToColor, defaultParams } from './simulation/wqi';

const RIVER_SOURCE = 'wsim-rivers';
const LAKE_SOURCE  = 'wsim-lakes';
const RIVER_LAYER  = 'wsim-river-layer';
const LAKE_LAYER   = 'wsim-lake-layer';
const LAKE_OUTLINE = 'wsim-lake-outline';
const INDUSTRY_SOURCE = 'wsim-industries';
const INDUSTRY_LAYER  = 'wsim-industries-layer';

function colorExpr(c) {
  return [
    'step', ['coalesce', ['feature-state', 'wqi'], 100],
    c.severe, 40, c.moderate, 60, c.mild, 80, c.clean,
  ];
}

function widthExpr(base) {
  return ['+', base, ['*', ['-', 1, ['/', ['coalesce', ['feature-state', 'wqi'], 100], 100]], 6]];
}

function toRad(x) {
  return (x * Math.PI) / 180;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function mapIndustryWaterToParams(water) {
  const base = defaultParams();
  if (!water) return base;
  const p = { ...base };
  if (water.ph != null) p.ph = water.ph;
  if (water.bod != null) p.bod = water.bod;
  if (water.cod != null) p.cod = water.cod;
  if (water.tss != null) p.turb = water.tss;
  if (water.turbidity != null) p.turb = water.turbidity;
  return p;
}

export default function MapView({
  config, layers, setLayers, onLayerClick,
  colorConfig, mapRef, fetchKey, onLoaded, onFetchError, onMapReady,
  industries = [],
  mode = 'water',
  onMapClick,
}) {
  const containerRef = useRef(null);
  const onLayerClickRef = useRef(onLayerClick);
  const colorConfigRef = useRef(colorConfig);
  const baseWidthRef = useRef(config.baseWidth);
  const opacityRef = useRef(config.opacity);
  const onMapClickRef = useRef(onMapClick);

  useEffect(() => { onLayerClickRef.current = onLayerClick; });
  useEffect(() => { colorConfigRef.current = colorConfig; });
  useEffect(() => { baseWidthRef.current = config.baseWidth; });
  useEffect(() => { opacityRef.current = config.opacity; });
  useEffect(() => { onMapClickRef.current = onMapClick; });

  useEffect(() => {
    if (!config.token || mapRef.current) return;
    mapboxgl.accessToken = config.token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [config.lng, config.lat],
      zoom: config.zoom,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');
    mapRef.current = map;
    if (onMapReady) map.once('load', () => onMapReady());
    return () => { map.remove(); mapRef.current = null; };
  }, [config.token]);

  // Global map click handler (used for AQI lookup in Air mode)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handler = (e) => {
      if (onMapClickRef.current) onMapClickRef.current(e.lngLat);
    };
    map.on('click', handler);
    return () => {
      map.off('click', handler);
    };
  }, [mapRef]);

  useEffect(() => {
    if (!fetchKey || !config.token || mode !== 'water') return;
    let cancelled = false;
    const run = async () => {
      const map = mapRef.current;
      if (!map) return;
      if (!map.isStyleLoaded()) await new Promise(resolve => map.once('load', resolve));
      if (cancelled) return;
      map.flyTo({ center: [config.lng, config.lat], zoom: config.zoom });
      for (const id of [RIVER_LAYER, LAKE_LAYER, LAKE_OUTLINE]) {
        try { if (map.getLayer(id)) map.removeLayer(id); } catch (_) {}
      }
      for (const id of [RIVER_SOURCE, LAKE_SOURCE]) {
        try { if (map.getSource(id)) map.removeSource(id); } catch (_) {}
      }
      setLayers([]);
      let geojson;
      try {
        geojson = await fetchWaterBodies(config.bbox);
      } catch (e) {
        if (!cancelled) onFetchError();
        return;
      }
      if (cancelled) return;
      const riverFeatures = [];
      const lakeFeatures = [];
      const newLayers = [];
      let fid = 1;
      geojson.features.forEach(feature => {
        const geomType = feature.geometry.type;
        const name = feature.properties?.name || feature.properties?.waterway || 'Water body';
        if (geomType === 'LineString' || geomType === 'MultiLineString') {
          const lineFeatures = geomType === 'LineString'
            ? [feature]
            : feature.geometry.coordinates.map(coords => ({
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: coords },
                properties: feature.properties,
              }));
          lineFeatures.forEach((lf, li) => {
            splitIntoSegments(lf, 8).forEach((seg, si) => {
              const id = fid++;
              const label = lineFeatures.length > 1 ? `${name} (part ${li + 1}, seg ${si + 1})` : `${name} (seg ${si + 1})`;
              riverFeatures.push({ ...seg, id });
              newLayers.push(makeLayer(id, 'river', label));
            });
          });
        }
        if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
          const id = fid++;
          lakeFeatures.push({ ...feature, id });
          newLayers.push(makeLayer(id, 'lake', name));
        }
      });
      // If industries are provided, adjust water quality of nearby segments based on latest water_data
      if (industries.length > 0) {
        const idToCenter = new Map();
        riverFeatures.forEach((f) => {
          const coords = f.geometry.coordinates;
          if (!coords?.length) return;
          let sumLon = 0; let sumLat = 0;
          coords.forEach(([lon, lat]) => { sumLon += lon; sumLat += lat; });
          const n = coords.length;
          idToCenter.set(f.id, { lon: sumLon / n, lat: sumLat / n });
        });
        lakeFeatures.forEach((f) => {
          let lon; let lat;
          const geom = f.geometry;
          if (geom.type === 'Polygon' && geom.coordinates?.[0]?.[0]) {
            [lon, lat] = geom.coordinates[0][0];
          } else if (geom.type === 'MultiPolygon' && geom.coordinates?.[0]?.[0]?.[0]) {
            [lon, lat] = geom.coordinates[0][0][0];
          }
          if (lon != null && lat != null) {
            idToCenter.set(f.id, { lon, lat });
          }
        });
        const MAX_DIST_KM = 8;
        newLayers.forEach((layer) => {
          const center = idToCenter.get(layer.id);
          if (!center) return;
          let nearest = null;
          let best = Infinity;
          industries.forEach((ind) => {
            if (ind.lat == null || ind.lng == null) return;
            const d = haversineKm(center.lat, center.lon, ind.lat, ind.lng);
            if (d < best) {
              best = d;
              nearest = ind;
            }
          });
          if (nearest && best <= MAX_DIST_KM && nearest.water_data) {
            const params = mapIndustryWaterToParams(nearest.water_data);
            const { wqi } = computeWQI(params);
            layer.params = params;
            layer.wqi = wqi;
            layer.color = wqiToColor(wqi);
            layer.industryId = nearest._id;
            layer.industryName = nearest.name;
          }
        });
      }

      const colors = colorConfigRef.current;
      const base = baseWidthRef.current;
      const opacity = opacityRef.current;
      if (riverFeatures.length > 0) {
        map.addSource(RIVER_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: riverFeatures } });
        map.addLayer({
          id: RIVER_LAYER, type: 'line', source: RIVER_SOURCE,
          paint: { 'line-color': colorExpr(colors), 'line-width': widthExpr(base), 'line-opacity': opacity, 'line-cap': 'round', 'line-join': 'round' },
        });
        map.on('mouseenter', RIVER_LAYER, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', RIVER_LAYER, () => { map.getCanvas().style.cursor = ''; });
        map.on('click', RIVER_LAYER, e => {
          const f = e.features?.[0];
          if (f) onLayerClickRef.current({ id: f.id, type: 'river', lngLat: e.lngLat });
        });
      }
      if (lakeFeatures.length > 0) {
        map.addSource(LAKE_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: lakeFeatures } });
        map.addLayer({
          id: LAKE_LAYER, type: 'fill', source: LAKE_SOURCE,
          paint: {
            'fill-color': colorExpr(colors),
            'fill-opacity': ['*', opacity * 0.6, ['+', 1, ['*', 0.4, ['-', 1, ['/', ['coalesce', ['feature-state', 'wqi'], 100], 100]]]]],
          },
        });
        map.addLayer({
          id: LAKE_OUTLINE, type: 'line', source: LAKE_SOURCE,
          paint: { 'line-color': colorExpr(colors), 'line-width': 1, 'line-opacity': 0.4 },
        });
        map.on('mouseenter', LAKE_LAYER, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', LAKE_LAYER, () => { map.getCanvas().style.cursor = ''; });
        map.on('click', LAKE_LAYER, e => {
          const f = e.features?.[0];
          if (f) onLayerClickRef.current({ id: f.id, type: 'lake', lngLat: e.lngLat });
        });
      }
      newLayers.forEach(({ id, type, wqi }) => {
        try {
          map.setFeatureState({ source: type === 'river' ? RIVER_SOURCE : LAKE_SOURCE, id }, { wqi });
        } catch (_) {}
      });
      setLayers(newLayers);
      if (!cancelled) onLoaded(newLayers.length);
    };
    run();
    return () => { cancelled = true; };
  }, [fetchKey]);

  // When switching to Air mode, remove water layers so only AQI heatmap + industries remain
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (mode !== 'air') return;
    [RIVER_LAYER, LAKE_LAYER, LAKE_OUTLINE].forEach((id) => {
      try { if (map.getLayer(id)) map.removeLayer(id); } catch (_) {}
    });
    [RIVER_SOURCE, LAKE_SOURCE].forEach((id) => {
      try { if (map.getSource(id)) map.removeSource(id); } catch (_) {}
    });
    // Clear local layer state for water segments
    setLayers([]);
  }, [mode, mapRef, setLayers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    layers.forEach(({ id, type, wqi }) => {
      try {
        map.setFeatureState(
          { source: type === 'river' ? RIVER_SOURCE : LAKE_SOURCE, id },
          { wqi: wqi ?? 100 }
        );
      } catch (_) {}
    });
  }, [layers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const expr = colorExpr(colorConfig);
    try {
      if (map.getLayer(RIVER_LAYER))  map.setPaintProperty(RIVER_LAYER,  'line-color', expr);
      if (map.getLayer(LAKE_LAYER))   map.setPaintProperty(LAKE_LAYER,   'fill-color', expr);
      if (map.getLayer(LAKE_OUTLINE)) map.setPaintProperty(LAKE_OUTLINE, 'line-color', expr);
    } catch (_) {}
  }, [colorConfig]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    try {
      if (map.getLayer(RIVER_LAYER)) {
        map.setPaintProperty(RIVER_LAYER, 'line-width', widthExpr(config.baseWidth));
        map.setPaintProperty(RIVER_LAYER, 'line-opacity', config.opacity);
      }
      if (map.getLayer(LAKE_LAYER)) {
        map.setPaintProperty(LAKE_LAYER, 'fill-opacity',
          ['*', config.opacity * 0.6, ['+', 1, ['*', 0.4, ['-', 1, ['/', ['coalesce', ['feature-state', 'wqi'], 100], 100]]]]]);
      }
    } catch (_) {}
  }, [config.baseWidth, config.opacity]);

  // Industry location overlay (circles) – rendered in both water and air modes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    try {
      if (map.getLayer(INDUSTRY_LAYER)) map.removeLayer(INDUSTRY_LAYER);
      if (map.getSource(INDUSTRY_SOURCE)) map.removeSource(INDUSTRY_SOURCE);
    } catch (_) {}
    if (!industries || industries.length === 0) return;
    const features = industries
      .filter((ind) => ind.lng != null && ind.lat != null)
      .map((ind) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [ind.lng, ind.lat] },
        properties: {
          id: ind._id,
          name: ind.name,
          type: ind.industry_type,
        },
      }));
    if (!features.length) return;
    map.addSource(INDUSTRY_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features },
    });
    map.addLayer({
      id: INDUSTRY_LAYER,
      type: 'circle',
      source: INDUSTRY_SOURCE,
      paint: {
        'circle-radius': 5,
        'circle-color': '#f97316',
        'circle-stroke-color': '#000000',
        'circle-stroke-width': 1.5,
        'circle-opacity': 0.9,
      },
    });
  }, [industries, mapRef]);

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />;
}
