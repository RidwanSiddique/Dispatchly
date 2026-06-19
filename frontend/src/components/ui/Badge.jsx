const PRIORITY_STYLES = {
  P1: 'bg-red-100 text-red-700 ring-1 ring-red-300',
  P2: 'bg-orange-100 text-orange-700 ring-1 ring-orange-300',
  P3: 'bg-yellow-100 text-yellow-700 ring-1 ring-yellow-300',
  P4: 'bg-green-100 text-green-700 ring-1 ring-green-300',
};

const STATUS_STYLES = {
  New: 'bg-blue-100 text-blue-700',
  'In Progress': 'bg-indigo-100 text-indigo-700',
  Escalated: 'bg-purple-100 text-purple-700',
  Resolved: 'bg-green-100 text-green-700',
  Closed: 'bg-gray-100 text-gray-600',
};

const SLA_STYLES = {
  'On Track': 'bg-emerald-100 text-emerald-700',
  'At Risk': 'bg-amber-100 text-amber-700',
  Breached: 'bg-red-100 text-red-700',
  Resolved: 'bg-gray-100 text-gray-500',
};

const TYPE_STYLES = {
  Incident: 'bg-rose-100 text-rose-700',
  'Service Request': 'bg-sky-100 text-sky-700',
};

export function PriorityBadge({ priority }) {
  return (
    <span className={`badge ${PRIORITY_STYLES[priority] || 'bg-gray-100 text-gray-600'}`}>
      {priority}
    </span>
  );
}

export function StatusBadge({ status }) {
  return (
    <span className={`badge ${STATUS_STYLES[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

export function SlaBadge({ sla }) {
  if (!sla) return null;
  return (
    <span className={`badge ${SLA_STYLES[sla.status] || 'bg-gray-100 text-gray-600'}`}>
      {sla.status}
      {sla.minutesRemaining !== null && sla.status !== 'Resolved' && (
        <span className="ml-1 opacity-75">
          {sla.minutesRemaining < 0
            ? `+${Math.abs(sla.minutesRemaining)}m`
            : `${sla.minutesRemaining}m`}
        </span>
      )}
    </span>
  );
}

export function TypeBadge({ type }) {
  return (
    <span className={`badge ${TYPE_STYLES[type] || 'bg-gray-100 text-gray-600'}`}>{type}</span>
  );
}
