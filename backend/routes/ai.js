const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/aiController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

// Simulation (Digital Twin)
router.post('/simulation/run', protect, authorize('super_admin', 'regional_officer'), ctrl.runSimulation);
router.get('/simulation', protect, authorize('super_admin', 'regional_officer'), ctrl.getSimulations);
router.get('/simulation/:id', protect, ctrl.getSimulation);

// Forecast
router.get('/forecast/air', ctrl.getAirForecast);

// Attribution & Risk
router.get('/attribution', protect, authorize('super_admin', 'regional_officer'), ctrl.getPollutionAttribution);
router.get('/compliance-risk', protect, ctrl.getComplianceRisk);
router.get('/inspection-optimization', protect, authorize('super_admin', 'regional_officer'), ctrl.getInspectionOptimization);

module.exports = router;
