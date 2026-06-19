import { formatDistanceToNow } from 'date-fns';
import { Link, useLoaderData, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/layout/Layout';
import { PriorityBadge, SlaBadge, StatusBadge, TypeBadge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { SlaBar } from '../components/ui/SlaBar';

const STATUSES = ['New', 'In Progress', 'Escalated', 'Resolved', 'Closed'];
const PRIORITIES = ['P1', 'P2', 'P3', 'P4'];
const TYPES = ['Incident', 'Service Request'];
const CATEGORIES = ['Network', 'Clinical Application', 'Hardware', 'Software', 'Account Access'];

// ─── Loader ──────────────────────────────────────────────────────────────────

export async function ticketsLoader({ request }) {
  const url = new URL(request.url);
  const res = await fetch(`/api/tickets?${url.searchParams}`);
  if (!res.ok) throw new Response('Failed to load tickets', { status: res.status });
  return res.json();
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function TicketsPage() {
  const data = useLoaderData();
  const [searchParams, setSearchParams] = useSearchParams();

  const getParam = (key) => searchParams.get(key) ?? '';

  const setFilter = (key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete('page'); // reset to page 1 on filter change
      return next;
    });
  };

  const setPage = (n) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('page', String(n));
      return next;
    });
  };

  const clearAll = () => setSearchParams({});
  const hasFilters = [...searchParams.keys()].some((k) => k !== 'page');
  const currentPage = parseInt(getParam('page') || '1', 10);

  return (
    <div>
      <PageHeader
        title="Tickets"
        subtitle={data ? `${data.total} ticket${data.total !== 1 ? 's' : ''}` : ''}
        actions={
          <Link to="/tickets/new" className="btn-primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Ticket
          </Link>
        }
      />

      {/* Filter bar */}
      <div className="px-8 py-4 bg-white border-b border-gray-200 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search tickets…"
          value={getParam('search')}
          onChange={(e) => setFilter('search', e.target.value)}
          className="input w-52"
        />
        {[
          { key: 'status', label: 'Status', opts: STATUSES },
          { key: 'priority', label: 'Priority', opts: PRIORITIES },
          { key: 'type', label: 'Type', opts: TYPES },
          { key: 'category', label: 'Category', opts: CATEGORIES },
        ].map(({ key, label, opts }) => (
          <select
            key={key}
            value={getParam(key)}
            onChange={(e) => setFilter(key, e.target.value)}
            className="input w-auto"
          >
            <option value="">All {label}s</option>
            {opts.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        ))}
        {hasFilters && (
          <button onClick={clearAll} className="btn-ghost text-xs">
            Clear filters
          </button>
        )}
      </div>

      <div className="p-8">
        {!data || data.tickets.length === 0 ? (
          <EmptyState
            icon="🎫"
            title="No tickets found"
            description="Try adjusting your filters or create a new ticket."
            action={
              <Link to="/tickets/new" className="btn-primary">
                New Ticket
              </Link>
            }
          />
        ) : (
          <>
            <div className="card divide-y divide-gray-50">
              {data.tickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  to={`/tickets/${ticket.id}`}
                  className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
                >
                  <div className="pt-0.5">
                    <PriorityBadge priority={ticket.priority} />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                        #{ticket.id} — {ticket.title}
                      </span>
                      <TypeBadge type={ticket.type} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                      <span>{ticket.requester_name}</span>
                      {ticket.department && (
                        <>
                          <span>·</span>
                          <span>{ticket.department}</span>
                        </>
                      )}
                      {ticket.category && (
                        <>
                          <span>·</span>
                          <span>{ticket.category}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>
                        {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <SlaBar sla={ticket.sla} />
                  </div>

                  <div className="flex flex-col items-end gap-2 pt-0.5 shrink-0">
                    <StatusBadge status={ticket.status} />
                    <SlaBadge sla={ticket.sla} />
                  </div>
                </Link>
              ))}
            </div>

            {data.totalPages > 1 && (
              <div className="flex justify-center items-center gap-3 mt-6">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                  className="btn-secondary"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-500">
                  Page {data.page} of {data.totalPages}
                </span>
                <button
                  disabled={currentPage === data.totalPages}
                  onClick={() => setPage(currentPage + 1)}
                  className="btn-secondary"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
