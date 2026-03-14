/**
 * Role-Based Access Control Middleware
 *
 * Role hierarchy: super_admin > regional_officer > industry > citizen
 */

// Allow specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${roles.join(', ')}`
      });
    }
    next();
  };
};

// Super admin only
const superAdminOnly = authorize('super_admin');

// Officers and above
const officerAndAbove = authorize('super_admin', 'regional_officer');

// Industry and above (not citizen)
const notCitizen = authorize('super_admin', 'regional_officer', 'industry');

// Any authenticated user
const anyRole = authorize('super_admin', 'regional_officer', 'industry', 'citizen');

// Ensure industry user can only access their own industry data
const ownIndustryOnly = (req, res, next) => {
  if (req.user.role === 'super_admin' || req.user.role === 'regional_officer') {
    return next();
  }
  if (req.user.role === 'industry') {
    const industryId = req.params.industry_id || req.params.id;
    if (industryId && req.user.industry_id?.toString() !== industryId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only access your own industry data.'
      });
    }
    return next();
  }
  return res.status(403).json({ success: false, message: 'Access denied.' });
};

// Regional officer can only see their own region
const ownRegionOnly = (req, res, next) => {
  if (req.user.role === 'super_admin') return next();
  if (req.user.role === 'regional_officer') {
    const regionId = req.params.region_id || req.query.region_id;
    if (regionId && req.user.region_id?.toString() !== regionId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only access your own region data.'
      });
    }
    return next();
  }
  return next(); // industry/citizen get filtered in controller
};

module.exports = {
  authorize,
  superAdminOnly,
  officerAndAbove,
  notCitizen,
  anyRole,
  ownIndustryOnly,
  ownRegionOnly
};
