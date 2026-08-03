/**
 * Runtime app config from public/config.json (no rebuild to change API / fallback theme).
 */

import type { ClientColorPalette } from '../theme/themeConfig';
import { themeConfig, DEFAULT_CLIENT } from '../theme/themeConfig';

export interface AppRuntimeConfig {
  apiBaseUrl: string;
  themeColors: ClientColorPalette;
}

const FALLBACK: AppRuntimeConfig = {
  apiBaseUrl:
    import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ||
    'http://localhost:3001',
  themeColors: themeConfig[DEFAULT_CLIENT],
};

let runtimeConfig: AppRuntimeConfig = { ...FALLBACK };

export function getRuntimeConfig(): AppRuntimeConfig {
  return runtimeConfig;
}

export function getApiBaseUrl(): string {
  return runtimeConfig.apiBaseUrl;
}

export function setApiBaseUrl(url: string): void {
  runtimeConfig = {
    ...runtimeConfig,
    apiBaseUrl: url.replace(/\/$/, ''),
  };
}

export async function loadRuntimeConfig(): Promise<AppRuntimeConfig> {
  try {
    const res = await fetch(`/config.json?t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      runtimeConfig = { ...FALLBACK };
      return runtimeConfig;
    }
    const json = (await res.json()) as Partial<{
      apiBaseUrl: string;
      themeColors: Partial<ClientColorPalette>;
    }>;

    const apiBaseUrl = (
      json.apiBaseUrl ||
      FALLBACK.apiBaseUrl
    ).replace(/\/$/, '');

    const themeColors: ClientColorPalette = {
      ...FALLBACK.themeColors,
      ...(json.themeColors || {}),
    };

    runtimeConfig = { apiBaseUrl, themeColors };
    return runtimeConfig;
  } catch {
    runtimeConfig = { ...FALLBACK };
    return runtimeConfig;
  }
}
