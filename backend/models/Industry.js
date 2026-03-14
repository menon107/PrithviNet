const mongoose = require('mongoose');

const industrySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Industry name is required'],
    trim: true
  },
  industry_type: {
    type: String,
    required: [true, 'Industry type is required'],
    enum: [
      'steel', 'cement', 'chemical', 'textile',
      'paper', 'pharmaceutical', 'power_plant',
      'refinery', 'mining', 'food_processing', 'other'
    ]
  },
  region_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Region',
    required: true
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],   // [longitude, latitude]
      required: true
    },
    address: String
  },
  // Optional polygon mask for industry boundary (lat/lng pairs)
  boundary_polygon: [
    {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
  ],
  emission_limits: {
    pm25: { type: Number },
    pm10: { type: Number },
    so2:  { type: Number },
    no2:  { type: Number },
    co:   { type: Number },
    noise_day:   { type: Number },
    noise_night: { type: Number },
    ph_min: { type: Number },
    ph_max: { type: Number },
    bod:   { type: Number },
    cod:   { type: Number }
  },
  // Overall compliance status derived from recent reports
  compliance_status: {
    type: String,
    enum: ['compliant', 'warning', 'violation', 'critical'],
  },
  compliance_score: {
    type: Number,
    min: 0,
    max: 100,
    default: 100
  },
  registration_number: {
    type: String,
    unique: true,
    sparse: true
  },
  contact_person: {
    name: String,
    phone: String,
    email: String
  },
  // Whether this industry is active in the system
  is_active: { type: Boolean, default: true },
  // Approval workflow for new self-registered industries
  approval_status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  approved_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  approved_at: { type: Date },
  last_report_date: { type: Date, default: null },
  total_violations: { type: Number, default: 0 }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

industrySchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Industry', industrySchema);
