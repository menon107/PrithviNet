import axios from 'axios'

const AQ_BASE          = 'https://air-quality-api.open-meteo.com/v1/air-quality'
const GOOGLE_AQI_BASE  = 'https://airquality.googleapis.com/v1'
const GOOGLE_AQI_KEY   = process.env.GOOGLE_AQI_KEY || 'AIzaSyC_p8-fLD5dyf5i5-3UfexSg489I0r4Dd4'

/**
 * Fetch hourly PM2.5 and PM10 for a coordinate from Open-Meteo.
 * Returns the value closest to the current hour (or latest non-null).
 */
export async function fetchAirQuality(lat, lon) {
  try {
    const { data } = await axios.get(AQ_BASE, {
      params: {
        latitude:     lat,
        longitude:    lon,
        hourly:       'pm2_5,pm10',
        forecast_days: 1,
      },
      timeout: 8000,
    })

    const times  = data.hourly.time
    const pm25s  = data.hourly.pm2_5
    const pm10s  = data.hourly.pm10

    // Pick the index closest to now
    const nowIso  = new Date().toISOString().slice(0, 13)   // "YYYY-MM-DDTHH"
    let idx = times.findIndex(t => t.startsWith(nowIso))
    if (idx === -1) idx = pm25s.length - 1

    // Walk backwards to the last non-null value
    while (idx > 0 && pm25s[idx] === null) idx--

    return {
      pm25: pm25s[idx] ?? 0,
      pm10: pm10s[idx] ?? 0,
    }
  } catch (err) {
    console.error(`[externalApiService] fetchAirQuality(${lat},${lon}):`, err.message)
    return { pm25: 0, pm10: 0 }
  }
}

/**
 * Fetch current AQI conditions for a coordinate from the Google Air Quality API.
 * Returns India AQI (code "ind") or falls back to Universal AQI.
 */
export async function fetchGoogleAQI(lat, lon) {
  try {
    const { data } = await axios.post(
      `${GOOGLE_AQI_BASE}/currentConditions:lookup?key=${GOOGLE_AQI_KEY}`,
      {
        location:          { latitude: lat, longitude: lon },
        extraComputations: ['POLLUTANT_CONCENTRATION'],
        languageCode:      'en',
      },
      { timeout: 8000 }
    )

    const indIdx  = data.indexes?.find(i => i.code === 'ind')
    const uaqiIdx = data.indexes?.find(i => i.code === 'uaqi')
    const best    = indIdx ?? uaqiIdx ?? null

    return {
      aqi:              best?.aqi              ?? null,
      aqiDisplay:       best?.aqiDisplay       ?? '-',
      category:         best?.category         ?? 'Unknown',
      dominantPollutant: data.pollutants?.[0]?.displayName ?? null,
    }
  } catch (err) {
    console.error(`[externalApiService] fetchGoogleAQI(${lat},${lon}):`, err.message)
    return { aqi: null, aqiDisplay: '-', category: 'Unknown', dominantPollutant: null }
  }
}

/** Extract the best AQI index (India > Universal) from an indexes array. */
function bestIndex(indexes) {
  return indexes?.find(i => i.code === 'ind') ?? indexes?.find(i => i.code === 'uaqi') ?? null
}

/**
 * Fetch hourly AQI history for a coordinate from the Google Air Quality API.
 * Returns an array of { dateTime, aqi, category } for the past `hours` hours.
 */
export async function fetchGoogleAQIHistory(lat, lon, hours = 24) {
  try {
    const { data } = await axios.post(
      `${GOOGLE_AQI_BASE}/history:lookup?key=${GOOGLE_AQI_KEY}`,
      { location: { latitude: lat, longitude: lon }, hours, languageCode: 'en' },
      { timeout: 15000 }
    )
    return (data.hoursInfo ?? []).map(h => {
      const idx = bestIndex(h.indexes)
      return { dateTime: h.dateTime, aqi: idx?.aqi ?? null, category: idx?.category ?? 'Unknown', isForecast: false }
    })
  } catch (err) {
    console.error(`[externalApiService] fetchGoogleAQIHistory(${lat},${lon}):`, err.message)
    return []
  }
}

/**
 * Fetch hourly AQI forecast for a coordinate from the Google Air Quality API.
 * Returns an array of { dateTime, aqi, category, isForecast: true } for the next `hours` hours.
 */
export async function fetchGoogleAQIForecast(lat, lon, hours = 24) {
  try {
    const startTime = new Date().toISOString()
    const endTime   = new Date(Date.now() + hours * 3_600_000).toISOString()

    const { data } = await axios.post(
      `${GOOGLE_AQI_BASE}/forecast:lookup?key=${GOOGLE_AQI_KEY}`,
      {
        location:  { latitude: lat, longitude: lon },
        period:    { startTime, endTime },
        pageSize:  hours,
        languageCode: 'en',
      },
      { timeout: 15000 }
    )
    return (data.hourlyForecasts ?? []).map(h => {
      const idx = bestIndex(h.indexes)
      return { dateTime: h.dateTime, aqi: idx?.aqi ?? null, category: idx?.category ?? 'Unknown', isForecast: true }
    })
  } catch (err) {
    console.error(`[externalApiService] fetchGoogleAQIForecast(${lat},${lon}):`, err.message)
    return []
  }
}
