import { useEffect } from 'react'

const SOURCE_ID = 'pollution-data'
const LAYER_ID  = 'pollution-heatmap'

export default function PollutionHeatmap({ mapRef, data, visible }) {

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const apply = () => {
      const geojson = data?.geojson ?? { type: 'FeatureCollection', features: [] }
      const vis     = visible && data ? 'visible' : 'none'

      // Update existing source without re-creating layers
      if (map.getSource(SOURCE_ID)) {
        map.getSource(SOURCE_ID).setData(geojson)
        if (map.getLayer(LAYER_ID)) map.setLayoutProperty(LAYER_ID, 'visibility', vis)
        return
      }

      map.addSource(SOURCE_ID, { type: 'geojson', data: geojson })

      map.addLayer({
        id:     LAYER_ID,
        type:   'heatmap',
        source: SOURCE_ID,
        layout: { visibility: vis },
        paint: {
          // Each point's contribution scales with PM2.5 value
          'heatmap-weight': [
            'interpolate', ['linear'], ['get', 'pm25'],
            0,   0,
            150, 1,
          ],

          // Intensity rises with zoom to keep density high as points spread apart
          'heatmap-intensity': [
            'interpolate', ['linear'], ['zoom'],
            3,  1.5,
            6,  2,
            8,  2.5,
            12, 4,
            16, 6,
          ],

          // Radius must GROW with zoom — at higher zoom each degree is thousands
          // of pixels wide, so the blob must be larger in pixels to stay visible.
          // Rule of thumb: keep the heatmap covering roughly the same km² area.
          'heatmap-radius': [
            'interpolate', ['linear'], ['zoom'],
            3,  40,
            5,  80,
            7,  160,   // state view — blobs overlap, smooth regional heatmap
            9,  220,
            11, 280,
            13, 360,
            16, 500,
          ],

          'heatmap-opacity': 0.82,

          // transparent → green → yellow → orange → red → purple
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0,    'rgba(0,0,0,0)',
            0.1,  '#22c55e',
            0.3,  '#eab308',
            0.55, '#f97316',
            0.75, '#ef4444',
            1.0,  '#9333ea',
          ],
        },
      })
    }

    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [data, visible]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
