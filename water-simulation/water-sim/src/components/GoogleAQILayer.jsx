import { useEffect, useRef } from 'react'

const SOURCE_ID = 'google-aqi-tiles'
const LAYER_ID  = 'google-aqi-layer'
const TILE_BASE = 'https://airquality.googleapis.com/v1/mapTypes'

/**
 * Renders Google Air Quality API heatmap tiles as a Mapbox raster layer.
 * mapType options: INDIA_AQI | UAQI_RED_GREEN | UAQI_INDIGO_PERSIAN | US_AQI
 */
export default function GoogleAQILayer({ mapRef, visible, apiKey, mapType = 'INDIA_AQI' }) {
  const prevMapType = useRef(null)

  useEffect(() => {
    const map = mapRef.current
    if (!map || !apiKey) return

    const tileUrl = `${TILE_BASE}/${mapType}/heatmapTiles/{z}/{x}/{y}?key=${apiKey}`
    const vis     = visible ? 'visible' : 'none'

    const apply = () => {
      // If map type changed, tear down and rebuild so new tiles load
      if (map.getSource(SOURCE_ID) && prevMapType.current !== mapType) {
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID)
        map.removeSource(SOURCE_ID)
      }
      prevMapType.current = mapType

      if (map.getSource(SOURCE_ID)) {
        if (map.getLayer(LAYER_ID)) map.setLayoutProperty(LAYER_ID, 'visibility', vis)
        return
      }

      map.addSource(SOURCE_ID, {
        type:        'raster',
        tiles:       [tileUrl],
        tileSize:    256,
        attribution: '© Google',
        minzoom:     1,
        maxzoom:     16,
      })

      map.addLayer({
        id:     LAYER_ID,
        type:   'raster',
        source: SOURCE_ID,
        layout: { visibility: vis },
        paint: {
          'raster-opacity':       0.78,
          'raster-fade-duration': 400,
        },
      })
    }

    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [visible, apiKey, mapType]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
