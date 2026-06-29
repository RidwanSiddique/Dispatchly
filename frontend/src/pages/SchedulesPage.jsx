import { useState } from 'react';
import { useLoaderData, useRevalidator } from 'react-router-dom';
import { PageHeader } from '../components/layout/Layout';
import { useCurrentUser } from '../context/AuthContext';

export async function schedulesLoader() {
  const res = await fetch('/api/agent-status/schedules', { credentials: 'include' });
  if (!res.ok) return { schedules: [] };
  return res.json();
}

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const SCHEDULE_TYPES = ['standard','shift','on_call_rotation','custom','exempt'];
const SCHEDULE_TYPE_LABELS = {
  standard:          'Standard (9–5)',
  shift:             'Shift Worker',
  on_call_rotation:  'On-Call Rotation',
  custom:            'Custom',
  exempt:            'Exempt (No auto-transitions)',
};

function fmtHour(h) {
  if (h == null) return '—';
  const suffix = h < 12 ? 'AM' : 'PM';
  const display = h % 12 || 12;
  return `${display}:00 ${suffix}`;
}

function WorkDayBadges({ workDays }) {
  return (
    <div className="flex gap-1">
      {DAY_NAMES.map((d, i) => (
        <span key={d} className={`text-xs px-1.5 py-0.5 rounded font-mono ${
          (workDays ?? []).includes(i)
            ? 'bg-blue-100 text-blue-700 font-bold'
            : 'bg-gray-100 text-gray-400'
        }`}>{d}</span>
      ))}
    </div>
  );
}

// ─── Edit schedule modal ──────────────────────────────────────────────────────

