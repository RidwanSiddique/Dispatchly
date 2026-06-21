import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

const TYPE_CONFIG = {
  sla_at_risk: { icon: '🟡', label: 'At Risk' },
  sla_breached: { icon: '🔴', label: 'Breached' },
  auto_escalated: { icon: '⚡', label: 'Escalated' },
  approval_needed: { icon: '📋', label: 'Approval' },
  approval_resolved: { icon: '✅', label: 'Resolved' },
  ticket_assigned: { icon: '📌', label: 'Assigned' },
  ticket_updated: { icon: '🔄', label: 'Updated' },
  ticket_replied: { icon: '💬', label: 'Reply' },
  ticket_escalated: { icon: '⚠️', label: 'Escalated' },
  new_ticket: { icon: '🎫', label: 'New Ticket' },
  email_ticket: { icon: '📧', label: 'Email' },
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNots] = useState([]);
  const [unreadCount, setUnread] = useState(0);
  const dropdownRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setNots(data.notifications);
      setUnread(data.unreadCount);
    } catch {}
  }, []);

  // Poll every 30s for new notifications
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function markAllRead() {
    await fetch('/api/notifications/read-all', { method: 'PATCH', credentials: 'include' });
    setNots((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
  }

  async function markRead(id) {
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH', credentials: 'include' });
    setNots((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnread((c) => Math.max(0, c - 1));
  }

  function toggleOpen() {
    setOpen((v) => !v);
    if (!open) fetchNotifications();
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        type="button"
        onClick={toggleOpen}
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-700 hover:text-white"
        aria-label="Notifications"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute bottom-10 left-0 z-50 w-80 rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <span className="text-sm font-semibold text-gray-800">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs text-blue-600 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">No notifications yet</div>
            ) : (
              notifications.map((n) => {
                const cfg = TYPE_CONFIG[n.type] || { icon: '📣', label: '' };
                return (
                  <div
                    key={n.id}
                    className={`flex gap-3 px-4 py-3 transition hover:bg-gray-50 ${!n.is_read ? 'bg-blue-50' : ''}`}
                  >
                    <span className="mt-0.5 text-base leading-none">{cfg.icon}</span>
                    <div className="min-w-0 flex-1">
                      {n.ticket_id ? (
                        <Link
                          to={`/tickets/${n.ticket_id}`}
                          onClick={() => {
                            markRead(n.id);
                            setOpen(false);
                          }}
                          className="block text-sm text-gray-700 hover:text-blue-600"
                        >
                          {n.message}
                        </Link>
                      ) : (
                        <p className="text-sm text-gray-700">{n.message}</p>
                      )}
                      <p className="mt-0.5 text-xs text-gray-400">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.is_read && (
                      <button
                        type="button"
                        onClick={() => markRead(n.id)}
                        className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500"
                        title="Mark as read"
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
