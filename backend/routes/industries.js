const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/industryController');
const { protect, optionalAuth } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.get('/', optionalAuth, ctrl.getIndustries);
router.get('/top-polluters', optionalAuth, ctrl.getTopPolluters);
router.get('/with-water-data', protect, ctrl.getIndustriesWithWaterData);
router.get('/pending', protect, authorize('regional_officer', 'super_admin'), ctrl.getPendingIndustries);
router.get('/:id', optionalAuth, ctrl.getIndustryById);
router.get('/:id/stats', protect, ctrl.getIndustryStats);
router.post('/', protect, authorize('super_admin', 'regional_officer'), ctrl.createIndustry);
router.put('/:id', protect, authorize('super_admin', 'regional_officer'), ctrl.updateIndustry);
router.patch('/:id/approve', protect, authorize('regional_officer', 'super_admin'), ctrl.approveIndustry);
router.patch('/:id/reject', protect, authorize('regional_officer', 'super_admin'), ctrl.rejectIndustry);
router.delete('/:id', protect, authorize('super_admin'), ctrl.deleteIndustry);

module.exports = router;
