const { Router } = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  getChanges,
  createChange,
  getChange,
  updateChange,
  submitChange,
  approveChange,
  rejectChange,
  linkChangeTickets,
} = require('../controllers/changeController');

const router = Router();
router.use(requireAuth, requireRole('admin', 'manager', 'agent', 'technician', 'specialist'));

router.get('/', getChanges);
router.post('/', createChange);
router.get('/:id', getChange);
router.patch('/:id', updateChange);
router.post('/:id/submit', submitChange);
router.post('/:id/approve', requireRole('admin', 'manager'), approveChange);
router.post('/:id/reject', requireRole('admin', 'manager'), rejectChange);
router.post('/:id/link', requireRole('admin', 'manager', 'agent'), linkChangeTickets);

module.exports = router;
