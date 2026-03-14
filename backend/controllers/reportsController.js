const mongoose = require('mongoose');
const MonitoringReport = require('../models/MonitoringReport');
const Industry = require('../models/Industry');
const Alert = require('../models/Alert');
const { checkCompliance } = require('../services/complianceService');
const { getReportInsights } = require('../services/geminiService');

// POST /reports  — Industry submits daily report
const submitReport = async (req, res, next) => {
  try {
    const { industry_id, date, air_data, water_data, noise_data, production_data, sensor_metadata } = req.body;

    // Verify industry ownership for industry role
    if (req.user.role === 'industry') {
      if (req.user.industry_id?.toString() !== industry_id) {
        return res.status(403).json({ success: false, message: 'Cannot submit report for another industry.' });
      }
    }

    const industry = await Industry.findById(industry_id).populate('region_id');
    if (!industry) return res.status(404).json({ success: false, message: 'Industry not found.' });

    // Check compliance against limits
    const complianceResult = checkCompliance({ air_data, water_data, noise_data }, industry);

    const report = await MonitoringReport.create({
      industry_id,
      region_id: industry.region_id,
      submitted_by: req.user._id,
      date: new Date(date),
      air_data,
      water_data,
      noise_data,
      production_data,
      sensor_metadata,
      violations: complianceResult.violations,
      has_violations: complianceResult.violations.length > 0,
      is_compliant: complianceResult.is_compliant,
      compliance_score: complianceResult.score,
      compliance_status: complianceResult.status,
    });

    // Update industry compliance score & last report date
    industry.last_report_date = new Date();
    industry.compliance_score = complianceResult.score;
    industry.compliance_status = complianceResult.status;
    if (!complianceResult.is_compliant) industry.total_violations += 1;
    await industry.save();

    // Generate violation alerts
    if (!complianceResult.is_compliant) {
      await Alert.create({
        type: 'violation_alert',
        severity: complianceResult.status === 'critical' ? 'critical' : 'high',
        title: `Pollution Violation: ${industry.name}`,
        message: `${industry.name} reported ${complianceResult.violations.length} parameter violation(s).`,
        region_id: industry.region_id,
        industry_id: industry._id,
        report_id: report._id,
        target_roles: ['regional_officer', 'super_admin'],
        metadata: {
          parameter: complianceResult.violations[0]?.parameter,
          measured_value: complianceResult.violations[0]?.measured_value,
          limit_value: complianceResult.violations[0]?.limit_value,
        },
      });
    }

    res.status(201).json({ success: true, data: report, compliance: complianceResult });
  } catch (error) {
    next(error);
  }
};

