import { getApiBaseUrl } from './runtime';

/** Prefer runtime config (public/config.json); env is fallback until boot. */
export const API_BASE_URL = getApiBaseUrl();

export function resolveApiBaseUrl(): string {
  return getApiBaseUrl();
}

export const API_TIMEOUT = 30000;
