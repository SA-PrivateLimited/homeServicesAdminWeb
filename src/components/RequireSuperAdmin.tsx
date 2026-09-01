import {Navigate, Outlet} from 'react-router-dom';
import {useAuthStore} from '../store/authStore';

/** Super Admin elevation required (4-digit key). */
export function RequireSuperAdmin() {
  const superAdminElevated = useAuthStore((s) => s.superAdminElevated);
  if (!superAdminElevated) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
