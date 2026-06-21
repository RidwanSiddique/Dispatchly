import { format, formatDistanceToNow } from 'date-fns';
import { useEffect, useRef, useState } from 'react';
import { Link, useFetcher, useLoaderData } from 'react-router-dom';
import { PageHeader } from '../components/layout/Layout';
import { PriorityBadge, SlaBadge, StatusBadge, TypeBadge } from '../components/ui/Badge';
import { SlaBar } from '../components/ui/SlaBar';
import {
  CAN_CONVERT_KB,
  CAN_ESCALATE,
  CAN_RESOLVE,
  REQUESTER_ROLES,
  useCurrentUser,
} from '../context/AuthContext';

// ─── Loader ──────────────────────────────────────────────────────────────────

export async function ticketDetailLoader({ params }) {
  const res = await fetch(`/api/tickets/${params.id}`, { credentials: 'include' });
  if (!res.ok) throw new Response('Ticket not found', { status: res.status });
  return res.json();
}

// ─── Action — intent-based mutations ─────────────────────────────────────────
// All mutations on this page POST here with a hidden _intent field.
// React Router re-runs the loader automatically after any action succeeds.

export async function ticketDetailAction({ request, params }) {
  const formData = await request.formData();
  const intent = formData.get('_intent');

  const json = (data) =>
    fetch(`/api/tickets/${params.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

  switch (intent) {
    case 'escalate': {
      const res = await fetch(`/api/tickets/${params.id}/escalate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: formData.get('reason'),
          escalated_to_team: formData.get('escalated_to_team'),
        }),
      });
      const result = await res.json();
      return res.ok ? { ok: true, intent } : { error: result.error, intent };
    }

    case 'resolve': {
      await json({
        status: 'Resolved',
        resolution_notes: formData.get('resolution_notes'),
      });
      if (formData.get('convert_to_kb') === 'true') {
        await fetch(`/api/tickets/${params.id}/convert-to-kb`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: formData.get('kb_title'),
            symptoms: formData.get('kb_symptoms'),
            resolution_steps: formData.get('kb_steps'),
          }),
        });
      }
      return { ok: true, intent };
    }

    case 'close':
      await json({ status: 'Closed' });
      return { ok: true, intent };

    case 'comment': {
      const res = await fetch(`/api/tickets/${params.id}/comments`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: formData.get('body') }),
      });
      return res.ok ? { ok: true, intent } : { error: 'Failed to post comment', intent };
    }

    default:
      return { error: 'Unknown intent' };
  }
}

// ─── Escalate modal ───────────────────────────────────────────────────────────

