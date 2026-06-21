import { format } from 'date-fns';
import { useState } from 'react';
import { Form, redirect, useActionData, useLoaderData, useNavigation } from 'react-router-dom';
import { PageHeader } from '../components/layout/Layout';
import { useCurrentUser } from '../context/AuthContext';

// ─── Loader ──────────────────────────────────────────────────────────────────

export async function onCallLoader() {
  const res = await fetch('/api/oncall', { credentials: 'include' });
  if (!res.ok) throw new Response('Failed to load schedule', { status: res.status });
  return res.json();
}

// ─── Action ──────────────────────────────────────────────────────────────────

export async function onCallAction({ request }) {
  const formData = await request.formData();
  const intent = formData.get('_intent');

  if (intent === 'add_schedule') {
    const res = await fetch('/api/oncall', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: formData.get('user_id'),
        start_time: formData.get('start_time'),
        end_time: formData.get('end_time'),
        label: formData.get('label') || 'On-Call',
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create schedule' }));
      return { error: err.error };
    }
    return redirect('/admin/schedule');
  }

  if (intent === 'delete_schedule') {
    await fetch(`/api/oncall/${formData.get('schedule_id')}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return redirect('/admin/schedule');
  }

  if (intent === 'update_availability') {
    await fetch('/api/users/me/availability', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ availability_status: formData.get('availability_status') }),
    });
    return redirect('/admin/schedule');
  }

  if (intent === 'page_user') {
    const res = await fetch(`/api/oncall/page/${formData.get('target_user_id')}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: formData.get('message') }),
    });
    if (!res.ok) return { error: 'Failed to page user' };
    return { ok: true, paged: true };
  }

  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const AVAIL_COLORS = {
  available: 'bg-green-100 text-green-700 border-green-200',
  on_call: 'bg-blue-100 text-blue-700 border-blue-200',
  busy: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  offline: 'bg-gray-100 text-gray-500 border-gray-200',
};

const AVAIL_OPTIONS = ['available', 'on_call', 'busy', 'offline'];

// ─── Page user modal ──────────────────────────────────────────────────────────

function PageUserModal({ user, onClose }) {
  const actionData = useActionData();
  const navigation = useNavigation();
  const busy = navigation.state === 'submitting';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Page {user.name}</h2>
        <p className="text-sm text-gray-500 mb-4">Sends an urgent notification immediately.</p>
        <Form method="post" className="space-y-3">
          <input type="hidden" name="_intent" value="page_user" />
          <input type="hidden" name="target_user_id" value={user.id} />
          <textarea name="message" rows={2} className="input w-full resize-none" placeholder="Urgent message (optional)…" />
          {actionData?.error && <p className="text-sm text-red-600">{actionData.error}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button type="submit" disabled={busy} className="btn btn-danger">
              {busy ? 'Paging…' : '🚨 Send Page'}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OnCallPage() {
  const { staff, schedules, currentOncall } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const user = useCurrentUser();
  const busy = navigation.state === 'submitting';
  const canManage = user?.role === 'admin' || user?.role === 'manager';

  const [pagingUser, setPagingUser] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const staffList = staff.filter((s) => ['technician', 'agent', 'specialist'].includes(s.role));

  return (
    <>
      <PageHeader
        title="On-Call Schedule"
        subtitle="Manage shift coverage and staff availability"
        actions={
          canManage && (
            <button type="button" onClick={() => setShowAddForm((v) => !v)} className="btn-primary">
              {showAddForm ? 'Cancel' : '+ Add Shift'}
            </button>
          )
        }
      />

      <div className="px-8 py-6 space-y-6">
        {/* Add shift form */}
        {showAddForm && canManage && (
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Schedule On-Call Shift</h3>
            <Form method="post" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <input type="hidden" name="_intent" value="add_schedule" />
              <div>
                <label className="label">Staff Member</label>
                <select name="user_id" required className="input w-full">
                  <option value="">Select…</option>
                  {staffList.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Start</label>
                <input type="datetime-local" name="start_time" required className="input w-full" />
              </div>
              <div>
                <label className="label">End</label>
                <input type="datetime-local" name="end_time" required className="input w-full" />
              </div>
              <div>
                <label className="label">Label</label>
                <input type="text" name="label" defaultValue="On-Call" className="input w-full" />
              </div>
              {actionData?.error && <p className="col-span-full text-sm text-red-600">{actionData.error}</p>}
              <div className="col-span-full flex justify-end">
                <button type="submit" disabled={busy} className="btn btn-primary">
                  {busy ? 'Saving…' : 'Save Shift'}
                </button>
              </div>
            </Form>
          </div>
        )}

        {/* Currently on call */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            🟢 Currently On Call
          </h3>
          {currentOncall.length === 0 ? (
            <p className="text-sm text-gray-400">No one is currently scheduled on call.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {currentOncall.map((u) => (
                <div key={u.id} className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
                    {u.name?.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-900">{u.name}</p>
                    <p className="text-xs text-blue-600">{u.label} · until {format(new Date(u.end_time), 'MMM d, HH:mm')}</p>
                  </div>
                  {canManage && (
                    <button type="button" onClick={() => setPagingUser(u)} className="ml-2 btn btn-danger text-xs py-1 px-2">
                      Page
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Staff availability */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Staff Availability</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {staffList.map((s) => (
              <div key={s.id} className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${AVAIL_COLORS[s.availability_status] || AVAIL_COLORS.offline}`}>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{s.name}</p>
                  <p className="text-xs opacity-70">{s.role}</p>
                  {s.skills?.length > 0 && (
                    <p className="text-xs opacity-60 mt-0.5 truncate">{s.skills.join(', ')}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs font-medium capitalize">{s.availability_status.replace('_', ' ')}</span>
                  {(canManage || s.id === user?.userId) && (
                    <Form method="post" className="flex gap-1">
                      <input type="hidden" name="_intent" value="update_availability" />
                      <select
                        name="availability_status"
                        defaultValue={s.availability_status}
                        onChange={(e) => e.currentTarget.form?.requestSubmit()}
                        className="text-xs rounded border border-current bg-white px-1 py-0.5"
                      >
                        {AVAIL_OPTIONS.map((o) => (
                          <option key={o} value={o}>{o.replace('_', ' ')}</option>
                        ))}
                      </select>
                    </Form>
                  )}
                  {canManage && s.id !== user?.userId && (
                    <button type="button" onClick={() => setPagingUser(s)} className="text-xs font-medium hover:underline">
                      Page
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming schedules */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Upcoming Shifts (14 days)</h3>
          {schedules.length === 0 ? (
            <p className="text-sm text-gray-400">No upcoming shifts scheduled.</p>
          ) : (
            <div className="space-y-2">
              {schedules.map((s) => (
                <div key={s.id} className="flex items-center gap-4 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{s.user_name}</p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(s.start_time), 'MMM d, HH:mm')} → {format(new Date(s.end_time), 'MMM d, HH:mm')}
                      {s.label && s.label !== 'On-Call' && ` · ${s.label}`}
                    </p>
                  </div>
                  {canManage && (
                    <Form method="post">
                      <input type="hidden" name="_intent" value="delete_schedule" />
                      <input type="hidden" name="schedule_id" value={s.id} />
                      <button type="submit" className="text-xs text-red-500 hover:text-red-700 hover:underline">
                        Remove
                      </button>
                    </Form>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {pagingUser && <PageUserModal user={pagingUser} onClose={() => setPagingUser(null)} />}
    </>
  );
}
