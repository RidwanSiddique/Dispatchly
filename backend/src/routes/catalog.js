const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  getCatalogItems,
  getCatalogItem,
  submitCatalogItem,
} = require('../controllers/catalogController');

const router = Router();
router.use(requireAuth);

router.get('/', getCatalogItems);
router.get('/:id', getCatalogItem);
router.post('/:id/submit', submitCatalogItem);

module.exports = router;
