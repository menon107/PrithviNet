const mongoose = require('mongoose');
const Forecast = require('../models/Forecast');
const { ROLES } = require('../config/roles');

function normalizeRegionId(rid) {
  if (!rid) return null;
  if (typeof rid === 'string' && mongoose.Types.ObjectId.isValid(rid)) return new mongoose.Types.ObjectId(rid);
  if (rid._id) return rid._id;
  return rid;
}

// GET /forecast — list forecasts (currently not filtered by region so content always shows)
const getForecasts = async (req, res, next) => {
  try {
    const { type, from_date, to_date, limit = 20 } = req.query;

    const filter = {};
    if (type) filter.type = type;
    if (from_date || to_date) {
      const dateQ = {};
      if (from_date) dateQ.$gte = new Date(from_date);
      if (to_date) dateQ.$lte = new Date(to_date);
      Object.assign(filter, {
        $or: [{ forecast_date: dateQ }, { date: dateQ }],
      });
    }

    const forecasts = await Forecast.find(filter)
      .populate('region_id', 'name')
      .populate('industry_id', 'name')
      .sort({ forecast_time: -1, generated_at: -1, forecast_date: -1, date: -1, created_at: -1 })
      .limit(parseInt(limit, 10))
      .lean();

    res.json({ success: true, data: forecasts });
  } catch (error) {
    next(error);
  }
};

module.exports = { getForecasts };
