import {getStoredJwt} from '../services/backendAuth';
import {getEmpApiUrl} from '../config/runtime';

export type EmpHostSession = {
  accessToken: string;
  companyId: string;
  permissions: string[];
};

let cached: EmpHostSession | null = null;
let inflight: Promise<EmpHostSession> | null = null;

function asSession(payload: Record<string, unknown>): EmpHostSession {
  const data =
    payload.data && typeof payload.data === 'object'
      ? (payload.data as Record<string, unknown>)
      : payload;
  const accessToken = String(data.accessToken || '');
  const companyId = String(data.companyId || 'akansho');
  const permissions = Array.isArray(data.permissions)
    ? data.permissions.map((p) => String(p))
    : [];
  if (!accessToken) {
    throw new Error('Employee Management session was empty');
  }
  return {accessToken, companyId, permissions};
}

export async function fetchEmpHostSession(): Promise<EmpHostSession> {
  if (cached?.accessToken) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    const adminJwt = await getStoredJwt();
    if (!adminJwt) {
      throw new Error('Admin session required');
    }
    const base = getEmpApiUrl().replace(/\/$/, '');
    const response = await fetch(`${base}/api/v1/auth/akansho-admin`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminJwt}`,
        'Content-Type': 'application/json',
      },
    });
    const payload = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!response.ok) {
      const message =
        (typeof payload.message === 'string' && payload.message) ||
        `Employee Management API ${response.status} from ${base}`;
      throw new Error(message);
    }
    cached = asSession(payload);
    return cached;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export function clearEmpHostSession(): void {
  cached = null;
}

export async function getEmpAccessToken(): Promise<string> {
  const session = await fetchEmpHostSession();
  return session.accessToken;
}
