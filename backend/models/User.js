const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['super_admin', 'regional_officer', 'industry', 'citizen'],
    required: [true, 'Role is required']
  },
  region_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Region',
    default: null
  },
  industry_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Industry',
    default: null
  },
  is_active: {
    type: Boolean,
    default: true
  },
  phone: {
    type: String,
    trim: true
  },
  avatar: {
    type: String,
    default: null
  },
  last_login: {
    type: Date,
    default: null
  },
  password_reset_token: String,
  password_reset_expires: Date
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare passwords
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Backwards-compatible alias used in controllers
userSchema.methods.comparePassword = userSchema.methods.matchPassword;

// Remove sensitive fields from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.password_reset_token;
  delete obj.password_reset_expires;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