function EscalateModal({ ticket, onClose }) {
  const fetcher = useFetcher();
  const busy = fetcher.state !== 'idle';

  useEffect(() => {
    if (fetcher.data?.ok && fetcher.data?.intent === 'escalate') onClose();
  }, [fetcher.data, onClose]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Escalate to Tier 2</h2>
        <p className="text-sm text-gray-500 mb-4">Status will change to Escalated.</p>
        <fetcher.Form method="post" className="space-y-4">
          <input type="hidden" name="_intent" value="escalate" />
          <div>
            <label className="label">Escalate To</label>
            <input
              className="input"
              name="escalated_to_team"
              defaultValue={ticket.suggestedEscalationTeam ?? ''}
              placeholder="Team or individual name"
            />
          </div>
          <div>
            <label className="label">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              className="input min-h-[100px] resize-y"
              name="reason"
              required
              placeholder="What was tried and why Tier 2 is needed…"
            />
          </div>
          {fetcher.data?.error && <p className="text-sm text-red-600">{fetcher.data.error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="btn-danger">
              {busy ? 'Escalating…' : 'Escalate Ticket'}
            </button>
          </div>
        </fetcher.Form>
      </div>
    </div>
  );
}

// ─── Resolve modal ────────────────────────────────────────────────────────────

function ResolveModal({ ticket, onClose }) {
  const fetcher = useFetcher();
  const busy = fetcher.state !== 'idle';
  const [convertKb, setConvertKb] = useState(false);

  useEffect(() => {
    if (fetcher.data?.ok && fetcher.data?.intent === 'resolve') onClose();
  }, [fetcher.data, onClose]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="card w-full max-w-lg p-6 my-8">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Resolve Ticket</h2>
        <fetcher.Form method="post" className="space-y-4">
          <input type="hidden" name="_intent" value="resolve" />
          {convertKb && <input type="hidden" name="convert_to_kb" value="true" />}

          <div>
            <label className="label">
              Resolution Notes <span className="text-red-500">*</span>
            </label>
            <textarea
              className="input min-h-[100px] resize-y"
              name="resolution_notes"
              required
              placeholder="What was done to resolve this issue?"
            />
          </div>

          <label className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
            <input
              type="checkbox"
              checked={convertKb}
              onChange={(e) => setConvertKb(e.target.checked)}
              className="w-4 h-4 accent-blue-600"
            />
            <div>
              <span className="text-sm font-medium text-blue-800">Convert to KB Article</span>
              <p className="text-xs text-blue-600">Publish this resolution to the Knowledge Base</p>
            </div>
          </label>

          {convertKb && (
            <div className="space-y-3 bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div>
                <label className="label">Article Title</label>
                <input className="input" name="kb_title" defaultValue={ticket.title} />
              </div>
              <div>
                <label className="label">Symptoms</label>
                <textarea
                  className="input min-h-[80px] resize-y"
                  name="kb_symptoms"
                  defaultValue={ticket.description}
                />
              </div>
              <div>
                <label className="label">Resolution Steps</label>
                <textarea className="input min-h-[80px] resize-y" name="kb_steps" />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? 'Saving…' : 'Mark Resolved'}
            </button>
          </div>
        </fetcher.Form>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function TicketDetailPage() {
  const ticket = useLoaderData();
  const closeFetcher = useFetcher();
  const commentFetcher = useFetcher();
  const commentRef = useRef(null);
  const user = useCurrentUser();
  const role = user?.role ?? 'client';

  const [showEscalate, setShowEscalate] = useState(false);
  const [showResolve, setShowResolve] = useState(false);

  // Clear comment textarea after successful post
  useEffect(() => {
    if (commentFetcher.data?.ok && commentFetcher.data?.intent === 'comment') {
      if (commentRef.current) commentRef.current.value = '';
    }
  }, [commentFetcher.data]);

  const isResolved = ['Resolved', 'Closed'].includes(ticket.status);

  // Role-based action permissions
  const userCanEscalate =
    (role === 'admin' || CAN_ESCALATE.includes(role)) &&
    !['Escalated', 'Resolved', 'Closed'].includes(ticket.status);
  const userCanResolve =
    (role === 'admin' || CAN_RESOLVE.includes(role)) &&
    !['Resolved', 'Closed'].includes(ticket.status);
  const userCanClose =
    (role === 'admin' || CAN_RESOLVE.includes(role)) && ticket.status === 'Resolved';
  const isRequester = REQUESTER_ROLES.includes(role);

  // Legacy aliases used in JSX below
  const canEscalate = userCanEscalate;
  const canResolve = userCanResolve;

  return (
    <div>
      <PageHeader
        title={`Ticket #${ticket.id}`}
        subtitle={ticket.title}
        actions={
          <div className="flex items-center gap-2">
            {canEscalate && (
              <button onClick={() => setShowEscalate(true)} className="btn-secondary">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                  />
                </svg>
                Escalate
              </button>
            )}
            {canResolve && (
              <button onClick={() => setShowResolve(true)} className="btn-primary">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Resolve
              </button>
            )}
            {userCanClose && (
              <closeFetcher.Form method="post">
                <input type="hidden" name="_intent" value="close" />
                <button
                  type="submit"
                  className="btn btn-secondary"
                  disabled={closeFetcher.state !== 'idle'}
                >
                  Close Ticket
                </button>
              </closeFetcher.Form>
            )}
            <Link to="/tickets" className="btn-ghost">
              ← Back
            </Link>
          </div>
        }
      />

      <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: body + escalations + comments ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Body card */}
          <div className="card p-5">
            <div className="flex items-start gap-3 flex-wrap mb-4">
              <PriorityBadge priority={ticket.priority} />
              <StatusBadge status={ticket.status} />
              <TypeBadge type={ticket.type} />
              <SlaBadge sla={ticket.sla} />
            </div>

            {!isResolved && ticket.sla && (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>SLA — {ticket.sla.status}</span>
                  <span>
                    {ticket.sla.minutesRemaining >= 0
                      ? `${ticket.sla.minutesRemaining}m remaining`
                      : `${Math.abs(ticket.sla.minutesRemaining)}m overdue`}
                  </span>
                </div>
                <SlaBar sla={ticket.sla} />
              </div>
            )}

            <h2 className="text-base font-semibold text-gray-900 mb-2">{ticket.title}</h2>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{ticket.description}</p>

            {ticket.resolution_notes && (
              <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <p className="text-xs font-semibold text-emerald-700 mb-1">Resolution</p>
                <p className="text-sm text-emerald-800 whitespace-pre-wrap">
                  {ticket.resolution_notes}
                </p>
              </div>
            )}

            {ticket.kbArticle && (
              <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-center gap-3">
                <svg
                  className="w-4 h-4 text-blue-500 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
                <span className="text-sm text-blue-700 flex-1">
                  KB Article: <strong>{ticket.kbArticle.title}</strong>
                </span>
                <Link
                  to={`/kb/${ticket.kbArticle.id}`}
                  className="text-xs text-blue-600 font-medium hover:underline"
                >
                  View →
                </Link>
              </div>
            )}
          </div>

          {/* Escalations */}
          {ticket.escalations?.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Escalation History</h3>
              <div className="space-y-3">
                {ticket.escalations.map((e) => (
                  <div key={e.id} className="bg-purple-50 border border-purple-100 rounded-lg p-4">
                    <div className="flex items-center justify-between text-xs text-purple-600 mb-1">
                      <span className="font-medium">
                        {e.escalated_by} → {e.escalated_to_team}
                      </span>
                      <span>{format(new Date(e.escalated_at), 'MMM d, HH:mm')}</span>
                    </div>
                    <p className="text-sm text-purple-900">{e.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              Activity
              {ticket.comments?.length > 0 && (
                <span className="text-gray-400 font-normal ml-1">({ticket.comments.length})</span>
              )}
            </h3>

            <div className="space-y-4 mb-5">
              {ticket.comments?.length === 0 && (
                <p className="text-sm text-gray-400">No activity yet.</p>
              )}
              {ticket.comments?.map((c) => (
                <div key={c.id} className={`flex gap-3 ${c.is_internal ? 'opacity-70' : ''}`}>
                  <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center text-xs font-semibold text-gray-600 shrink-0 mt-0.5">
                    {c.author.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-700">{c.author}</span>
                      {c.is_internal && (
                        <span className="badge bg-gray-100 text-gray-500">Internal</span>
                      )}
                      <span className="text-xs text-gray-400">
                        {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
                      {c.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <commentFetcher.Form method="post" className="flex gap-3">
              <input type="hidden" name="_intent" value="comment" />
              <textarea
                ref={commentRef}
                name="body"
                className="input flex-1 min-h-[72px] resize-none"
                placeholder="Add a note or update…"
              />
              <button
                type="submit"
                disabled={commentFetcher.state !== 'idle'}
                className="btn-primary self-end"
              >
                Post
              </button>
            </commentFetcher.Form>
          </div>
        </div>

        {/* ── Right: details sidebar ── */}
        <div className="space-y-5">
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Details</h3>
            {[
              { label: 'Status', value: <StatusBadge status={ticket.status} /> },
              { label: 'Priority', value: <PriorityBadge priority={ticket.priority} /> },
              { label: 'Type', value: <TypeBadge type={ticket.type} /> },
              { label: 'Category', value: ticket.category || '—' },
              { label: 'Requester', value: ticket.requester_name },
              { label: 'Email', value: ticket.requester_email || '—' },
              { label: 'Department', value: ticket.department || '—' },
              { label: 'Location', value: ticket.location || '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between gap-2">
                <span className="text-xs text-gray-500 shrink-0">{label}</span>
                <span className="text-xs text-gray-800 text-right font-medium">{value}</span>
              </div>
            ))}

            <div className="border-t border-gray-100 pt-3 space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">Opened</span>
                <span className="text-xs text-gray-700">
                  {format(new Date(ticket.created_at), 'MMM d, yyyy HH:mm')}
                </span>
              </div>
              {ticket.resolved_at && (
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">Resolved</span>
                  <span className="text-xs text-gray-700">
                    {format(new Date(ticket.resolved_at), 'MMM d, yyyy HH:mm')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* SLA card */}
          {!isResolved && ticket.sla && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">SLA Status</h3>
              <SlaBadge sla={ticket.sla} />
              <div className="mt-3">
                <SlaBar sla={ticket.sla} />
                <p className="mt-1 text-xs text-gray-400">
                  {ticket.sla.percentElapsed}% of SLA elapsed
                </p>
              </div>
              <p className="mt-3 text-xs text-gray-500">
                Target:{' '}
                {ticket.sla_minutes >= 60
                  ? `${ticket.sla_minutes / 60}h`
                  : `${ticket.sla_minutes}m`}
              </p>
            </div>
          )}

          {/* Escalation routing hint */}
          {canEscalate && ticket.suggestedEscalationTeam && (
            <div className="card p-5 border-purple-100 bg-purple-50">
              <h3 className="text-sm font-semibold text-purple-800 mb-1">Escalation Routing</h3>
              <p className="text-xs text-purple-600 mb-1">Based on category, routes to:</p>
              <p className="text-sm font-medium text-purple-900">
                {ticket.suggestedEscalationTeam}
              </p>
              <button
                onClick={() => setShowEscalate(true)}
                className="mt-3 w-full btn bg-purple-600 text-white hover:bg-purple-700 text-xs"
              >
                Escalate Now
              </button>
            </div>
          )}
        </div>
      </div>

      {showEscalate && <EscalateModal ticket={ticket} onClose={() => setShowEscalate(false)} />}
      {showResolve && <ResolveModal ticket={ticket} onClose={() => setShowResolve(false)} />}
    </div>
  );
}
