const express = require('express');
const router = express.Router();
const {
  getDashboard,
  getAnalytics,
  getBusinessHours,
  updateBusinessHours,
  getSlaDefinitions,
  createSlaDefinition,
  updateSlaDefinition,
} = require('../controllers/dashboardController');
const { requireAuth, requireRole } = require('../middleware/auth');

// Standard dashboard (all roles)
router.get('/', requireAuth, getDashboard);

// Full analytics (staff only)
router.get('/analytics', requireAuth, requireRole('admin', 'manager', 'agent', 'technician', 'specialist'), getAnalytics);

// Business hours config
router.get('/business-hours',  requireAuth, requireRole('admin', 'manager'), getBusinessHours);
router.patch('/business-hours', requireAuth, requireRole('admin'), updateBusinessHours);

// SLA definitions
router.get('/sla-definitions',      requireAuth, requireRole('admin', 'manager', 'agent', 'technician', 'specialist'), getSlaDefinitions);
router.post('/sla-definitions',     requireAuth, requireRole('admin', 'manager'), createSlaDefinition);
router.patch('/sla-definitions/:id', requireAuth, requireRole('admin', 'manager'), updateSlaDefinition);

module.exports = router;
