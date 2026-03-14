const Region = require('../models/Region');
const Industry = require('../models/Industry');
const MonitoringReport = require('../models/MonitoringReport');

// GET /regions
const getRegions = async (req, res, next) => {
  try {
    const { state, search } = req.query;
    const filter = { is_active: true };
    if (state) filter.state = state;
    if (search) filter.name = { $regex: search, $options: 'i' };

    const regions = await Region.find(filter)
      .populate('regional_officer_id', 'name email')
      .select('-boundary_polygon')
      .sort({ name: 1 });

    res.json({ success: true, data: regions });
  } catch (error) {
    next(error);
  }
};

// GET /regions/:id
const getRegionById = async (req, res, next) => {
  try {
    const region = await Region.findById(req.params.id)
      .populate('regional_officer_id', 'name email phone')
      .populate('monitoring_stations');
    if (!region) return res.status(404).json({ success: false, message: 'Region not found.' });
    res.json({ success: true, data: region });
  } catch (error) {
    next(error);
  }
};

// POST /regions  (Super Admin)
const createRegion = async (req, res, next) => {
  try {
    const region = await Region.create(req.body);
    res.status(201).json({ success: true, data: region });
  } catch (error) {
    next(error);
  }
};

// PUT /regions/:id  (Super Admin)
const updateRegion = async (req, res, next) => {
  try {
    const region = await Region.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!region) return res.status(404).json({ success: false, message: 'Region not found.' });
    res.json({ success: true, data: region });
  } catch (error) {
    next(error);
  }
};

// GET /regions/:id/dashboard  — aggregated stats for a region
const getRegionDashboard = async (req, res, next) => {
  try {
    const { id } = req.params;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const [region, industryCount, todayReports, violations7d, avgAir] = await Promise.all([
      Region.findById(id).select('name state environmental_limits'),
      Industry.countDocuments({ region_id: id, is_active: true }),
      MonitoringReport.countDocuments({ region_id: id, date: { $gte: today } }),
      MonitoringReport.countDocuments({ region_id: id, is_compliant: false, date: { $gte: sevenDaysAgo } }),
      MonitoringReport.aggregate([
        { $match: { region_id: require('mongoose').Types.ObjectId(id), date: { $gte: sevenDaysAgo } } },
        { $group: { _id: null, avg_aqi: { $avg: '$air_data.aqi' }, avg_pm25: { $avg: '$air_data.pm25' } } },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        region,
        stats: {
          total_industries: industryCount,
          reports_today: todayReports,
          violations_7d: violations7d,
          avg_aqi_7d: avgAir[0]?.avg_aqi?.toFixed(1) || null,
          avg_pm25_7d: avgAir[0]?.avg_pm25?.toFixed(1) || null,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getRegions, getRegionById, createRegion, updateRegion, getRegionDashboard };
