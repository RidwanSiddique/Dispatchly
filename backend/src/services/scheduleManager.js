/**
 * Schedule Manager
 *
 * Two responsibilities:
 *   1. updateAgentStatus() — single-source status change with history log
 *   2. start()             — cron (every minute) that auto-transitions statuses
 *                            based on work_schedules and oncall_schedules
 *
 * Status machine (valid transitions):
 *
 *   off_duty  ──[shift start]──► on_duty
 *   offline   ──[login]────────► on_duty / available
 *   on_duty   ──[manual]───────► available, busy, break, lunch, training, meeting
 *   available ──[assigned ticket]► busy
 *   busy      ──[ticket resolved]► available / on_duty
 *   *         ──[on-call start]──► on_call
 *   on_call   ──[on-call end]───► on_duty / off_duty (based on schedule)
 *   *         ──[shift end]──────► off_duty
 *   *         ──[logout]─────────► offline
 *
 * Statuses that managers/supervisors may force-set on their reports:
 *   on_duty, off_duty, break, meeting, training
 */

const cron = require('node-cron');
const pool = require('../db/pool');
const { notify } = require('./notifier');

// Statuses where shift auto-transitions should NOT apply
// (on_call is managed separately by the on-call schedule)
const PROTECTED_STATUSES = new Set(['on_call', 'offline']);

// Statuses that count as "working" and should transition to off_duty at shift end
const WORKING_STATUSES = new Set(['on_duty', 'available', 'busy', 'break', 'lunch', 'training', 'meeting']);

// ─── Core: update a user's status with full audit trail ─────────────────────

/**
 * @param {number}  userId
 * @param {string}  newStatus
 * @param {number|null} setByUserId   null = system/automatic
 * @param {boolean} isAutomatic
 * @param {string}  [reason]
 */
