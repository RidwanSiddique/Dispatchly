import { useState } from 'react';
import { useLoaderData, Link, useRevalidator } from 'react-router-dom';
import { PageHeader } from '../components/layout/Layout';
import { useCurrentUser } from '../context/AuthContext';

export async function orgLoader() {
  const [orgRes, teamsRes] = await Promise.all([
    fetch('/api/departments/org-chart', { credentials: 'include' }),
    fetch('/api/departments/teams', { credentials: 'include' }),
  ]);
  const org   = orgRes.ok   ? await orgRes.json()   : { tree: [], users: [] };
  const teams = teamsRes.ok ? await teamsRes.json() : { teams: [] };
  return { org, teams };
}

// ─── Status dot ───────────────────────────────────────────────────────────────

const STATUS_COLOR = {
  available: 'bg-green-400',
  on_duty:   'bg-blue-400',
  on_call:   'bg-purple-500',
  busy:      'bg-amber-400',
  break:     'bg-gray-400',
  lunch:     'bg-gray-400',
  training:  'bg-teal-400',
  meeting:   'bg-teal-400',
  offline:   'bg-gray-300',
  off_duty:  'bg-gray-300',
};

function StatusDot({ status }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${STATUS_COLOR[status] ?? 'bg-gray-300'}`}
      title={status?.replace('_', ' ')}
    />
  );
}

// ─── Member card ─────────────────────────────────────────────────────────────

function MemberCard({ user }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 border border-gray-100">
      <StatusDot status={user.current_status} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
        <p className="text-xs text-gray-400 truncate">{user.title || user.role}</p>
      </div>
      <span className="text-xs text-gray-400 capitalize flex-shrink-0">
        {user.current_status?.replace('_', ' ')}
      </span>
    </div>
  );
}

// ─── Team block ────────────────────────────────────────────────────────────────

function TeamBlock({ team }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">👥</span>
          <span className="font-semibold text-gray-800 text-sm">{team.name}</span>
          {team.lead_name && (
            <span className="text-xs text-gray-400">· Lead: {team.lead_name}</span>
          )}
        </div>
        <span className="text-xs text-gray-400">{team.members?.length ?? 0} members {expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="p-3 space-y-1.5">
          {(team.members ?? []).length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">No members</p>
          ) : (
            team.members.map((m) => <MemberCard key={m.id} user={m} />)
          )}
        </div>
      )}
    </div>
  );
}

// ─── Department block ────────────────────────────────────────────────────────

function DeptBlock({ dept }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 bg-gradient-to-r from-blue-50 to-white hover:from-blue-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">🏢</span>
          <div className="text-left">
            <p className="font-bold text-gray-900">{dept.name}</p>
            {dept.code && <p className="text-xs text-blue-500 font-mono">{dept.code}</p>}
          </div>
          {dept.head_name && (
            <span className="ml-3 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              Head: {dept.head_name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>{dept.teams?.length ?? 0} teams</span>
          <span>{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="p-4 space-y-3">
          {dept.description && (
            <p className="text-xs text-gray-500 italic">{dept.description}</p>
          )}
          {(dept.teams ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No teams in this department</p>
          ) : (
            dept.teams.map((t) => <TeamBlock key={t.id} team={t} />)
          )}
          {/* Sub-departments */}
          {(dept.children ?? []).map((child) => (
            <div key={child.id} className="ml-4 border-l-2 border-blue-100 pl-4">
              <DeptBlock dept={child} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── New Department modal ─────────────────────────────────────────────────────

function NewDeptModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', code: '', description: '' });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/departments', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (res.ok) { onCreated(); onClose(); }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-bold mb-4">New Department</h3>
        <form onSubmit={submit} className="space-y-3">
          <input className="input w-full" placeholder="Department name *" required
            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input w-full" placeholder="Short code (e.g. IT)"
            value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <textarea className="input w-full" placeholder="Description" rows={2}
            value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn btn-primary flex-1">
              {loading ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── New Team modal ────────────────────────────────────────────────────────────

function NewTeamModal({ departments, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', department_id: '', description: '' });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/departments/teams', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (res.ok) { onCreated(); onClose(); }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-bold mb-4">New Team</h3>
        <form onSubmit={submit} className="space-y-3">
          <input className="input w-full" placeholder="Team name *" required
            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className="input w-full" required
            value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
            <option value="">Select department *</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <textarea className="input w-full" placeholder="Description" rows={2}
            value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn btn-primary flex-1">
              {loading ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OrgPage() {
  const { org, teams } = useLoaderData();
  const { user } = useCurrentUser();
  const { revalidate } = useRevalidator();
  const [modal, setModal] = useState(null); // 'dept' | 'team'

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const canManage = isAdmin || isManager;

  const allDepts = org.tree.reduce((acc, d) => {
    acc.push(d);
    (d.children ?? []).forEach((c) => acc.push(c));
    return acc;
  }, []);

  return (
    <div>
      <PageHeader
        title="Organisation Chart"
        description="Departments, teams, and reporting hierarchy"
      />

      <div className="p-6 space-y-6">
        {/* Summary bar */}
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{allDepts.length}</p>
            <p className="text-xs text-gray-500 mt-1">Departments</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">{teams.teams.length}</p>
            <p className="text-xs text-gray-500 mt-1">Teams</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{org.users.length}</p>
            <p className="text-xs text-gray-500 mt-1">Active Staff</p>
          </div>
        </div>

        {/* Actions */}
        {canManage && (
          <div className="flex gap-2">
            <button onClick={() => setModal('dept')} className="btn btn-primary text-sm">
              + New Department
            </button>
            <button onClick={() => setModal('team')} className="btn btn-secondary text-sm">
              + New Team
            </button>
          </div>
        )}

        {/* Org tree */}
        <div className="space-y-4">
          {org.tree.length === 0 ? (
            <div className="card p-12 text-center text-gray-400">
              <p className="text-4xl mb-3">🏢</p>
              <p>No departments yet. Create one to get started.</p>
            </div>
          ) : (
            org.tree.map((dept) => <DeptBlock key={dept.id} dept={dept} />)
          )}
        </div>
      </div>

      {modal === 'dept' && (
        <NewDeptModal onClose={() => setModal(null)} onCreated={revalidate} />
      )}
      {modal === 'team' && (
        <NewTeamModal departments={allDepts} onClose={() => setModal(null)} onCreated={revalidate} />
      )}
    </div>
  );
}
