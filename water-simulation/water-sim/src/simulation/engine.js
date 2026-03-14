/**
 * Simulation engine — WQI-based model.
 *
 * Each layer: { id, type, name, wqi: 0..100, params: {...} }
 * Higher WQI = cleaner water. Simulation drives params → recomputes WQI.
 */

import { computeWQI, wqiToColor, defaultParams, PRESETS } from './wqi.js'

/** Apply one simulation tick to the layers array (mutates in place). */
export function simulateTick(layers, options = {}) {
  const { rainActive = false } = options

  layers.forEach((layer, i) => {
    const p = layer.params
    if (!p) return

    // Natural self-purification: params drift toward clean values
    p.cod  = Math.max(0,   p.cod  - 3   * Math.random())
    p.bod  = Math.max(0,   p.bod  - 0.5 * Math.random())
    p.do_  = Math.min(10,  p.do_  + 0.3 * Math.random())
    p.turb = Math.max(0,   p.turb - 2   * Math.random())
    p.nit  = Math.max(0,   p.nit  - 0.3 * Math.random())
    p.col  = Math.max(0,   p.col  - 100 * Math.random())

    if (rainActive) {
      // Rain dilutes pollutants faster but spikes turbidity
      p.cod  = Math.max(0,   p.cod  - 8   * Math.random())
      p.bod  = Math.max(0,   p.bod  - 1.5 * Math.random())
      p.turb = Math.min(200, p.turb + 15  * Math.random())
      p.nit  = Math.max(0,   p.nit  - 0.8 * Math.random())
    }

    // Downstream spread (rivers only, in order)
    if (i > 0 && layers[i - 1].type === 'river' && layer.type === 'river') {
      const up = layers[i - 1]
      if (up.wqi < layer.wqi) {
        Object.keys(p).forEach(k => {
          if (k === 'do_') {
            p[k] = p[k] - (p[k] - (up.params[k] ?? p[k])) * 0.15
          } else {
            p[k] = p[k] + ((up.params[k] ?? p[k]) - p[k]) * 0.15
          }
        })
      }
    }

    const { wqi } = computeWQI(p)
    layer.wqi   = wqi
    layer.color = wqiToColor(wqi)
  })
}

/**
 * Trigger an industrial spill at a segment — applies a contamination blend
 * across a radius of segments, weighted by falloff from the center.
 */
export function triggerSpill(layers, centerIndex, radius = 3) {
  const spill = PRESETS.sewage
  for (let i = centerIndex - radius; i <= centerIndex + radius; i++) {
    if (i < 0 || i >= layers.length) continue
    const falloff = 1 - Math.abs(i - centerIndex) / (radius + 1)
    const p = layers[i].params
    if (!p) continue
    // Blend toward spill values by falloff
    Object.keys(p).forEach(k => {
      if (k === 'do_') {
        p[k] = p[k] - (p[k] - spill[k]) * falloff
      } else {
        p[k] = p[k] + (spill[k] - p[k]) * falloff
      }
    })
    const { wqi } = computeWQI(p)
    layers[i].wqi   = wqi
    layers[i].color = wqiToColor(wqi)
  }
}

/** Clean a specific segment — restore to pristine parameters. */
export function cleanSegment(layers, index) {
  if (index < 0 || index >= layers.length) return
  const pristine = { ...PRESETS.pristine }
  const layer = layers[index]
  layer.params = pristine
  const { wqi } = computeWQI(pristine)
  layer.wqi   = wqi
  layer.color = wqiToColor(wqi)
}

/** Human-readable label for a WQI score. */
export function pollutionLabel(wqi) {
  if (wqi >= 80) return 'Pristine'
  if (wqi >= 60) return 'Good'
  if (wqi >= 40) return 'Fair'
  if (wqi >= 20) return 'Poor'
  return 'Critical'
}

/** Build default layer data (called by MapView for each new segment). */
export function makeLayer(id, type, name) {
  const params = defaultParams()
  const { wqi } = computeWQI(params)
  return { id, type, name, wqi, params, color: wqiToColor(wqi) }
}
