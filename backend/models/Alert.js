const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      'violation_alert',
      'report_missing',
      'forecast_risk',
      'sensor_anomaly',
      'compliance_breach',
      'spike_detected'
    ],
    required: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  region_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Region'
  },
  industry_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Industry',
    default: null
  },
  report_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MonitoringReport',
    default: null
  },
  data: {
    parameter: String,
    measured_value: Number,
    limit_value: Number,
    unit: String,
    location: {
      lat: Number,
      lng: Number
    }
  },
  recipients: [{
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: String,
    read: { type: Boolean, default: false },
    read_at: Date
  }],
  status: {
    type: String,
    enum: ['active', 'acknowledged', 'resolved'],
    default: 'active'
  },
  resolved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolved_at: { type: Date, default: null }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

alertSchema.index({ region_id: 1, created_at: -1 });
alertSchema.index({ status: 1 });
alertSchema.index({ 'recipients.user_id': 1, 'recipients.read': 1 });

module.exports = mongoose.model('Alert', alertSchema);
