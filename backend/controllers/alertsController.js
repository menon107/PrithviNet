const Alert = require('../models/Alert');
const { ROLES } = require('../config/roles');

// GET /alerts
const getAlerts = async (req, res, next) => {
  try {
    const { region_id, type, severity, is_resolved = false, page = 1, limit = 20 } = req.query;

    const filter = { is_resolved: is_resolved === 'true' };

    // Scope by role
    if (req.user.role === ROLES.REGIONAL_OFFICER) {
      filter.region_id = req.user.region_id;
      filter.target_roles = { $in: ['regional_officer'] };
    } else if (req.user.role === ROLES.INDUSTRY) {
      filter.industry_id = req.user.industry_id;
    } else if (req.user.role === ROLES.CITIZEN) {
      filter.target_roles = { $in: ['citizen'] };
    }

    if (region_id && req.user.role === ROLES.SUPER_ADMIN) filter.region_id = region_id;
    if (type) filter.type = type;
    if (severity) filter.severity = severity;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [alerts, total, unreadCount] = await Promise.all([
      Alert.find(filter)
        .populate('region_id', 'name')
        .populate('industry_id', 'name industry_type')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Alert.countDocuments(filter),
      Alert.countDocuments({
        ...filter,
        'read_by.user_id': { $ne: req.user._id },
      }),
    ]);

    res.json({
      success: true,
      data: alerts,
      unread_count: unreadCount,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /alerts/:id/read
const markAlertRead = async (req, res, next) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { read_by: { user_id: req.user._id, read_at: new Date() } } },
      { new: true }
    );
    if (!alert) return res.status(404).json({ success: false, message: 'Alert not found.' });
    res.json({ success: true, data: alert });
  } catch (error) {
    next(error);
  }
};

// PUT /alerts/read-all
const markAllRead = async (req, res, next) => {
  try {
    await Alert.updateMany(
      { 'read_by.user_id': { $ne: req.user._id } },
      { $addToSet: { read_by: { user_id: req.user._id, read_at: new Date() } } }
    );
    res.json({ success: true, message: 'All alerts marked as read.' });
  } catch (error) {
    next(error);
  }
};

// PUT /alerts/:id/resolve
const resolveAlert = async (req, res, next) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { is_resolved: true, resolved_by: req.user._id, resolved_at: new Date() },
      { new: true }
    );
    if (!alert) return res.status(404).json({ success: false, message: 'Alert not found.' });
    res.json({ success: true, data: alert });
  } catch (error) {
    next(error);
  }
};

// GET /alerts/stats
const getAlertStats = async (req, res, next) => {
  try {
    const filter = {};
    if (req.user.role === ROLES.REGIONAL_OFFICER) filter.region_id = req.user.region_id;

    const stats = await Alert.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 },
          unresolved: { $sum: { $cond: [{ $eq: ['$is_resolved', false] }, 1, 0] } },
        },
      },
    ]);

    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAlerts, markAlertRead, markAllRead, resolveAlert, getAlertStats };
