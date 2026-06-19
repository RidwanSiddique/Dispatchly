const express = require('express');
const router = express.Router();
const { validate } = require('../middleware/validate');
const {
  getArticles,
  getArticle,
  createArticle,
  updateArticle,
  deleteArticle,
} = require('../controllers/kbController');

router.get('/', getArticles);
router.post('/', validate(['title', 'symptoms', 'resolution_steps']), createArticle);
router.get('/:id', getArticle);
router.patch('/:id', updateArticle);
router.delete('/:id', deleteArticle);

module.exports = router;
