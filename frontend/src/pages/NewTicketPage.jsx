import { useState } from 'react';
import { Form, Link, redirect, useActionData, useNavigation } from 'react-router-dom';

const CATEGORIES = ['Network', 'Clinical Application', 'Hardware', 'Software', 'Account Access'];
const ESCALATION_TEAMS = {
  Network: 'Network Infrastructure Team',
  'Clinical Application': 'Clinical Systems Team',
  Hardware: 'Desktop Support Team',
  Software: 'Application Support Team',
  'Account Access': 'Identity & Access Management Team',
};
const SLA_LABELS = {
  P1: '1 hour',
  P2: '4 hours',
  P3: '8 hours (1 business day)',
  P4: '72 hours (3 business days)',
};
const PRIORITY_DESC = {
  P1: 'Critical — major service outage, patient care impacted',
  P2: 'High — significant degradation, multiple users affected',
  P3: 'Medium — limited impact, workaround available',
  P4: 'Low — minor issue or routine service request',
};
const PRIORITY_SELECTED_STYLE = {
  P1: 'border-red-500 bg-red-50',
  P2: 'border-orange-500 bg-orange-50',
  P3: 'border-yellow-500 bg-yellow-50',
  P4: 'border-green-500 bg-green-50',
};

// ─── Action ──────────────────────────────────────────────────────────────────

export async function newTicketAction({ request }) {
  const formData = await request.formData();
  const body = Object.fromEntries(formData);

  const res = await fetch('/api/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const result = await res.json();
  if (!res.ok) return { error: result.error ?? 'Failed to create ticket' };
  return redirect(`/tickets/${result.id}`);
}

// ─── Page ────────────────────────────────────────────────────────────────────

function Field({ label, required, hint, children }) {
  return (
    <div>
      <label className="label">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

export function NewTicketPage() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const submitting = navigation.state === 'submitting';

  // Priority selection is UI-only state; the hidden input carries the value
  const [priority, setPriority] = useState('P3');
  const [category, setCategory] = useState('');

  return (
    <div>
      <div className="flex items-center justify-between px-8 py-6 border-b border-gray-200 bg-white sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">New Ticket</h1>
          <p className="mt-0.5 text-sm text-gray-500">Submit a new incident or service request</p>
        </div>
        <Link to="/tickets" className="btn-secondary">
          Cancel
        </Link>
      </div>

      <div className="p-8 max-w-2xl">
        <Form method="post" className="card p-6 space-y-5">
          {/* Hidden input carries the priority value set by the card buttons */}
          <input type="hidden" name="priority" value={priority} />

          {/* ── Requester ── */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">
              Requester Information
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Full Name" required>
                <input className="input" name="requester_name" required placeholder="Jane Smith" />
              </Field>
              <Field label="Email">
                <input
                  className="input"
                  name="requester_email"
                  type="email"
                  placeholder="jane@hospital.org"
                />
              </Field>
              <Field label="Department">
                <input className="input" name="department" placeholder="Radiology, ICU, HR…" />
              </Field>
              <Field label="Location / Site">
                <input className="input" name="location" placeholder="Main Campus, North Wing…" />
              </Field>
            </div>
          </div>

          {/* ── Classification ── */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">
              Classification
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Type" required>
                <select className="input" name="type" defaultValue="Incident">
                  <option>Incident</option>
                  <option>Service Request</option>
                </select>
              </Field>
              <Field label="Category">
                <select
                  className="input"
                  name="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">Select category</option>
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Priority cards */}
            <div className="mt-4">
              <label className="label">
                Priority <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-4 gap-2 mt-1">
                {['P1', 'P2', 'P3', 'P4'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`rounded-lg border-2 p-3 text-left transition-all ${
                      priority === p
                        ? PRIORITY_SELECTED_STYLE[p]
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="block font-bold text-sm">{p}</span>
                    <span className="block text-xs text-gray-500 mt-0.5">{SLA_LABELS[p]}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-400">{PRIORITY_DESC[priority]}</p>
            </div>

            {/* Escalation routing hint */}
            {category && ESCALATION_TEAMS[category] && (
              <div className="mt-3 flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
                <svg
                  className="w-4 h-4 text-blue-500 mt-0.5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-xs text-blue-700">
                  Tier 2 escalation would route to: <strong>{ESCALATION_TEAMS[category]}</strong>
                </p>
              </div>
            )}
          </div>

          {/* ── Details ── */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">
              Ticket Details
            </h2>
            <div className="space-y-4">
              <Field label="Title / Subject" required>
                <input
                  className="input"
                  name="title"
                  required
                  placeholder="Brief summary of the issue"
                />
              </Field>
              <Field
                label="Description"
                required
                hint="Include symptoms, affected users, and any steps already tried"
              >
                <textarea
                  className="input min-h-[120px] resize-y"
                  name="description"
                  required
                  placeholder="Describe the issue in detail…"
                />
              </Field>
            </div>
          </div>

          {actionData?.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {actionData.error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Link to="/tickets" className="btn-secondary">
              Cancel
            </Link>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Creating…' : 'Create Ticket'}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
