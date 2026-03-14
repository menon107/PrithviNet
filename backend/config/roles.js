const ROLES = {
  SUPER_ADMIN: 'super_admin',
  REGIONAL_OFFICER: 'regional_officer',
  INDUSTRY: 'industry',
  CITIZEN: 'citizen',
};

const PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: [
    'create:region',
    'create:industry',
    'create:officer',
    'read:all',
    'update:all',
    'delete:all',
    'run:simulation',
    'view:state_analytics',
    'manage:limits',
    'manage:system',
  ],
  [ROLES.REGIONAL_OFFICER]: [
    'read:region_data',
    'read:industries',
    'read:reports',
    'read:alerts',
    'run:intervention_simulation',
    'create:inspection',
    'update:inspection',
    'assign:tasks',
    'view:compliance_dashboard',
    'view:source_attribution',
  ],
  [ROLES.INDUSTRY]: [
    'submit:report',
    'read:own_reports',
    'read:own_compliance',
    'read:own_alerts',
    'view:compliance_prediction',
  ],
  [ROLES.CITIZEN]: [
    'read:public_data',
    'read:pollution_maps',
    'read:forecasts',
    'submit:complaint',
    'view:industry_compliance',
  ],
};

const hasPermission = (role, permission) => {
  return PERMISSIONS[role]?.includes(permission) ?? false;
};

module.exports = { ROLES, PERMISSIONS, hasPermission };