async function updateAgentStatus(userId, newStatus, setByUserId = null, isAutomatic = false, reason = null) {
  // Fetch current status
  const { rows: [user] } = await pool.query(
    'SELECT current_status, name FROM users WHERE id = $1',
    [userId]
  );
  if (!user) return null;

  const previousStatus = user.current_status;
  if (previousStatus === newStatus) return null; // no-op

  // Close the previous log entry
  await pool.query(`
    UPDATE agent_status_log
    SET ended_at = NOW()
    WHERE user_id = $1 AND ended_at IS NULL
  `, [userId]);

  // Update the user record
  await pool.query(`
    UPDATE users
    SET current_status          = $1,
        current_status_reason   = $2,
        current_status_since    = NOW(),
        current_status_set_by   = $3,
        -- Keep availability_status in sync for backward compat
        availability_status = CASE
          WHEN $1 IN ('available','on_duty') THEN 'available'
          WHEN $1 = 'on_call' THEN 'on_call'
          WHEN $1 = 'busy'    THEN 'busy'
          ELSE 'offline'
        END
    WHERE id = $4
  `, [newStatus, reason, setByUserId, userId]);

  // Write new log entry
  await pool.query(`
    INSERT INTO agent_status_log (user_id, status, previous_status, reason, set_by_user_id, is_automatic)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [userId, newStatus, previousStatus, reason, setByUserId, isAutomatic]);

  return { userId, previousStatus, newStatus, reason };
}

// ─── Check if a user is currently within their scheduled work hours ──────────

async function isUserInShift(userId) {
  const { rows: [sched] } = await pool.query(
    'SELECT * FROM work_schedules WHERE user_id = $1',
    [userId]
  );
  if (!sched || sched.schedule_type === 'exempt') return false;

  const now = new Date();
  const dayOfWeek = now.getDay();
  const hour = now.getHours();

  const workDays = sched.work_days || [1, 2, 3, 4, 5];
  const isWorkDay = workDays.includes(dayOfWeek);
  const isWorkHour = hour >= sched.start_hour && hour < sched.end_hour;

  return isWorkDay && isWorkHour;
}

// ─── Main schedule check (runs every minute) ─────────────────────────────────

async function runScheduleCheck() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const hour = now.getHours();
  const minute = now.getMinutes();

  // ── 1. Shift start/end transitions ────────────────────────────────────────────
  const { rows: schedules } = await pool.query(`
    SELECT ws.*, u.current_status, u.id AS uid, u.name
    FROM work_schedules ws
    JOIN users u ON u.id = ws.user_id
    WHERE u.is_active = TRUE
      AND ws.schedule_type != 'exempt'
      AND (ws.effective_from IS NULL OR ws.effective_from <= CURRENT_DATE)
      AND (ws.effective_until IS NULL OR ws.effective_until >= CURRENT_DATE)
  `);

  for (const sched of schedules) {
    const workDays = sched.work_days || [1, 2, 3, 4, 5];
    const inShift = workDays.includes(dayOfWeek) && hour >= sched.start_hour && hour < sched.end_hour;

    if (PROTECTED_STATUSES.has(sched.current_status)) continue;

    if (inShift && ['off_duty', 'offline'].includes(sched.current_status)) {
      // Shift starting — move to on_duty
      await updateAgentStatus(sched.uid, 'on_duty', null, true, 'Shift started (auto)');
    } else if (!inShift && WORKING_STATUSES.has(sched.current_status)) {
      // Shift ending — move to off_duty
      await updateAgentStatus(sched.uid, 'off_duty', null, true, 'Shift ended (auto)');
    }
  }

  // ── 2. On-call schedule transitions ─────────────────────────────────────────
  // Starting on-call slots (started within the last minute)
  const { rows: startingOncall } = await pool.query(`
    SELECT s.user_id, u.current_status
    FROM oncall_schedules s
    JOIN users u ON u.id = s.user_id
    WHERE s.start_time <= NOW()
      AND s.start_time > NOW() - INTERVAL '1 minute'
      AND u.current_status != 'on_call'
      AND u.is_active = TRUE
  `);

  for (const row of startingOncall) {
    await updateAgentStatus(row.user_id, 'on_call', null, true, 'On-call period started (auto)');
    await notify(row.user_id, null, 'ticket_assigned',
      '📟 Your on-call shift has started. You are now on call.');
  }

  // Ending on-call slots
  const { rows: endingOncall } = await pool.query(`
    SELECT s.user_id, u.current_status
    FROM oncall_schedules s
    JOIN users u ON u.id = s.user_id
    WHERE s.end_time <= NOW()
      AND s.end_time > NOW() - INTERVAL '1 minute'
      AND u.current_status = 'on_call'
      AND u.is_active = TRUE
  `);

  for (const row of endingOncall) {
    const inShift = await isUserInShift(row.user_id);
    const nextStatus = inShift ? 'on_duty' : 'off_duty';
    await updateAgentStatus(row.user_id, nextStatus, null, true, 'On-call period ended (auto)');
    await notify(row.user_id, null, 'ticket_updated',
      '📟 Your on-call shift has ended.');
  }
}

// ─── Transition busy agents back to on_duty when ticket resolves ─────────────

async function onTicketResolved(assignedUserId) {
  if (!assignedUserId) return;
  const { rows: [user] } = await pool.query(
    'SELECT current_status FROM users WHERE id = $1', [assignedUserId]
  );
  if (!user || user.current_status !== 'busy') return;

  // Check if they still have other open tickets
  const { rows: [{ count }] } = await pool.query(`
    SELECT COUNT(*)::int AS count
    FROM tickets
    WHERE assigned_to_user_id = $1
      AND status NOT IN ('Resolved','Closed','Pending Approval')
  `, [assignedUserId]);

  if (count === 0) {
    const inShift = await isUserInShift(assignedUserId);
    await updateAgentStatus(
      assignedUserId, inShift ? 'available' : 'off_duty',
      null, true, 'All assigned tickets resolved'
    );
  }
}

// ─── Start cron ──────────────────────────────────────────────────────────────

function start() {
  console.log('[ScheduleManager] Starting — auto-status transitions every minute');

  // Run immediately on start
  runScheduleCheck().catch((err) =>
    console.error('[ScheduleManager] Startup check error:', err.message)
  );

  // Then every minute
  cron.schedule('* * * * *', () => {
    runScheduleCheck().catch((err) =>
      console.error('[ScheduleManager] Check error:', err.message)
    );
  });
}

module.exports = { start, updateAgentStatus, isUserInShift, onTicketResolved, runScheduleCheck };
