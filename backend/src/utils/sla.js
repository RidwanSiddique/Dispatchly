const { ESCALATION_TEAMS } = require('../config/constants');

// ─── Business Hours Configuration ────────────────────────────────────────────

/**
 * Default business hours config.
 * This is overridden at runtime by the value loaded from business_hours_config table.
 * workDays: 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
 */
const DEFAULT_BIZ_HOURS = {
  startHour: 9,
  endHour: 17,
  workDays: [1, 2, 3, 4, 5], // Mon–Fri
};

// Module-level cache — updated by loadBusinessHoursConfig()
let _bizHoursConfig = { ...DEFAULT_BIZ_HOURS };

/**
 * Update the cached business hours config.
 * Called at server startup and periodically by slaMonitor.
 */
function setBusinessHoursConfig(config) {
  if (config) {
    _bizHoursConfig = {
      startHour: config.start_hour ?? DEFAULT_BIZ_HOURS.startHour,
      endHour:   config.end_hour   ?? DEFAULT_BIZ_HOURS.endHour,
      workDays:  config.work_days  ?? DEFAULT_BIZ_HOURS.workDays,
    };
  }
}

function getBusinessHoursConfig() {
  return _bizHoursConfig;
}

// ─── Business Minutes Calculation ────────────────────────────────────────────

/**
 * Calculate how many business minutes have elapsed between two dates.
 * Only counts minutes that fall within configured business hours.
 *
 * O(N days) — efficient even for P4 tickets spanning multiple days.
 *
 * @param {Date|string} start
 * @param {Date|string} end
 * @param {object} [config]   Defaults to _bizHoursConfig
 * @returns {number} Elapsed business minutes
 */
function businessMinutesElapsed(start, end, config = _bizHoursConfig) {
  const { startHour, endHour, workDays } = config;
  let total = 0;
  let current = new Date(start);
  const endDate = new Date(end);

  // Safety valve: if somehow end < start, return 0
  if (endDate <= current) return 0;

  while (current < endDate) {
    const dayOfWeek = current.getDay();

    // Not a work day — skip to next day at business start
    if (!workDays.includes(dayOfWeek)) {
      current.setDate(current.getDate() + 1);
      current.setHours(startHour, 0, 0, 0);
      continue;
    }

    const bizStart = new Date(current);
    bizStart.setHours(startHour, 0, 0, 0);

    const bizEnd = new Date(current);
    bizEnd.setHours(endHour, 0, 0, 0);

    if (current < bizStart) {
      // Before business hours today — jump to start
      current = new Date(bizStart);
      continue;
    }

    if (current >= bizEnd) {
      // After business hours today — jump to next day
      current.setDate(current.getDate() + 1);
      current.setHours(startHour, 0, 0, 0);
      continue;
    }

    // We're inside business hours — count up to the earlier of bizEnd or endDate
    const segmentEnd = endDate < bizEnd ? endDate : bizEnd;
    total += (segmentEnd - current) / 60000; // ms → minutes

    // Advance past the end of today's business hours
    current = new Date(bizEnd);
    current.setDate(current.getDate() + 1);
    current.setHours(startHour, 0, 0, 0);
  }

  return total;
}

// ─── Priorities that respect business hours ───────────────────────────────────

// P1 / P2 = critical / high — SLA clock runs 24/7
// P3 / P4 = standard / low  — SLA clock pauses outside business hours
const BUSINESS_HOURS_PRIORITIES = new Set(['P3', 'P4']);

// ─── Core SLA computation ────────────────────────────────────────────────────

/**
 * Compute real-time SLA status from a ticket row.
 * Pure JS — no DB call needed.
 *
 * @param {object} ticket   Must have: status, priority, created_at, sla_minutes
 * @param {object} [bizConfig]  Override business hours config (optional)
 * @returns {{ status, minutesRemaining, percentElapsed, pct, elapsedMinutes, isBusinessHours }}
 */
function computeSla(ticket, bizConfig) {
  const config = bizConfig ?? _bizHoursConfig;

  if (['Resolved', 'Closed'].includes(ticket.status)) {
    return {
      status: 'Resolved',
      minutesRemaining: null,
      percentElapsed: 100,
      pct: 100,
      elapsedMinutes: null,
      isBusinessHours: false,
    };
  }

  const now = new Date();
  const createdAt = new Date(ticket.created_at);
  const total = ticket.sla_minutes;

  // Choose clock type based on priority
  const useBusinessHours = BUSINESS_HOURS_PRIORITIES.has(ticket.priority);
  const elapsed = useBusinessHours
    ? businessMinutesElapsed(createdAt, now, config)
    : (now - createdAt) / 60000;

  const remaining = total - elapsed;
  const pct = total > 0 ? Math.min(200, (elapsed / total) * 100) : 0; // cap at 200% for display

  // Determine if we're currently in business hours
  const isInBizHours = isCurrentlyInBusinessHours(config);

  return {
    status: remaining < 0 ? 'Breached' : pct >= 75 ? 'At Risk' : 'On Track',
    minutesRemaining: Math.round(remaining),
    percentElapsed: Math.round(Math.min(100, pct)),
    pct: Math.round(pct),
    elapsedMinutes: Math.round(elapsed),
    isBusinessHours: useBusinessHours,
    isPaused: useBusinessHours && !isInBizHours,
  };
}

/**
 * Check if the current moment is within business hours.
 */
function isCurrentlyInBusinessHours(config = _bizHoursConfig) {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  return (
    config.workDays.includes(day) &&
    hour >= config.startHour &&
    hour < config.endHour
  );
}

// ─── Compute SLA for a specific ticket_slas record ───────────────────────────

/**
 * Compute elapsed business minutes for a ticket_slas row.
 * Used by the SLA monitor to check multi-SLA breaches.
 *
 * @param {object} ticketSla  Row from ticket_slas table
 * @param {object} slaDef     Row from sla_definitions table
 * @returns {{ elapsed, remaining, pct, status }}
 */
function computeTicketSla(ticketSla, slaDef) {
  const now = new Date();
  const config = slaDef.applies_business_hours ? _bizHoursConfig : null;

  const elapsed = config
    ? businessMinutesElapsed(ticketSla.started_at, now, config)
    : (now - new Date(ticketSla.started_at)) / 60000;

  const remaining = slaDef.target_minutes - elapsed;
  const pct = slaDef.target_minutes > 0
    ? Math.min(200, (elapsed / slaDef.target_minutes) * 100)
    : 0;

  return {
    elapsed: Math.round(elapsed),
    remaining: Math.round(remaining),
    pct: Math.round(pct),
    status: remaining < 0 ? 'breached' : pct >= 75 ? 'at_risk' : 'active',
  };
}

// ─── Enrich helper ───────────────────────────────────────────────────────────

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

module.exports = {
  computeSla,
  computeTicketSla,
  enrich,
  businessMinutesElapsed,
  isCurrentlyInBusinessHours,
  setBusinessHoursConfig,
  getBusinessHoursConfig,
  DEFAULT_BIZ_HOURS,
};
