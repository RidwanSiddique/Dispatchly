import { createBrowserRouter, RouterProvider, redirect } from 'react-router-dom';

import { Layout } from './components/layout/Layout';
import { AdminUsersPage, adminUsersAction, adminUsersLoader } from './pages/AdminUsersPage';
import { DashboardPage, dashboardLoader } from './pages/DashboardPage';
import { KbArticlePage, kbArticleLoader } from './pages/KbArticlePage';
import { KbPage, kbLoader } from './pages/KbPage';
import LoginPage, { loginAction } from './pages/LoginPage';
import { NewTicketPage, newTicketAction } from './pages/NewTicketPage';
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
      { path: 'kb', element: <KbPage />, loader: kbLoader },
      { path: 'kb/:id', element: <KbArticlePage />, loader: kbArticleLoader },

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
