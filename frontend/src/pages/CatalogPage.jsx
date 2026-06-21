import { useState } from 'react';
import {
  Form,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
  useSubmit,
} from 'react-router-dom';
import { PageHeader } from '../components/layout/Layout';

// ─── Loader ──────────────────────────────────────────────────────────────────

export async function catalogLoader() {
  const res = await fetch('/api/catalog', { credentials: 'include' });
  if (!res.ok) throw new Response('Failed to load catalog', { status: res.status });
  return res.json();
}

// ─── Action ──────────────────────────────────────────────────────────────────

export async function catalogAction({ request }) {
  const formData = await request.formData();
  const itemId = formData.get('_catalogItemId');

  // Build the body object from all dynamic fields
  const body = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('_')) body[key] = value;
  }

  const res = await fetch(`/api/catalog/${itemId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ body }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to submit' }));
    return { error: err.error || 'Failed to submit request' };
  }

  const { ticket } = await res.json();
  return redirect(`/tickets/${ticket.id}`);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORY_COLORS = {
  'Account Access': 'bg-purple-100 text-purple-700',
  Hardware: 'bg-yellow-100 text-yellow-700',
  Software: 'bg-blue-100 text-blue-700',
  Network: 'bg-green-100 text-green-700',
  Other: 'bg-gray-100 text-gray-600',
};

function formatEst(minutes) {
  if (!minutes) return null;
  if (minutes < 60) return `~${minutes}m`;
  if (minutes < 1440) return `~${Math.round(minutes / 60)}h`;
  return `~${Math.round(minutes / 1440)}d`;
}

// ─── Catalog card ─────────────────────────────────────────────────────────────

function CatalogCard({ item, onSelect }) {
  const catColor = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Other;
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="group flex flex-col rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-blue-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="text-3xl leading-none">{item.icon}</span>
        {item.requires_approval && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            Needs approval
          </span>
        )}
      </div>
      <p className="mb-1 font-semibold text-gray-900 group-hover:text-blue-700">{item.name}</p>
      <p className="mb-3 flex-1 text-sm text-gray-500">{item.description}</p>
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${catColor}`}>
          {item.category || 'Other'}
        </span>
        {item.estimated_minutes && (
          <span className="text-xs text-gray-400">{formatEst(item.estimated_minutes)} typical</span>
        )}
      </div>
    </button>
  );
}

// ─── Dynamic field renderer ───────────────────────────────────────────────────

function CatalogField({ field }) {
  const base =
    'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

  if (field.field_type === 'textarea') {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700">
          {field.field_label}
          {field.is_required && <span className="ml-1 text-red-500">*</span>}
        </label>
        <textarea
          name={field.field_name}
          required={field.is_required}
          placeholder={field.placeholder || ''}
          rows={3}
          className={`${base} resize-none`}
        />
      </div>
    );
  }

  if (field.field_type === 'select') {
    const options = Array.isArray(field.options)
      ? field.options
      : typeof field.options === 'string'
        ? JSON.parse(field.options)
        : [];
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700">
          {field.field_label}
          {field.is_required && <span className="ml-1 text-red-500">*</span>}
        </label>
        <select
          name={field.field_name}
          required={field.is_required}
          className={base}
          defaultValue=""
        >
          <option value="" disabled>
            Select…
          </option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.field_type === 'checkbox') {
    return (
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id={field.field_name}
          name={field.field_name}
          value="yes"
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor={field.field_name} className="text-sm font-medium text-gray-700">
          {field.field_label}
          {field.is_required && <span className="ml-1 text-red-500">*</span>}
        </label>
      </div>
    );
  }

  // default: text
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">
        {field.field_label}
        {field.is_required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <input
        type="text"
        name={field.field_name}
        required={field.is_required}
        placeholder={field.placeholder || ''}
        className={base}
      />
    </div>
  );
}

// ─── Request form (slide-over panel) ─────────────────────────────────────────

function RequestPanel({ item, onClose }) {
  const actionData = useActionData();
  const navigation = useNavigation();
  const submitting = navigation.state === 'submitting';

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close panel"
        className="flex-1 bg-black/40 cursor-default"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="w-full max-w-md overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{item.icon}</span>
            <div>
              <p className="font-semibold text-gray-900">{item.name}</p>
              {item.requires_approval && (
                <p className="text-xs text-amber-600">Requires manager approval</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <Form method="post" className="px-6 py-6 space-y-5">
          <input type="hidden" name="_catalogItemId" value={item.id} />

          {/* Dynamic fields */}
          {item.fields.map((f) => (
            <CatalogField key={f.id} field={f} />
          ))}

          {/* Additional info */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Additional notes <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              name="additionalInfo"
              rows={2}
              className="mt-1 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Anything else we should know?"
            />
          </div>

          {actionData?.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {actionData.error}
            </p>
          )}

          {item.requires_approval && (
            <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span className="font-medium">Approval required. </span>
              Your request will be sent to a manager before work begins.
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-ghost flex-1">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary flex-1">
              {submitting
                ? 'Submitting…'
                : item.requires_approval
                  ? 'Submit for Approval'
                  : 'Submit Request'}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const CATEGORIES = ['All', 'Account Access', 'Hardware', 'Software', 'Network', 'Other'];

export default function CatalogPage() {
  const { items } = useLoaderData();
  const [selected, setSelected] = useState(null);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');

  const filtered = items.filter((item) => {
    const matchCat = category === 'All' || item.category === category;
    const matchText =
      !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchText;
  });

  return (
    <>
      <PageHeader title="Service Catalog" subtitle="Pick a service to submit a request" />

      <div className="px-8 py-6">
        {/* Search + filter */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-48">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search services…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  category === cat
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-300 hover:border-blue-400 hover:text-blue-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <p className="text-4xl mb-3">🔍</p>
            <p>No services match your search.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((item) => (
              <CatalogCard key={item.id} item={item} onSelect={setSelected} />
            ))}
          </div>
        )}
      </div>

      {selected && <RequestPanel item={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
