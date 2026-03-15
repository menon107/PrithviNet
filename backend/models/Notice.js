const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema(
  {
    heading: {
      type: String,
      required: [true, 'Heading is required'],
      trim: true,
      maxlength: [200, 'Heading cannot exceed 200 characters'],
    },
    body: {
      type: String,
      required: [true, 'Body is required'],
      trim: true,
    },
    published_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    audience_type: {
      type: String,
      enum: ['everyone', 'officers', 'industries', 'regions'],
      default: 'everyone',
    },
    region_ids: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'Region',
      default: [],
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

noticeSchema.index({ created_at: -1 });
noticeSchema.index({ audience_type: 1, region_ids: 1 });

module.exports = mongoose.model('Notice', noticeSchema);
