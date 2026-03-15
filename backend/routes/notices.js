const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/noticesController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.get('/', protect, ctrl.list);
router.get('/:id', protect, ctrl.getOne);
router.post('/', protect, authorize('super_admin', 'regional_officer'), ctrl.create);
router.post('/:id/comments', protect, ctrl.addComment);

module.exports = router;
