const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/pollutionController');
const { optionalAuth } = require('../middleware/auth');

router.get('/air', optionalAuth, ctrl.getAirPollution);
router.get('/water', optionalAuth, ctrl.getWaterPollution);
router.get('/noise', optionalAuth, ctrl.getNoisePollution);
router.get('/map', optionalAuth, ctrl.getPollutionMap);
router.get('/summary', optionalAuth, ctrl.getPollutionSummary);
router.get('/external', ctrl.getExternalPollution);
router.get('/attribution', optionalAuth, ctrl.getPollutionAttribution);

module.exports = router;
