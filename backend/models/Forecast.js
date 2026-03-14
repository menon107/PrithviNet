const mongoose = require('mongoose');

const forecastSchema = new mongoose.Schema({
  region_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Region',
    default: null,
  },
  industry_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Industry',
    default: null,
  },
  region: { type: mongoose.Schema.Types.ObjectId, ref: 'Region', default: null },
  forecast_date: { type: Date, default: null },
  date: { type: Date, default: null },
  valid_from: { type: Date, default: null },
  valid_to: { type: Date, default: null },
  type: {
    type: String,
    enum: ['air', 'water', 'noise', 'aqi', 'general'],
    default: 'air',
  },
  title: { type: String, default: '' },
  message: { type: String, default: '' },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  strict: false,
  collection: 'forecasts', // DB collection is "forecasts" (plural)
});

forecastSchema.index({ region_id: 1, forecast_date: -1 });
forecastSchema.index({ region_id: 1, created_at: -1 });

module.exports = mongoose.model('Forecast', forecastSchema);
