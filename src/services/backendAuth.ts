import {apiGet, apiPost} from './api/apiClient';

export const JWT_STORAGE_KEY = 'hs_admin_jwt';
export const USER_STORAGE_KEY = 'hs_admin_user';

export interface AdminUser {
  id: string;
  _id?: string;
  email: string;
  name?: string;
  role: string;
  totpEnabled?: boolean;
  /** Capability flags from JWT / profile — never derive from role alone. */
  permissions?: string[];
}

export type LoginStepResult =
  | {kind: 'session'; user: AdminUser; token: string}
  | {
      kind: 'mfa';
      mfaToken: string;
      email?: string;
    }
  | {
      kind: 'mfa_setup';
      mfaToken: string;
      email?: string;
      secret: string;
      otpauthUrl: string;
      qrCodeDataUrl: string;
    };

export function normalizeUser(user: AdminUser & {_id?: string}): AdminUser {
  return {
    ...user,
    id: user.id || user._id || '',
    _id: user._id || user.id,
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
  };
}

export function persistSession(user: AdminUser, token: string) {
  if (user.role !== 'admin') {
    throw new Error('Admin access required');
  }
  localStorage.setItem(JWT_STORAGE_KEY, token);
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export async function getStoredJwt(): Promise<string | null> {
  return localStorage.getItem(JWT_STORAGE_KEY);
}

export async function clearBackendSession(): Promise<void> {
  localStorage.removeItem(JWT_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
}

/** Revalidate stored JWT against the server. */
export async function fetchCurrentAdmin(): Promise<AdminUser> {
  const data = await apiGet<AdminUser & {_id?: string}>('/api/users/me', {
    skipUnauthorizedRedirect: true,
  });
  const user = normalizeUser(data);
  if (user.role !== 'admin') {
    throw new Error('Admin access required');
  }
  return user;
}

export async function loginWithBackend(
  email: string,
  password: string,
): Promise<LoginStepResult> {
  const data = await apiPost<{
    user?: AdminUser;
    admin?: {
      id: string;
      name?: string;
      role: string;
      permissions?: string[];
    };
    token?: string;
    requiresMfa?: boolean;
    requiresMfaSetup?: boolean;
    mfaToken?: string;
    email?: string;
    secret?: string;
    otpauthUrl?: string;
    qrCodeDataUrl?: string;
  }>('/api/auth/login', {email, password}, {skipAuth: true});

  if (data.requiresMfa && data.mfaToken) {
    return {kind: 'mfa', mfaToken: data.mfaToken, email: data.email};
  }

  if (
    data.requiresMfaSetup &&
    data.mfaToken &&
    data.secret &&
    data.qrCodeDataUrl &&
    data.otpauthUrl
  ) {
    return {
      kind: 'mfa_setup',
      mfaToken: data.mfaToken,
      email: data.email,
      secret: data.secret,
      otpauthUrl: data.otpauthUrl,
      qrCodeDataUrl: data.qrCodeDataUrl,
    };
  }

  if (!data.user || !data.token) {
    throw new Error('Unexpected login response');
  }

  const merged: AdminUser = {
    ...data.user,
    permissions:
      data.user.permissions ??
      data.admin?.permissions ??
      [],
  };
  const user = normalizeUser(merged);
  persistSession(user, data.token);
  return {kind: 'session', user, token: data.token};
}

export async function enableMfaWithBackend(
  mfaToken: string,
  code: string,
): Promise<{user: AdminUser; token: string}> {
  const data = await apiPost<{user: AdminUser; token: string}>(
    '/api/auth/mfa/enable',
    {mfaToken, code},
    {skipAuth: true},
  );
  const user = normalizeUser(data.user);
  persistSession(user, data.token);
  return {user, token: data.token};
}

export async function verifyMfaWithBackend(
  mfaToken: string,
  code: string,
): Promise<{user: AdminUser; token: string}> {
  const data = await apiPost<{user: AdminUser; token: string}>(
    '/api/auth/mfa/verify',
    {mfaToken, code},
    {skipAuth: true},
  );
  const user = normalizeUser(data.user);
  persistSession(user, data.token);
  return {user, token: data.token};
}

/** Best-effort server logout; always clear local session afterward. */
export async function logoutWithBackend(): Promise<void> {
  try {
    await apiPost(
      '/api/auth/logout',
      { appContext: 'admin' },
      { skipAuth: true, skipUnauthorizedRedirect: true, skipRefresh: true },
    );
  } catch {
    // ignore — local clear still proceeds
  }
}

export function readStoredUser(): AdminUser | null {
  const raw = localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return normalizeUser(JSON.parse(raw) as AdminUser);
  } catch {
    return null;
  }
}
