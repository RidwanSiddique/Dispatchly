const { Router } = require('express');
const { login, logout, me } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

const router = Router();

router.post('/login', login);
router.post('/logout', requireAuth, logout);
router.get('/me', requireAuth, me);

module.exports = router;
