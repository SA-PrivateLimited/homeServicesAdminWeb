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
const PRODUCTION_API_BASE_URL = 'https://api.akanso.in';

let runtimeConfig: AppRuntimeConfig = {...FALLBACK};
export const RUNTIME_BRANDING_EVENT = 'hs-runtime-branding-change';

function notifyRuntimeBrandingChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(RUNTIME_BRANDING_EVENT));
}

export function getRuntimeConfig(): AppRuntimeConfig {
  return runtimeConfig;
}

export function getApiBaseUrl(): string {
  return sanitizeApiBaseUrl(runtimeConfig.apiBaseUrl);
}

export function setApiBaseUrl(url: string): void {
  runtimeConfig = {
    ...runtimeConfig,
    apiBaseUrl: sanitizeApiBaseUrl(url),
  };
  notifyRuntimeBrandingChanged();
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
  notifyRuntimeBrandingChanged();
}

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === '127.0.0.1' ||
    hostname === 'localhost' ||
    hostname === '::1' ||
    hostname === '0.0.0.0'
  );
}

function isLocalBrowserHost(): boolean {
  if (typeof window === 'undefined') return true;
  return /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
}

/**
 * Never call localhost APIs from deployed HTTPS origins.
 * Keep localhost behavior for local development.
 */
export function sanitizeApiBaseUrl(url: string): string {
  const trimmed = String(url || '')
    .trim()
    .replace(/\/$/, '');

  if (isLocalBrowserHost()) {
    let next = trimmed || FALLBACK.apiBaseUrl;
    if (typeof window !== 'undefined') {
      const pageHost = window.location.hostname;
      try {
        const parsed = new URL(next);
        const apiHost = parsed.hostname;
        if (
          (apiHost === 'localhost' || apiHost === '127.0.0.1') &&
          (pageHost === 'localhost' || pageHost === '127.0.0.1') &&
          apiHost !== pageHost
        ) {
          parsed.hostname = pageHost;
          next = parsed.toString().replace(/\/$/, '');
        }
      } catch {
        /* keep next */
      }
    }
    return next;
  }

  if (!trimmed || /localhost|127\.0\.0\.1/i.test(trimmed)) {
    return PRODUCTION_API_BASE_URL;
  }

  if (
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    trimmed.startsWith('http://')
  ) {
    return trimmed.replace(/^http:\/\//i, 'https://');
  }

  return trimmed;
}

/**
 * Resolve logo URLs for display.
 * Relative /uploads paths are prefixed with the current API host.
 * Loopback hosts (from local S3 fallback) are rewritten to the current API host
 * so production admin can still load `/uploads/...` files.
 */
export function resolveLogoUrl(logoUrl?: string): string {
  const raw = (logoUrl || '').trim();
  if (!raw) return '';
  if (raw.startsWith('data:') || raw.startsWith('blob:')) return raw;

  const base = getApiBaseUrl().replace(/\/$/, '');

  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      if (isLoopbackHost(parsed.hostname) && parsed.pathname.startsWith('/uploads/')) {
        return `${base}${parsed.pathname}${parsed.search}`;
      }
    } catch {
      return raw;
    }
    return raw;
  }

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
      runtimeConfig = {
        ...FALLBACK,
        apiBaseUrl: sanitizeApiBaseUrl(FALLBACK.apiBaseUrl),
      };
      notifyRuntimeBrandingChanged();
      return runtimeConfig;
    }
    const json = (await res.json()) as Partial<{
      apiBaseUrl: string;
      brandName: string;
      logoUrl: string;
      themeColors: Partial<ClientColorPalette>;
    }>;

    const apiBaseUrl = sanitizeApiBaseUrl(json.apiBaseUrl || FALLBACK.apiBaseUrl);

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
    notifyRuntimeBrandingChanged();
    return runtimeConfig;
  } catch {
    runtimeConfig = {
      ...FALLBACK,
      apiBaseUrl: sanitizeApiBaseUrl(FALLBACK.apiBaseUrl),
    };
    notifyRuntimeBrandingChanged();
    return runtimeConfig;
  }
}
