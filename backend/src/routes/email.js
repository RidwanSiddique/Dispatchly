const { Router } = require('express');
const { inboundEmail } = require('../controllers/emailController');

const router = Router();

// No auth — this is a webhook endpoint
router.post('/inbound', inboundEmail);

module.exports = router;
