const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/regionsController');
const { protect, optionalAuth } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.get('/', optionalAuth, ctrl.getRegions);
router.get('/:id', optionalAuth, ctrl.getRegionById);
router.get('/:id/dashboard', protect, ctrl.getRegionDashboard);
router.post('/', protect, authorize('super_admin'), ctrl.createRegion);
router.put('/:id', protect, authorize('super_admin'), ctrl.updateRegion);

module.exports = router;
