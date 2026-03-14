const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/complaintsController');
const { protect, optionalAuth } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.post('/', optionalAuth, ctrl.submitComplaint);
router.get('/', protect, ctrl.getComplaints);
router.put('/:id/status', protect, authorize('super_admin', 'regional_officer'), ctrl.updateComplaintStatus);

module.exports = router;
