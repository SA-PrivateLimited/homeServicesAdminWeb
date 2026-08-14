import { resolveApiBaseUrl, API_TIMEOUT } from '../../config/api';
import {
  JWT_STORAGE_KEY,
  USER_STORAGE_KEY,
  getStoredJwt,
} from '../backendAuth';
import {
  SUPER_ADMIN_TOKEN_KEY,
  getStoredSuperAdminToken,
} from './superAdminApi';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  total?: number;
  count?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  count: number;
  limit: number;
  offset: number;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
  skipAuth?: boolean;
  /** When true, 401 does not clear session / redirect (used during logout). */
  skipUnauthorizedRedirect?: boolean;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

let handlingUnauthorized = false;

function clearLocalAuthStorage() {
  localStorage.removeItem(JWT_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
  sessionStorage.removeItem(SUPER_ADMIN_TOKEN_KEY);
}

/** Clear session and send user to login when the access token is rejected. */
export function handleUnauthorizedSession() {
  if (handlingUnauthorized) return;
  handlingUnauthorized = true;
  clearLocalAuthStorage();
  const path = window.location.pathname || '';
  if (!path.startsWith('/login') && !path.startsWith('/activate')) {
    window.location.assign('/login');
  } else {
    handlingUnauthorized = false;
  }
}

async function getAuthToken(): Promise<string | null> {
  return getStoredJwt();
}

async function fetchApiPayload(
  endpoint: string,
  options: RequestOptions = {},
): Promise<Record<string, unknown>> {
  const {
    method = 'GET',
    body,
    headers = {},
    timeout = API_TIMEOUT,
    skipAuth = false,
    skipUnauthorizedRedirect = false,
  } = options;

  const authToken = skipAuth ? null : await getAuthToken();
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (authToken && !skipAuth) {
    requestHeaders.Authorization = `Bearer ${authToken}`;
  }

  const superAdminToken = getStoredSuperAdminToken();
  if (superAdminToken && !skipAuth) {
    requestHeaders['X-Super-Admin-Token'] = superAdminToken;
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  const base = resolveApiBaseUrl();
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${base}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  try {
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (!response.ok) {
      if (
        response.status === 401 &&
        !skipAuth &&
        !skipUnauthorizedRedirect
      ) {
        handleUnauthorizedSession();
      }
      const message =
        (typeof payload.message === 'string' && payload.message) ||
        (typeof payload.error === 'string' && payload.error) ||
        `Request failed (${response.status})`;
      throw new ApiError(message, response.status);
    }

    return payload;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const payload = await fetchApiPayload(endpoint, options);

  if (
    payload &&
    typeof payload === 'object' &&
    'success' in payload &&
    'data' in payload
  ) {
    return payload.data as T;
  }

  return payload as T;
}

export async function apiGetPaginated<T>(
  endpoint: string,
  options?: Omit<RequestOptions, 'method' | 'body'>,
): Promise<PaginatedResult<T>> {
  const payload = await fetchApiPayload(endpoint, {
    ...options,
    method: 'GET',
  });
  const items = Array.isArray(payload.data)
    ? (payload.data as T[])
    : Array.isArray(payload)
      ? (payload as T[])
      : [];
  const limit =
    typeof payload.limit === 'number' ? payload.limit : items.length;
  const offset = typeof payload.offset === 'number' ? payload.offset : 0;
  const total =
    typeof payload.total === 'number'
      ? payload.total
      : typeof payload.count === 'number'
        ? payload.count
        : items.length;
  const count =
    typeof payload.count === 'number' ? payload.count : items.length;
  return {items, total, count, limit, offset};
}

export function apiGet<T>(
  endpoint: string,
  options?: Omit<RequestOptions, 'method' | 'body'>,
): Promise<T> {
  return apiRequest<T>(endpoint, { ...options, method: 'GET' });
}

export function apiPost<T>(
  endpoint: string,
  body?: unknown,
  options?: Omit<RequestOptions, 'method' | 'body'>,
): Promise<T> {
  return apiRequest<T>(endpoint, { ...options, method: 'POST', body });
}

export function apiPut<T>(
  endpoint: string,
  body?: unknown,
  options?: Omit<RequestOptions, 'method' | 'body'>,
): Promise<T> {
  return apiRequest<T>(endpoint, { ...options, method: 'PUT', body });
}

export function apiPatch<T>(
  endpoint: string,
  body?: unknown,
  options?: Omit<RequestOptions, 'method' | 'body'>,
): Promise<T> {
  return apiRequest<T>(endpoint, { ...options, method: 'PATCH', body });
}

export function apiDelete<T>(
  endpoint: string,
  options?: Omit<RequestOptions, 'method' | 'body'>,
): Promise<T> {
  return apiRequest<T>(endpoint, { ...options, method: 'DELETE' });
}

/** Multipart upload (do not set Content-Type — browser sets boundary). */
export async function apiUploadFormData<T>(
  endpoint: string,
  formData: FormData,
  options?: Omit<RequestOptions, 'method' | 'body'>,
): Promise<T> {
  const authToken = options?.skipAuth ? null : await getAuthToken();
  const requestHeaders: Record<string, string> = {
    ...(options?.headers || {}),
  };
  delete requestHeaders['Content-Type'];

  if (authToken && !options?.skipAuth) {
    requestHeaders.Authorization = `Bearer ${authToken}`;
  }
  const superAdminToken = getStoredSuperAdminToken();
  if (superAdminToken && !options?.skipAuth) {
    requestHeaders['X-Super-Admin-Token'] = superAdminToken;
  }

  const timeout = options?.timeout ?? API_TIMEOUT;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  const base = resolveApiBaseUrl();
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${base}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: requestHeaders,
      body: formData,
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!response.ok) {
      if (
        response.status === 401 &&
        !options?.skipAuth &&
        !options?.skipUnauthorizedRedirect
      ) {
        handleUnauthorizedSession();
      }
      const message =
        (typeof payload.message === 'string' && payload.message) ||
        (typeof payload.error === 'string' && payload.error) ||
        `Request failed (${response.status})`;
      throw new ApiError(message, response.status);
    }
    if (
      payload &&
      typeof payload === 'object' &&
      'success' in payload &&
      'data' in payload
    ) {
      return payload.data as T;
    }
    return payload as T;
  } finally {
    window.clearTimeout(timer);
  }
}
