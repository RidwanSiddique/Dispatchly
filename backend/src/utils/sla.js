const { ESCALATION_TEAMS } = require('../config/constants');

/**
 * Compute real-time SLA status from a ticket row.
 * Pure JS — no DB call needed.
 */
function computeSla(ticket) {
  if (['Resolved', 'Closed'].includes(ticket.status)) {
    return { status: 'Resolved', minutesRemaining: null, percentElapsed: 100 };
  }
  const elapsed = (Date.now() - new Date(ticket.created_at)) / 60000;
  const total = ticket.sla_minutes;
  const remaining = total - elapsed;
  const pct = Math.min(100, (elapsed / total) * 100);
  return {
    status: remaining < 0 ? 'Breached' : pct >= 75 ? 'At Risk' : 'On Track',
    minutesRemaining: Math.round(remaining),
    percentElapsed: Math.round(pct),
  };
}

/**
 * Attach computed SLA + suggested escalation team to a ticket row.
 */
function enrich(ticket) {
  return {
    ...ticket,
    sla: computeSla(ticket),
    suggestedEscalationTeam: ESCALATION_TEAMS[ticket.category] ?? null,
  };
}

module.exports = { computeSla, enrich };
