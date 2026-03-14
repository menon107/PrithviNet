const Industry = require('../models/Industry');
const MonitoringReport = require('../models/MonitoringReport');
const Alert = require('../models/Alert');

// GET /industries
const getIndustries = async (req, res, next) => {
  try {
    const { region_id, industry_type, compliance_status, search, page = 1, limit = 20 } = req.query;

    const filter = { is_active: true };
    if (region_id) filter.region_id = region_id;
    if (industry_type) filter.industry_type = industry_type;
    if (compliance_status) filter.compliance_status = compliance_status;
    if (search) filter.name = { $regex: search, $options: 'i' };

    // Regional officers see only their region
    if (req.user?.role === 'regional_officer') filter.region_id = req.user.region_id;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [industries, total] = await Promise.all([
      Industry.find(filter)
        .populate('region_id', 'name state')
        .sort({ compliance_score: 1 }) // worst first
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Industry.countDocuments(filter),
    ]);

    // Enrich with compliance from latest report (actual score, not stale Industry default)
    const industryIds = industries.map((ind) => ind._id);
    const latestByIndustry = await MonitoringReport.aggregate([
      { $match: { industry_id: { $in: industryIds } } },
      { $sort: { date: -1 } },
      {
        $group: {
          _id: '$industry_id',
          compliance_score: { $first: '$compliance_score' },
          compliance_status: { $first: '$compliance_status' },
          last_20_scores: { $push: '$compliance_score' },
        },
      },
    ]);
    const complianceByIndustryId = Object.fromEntries(
      latestByIndustry.map((r) => {
        const scores = (r.last_20_scores || []).slice(0, 20).filter((s) => typeof s === 'number');
        const criticalDays = scores.filter((s) => s < 40).length;
        const violationDays = scores.filter((s) => s >= 40 && s < 60).length;
        const severeRun = criticalDays + violationDays;

        let smartWarning = null;
        if (scores.length >= 10 && criticalDays >= 5) {
          smartWarning = 'Critical: frequent severe violations in last 20 days';
        } else if (scores.length >= 10 && severeRun >= 10) {
          smartWarning = 'Warning: persistent low compliance over recent period';
        }

        let inspectionFlag = null;
        if (criticalDays >= 8) {
          inspectionFlag = 'Immediate inspection recommended';
        } else if (criticalDays >= 4 && violationDays >= 6) {
          inspectionFlag = 'High priority inspection in next cycle';
        } else if (severeRun >= 6) {
          inspectionFlag = 'Add to upcoming inspection plan';
        }

        return [
          r._id.toString(),
          {
            score: r.compliance_score,
            status: r.compliance_status,
            smartWarning,
            inspectionFlag,
          },
        ];
      })
    );

    const enriched = industries.map((ind) => {
      const fromReport = complianceByIndustryId[ind._id.toString()] || {};
      return {
        ...ind,
        compliance_score:
          fromReport.score != null ? fromReport.score : ind.compliance_score,
        compliance_status:
          fromReport.status != null ? fromReport.status : ind.compliance_status,
        smart_warning: fromReport.smartWarning || null,
        inspection_recommendation: fromReport.inspectionFlag || null,
      };
    });
    // Sort by actual compliance (worst first)
    enriched.sort((a, b) => (a.compliance_score ?? 100) - (b.compliance_score ?? 100));

    res.json({
      success: true,
      data: enriched,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// GET /industries/:id
const getIndustryById = async (req, res, next) => {
  try {
    const industry = await Industry.findById(req.params.id).populate('region_id', 'name state environmental_limits');
    if (!industry) return res.status(404).json({ success: false, message: 'Industry not found.' });
    res.json({ success: true, data: industry });
  } catch (error) {
    next(error);
  }
};

// POST /industries  (Super Admin / Regional Officer)
const createIndustry = async (req, res, next) => {
  try {
    const industry = await Industry.create(req.body);
    res.status(201).json({ success: true, data: industry });
  } catch (error) {
    next(error);
  }
};

// GET /industries/pending — industries awaiting approval in officer's region
const getPendingIndustries = async (req, res, next) => {
  try {
    const filter = {
      approval_status: 'pending',
      is_active: false,
    };

    // Regional officers only see their region
    if (req.user.role === 'regional_officer') {
      filter.region_id = req.user.region_id;
    } else if (req.query.region_id) {
      filter.region_id = req.query.region_id;
    }

    const industries = await Industry.find(filter)
      .populate('region_id', 'name state')
      .populate('user_id', 'name email');

    res.json({ success: true, data: industries });
  } catch (error) {
    next(error);
  }
};

// PATCH /industries/:id/approve — Regional officer approves industry
const approveIndustry = async (req, res, next) => {
  try {
    const { id } = req.params;

    const industry = await Industry.findById(id);
    if (!industry) return res.status(404).json({ success: false, message: 'Industry not found.' });

    // Ensure officer can only approve industries in their region
    if (req.user.role === 'regional_officer' && industry.region_id?.toString() !== req.user.region_id?.toString()) {
      return res.status(403).json({ success: false, message: 'Cannot approve industries from another region.' });
    }

    industry.approval_status = 'approved';
    industry.approved_by = req.user._id;
    industry.approved_at = new Date();
    industry.is_active = true;
    await industry.save();

    // Also activate linked user account, if any
    if (industry.user_id) {
      await require('../models/User').findByIdAndUpdate(industry.user_id, { is_active: true });
    }

    res.json({ success: true, data: industry });
  } catch (error) {
    next(error);
  }
};

// PATCH /industries/:id/reject — Regional officer rejects industry
const rejectIndustry = async (req, res, next) => {
  try {
    const { id } = req.params;
    const industry = await Industry.findById(id);
    if (!industry) return res.status(404).json({ success: false, message: 'Industry not found.' });

    if (req.user.role === 'regional_officer' && industry.region_id?.toString() !== req.user.region_id?.toString()) {
      return res.status(403).json({ success: false, message: 'Cannot reject industries from another region.' });
    }

    industry.approval_status = 'rejected';
    industry.is_active = false;
    industry.approved_by = req.user._id;
    industry.approved_at = new Date();
    await industry.save();

    if (industry.user_id) {
      await require('../models/User').findByIdAndUpdate(industry.user_id, { is_active: false });
    }

    res.json({ success: true, data: industry });
  } catch (error) {
    next(error);
  }
};

// PUT /industries/:id
const updateIndustry = async (req, res, next) => {
  try {
    const industry = await Industry.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!industry) return res.status(404).json({ success: false, message: 'Industry not found.' });
    res.json({ success: true, data: industry });
  } catch (error) {
    next(error);
  }
};

// DELETE /industries/:id  (soft delete)
const deleteIndustry = async (req, res, next) => {
  try {
    await Industry.findByIdAndUpdate(req.params.id, { is_active: false });
    res.json({ success: true, message: 'Industry deactivated.' });
  } catch (error) {
    next(error);
  }
};

// GET /industries/:id/stats  — compliance analytics for one industry
const getIndustryStats = async (req, res, next) => {
  try {
    const { id } = req.params;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [industry, reports, recentViolations] = await Promise.all([
      Industry.findById(id),
      MonitoringReport.find({ industry_id: id, date: { $gte: thirtyDaysAgo } })
        .sort({ date: -1 })
        .select('date is_compliant compliance_score violations air_data water_data'),
      MonitoringReport.countDocuments({ industry_id: id, is_compliant: false }),
    ]);

    if (!industry) return res.status(404).json({ success: false, message: 'Industry not found.' });

    const totalReports = reports.length;
    const compliantReports = reports.filter((r) => r.is_compliant).length;
    const avgScore = reports.reduce((sum, r) => sum + (r.compliance_score || 0), 0) / (totalReports || 1);

    const trend = reports.slice(0, 14).map((r) => ({
      date: r.date,
      score: r.compliance_score,
      is_compliant: r.is_compliant,
      pm25: r.air_data?.pm25,
      aqi: r.air_data?.aqi,
    }));

    res.json({
      success: true,
      data: {
        industry,
        stats: {
          total_reports_30d: totalReports,
          compliant_days: compliantReports,
          violation_days: totalReports - compliantReports,
          compliance_rate: totalReports > 0 ? ((compliantReports / totalReports) * 100).toFixed(1) : 100,
          avg_compliance_score: avgScore.toFixed(1),
          all_time_violations: recentViolations,
        },
        trend,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /industries/with-water-data — for water sim map: industries in region with location + latest water_data
const getIndustriesWithWaterData = async (req, res, next) => {
  try {
    const { region_id } = req.query;
    const filter = { is_active: true };
    if (region_id) filter.region_id = region_id;
    if (req.user?.role === 'regional_officer') filter.region_id = req.user.region_id;

    const industries = await Industry.find(filter)
      .select('_id name industry_type location boundary_polygon region_id')
      .lean();

    const industryIds = industries.map((ind) => ind._id);
    const latestWater = await MonitoringReport.aggregate([
      { $match: { industry_id: { $in: industryIds } } },
      { $sort: { date: -1 } },
      { $group: { _id: '$industry_id', water_data: { $first: '$water_data' }, date: { $first: '$date' } } },
    ]);
    const waterByIndustryId = Object.fromEntries(
      latestWater.map((r) => [r._id.toString(), { water_data: r.water_data, date: r.date }])
    );

    const data = industries.map((ind) => {
      const w = waterByIndustryId[ind._id.toString()];
      const coords = ind.location?.coordinates;
      return {
        _id: ind._id,
        name: ind.name,
        industry_type: ind.industry_type,
        location: coords ? { type: 'Point', coordinates: coords } : null,
        lng: coords?.[0] ?? null,
        lat: coords?.[1] ?? null,
        boundary_polygon: ind.boundary_polygon,
        water_data: w?.water_data ?? null,
        last_water_report_date: w?.date ?? null,
      };
    }).filter((ind) => ind.lng != null && ind.lat != null);

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// GET /industries/top-polluters
const getTopPolluters = async (req, res, next) => {
  try {
    const { region_id, limit = 10 } = req.query;
    const filter = { is_active: true };
    if (region_id) filter.region_id = region_id;
    if (req.user?.role === 'regional_officer') filter.region_id = req.user.region_id;

    const industries = await Industry.find(filter)
      .populate('region_id', 'name')
      .sort({ compliance_score: 1, total_violations: -1 })
      .limit(parseInt(limit))
      .select('name industry_type compliance_score compliance_status total_violations location region_id');

    res.json({ success: true, data: industries });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getIndustries,
  getIndustryById,
  createIndustry,
  updateIndustry,
  deleteIndustry,
  getIndustryStats,
  getTopPolluters,
  getIndustriesWithWaterData,
  getPendingIndustries,
  approveIndustry,
  rejectIndustry,
};
