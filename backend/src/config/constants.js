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

// User roles — ordered from highest to lowest privilege
const ROLES = ['admin', 'manager', 'agent', 'technician', 'specialist', 'hr', 'client'];

// Roles that have access to the full staff dashboard and all tickets
const STAFF_ROLES = ['admin', 'manager', 'agent', 'technician', 'specialist'];

// Roles that can only see tickets they submitted
const REQUESTER_ROLES = ['hr', 'client'];

// Roles that can escalate tickets
const CAN_ESCALATE = ['admin', 'manager', 'agent'];

// Roles that can resolve / close tickets
const CAN_RESOLVE = ['admin', 'manager', 'agent', 'technician', 'specialist'];

// Roles that can manage KB articles (create, edit, delete)
const CAN_MANAGE_KB = ['admin', 'manager', 'specialist'];

// Roles that can convert a ticket to a KB article
const CAN_CONVERT_KB = ['admin', 'manager', 'agent', 'specialist'];

module.exports = {
  SLA_MINUTES,
  ESCALATION_TEAMS,
  TICKET_STATUSES,
  TICKET_TYPES,
  TICKET_PRIORITIES,
  TICKET_CATEGORIES,
  ROLES,
  STAFF_ROLES,
  REQUESTER_ROLES,
  CAN_ESCALATE,
  CAN_RESOLVE,
  CAN_MANAGE_KB,
  CAN_CONVERT_KB,
};
