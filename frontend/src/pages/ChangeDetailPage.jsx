import { format } from 'date-fns';
import { useState } from 'react';
import { Form, Link, redirect, useFetcher, useLoaderData, useNavigation } from 'react-router-dom';
import { PageHeader } from '../components/layout/Layout';
import { PriorityBadge, StatusBadge } from '../components/ui/Badge';
import { useCurrentUser } from '../context/AuthContext';

// ─── Loader ──────────────────────────────────────────────────────────────────

export async function changeDetailLoader({ params }) {
  const res = await fetch(`/api/changes/${params.id}`, { credentials: 'include' });
  if (!res.ok) throw new Response('Change request not found', { status: res.status });
  return res.json();
}

// ─── Action ──────────────────────────────────────────────────────────────────

export async function changeDetailAction({ request, params }) {
  const formData = await request.formData();
  const intent = formData.get('_intent');

  if (intent === 'submit') {
    const res = await fetch(`/api/changes/${params.id}/submit`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to submit' }));
      return { error: err.error };
    }
    return redirect(`/changes/${params.id}`);
  }

  if (intent === 'approve') {
    const res = await fetch(`/api/changes/${params.id}/approve`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: formData.get('comment') }),
    });
    if (!res.ok) return { error: 'Failed to approve' };
    return redirect(`/changes/${params.id}`);
  }

  if (intent === 'reject') {
    const res = await fetch(`/api/changes/${params.id}/reject`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: formData.get('comment') }),
    });
    if (!res.ok) return { error: 'Failed to reject' };
    return redirect(`/changes/${params.id}`);
  }

  if (intent === 'update_status') {
    await fetch(`/api/changes/${params.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: formData.get('status') }),
    });
    return redirect(`/changes/${params.id}`);
  }

  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  Draft: 'bg-gray-100 text-gray-600',
  Submitted: 'bg-blue-100 text-blue-700',
  Approved: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
  'In Progress': 'bg-purple-100 text-purple-700',
  Completed: 'bg-emerald-100 text-emerald-700',
  Cancelled: 'bg-gray-100 text-gray-400',
};

const RISK_COLORS = {
  Low: 'bg-green-100 text-green-600',
  Medium: 'bg-yellow-100 text-yellow-700',
  High: 'bg-orange-100 text-orange-700',
  Critical: 'bg-red-100 text-red-700',
};

// ─── Approval banner ──────────────────────────────────────────────────────────

function ChangeApprovalBanner({ change, canApprove }) {
  const fetcher = useFetcher();
  const [showForm, setShowForm] = useState(false);
  const [intent, setIntent] = useState(null);
  const busy = fetcher.state !== 'idle';

  if (change.status !== 'Submitted') return null;

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
      <div className="flex items-start gap-3">
        <span className="text-xl mt-0.5">🔔</span>
        <div className="flex-1">
          <p className="font-semibold text-blue-900">Awaiting Approval</p>
          {canApprove ? (
            <p className="mt-0.5 text-sm text-blue-700">
              This change request requires your approval before implementation.
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-blue-700">
              This change request is awaiting manager/admin approval.
            </p>
          )}
          {canApprove && !showForm && (
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  setIntent('approve');
                  setShowForm(true);
                }}
                className="btn btn-primary"
              >
                ✓ Approve
              </button>
              <button
                type="button"
                onClick={() => {
                  setIntent('reject');
                  setShowForm(true);
                }}
                className="btn btn-danger"
              >
                ✗ Reject
              </button>
            </div>
          )}
          {canApprove && showForm && (
            <fetcher.Form method="post" className="mt-4 space-y-3">
              <input type="hidden" name="_intent" value={intent} />
              <textarea
                name="comment"
                rows={2}
                placeholder={
                  intent === 'approve' ? 'Optional approval note…' : 'Reason for rejection…'
                }
                className="w-full resize-none rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className={`btn flex-1 ${intent === 'approve' ? 'btn-primary' : 'btn-danger'}`}
                >
                  {busy
                    ? 'Saving…'
                    : intent === 'approve'
                      ? '✓ Confirm Approval'
                      : '✗ Confirm Rejection'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setIntent(null);
                  }}
                  className="btn btn-ghost"
                >
                  Cancel
                </button>
              </div>
            </fetcher.Form>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ChangeDetailPage() {
  const { change } = useLoaderData();
  const navigation = useNavigation();
  const user = useCurrentUser();
  const busy = navigation.state === 'submitting';

  const canApprove = ['admin', 'manager'].includes(user?.role);
  const isRequester = change.requester_id === user?.userId;
  const canSubmit = change.status === 'Draft' && (isRequester || canApprove);

  const mwStart = change.maintenance_window_start
    ? new Date(change.maintenance_window_start)
    : null;
  const mwEnd = change.maintenance_window_end ? new Date(change.maintenance_window_end) : null;

  return (
    <>
      <PageHeader
        title={`CR #${change.id}`}
        subtitle={change.title}
        actions={
          <div className="flex gap-2">
            {canSubmit && (
              <Form method="post">
                <input type="hidden" name="_intent" value="submit" />
                <button type="submit" disabled={busy} className="btn btn-primary">
                  Submit for Approval
                </button>
              </Form>
            )}
            {canApprove && change.status === 'Approved' && (
              <Form method="post" className="flex gap-2">
                <input type="hidden" name="_intent" value="update_status" />
                <select
                  name="status"
                  onChange={(e) => e.currentTarget.form?.requestSubmit()}
                  className="input text-sm"
                >
                  <option value="Approved">Approved</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </Form>
            )}
            <Link to="/changes" className="btn-ghost">
              ← Back
            </Link>
          </div>
        }
      />

      <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: main content ── */}
        <div className="lg:col-span-2 space-y-6">
          <ChangeApprovalBanner change={change} canApprove={canApprove} />

          {/* Description */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[change.status] || ''}`}
              >
                {change.status}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${RISK_COLORS[change.risk_level] || ''}`}
              >
                {change.risk_level} Risk
              </span>
              <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">
                {change.type}
              </span>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Description</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{change.description}</p>
            </div>
            {change.affected_systems && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Affected Systems</p>
                <p className="text-sm text-gray-700">{change.affected_systems}</p>
              </div>
            )}
            {mwStart && (
              <div className="bg-purple-50 border border-purple-100 rounded-lg p-3">
                <p className="text-xs font-semibold text-purple-700 mb-1">Maintenance Window</p>
                <p className="text-sm text-purple-800">
                  {format(mwStart, 'MMM d, yyyy HH:mm')}
                  {mwEnd && ` → ${format(mwEnd, 'MMM d, yyyy HH:mm')}`}
                </p>
              </div>
            )}
          </div>

          {/* Implementation plan */}
          {change.implementation_plan && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">📋 Implementation Plan</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">
                {change.implementation_plan}
              </p>
            </div>
          )}

          {/* Rollback plan */}
          {change.rollback_plan && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">↩ Rollback Plan</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{change.rollback_plan}</p>
            </div>
          )}

          {/* Approval history */}
          {change.approvals?.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Approval History</h3>
              <div className="space-y-3">
                {change.approvals.map((a) => (
                  <div
                    key={a.id}
                    className={`rounded-lg border p-3 text-sm ${a.status === 'approved' ? 'border-green-100 bg-green-50' : a.status === 'rejected' ? 'border-red-100 bg-red-50' : 'border-gray-100 bg-gray-50'}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`font-medium ${a.status === 'approved' ? 'text-green-700' : a.status === 'rejected' ? 'text-red-700' : 'text-gray-600'}`}
                      >
                        {a.status === 'approved'
                          ? '✓ Approved'
                          : a.status === 'rejected'
                            ? '✗ Rejected'
                            : 'Pending'}
                      </span>
                      {a.approver_name && (
                        <span className="text-gray-500">by {a.approver_name}</span>
                      )}
                      {a.reviewed_at && (
                        <span className="text-gray-400 text-xs">
                          {format(new Date(a.reviewed_at), 'MMM d, HH:mm')}
                        </span>
                      )}
                    </div>
                    {a.comment && <p className="text-gray-600">{a.comment}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Linked tickets */}
          {change.tickets?.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Linked Tickets</h3>
              <div className="space-y-2">
                {change.tickets.map((t) => (
                  <Link
                    key={t.id}
                    to={`/tickets/${t.id}`}
                    className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm hover:border-blue-200 hover:bg-blue-50 transition"
                  >
                    <span className="text-gray-400 text-xs">#{t.id}</span>
                    <StatusBadge status={t.status} />
                    <PriorityBadge priority={t.priority} />
                    <span className="font-medium text-gray-800">{t.title}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
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
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[change.status] || ''}`}
                  >
                    {change.status}
                  </span>
                ),
              },
              { label: 'Type', value: change.type },
              {
                label: 'Risk Level',
                value: (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${RISK_COLORS[change.risk_level] || ''}`}
                  >
                    {change.risk_level}
                  </span>
                ),
              },
              { label: 'Requester', value: change.requester_name || '—' },
              { label: 'Created', value: format(new Date(change.created_at), 'MMM d, yyyy') },
              { label: 'Updated', value: format(new Date(change.updated_at), 'MMM d, yyyy') },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between gap-2">
                <span className="text-xs text-gray-500 shrink-0">{label}</span>
                <span className="text-xs text-gray-800 text-right font-medium">{value}</span>
              </div>
            ))}
          </div>

          {change.status === 'Submitted' && canApprove && (
            <div className="card p-4 border-blue-100 bg-blue-50">
              <p className="text-xs font-semibold text-blue-800">Approval Required</p>
              <p className="text-xs text-blue-700 mt-1">
                Review the implementation and rollback plans before approving.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
