import { useState, useEffect } from 'react';
import { useLoaderData, useRevalidator } from 'react-router-dom';
import { PageHeader } from '../components/layout/Layout';
import { useCurrentUser } from '../context/AuthContext';

export async function agentStatusLoader() {
  const [boardRes, summaryRes] = await Promise.all([
    fetch('/api/agent-status/board', { credentials: 'include' }),
    fetch('/api/agent-status/summary', { credentials: 'include' }),
  ]);
  const board   = boardRes.ok   ? await boardRes.json()   : { agents: [] };
  const summary = summaryRes.ok ? await summaryRes.json() : { byStatus: {}, total: 0 };
  return { agents: board.agents, summary };
}

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_META = {
  available:  { label: 'Available',  color: 'bg-green-100 text-green-700',   dot: 'bg-green-400',  icon: '🟢' },
  on_duty:    { label: 'On Duty',    color: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-400',   icon: '🔵' },
  on_call:    { label: 'On Call',    color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500', icon: '📟' },
  busy:       { label: 'Busy',       color: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-400',  icon: '🟡' },
  break:      { label: 'Break',      color: 'bg-gray-100 text-gray-600',     dot: 'bg-gray-400',   icon: '☕' },
  lunch:      { label: 'Lunch',      color: 'bg-gray-100 text-gray-600',     dot: 'bg-gray-400',   icon: '🍽️' },
  training:   { label: 'Training',   color: 'bg-teal-100 text-teal-700',     dot: 'bg-teal-400',   icon: '📚' },
  meeting:    { label: 'Meeting',    color: 'bg-teal-100 text-teal-700',     dot: 'bg-teal-400',   icon: '🗓️' },
  offline:    { label: 'Offline',    color: 'bg-gray-100 text-gray-500',     dot: 'bg-gray-300',   icon: '⚪' },
  off_duty:   { label: 'Off Duty',   color: 'bg-gray-100 text-gray-500',     dot: 'bg-gray-300',   icon: '🌙' },
};

const SELF_STATUSES    = ['available','on_duty','busy','break','lunch','training','meeting','offline'];
const MANAGER_STATUSES = [...SELF_STATUSES, 'off_duty', 'on_call'];

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const meta = STATUS_META[status] ?? { label: status, color: 'bg-gray-100 text-gray-500', icon: '⚪' };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${meta.color}`}>
      {meta.icon} {meta.label}
    </span>
  );
}

// ─── Status change dropdown ───────────────────────────────────────────────────

function StatusChanger({ agent, canManage, onChanged }) {
  const [loading, setLoading] = useState(false);
  const allowed = canManage ? MANAGER_STATUSES : SELF_STATUSES;

  const change = async (newStatus) => {
    if (newStatus === agent.current_status) return;
    setLoading(true);
    await fetch(`/api/agent-status/${agent.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    setLoading(false);
    onChanged();
  };

  return (
    <select
      className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
      value={agent.current_status}
      onChange={(e) => change(e.target.value)}
      disabled={loading}
    >
      {allowed.map((s) => (
        <option key={s} value={s}>{STATUS_META[s]?.label ?? s}</option>
      ))}
    </select>
  );
}

// ─── Agent row ────────────────────────────────────────────────────────────────

function AgentRow({ agent, canManage, onChanged }) {
  const meta = STATUS_META[agent.current_status] ?? {};
  const since = agent.current_status_since
    ? new Date(agent.current_status_since).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '—';

  const schedLabel = agent.schedule_type === 'standard' && agent.start_hour != null
    ? `${String(agent.start_hour).padStart(2,'0')}:00–${String(agent.end_hour).padStart(2,'0')}:00`
    : agent.schedule_type ?? '—';

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50">
      <td className="py-3 pr-4">
        <div className="flex items-center gap-2.5">
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${meta.dot ?? 'bg-gray-300'}`} />
          <div>
            <p className="text-sm font-medium text-gray-900">{agent.name}</p>
            <p className="text-xs text-gray-400">{agent.title || agent.role}</p>
          </div>
        </div>
      </td>
      <td className="py-3 pr-4">
        <p className="text-xs text-gray-600">{agent.department_name ?? '—'}</p>
        <p className="text-xs text-gray-400">{agent.team_name ?? '—'}</p>
      </td>
      <td className="py-3 pr-4">
        <StatusBadge status={agent.current_status} />
        {agent.current_status_reason && (
          <p className="text-xs text-gray-400 mt-0.5 truncate max-w-32">{agent.current_status_reason}</p>
        )}
      </td>
      <td className="py-3 pr-4 text-xs text-gray-500">{since}</td>
      <td className="py-3 pr-4 text-xs text-gray-500">{schedLabel}</td>
      <td className="py-3 pr-4 text-center">
        <span className={`text-sm font-bold ${agent.open_tickets > 5 ? 'text-red-600' : agent.open_tickets > 2 ? 'text-amber-600' : 'text-gray-700'}`}>
          {agent.open_tickets}
        </span>
      </td>
      <td className="py-3">
        {canManage && (
          <StatusChanger agent={agent} canManage={canManage} onChanged={onChanged} />
        )}
      </td>
    </tr>
  );
}

// ─── Summary stats ────────────────────────────────────────────────────────────

function SummaryBar({ summary }) {
  const important = ['available','on_duty','on_call','busy','off_duty','offline'];
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
      {important.map((s) => {
        const meta = STATUS_META[s];
        const count = summary.byStatus[s] ?? 0;
        return (
          <div key={s} className={`card p-3 text-center ${count > 0 ? '' : 'opacity-40'}`}>
            <p className="text-lg">{meta.icon}</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{count}</p>
            <p className="text-xs text-gray-500">{meta.label}</p>
          </div>
        );
      })}
    </div>
  );
}

// ─── My status card ───────────────────────────────────────────────────────────

function MyStatusCard({ me, onChanged }) {
  const [reason, setReason] = useState('');
  const [selected, setSelected] = useState(me.current_status);
  const [loading, setLoading] = useState(false);

  const apply = async () => {
    setLoading(true);
    await fetch(`/api/agent-status/${me.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: selected, reason: reason || undefined }),
    });
    setLoading(false);
    onChanged();
  };

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">My Status</h3>
      <div className="flex items-center gap-3 mb-4">
        <StatusBadge status={me.current_status} />
        {me.current_status_reason && (
          <span className="text-xs text-gray-400 italic">"{me.current_status_reason}"</span>
        )}
      </div>
      <div className="flex gap-2 flex-wrap mb-3">
        {SELF_STATUSES.map((s) => {
          const meta = STATUS_META[s];
          return (
            <button
              key={s}
              onClick={() => setSelected(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selected === s
                  ? `${meta.color} ring-2 ring-offset-1 ring-current`
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {meta.icon} {meta.label}
            </button>
          );
        })}
      </div>
      <input
        className="input w-full text-sm mb-3"
        placeholder="Reason (optional)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <button
        onClick={apply}
        disabled={loading || selected === me.current_status}
        className="btn btn-primary text-sm w-full"
      >
        {loading ? 'Updating…' : 'Update Status'}
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AgentStatusPage() {
  const { agents, summary } = useLoaderData();
  const { user } = useCurrentUser();
  const { revalidate } = useRevalidator();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const t = setInterval(revalidate, 30_000);
    return () => clearInterval(t);
  }, [revalidate]);

  const isManager = ['admin','manager'].includes(user?.role);
  const me = agents.find((a) => a.id === user?.userId);

  const filtered = agents.filter((a) => {
    if (filter !== 'all' && a.current_status !== filter) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <PageHeader
        title="Agent Status Board"
        description="Live availability — auto-refreshes every 30 seconds"
      />

      <div className="p-6 space-y-6">
        <SummaryBar summary={summary} />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main table */}
          <div className="lg:col-span-3 space-y-4">
            {/* Filters */}
            <div className="flex gap-3 flex-wrap items-center">
              <input
                className="input text-sm flex-1 min-w-40"
                placeholder="Search agents…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="input text-sm"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                {Object.entries(STATUS_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>
            </div>

            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Agent</th>
                      <th className="text-left py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Dept / Team</th>
                      <th className="text-left py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="text-left py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Since</th>
                      <th className="text-left py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Schedule</th>
                      <th className="text-center py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Open</th>
                      {isManager && (
                        <th className="text-left py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Set</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan="7" className="text-center py-10 text-gray-400 text-sm">No agents match</td></tr>
                    ) : filtered.map((a) => (
                      <AgentRow
                        key={a.id}
                        agent={a}
                        canManage={isManager && a.id !== user?.userId}
                        onChanged={revalidate}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Sidebar: my status */}
          <div className="space-y-4">
            {me && <MyStatusCard me={me} onChanged={revalidate} />}

            {/* On-call now */}
            {(() => {
              const oncall = agents.filter((a) => a.current_status === 'on_call');
              if (!oncall.length) return null;
              return (
                <div className="card p-4">
                  <h3 className="text-sm font-semibold text-purple-700 mb-3">📟 Currently On Call</h3>
                  <div className="space-y-2">
                    {oncall.map((a) => (
                      <div key={a.id} className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-purple-500 rounded-full" />
                        <div>
                          <p className="text-sm font-medium">{a.name}</p>
                          <p className="text-xs text-gray-400">{a.team_name ?? a.role}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
