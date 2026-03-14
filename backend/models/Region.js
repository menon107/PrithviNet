const mongoose = require('mongoose');

const regionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Region name is required'],
    trim: true,
    unique: true
  },
  state: {
    type: String,
    required: [true, 'State is required'],
    trim: true
  },
  coordinates: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true
    }
  },
  center: {
    lat: { type: Number },
    lng: { type: Number }
  },
  regional_officer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  monitoring_stations: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MonitoringStation'
  }],
  emission_limits: {
    pm25: { type: Number, default: 60 },    // µg/m³ 24hr avg
    pm10: { type: Number, default: 100 },
    so2:  { type: Number, default: 80 },
    no2:  { type: Number, default: 80 },
    co:   { type: Number, default: 2 },     // mg/m³
    noise_day:   { type: Number, default: 65 },  // dB
    noise_night: { type: Number, default: 55 },
    ph_min: { type: Number, default: 6.5 },
    ph_max: { type: Number, default: 8.5 },
    bod: { type: Number, default: 3 },      // mg/L
  },
  is_active: { type: Boolean, default: true },
  description: { type: String }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('Region', regionSchema);
