const mongoose = require('mongoose');

const noticeCommentSchema = new mongoose.Schema(
  {
    notice_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Notice',
      required: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      required: [true, 'Comment text is required'],
      trim: true,
      maxlength: [2000, 'Comment cannot exceed 2000 characters'],
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

noticeCommentSchema.index({ notice_id: 1, created_at: 1 });

module.exports = mongoose.model('NoticeComment', noticeCommentSchema);
