/**
 * Auth context helpers — thin wrappers around React Router v7's data layer.
 *
 * The root route loader (App.jsx) fetches /api/auth/me and populates the
 * root route data. Components access it via useCurrentUser() from here.
 */

import { useRouteLoaderData } from 'react-router-dom';

/**
 * Returns the currently authenticated user object:
 *   { userId, email, name, role, department }
 * Returns null when unauthenticated (only available on pages outside the
 * protected root route — normally you'd be redirected).
 */
export function useCurrentUser() {
  const data = useRouteLoaderData('root');
  return data?.user ?? null;
}

/**
 * Returns true if the current user has one of the given roles.
 * Admin always returns true regardless of which roles are passed.
 */
export function useHasRole(...roles) {
  const user = useCurrentUser();
  if (!user) return false;
  if (user.role === 'admin') return true;
  return roles.includes(user.role);
}

// Role sets for convenience
export const STAFF_ROLES = ['admin', 'manager', 'agent', 'technician', 'specialist'];
export const REQUESTER_ROLES = ['hr', 'client'];
export const CAN_ESCALATE = ['admin', 'manager', 'agent'];
export const CAN_RESOLVE = ['admin', 'manager', 'agent', 'technician', 'specialist'];
export const CAN_MANAGE_KB = ['admin', 'manager', 'specialist'];
export const CAN_CONVERT_KB = ['admin', 'manager', 'agent', 'specialist'];
