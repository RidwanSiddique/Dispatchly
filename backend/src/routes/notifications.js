const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  getNotifications,
  markRead,
  markAllRead,
} = require('../controllers/notificationController');

const router = Router();
router.use(requireAuth);

router.get('/', getNotifications);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markRead);

module.exports = router;
