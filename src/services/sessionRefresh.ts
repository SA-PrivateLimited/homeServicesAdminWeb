import { resolveApiBaseUrl } from '../config/api';
import {
  JWT_STORAGE_KEY,
  normalizeUser,
  persistSession,
  type AdminUser,
} from './backendAuth';

export const AUTH_APP_CONTEXT = 'admin' as const;

let refreshInFlight: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const base = resolveApiBaseUrl().replace(/\/$/, '');
      const url = `${base}/api/auth/refresh`;
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appContext: AUTH_APP_CONTEXT }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        data?: { token?: string; user?: AdminUser & { _id?: string } };
      };
      if (!response.ok || !payload?.data?.token) return null;
      const token = payload.data.token;
      const user = payload.data.user
        ? normalizeUser(payload.data.user)
        : null;
      if (user) {
        persistSession(user, token);
      } else {
        localStorage.setItem(JWT_STORAGE_KEY, token);
      }
      return token;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}
