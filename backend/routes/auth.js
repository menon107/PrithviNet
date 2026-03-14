const express = require('express');
const router = express.Router();
const authCtrl = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.post('/signup', authCtrl.signup);
router.post('/login', authCtrl.login);
router.get('/me', protect, authCtrl.getMe);
router.put('/change-password', protect, authCtrl.changePassword);
router.post('/create-user', protect, authorize('super_admin'), authCtrl.createUser);

module.exports = router;
