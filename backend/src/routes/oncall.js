const { Router } = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getOncall, createSchedule, deleteSchedule, pageUser } = require('../controllers/oncallController');

const router = Router();
router.use(requireAuth);

// All authenticated staff can view the on-call schedule
router.get('/', getOncall);

// Admin + manager can manage schedules and page users
router.post('/', requireRole('admin', 'manager'), createSchedule);
router.delete('/:id', requireRole('admin', 'manager'), deleteSchedule);
router.post('/page/:userId', requireRole('admin', 'manager'), pageUser);

module.exports = router;