// POST /reports/period — Industry generates & submits weekly or monthly report from daily data
const submitPeriodReport = async (req, res, next) => {
  try {
    const { industry_id, reporting_period, period_end } = req.body;
    if (!['weekly', 'monthly'].includes(reporting_period) || !period_end) {
      return res.status(400).json({ success: false, message: 'reporting_period (weekly|monthly) and period_end required.' });
    }

    if (req.user.role === 'industry' && req.user.industry_id?.toString() !== industry_id) {
      return res.status(403).json({ success: false, message: 'Cannot submit for another industry.' });
    }

    const industry = await Industry.findById(industry_id).populate('region_id');
    if (!industry) return res.status(404).json({ success: false, message: 'Industry not found.' });

    const end = new Date(period_end);
    end.setHours(23, 59, 59, 999);
    let start;
    if (reporting_period === 'weekly') {
      start = new Date(end);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
    } else {
      start = new Date(end.getFullYear(), end.getMonth(), 1, 0, 0, 0, 0);
    }

    const dailyReports = await MonitoringReport.find({
      industry_id,
      date: { $gte: start, $lte: end },
      $or: [{ reporting_period: 'daily' }, { reporting_period: { $exists: false } }],
    }).sort({ date: 1 }).lean();

    if (!dailyReports.length) {
      return res.status(400).json({ success: false, message: 'No daily reports in this period. Submit daily data first.' });
    }

    const endDayStart = new Date(end);
    endDayStart.setHours(0, 0, 0, 0);
    const existing = await MonitoringReport.findOne({
      industry_id,
      reporting_period,
      date: { $gte: endDayStart, $lte: end },
    });
    if (existing) {
      return res.status(400).json({ success: false, message: 'A report for this period already exists.' });
    }

    const n = dailyReports.length;
    const sum = (key, getter) => dailyReports.reduce((s, r) => s + (getter(r) || 0), 0);
    const avg = (key, getter) => (sum(key, getter) / n);

    const air_data = {
      pm25: Math.round(avg('pm25', (r) => r.air_data?.pm25) * 100) / 100,
      pm10: Math.round(avg('pm10', (r) => r.air_data?.pm10) * 100) / 100,
      so2: Math.round(avg('so2', (r) => r.air_data?.so2) * 100) / 100,
      no2: Math.round(avg('no2', (r) => r.air_data?.no2) * 100) / 100,
      co: Math.round(avg('co', (r) => r.air_data?.co) * 100) / 100,
      temperature: Math.round(avg('temp', (r) => r.air_data?.temperature) * 100) / 100,
      humidity: Math.round(avg('hum', (r) => r.air_data?.humidity) * 100) / 100,
    };
    const water_data = {
      ph: Math.round(avg('ph', (r) => r.water_data?.ph) * 100) / 100,
      bod: Math.round(avg('bod', (r) => r.water_data?.bod) * 100) / 100,
      cod: Math.round(avg('cod', (r) => r.water_data?.cod) * 100) / 100,
      tss: Math.round(avg('tss', (r) => r.water_data?.tss) * 100) / 100,
      turbidity: Math.round(avg('turb', (r) => r.water_data?.turbidity) * 100) / 100,
    };
    const noise_data = {
      day_db: Math.round(avg('day', (r) => r.noise_data?.day_db) * 100) / 100,
      night_db: Math.round(avg('night', (r) => r.noise_data?.night_db) * 100) / 100,
      peak_db: Math.round(avg('peak', (r) => r.noise_data?.peak_db) * 100) / 100,
    };

    const avgCompliance = sum('score', (r) => r.compliance_score) / n;
    const periodScore = Math.round(avgCompliance);
    const periodStatus = periodScore >= 70 ? 'compliant' : periodScore >= 40 ? 'warning' : periodScore >= 20 ? 'violation' : 'critical';

    const summary_chart_data = dailyReports.map((r) => ({
      date: r.date,
      air: r.air_data,
      water: r.water_data,
      noise: r.noise_data,
      compliance_score: r.compliance_score,
    }));

    const regionId = industry.region_id?._id || industry.region_id;
    const report = await MonitoringReport.create({
      industry_id,
      region_id: regionId,
      submitted_by: req.user._id,
      date: end,
      reporting_period,
      period_start: start,
      period_end: end,
      air_data,
      water_data,
      noise_data,
      compliance_score: periodScore,
      compliance_status: periodStatus,
      is_compliant: periodScore >= 70,
      has_violations: periodScore < 70,
      violations: [],
      summary_chart_data,
    });

    res.status(201).json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
};

// GET /reports  — paginated, filterable
const getReports = async (req, res, next) => {
  try {
    const { region_id, industry_id, status, from_date, to_date, is_compliant, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (region_id) filter.region_id = region_id;
    if (status) filter.status = status;
    if (is_compliant !== undefined) filter.is_compliant = is_compliant === 'true';

    // Industry users see only their own
    if (req.user.role === 'industry') {
      filter.industry_id = req.user.industry_id;
    } else if (industry_id) {
      filter.industry_id = industry_id;
    }

    // Regional officers see only their region
    if (req.user.role === 'regional_officer') {
      filter.region_id = req.user.region_id;
    }

    if (from_date || to_date) {
      filter.date = {};
      if (from_date) filter.date.$gte = new Date(from_date);
      if (to_date) filter.date.$lte = new Date(to_date);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [reports, total] = await Promise.all([
      MonitoringReport.find(filter)
        .populate('industry_id', 'name industry_type')
        .populate('region_id', 'name')
        .sort({ date: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      MonitoringReport.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: reports,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// GET /reports/region/:region_id — reports for all industries in a region (optional filter: reporting_period=weekly,monthly)
const getRegionReports = async (req, res, next) => {
  try {
    const { region_id: regionIdParam } = req.params;
    const { from_date, to_date, reporting_period, status, is_compliant, page = 1, limit = 20 } = req.query;

    let regionIdFilter;
    try {
      regionIdFilter = new mongoose.Types.ObjectId(regionIdParam);
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid region ID.' });
    }

    const filter = { region_id: regionIdFilter };

    if (reporting_period) {
      const periods = reporting_period.split(',').map((p) => p.trim()).filter(Boolean);
      if (periods.length) filter.reporting_period = { $in: periods };
    }
    if (status) filter.status = status;
    if (is_compliant !== undefined && is_compliant !== '') filter.is_compliant = is_compliant === 'true';

    if (from_date || to_date) {
      filter.date = {};
      if (from_date) filter.date.$gte = new Date(from_date);
      if (to_date) filter.date.$lte = new Date(to_date);
    }

    // Regional officers can only see their own region (compare ids correctly whether populated or not)
    const officerRegionId = req.user.region_id?._id ?? req.user.region_id;
    if (req.user.role === 'regional_officer' && officerRegionId?.toString() !== regionIdParam) {
      return res.status(403).json({ success: false, message: 'Access denied for this region.' });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [reports, total] = await Promise.all([
      MonitoringReport.find(filter)
        .populate('industry_id', 'name industry_type')
        .populate('region_id', 'name')
        .sort({ date: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      MonitoringReport.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: reports,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /reports/:id
const getReportById = async (req, res, next) => {
  try {
    const report = await MonitoringReport.findById(req.params.id)
      .populate('industry_id', 'name industry_type location emission_limits')
      .populate('region_id', 'name environmental_limits')
      .populate('submitted_by', 'name email')
      .populate('reviewed_by', 'name email');

    if (!report) return res.status(404).json({ success: false, message: 'Report not found.' });

    // Industry users can only see their own
    if (req.user.role === 'industry' && report.industry_id._id.toString() !== req.user.industry_id?.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    res.json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
};

// GET /reports/industry/:industry_id  — full history for one industry (optional: reporting_period=daily|weekly|weekly,monthly)
const getIndustryReports = async (req, res, next) => {
  try {
    const { industry_id } = req.params;
    const { from_date, to_date, reporting_period, page = 1, limit = 30 } = req.query;

    const filter = { industry_id };
    if (reporting_period) {
      const periods = reporting_period.split(',').map((p) => p.trim()).filter(Boolean);
      if (periods.length) filter.reporting_period = { $in: periods };
    }
    if (from_date || to_date) {
      filter.date = {};
      if (from_date) filter.date.$gte = new Date(from_date);
      if (to_date) filter.date.$lte = new Date(to_date);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [reports, total] = await Promise.all([
      MonitoringReport.find(filter).sort({ date: -1 }).skip(skip).limit(parseInt(limit)),
      MonitoringReport.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: reports,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /reports/:id/review  — Regional Officer reviews a report
const reviewReport = async (req, res, next) => {
  try {
    const { status, review_notes } = req.body;
    const report = await MonitoringReport.findByIdAndUpdate(
      req.params.id,
      { status, review_notes, reviewed_by: req.user._id, reviewed_at: new Date() },
      { new: true }
    );
    if (!report) return res.status(404).json({ success: false, message: 'Report not found.' });
    res.json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
};

// GET /reports/:id/insights  — Gemini-generated insights for a report (what to fix)
const getReportInsightsHandler = async (req, res, next) => {
  try {
    const report = await MonitoringReport.findById(req.params.id)
      .populate('industry_id', 'name industry_type emission_limits');
    if (!report) return res.status(404).json({ success: false, message: 'Report not found.' });

    if (req.user.role === 'regional_officer') {
      const officerRegionId = req.user.region_id?._id?.toString() ?? req.user.region_id?.toString();
      const reportRegionId = report.region_id?._id?.toString() ?? report.region_id?.toString();
      if (officerRegionId !== reportRegionId) {
        return res.status(403).json({ success: false, message: 'Access denied for this report.' });
      }
    }
    if (req.user.role === 'industry' && report.industry_id._id.toString() !== req.user.industry_id?.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const industry = report.industry_id;
    const insights = await getReportInsights(report.toObject ? report.toObject() : report, industry?.toObject ? industry.toObject() : industry);
    res.json({ success: true, data: insights });
  } catch (err) {
    if (err.message?.includes('GEMINI_API_KEY')) {
      return res.status(503).json({ success: false, message: 'AI insights service not configured.' });
    }
    next(err);
  }
};

// GET /reports/missing  — Industries that haven't reported today
const getMissingReports = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const filter = { is_active: true };
    if (req.user.role === 'regional_officer') filter.region_id = req.user.region_id;
    if (req.query.region_id) filter.region_id = req.query.region_id;

    const allIndustries = await Industry.find(filter).select('_id name industry_type region_id');
    const reportedToday = await MonitoringReport.find({ date: { $gte: today } }).distinct('industry_id');

    const reportedSet = new Set(reportedToday.map((id) => id.toString()));
    const missing = allIndustries.filter((i) => !reportedSet.has(i._id.toString()));

    res.json({ success: true, data: missing, count: missing.length });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  submitReport,
  submitPeriodReport,
  getReports,
  getReportById,
  getReportInsightsHandler,
  getIndustryReports,
  getRegionReports,
  reviewReport,
  getMissingReports,
};
