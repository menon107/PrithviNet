const mongoose = require('mongoose');

const monitoringStationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Station name is required'],
    trim: true
  },
  station_code: {
    type: String,
    unique: true,
    required: true
  },
  region_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Region',
    required: true
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
  sensor_types: [{
    type: String
  }],
  status: {
    type: String,
    default: 'active'
  },
  source: {
    type: String,
    default: 'government'
  },
  last_reading_at: { type: Date, default: null },
  installation_date: { type: Date }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

monitoringStationSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('MonitoringStation', monitoringStationSchema);
