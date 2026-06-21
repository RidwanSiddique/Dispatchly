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

export async function problemsLoader() {
  const [problemsRes, staffRes] = await Promise.all([
    fetch('/api/problems', { credentials: 'include' }),
    fetch('/api/users/staff', { credentials: 'include' }),
  ]);
  if (!problemsRes.ok)
    throw new Response('Failed to load problems', { status: problemsRes.status });
  const { problems } = await problemsRes.json();
  const staff = staffRes.ok ? await staffRes.json() : [];
  return { problems, staff };
}

// ─── Action ──────────────────────────────────────────────────────────────────

export async function problemsAction({ request }) {
  const formData = await request.formData();
  const intent = formData.get('_intent');

  if (intent === 'create') {
    const res = await fetch('/api/problems', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: formData.get('title'),
        description: formData.get('description'),
        assigned_to_user_id: formData.get('assigned_to_user_id') || null,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create problem' }));
      return { error: err.error };
    }
    const { problem } = await res.json();
    return redirect(`/problems/${problem.id}`);
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

const FILTERS = ['All', 'Open', 'In Investigation', 'Known Error', 'Resolved', 'Closed'];

// ─── Create Problem Form ──────────────────────────────────────────────────────

function CreateProblemForm({ staff, onCancel }) {
  const actionData = useActionData();
  const navigation = useNavigation();
  const busy = navigation.state === 'submitting';
  const assignable = staff.filter((u) =>
    ['technician', 'agent', 'specialist', 'manager'].includes(u.role)
  );

  return (
    <div className="card p-6 mb-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">New Problem Record</h3>
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
            placeholder="e.g. VPN drops for remote users"
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
            placeholder="What is the problem? When does it occur? Impact?"
          />
        </div>
        <div>
          <label className="label">Assign To</label>
          <select name="assigned_to_user_id" className="input w-full">
            <option value="">— Unassigned —</option>
            {assignable.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role})
              </option>
            ))}
          </select>
        </div>
        {actionData?.error && <p className="text-sm text-red-600">{actionData.error}</p>}
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onCancel} className="btn btn-ghost">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="btn btn-primary">
            {busy ? 'Creating…' : 'Create Problem'}
          </button>
        </div>
      </Form>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProblemsPage() {
  const { problems, staff } = useLoaderData();
  const user = useCurrentUser();
  const canCreate = ['admin', 'manager', 'agent'].includes(user?.role);
  const [filter, setFilter] = useState('All');
  const [showCreate, setShowCreate] = useState(false);

  const filtered = filter === 'All' ? problems : problems.filter((p) => p.status === filter);

  return (
    <>
      <PageHeader
        title="Problem Management"
        subtitle="Track and resolve recurring issues across multiple tickets"
        actions={
          canCreate && (
            <button type="button" onClick={() => setShowCreate((v) => !v)} className="btn-primary">
              {showCreate ? 'Cancel' : '+ New Problem'}
            </button>
          )
        }
      />

      <div className="px-8 py-6">
        {showCreate && <CreateProblemForm staff={staff} onCancel={() => setShowCreate(false)} />}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition ${filter === f ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:border-blue-400'}`}
            >
              {f}
              {f !== 'All' && (
                <span className="ml-1 text-xs opacity-70">
                  ({problems.filter((p) => p.status === f).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <p className="text-4xl mb-3">🔍</p>
            <p>No problems found{filter !== 'All' ? ` with status "${filter}"` : ''}.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((p) => (
              <Link
                key={p.id}
                to={`/problems/${p.id}`}
                className="card flex items-start gap-4 p-5 hover:border-blue-300 hover:shadow-md transition block"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs text-gray-400">#{p.id}</span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[p.status] || STATUS_COLORS.Open}`}
                    >
                      {p.status}
                    </span>
                    {Number(p.linked_tickets_count) > 0 && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {p.linked_tickets_count} ticket{p.linked_tickets_count > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <p className="font-medium text-gray-900">{p.title}</p>
                  <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{p.description}</p>
                </div>
                <div className="text-right text-xs text-gray-400 shrink-0">
                  {p.assigned_to_name && <p className="mb-1 text-gray-600">{p.assigned_to_name}</p>}
                  <p>{format(new Date(p.created_at), 'MMM d, yyyy')}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
