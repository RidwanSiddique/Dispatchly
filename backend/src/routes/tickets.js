const express = require('express');
const router = express.Router();
const { validate } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  getTickets,
  getTicket,
  createTicket,
  updateTicket,
  escalateTicket,
  addComment,
  convertToKb,
  acceptAssignment,
  declineAssignment,
} = require('../controllers/ticketController');
const { getApproval, approveTicket, rejectTicket } = require('../controllers/approvalController');
const { getTimeEntries, logTime } = require('../controllers/timeController');
const { getTicketProblems } = require('../controllers/problemController');
const { CAN_ESCALATE, CAN_RESOLVE, CAN_CONVERT_KB } = require('../config/constants');

// All ticket routes require authentication
router.use(requireAuth);

router.get('/', getTickets);

// All authenticated roles can create tickets
router.post('/', validate(['title', 'description']), createTicket);

router.get('/:id', getTicket);

// Only staff can mutate ticket status/fields
router.patch(
  '/:id',
  requireRole('admin', 'manager', 'agent', 'technician', 'specialist'),
  updateTicket
);

// Escalate: agent-level and above only
router.post('/:id/escalate', requireRole(...CAN_ESCALATE), escalateTicket);

// Anyone authenticated can comment
router.post('/:id/comments', addComment);

// Convert resolved ticket to KB: agent-level specialists
router.post('/:id/convert-to-kb', requireRole(...CAN_CONVERT_KB), convertToKb);

// Linked problems
router.get('/:id/problems', getTicketProblems);

// Time tracking
router.get('/:id/time', getTimeEntries);
router.post('/:id/time', requireRole('admin', 'manager', 'agent', 'technician', 'specialist'), logTime);

// Assignment accept / decline — technicians only
router.post('/:id/accept', requireRole('technician', 'agent', 'specialist'), acceptAssignment);
router.post('/:id/decline', requireRole('technician', 'agent', 'specialist'), declineAssignment);

// Approval workflow (managers and admins only)
router.get('/:id/approval', getApproval);
router.post('/:id/approve', requireRole('admin', 'manager'), approveTicket);
router.post('/:id/reject', requireRole('admin', 'manager'), rejectTicket);

module.exports = router;
