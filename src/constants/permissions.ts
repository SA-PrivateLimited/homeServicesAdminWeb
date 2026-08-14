/**
 * Centralized admin capability permissions (mirrors backend constants).
 * Do not hardcode permission strings at call sites.
 */

export const PERMISSIONS = {
  OVERVIEW_VIEW: 'overview.view',

  PROVIDERS_VIEW: 'providers.view',
  PROVIDERS_CREATE: 'providers.create',
  PROVIDERS_UPDATE: 'providers.update',
  PROVIDERS_DELETE: 'providers.delete',

  CUSTOMERS_VIEW: 'customers.view',
  CUSTOMERS_CREATE: 'customers.create',
  CUSTOMERS_UPDATE: 'customers.update',
  CUSTOMERS_DELETE: 'customers.delete',

  JOBS_VIEW: 'jobs.view',
  JOBS_ASSIGN: 'jobs.assign',
  JOBS_UPDATE: 'jobs.update',
  JOBS_DELETE: 'jobs.delete',

  CATEGORIES_VIEW: 'categories.view',
  CATEGORIES_CREATE: 'categories.create',
  CATEGORIES_UPDATE: 'categories.update',
  CATEGORIES_DELETE: 'categories.delete',

  GEOGRAPHY_VIEW: 'geography.view',
  GEOGRAPHY_UPDATE: 'geography.update',

  CONTACTS_VIEW: 'contacts.view',
  CONTACTS_UPDATE: 'contacts.update',

  CLIENTS_VIEW: 'clients.view',
  CLIENTS_CREATE: 'clients.create',
  CLIENTS_UPDATE: 'clients.update',
  CLIENTS_DELETE: 'clients.delete',

  ADMINS_VIEW: 'admins.view',
  ADMINS_MANAGE: 'admins.manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSION_VALUES: Permission[] = Object.values(PERMISSIONS);

export interface PermissionModule {
  id: string;
  label: string;
  permissions: Permission[];
}

/** Invite / edit UI module groups — checking a module grants all of its permissions. */
export const PERMISSION_MODULES: PermissionModule[] = [
  {
    id: 'overview',
    label: 'Overview',
    permissions: [PERMISSIONS.OVERVIEW_VIEW],
  },
  {
    id: 'providers',
    label: 'Providers',
    permissions: [
      PERMISSIONS.PROVIDERS_VIEW,
      PERMISSIONS.PROVIDERS_CREATE,
      PERMISSIONS.PROVIDERS_UPDATE,
      PERMISSIONS.PROVIDERS_DELETE,
    ],
  },
  {
    id: 'customers',
    label: 'Customers',
    permissions: [
      PERMISSIONS.CUSTOMERS_VIEW,
      PERMISSIONS.CUSTOMERS_CREATE,
      PERMISSIONS.CUSTOMERS_UPDATE,
      PERMISSIONS.CUSTOMERS_DELETE,
    ],
  },
  {
    id: 'jobs',
    label: 'Jobs',
    permissions: [
      PERMISSIONS.JOBS_VIEW,
      PERMISSIONS.JOBS_ASSIGN,
      PERMISSIONS.JOBS_UPDATE,
      PERMISSIONS.JOBS_DELETE,
    ],
  },
  {
    id: 'categories',
    label: 'Categories',
    permissions: [
      PERMISSIONS.CATEGORIES_VIEW,
      PERMISSIONS.CATEGORIES_CREATE,
      PERMISSIONS.CATEGORIES_UPDATE,
      PERMISSIONS.CATEGORIES_DELETE,
    ],
  },
  {
    id: 'geography',
    label: 'Geography',
    permissions: [PERMISSIONS.GEOGRAPHY_VIEW, PERMISSIONS.GEOGRAPHY_UPDATE],
  },
  {
    id: 'contacts',
    label: 'Contacts',
    permissions: [PERMISSIONS.CONTACTS_VIEW, PERMISSIONS.CONTACTS_UPDATE],
  },
  {
    id: 'clients',
    label: 'Clients',
    permissions: [
      PERMISSIONS.CLIENTS_VIEW,
      PERMISSIONS.CLIENTS_CREATE,
      PERMISSIONS.CLIENTS_UPDATE,
      PERMISSIONS.CLIENTS_DELETE,
    ],
  },
];

export function defaultInvitePermissions(): Permission[] {
  return [...ALL_PERMISSION_VALUES];
}

export function expandModulePermissions(moduleIds: string[]): Permission[] {
  const set = new Set<Permission>();
  for (const id of moduleIds) {
    const mod = PERMISSION_MODULES.find((m) => m.id === id);
    if (!mod) continue;
    for (const p of mod.permissions) set.add(p);
  }
  return [...set];
}

/** Module is fully selected when every permission in the group is present. */
export function isModuleSelected(
  moduleId: string,
  permissions: string[],
): boolean {
  const mod = PERMISSION_MODULES.find((m) => m.id === moduleId);
  if (!mod) return false;
  return mod.permissions.every((p) => permissions.includes(p));
}

export function toggleModulePermissions(
  moduleId: string,
  current: string[],
  selected: boolean,
): Permission[] {
  const mod = PERMISSION_MODULES.find((m) => m.id === moduleId);
  if (!mod) return current as Permission[];
  const set = new Set(current);
  if (selected) {
    for (const p of mod.permissions) set.add(p);
  } else {
    for (const p of mod.permissions) set.delete(p);
  }
  return [...set] as Permission[];
}

export function permissionLabel(permission: string): string {
  return permission.replace(/\./g, ' · ');
}
