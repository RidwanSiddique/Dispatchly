import { format } from 'date-fns';
import { useState } from 'react';
import { Form, Link, redirect, useFetcher, useLoaderData, useNavigation } from 'react-router-dom';
import { PageHeader } from '../components/layout/Layout';
import { PriorityBadge, StatusBadge } from '../components/ui/Badge';
import { useCurrentUser } from '../context/AuthContext';

// ─── Loader ──────────────────────────────────────────────────────────────────

export async function problemDetailLoader({ params }) {
  const [problemRes, staffRes] = await Promise.all([
    fetch(`/api/problems/${params.id}`, { credentials: 'include' }),
    fetch('/api/users/staff', { credentials: 'include' }),
  ]);
  if (!problemRes.ok) throw new Response('Problem not found', { status: problemRes.status });
  const { problem } = await problemRes.json();
  const staff = staffRes.ok ? await staffRes.json() : [];
  return { problem, staff };
}

// ─── Action ──────────────────────────────────────────────────────────────────

export async function problemDetailAction({ request, params }) {
  const formData = await request.formData();
  const intent = formData.get('_intent');

  if (intent === 'update') {
    const body = {};
    for (const [k, v] of formData.entries()) {
      if (k !== '_intent' && v !== '') body[k] = v;
    }
    await fetch(`/api/problems/${params.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return redirect(`/problems/${params.id}`);
  }

  if (intent === 'link_tickets') {
    const raw = formData.get('ticket_ids') || '';
    const ticket_ids = raw
      .split(',')
      .map((s) => Number(s.trim()))
      .filter(Boolean);
    if (ticket_ids.length === 0) return { error: 'Enter at least one ticket ID' };
    const res = await fetch(`/api/problems/${params.id}/link`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket_ids }),
    });
    if (!res.ok) return { error: 'Failed to link tickets' };
    return redirect(`/problems/${params.id}`);
  }

  if (intent === 'unlink_ticket') {
    await fetch(`/api/problems/${params.id}/tickets/${formData.get('ticket_id')}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return redirect(`/problems/${params.id}`);
  }

  if (intent === 'resolve') {
    const res = await fetch(`/api/problems/${params.id}/resolve`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution: formData.get('resolution') }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to resolve' }));
      return { error: err.error };
    }
    return redirect(`/problems/${params.id}`);
  }

  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  Open: 'bg-red-100 text-red-700',
  'In Investigation': 'bg-orange-100 text-orange-700',
  'Known Error': 'bg-yellow-100 text-yellow-700',
  Resolved: 'bg-green-100 text-green-700',
  Closed: 'bg-gray-100 text-gray-500',
};

const PROBLEM_STATUSES = ['Open', 'In Investigation', 'Known Error', 'Resolved', 'Closed'];

// ─── Resolve modal ────────────────────────────────────────────────────────────

