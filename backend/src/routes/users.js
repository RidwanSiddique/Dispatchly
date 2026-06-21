const { Router } = require('express');
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deactivateUser,
  getStaff,
  updateAvailability,
  updateSkills,
} = require('../controllers/userController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = Router();
router.use(requireAuth);

// Staff listing — admin + manager can access
router.get('/staff', requireRole('admin', 'manager', 'agent', 'technician', 'specialist'), getStaff);

// Own availability update — any authenticated staff
router.patch('/me/availability', updateAvailability);

// Admin-only routes
router.use(requireRole('admin'));

router.get('/', getUsers);
router.post('/', createUser);
router.get('/:id', getUser);
router.patch('/:id', updateUser);
router.patch('/:id/skills', updateSkills);
router.delete('/:id', deactivateUser);

module.exports = router;
