const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/alertsController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.get('/', protect, ctrl.getAlerts);
router.get('/stats', protect, ctrl.getAlertStats);
router.put('/read-all', protect, ctrl.markAllRead);
router.put('/:id/read', protect, ctrl.markAlertRead);
router.put('/:id/resolve', protect, authorize('super_admin', 'regional_officer'), ctrl.resolveAlert);

module.exports = router;
