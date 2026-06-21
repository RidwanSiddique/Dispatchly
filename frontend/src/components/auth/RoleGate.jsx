/**
 * RoleGate — conditionally renders children based on the current user's role.
 *
 * Usage:
 *   <RoleGate roles={['admin', 'manager']}>
 *     <AdminOnlyButton />
 *   </RoleGate>
 *
 *   <RoleGate roles={['admin']} fallback={<p>Access denied</p>}>
 *     <AdminPanel />
 *   </RoleGate>
 */

import { useHasRole } from '../../context/AuthContext';

export function RoleGate({ roles = [], fallback = null, children }) {
  const allowed = useHasRole(...roles);
  return allowed ? children : fallback;
}
