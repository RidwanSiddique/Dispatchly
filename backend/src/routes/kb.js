const express = require('express');
const router = express.Router();
const { validate } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  getArticles,
  getArticle,
  createArticle,
  updateArticle,
  deleteArticle,
} = require('../controllers/kbController');
const { CAN_MANAGE_KB } = require('../config/constants');

// All KB routes require authentication
router.use(requireAuth);

// Everyone can read articles
router.get('/', getArticles);
router.get('/:id', getArticle);

// Only KB managers can create / edit / delete articles directly
router.post(
  '/',
  requireRole(...CAN_MANAGE_KB),
  validate(['title', 'symptoms', 'resolution_steps']),
  createArticle
);
router.patch('/:id', requireRole(...CAN_MANAGE_KB), updateArticle);
router.delete('/:id', requireRole(...CAN_MANAGE_KB), deleteArticle);

module.exports = router;
