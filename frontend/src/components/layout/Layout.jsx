import { Outlet, useFetcher } from 'react-router-dom';
import { useCurrentUser } from '../../context/AuthContext';
import { NotificationBell } from '../ui/NotificationBell';
import { Sidebar } from './Sidebar';

function UserMenu() {
  const user = useCurrentUser();
  const fetcher = useFetcher();

  if (!user) return null;

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const roleLabel =
    {
      admin: 'Admin',
      manager: 'Manager',
      agent: 'Agent',
      technician: 'Technician',
      specialist: 'Specialist',
      hr: 'HR',
      client: 'Client',
    }[user.role] ?? user.role;

  return (
    <div className="px-3 py-3 border-t border-gray-200 mt-auto">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
          <p className="text-xs text-gray-500 truncate">{roleLabel}</p>
        </div>
        <NotificationBell />
      </div>
      <fetcher.Form method="post" action="/logout">
        <button
          type="submit"
          className="btn btn-ghost w-full justify-start text-xs text-gray-500 hover:text-red-600"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          Sign out
        </button>
      </fetcher.Form>
    </div>
  );
}

export function Layout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className="flex flex-col w-60 flex-shrink-0 bg-white border-r border-gray-200">
        <Sidebar />
        <UserMenu />
      </div>
      <main className="flex-1 min-w-0 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex items-center justify-between px-8 py-6 border-b border-gray-200 bg-white sticky top-0 z-10">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}
