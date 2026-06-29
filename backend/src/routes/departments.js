const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { requirePermission, requireCanManageUser } = require('../middleware/rbac');
const {
  getDepartments, getDepartment, createDepartment, updateDepartment, deleteDepartment,
  getTeams, getTeam, createTeam, updateTeam,
  addTeamMember, removeTeamMember,
  getOrgChart, getUserHierarchy,
} = require('../controllers/departmentController');

// ── Org chart ────────────────────────────────────────────────────────────────
router.get('/org-chart', requireAuth, requirePermission('departments','read'), getOrgChart);
router.get('/hierarchy/:userId', requireAuth, requirePermission('departments','read'), getUserHierarchy);
router.get('/hierarchy',        requireAuth, requirePermission('departments','read'), getUserHierarchy);

// ── Departments ───────────────────────────────────────────────────────────────
router.get('/',    requireAuth, requirePermission('departments','read'),   getDepartments);
router.get('/:id', requireAuth, requirePermission('departments','read'),   getDepartment);
router.post('/',   requireAuth, requirePermission('departments','manage'), createDepartment);
router.patch('/:id', requireAuth, requirePermission('departments','manage'), updateDepartment);
router.delete('/:id', requireAuth, requirePermission('departments','manage'), deleteDepartment);

// ── Teams ─────────────────────────────────────────────────────────────────────
router.get('/teams',     requireAuth, requirePermission('departments','read'),   getTeams);
router.get('/teams/:id', requireAuth, requirePermission('departments','read'),   getTeam);
router.post('/teams',    requireAuth, requirePermission('departments','manage'), createTeam);
router.patch('/teams/:id', requireAuth, requirePermission('departments','manage'), updateTeam);

// ── Team membership ────────────────────────────────────────────────────────────
router.post('/teams/:team_id/members',            requireAuth, requirePermission('departments','manage'), addTeamMember);
router.delete('/teams/:team_id/members/:user_id', requireAuth, requirePermission('departments','manage'), removeTeamMember);

module.exports = router;
