const MonitoringReport = require('../models/MonitoringReport');
const MonitoringStation = require('../models/MonitoringStation');
const Industry = require('../models/Industry');
const externalApiService = require('../services/externalApiService');
const attributionService = require('../services/attributionService');

// GET /pollution/air — aggregated air quality data
const getAirPollution = async (req, res, next) => {
  try {
    const { region_id, from_date, to_date, industry_id } = req.query;

    const match = {};
    if (region_id) match.region_id = require('mongoose').Types.ObjectId(region_id);
    if (industry_id) match.industry_id = require('mongoose').Types.ObjectId(industry_id);

    const dateFilter = {};
    if (from_date) dateFilter.$gte = new Date(from_date);
    if (to_date) dateFilter.$lte = new Date(to_date);
    if (Object.keys(dateFilter).length) match.date = dateFilter;

    const data = await MonitoringReport.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          avg_pm25: { $avg: '$air_data.pm25' },
          avg_pm10: { $avg: '$air_data.pm10' },
          avg_so2: { $avg: '$air_data.so2' },
          avg_no2: { $avg: '$air_data.no2' },
          avg_co: { $avg: '$air_data.co' },
          avg_aqi: { $avg: '$air_data.aqi' },
          max_pm25: { $max: '$air_data.pm25' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 90 },
    ]);

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// GET /pollution/water
const getWaterPollution = async (req, res, next) => {
  try {
    const { region_id, industry_id, from_date, to_date } = req.query;
    const match = {};
    if (region_id) match.region_id = require('mongoose').Types.ObjectId(region_id);
    if (industry_id) match.industry_id = require('mongoose').Types.ObjectId(industry_id);
    if (from_date || to_date) {
      match.date = {};
      if (from_date) match.date.$gte = new Date(from_date);
      if (to_date) match.date.$lte = new Date(to_date);
    }

    const data = await MonitoringReport.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          avg_ph: { $avg: '$water_data.ph' },
          avg_bod: { $avg: '$water_data.bod' },
          avg_cod: { $avg: '$water_data.cod' },
          avg_tss: { $avg: '$water_data.tss' },
          avg_turbidity: { $avg: '$water_data.turbidity' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 90 },
    ]);

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// GET /pollution/noise
const getNoisePollution = async (req, res, next) => {
  try {
    const { region_id, industry_id, from_date, to_date } = req.query;
    const match = {};
    if (region_id) match.region_id = require('mongoose').Types.ObjectId(region_id);
    if (industry_id) match.industry_id = require('mongoose').Types.ObjectId(industry_id);

    if (from_date || to_date) {
      match.date = {};
      if (from_date) match.date.$gte = new Date(from_date);
      if (to_date) match.date.$lte = new Date(to_date);
    }

    const data = await MonitoringReport.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          avg_day_db: { $avg: '$noise_data.day_db' },
          avg_night_db: { $avg: '$noise_data.night_db' },
          max_peak_db: { $max: '$noise_data.peak_db' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 90 },
    ]);

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// GET /pollution/map — current readings for all stations (heatmap data)
const getPollutionMap = async (req, res, next) => {
  try {
    const { region_id, pollutant = 'pm25' } = req.query;

    const filter = { status: 'active' };
    if (region_id) filter.region_id = region_id;

    const stations = await MonitoringStation.find(filter)
      .select('name location last_reading status region_id')
      .populate('region_id', 'name');

    // Also fetch latest industry report positions
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const recentReports = await MonitoringReport.find({ date: { $gte: today } })
      .populate('industry_id', 'name location industry_type')
      .select('air_data industry_id is_compliant');

    // Approved industries with boundary polygons for map overlay
    const industriesWithPolygons = await Industry.find({
      is_active: true,
      approval_status: 'approved',
      boundary_polygon: { $exists: true, $ne: [] },
      ...(region_id ? { region_id } : {}),
    }).select('name industry_type compliance_score boundary_polygon');

    // Latest report compliance per industry (so map shows actual score, not stale Industry default)
    const industryIds = industriesWithPolygons.map((ind) => ind._id);
    const latestByIndustry = await MonitoringReport.aggregate([
      { $match: { industry_id: { $in: industryIds } } },
      { $sort: { date: -1 } },
      { $group: { _id: '$industry_id', compliance_score: { $first: '$compliance_score' }, compliance_status: { $first: '$compliance_status' } } },
    ]);
    const complianceByIndustryId = Object.fromEntries(
      latestByIndustry.map((r) => [r._id.toString(), { score: r.compliance_score, status: r.compliance_status }])
    );

    res.json({
      success: true,
      data: {
        stations: stations.map((s) => ({
          id: s._id,
          name: s.name,
          coordinates: s.location.coordinates,
          region: s.region_id?.name,
          value: s.last_reading?.[pollutant],
          aqi: s.last_reading?.aqi,
          status: s.status,
          timestamp: s.last_reading?.timestamp,
        })),
        industry_points: recentReports
          .filter((r) => r.industry_id?.location)
          .map((r) => ({
            id: r.industry_id._id,
            name: r.industry_id.name,
            type: r.industry_id.industry_type,
            coordinates: r.industry_id.location.coordinates,
            value: r.air_data?.[pollutant],
            is_compliant: r.is_compliant,
          })),
        industry_polygons: industriesWithPolygons.map((ind) => {
          const fromReport = complianceByIndustryId[ind._id.toString()];
          const score = fromReport?.score != null ? fromReport.score : ind.compliance_score;
          return {
            id: ind._id,
            name: ind.name,
            type: ind.industry_type,
            compliance_score: score,
            boundary_polygon: ind.boundary_polygon.map((p) => [p.lat, p.lng]),
          };
        }),
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /pollution/external — fetch from Open-Meteo/OpenAQ
const getExternalPollution = async (req, res, next) => {
  try {
    const { latitude, longitude, source = 'openmeteo' } = req.query;
    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, message: 'latitude and longitude required.' });
    }
    const data = await externalApiService.fetchAirQuality(parseFloat(latitude), parseFloat(longitude), source);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// GET /pollution/summary — regional summary stats
const getPollutionSummary = async (req, res, next) => {
  try {
    const { region_id } = req.query;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const match = { date: { $gte: sevenDaysAgo } };
    if (region_id) match.region_id = require('mongoose').Types.ObjectId(region_id);

    const [airSummary, violations, totalReports] = await Promise.all([
      MonitoringReport.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            avg_aqi: { $avg: '$air_data.aqi' },
            avg_pm25: { $avg: '$air_data.pm25' },
            max_pm25: { $max: '$air_data.pm25' },
            avg_pm10: { $avg: '$air_data.pm10' },
          },
        },
      ]),
      MonitoringReport.countDocuments({ ...match, is_compliant: false }),
      MonitoringReport.countDocuments(match),
    ]);

    res.json({
      success: true,
      data: {
        period: '7 days',
        air: airSummary[0] || {},
        violations,
        total_reports: totalReports,
        compliance_rate: totalReports > 0 ? (((totalReports - violations) / totalReports) * 100).toFixed(1) : 100,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /pollution/attribution — which industries likely caused pollution at (lat, lng)
const getPollutionAttribution = async (req, res, next) => {
  try {
    const { latitude, longitude, region_id, pollutant = 'pm25' } = req.query;
    if (latitude == null || longitude == null) {
      return res.status(400).json({ success: false, message: 'latitude and longitude are required.' });
    }
    const result = await attributionService.getAttributionForPoint({
      latitude,
      longitude,
      region_id: region_id || undefined,
      pollutant,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAirPollution,
  getWaterPollution,
  getNoisePollution,
  getPollutionMap,
  getExternalPollution,
  getPollutionSummary,
  getPollutionAttribution,
};
