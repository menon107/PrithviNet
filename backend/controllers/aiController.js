const Simulation = require('../models/Simulation');
const MonitoringReport = require('../models/MonitoringReport');
const Industry = require('../models/Industry');
const aiService = require('../services/aiService');

// POST /simulation/run
const runSimulation = async (req, res, next) => {
  try {
    const { name, region_id, type, parameters, notes } = req.body;

    const simulation = await Simulation.create({
      name,
      created_by: req.user._id,
      region_id,
      type,
      parameters,
      notes,
      results: { status: 'pending' },
    });

    // Run simulation async (don't await — respond immediately)
    aiService.runDigitalTwinSimulation(simulation).then(async (results) => {
      simulation.results = { ...results, status: 'completed', completed_at: new Date() };
      await simulation.save();
    }).catch(async (err) => {
      simulation.results = { status: 'failed', error_message: err.message };
      await simulation.save();
    });

    res.status(202).json({
      success: true,
      message: 'Simulation started. Poll /simulation/:id for results.',
      data: simulation,
    });
  } catch (error) {
    next(error);
  }
};

// GET /simulation/:id
const getSimulation = async (req, res, next) => {
  try {
    const simulation = await Simulation.findById(req.params.id)
      .populate('created_by', 'name role')
      .populate('region_id', 'name')
      .populate('parameters.industries.industry_id', 'name industry_type');

    if (!simulation) return res.status(404).json({ success: false, message: 'Simulation not found.' });
    res.json({ success: true, data: simulation });
  } catch (error) {
    next(error);
  }
};

// GET /simulation  — list for a region/user
const getSimulations = async (req, res, next) => {
  try {
    const { region_id, page = 1, limit = 10 } = req.query;
    const filter = {};
    if (region_id) filter.region_id = region_id;
    if (req.user.role !== 'super_admin') filter.region_id = req.user.region_id;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [simulations, total] = await Promise.all([
      Simulation.find(filter)
        .populate('created_by', 'name')
        .populate('region_id', 'name')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Simulation.countDocuments(filter),
    ]);

    res.json({ success: true, data: simulations, pagination: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (error) {
    next(error);
  }
};

// GET /forecast/air — 24-72hr air quality forecast
const getAirForecast = async (req, res, next) => {
  try {
    const { region_id, latitude, longitude, hours = 48 } = req.query;

    // Get recent historical data for context
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const historical = await MonitoringReport.find({
      ...(region_id && { region_id }),
      date: { $gte: sevenDaysAgo },
    }).sort({ date: -1 }).select('date air_data').limit(50);

    const forecast = await aiService.generateForecast({
      historical,
      hours: parseInt(hours),
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
    });

    res.json({ success: true, data: forecast });
  } catch (error) {
    next(error);
  }
};

// GET /ai/attribution — pollution source attribution
const getPollutionAttribution = async (req, res, next) => {
  try {
    const { region_id, pollutant = 'pm25', date } = req.query;

    const targetDate = date ? new Date(date) : new Date();
    const dayStart = new Date(targetDate.setHours(0, 0, 0, 0));
    const dayEnd = new Date(targetDate.setHours(23, 59, 59, 999));

    const reports = await MonitoringReport.find({
      region_id,
      date: { $gte: dayStart, $lte: dayEnd },
    }).populate('industry_id', 'name industry_type location');

    const attribution = await aiService.attributePollutionSource({
      reports,
      region_id,
      pollutant,
      date: targetDate,
    });

    res.json({ success: true, data: attribution });
  } catch (error) {
    next(error);
  }
};

// GET /ai/compliance-risk — predict compliance violations
const getComplianceRisk = async (req, res, next) => {
  try {
    const { industry_id } = req.query;

    const industry = await Industry.findById(industry_id);
    if (!industry) return res.status(404).json({ success: false, message: 'Industry not found.' });

    const recentReports = await MonitoringReport.find({ industry_id })
      .sort({ date: -1 })
      .limit(30)
      .select('date air_data water_data noise_data is_compliant violations');

    const risk = await aiService.predictComplianceRisk({ industry, recentReports });
    res.json({ success: true, data: risk });
  } catch (error) {
    next(error);
  }
};

// GET /ai/inspection-optimization — recommend which industries to inspect
const getInspectionOptimization = async (req, res, next) => {
  try {
    const { region_id, top_n = 5 } = req.query;

    const industries = await Industry.find({
      region_id,
      is_active: true,
    }).select('name industry_type compliance_score compliance_status total_violations last_report_date location');

    const recommendations = await aiService.optimizeInspections({ industries, top_n: parseInt(top_n) });
    res.json({ success: true, data: recommendations });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  runSimulation,
  getSimulation,
  getSimulations,
  getAirForecast,
  getPollutionAttribution,
  getComplianceRisk,
  getInspectionOptimization,
};
