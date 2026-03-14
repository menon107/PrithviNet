// routes/reports.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/reportsController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.post('/', protect, authorize('industry', 'regional_officer', 'super_admin'), ctrl.submitReport);
router.post('/period', protect, authorize('industry', 'regional_officer', 'super_admin'), ctrl.submitPeriodReport);
router.get('/', protect, ctrl.getReports);
router.get('/missing', protect, authorize('super_admin', 'regional_officer'), ctrl.getMissingReports);
router.get('/industry/:industry_id', protect, ctrl.getIndustryReports);
router.get('/region/:region_id', protect, authorize('regional_officer', 'super_admin'), ctrl.getRegionReports);
router.get('/:id/insights', protect, authorize('regional_officer', 'super_admin', 'industry'), ctrl.getReportInsightsHandler);
router.get('/:id', protect, ctrl.getReportById);
router.put('/:id/review', protect, authorize('regional_officer', 'super_admin'), ctrl.reviewReport);

module.exports = router;
