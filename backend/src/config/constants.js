// SLA target resolution times in minutes (ITIL-aligned)
const SLA_MINUTES = {
  P1: 60, // 1 hour  — Critical, major service impact
  P2: 240, // 4 hours — High, significant degradation
  P3: 480, // 8 hours — Medium, one business day
  P4: 4320, // 72 hours — Low, 3 business days
};

// Category → suggested Tier 2 escalation team mapping
const ESCALATION_TEAMS = {
  Network: 'Network Infrastructure Team',
  'Clinical Application': 'Clinical Systems Team',
  Hardware: 'Desktop Support Team',
  Software: 'Application Support Team',
  'Account Access': 'Identity & Access Management Team',
};

const TICKET_STATUSES = ['New', 'In Progress', 'Escalated', 'Resolved', 'Closed'];
const TICKET_TYPES = ['Incident', 'Service Request'];
const TICKET_PRIORITIES = ['P1', 'P2', 'P3', 'P4'];
const TICKET_CATEGORIES = Object.keys(ESCALATION_TEAMS);

module.exports = {
  SLA_MINUTES,
  ESCALATION_TEAMS,
  TICKET_STATUSES,
  TICKET_TYPES,
  TICKET_PRIORITIES,
  TICKET_CATEGORIES,
};
