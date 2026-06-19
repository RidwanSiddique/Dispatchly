import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import { Layout } from './components/layout/Layout';
import { DashboardPage, dashboardLoader } from './pages/DashboardPage';
import { KbArticlePage, kbArticleLoader } from './pages/KbArticlePage';
import { KbPage, kbLoader } from './pages/KbPage';
import { NewTicketPage, newTicketAction } from './pages/NewTicketPage';
import { TicketDetailPage, ticketDetailAction, ticketDetailLoader } from './pages/TicketDetailPage';
import { TicketsPage, ticketsLoader } from './pages/TicketsPage';

const router = createBrowserRouter([
  {
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
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
