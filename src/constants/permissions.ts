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

  /** Dedicated Partner bulk onboarding module (Excel paste → insert). */
  PARTNER_BULK_ONBOARDING_VIEW: 'partner-bulk-onboarding.view',
  PARTNER_BULK_ONBOARDING_UPDATE: 'partner-bulk-onboarding.update',

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

  CATEGORY_SECTIONS_VIEW: 'category-sections.view',
  CATEGORY_SECTIONS_CREATE: 'category-sections.create',
  CATEGORY_SECTIONS_UPDATE: 'category-sections.update',
  CATEGORY_SECTIONS_DELETE: 'category-sections.delete',

  GEOGRAPHY_VIEW: 'geography.view',
  GEOGRAPHY_UPDATE: 'geography.update',

  CONTACTS_VIEW: 'contacts.view',
  CONTACTS_UPDATE: 'contacts.update',

  FEEDBACKS_VIEW: 'feedbacks.view',
  FEEDBACKS_UPDATE: 'feedbacks.update',

  /** Admin settings hub (sidebar: Permissions). */
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_UPDATE: 'settings.update',

  CLIENTS_VIEW: 'clients.view',
  CLIENTS_CREATE: 'clients.create',
  CLIENTS_UPDATE: 'clients.update',
  CLIENTS_DELETE: 'clients.delete',

  GREETING_VIEW: 'greeting.view',
  GREETING_UPDATE: 'greeting.update',

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

/** Invite / edit UI module groups — View and Edit are controlled separately. */
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
    id: 'partner-bulk-onboarding',
    label: 'Partner bulk onboarding',
    permissions: [
      PERMISSIONS.PARTNER_BULK_ONBOARDING_VIEW,
      PERMISSIONS.PARTNER_BULK_ONBOARDING_UPDATE,
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
    id: 'category-sections',
    label: 'Category sections',
    permissions: [
      PERMISSIONS.CATEGORY_SECTIONS_VIEW,
      PERMISSIONS.CATEGORY_SECTIONS_CREATE,
      PERMISSIONS.CATEGORY_SECTIONS_UPDATE,
      PERMISSIONS.CATEGORY_SECTIONS_DELETE,
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
    id: 'feedbacks',
    label: 'Feedbacks',
    permissions: [PERMISSIONS.FEEDBACKS_VIEW, PERMISSIONS.FEEDBACKS_UPDATE],
  },
  {
    id: 'settings',
    label: 'Permissions',
    permissions: [PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.SETTINGS_UPDATE],
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
  {
    id: 'greeting',
    label: 'Greeting',
    permissions: [PERMISSIONS.GREETING_VIEW, PERMISSIONS.GREETING_UPDATE],
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

/** View capability for a module (`*.view`), if any. */
export function moduleViewPermission(moduleId: string): Permission | null {
  const mod = PERMISSION_MODULES.find((m) => m.id === moduleId);
  if (!mod) return null;
  return mod.permissions.find((p) => p.endsWith('.view')) ?? null;
}

/** Mutation capabilities for a module (everything except `*.view`). */
export function moduleEditPermissions(moduleId: string): Permission[] {
  const mod = PERMISSION_MODULES.find((m) => m.id === moduleId);
  if (!mod) return [];
  return mod.permissions.filter((p) => !p.endsWith('.view'));
}

export function isModuleViewSelected(
  moduleId: string,
  permissions: string[],
): boolean {
  const view = moduleViewPermission(moduleId);
  return view ? permissions.includes(view) : false;
}

/** Edit is on when every mutation permission for the module is present. */
export function isModuleEditSelected(
  moduleId: string,
  permissions: string[],
): boolean {
  const edits = moduleEditPermissions(moduleId);
  if (!edits.length) return false;
  return edits.every((p) => permissions.includes(p));
}

/**
 * Toggle module View. Turning View off also clears Edit.
 * Turning View on does not automatically grant Edit.
 */
export function setModuleView(
  moduleId: string,
  current: string[],
  enabled: boolean,
): Permission[] {
  const mod = PERMISSION_MODULES.find((m) => m.id === moduleId);
  if (!mod) return current as Permission[];
  const set = new Set(current);
  const view = moduleViewPermission(moduleId);
  const edits = moduleEditPermissions(moduleId);
  if (enabled) {
    if (view) set.add(view);
  } else {
    if (view) set.delete(view);
    for (const p of edits) set.delete(p);
  }
  return [...set] as Permission[];
}

/**
 * Toggle module Edit. Turning Edit on also enables View.
 * Turning Edit off keeps View if it was set.
 */
export function setModuleEdit(
  moduleId: string,
  current: string[],
  enabled: boolean,
): Permission[] {
  const mod = PERMISSION_MODULES.find((m) => m.id === moduleId);
  if (!mod) return current as Permission[];
  const set = new Set(current);
  const view = moduleViewPermission(moduleId);
  const edits = moduleEditPermissions(moduleId);
  if (enabled) {
    if (view) set.add(view);
    for (const p of edits) set.add(p);
  } else {
    for (const p of edits) set.delete(p);
  }
  return [...set] as Permission[];
}

/** Ensure any mutation permission implies the module's View permission. */
export function ensureViewWithEdit(permissions: string[]): Permission[] {
  const set = new Set(normalizeKnown(permissions));
  for (const mod of PERMISSION_MODULES) {
    const view = moduleViewPermission(mod.id);
    const edits = moduleEditPermissions(mod.id);
    if (!view || !edits.length) continue;
    if (edits.some((p) => set.has(p))) set.add(view);
  }
  return [...set] as Permission[];
}

function normalizeKnown(permissions: string[]): Permission[] {
  const known = new Set<string>(ALL_PERMISSION_VALUES);
  const out: Permission[] = [];
  const seen = new Set<string>();
  for (const raw of permissions) {
    const p = String(raw || '').trim();
    if (!p || seen.has(p) || !known.has(p)) continue;
    seen.add(p);
    out.push(p as Permission);
  }
  return out;
}
