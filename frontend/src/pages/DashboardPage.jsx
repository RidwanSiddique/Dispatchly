import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Link, useLoaderData } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { PageHeader } from '../components/layout/Layout';
import { PriorityBadge, StatusBadge } from '../components/ui/Badge';
import { REQUESTER_ROLES, useCurrentUser } from '../context/AuthContext';

// ─── Loader ──────────────────────────────────────────────────────────────────

export async function dashboardLoader() {
  const res = await fetch('/api/dashboard', { credentials: 'include' });
  if (!res.ok) throw new Response('Failed to load dashboard', { status: res.status });
  return res.json();
}

// ─── Colour palette ───────────────────────────────────────────────────────────

const PRIORITY_COLORS = { P1: '#dc2626', P2: '#ea580c', P3: '#2563eb', P4: '#16a34a' };
const SLA_COLORS = { 'On Track': '#16a34a', 'At Risk': '#d97706', Breached: '#dc2626' };
const STATUS_COLORS = {
  Open: '#2563eb', 'In Progress': '#7c3aed', Escalated: '#dc2626',
  Resolved: '#16a34a', Closed: '#6b7280', 'Pending Approval': '#d97706',
};
const CHART_LINES = ['#2563eb', '#16a34a', '#ea580c', '#7c3aed', '#0891b2'];

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, colorClass = 'text-gray-900', icon }) {
  return (
    <div className="card p-5 flex items-start gap-3">
      {icon && <span className="text-2xl leading-none">{icon}</span>}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-500 font-medium truncate">{label}</p>
        <p className={`mt-1 text-3xl font-bold tabular-nums ${colorClass}`}>{value}</p>
        {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Mini bar ─────────────────────────────────────────────────────────────────

function MiniBar({ label, count, total, colorClass = 'bg-blue-500' }) {
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

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children, className = '' }) {
  return (
    <div className={`card p-5 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">{title}</h3>
      {children}
    </div>
  );
}

// ─── Custom tooltip for recharts ─────────────────────────────────────────────

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Minutes → human readable ─────────────────────────────────────────────────

function fmtMins(mins) {
  if (mins == null) return '—';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── Analytics hook ───────────────────────────────────────────────────────────

function useAnalytics(period) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/dashboard/analytics?period=${period}`, { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load analytics');
        return r.json();
      })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [period]);

  return { data, loading, error };
}

// ─── SLA donut ────────────────────────────────────────────────────────────────

function SlaDonut({ sla }) {
  if (!sla) return null;
  const slices = [
    { name: 'On Track', value: sla.onTrack },
    { name: 'At Risk', value: sla.atRisk },
    { name: 'Breached', value: sla.breached },
  ].filter((s) => s.value > 0);

  if (!slices.length) {
    return <p className="text-gray-400 text-sm text-center py-8">No open tickets</p>;
  }

  return (
    <div className="flex flex-col items-center">
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={slices}
            cx="50%" cy="50%"
            innerRadius={52} outerRadius={78}
            dataKey="value"
            strokeWidth={2}
          >
            {slices.map((s) => (
              <Cell key={s.name} fill={SLA_COLORS[s.name] || '#6b7280'} />
            ))}
          </Pie>
          <Tooltip formatter={(v, n) => [`${v} tickets`, n]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="w-full mt-2 space-y-1">
        {slices.map((s) => (
          <div key={s.name} className="flex items-center gap-2 text-xs">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: SLA_COLORS[s.name] }}
            />
            <span className="text-gray-600 flex-1">{s.name}</span>
            <span className="font-semibold text-gray-900">{s.value}</span>
            <span className="text-gray-400">
              ({sla.total > 0 ? Math.round((s.value / sla.total) * 100) : 0}%)
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-gray-400">
        Compliance rate:{' '}
        <span className={`font-bold ${sla.complianceRate >= 90 ? 'text-green-600' : sla.complianceRate >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
          {sla.complianceRate}%
        </span>
      </p>
    </div>
  );
}

// ─── Staff analytics panel ────────────────────────────────────────────────────

function StaffAnalytics({ baseData }) {
  const [period, setPeriod] = useState(30);
  const { data: analytics, loading, error } = useAnalytics(period);

  const PERIODS = [7, 14, 30, 60, 90];

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Period:</span>
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              period === p
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p}d
          </button>
        ))}
      </div>

      {/* Top stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Tickets"
          value={baseData.totals.total}
          sub={`${baseData.totals.open} open · ${baseData.totals.resolved} resolved`}
          icon="🎫"
        />
        <StatCard
          label="SLA Compliance"
          value={`${baseData.sla.complianceRate}%`}
          sub={`${baseData.sla.breached} breached · ${baseData.sla.atRisk} at risk`}
          colorClass={
            baseData.sla.complianceRate >= 90
              ? 'text-green-600'
              : baseData.sla.complianceRate >= 70
              ? 'text-yellow-600'
              : 'text-red-600'
          }
          icon="📊"
        />
        <StatCard
          label="Avg Resolution Time"
          value={fmtMins(baseData.avgResolutionMinutes)}
          sub="Last 30 days"
          icon="⏱️"
        />
        <StatCard
          label="Avg First Response"
          value={fmtMins(analytics?.summary?.avgFirstResponseMinutes)}
          sub={`Last ${period} days`}
          icon="💬"
        />
      </div>

      {/* Alert counts */}
      {analytics?.summary && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label="Overdue Tickets"
            value={analytics.summary.overdueTickets}
            colorClass={analytics.summary.overdueTickets > 0 ? 'text-red-600' : 'text-green-600'}
            icon="🔴"
          />
          <StatCard
            label="Escalated"
            value={analytics.summary.escalatedTickets}
            colorClass={analytics.summary.escalatedTickets > 0 ? 'text-purple-600' : 'text-gray-900'}
            icon="🔺"
          />
          <StatCard
            label="Pending Approval"
            value={analytics.summary.pendingApprovals}
            colorClass={analytics.summary.pendingApprovals > 0 ? 'text-yellow-600' : 'text-gray-900'}
            icon="✅"
          />
        </div>
      )}

      {loading && (
        <div className="card p-8 text-center text-gray-400 text-sm animate-pulse">
          Loading analytics…
        </div>
      )}
      {error && (
        <div className="card p-4 text-red-600 text-sm">Analytics error: {error}</div>
      )}

      {analytics && !loading && (
        <>
          {/* Volume trend + SLA donut */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Section title={`Ticket Volume — last ${period} days`} className="lg:col-span-2">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={analytics.volumeTrend} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    tickFormatter={(d) => {
                      const dt = new Date(d);
                      return `${dt.getMonth() + 1}/${dt.getDate()}`;
                    }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="created" name="Created" stroke="#2563eb" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#16a34a" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            </Section>

            <Section title="SLA Health (Open Tickets)">
              <SlaDonut sla={baseData.sla} />
            </Section>
          </div>

          {/* SLA compliance by priority + MTTR trend */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Section title={`SLA Compliance by Priority — last ${period} days`}>
              {analytics.slaComplianceByPriority.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No resolved tickets in this period</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={analytics.slaComplianceByPriority}
                    margin={{ top: 4, right: 16, left: -16, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="priority" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} domain={[0, 100]} unit="%" />
                    <Tooltip
                      formatter={(v, n, p) => [
                        `${v}% (${p.payload.met}/${p.payload.total} met)`,
                        'Compliance',
                      ]}
                    />
                    <Bar dataKey="rate" name="Compliance %" radius={[4, 4, 0, 0]}>
                      {analytics.slaComplianceByPriority.map((e) => (
                        <Cell
                          key={e.priority}
                          fill={e.rate >= 90 ? '#16a34a' : e.rate >= 70 ? '#d97706' : '#dc2626'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Section>

            <Section title={`MTTR Trend (minutes) — last ${period} days`}>
              {analytics.mttrTrend.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No data for this period</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart
                    data={analytics.mttrTrend}
                    margin={{ top: 4, right: 16, left: -16, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="week"
                      tick={{ fontSize: 10, fill: '#9ca3af' }}
                      tickFormatter={(d) => {
                        const dt = new Date(d);
                        return `${dt.getMonth() + 1}/${dt.getDate()}`;
                      }}
                    />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                    <Tooltip formatter={(v) => [`${fmtMins(v)}`, 'Avg Resolution']} />
                    <Line
                      type="monotone"
                      dataKey="avgMinutes"
                      name="MTTR"
                      stroke="#7c3aed"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#7c3aed' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Section>
          </div>

          {/* Category performance */}
          <Section title={`Category Breakdown — last ${period} days`}>
            {analytics.categoryPerformance.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={analytics.categoryPerformance}
                  margin={{ top: 4, right: 16, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="category" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="total" name="Created" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="resolved" name="Resolved" fill="#16a34a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Section>

          {/* Agent performance table */}
          {analytics.agentPerformance.length > 0 && (
            <Section title={`Agent Performance — last ${period} days`}>
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Agent</th>
                      <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                      <th className="text-right py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Assigned</th>
                      <th className="text-right py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Resolved</th>
                      <th className="text-right py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Avg Resolution</th>
                      <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">SLA Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.agentPerformance.map((a) => (
                      <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 pr-4 font-medium text-gray-900">{a.name}</td>
                        <td className="py-2 pr-4 text-gray-500 capitalize">{a.role}</td>
                        <td className="py-2 pr-4 text-right tabular-nums text-gray-700">{a.assigned}</td>
                        <td className="py-2 pr-4 text-right tabular-nums text-gray-700">{a.resolved}</td>
                        <td className="py-2 pr-4 text-right tabular-nums text-gray-500">{fmtMins(a.avgResolutionMinutes)}</td>
                        <td className="py-2 text-right">
                          {a.slaRate != null ? (
                            <span className={`font-semibold ${
                              a.slaRate >= 90 ? 'text-green-600' : a.slaRate >= 70 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {a.slaRate}%
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Multi-SLA summary */}
          {analytics.multiSlaSummary.length > 0 && (
            <Section title="SLA / OLA / UC Summary">
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="text-right py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                      <th className="text-right py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Active</th>
                      <th className="text-right py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Met</th>
                      <th className="text-right py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Breached</th>
                      <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Compliance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.multiSlaSummary.map((s) => (
                      <tr key={s.name} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 pr-4 font-medium text-gray-900">{s.name}</td>
                        <td className="py-2 pr-4">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            s.type === 'SLA' ? 'bg-blue-100 text-blue-700' :
                            s.type === 'OLA' ? 'bg-purple-100 text-purple-700' :
                            'bg-orange-100 text-orange-700'
                          }`}>{s.type}</span>
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums text-gray-700">{s.total}</td>
                        <td className="py-2 pr-4 text-right tabular-nums text-blue-600">{s.active}</td>
                        <td className="py-2 pr-4 text-right tabular-nums text-green-600">{s.met}</td>
                        <td className="py-2 pr-4 text-right tabular-nums text-red-600">{s.breached}</td>
                        <td className="py-2 text-right">
                          {s.complianceRate != null ? (
                            <span className={`font-semibold ${
                              s.complianceRate >= 90 ? 'text-green-600' : s.complianceRate >= 70 ? 'text-yellow-600' : 'text-red-600'
                            }`}>{s.complianceRate}%</span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}
        </>
      )}

      {/* Recent tickets */}
      <Section title="Recent Tickets">
        <RecentTickets tickets={baseData.recentTickets} />
      </Section>

      {/* By status & priority */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="By Priority (Open)">
          <div className="space-y-3">
            {['P1', 'P2', 'P3', 'P4'].map((p) => {
              const entry = baseData.byPriority.find((e) => e.priority === p);
              const total = baseData.byPriority.reduce((s, e) => s + e.count, 0);
              return (
                <MiniBar
                  key={p}
                  label={p}
                  count={entry?.count ?? 0}
                  total={total}
                  colorClass={
                    p === 'P1' ? 'bg-red-500' :
                    p === 'P2' ? 'bg-orange-500' :
                    p === 'P3' ? 'bg-blue-500' : 'bg-green-500'
                  }
                />
              );
            })}
          </div>
        </Section>

        <Section title="By Status">
          <div className="space-y-3">
            {baseData.byStatus.map((e) => (
              <MiniBar
                key={e.status}
                label={e.status}
                count={e.count}
                total={baseData.totals.total}
                colorClass="bg-blue-500"
              />
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

// ─── Recent tickets list ──────────────────────────────────────────────────────

function RecentTickets({ tickets }) {
  if (!tickets?.length) {
    return <p className="text-gray-400 text-sm text-center py-6">No tickets yet</p>;
  }
  return (
    <div className="space-y-2">
      {tickets.map((t) => (
        <Link
          key={t.id}
          to={`/tickets/${t.id}`}
          className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600">
              #{t.id} {t.title}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <PriorityBadge priority={t.priority} />
            <StatusBadge status={t.status} />
          </div>
        </Link>
      ))}
    </div>
  );
}

// ─── Requester dashboard (simplified) ────────────────────────────────────────

function RequesterDashboard({ data }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard label="My Tickets" value={data.totals.total} icon="🎫" />
        <StatCard label="Open" value={data.totals.open} colorClass="text-blue-600" icon="📂" />
        <StatCard label="Resolved" value={data.totals.resolved} colorClass="text-green-600" icon="✅" />
      </div>
      <Section title="By Status">
        <div className="space-y-3">
          {data.byStatus.map((e) => (
            <MiniBar key={e.status} label={e.status} count={e.count} total={data.totals.total} />
          ))}
        </div>
      </Section>
      <Section title="Recent Tickets">
        <RecentTickets tickets={data.recentTickets} />
      </Section>
    </div>
  );
}

// ─── Technician dashboard ────────────────────────────────────────────────────

function TechnicianDashboard({ data }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Assigned to Me" value={data.totals.total} icon="👤" />
        <StatCard label="Open" value={data.totals.open} colorClass="text-blue-600" icon="📂" />
        <StatCard label="Resolved" value={data.totals.resolved} colorClass="text-green-600" icon="✅" />
        <StatCard
          label="SLA Breached"
          value={data.sla.breached}
          colorClass={data.sla.breached > 0 ? 'text-red-600' : 'text-gray-900'}
          icon="🚨"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Section title="By Priority">
          <div className="space-y-3">
            {['P1', 'P2', 'P3', 'P4'].map((p) => {
              const e = data.byPriority.find((x) => x.priority === p);
              const total = data.byPriority.reduce((s, x) => s + x.count, 0);
              return (
                <MiniBar
                  key={p}
                  label={p}
                  count={e?.count ?? 0}
                  total={total}
                  colorClass={p === 'P1' ? 'bg-red-500' : p === 'P2' ? 'bg-orange-500' : p === 'P3' ? 'bg-blue-500' : 'bg-green-500'}
                />
              );
            })}
          </div>
        </Section>
        <Section title="SLA Health">
          <SlaDonut sla={data.sla} />
        </Section>
      </div>
      <Section title="Recent Tickets">
        <RecentTickets tickets={data.recentTickets} />
      </Section>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const data = useLoaderData();
  const { user } = useCurrentUser();
  const role = user?.role ?? data.viewAs;

  const isRequester = REQUESTER_ROLES.includes(role);
  const isTechnician = role === 'technician';

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={
          isRequester
            ? 'Your submitted tickets'
            : isTechnician
            ? 'Tickets assigned to you'
            : 'Service desk overview & analytics'
        }
      />

      <div className="p-6">
        {isRequester ? (
          <RequesterDashboard data={data} />
        ) : isTechnician ? (
          <TechnicianDashboard data={data} />
        ) : (
          <StaffAnalytics baseData={data} />
        )}
      </div>
    </div>
  );
}
