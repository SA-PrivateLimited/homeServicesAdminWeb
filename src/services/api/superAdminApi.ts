import {apiPost, apiPut} from './apiClient';

export const SUPER_ADMIN_TOKEN_KEY = 'hs_super_admin_token';

export function getStoredSuperAdminToken(): string | null {
  return sessionStorage.getItem(SUPER_ADMIN_TOKEN_KEY);
}

export function clearSuperAdminToken(): void {
  sessionStorage.removeItem(SUPER_ADMIN_TOKEN_KEY);
}

export function isSuperAdminElevated(): boolean {
  return Boolean(getStoredSuperAdminToken());
}

export async function elevateSuperAdmin(
  code: string,
): Promise<{superAdminToken: string; expiresIn: string}> {
  const data = await apiPost<{superAdminToken: string; expiresIn: string}>(
    '/api/superadmin/elevate',
    {code},
  );
  sessionStorage.setItem(SUPER_ADMIN_TOKEN_KEY, data.superAdminToken);
  return data;
}

export async function updateSuperAdminKey(
  currentCode: string,
  newCode: string,
): Promise<void> {
  await apiPut('/api/superadmin/key', {currentCode, newCode});
}
