const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const {
  getSkills, createSkill, updateSkill,
  getUserSkills, assignSkillToUser, verifyUserSkill, removeUserSkill,
  getTicketSkills, setTicketSkill, removeTicketSkill,
  suggestAgentsForTicket,
} = require('../controllers/skillController');

// ── Skill catalogue ───────────────────────────────────────────────────────────
router.get('/',     requireAuth, requirePermission('skills','read'),   getSkills);
router.post('/',    requireAuth, requirePermission('skills','manage'), createSkill);
router.patch('/:id', requireAuth, requirePermission('skills','manage'), updateSkill);

// ── User skills ────────────────────────────────────────────────────────────────
router.get('/users/:userId',                requireAuth, requirePermission('skills','read'), getUserSkills);
router.post('/users/:userId',               requireAuth, requirePermission('skills','assign:own'), assignSkillToUser);
router.patch('/user-skills/:id/verify',     requireAuth, requirePermission('skills','assign:reports'), verifyUserSkill);
router.delete('/users/:userId/:skillId',    requireAuth, requirePermission('skills','assign:own'), removeUserSkill);

// ── Ticket required skills ────────────────────────────────────────────────────
router.get('/tickets/:ticketId',               requireAuth, requirePermission('skills','read'), getTicketSkills);
router.post('/tickets/:ticketId',              requireAuth, requirePermission('tickets','update:assigned'), setTicketSkill);
router.delete('/tickets/:ticketId/:skillId',   requireAuth, requirePermission('tickets','update:assigned'), removeTicketSkill);

// ── Agent suggestions ─────────────────────────────────────────────────────────
router.get('/suggest/:ticketId', requireAuth, requirePermission('tickets','assign'), suggestAgentsForTicket);

module.exports = router;
