const mongoose = require('mongoose');

const industryWarningSchema = new mongoose.Schema({
  industry_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Industry',
    required: true,
  },
  report_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MonitoringReport',
    default: null,
  },
  region_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Region',
    required: true,
  },
  sent_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  subject: { type: String, required: true, trim: true },
  message: { type: String, required: true },
  action_items: [{ type: String }],
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
  },
  status: {
    type: String,
    enum: ['sent', 'read', 'acknowledged'],
    default: 'sent',
  },
  read_at: { type: Date, default: null },
  acknowledged_at: { type: Date, default: null },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});

industryWarningSchema.index({ industry_id: 1, created_at: -1 });
industryWarningSchema.index({ region_id: 1, created_at: -1 });
industryWarningSchema.index({ sent_by: 1, created_at: -1 });

module.exports = mongoose.model('IndustryWarning', industryWarningSchema);
