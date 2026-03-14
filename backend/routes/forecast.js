const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/forecastController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.get('/', protect, authorize('regional_officer', 'super_admin'), ctrl.getForecasts);

module.exports = router;
