import {create} from 'zustand';
import {
  type AdminUser,
  clearBackendSession,
  enableMfaWithBackend,
  fetchCurrentAdmin,
  loginWithBackend,
  type LoginStepResult,
  logoutWithBackend,
  persistSession,
  getStoredJwt,
  verifyMfaWithBackend,
} from '../services/backendAuth';
import {
  clearSuperAdminToken,
  elevateSuperAdmin,
  getStoredSuperAdminToken,
  updateSuperAdminKey,
} from '../services/api/superAdminApi';
import { refreshAccessToken } from '../services/sessionRefresh';
import { ApiError } from '../services/api/apiClient';

interface AuthState {
  user: AdminUser | null;
  token: string | null;
  hydrated: boolean;
  superAdminElevated: boolean;
  hydrate: () => Promise<void>;
  /** Password step — may return MFA / setup challenge instead of a session. */
  beginLogin: (email: string, password: string) => Promise<LoginStepResult>;
  completeMfaSetup: (mfaToken: string, code: string) => Promise<void>;
  completeMfaVerify: (mfaToken: string, code: string) => Promise<void>;
  elevateToSuperAdmin: (code: string) => Promise<void>;
  exitSuperAdmin: () => void;
  changeSuperAdminKey: (currentCode: string, newCode: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  hydrated: false,
  superAdminElevated: false,

  hydrate: async () => {
    const token = await getStoredJwt();
    if (!token) {
      clearSuperAdminToken();
      await clearBackendSession();
      set({
        user: null,
        token: null,
        hydrated: true,
        superAdminElevated: false,
      });
      return;
    }

    try {
      const user = await fetchCurrentAdmin();
      persistSession(user, token);
      set({
        user,
        token,
        hydrated: true,
        superAdminElevated: Boolean(getStoredSuperAdminToken()),
      });
    } catch (err) {
      const hardAuthFailure =
        err instanceof ApiError && (err.status === 401 || err.status === 403);
      if (hardAuthFailure) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          try {
            const user = await fetchCurrentAdmin();
            persistSession(user, refreshed);
            set({
              user,
              token: refreshed,
              hydrated: true,
              superAdminElevated: Boolean(getStoredSuperAdminToken()),
            });
            return;
          } catch {
            /* fall through */
          }
        }
      }
      clearSuperAdminToken();
      await clearBackendSession();
      set({
        user: null,
        token: null,
        hydrated: true,
        superAdminElevated: false,
      });
    }
  },

  beginLogin: async (email, password) => {
    clearSuperAdminToken();
    const result = await loginWithBackend(email, password);
    if (result.kind === 'session') {
      set({user: result.user, token: result.token, superAdminElevated: false});
    }
    return result;
  },

  completeMfaSetup: async (mfaToken, code) => {
    const {user, token} = await enableMfaWithBackend(mfaToken, code);
    clearSuperAdminToken();
    set({user, token, superAdminElevated: false});
  },

  completeMfaVerify: async (mfaToken, code) => {
    const {user, token} = await verifyMfaWithBackend(mfaToken, code);
    clearSuperAdminToken();
    set({user, token, superAdminElevated: false});
  },

  elevateToSuperAdmin: async (code) => {
    await elevateSuperAdmin(code);
    set({superAdminElevated: true});
  },

  exitSuperAdmin: () => {
    clearSuperAdminToken();
    set({superAdminElevated: false});
  },

  changeSuperAdminKey: async (currentCode, newCode) => {
    await updateSuperAdminKey(currentCode, newCode);
  },

  logout: async () => {
    await logoutWithBackend();
    clearSuperAdminToken();
    await clearBackendSession();
    set({user: null, token: null, superAdminElevated: false});
  },
}));
