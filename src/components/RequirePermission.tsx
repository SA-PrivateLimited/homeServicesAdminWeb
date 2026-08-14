import {Navigate, Outlet} from 'react-router-dom';
import {usePermissions} from '../hooks/usePermissions';
import {PERMISSIONS, type Permission} from '../constants/permissions';

const FALLBACK_ORDER: Array<{to: string; permission: Permission}> = [
  {to: '/', permission: PERMISSIONS.OVERVIEW_VIEW},
  {to: '/jobs', permission: PERMISSIONS.JOBS_VIEW},
  {to: '/providers', permission: PERMISSIONS.PROVIDERS_VIEW},
  {to: '/customers', permission: PERMISSIONS.CUSTOMERS_VIEW},
  {to: '/categories', permission: PERMISSIONS.CATEGORIES_VIEW},
  {to: '/geography', permission: PERMISSIONS.GEOGRAPHY_VIEW},
  {to: '/contacts', permission: PERMISSIONS.CONTACTS_VIEW},
  {to: '/clients', permission: PERMISSIONS.CLIENTS_VIEW},
  {to: '/admins', permission: PERMISSIONS.ADMINS_VIEW},
];

export function firstAllowedPath(
  canAccess: (p: string) => boolean,
  exclude?: string,
): string {
  for (const item of FALLBACK_ORDER) {
    if (exclude && item.to === exclude) continue;
    if (canAccess(item.permission)) return item.to;
  }
  return '/login';
}

/**
 * Route guard: requires at least one of the given permissions
 * (or Super Admin elevation).
 */
export function RequirePermission({
  permission,
  anyOf,
  fallback,
}: {
  permission?: Permission | string;
  anyOf?: Array<Permission | string>;
  fallback?: string;
}) {
  const {canAccess, hasAnyPermission} = usePermissions();

  const allowed = permission
    ? canAccess(permission)
    : anyOf?.length
      ? hasAnyPermission(anyOf)
      : true;

  if (!allowed) {
    const to = fallback ?? firstAllowedPath(canAccess);
    return <Navigate to={to} replace />;
  }

  return <Outlet />;
}
