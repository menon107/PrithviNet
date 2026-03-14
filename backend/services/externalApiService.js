const axios = require('axios');

const OPENMETEO_URL = process.env.OPENMETEO_BASE_URL || 'https://air-quality-api.open-meteo.com/v1';
const OPENAQ_URL = 'https://api.openaq.io/v2';

/**
 * Fetch hourly air quality from Open-Meteo
 */
const fetchOpenMeteo = async (latitude, longitude) => {
  const params = [
    'pm2_5', 'pm10', 'nitrogen_dioxide', 'sulphur_dioxide',
    'carbon_monoxide', 'ozone', 'european_aqi',
  ].join(',');

  const response = await axios.get(`${OPENMETEO_URL}/air-quality`, {
    params: {
      latitude,
      longitude,
      hourly: params,
      forecast_days: 3,
      timezone: 'Asia/Kolkata',
    },
    timeout: 10000,
  });

  const { hourly } = response.data;
  const now = new Date();

  // Return last 24 + next 24 hours
  const result = hourly.time.map((time, i) => ({
    time,
    pm25: hourly.pm2_5[i],
    pm10: hourly.pm10[i],
    no2: hourly.nitrogen_dioxide[i],
    so2: hourly.sulphur_dioxide[i],
    co: hourly.carbon_monoxide[i],
    o3: hourly.ozone[i],
    aqi: hourly.european_aqi[i],
  }));

  return { source: 'open-meteo', latitude, longitude, data: result };
};

/**
 * Fetch nearest stations from OpenAQ
 */
const fetchOpenAQ = async (latitude, longitude, radius = 25000) => {
  const headers = {};
  if (process.env.OPENAQ_API_KEY) headers['X-API-Key'] = process.env.OPENAQ_API_KEY;

  const response = await axios.get(`${OPENAQ_URL}/locations`, {
    params: { coordinates: `${latitude},${longitude}`, radius, limit: 10, order_by: 'distance' },
    headers,
    timeout: 10000,
  });

  return { source: 'openaq', latitude, longitude, stations: response.data.results };
};

/**
 * Unified fetch — tries requested source, falls back to mock data
 */
const fetchAirQuality = async (latitude, longitude, source = 'openmeteo') => {
  try {
    if (source === 'openmeteo') return await fetchOpenMeteo(latitude, longitude);
    if (source === 'openaq') return await fetchOpenAQ(latitude, longitude);
  } catch (error) {
    console.warn(`⚠️  External API (${source}) failed: ${error.message}. Returning mock data.`);
  }

  // Mock fallback
  return {
    source: 'mock',
    latitude,
    longitude,
    note: 'External API unavailable',
    data: generateMockHourly(),
  };
};

const generateMockHourly = () => {
  const hours = [];
  for (let i = 0; i < 48; i++) {
    const t = new Date(Date.now() + i * 3600 * 1000);
    hours.push({
      time: t.toISOString(),
      pm25: Math.round(40 + Math.random() * 80),
      pm10: Math.round(60 + Math.random() * 100),
      no2: Math.round(20 + Math.random() * 60),
      so2: Math.round(10 + Math.random() * 40),
      co: Math.round(500 + Math.random() * 1000),
      aqi: Math.round(80 + Math.random() * 120),
    });
  }
  return hours;
};

/**
 * Scheduled sync: update MonitoringStation last_reading from OpenAQ
 */
const syncStationReadings = async (stations) => {
  const MonitoringStation = require('../models/MonitoringStation');
  const updated = [];

  for (const station of stations) {
    if (!station.external_station_id) continue;
    try {
      const response = await axios.get(`${OPENAQ_URL}/measurements`, {
        params: { location_id: station.external_station_id, limit: 10, order_by: 'datetime' },
        timeout: 8000,
      });

      const readings = response.data.results;
      const reading = {};
      for (const r of readings) {
        if (r.parameter === 'pm25') reading.pm25 = r.value;
        if (r.parameter === 'pm10') reading.pm10 = r.value;
        if (r.parameter === 'no2') reading.no2 = r.value;
        if (r.parameter === 'so2') reading.so2 = r.value;
      }

      if (Object.keys(reading).length) {
        reading.timestamp = new Date();
        await MonitoringStation.findByIdAndUpdate(station._id, { last_reading: reading });
        updated.push(station._id);
      }
    } catch (e) {
      console.warn(`⚠️  Sync failed for station ${station.name}: ${e.message}`);
    }
  }

  return updated;
};

module.exports = { fetchAirQuality, fetchOpenMeteo, fetchOpenAQ, syncStationReadings };
