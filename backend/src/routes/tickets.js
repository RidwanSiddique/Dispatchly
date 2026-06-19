const express = require('express');
const router = express.Router();
const { validate } = require('../middleware/validate');
const {
  getTickets,
  getTicket,
  createTicket,
  updateTicket,
  escalateTicket,
  addComment,
  convertToKb,
} = require('../controllers/ticketController');

router.get('/', getTickets);
router.post('/', validate(['requester_name', 'title', 'description']), createTicket);
router.get('/:id', getTicket);
router.patch('/:id', updateTicket);
router.post('/:id/escalate', escalateTicket);
router.post('/:id/comments', addComment);
router.post('/:id/convert-to-kb', convertToKb);

module.exports = router;
