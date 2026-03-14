const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Industry = require('../models/Industry');
const Region = require('../models/Region');
const { ROLES } = require('../config/roles');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

const sendTokenResponse = (user, statusCode, res) => {
  const token = generateToken(user._id);
  res.status(statusCode).json({
    success: true,
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      region_id: user.region_id,
      industry_id: user.industry_id,
    },
  });
};

// POST /auth/signup
const signup = async (req, res, next) => {
  try {
    const { name, email, password, role, region_id, phone, industry_type, location, boundary_polygon } = req.body;

    // Only citizens and industries can self-register
    const allowedSelfRegister = [ROLES.CITIZEN, ROLES.INDUSTRY];
    if (!allowedSelfRegister.includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Admin and officer accounts must be created by Super Admin.',
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    // Create base user (region may be auto-assigned later for industries)
    const user = await User.create({ name, email, password, role, region_id, phone });

    // For industry self-registration, also create an Industry record with pending approval
    if (role === ROLES.INDUSTRY) {
      if (!industry_type || !location?.latitude || !location?.longitude) {
        return res.status(400).json({
          success: false,
          message: 'industry_type and location (latitude, longitude) are required for industry signup.',
        });
      }

      // Auto-allocate region based on nearest region center/coordinates
      const allRegions = await Region.find({});
      if (!allRegions.length) {
        return res.status(500).json({
          success: false,
          message: 'No regions configured in the system. Please ask an administrator to create regions.',
        });
      }

      const lat = location.latitude;
      const lng = location.longitude;

      let closestRegionId = null;
      let closestDist = Infinity;

      for (const r of allRegions) {
        const coords = r.coordinates?.coordinates;
        if (!coords || coords.length < 2) continue;
        const [rLng, rLat] = coords;
        const d = Math.hypot(rLat - lat, rLng - lng);
        if (d < closestDist) {
          closestDist = d;
          closestRegionId = r._id;
        }
      }

      if (!closestRegionId) {
        return res.status(500).json({
          success: false,
          message: 'Unable to infer region from location. Please contact administrator.',
        });
      }

      user.region_id = closestRegionId;
      await user.save({ validateBeforeSave: false });

      const boundary = Array.isArray(boundary_polygon)
        ? boundary_polygon
            .filter((p) => p && typeof p[0] === 'number' && typeof p[1] === 'number')
            .map(([plat, plng]) => ({ lat: plat, lng: plng }))
        : [];

      const industry = await Industry.create({
        name,
        industry_type,
        region_id: closestRegionId,
        user_id: user._id,
        // Store as GeoJSON point for existing map logic
        location: {
          type: 'Point',
          coordinates: [location.longitude, location.latitude],
        },
        boundary_polygon: boundary,
        approval_status: 'pending',
        is_active: false,
      });

      // Link user back to industry
      user.industry_id = industry._id;
      await user.save({ validateBeforeSave: false });
    }

    sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
};

// POST /auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // Industry login is allowed only after industry approval
    if (user.role === ROLES.INDUSTRY) {
      if (!user.industry_id) {
        return res.status(401).json({
          success: false,
          message: 'Industry profile not linked. Please contact administrator.',
        });
      }

      const industry = await Industry.findById(user.industry_id);
      if (!industry) {
        return res.status(401).json({
          success: false,
          message: 'Industry record not found. Please contact administrator.',
        });
      }

      if (industry.approval_status !== 'approved') {
        return res.status(403).json({
          success: false,
          message: 'Industry account pending approval by regional officer',
        });
      }

      if (!industry.is_active) {
        return res.status(403).json({
          success: false,
          message: 'Industry account is inactive. Please contact regional officer.',
        });
      }
    } else if (!user.is_active) {
      return res.status(401).json({ success: false, message: 'Account is deactivated.' });
    }

    // Update last login
    user.last_login = new Date();
    await user.save({ validateBeforeSave: false });

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// GET /auth/me
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('region_id', 'name state')
      .populate('industry_id', 'name industry_type compliance_score');
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

// POST /auth/create-user  (Super Admin only)
const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, region_id, industry_id, phone } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    const user = await User.create({ name, email, password, role, region_id, industry_id, phone });
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

// PUT /auth/change-password
const changePassword = async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    if (!(await user.comparePassword(current_password))) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    user.password = new_password;
    await user.save();
    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { signup, login, getMe, createUser, changePassword };
