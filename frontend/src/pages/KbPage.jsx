import { formatDistanceToNow } from 'date-fns';
import { Link, useLoaderData, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/layout/Layout';
import { EmptyState } from '../components/ui/EmptyState';

const CATEGORIES = ['Network', 'Clinical Application', 'Hardware', 'Software', 'Account Access'];

// ─── Loader ──────────────────────────────────────────────────────────────────

export async function kbLoader({ request }) {
  const url = new URL(request.url);
  const res = await fetch(`/api/kb?${url.searchParams}`, { credentials: 'include' });
  if (!res.ok) throw new Response('Failed to load KB', { status: res.status });
  return res.json();
}

// ─── Article card ─────────────────────────────────────────────────────────────

function ArticleCard({ article }) {
  return (
    <Link
      to={`/kb/${article.id}`}
      className="card p-5 flex flex-col gap-3 hover:shadow-md transition-shadow group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {article.category && (
            <span className="badge bg-gray-100 text-gray-600 mb-1">{article.category}</span>
          )}
          <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 mt-1">
            {article.title}
          </h3>
        </div>
        <svg
          className="w-4 h-4 text-gray-300 shrink-0 mt-1"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>

      <p className="text-xs text-gray-500 line-clamp-2">{article.symptoms}</p>

      {article.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {article.tags.map((tag) => (
            <span key={tag} className="badge bg-blue-50 text-blue-600">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-400 mt-auto pt-1 border-t border-gray-50">
        <span>{article.author}</span>
        <span>{formatDistanceToNow(new Date(article.created_at), { addSuffix: true })}</span>
      </div>
    </Link>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function KbPage() {
  const data = useLoaderData();
  const [searchParams, setSearchParams] = useSearchParams();

  const getParam = (k) => searchParams.get(k) ?? '';

  const setFilter = (key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete('page');
      return next;
    });
  };

  const setPage = (n) =>
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('page', String(n));
      return next;
    });

  const currentPage = parseInt(getParam('page') || '1', 10);

  return (
    <div>
      <PageHeader
        title="Knowledge Base"
        subtitle={data ? `${data.total} article${data.total !== 1 ? 's' : ''}` : ''}
      />

      <div className="px-8 py-4 bg-white border-b border-gray-200 flex gap-3">
        <div className="relative flex-1 max-w-md">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
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
            placeholder="Search articles…"
            value={getParam('search')}
            onChange={(e) => setFilter('search', e.target.value)}
            className="input pl-9 w-full"
          />
        </div>
        <select
          value={getParam('category')}
          onChange={(e) => setFilter('category', e.target.value)}
          className="input w-auto"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="p-8">
        {!data || data.articles.length === 0 ? (
          <EmptyState
            icon="📚"
            title="No articles found"
            description="Resolve a ticket and convert it to a KB article to get started."
          />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {data.articles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>

            {data.totalPages > 1 && (
              <div className="flex justify-center items-center gap-3 mt-8">
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
