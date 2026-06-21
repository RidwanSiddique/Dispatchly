import { createBrowserRouter, RouterProvider, redirect } from 'react-router-dom';

import { Layout } from './components/layout/Layout';
import { AdminUsersPage, adminUsersAction, adminUsersLoader } from './pages/AdminUsersPage';
import CatalogPage, { catalogAction, catalogLoader } from './pages/CatalogPage';
import ChangeDetailPage, { changeDetailAction, changeDetailLoader } from './pages/ChangeDetailPage';
import ChangesPage, { changesAction, changesLoader } from './pages/ChangesPage';
import { DashboardPage, dashboardLoader } from './pages/DashboardPage';
import { KbArticlePage, kbArticleLoader } from './pages/KbArticlePage';
import { KbPage, kbLoader } from './pages/KbPage';
import LoginPage, { loginAction } from './pages/LoginPage';
import { NewTicketPage, newTicketAction } from './pages/NewTicketPage';
import OnCallPage, { onCallAction, onCallLoader } from './pages/OnCallPage';
import ProblemDetailPage, {
  problemDetailAction,
  problemDetailLoader,
} from './pages/ProblemDetailPage';
import ProblemsPage, { problemsAction, problemsLoader } from './pages/ProblemsPage';
import { TicketDetailPage, ticketDetailAction, ticketDetailLoader } from './pages/TicketDetailPage';
import { TicketsPage, ticketsLoader } from './pages/TicketsPage';

/**
 * Root loader — fetches the current user.
 * If not authenticated, redirects to /login preserving the intended destination.
 */
async function rootLoader({ request }) {
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  if (!res.ok) {
    const url = new URL(request.url);
    const from = url.pathname + url.search;
    throw redirect(`/login?from=${encodeURIComponent(from)}`);
  }
  return res.json(); // { user: { userId, email, name, role, department } }
}

/**
 * Logout action — called via fetcher.submit from the Layout.
 */
async function logoutAction() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  return redirect('/login');
}

const router = createBrowserRouter([
  // ── Public routes (no auth check) ─────────────────────────────────────────
  {
    path: '/login',
    element: <LoginPage />,
    action: loginAction,
  },

  // ── Logout action endpoint ─────────────────────────────────────────────────
  {
    path: '/logout',
    action: logoutAction,
  },

  // ── Protected routes ───────────────────────────────────────────────────────
  {
    id: 'root',
    loader: rootLoader,
    element: <Layout />,
    children: [
      { index: true, element: <DashboardPage />, loader: dashboardLoader },
      { path: 'tickets', element: <TicketsPage />, loader: ticketsLoader },
      { path: 'tickets/new', element: <NewTicketPage />, action: newTicketAction },
      {
        path: 'tickets/:id',
        element: <TicketDetailPage />,
        loader: ticketDetailLoader,
        action: ticketDetailAction,
      },
      {
        path: 'catalog',
        element: <CatalogPage />,
        loader: catalogLoader,
        action: catalogAction,
      },
      { path: 'kb', element: <KbPage />, loader: kbLoader },
      { path: 'kb/:id', element: <KbArticlePage />, loader: kbArticleLoader },

      // Problem Management
      {
        path: 'problems',
        element: <ProblemsPage />,
        loader: problemsLoader,
        action: problemsAction,
      },
      {
        path: 'problems/:id',
        element: <ProblemDetailPage />,
        loader: problemDetailLoader,
        action: problemDetailAction,
      },

      // Change Management
      {
        path: 'changes',
        element: <ChangesPage />,
        loader: changesLoader,
        action: changesAction,
      },
      {
        path: 'changes/:id',
        element: <ChangeDetailPage />,
        loader: changeDetailLoader,
        action: changeDetailAction,
      },

      // Admin-only: on-call schedule
      {
        path: 'admin/schedule',
        element: <OnCallPage />,
        loader: onCallLoader,
        action: onCallAction,
      },

      // Admin-only: user management
      {
        path: 'admin/users',
        element: <AdminUsersPage />,
        loader: adminUsersLoader,
        action: adminUsersAction,
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
