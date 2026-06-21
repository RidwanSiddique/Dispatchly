import { format } from 'date-fns';
import { Link, useLoaderData } from 'react-router-dom';
import { PageHeader } from '../components/layout/Layout';

// ─── Loader ──────────────────────────────────────────────────────────────────

export async function kbArticleLoader({ params }) {
  const res = await fetch(`/api/kb/${params.id}`, { credentials: 'include' });
  if (!res.ok) throw new Response('Article not found', { status: res.status });
  return res.json();
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function KbArticlePage() {
  const article = useLoaderData();
  const steps = article.resolution_steps.split('\n').filter(Boolean);

  return (
    <div>
      <PageHeader
        title="KB Article"
        subtitle={article.title}
        actions={
          <Link to="/kb" className="btn-ghost">
            ← Back to KB
          </Link>
        }
      />

      <div className="p-8 max-w-3xl space-y-6">
        {/* Meta */}
        <div className="card p-5">
          <div className="flex items-center gap-3 flex-wrap mb-3">
            {article.category && (
              <span className="badge bg-gray-100 text-gray-600">{article.category}</span>
            )}
            {article.tags?.map((tag) => (
              <span key={tag} className="badge bg-blue-50 text-blue-600">
                {tag}
              </span>
            ))}
          </div>
          <h1 className="text-lg font-bold text-gray-900">{article.title}</h1>
          <p className="mt-1 text-xs text-gray-400">
            By {article.author} · {format(new Date(article.created_at), 'MMMM d, yyyy')}
          </p>

          {article.sourceTicket && (
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
              <svg
                className="w-3.5 h-3.5 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <span>Source ticket:</span>
              <Link
                to={`/tickets/${article.sourceTicket.id}`}
                className="text-blue-600 hover:underline font-medium"
              >
                #{article.sourceTicket.id} — {article.sourceTicket.title}
              </Link>
            </div>
          )}
        </div>

        {/* Symptoms */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <svg
              className="w-4 h-4 text-amber-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            Symptoms
          </h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{article.symptoms}</p>
        </div>

        {/* Resolution steps */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <svg
              className="w-4 h-4 text-emerald-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Resolution Steps
          </h2>
          {steps.length > 1 ? (
            <ol className="space-y-3">
              {steps.map((step, i) => (
                <li key={step} className="flex gap-3 text-sm text-gray-700">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step.replace(/^\d+\.\s*/, '')}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{article.resolution_steps}</p>
          )}
        </div>
      </div>
    </div>
  );
}
