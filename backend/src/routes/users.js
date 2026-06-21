const { Router } = require('express');
const { getUsers, getUser, createUser, updateUser, deactivateUser } = require('../controllers/userController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = Router();

// All user management routes require admin role
router.use(requireAuth, requireRole('admin'));

router.get('/', getUsers);
router.post('/', createUser);
router.get('/:id', getUser);
router.patch('/:id', updateUser);
router.delete('/:id', deactivateUser);

module.exports = router;
