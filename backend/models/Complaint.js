const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  submitted_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  region_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Region'
  },
  industry_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Industry',
    default: null
  },
  category: {
    type: String,
    enum: ['air_pollution', 'water_pollution', 'noise_pollution', 'illegal_dumping', 'odor', 'other'],
    required: true
  },
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: [Number],
    address: String
  },
  attachments: [{
    filename: String,
    path: String,
    mimetype: String,
    type: { type: String, enum: ['image', 'video', 'document'] }
  }],
  status: {
    type: String,
    enum: ['open', 'under_investigation', 'resolved', 'rejected'],
    default: 'open'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  assigned_to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  resolution_notes: String,
  resolved_at: Date
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

complaintSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Complaint', complaintSchema);
