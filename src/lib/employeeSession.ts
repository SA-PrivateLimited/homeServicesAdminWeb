/**
 * Employee portal session (separate from Admin JWT).
 */

export const EMPLOYEE_JWT_KEY = 'hs_employee_jwt';
export const EMPLOYEE_USER_KEY = 'hs_employee_user';

export function getEmployeeJwt(): string | null {
  try {
    return localStorage.getItem(EMPLOYEE_JWT_KEY);
  } catch {
    return null;
  }
}

export function getStoredEmployeeUser<T = unknown>(): T | null {
  try {
    const raw = localStorage.getItem(EMPLOYEE_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setEmployeeSession(accessToken: string, employee: unknown): void {
  localStorage.setItem(EMPLOYEE_JWT_KEY, accessToken);
  localStorage.setItem(EMPLOYEE_USER_KEY, JSON.stringify(employee));
}

export function clearEmployeeSession(): void {
  localStorage.removeItem(EMPLOYEE_JWT_KEY);
  localStorage.removeItem(EMPLOYEE_USER_KEY);
}

export function isEmployeeSignedIn(): boolean {
  return Boolean(getEmployeeJwt());
}
