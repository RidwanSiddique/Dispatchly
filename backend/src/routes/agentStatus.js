const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const {
  getStatusBoard,
  getUserStatus,
  updateStatus,
  getStatusHistory,
  getTeamStatusSummary,
  getSchedule,
  upsertSchedule,
  getTeamSchedules,
} = require('../controllers/agentStatusController');

// ── Status board ──────────────────────────────────────────────────────────────
router.get('/board',   requireAuth, requirePermission('status','read:all'), getStatusBoard);
router.get('/summary', requireAuth, requirePermission('status','read:all'), getTeamStatusSummary);

// ── Individual status ─────────────────────────────────────────────────────────
router.get('/:userId',         requireAuth, getUserStatus);
router.patch('/:userId',       requireAuth, updateStatus);
router.get('/:userId/history', requireAuth, getStatusHistory);

// ── Work schedules ─────────────────────────────────────────────────────────────
router.get('/schedules',           requireAuth, requirePermission('schedule','read:all'), getTeamSchedules);
router.get('/schedules/:userId',   requireAuth, getSchedule);
router.put('/schedules/:userId',   requireAuth, upsertSchedule);

module.exports = router;
