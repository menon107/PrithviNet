const BASE = '/api/v1'

async function get(path) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`)
  return res.json()
}

/** Current India AQI for all Chhattisgarh cities (via Google Air Quality API). */
export async function fetchGoogleAQIData() {
  return get('/pollution/google-aqi')
}

/**
 * Hourly AQI history (past 24 h) + forecast (next 24 h) for a coordinate.
 * Returns { history: [...], forecast: [...], timestamp }
 */
export async function fetchHourlyData(lat, lon) {
  return get(`/pollution/hourly?lat=${lat}&lon=${lon}`)
}
