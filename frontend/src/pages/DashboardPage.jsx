import { formatDistanceToNow } from 'date-fns';
import { Link, useLoaderData } from 'react-router-dom';
import { PageHeader } from '../components/layout/Layout';
import { PriorityBadge, StatusBadge } from '../components/ui/Badge';
import { REQUESTER_ROLES, STAFF_ROLES, useCurrentUser } from '../context/AuthContext';

// ─── Loader ──────────────────────────────────────────────────────────────────

export async function dashboardLoader() {
  const res = await fetch('/api/dashboard', { credentials: 'include' });
  if (!res.ok) throw new Response('Failed to load dashboard', { status: res.status });
  return res.json();
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value, sub, colorClass }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-gray-500 font-medium">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${colorClass}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function MiniBar({ label, count, total, colorClass }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-600 font-medium">{label}</span>
        <span className="text-gray-400">{count}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const PRIORITY_COLOR = {
  P1: 'bg-red-500',
  P2: 'bg-orange-500',
  P3: 'bg-yellow-400',
  P4: 'bg-green-500',
};
const STATUS_COLOR = {
  New: 'bg-blue-500',
  'In Progress': 'bg-indigo-500',
  Escalated: 'bg-purple-500',
  Resolved: 'bg-emerald-500',
  Closed: 'bg-gray-400',
};

// ─── Staff dashboard (full view) ──────────────────────────────────────────────

function StaffDashboard({ data }) {
  const { totals, sla, avgResolutionMinutes, byPriority, byStatus, byCategory, recentTickets } =
    data;

  return (
    <div className="p-8 space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Tickets"
          value={totals.total}
          sub="All time"
          colorClass="text-blue-600"
        />
        <StatCard
          label="Open"
          value={totals.open}
          sub="Active tickets"
          colorClass="text-amber-600"
        />
        <StatCard
          label="SLA Breached"
          value={sla.breached}
          sub={`${sla.atRisk} at risk`}
          colorClass="text-red-600"
        />
        <StatCard
          label="Avg Resolution"
          value={avgResolutionMinutes != null ? `${Math.round(avgResolutionMinutes / 60)}h` : '—'}
          sub="Last 30 days"
          colorClass="text-emerald-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">SLA Health</h2>
          <div className="space-y-3">
            <MiniBar
              label="On Track"
              count={sla.onTrack}
              total={sla.total || 1}
              colorClass="bg-emerald-500"
            />
            <MiniBar
              label="At Risk"
              count={sla.atRisk}
              total={sla.total || 1}
              colorClass="bg-amber-500"
            />
            <MiniBar
              label="Breached"
              count={sla.breached}
              total={sla.total || 1}
              colorClass="bg-red-500"
            />
          </div>
          <p className="mt-4 text-xs text-gray-400">
            {sla.total} open ticket{sla.total !== 1 ? 's' : ''} tracked
          </p>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Open by Priority</h2>
          <div className="space-y-3">
            {['P1', 'P2', 'P3', 'P4'].map((p) => (
              <MiniBar
                key={p}
                label={p}
                count={byPriority.find((r) => r.priority === p)?.count ?? 0}
                total={totals.open || 1}
                colorClass={PRIORITY_COLOR[p]}
              />
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">By Status</h2>
          <div className="space-y-3">
            {['New', 'In Progress', 'Escalated', 'Resolved', 'Closed'].map((s) => (
              <MiniBar
                key={s}
                label={s}
                count={byStatus.find((r) => r.status === s)?.count ?? 0}
                total={totals.total || 1}
                colorClass={STATUS_COLOR[s]}
              />
            ))}
          </div>
        </div>
      </div>

      <RecentTickets tickets={recentTickets} />
    </div>
  );
}

// ─── Requester dashboard (client / HR) ───────────────────────────────────────

function RequesterDashboard({ data }) {
  const { totals, byStatus, recentTickets } = data;

  return (
    <div className="p-8 space-y-8">
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="My Tickets"
          value={totals.total}
          sub="Submitted by you"
          colorClass="text-blue-600"
        />
        <StatCard label="Open" value={totals.open} sub="In progress" colorClass="text-amber-600" />
        <StatCard
          label="Resolved"
          value={totals.resolved}
          sub="Closed tickets"
          colorClass="text-emerald-600"
        />
      </div>

      <div className="card p-5 max-w-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">My Tickets by Status</h2>
        <div className="space-y-3">
          {['New', 'In Progress', 'Escalated', 'Resolved', 'Closed'].map((s) => (
            <MiniBar
              key={s}
              label={s}
              count={byStatus.find((r) => r.status === s)?.count ?? 0}
              total={totals.total || 1}
              colorClass={STATUS_COLOR[s]}
            />
          ))}
        </div>
      </div>

      <RecentTickets tickets={recentTickets} emptyLabel="You haven't submitted any tickets yet." />
    </div>
  );
}

// ─── Recent tickets table (shared) ───────────────────────────────────────────

function RecentTickets({ tickets, emptyLabel = 'No tickets yet' }) {
  return (
    <div className="card">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Recent Tickets</h2>
        <Link to="/tickets" className="text-xs text-blue-600 hover:underline font-medium">
          View all →
        </Link>
      </div>
      <div className="divide-y divide-gray-50">
        {tickets.length === 0 && (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">{emptyLabel}</p>
        )}
        {tickets.map((t) => (
          <Link
            key={t.id}
            to={`/tickets/${t.id}`}
            className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors"
          >
            <PriorityBadge priority={t.priority} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{t.title}</p>
              <p className="text-xs text-gray-400">{t.category}</p>
            </div>
            <StatusBadge status={t.status} />
            <span className="text-xs text-gray-400 whitespace-nowrap">
              {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const data = useLoaderData();
  const user = useCurrentUser();
  const role = user?.role ?? 'client';
  const isRequester = REQUESTER_ROLES.includes(role);

  const subtitle = isRequester
    ? 'Your submitted tickets'
    : role === 'technician'
      ? 'Tickets assigned to you'
      : 'Live overview of service desk operations';

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={subtitle}
        actions={
          <Link to="/tickets/new" className="btn btn-primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Ticket
          </Link>
        }
      />

      {isRequester ? <RequesterDashboard data={data} /> : <StaffDashboard data={data} />}
    </div>
  );
}
