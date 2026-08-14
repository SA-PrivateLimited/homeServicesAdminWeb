/**
 * Runtime app config from public/config.json + GET /api/branding.
 */

import type {ClientColorPalette} from '../theme/themeConfig';
import {themeConfig, DEFAULT_CLIENT} from '../theme/themeConfig';

export interface AppRuntimeConfig {
  apiBaseUrl: string;
  brandName: string;
  logoUrl?: string;
  themeColors: ClientColorPalette;
}

const FALLBACK: AppRuntimeConfig = {
  apiBaseUrl:
    import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ||
    'http://localhost:3001',
  brandName: 'Admin',
  themeColors: themeConfig[DEFAULT_CLIENT],
};

let runtimeConfig: AppRuntimeConfig = {...FALLBACK};

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

export function setRuntimeBranding(partial: {
  brandName?: string;
  logoUrl?: string;
}) {
  const next = {...runtimeConfig};
  if (partial.brandName?.trim()) {
    next.brandName = partial.brandName.trim();
  }
  if (partial.logoUrl?.trim()) {
    next.logoUrl = partial.logoUrl.trim();
  }
  runtimeConfig = next;
}

/** Resolve relative /uploads paths against API; pass through absolute URLs. */
export function resolveLogoUrl(logoUrl?: string): string {
  const raw = (logoUrl || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) return raw;
  const base = getApiBaseUrl().replace(/\/$/, '');
  return raw.startsWith('/') ? `${base}${raw}` : `${base}/${raw}`;
}

export function getBrandLogoSrc(): string {
  return resolveLogoUrl(runtimeConfig.logoUrl) || '/logo.png';
}

export async function loadRuntimeConfig(): Promise<AppRuntimeConfig> {
  try {
    const res = await fetch(`/config.json?t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      runtimeConfig = {...FALLBACK};
      return runtimeConfig;
    }
    const json = (await res.json()) as Partial<{
      apiBaseUrl: string;
      brandName: string;
      logoUrl: string;
      themeColors: Partial<ClientColorPalette>;
    }>;

    const apiBaseUrl = (json.apiBaseUrl || FALLBACK.apiBaseUrl).replace(
      /\/$/,
      '',
    );

    const themeColors: ClientColorPalette = {
      ...FALLBACK.themeColors,
      ...(json.themeColors || {}),
    };

    runtimeConfig = {
      apiBaseUrl,
      brandName: json.brandName?.trim() || FALLBACK.brandName,
      logoUrl: json.logoUrl?.trim() || undefined,
      themeColors,
    };
    return runtimeConfig;
  } catch {
    runtimeConfig = {...FALLBACK};
    return runtimeConfig;
  }
}