function ResolveModal({ problem, linkedCount, onClose }) {
  const fetcher = useFetcher();
  const busy = fetcher.state !== 'idle';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Resolve Problem</h2>
        <p className="text-sm text-gray-500 mb-4">
          This will also auto-resolve {linkedCount} linked ticket{linkedCount !== 1 ? 's' : ''}.
        </p>
        <fetcher.Form method="post" className="space-y-4">
          <input type="hidden" name="_intent" value="resolve" />
          <textarea
            name="resolution"
            rows={3}
            required
            className="input w-full resize-y"
            placeholder="Describe the root cause fix and resolution…"
          />
          {fetcher.data?.error && <p className="text-sm text-red-600">{fetcher.data.error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="btn btn-primary">
              {busy ? 'Resolving…' : 'Resolve & Close Tickets'}
            </button>
          </div>
        </fetcher.Form>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProblemDetailPage() {
  const { problem, staff } = useLoaderData();
  const navigation = useNavigation();
  const user = useCurrentUser();
  const canManage = ['admin', 'manager', 'agent'].includes(user?.role);
  const canResolve = ['admin', 'manager'].includes(user?.role);
  const [showResolve, setShowResolve] = useState(false);
  const busy = navigation.state === 'submitting';

  const assignable = staff.filter((u) =>
    ['technician', 'agent', 'specialist', 'manager'].includes(u.role)
  );
  const isResolved = ['Resolved', 'Closed'].includes(problem.status);
  const openLinked =
    problem.tickets?.filter((t) => !['Resolved', 'Closed'].includes(t.status)) ?? [];

  return (
    <>
      <PageHeader
        title={`Problem #${problem.id}`}
        subtitle={problem.title}
        actions={
          <div className="flex gap-2">
            {canResolve && !isResolved && (
              <button type="button" onClick={() => setShowResolve(true)} className="btn-primary">
                ✓ Resolve Problem
              </button>
            )}
            <Link to="/problems" className="btn-ghost">
              ← Back
            </Link>
          </div>
        }
      />

      <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: description + fields ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overview */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[problem.status] || STATUS_COLORS.Open}`}
              >
                {problem.status}
              </span>
              {problem.created_by_name && (
                <span className="text-xs text-gray-400">by {problem.created_by_name}</span>
              )}
              <span className="text-xs text-gray-400">
                {format(new Date(problem.created_at), 'MMM d, yyyy')}
              </span>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Description</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{problem.description}</p>
            </div>

            {problem.root_cause && (
              <div className="bg-red-50 border border-red-100 rounded-lg p-4">
                <p className="text-xs font-semibold text-red-700 mb-1">Root Cause</p>
                <p className="text-sm text-red-800">{problem.root_cause}</p>
              </div>
            )}

            {problem.workaround && (
              <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-4">
                <p className="text-xs font-semibold text-yellow-700 mb-1">Workaround</p>
                <p className="text-sm text-yellow-800">{problem.workaround}</p>
              </div>
            )}

            {problem.resolution && (
              <div className="bg-green-50 border border-green-100 rounded-lg p-4">
                <p className="text-xs font-semibold text-green-700 mb-1">Resolution</p>
                <p className="text-sm text-green-800">{problem.resolution}</p>
              </div>
            )}
          </div>

          {/* Edit fields */}
          {canManage && !isResolved && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Update Problem</h3>
              <Form method="post" className="space-y-4">
                <input type="hidden" name="_intent" value="update" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Status</label>
                    <select name="status" defaultValue={problem.status} className="input w-full">
                      {PROBLEM_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Assigned To</label>
                    <select
                      name="assigned_to_user_id"
                      defaultValue={problem.assigned_to_user_id || ''}
                      className="input w-full"
                    >
                      <option value="">— Unassigned —</option>
                      {assignable.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">Root Cause</label>
                  <textarea
                    name="root_cause"
                    rows={2}
                    defaultValue={problem.root_cause || ''}
                    className="input w-full resize-y"
                    placeholder="Identified root cause…"
                  />
                </div>
                <div>
                  <label className="label">Workaround</label>
                  <textarea
                    name="workaround"
                    rows={2}
                    defaultValue={problem.workaround || ''}
                    className="input w-full resize-y"
                    placeholder="Temporary workaround for users…"
                  />
                </div>
                <div className="flex justify-end">
                  <button type="submit" disabled={busy} className="btn btn-primary">
                    {busy ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </Form>
            </div>
          )}

          {/* Linked tickets */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">
                Linked Tickets
                {problem.tickets?.length > 0 && (
                  <span className="ml-1 text-gray-400 font-normal">({problem.tickets.length})</span>
                )}
              </h3>
            </div>

            {canManage && !isResolved && (
              <Form method="post" className="flex gap-2 mb-4">
                <input type="hidden" name="_intent" value="link_tickets" />
                <input
                  name="ticket_ids"
                  className="input flex-1"
                  placeholder="Ticket IDs, comma-separated (e.g. 12,45,67)"
                />
                <button type="submit" disabled={busy} className="btn btn-primary whitespace-nowrap">
                  Link
                </button>
              </Form>
            )}

            {!problem.tickets?.length ? (
              <p className="text-sm text-gray-400">No tickets linked yet.</p>
            ) : (
              <div className="space-y-2">
                {problem.tickets.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                  >
                    <Link
                      to={`/tickets/${t.id}`}
                      className="flex-1 flex items-center gap-2 text-sm hover:text-blue-600"
                    >
                      <span className="text-gray-400 text-xs">#{t.id}</span>
                      <StatusBadge status={t.status} />
                      <PriorityBadge priority={t.priority} />
                      <span className="font-medium text-gray-800">{t.title}</span>
                    </Link>
                    {canManage && !isResolved && (
                      <Form method="post">
                        <input type="hidden" name="_intent" value="unlink_ticket" />
                        <input type="hidden" name="ticket_id" value={t.id} />
                        <button type="submit" className="text-xs text-red-400 hover:text-red-600">
                          ✕
                        </button>
                      </Form>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div className="space-y-5">
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Details</h3>
            {[
              {
                label: 'Status',
                value: (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[problem.status] || ''}`}
                  >
                    {problem.status}
                  </span>
                ),
              },
              { label: 'Assigned To', value: problem.assigned_to_name || '—' },
              { label: 'Created By', value: problem.created_by_name || '—' },
              { label: 'Linked Tickets', value: `${problem.tickets?.length || 0} tickets` },
              { label: 'Open Tickets', value: openLinked.length },
              { label: 'Created', value: format(new Date(problem.created_at), 'MMM d, yyyy') },
              ...(problem.resolved_at
                ? [
                    {
                      label: 'Resolved',
                      value: format(new Date(problem.resolved_at), 'MMM d, yyyy'),
                    },
                  ]
                : []),
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between gap-2">
                <span className="text-xs text-gray-500 shrink-0">{label}</span>
                <span className="text-xs text-gray-800 text-right font-medium">{value}</span>
              </div>
            ))}
          </div>

          {openLinked.length > 0 && !isResolved && canResolve && (
            <div className="card p-4 border-orange-100 bg-orange-50">
              <p className="text-xs font-semibold text-orange-800 mb-1">
                {openLinked.length} open ticket{openLinked.length !== 1 ? 's' : ''} will be
                auto-resolved
              </p>
              <p className="text-xs text-orange-700">
                Resolving this problem will close all linked open tickets.
              </p>
            </div>
          )}
        </div>
      </div>

      {showResolve && (
        <ResolveModal
          problem={problem}
          linkedCount={openLinked.length}
          onClose={() => setShowResolve(false)}
        />
      )}
    </>
  );
}
