import {useAuthStore} from '../store/authStore';
import type {Permission} from '../constants/permissions';

/**
 * RBAC helpers. Super Admin elevation always returns true.
 * Permissions come from the logged-in admin document / JWT snapshot (Option 1).
 */
export function usePermissions() {
  const user = useAuthStore((s) => s.user);
  const superAdminElevated = useAuthStore((s) => s.superAdminElevated);
  const permissions = user?.permissions ?? [];

  const hasPermission = (permission: Permission | string): boolean => {
    if (superAdminElevated) return true;
    return permissions.includes(permission);
  };

  /** Alias of hasPermission for route / nav gates. */
  const canAccess = (permission: Permission | string): boolean =>
    hasPermission(permission);

  const hasAnyPermission = (
    required: Array<Permission | string>,
  ): boolean => {
    if (superAdminElevated) return true;
    return required.some((p) => permissions.includes(p));
  };

  const hasAllPermissions = (
    required: Array<Permission | string>,
  ): boolean => {
    if (superAdminElevated) return true;
    return required.every((p) => permissions.includes(p));
  };

  return {
    permissions,
    superAdminElevated,
    hasPermission,
    canAccess,
    hasAnyPermission,
    hasAllPermissions,
  };
}
