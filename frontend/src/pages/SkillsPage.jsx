import { useState } from 'react';
import { useLoaderData, useRevalidator } from 'react-router-dom';
import { PageHeader } from '../components/layout/Layout';
import { useCurrentUser } from '../context/AuthContext';

export async function skillsLoader() {
  const [skillsRes, mySkillsRes, staffRes] = await Promise.all([
    fetch('/api/skills', { credentials: 'include' }),
    fetch('/api/skills/users/me', { credentials: 'include' }).catch(() => null),
    fetch('/api/users?role=agent,technician,specialist,manager', { credentials: 'include' }).catch(() => null),
  ]);
  const skillsData = skillsRes.ok ? await skillsRes.json() : { skills: [], byCategory: {} };
  const mySkills   = mySkillsRes?.ok ? (await mySkillsRes.json()).userSkills ?? [] : [];
  const staff      = staffRes?.ok ? (await staffRes.json()) : [];
  return { ...skillsData, mySkills, staff: Array.isArray(staff) ? staff : [] };
}

const PROFICIENCY_LABELS = ['','Novice','Beginner','Intermediate','Advanced','Expert'];
const PROFICIENCY_COLOR  = ['','bg-gray-200','bg-blue-200','bg-blue-400','bg-purple-500','bg-amber-500'];

function ProfBadge({ level }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold text-white ${PROFICIENCY_COLOR[level] ?? 'bg-gray-300'}`}>
      {PROFICIENCY_LABELS[level] ?? level}
    </span>
  );
}

// ─── Add skill to user ───────────────────────────────────────────────────────

function AddSkillModal({ skills, userId, onClose, onAdded }) {
  const [form, setForm] = useState({ skill_id: '', proficiency_level: 1, notes: '' });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await fetch(`/api/skills/users/${userId}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, proficiency_level: Number(form.proficiency_level) }),
    });
    setLoading(false);
    onAdded();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-bold mb-4">Add Skill</h3>
        <form onSubmit={submit} className="space-y-3">
          <select className="input w-full" required
            value={form.skill_id} onChange={(e) => setForm({ ...form, skill_id: e.target.value })}>
            <option value="">Select skill *</option>
            {skills.map((s) => (
              <option key={s.id} value={s.id}>{s.category} — {s.name}</option>
            ))}
          </select>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Proficiency: {PROFICIENCY_LABELS[form.proficiency_level]}
            </label>
            <input type="range" min="1" max="5" className="w-full"
              value={form.proficiency_level}
              onChange={(e) => setForm({ ...form, proficiency_level: Number(e.target.value) })} />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              {PROFICIENCY_LABELS.slice(1).map((l) => <span key={l}>{l}</span>)}
            </div>
          </div>
          <textarea className="input w-full" placeholder="Notes (optional)" rows={2}
            value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn btn-primary flex-1">
              {loading ? 'Saving…' : 'Add Skill'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Skill catalogue tab ─────────────────────────────────────────────────────

function CataloguTab({ byCategory, skills, canManage, onRefresh }) {
  const [newSkill, setNewSkill] = useState({ name: '', category: 'General', description: '' });
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const createSkill = async (e) => {
    e.preventDefault();
    setLoading(true);
    await fetch('/api/skills', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSkill),
    });
    setLoading(false);
    setShowForm(false);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {canManage && (
        <div>
          {showForm ? (
            <form onSubmit={createSkill} className="card p-4 space-y-3">
              <h4 className="font-semibold text-sm">New Skill</h4>
              <div className="flex gap-3">
                <input className="input flex-1" placeholder="Skill name *" required
                  value={newSkill.name} onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })} />
                <input className="input flex-1" placeholder="Category"
                  value={newSkill.category} onChange={(e) => setNewSkill({ ...newSkill, category: e.target.value })} />
              </div>
              <textarea className="input w-full" placeholder="Description" rows={2}
                value={newSkill.description} onChange={(e) => setNewSkill({ ...newSkill, description: e.target.value })} />
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" disabled={loading} className="btn btn-primary">{loading ? 'Saving…' : 'Create'}</button>
              </div>
            </form>
          ) : (
            <button onClick={() => setShowForm(true)} className="btn btn-primary text-sm">+ New Skill</button>
          )}
        </div>
      )}

      {Object.entries(byCategory).map(([category, catSkills]) => (
        <div key={category}>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{category}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {catSkills.map((skill) => (
              <div key={skill.id} className="card p-4">
                <p className="font-medium text-gray-900 text-sm">{skill.name}</p>
                {skill.description && <p className="text-xs text-gray-500 mt-1">{skill.description}</p>}
                <p className="text-xs text-blue-500 mt-2">{skill.user_count} agents trained</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── My skills tab ────────────────────────────────────────────────────────────

function MySkillsTab({ mySkills, skills, userId, onRefresh }) {
  const [modal, setModal] = useState(false);

  const remove = async (skillId) => {
    await fetch(`/api/skills/users/${userId}/${skillId}`, {
      method: 'DELETE', credentials: 'include',
    });
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <button onClick={() => setModal(true)} className="btn btn-primary text-sm">+ Add Skill</button>

      {mySkills.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <p className="text-3xl mb-2">🎯</p>
          <p>No skills on your profile yet.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Skill</th>
                <th className="text-left py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                <th className="text-left py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Proficiency</th>
                <th className="text-left py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Verified</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {mySkills.map((us) => (
                <tr key={us.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{us.skill_name}</td>
                  <td className="py-3 pr-4 text-gray-500 text-xs">{us.category}</td>
                  <td className="py-3 pr-4"><ProfBadge level={us.proficiency_level} /></td>
                  <td className="py-3 pr-4 text-xs text-gray-500">
                    {us.verified_by_name ? (
                      <span className="text-green-600">✓ {us.verified_by_name}</span>
                    ) : (
                      <span className="text-gray-400">Unverified</span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <button onClick={() => remove(us.skill_id)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <AddSkillModal
          skills={skills}
          userId={userId}
          onClose={() => setModal(false)}
          onAdded={onRefresh}
        />
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SkillsPage() {
  const data = useLoaderData();
  const { user } = useCurrentUser();
  const { revalidate } = useRevalidator();
  const [tab, setTab] = useState('mine');

  const canManage = ['admin','manager','specialist'].includes(user?.role);
  const tabs = [
    { id: 'mine',      label: 'My Skills' },
    { id: 'catalogue', label: 'Skill Catalogue' },
  ];

  return (
    <div>
      <PageHeader
        title="Skills"
        description="Manage skill profiles — used for automatic ticket routing"
      />

      <div className="p-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'mine' && (
          <MySkillsTab
            mySkills={data.mySkills}
            skills={data.skills}
            userId={user?.userId}
            onRefresh={revalidate}
          />
        )}
        {tab === 'catalogue' && (
          <CataloguTab
            byCategory={data.byCategory}
            skills={data.skills}
            canManage={canManage}
            onRefresh={revalidate}
          />
        )}
      </div>
    </div>
  );
}
