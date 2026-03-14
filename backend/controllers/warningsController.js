const IndustryWarning = require('../models/IndustryWarning');
const Industry = require('../models/Industry');
const mongoose = require('mongoose');

// POST /warnings — Officer sends a warning to an industry (optionally linked to a report)
const createWarning = async (req, res, next) => {
  try {
    const { industry_id, report_id, subject, message, action_items, priority } = req.body;

    if (!industry_id || !subject || !message) {
      return res.status(400).json({ success: false, message: 'industry_id, subject, and message are required.' });
    }

    const industry = await Industry.findById(industry_id).select('region_id');
    if (!industry) return res.status(404).json({ success: false, message: 'Industry not found.' });

    if (req.user.role === 'regional_officer') {
      const officerRegionId = req.user.region_id?._id?.toString() ?? req.user.region_id?.toString();
      const indRegionId = industry.region_id?.toString();
      if (officerRegionId !== indRegionId) {
        return res.status(403).json({ success: false, message: 'You can only send warnings to industries in your region.' });
      }
    }

    const warning = await IndustryWarning.create({
      industry_id,
      report_id: report_id || null,
      region_id: industry.region_id,
      sent_by: req.user._id,
      subject: subject.trim(),
      message,
      action_items: Array.isArray(action_items) ? action_items : [],
      priority: ['low', 'medium', 'high', 'critical'].includes(priority) ? priority : 'medium',
    });

    const populated = await IndustryWarning.findById(warning._id)
      .populate('industry_id', 'name industry_type')
      .populate('report_id', 'date compliance_score')
      .populate('sent_by', 'name email');

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

// GET /warnings — List warnings (officer: by region; industry: by own industry)
const getWarnings = async (req, res, next) => {
  try {
    const { industry_id, region_id, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (req.user.role === 'industry') {
      filter.industry_id = req.user.industry_id;
    } else if (req.user.role === 'regional_officer') {
      filter.region_id = req.user.region_id;
    }
    if (industry_id) filter.industry_id = industry_id;
    if (region_id) filter.region_id = region_id;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [warnings, total] = await Promise.all([
      IndustryWarning.find(filter)
        .populate('industry_id', 'name industry_type')
        .populate('report_id', 'date compliance_score reporting_period')
        .populate('sent_by', 'name email')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      IndustryWarning.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: warnings,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) || 1 },
    });
  } catch (error) {
    next(error);
  }
};

// GET /warnings/industry/:industry_id — Warnings for one industry
const getWarningsByIndustry = async (req, res, next) => {
  try {
    const { industry_id } = req.params;
    const filter = { industry_id };

    if (req.user.role === 'regional_officer') {
      filter.region_id = req.user.region_id;
    } else if (req.user.role === 'industry' && req.user.industry_id?.toString() !== industry_id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const warnings = await IndustryWarning.find(filter)
      .populate('report_id', 'date compliance_score')
      .populate('sent_by', 'name email')
      .sort({ created_at: -1 })
      .limit(50);

    res.json({ success: true, data: warnings });
  } catch (error) {
    next(error);
  }
};

// PATCH /warnings/:id/read — Industry marks warning as read
const markRead = async (req, res, next) => {
  try {
    const warning = await IndustryWarning.findById(req.params.id);
    if (!warning) return res.status(404).json({ success: false, message: 'Warning not found.' });

    if (req.user.role === 'industry' && warning.industry_id.toString() !== req.user.industry_id?.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    warning.status = 'read';
    warning.read_at = new Date();
    await warning.save();

    res.json({ success: true, data: warning });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createWarning,
  getWarnings,
  getWarningsByIndustry,
  markRead,
};
