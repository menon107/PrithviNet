import { fetchAirQuality, fetchGoogleAQI, fetchGoogleAQIHistory, fetchGoogleAQIForecast } from '../services/externalApiService.js'

// Monitoring locations spread across Chhattisgarh for full-state coverage
const LOCATIONS = [
  // Central / Raipur belt
  { name: 'Raipur',       lat: 21.2514, lon: 81.6296 },
  { name: 'Durg',         lat: 21.1904, lon: 81.2849 },
  { name: 'Rajnandgaon',  lat: 21.0972, lon: 81.0372 },
  { name: 'Dhamtari',     lat: 20.7082, lon: 81.5488 },
  { name: 'Gariaband',    lat: 20.6330, lon: 82.0700 },
  { name: 'Bemetara',     lat: 21.7100, lon: 81.5300 },
  { name: 'Kawardha',     lat: 22.0100, lon: 81.2300 },
  // Northern belt
  { name: 'Bilaspur',     lat: 22.0796, lon: 82.1391 },
  { name: 'Korba',        lat: 22.3595, lon: 82.7501 },
  { name: 'Janjgir',      lat: 22.0200, lon: 82.5800 },
  { name: 'Raigarh',      lat: 21.8974, lon: 83.3950 },
  { name: 'Ambikapur',    lat: 23.1203, lon: 83.1960 },
  { name: 'Balrampur',    lat: 23.5800, lon: 83.6000 },
  // Southern / Bastar belt
  { name: 'Kanker',       lat: 20.2726, lon: 81.4900 },
  { name: 'Kondagaon',    lat: 19.5900, lon: 81.6600 },
  { name: 'Jagdalpur',    lat: 19.0760, lon: 82.0090 },
  { name: 'Narayanpur',   lat: 19.7200, lon: 81.2500 },
  { name: 'Dantewada',    lat: 18.9100, lon: 81.3500 },
  { name: 'Sukma',        lat: 18.3900, lon: 81.9700 },
  { name: 'Bijapur',      lat: 18.8300, lon: 80.2500 },
]

/**
 * GET /api/v1/pollution/heatmap
 *
 * Returns a GeoJSON FeatureCollection of Point features.
 * Each feature has a `pm25` property — Mapbox reads this directly
 * as the heatmap weight via ["get", "pm25"].
 *
 * Also returns a `details` array for the sidebar city-by-city table.
 */
export async function getHeatmapData(_req, res) {
  try {
    const results = await Promise.all(
      LOCATIONS.map(async ({ name, lat, lon }) => {
        const { pm25, pm10 } = await fetchAirQuality(lat, lon)
        return {
          name,
          lat,
          lon,
          pm25: Math.round(pm25 * 10) / 10,
          pm10: Math.round(pm10 * 10) / 10,
        }
      })
    )

    // GeoJSON FeatureCollection — Mapbox heatmap source format
    const geojson = {
      type: 'FeatureCollection',
      features: results.map(({ lat, lon, pm25, pm10, name }) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lon, lat],   // GeoJSON is [lng, lat]
        },
        properties: { pm25, pm10, name },
      })),
    }

    res.json({
      geojson,
      details:   results,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[pollutionController] getHeatmapData:', err)
    res.status(500).json({ error: 'Failed to fetch air quality data' })
  }
}

/**
 * GET /api/v1/pollution/google-aqi
 *
 * Returns current India AQI for all monitoring locations, sourced from
 * the Google Air Quality API (currentConditions:lookup).
 */
export async function getGoogleAQIData(_req, res) {
  try {
    const results = await Promise.all(
      LOCATIONS.map(async ({ name, lat, lon }) => {
        const { aqi, aqiDisplay, category, dominantPollutant } = await fetchGoogleAQI(lat, lon)
        return { name, lat, lon, aqi, aqiDisplay, category, dominantPollutant }
      })
    )
    res.json({ cities: results, timestamp: new Date().toISOString() })
  } catch (err) {
    console.error('[pollutionController] getGoogleAQIData:', err)
    res.status(500).json({ error: 'Failed to fetch Google AQI data' })
  }
}

/**
 * GET /api/v1/pollution/hourly?lat=XX&lon=YY
 *
 * Returns past 24 h of hourly AQI history + next 24 h forecast
 * for the supplied coordinate, both sourced from Google Air Quality API.
 */
export async function getHourlyData(req, res) {
  const lat = parseFloat(req.query.lat)
  const lon = parseFloat(req.query.lon)
  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: 'lat and lon query params are required' })
  }
  try {
    const [history, forecast] = await Promise.all([
      fetchGoogleAQIHistory(lat, lon, 24),
      fetchGoogleAQIForecast(lat, lon, 24),
    ])
    res.json({ history, forecast, timestamp: new Date().toISOString() })
  } catch (err) {
    console.error('[pollutionController] getHourlyData:', err)
    res.status(500).json({ error: 'Failed to fetch hourly AQI data' })
  }
}
