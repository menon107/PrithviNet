const mongoose = require('mongoose');
const Notice = require('../models/Notice');
const NoticeComment = require('../models/NoticeComment');
const Industry = require('../models/Industry');
const { ROLES } = require('../config/roles');

// Build visibility filter for current user (officer, industry, super_admin only; no citizen)
const visibilityFilter = async (user) => {
  let userRegionId = user.region_id?.toString() || null;
  if (user.role === ROLES.INDUSTRY && user.industry_id) {
    const ind = await Industry.findById(user.industry_id).select('region_id').lean();
    userRegionId = ind?.region_id?.toString() || null;
  }

  const orConditions = [{ audience_type: 'everyone' }];
  if (user.role === ROLES.REGIONAL_OFFICER) orConditions.push({ audience_type: 'officers' });
  if (user.role === ROLES.INDUSTRY) orConditions.push({ audience_type: 'industries' });
  if (userRegionId)
    orConditions.push({ audience_type: 'regions', region_ids: new mongoose.Types.ObjectId(userRegionId) });

  return { $or: orConditions };
};

// GET /notices — list notices visible to current user
const list = async (req, res, next) => {
  try {
    if (req.user.role === ROLES.CITIZEN) {
      return res.json({ success: true, data: [], pagination: { total: 0, page: 1, limit: 20, pages: 0 } });
    }

    const filter = await visibilityFilter(req.user);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [notices, total] = await Promise.all([
      Notice.find(filter)
        .populate('published_by', 'name email')
        .populate('region_ids', 'name')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notice.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: notices,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (err) {
    next(err);
  }
};

// GET /notices/:id — get one notice (check visibility) with comments
const getOne = async (req, res, next) => {
  try {
    if (req.user.role === ROLES.CITIZEN) {
      return res.status(403).json({ success: false, message: 'Not available for this role.' });
    }

    const notice = await Notice.findById(req.params.id)
      .populate('published_by', 'name email')
      .populate('region_ids', 'name')
      .lean();
    if (!notice) return res.status(404).json({ success: false, message: 'Notice not found.' });

    const filter = await visibilityFilter(req.user);
    const canSee = await Notice.findOne({ _id: req.params.id, $or: filter.$or });
    if (!canSee) return res.status(403).json({ success: false, message: 'You cannot view this notice.' });

    const comments = await NoticeComment.find({ notice_id: req.params.id })
      .populate('user_id', 'name email')
      .sort({ created_at: 1 })
      .lean();

    res.json({ success: true, data: { ...notice, comments } });
  } catch (err) {
    next(err);
  }
};

// POST /notices — create notice (regional_officer or super_admin only)
const create = async (req, res, next) => {
  try {
    const { heading, body, audience_type = 'everyone', region_ids } = req.body;
    if (!heading || !body) {
      return res.status(400).json({ success: false, message: 'Heading and body are required.' });
    }

    const payload = {
      heading: heading.trim(),
      body: body.trim(),
      published_by: req.user._id,
      audience_type: ['everyone', 'officers', 'industries', 'regions'].includes(audience_type)
        ? audience_type
        : 'everyone',
      region_ids: [],
    };

    if (payload.audience_type === 'regions' && Array.isArray(region_ids) && region_ids.length) {
      payload.region_ids = region_ids
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));
    }

    const notice = await Notice.create(payload);
    const populated = await Notice.findById(notice._id)
      .populate('published_by', 'name email')
      .populate('region_ids', 'name')
      .lean();

    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    next(err);
  }
};

// POST /notices/:id/comments — add comment (anyone who can see the notice)
const addComment = async (req, res, next) => {
  try {
    if (req.user.role === ROLES.CITIZEN) {
      return res.status(403).json({ success: false, message: 'Not available for this role.' });
    }

    const notice = await Notice.findById(req.params.id);
    if (!notice) return res.status(404).json({ success: false, message: 'Notice not found.' });

    const filter = await visibilityFilter(req.user);
    const canSee = await Notice.findOne({ _id: req.params.id, $or: filter.$or });
    if (!canSee) return res.status(403).json({ success: false, message: 'You cannot comment on this notice.' });

    const text = (req.body.text || '').trim();
    if (!text) return res.status(400).json({ success: false, message: 'Comment text is required.' });

    const comment = await NoticeComment.create({
      notice_id: req.params.id,
      user_id: req.user._id,
      text,
    });
    const populated = await NoticeComment.findById(comment._id)
      .populate('user_id', 'name email')
      .lean();

    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, getOne, create, addComment };
