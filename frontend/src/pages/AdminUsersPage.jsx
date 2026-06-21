import { useState } from 'react';
import { useFetcher, useLoaderData } from 'react-router-dom';
import { PageHeader } from '../components/layout/Layout';

const ROLES = ['admin', 'manager', 'agent', 'technician', 'specialist', 'hr', 'client'];

const ROLE_COLORS = {
  admin: 'bg-red-100 text-red-700',
  manager: 'bg-purple-100 text-purple-700',
  agent: 'bg-blue-100 text-blue-700',
  technician: 'bg-cyan-100 text-cyan-700',
  specialist: 'bg-indigo-100 text-indigo-700',
  hr: 'bg-orange-100 text-orange-700',
  client: 'bg-gray-100 text-gray-700',
};

// ─── Loader ──────────────────────────────────────────────────────────────────

export async function adminUsersLoader() {
  const res = await fetch('/api/users', { credentials: 'include' });
  if (!res.ok) throw new Response('Failed to load users', { status: res.status });
  return res.json();
}

// ─── Action ──────────────────────────────────────────────────────────────────

export async function adminUsersAction({ request }) {
  const formData = await request.formData();
  const intent = formData.get('_intent');

  if (intent === 'create') {
    const body = {
      email: formData.get('email'),
      password: formData.get('password'),
      name: formData.get('name'),
      role: formData.get('role'),
      department: formData.get('department') || undefined,
    };
    const res = await fetch('/api/users', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await res.json();
    return res.ok ? { ok: true, intent } : { error: result.error, intent };
  }

  if (intent === 'update') {
    const id = formData.get('id');
    const body = {};
    ['name', 'role', 'department'].forEach((k) => {
      const v = formData.get(k);
      if (v != null) body[k] = v;
    });
    const res = await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await res.json();
    return res.ok ? { ok: true, intent } : { error: result.error, intent };
  }

  if (intent === 'deactivate' || intent === 'activate') {
    const id = formData.get('id');
    const res = await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: intent === 'activate' }),
    });
    const result = await res.json();
    return res.ok ? { ok: true, intent } : { error: result.error, intent };
  }

  return { error: 'Unknown action' };
}

// ─── Create user modal ────────────────────────────────────────────────────────

function CreateUserModal({ onClose }) {
  const fetcher = useFetcher();
  const busy = fetcher.state !== 'idle';

  const closed = fetcher.data?.ok && fetcher.data?.intent === 'create';
  if (closed && onClose) setTimeout(onClose, 0);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Create New User</h2>
        <fetcher.Form method="post" className="space-y-4">
          <input type="hidden" name="_intent" value="create" />

          {fetcher.data?.error && (
            <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{fetcher.data.error}</p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Full Name</label>
              <input className="input" name="name" required placeholder="Jane Smith" />
            </div>
            <div className="col-span-2">
              <label className="label">Email</label>
              <input
                className="input"
                name="email"
                type="email"
                required
                placeholder="jane@dispatchly.com"
              />
            </div>
            <div className="col-span-2">
              <label className="label">Password (min 8 chars)</label>
              <input className="input" name="password" type="password" required minLength={8} />
            </div>
            <div>
              <label className="label">Role</label>
              <select className="input" name="role" defaultValue="agent">
                {ROLES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Department</label>
              <input className="input" name="department" placeholder="Optional" />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="btn btn-primary">
              {busy ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </fetcher.Form>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function AdminUsersPage() {
  const users = useLoaderData();
  const fetcher = useFetcher();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div>
      <PageHeader
        title="User Management"
        subtitle={`${users.length} user${users.length !== 1 ? 's' : ''}`}
        actions={
          <button onClick={() => setShowCreate(true)} className="btn btn-primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New User
          </button>
        }
      />

      <div className="p-8">
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((u) => (
                <tr key={u.id} className={`hover:bg-gray-50 ${!u.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                  <td className="px-4 py-3 text-gray-500">{u.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{u.department ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}
                    >
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <fetcher.Form method="post" className="inline">
                      <input type="hidden" name="id" value={u.id} />
                      <input
                        type="hidden"
                        name="_intent"
                        value={u.is_active ? 'deactivate' : 'activate'}
                      />
                      <button
                        type="submit"
                        disabled={fetcher.state !== 'idle'}
                        className={`btn text-xs px-3 py-1 ${u.is_active ? 'btn-ghost text-red-500 hover:bg-red-50' : 'btn-ghost text-emerald-600 hover:bg-emerald-50'}`}
                      >
                        {u.is_active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </fetcher.Form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
