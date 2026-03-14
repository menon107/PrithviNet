const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/warningsController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.post('/', protect, authorize('regional_officer', 'super_admin'), ctrl.createWarning);
router.get('/', protect, ctrl.getWarnings);
router.get('/industry/:industry_id', protect, ctrl.getWarningsByIndustry);
router.patch('/:id/read', protect, authorize('industry'), ctrl.markRead);

module.exports = router;
