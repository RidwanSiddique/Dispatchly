import { format } from 'date-fns';
import { useState } from 'react';
import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router-dom';
import { PageHeader } from '../components/layout/Layout';
import { useCurrentUser } from '../context/AuthContext';

// ─── Loader ──────────────────────────────────────────────────────────────────

export async function changesLoader() {
  const res = await fetch('/api/changes', { credentials: 'include' });
  if (!res.ok) throw new Response('Failed to load changes', { status: res.status });
  return res.json();
}

// ─── Action ──────────────────────────────────────────────────────────────────

export async function changesAction({ request }) {
  const formData = await request.formData();
  const intent = formData.get('_intent');

  if (intent === 'create') {
    const body = {
      title: formData.get('title'),
      description: formData.get('description'),
      type: formData.get('type'),
      risk_level: formData.get('risk_level'),
      implementation_plan: formData.get('implementation_plan') || null,
      rollback_plan: formData.get('rollback_plan') || null,
      affected_systems: formData.get('affected_systems') || null,
      maintenance_window_start: formData.get('maintenance_window_start') || null,
      maintenance_window_end: formData.get('maintenance_window_end') || null,
    };
    const res = await fetch('/api/changes', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create change request' }));
      return { error: err.error };
    }
    const { change } = await res.json();
    return redirect(`/changes/${change.id}`);
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

const TYPE_COLORS = {
  Standard: 'bg-gray-100 text-gray-600',
  Normal: 'bg-blue-100 text-blue-600',
  Emergency: 'bg-red-100 text-red-700',
};

const STATUS_FILTERS = ['All', 'Draft', 'Submitted', 'Approved', 'In Progress', 'Completed'];

// ─── Create Change Form ───────────────────────────────────────────────────────

function CreateChangeForm({ onCancel }) {
  const actionData = useActionData();
  const navigation = useNavigation();
  const busy = navigation.state === 'submitting';

  return (
    <div className="card p-6 mb-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">New Change Request</h3>
      <Form method="post" className="space-y-4">
        <input type="hidden" name="_intent" value="create" />
        <div>
          <label className="label">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            name="title"
            required
            className="input w-full"
            placeholder="e.g. Upgrade VPN gateway firmware"
          />
        </div>
        <div>
          <label className="label">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            name="description"
            required
            rows={3}
            className="input w-full resize-y"
            placeholder="What change is being made and why?"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Type</label>
            <select name="type" defaultValue="Normal" className="input w-full">
              <option value="Standard">Standard</option>
              <option value="Normal">Normal</option>
              <option value="Emergency">Emergency</option>
            </select>
          </div>
          <div>
            <label className="label">Risk Level</label>
            <select name="risk_level" defaultValue="Medium" className="input w-full">
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>
          <div>
            <label className="label">Maintenance Window Start</label>
            <input type="datetime-local" name="maintenance_window_start" className="input w-full" />
          </div>
          <div>
            <label className="label">Maintenance Window End</label>
            <input type="datetime-local" name="maintenance_window_end" className="input w-full" />
          </div>
        </div>
        <div>
          <label className="label">Affected Systems</label>
          <input
            name="affected_systems"
            className="input w-full"
            placeholder="e.g. VPN gateway, Active Directory, Email server"
          />
        </div>
        <div>
          <label className="label">Implementation Plan</label>
          <textarea
            name="implementation_plan"
            rows={3}
            className="input w-full resize-y"
            placeholder="Step-by-step implementation plan…"
          />
        </div>
        <div>
          <label className="label">Rollback Plan</label>
          <textarea
            name="rollback_plan"
            rows={2}
            className="input w-full resize-y"
            placeholder="How to revert if something goes wrong…"
          />
        </div>
        {actionData?.error && <p className="text-sm text-red-600">{actionData.error}</p>}
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onCancel} className="btn btn-ghost">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="btn btn-primary">
            {busy ? 'Creating…' : 'Create Change Request'}
          </button>
        </div>
      </Form>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ChangesPage() {
  const { changes } = useLoaderData();
  const user = useCurrentUser();
  const canCreate = ['admin', 'manager', 'agent', 'technician', 'specialist'].includes(user?.role);
  const [filter, setFilter] = useState('All');
  const [showCreate, setShowCreate] = useState(false);

  const filtered = filter === 'All' ? changes : changes.filter((c) => c.status === filter);

  return (
    <>
      <PageHeader
        title="Change Management"
        subtitle="Track and approve changes to production systems"
        actions={
          canCreate && (
            <button type="button" onClick={() => setShowCreate((v) => !v)} className="btn-primary">
              {showCreate ? 'Cancel' : '+ New Change Request'}
            </button>
          )
        }
      />

      <div className="px-8 py-6">
        {showCreate && <CreateChangeForm onCancel={() => setShowCreate(false)} />}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition ${filter === f ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:border-blue-400'}`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <p className="text-4xl mb-3">📋</p>
            <p>No change requests found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((c) => (
              <Link
                key={c.id}
                to={`/changes/${c.id}`}
                className="card flex items-start gap-4 p-5 hover:border-blue-300 hover:shadow-md transition block"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs text-gray-400">CR#{c.id}</span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[c.status] || STATUS_COLORS.Draft}`}
                    >
                      {c.status}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_COLORS[c.type] || ''}`}
                    >
                      {c.type}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${RISK_COLORS[c.risk_level] || ''}`}
                    >
                      {c.risk_level} Risk
                    </span>
                  </div>
                  <p className="font-medium text-gray-900">{c.title}</p>
                  <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{c.description}</p>
                  {c.maintenance_window_start && (
                    <p className="text-xs text-gray-400 mt-1">
                      Maintenance: {format(new Date(c.maintenance_window_start), 'MMM d, HH:mm')}
                      {c.maintenance_window_end &&
                        ` – ${format(new Date(c.maintenance_window_end), 'MMM d, HH:mm')}`}
                    </p>
                  )}
                </div>
                <div className="text-right text-xs text-gray-400 shrink-0">
                  {c.requester_name && <p className="mb-1 text-gray-600">{c.requester_name}</p>}
                  <p>{format(new Date(c.created_at), 'MMM d, yyyy')}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
