const Complaint = require('../models/Complaint');

// POST /complaints
const submitComplaint = async (req, res, next) => {
  try {
    const { category, title, description, location, industry_id, region_id, attachments, is_anonymous } = req.body;

    const complaint = await Complaint.create({
      submitted_by: is_anonymous ? null : req.user?._id,
      region_id,
      industry_id: industry_id || null,
      category,
      title,
      description,
      location,
      attachments: attachments || [],
      is_anonymous: is_anonymous || false,
    });

    res.status(201).json({ success: true, data: complaint });
  } catch (error) {
    next(error);
  }
};

// GET /complaints
const getComplaints = async (req, res, next) => {
  try {
    const { region_id, category, status, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (req.user.role === 'citizen') {
      filter.submitted_by = req.user._id;
    } else {
      if (region_id) filter.region_id = region_id;
      if (req.user.role === 'regional_officer') filter.region_id = req.user.region_id;
    }

    if (category) filter.category = category;
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [complaints, total] = await Promise.all([
      Complaint.find(filter)
        .populate('region_id', 'name')
        .populate('industry_id', 'name')
        .populate('submitted_by', 'name')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Complaint.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: complaints,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /complaints/:id/status  (Regional Officer)
const updateComplaintStatus = async (req, res, next) => {
  try {
    const { status, resolution_notes, priority } = req.body;
    const update = { status };
    if (resolution_notes) update.resolution_notes = resolution_notes;
    if (priority) update.priority = priority;
    if (status === 'resolved') { update.resolved_at = new Date(); update.assigned_to = req.user._id; }

    const complaint = await Complaint.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' });
    res.json({ success: true, data: complaint });
  } catch (error) {
    next(error);
  }
};

module.exports = { submitComplaint, getComplaints, updateComplaintStatus };
