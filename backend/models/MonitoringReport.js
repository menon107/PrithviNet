const mongoose = require('mongoose');

// Sub-schemas for pollution readings (simple scalar values for compatibility
// with existing frontend code and seed data)
const airDataSchema = new mongoose.Schema({
  pm25:        { type: Number },
  pm10:        { type: Number },
  so2:         { type: Number },
  no2:         { type: Number },
  co:          { type: Number },
  o3:          { type: Number },
  temperature: { type: Number },
  humidity:    { type: Number }
}, { _id: false });

const waterDataSchema = new mongoose.Schema({
  ph:        { type: Number },
  bod:       { type: Number },
  cod:       { type: Number },
  tss:       { type: Number },
  turbidity: { type: Number },
}, { _id: false });

const noiseDataSchema = new mongoose.Schema({
  day_db:   { type: Number },
  night_db: { type: Number },
  peak_db:  { type: Number }
}, { _id: false });

const violationSchema = new mongoose.Schema({
  parameter: String,
  measured_value: Number,
  limit_value: Number,
  unit: String,
  exceeded_by: Number    // percentage
}, { _id: false });

const monitoringReportSchema = new mongoose.Schema({
  industry_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Industry',
    required: true
  },
  region_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Region',
    required: true
  },
  submitted_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: [true, 'Report date is required']
  },
  reporting_period: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    default: 'daily'
  },
  air_data:   { type: airDataSchema, default: {} },
  water_data: { type: waterDataSchema, default: {} },
  noise_data: { type: noiseDataSchema, default: {} },
  sensor_metadata: {
    calibration_date: Date,
    sensor_ids: [String],
    measurement_method: String
  },
  attachments: [{
    filename: String,
    path: String,
    mimetype: String,
    size: Number,
    uploaded_at: { type: Date, default: Date.now }
  }],
  status: {
    type: String,
    enum: ['submitted', 'under_review', 'approved', 'rejected', 'flagged'],
    default: 'submitted'
  },
  reviewed_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewed_at: { type: Date, default: null },
  review_notes: String,
  violations: [violationSchema],
  has_violations: { type: Boolean, default: false },
  is_compliant: { type: Boolean, default: true },
  compliance_score: { type: Number, default: null },
  compliance_status: { type: String, default: null },
  aqi: { type: Number, default: null },        // calculated AQI
  risk_score: { type: Number, default: null }, // AI-generated risk
  // Period reports (weekly/monthly): range and chart-ready summary
  period_start: { type: Date, default: null },
  period_end: { type: Date, default: null },
  summary_chart_data: { type: mongoose.Schema.Types.Mixed, default: null }, // [{ date, air, water, noise, compliance_score }, ...]
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Query support; period reports use date=period_end; duplicate period prevented in controller
monitoringReportSchema.index({ industry_id: 1, date: 1, reporting_period: 1 });
monitoringReportSchema.index({ region_id: 1, date: -1 });
monitoringReportSchema.index({ status: 1 });
monitoringReportSchema.index({ region_id: 1, reporting_period: 1, date: -1 });

module.exports = mongoose.model('MonitoringReport', monitoringReportSchema);