function EditScheduleModal({ user, existing, onClose, onSaved }) {
  const [form, setForm] = useState({
    schedule_type: existing?.schedule_type ?? 'standard',
    start_hour:    existing?.start_hour    ?? 9,
    end_hour:      existing?.end_hour      ?? 17,
    work_days:     existing?.work_days     ?? [1,2,3,4,5],
    timezone:      existing?.timezone      ?? 'UTC',
    shift_label:   existing?.shift_label   ?? '',
    effective_until: existing?.effective_until ?? '',
    notes:         existing?.notes         ?? '',
  });
  const [loading, setLoading] = useState(false);

  const toggleDay = (day) => {
    const days = form.work_days.includes(day)
      ? form.work_days.filter((d) => d !== day)
      : [...form.work_days, day].sort();
    setForm({ ...form, work_days: days });
  };

  const save = async (e) => {
    e.preventDefault();
    setLoading(true);
    await fetch(`/api/agent-status/schedules/${user.id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        start_hour: Number(form.start_hour),
        end_hour:   Number(form.end_hour),
        effective_until: form.effective_until || null,
        shift_label: form.shift_label || null,
        notes: form.notes || null,
      }),
    });
    setLoading(false);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg max-h-screen overflow-y-auto">
        <h3 className="text-lg font-bold mb-1">Edit Schedule</h3>
        <p className="text-sm text-gray-500 mb-4">{user.name} · {user.role}</p>

        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Schedule Type</label>
            <select className="input w-full" value={form.schedule_type}
              onChange={(e) => setForm({ ...form, schedule_type: e.target.value })}>
              {SCHEDULE_TYPES.map((t) => (
                <option key={t} value={t}>{SCHEDULE_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          {form.schedule_type !== 'exempt' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Start Hour</label>
                  <select className="input w-full" value={form.start_hour}
                    onChange={(e) => setForm({ ...form, start_hour: Number(e.target.value) })}>
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{fmtHour(i)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">End Hour</label>
                  <select className="input w-full" value={form.end_hour}
                    onChange={(e) => setForm({ ...form, end_hour: Number(e.target.value) })}>
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>{fmtHour(i + 1)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-2">Working Days</label>
                <div className="flex gap-2">
                  {DAY_NAMES.map((d, i) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(i)}
                      className={`w-10 h-10 rounded-lg text-xs font-bold transition-colors ${
                        form.work_days.includes(i)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Timezone</label>
                <select className="input w-full" value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
                  {['UTC','America/New_York','America/Chicago','America/Denver','America/Los_Angeles',
                    'Europe/London','Europe/Paris','Europe/Berlin','Asia/Dubai','Asia/Kolkata',
                    'Asia/Singapore','Australia/Sydney'].map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {['shift','on_call_rotation','custom'].includes(form.schedule_type) && (
            <input className="input w-full" placeholder="Shift label (e.g. Night Shift)"
              value={form.shift_label} onChange={(e) => setForm({ ...form, shift_label: e.target.value })} />
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Effective Until (optional)</label>
              <input type="date" className="input w-full" value={form.effective_until}
                onChange={(e) => setForm({ ...form, effective_until: e.target.value })} />
            </div>
          </div>

          <textarea className="input w-full" placeholder="Notes" rows={2}
            value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn btn-primary flex-1">
              {loading ? 'Saving…' : 'Save Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Schedule row ─────────────────────────────────────────────────────────────

function ScheduleRow({ entry, canEdit, onEdit }) {
  const hasSchedule = !!entry.schedule_type;
  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50">
      <td className="px-4 py-3">
        <p className="font-medium text-sm text-gray-900">{entry.name}</p>
        <p className="text-xs text-gray-400">{entry.title || entry.role}</p>
      </td>
      <td className="py-3 pr-4 text-xs text-gray-600">
        {entry.department_name ?? '—'}
        {entry.team_name && <span className="text-gray-400 ml-1">/ {entry.team_name}</span>}
      </td>
      <td className="py-3 pr-4">
        {hasSchedule ? (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-semibold">
            {SCHEDULE_TYPE_LABELS[entry.schedule_type] ?? entry.schedule_type}
          </span>
        ) : (
          <span className="text-xs text-gray-400">No schedule</span>
        )}
      </td>
      <td className="py-3 pr-4 text-xs text-gray-700">
        {hasSchedule && entry.schedule_type !== 'exempt'
          ? `${fmtHour(entry.start_hour)} – ${fmtHour(entry.end_hour)}`
          : '—'}
      </td>
      <td className="py-3 pr-4">
        {hasSchedule && entry.work_days ? <WorkDayBadges workDays={entry.work_days} /> : <span className="text-gray-400 text-xs">—</span>}
      </td>
      <td className="py-3 pr-4 text-xs text-gray-500">
        {entry.shift_label ?? '—'}
      </td>
      <td className="py-3 pr-4 text-xs text-gray-500">
        {entry.set_by_name ?? 'System'}
      </td>
      {canEdit && (
        <td className="py-3">
          <button onClick={() => onEdit(entry)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
            Edit
          </button>
        </td>
      )}
    </tr>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SchedulesPage() {
  const { schedules } = useLoaderData();
  const { user } = useCurrentUser();
  const { revalidate } = useRevalidator();
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');

  const canEdit = ['admin','manager'].includes(user?.role);

  const filtered = schedules.filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  );

  // Summary counts
  const typeCounts = {};
  schedules.forEach((s) => {
    const k = s.schedule_type ?? 'unset';
    typeCounts[k] = (typeCounts[k] ?? 0) + 1;
  });

  return (
    <div>
      <PageHeader
        title="Work Schedules"
        description="Set working hours for your team — drives automatic status transitions"
      />

      <div className="p-6 space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Object.entries(typeCounts).map(([type, count]) => (
            <div key={type} className="card p-3 text-center">
              <p className="text-2xl font-bold text-blue-600">{count}</p>
              <p className="text-xs text-gray-500 mt-1">{SCHEDULE_TYPE_LABELS[type] ?? type}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-3 items-center">
          <input
            className="input text-sm flex-1 max-w-sm"
            placeholder="Search staff…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <p className="text-xs text-gray-500">
            {canEdit
              ? 'Click Edit to set working hours for any team member.'
              : 'Contact your manager to update your schedule.'}
          </p>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
                  <th className="text-left py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Dept / Team</th>
                  <th className="text-left py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="text-left py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Hours</th>
                  <th className="text-left py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Days</th>
                  <th className="text-left py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Shift Label</th>
                  <th className="text-left py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Set By</th>
                  {canEdit && <th className="py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider" />}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan="8" className="text-center py-10 text-gray-400 text-sm">No schedules found</td></tr>
                ) : filtered.map((entry) => (
                  <ScheduleRow
                    key={entry.id}
                    entry={entry}
                    canEdit={canEdit}
                    onEdit={setEditing}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-4 bg-blue-50 border-blue-100">
          <h4 className="text-sm font-semibold text-blue-800 mb-1">How automatic status works</h4>
          <p className="text-xs text-gray-600">
            The schedule manager runs every minute. When an employee's shift starts, their status moves from
            <strong> off_duty → on_duty</strong> automatically. When it ends, it moves back to <strong>off_duty</strong>.
            On-call assignments override this — when an on-call period starts, status becomes <strong>on_call</strong>
            regardless of the regular schedule. Employees can manually change their own status at any time
            (to available, busy, break, lunch, training, meeting). Managers can override any report's status.
            Users with "Exempt" schedules never get auto-transitioned.
          </p>
        </div>
      </div>

      {editing && (
        <EditScheduleModal
          user={editing}
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={revalidate}
        />
      )}
    </div>
  );
}
