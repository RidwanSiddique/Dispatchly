/**
 * Skills-Based Routing Engine
 *
 * Finds the best available agent for a ticket by scoring candidates on:
 *   1. Status tier     — available > on_duty > on_call > busy
 *   2. Skill match     — avg(agent_proficiency / required_proficiency) per required skill
 *   3. Workload        — fewer open assigned tickets = better
 *   4. Team alignment  — prefer agents in the same department as the ticket
 *
 * Falls back gracefully when no required skills are set (category-based routing).
 */

const pool = require('../db/pool');

const STATUS_PRIORITY = {
  available: 0,
  on_duty:   1,
  on_call:   2,
  busy:      3,
};

/**
 * Find the best agent for a ticket.
 *
 * @param {object} ticket  — row from tickets table (id, priority, category, department_id)
 * @returns {object|null}  — user row or null
 */
async function findBestAgent(ticket) {
  // Determine which department/team to search in
  const deptId = ticket.department_id || null;

  const { rows: candidates } = await pool.query(`
    SELECT
      u.id,
      u.name,
      u.role,
      u.current_status,
      u.department_id,
      u.team_id,
      -- Open ticket workload
      (
        SELECT COUNT(*)::int
        FROM tickets t2
        WHERE t2.assigned_to_user_id = u.id
          AND t2.status NOT IN ('Resolved','Closed','Pending Approval')
      ) AS open_tickets,
      -- Skill match score (0 if no required skills defined on ticket)
      COALESCE((
        SELECT AVG(
          LEAST(us.proficiency_level::float / GREATEST(trs.required_proficiency::float, 1), 1.0)
        )
        FROM ticket_required_skills trs
        JOIN user_skills us ON us.skill_id = trs.skill_id AND us.user_id = u.id
        WHERE trs.ticket_id = $1
      ), -1) AS skill_score,
      -- Count of matched required skills
      COALESCE((
        SELECT COUNT(*)::int
        FROM ticket_required_skills trs
        JOIN user_skills us ON us.skill_id = trs.skill_id AND us.user_id = u.id
        WHERE trs.ticket_id = $1
      ), 0) AS skills_matched,
      -- Total required skills on ticket
      (SELECT COUNT(*)::int FROM ticket_required_skills WHERE ticket_id = $1) AS skills_required
    FROM users u
    WHERE u.is_active = TRUE
      AND u.role IN ('agent','technician','specialist')
      AND u.current_status IN ('available','on_duty','on_call','busy')
      AND ($2::int IS NULL OR u.department_id = $2)
    ORDER BY
      -- Prefer higher-tier statuses
      CASE u.current_status
        WHEN 'available' THEN 0
        WHEN 'on_duty'   THEN 1
        WHEN 'on_call'   THEN 2
        ELSE 3
      END ASC,
      -- Prefer 100% skill match over partial
      skills_matched DESC,
      -- Prefer lower workload
      open_tickets ASC
    LIMIT 10
  `, [ticket.id, deptId]);

  if (!candidates.length) return null;

  // If ticket has required skills, filter to those who match ALL of them
  const hasRequiredSkills = candidates[0].skills_required > 0;
  if (hasRequiredSkills) {
    const fullMatch = candidates.filter(
      (c) => c.skills_matched >= c.skills_required
    );
    if (fullMatch.length) return fullMatch[0];

    // Partial match — return best partial
    const partial = candidates.filter((c) => c.skills_matched > 0);
    if (partial.length) return partial[0];
  }

  // No skill requirements or no skill matches — return by status/workload
  return candidates[0];
}

/**
 * Auto-assign a ticket to the best available agent.
 * Returns the assigned user or null if no one available.
 */
async function autoAssign(ticket) {
  const agent = await findBestAgent(ticket);
  if (!agent) return null;

  await pool.query(`
    UPDATE tickets
    SET assigned_to_user_id = $1,
        status = CASE WHEN status = 'New' OR status IS NULL THEN 'In Progress' ELSE status END,
        updated_at = NOW()
    WHERE id = $2
  `, [agent.id, ticket.id]);

  // If agent is "available", transition to "busy"
  if (agent.current_status === 'available') {
    const { updateAgentStatus } = require('./scheduleManager');
    await updateAgentStatus(
      agent.id,
      'busy',
      null,
      true,
      `Auto-assigned to ticket #${ticket.id}`
    );
  }

  return agent;
}

/**
 * Suggest agents for a ticket (for manual assignment UI).
 * Returns ranked list with score details.
 */
async function suggestAgents(ticketId, departmentId = null) {
  const { rows } = await pool.query(`
    SELECT
      u.id, u.name, u.email, u.role, u.title, u.current_status,
      u.department_id, u.team_id,
      d.name AS department_name,
      t.name AS team_name,
      (
        SELECT COUNT(*)::int FROM tickets t2
        WHERE t2.assigned_to_user_id = u.id
          AND t2.status NOT IN ('Resolved','Closed','Pending Approval')
      ) AS open_tickets,
      COALESCE((
        SELECT ARRAY_AGG(s.name ORDER BY s.name)
        FROM user_skills us JOIN skills s ON s.id = us.skill_id
        WHERE us.user_id = u.id
      ), '{}') AS skill_names,
      COALESCE((
        SELECT AVG(us.proficiency_level::float)
        FROM ticket_required_skills trs
        JOIN user_skills us ON us.skill_id = trs.skill_id AND us.user_id = u.id
        WHERE trs.ticket_id = $1
      ), NULL) AS avg_skill_match,
      (
        SELECT COUNT(*)::int
        FROM ticket_required_skills trs
        JOIN user_skills us ON us.skill_id = trs.skill_id AND us.user_id = u.id
        WHERE trs.ticket_id = $1
      ) AS matched_skills,
      (SELECT COUNT(*)::int FROM ticket_required_skills WHERE ticket_id = $1) AS required_skills
    FROM users u
    LEFT JOIN departments d ON d.id = u.department_id
    LEFT JOIN teams t ON t.id = u.team_id
    WHERE u.is_active = TRUE
      AND u.role IN ('agent','technician','specialist')
      AND u.current_status NOT IN ('offline','off_duty')
    ORDER BY
      CASE u.current_status WHEN 'available' THEN 0 WHEN 'on_duty' THEN 1 WHEN 'on_call' THEN 2 ELSE 3 END,
      open_tickets ASC
    LIMIT 20
  `, [ticketId]);

  return rows;
}

module.exports = { findBestAgent, autoAssign, suggestAgents };
