const { Router } = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  getProblems,
  createProblem,
  getProblem,
  updateProblem,
  linkTickets,
  unlinkTicket,
  resolveProblem,
} = require('../controllers/problemController');

const router = Router();
router.use(requireAuth, requireRole('admin', 'manager', 'agent', 'technician', 'specialist'));

router.get('/', getProblems);
router.post('/', requireRole('admin', 'manager', 'agent'), createProblem);
router.get('/:id', getProblem);
router.patch('/:id', requireRole('admin', 'manager', 'agent'), updateProblem);
router.post('/:id/link', requireRole('admin', 'manager', 'agent'), linkTickets);
router.delete('/:id/tickets/:ticketId', requireRole('admin', 'manager', 'agent'), unlinkTicket);
router.post('/:id/resolve', requireRole('admin', 'manager'), resolveProblem);

module.exports = router;
