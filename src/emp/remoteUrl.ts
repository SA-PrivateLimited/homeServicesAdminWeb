const PRODUCTION_EMP_REMOTE =
  'https://employee-management.akansho.com/assets/remoteEntry.js';
const PRODUCTION_EMP_API = 'https://employee-management-api.akansho.com';
const DEV_EMP_REMOTE_PROXY = '/__emp_remote/assets/remoteEntry.js';
const DEV_EMP_API = 'http://localhost:4100';

function isLocalHost(): boolean {
  if (typeof window === 'undefined') return true;
  return /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
}

export function defaultEmpRemoteUrl(): string {
  if (!isLocalHost()) return PRODUCTION_EMP_REMOTE;
  if (typeof window === 'undefined') return DEV_EMP_REMOTE_PROXY;
  return `${window.location.origin}${DEV_EMP_REMOTE_PROXY}`;
}

export function rewriteLocalEmpRemoteUrl(url: string): string {
  const trimmed = String(url || '').trim();
  if (!isLocalHost()) return trimmed;
  try {
    const parsed = new URL(
      trimmed || DEV_EMP_REMOTE_PROXY,
      typeof window !== 'undefined'
        ? window.location.origin
        : 'http://localhost:5173',
    );
    const localEmp =
      /^(localhost|127\.0\.0\.1)$/i.test(parsed.hostname) &&
      (parsed.port === '5180' ||
        parsed.pathname.includes('remoteEntry.js') ||
        parsed.pathname.startsWith('/__emp_remote/'));
    if (localEmp || parsed.pathname.startsWith('/__emp_remote/')) {
      return defaultEmpRemoteUrl();
    }
  } catch {
    if (trimmed.includes('localhost:5180') || trimmed.startsWith('/__emp_remote/')) {
      return defaultEmpRemoteUrl();
    }
  }
  return trimmed;
}

export function defaultEmpApiUrl(): string {
  return isLocalHost() ? DEV_EMP_API : PRODUCTION_EMP_API;
}

/**
 * Module Federation remoteEntry must be same-origin.
 * Admin CSP is `script-src 'self'` — cross-origin import() and eval are blocked.
 * Local Vite proxies `/__emp_remote` → employee-management-web :5180.
 */
export function resolveEmpRemoteEntryUrl(): string {
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  const sameOrigin = `${origin}${DEV_EMP_REMOTE_PROXY}`;
  if (typeof window === 'undefined') return sameOrigin;
  if (/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)) {
    return sameOrigin;
  }
  const configured = rewriteLocalEmpRemoteUrl(
    String(window.__EMP_REMOTE_ENTRY__ || '').trim() || defaultEmpRemoteUrl(),
  );
  try {
    const parsed = new URL(configured, origin);
    if (parsed.origin === origin) return parsed.href;
  } catch {
    if (configured.startsWith('/')) return `${origin}${configured}`;
  }
  return configured;
}

export function applyEmpRemoteEntry(url: string): void {
  const next = String(url || '').trim() || defaultEmpRemoteUrl();
  window.__EMP_REMOTE_ENTRY__ = next;
}

declare global {
  interface Window {
    __EMP_REMOTE_ENTRY__?: string;
  }
}
